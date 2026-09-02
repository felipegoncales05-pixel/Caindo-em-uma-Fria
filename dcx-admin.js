window.DCX = window.DCX || {};
(() => {
  const BUILD = "DCX-OS-A1";
  const ADMIN_UID = "1uVVp67PW7c53fs6dstTDNE46Nz1";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const teamStatuses = ["OPERACIONAL","EM MISSÃO","EM COMBATE","REAGRUPANDO","EVACUANDO","SEM COMUNICAÇÃO","INATIVA"];
  const operatorStatuses = ["OPERACIONAL","OCUPADO","FERIDO","CRÍTICO","SEPARADO","SEM COMUNICAÇÃO","DESAPARECIDO","INCONSCIENTE"];
  const commsStatuses = ["ONLINE","SINAL FRACO","SEM COMUNICAÇÃO"];

  let room = new URLSearchParams(location.search).get("room") || window.OPH_CONFIG?.defaultRoom || "FRIA-01";
  let db = null, auth = null, base = null;
  let operators = {}, teams = {}, presence = {}, requests = {};
  let selectedOperator = "";
  let activeTab = sessionStorage.getItem("dcx-km-tab") || "master";
  let initialized = false;
  let refs = [];

  function toast(text){
    const e=$("toast"); if(!e) return;
    e.textContent=text; e.classList.add("show"); setTimeout(()=>e.classList.remove("show"),1800);
  }
  function cleanName(v){ return String(v||"").trim().replace(/\s+/g," ").slice(0,48); }
  function safeId(prefix="ID"){
    const raw=(crypto.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,"").slice(0,10).toUpperCase();
    return `${prefix}-${raw}`;
  }
  function now(){ return firebase.database.ServerValue.TIMESTAMP; }
  function path(p=""){ return `${base}${p?"/"+p:""}`; }
  function ref(p=""){ return db.ref(path(p)); }
  function fmtAgo(ts){
    ts=Number(ts)||0; if(!ts) return "SEM SINAL";
    const s=Math.max(0,Math.floor((Date.now()-ts)/1000));
    if(s<5)return "AGORA"; if(s<60)return `HÁ ${s}s`; const m=Math.floor(s/60); if(m<60)return `HÁ ${m}min`; return `HÁ ${Math.floor(m/60)}h`;
  }
  function presenceState(p){
    if(!p?.lastSeen)return {label:"OFFLINE",cls:"offline"};
    const age=Date.now()-Number(p.lastSeen||0);
    if(age>90000)return {label:"OFFLINE",cls:"offline"};
    if(p.visibility==="hidden")return {label:"OUTRA GUIA / MINIMIZADO",cls:"hiddenTab"};
    if(p.focused===false)return {label:"SEM FOCO",cls:"away"};
    if(age>45000)return {label:"INATIVO",cls:"away"};
    return {label:"ATIVO",cls:"online"};
  }
  function optionList(values,current){return values.map(v=>`<option value="${esc(v)}" ${v===current?"selected":""}>${esc(v)}</option>`).join("")}
  function teamName(id){return teams?.[id]?.name || (id?"EQUIPE DESCONHECIDA":"SEM EQUIPE")}
  function operatorName(op,id){return op?.identity?.name || op?.name || id}
  function operatorType(op,id){return op?.identity?.type || (String(id).startsWith("NPC-")?"npc":"player")}
  function narrative(op){return Object.assign({teamId:"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true},op?.narrative||{})}
  function operatorEntries(){return Object.entries(operators||{}).filter(([id])=>id!=="_init")}

  async function log(type, text, data={}){
    try{
      const r=ref("eventLog").push();
      await r.set({type,text,data,ts:now(),by:"KEYMASTER",build:BUILD});
    }catch(e){console.warn("EventLog",e)}
  }

  function switchTab(tab){
    tab=String(tab||"master");
    activeTab=tab; sessionStorage.setItem("dcx-km-tab",tab);
    document.querySelectorAll(".kmWorkspaceTab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
    document.querySelectorAll(".kmWorkspaceView").forEach(v=>v.classList.toggle("active",v.dataset.kmView===tab));
    if(tab==="master")renderMaster();
    if(tab==="players")renderPlayers();
    if(tab==="teams")renderTeams();
  }

  function renderTabs(){
    document.querySelectorAll(".kmWorkspaceTab").forEach(b=>b.classList.toggle("active",b.dataset.tab===activeTab));
    document.querySelectorAll(".kmWorkspaceView").forEach(v=>v.classList.toggle("active",v.dataset.kmView===activeTab));
    const pending = Object.values(requests||{}).reduce((n,node)=>n+Object.keys(node?.chat||{}).length,0);
    const badge=$("dcxYumiyaTabBadge"); if(badge){badge.textContent=pending;badge.classList.toggle("hidden",!pending)}
  }

  function renderMaster(){
    if(!$("dcxMasterStats"))return;
    const players=operatorEntries().filter(([id,op])=>operatorType(op,id)==="player");
    const npcs=operatorEntries().filter(([id,op])=>operatorType(op,id)==="npc");
    const online=Object.values(presence).filter(p=>presenceState(p).cls==="online").length;
    const distracted=Object.values(presence).filter(p=>["hiddenTab","away"].includes(presenceState(p).cls)).length;
    $("dcxMasterStats").innerHTML=`
      <div class="dcxStat"><b>${players.length}</b><span>JOGADORES</span></div>
      <div class="dcxStat"><b>${npcs.length}</b><span>NPCs</span></div>
      <div class="dcxStat"><b>${online}</b><span>ATIVOS</span></div>
      <div class="dcxStat"><b>${distracted}</b><span>SEM FOCO</span></div>
      <div class="dcxStat"><b>${Object.keys(teams).filter(k=>k!=="_init").length}</b><span>EQUIPES</span></div>`;
    const list=$("dcxHeartbeatList");
    if(list){
      const rows=players.map(([id,op])=>{
        const p=Object.values(presence).find(x=>x?.playerId===id) || {};
        const s=presenceState(p);
        return `<div class="dcxHeartbeatRow"><span class="dcxPresenceDot ${s.cls}"></span><div><b>${esc(operatorName(op,id))}</b><small>${esc(id)} · ${esc(p.build||"BUILD DESCONHECIDA")}</small></div><div class="dcxHeartbeatMeta"><b>${s.label}</b><small>${fmtAgo(p.lastSeen)}${p.lastInteraction?` · interação ${fmtAgo(p.lastInteraction)}`:""}</small></div></div>`;
      }).join("");
      list.innerHTML=rows||`<div class="dcxEmpty">Nenhum jogador registrado ainda.</div>`;
    }
    if($("dcxMasterRoom"))$("dcxMasterRoom").textContent=room;
    if($("dcxMasterBuild"))$("dcxMasterBuild").textContent=window.OPH_BUILD||BUILD;
    if($("dcxMasterUid"))$("dcxMasterUid").textContent=auth?.currentUser?.uid||"—";
  }

  function renderPlayers(){
    const list=$("dcxPlayerList"); if(!list)return;
    const real=operatorEntries().filter(([id,op])=>operatorType(op,id)==="player").sort((a,b)=>operatorName(a[1],a[0]).localeCompare(operatorName(b[1],b[0]),"pt-BR"));
    list.innerHTML=real.map(([id,op])=>{
      const n=narrative(op), p=Object.values(presence).find(x=>x?.playerId===id)||{}, ps=presenceState(p);
      return `<button class="dcxOperatorRow ${selectedOperator===id?"active":""}" onclick="DCX.Admin.selectOperator('${esc(id)}')"><span class="dcxPresenceDot ${ps.cls}"></span><div><b>${esc(operatorName(op,id))}</b><small>${esc(id)} · ${esc(teamName(n.teamId))}</small></div><em>${ps.label}</em></button>`;
    }).join("") || `<div class="dcxEmpty">Nenhum jogador sincronizado. Assim que um cliente conectado publicar a identidade, ele aparece aqui.</div>`;
    renderOperatorEditor();
  }

  function renderOperatorEditor(){
    const box=$("dcxPlayerEditor"); if(!box)return;
    const op=operators[selectedOperator];
    if(!op || operatorType(op,selectedOperator)!=="player"){
      box.innerHTML=`<div class="dcxEmpty big">Selecione um jogador para administrar.</div>`; return;
    }
    const n=narrative(op), p=Object.values(presence).find(x=>x?.playerId===selectedOperator)||{}, ps=presenceState(p);
    box.innerHTML=`
      <div class="dcxEditorHead"><div><span class="tag">PLAYER DATA</span><h2>${esc(operatorName(op,selectedOperator))}</h2><small>${esc(selectedOperator)}</small></div><span class="dcxStatePill ${ps.cls}">${ps.label}</span></div>
      <div class="dcxFormGrid">
        <label>NOME<input id="dcxOpName" value="${esc(operatorName(op,selectedOperator))}" maxlength="48"></label>
        <label>EQUIPE<select id="dcxOpTeam"><option value="">SEM EQUIPE</option>${Object.entries(teams).filter(([k])=>k!=="_init").map(([id,t])=>`<option value="${esc(id)}" ${id===n.teamId?"selected":""}>${esc(t.name||id)}</option>`).join("")}</select></label>
        <label>FUNÇÃO<input id="dcxOpRole" value="${esc(n.role)}" maxlength="48" placeholder="Ex.: Líder, Pesquisa, Médico"></label>
        <label>STATUS<select id="dcxOpStatus">${optionList(operatorStatuses,n.status)}</select></label>
        <label>LOCALIZAÇÃO<input id="dcxOpLocation" value="${esc(n.location)}" maxlength="64" placeholder="Opcional"></label>
        <label>COMUNICAÇÃO<select id="dcxOpComms">${optionList(commsStatuses,n.commsStatus)}</select></label>
      </div>
      <div class="dcxTechBox"><b>DIAGNÓSTICO DO CLIENTE</b><span>Build: ${esc(p.build||"—")}</span><span>UID atual: ${esc(p.uid||"—")}</span><span>Último heartbeat: ${fmtAgo(p.lastSeen)}</span><span>Última interação: ${fmtAgo(p.lastInteraction)}</span></div>
      <div class="actions dcxEditorActions"><button class="btn gold" onclick="DCX.Admin.saveSelectedPlayer()">SALVAR ALTERAÇÕES</button><button class="btn red" onclick="DCX.Admin.removeSelectedPlayer()">REMOVER REGISTRO</button></div>`;
  }

  function renderTeams(){
    const list=$("dcxTeamList"); if(!list)return;
    const entries=Object.entries(teams).filter(([k])=>k!=="_init").sort((a,b)=>(a[1]?.name||"").localeCompare(b[1]?.name||"","pt-BR"));
    list.innerHTML=entries.map(([id,t])=>{
      const members=operatorEntries().filter(([oid,op])=>narrative(op).teamId===id);
      return `<article class="dcxTeamAdminCard">
        <div class="dcxTeamAdminHead"><div><span class="tag">${esc(t.codename||"EQUIPE")}</span><h3>${esc(t.name||id)}</h3></div><span class="dcxTeamStatus">${esc(t.status||"OPERACIONAL")}</span></div>
        ${t.description?`<p>${esc(t.description)}</p>`:""}
        <div class="dcxTeamFields">
          <label>NOME<input value="${esc(t.name||"")}" onchange="DCX.Admin.updateTeamField('${esc(id)}','name',this.value)"></label>
          <label>CODINOME<input value="${esc(t.codename||"")}" onchange="DCX.Admin.updateTeamField('${esc(id)}','codename',this.value)"></label>
          <label>STATUS<select onchange="DCX.Admin.updateTeamField('${esc(id)}','status',this.value)">${optionList(teamStatuses,t.status||"OPERACIONAL")}</select></label>
          <label class="span2">DESCRIÇÃO<textarea rows="2" onchange="DCX.Admin.updateTeamField('${esc(id)}','description',this.value)">${esc(t.description||"")}</textarea></label>
        </div>
        <div class="dcxMembers"><b>MEMBROS · ${members.length}</b>${members.map(([oid,op])=>`<button onclick="DCX.Admin.editRosterOperator('${esc(oid)}')">${esc(operatorName(op,oid))}<small>${esc(narrative(op).role||operatorType(op,oid).toUpperCase())}</small></button>`).join("")||`<span class="dcxEmpty">Sem membros.</span>`}</div>
        <div class="actions"><button class="btn" onclick="DCX.Admin.openAddMember('${esc(id)}')">+ CRIAR NPC NESTA EQUIPE</button><button class="btn red" onclick="DCX.Admin.deleteTeam('${esc(id)}')">EXCLUIR EQUIPE</button></div>
      </article>`;
    }).join("") || `<div class="dcxEmpty big">Nenhuma equipe criada. Use “CRIAR EQUIPE”.</div>`;
    renderUnassigned();
  }

  function renderUnassigned(){
    const box=$("dcxUnassigned"); if(!box)return;
    const rows=operatorEntries().filter(([id,op])=>!narrative(op).teamId);
    box.innerHTML=rows.map(([id,op])=>`<button onclick="DCX.Admin.editRosterOperator('${esc(id)}')"><b>${esc(operatorName(op,id))}</b><small>${operatorType(op,id)==="npc"?"NPC":"JOGADOR"} · ${esc(narrative(op).status)}</small></button>`).join("")||`<span class="dcxEmpty">Todos os operadores estão alocados.</span>`;
  }

  function renderRosterEditor(){
    const box=$("dcxRosterEditor"); if(!box)return;
    const op=operators[selectedOperator]; if(!op){box.classList.add("hidden");return}
    const id=selectedOperator,n=narrative(op),type=operatorType(op,id);
    box.classList.remove("hidden");
    box.innerHTML=`<div class="dcxModalCard"><div class="dcxEditorHead"><div><span class="tag">${type==="npc"?"NPC":"JOGADOR"}</span><h2>${esc(operatorName(op,id))}</h2><small>${esc(id)}</small></div><button class="chatIconBtn" onclick="DCX.Admin.closeRosterEditor()">×</button></div>
      <div class="dcxFormGrid">
        <label>NOME<input id="dcxRosterName" value="${esc(operatorName(op,id))}" maxlength="48"></label>
        <label>EQUIPE<select id="dcxRosterTeam"><option value="">SEM EQUIPE</option>${Object.entries(teams).filter(([k])=>k!=="_init").map(([tid,t])=>`<option value="${esc(tid)}" ${tid===n.teamId?"selected":""}>${esc(t.name||tid)}</option>`).join("")}</select></label>
        <label>FUNÇÃO<input id="dcxRosterRole" value="${esc(n.role)}" maxlength="48"></label>
        <label>STATUS<select id="dcxRosterStatus">${optionList(operatorStatuses,n.status)}</select></label>
        <label>LOCALIZAÇÃO<input id="dcxRosterLocation" value="${esc(n.location)}" maxlength="64"></label>
        <label>COMUNICAÇÃO<select id="dcxRosterComms">${optionList(commsStatuses,n.commsStatus)}</select></label>
      </div>
      <div class="actions dcxEditorActions"><button class="btn gold" onclick="DCX.Admin.saveRosterOperator()">SALVAR</button>${type==="npc"?`<button class="btn red" onclick="DCX.Admin.deleteNpc('${esc(id)}')">EXCLUIR NPC</button>`:""}</div></div>`;
  }

  async function syncExistingPlayers(){
    const snap=await db.ref(`rooms/${room}/requests`).once("value"); requests=snap.val()||{};
    const updates={};
    for(const node of Object.values(requests)){
      const i=node?.identity; if(!i?.playerId||!i?.nickname)continue;
      const id=String(i.playerId), old=operators[id]||{};
      updates[`${id}/identity`]={type:"player",playerId:id,name:cleanName(i.nickname),updatedAt:Date.now()};
      if(!old.narrative)updates[`${id}/narrative`]={teamId:"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true};
    }
    if(Object.keys(updates).length)await ref("operators").update(updates);
  }

  async function createTeam(){
    const name=cleanName($("dcxNewTeamName")?.value); if(!name){toast("INFORME O NOME DA EQUIPE");return}
    const id=safeId("TEAM");
    await ref(`teams/${id}`).set({name,codename:cleanName($("dcxNewTeamCode")?.value),description:String($("dcxNewTeamDesc")?.value||"").trim().slice(0,500),status:"OPERACIONAL",createdAt:now(),updatedAt:now()});
    if($("dcxNewTeamName"))$("dcxNewTeamName").value=""; if($("dcxNewTeamCode"))$("dcxNewTeamCode").value=""; if($("dcxNewTeamDesc"))$("dcxNewTeamDesc").value="";
    await log("team.create",`Equipe ${name} criada`,{teamId:id}); toast("EQUIPE CRIADA");
  }
  async function updateTeamField(id,field,value){
    if(!["name","codename","description","status"].includes(field))return;
    value=field==="description"?String(value||"").trim().slice(0,500):cleanName(value);
    if(field==="name"&&!value){toast("NOME DA EQUIPE NÃO PODE FICAR VAZIO");renderTeams();return}
    await ref(`teams/${id}`).update({[field]:value,updatedAt:now()}); await log("team.update",`Equipe ${teams[id]?.name||id}: ${field} alterado`,{teamId:id,field,value});
  }
  async function deleteTeam(id){
    const t=teams[id]; if(!t)return; if(!confirm(`Excluir a equipe “${t.name||id}”?\n\nOs operadores não serão excluídos; eles ficarão SEM EQUIPE.`))return;
    const updates={}; operatorEntries().forEach(([oid,op])=>{if(narrative(op).teamId===id)updates[`operators/${oid}/narrative/teamId`]=""}); updates[`teams/${id}`]=null;
    await db.ref(`rooms/${room}/dcx`).update(updates); await log("team.delete",`Equipe ${t.name||id} excluída`,{teamId:id}); toast("EQUIPE EXCLUÍDA");
  }
  function openAddMember(teamId){
    const choice=prompt(`Adicionar à ${teams[teamId]?.name||"equipe"}:\n\nDigite o NOME de um NPC novo.\n\nPara adicionar um jogador existente, cancele e abra o operador em “SEM ALOCAÇÃO”.`);
    if(choice===null)return; const name=cleanName(choice); if(!name){toast("NOME INVÁLIDO");return} createNpc(name,teamId);
  }
  async function createNpc(nameArg="",teamId=""){
    const name=cleanName(nameArg || $("dcxNpcName")?.value); if(!name){toast("INFORME O NOME DO NPC");return}
    const id=safeId("NPC");
    await ref(`operators/${id}`).set({identity:{type:"npc",name,npcId:id,createdAt:now(),updatedAt:now()},narrative:{teamId:teamId||"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true}});
    if($("dcxNpcName"))$("dcxNpcName").value=""; await log("npc.create",`NPC ${name} criado`,{npcId:id,teamId}); toast("NPC CRIADO");
  }
  async function deleteNpc(id){
    const op=operators[id]; if(!op||operatorType(op,id)!=="npc")return; const name=operatorName(op,id);
    if(!confirm(`Excluir o NPC “${name}” definitivamente?`))return;
    await ref(`operators/${id}`).remove(); await log("npc.delete",`NPC ${name} excluído`,{npcId:id}); closeRosterEditor(); toast("NPC EXCLUÍDO");
  }
  function editRosterOperator(id){selectedOperator=id;renderRosterEditor()}
  function closeRosterEditor(){selectedOperator="";$("dcxRosterEditor")?.classList.add("hidden")}
  async function saveRosterOperator(){
    const id=selectedOperator,op=operators[id]; if(!op)return; const name=cleanName($("dcxRosterName")?.value); if(!name){toast("NOME INVÁLIDO");return}
    const type=operatorType(op,id), updates={};
    updates[`operators/${id}/identity/name`]=name; updates[`operators/${id}/identity/updatedAt`]=now();
    updates[`operators/${id}/narrative`]={teamId:$("dcxRosterTeam")?.value||"",role:cleanName($("dcxRosterRole")?.value),status:$("dcxRosterStatus")?.value||"OPERACIONAL",location:cleanName($("dcxRosterLocation")?.value),commsStatus:$("dcxRosterComms")?.value||"ONLINE",visible:true,updatedAt:now()};
    await db.ref(`rooms/${room}/dcx`).update(updates); await log(`${type}.update`,`${name} atualizado`,{operatorId:id}); toast("OPERADOR ATUALIZADO"); closeRosterEditor();
  }
  function selectOperator(id){selectedOperator=id;renderPlayers()}
  async function saveSelectedPlayer(){
    const id=selectedOperator,op=operators[id]; if(!op)return; const name=cleanName($("dcxOpName")?.value); if(!name){toast("NOME INVÁLIDO");return}
    const n={teamId:$("dcxOpTeam")?.value||"",role:cleanName($("dcxOpRole")?.value),status:$("dcxOpStatus")?.value||"OPERACIONAL",location:cleanName($("dcxOpLocation")?.value),commsStatus:$("dcxOpComms")?.value||"ONLINE",visible:true,updatedAt:now()};
    await db.ref(`rooms/${room}/dcx`).update({[`operators/${id}/identity/name`]:name,[`operators/${id}/identity/updatedAt`]:now(),[`operators/${id}/narrative`]:n});
    // mantém o nome do contato legado sincronizado quando possível
    for(const [uid,node] of Object.entries(requests||{})){if(node?.identity?.playerId===id)await db.ref(`rooms/${room}/requests/${uid}/identity/nickname`).set(name)}
    await log("player.update",`${name} atualizado`,{playerId:id}); toast("JOGADOR ATUALIZADO");
  }
  async function removeSelectedPlayer(){
    const id=selectedOperator,op=operators[id]; if(!op)return; const name=operatorName(op,id);
    if(!confirm(`Remover o registro de ${name} do DCX OS?\n\nO P-ID poderá reaparecer se o jogador reconectar. Isso NÃO é o bloqueio por Key, que virá na fase de acesso.`))return;
    const matching=Object.entries(requests||{}).filter(([,n])=>n?.identity?.playerId===id).map(([uid])=>uid);
    const updates={[`operators/${id}`]:null}; Object.entries(presence).forEach(([uid,p])=>{if(p?.playerId===id)updates[`presence/${uid}`]=null});
    await ref().update(updates); await Promise.allSettled(matching.map(uid=>db.ref(`rooms/${room}/requests/${uid}`).remove())); selectedOperator=""; await log("player.remove",`${name} removido`,{playerId:id}); toast("REGISTRO REMOVIDO");
  }

  async function init(force=false){
    if(!window.firebase?.apps?.length || !firebase.auth().currentUser)return;
    auth=firebase.auth(); if(auth.currentUser.uid!==ADMIN_UID){console.warn("DCX Admin: usuário não é Keymaster autorizado");return}
    const targetRoom=OPH.Realtime?.getRoom?.()||room;
    if(initialized && !force && targetRoom===room)return;
    if(initialized){refs.forEach(r=>{try{r.off()}catch(e){}});refs=[];initialized=false}
    db=firebase.database(); room=targetRoom; base=`rooms/${room}/dcx`; initialized=true;
    const bind=(p,cb)=>{const r=ref(p);r.on("value",s=>cb(s.val()||{}));refs.push(r)};
    bind("operators",v=>{operators=v||{};renderAll()}); bind("teams",v=>{teams=v||{};renderAll()}); bind("presence",v=>{presence=v||{};renderAll()});
    const rr=db.ref(`rooms/${room}/requests`);rr.on("value",s=>{requests=s.val()||{};renderTabs()});refs.push(rr);
    try{await ref("meta").update({initialized:true,schemaVersion:1,systemName:"DCX OS",roomId:room,lastKeymasterBuild:window.OPH_BUILD||BUILD,lastKeymasterSeen:now()});await db.ref(`rooms/${room}/state`).update({"visible/family":null,"n02/family":null});await syncExistingPlayers()}catch(e){console.error("DCX init",e);toast("DCX OS // REGRAS AINDA NÃO LIBERADAS")}
    renderAll(); setInterval(renderMaster,5000);
  }
  function renderAll(){renderTabs();renderMaster();renderPlayers();renderTeams();if(!$("dcxRosterEditor")?.classList.contains("hidden"))renderRosterEditor()}

  function copyPlayerLink(){const input=$("playerUrl");if(!input)return;navigator.clipboard?.writeText(input.value).then(()=>toast("LINK COPIADO")).catch(()=>{input.select();document.execCommand("copy");toast("LINK COPIADO")})}

  window.DCX.Admin={switchTab,init,createTeam,updateTeamField,deleteTeam,openAddMember,createNpc,deleteNpc,editRosterOperator,closeRosterEditor,saveRosterOperator,selectOperator,saveSelectedPlayer,removeSelectedPlayer,copyPlayerLink};

  // IMPORTANTE: a navegação do Keymaster não pode depender do Firebase já estar
  // inicializado. Na A1, firebase.auth() era chamado aqui no carregamento e
  // lançava "No Firebase App '[DEFAULT]' has been created", interrompendo o
  // script antes de registrar os cliques das abas. O login do KM inicializa o
  // Firebase e chama DCX.Admin.init(true) depois da conexão.
  function bindWorkspaceTabs(){
    document.querySelectorAll(".kmWorkspaceTab").forEach(b=>{
      if(b.dataset.dcxBound==="1")return;
      b.dataset.dcxBound="1";
      b.addEventListener("click",()=>switchTab(b.dataset.tab));
    });
    renderTabs();
  }
  if(document.readyState==="loading") window.addEventListener("DOMContentLoaded",bindWorkspaceTabs,{once:true});
  else bindWorkspaceTabs();
})();
