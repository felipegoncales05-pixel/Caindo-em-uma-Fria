window.OPH = window.OPH || {};
console.info("[DCX OS] A2 RECOVERY // KEYMASTER // YUMIYA CORE FINAL-11");
(() => {
  let state=OPH.cloneDefault(),stateLoaded=false,timelineSyncing=false,suppressTimelineSync=false,renderDeferred=false,room=new URLSearchParams(location.search).get("room")||window.OPH_CONFIG.defaultRoom||"FRIA-01",requests={},selectedChat=null,selectedProfileUid="";
  const $=id=>document.getElementById(id);
  function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1600)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function focused(el){return !!el&&document.activeElement===el}
  function syncValue(el,v){if(el&&!focused(el))el.value=String(v)}
  function syncCheck(el,v){if(el&&!focused(el))el.checked=!!v}
  function syncSelect(el,items,preferred){if(!el||focused(el))return;const sig=items.map(x=>x.value+"::"+x.label).join("||");if(el.dataset.sig!==sig){el.innerHTML="";items.forEach(x=>{const o=document.createElement("option");o.value=x.value;o.textContent=x.label;el.appendChild(o)});el.dataset.sig=sig}if(items.some(x=>x.value===preferred))el.value=preferred}
  function archiveKey(){return "oph-km-yumiya-archive-"+room}
  function contactsKey(){return "oph-km-yumiya-contacts-"+room}
  function getArchive(){try{return JSON.parse(localStorage.getItem(archiveKey())||"[]").filter(Boolean)}catch(e){return[]}}
  function saveArchive(items){localStorage.setItem(archiveKey(),JSON.stringify(items.slice(-500)))}
  function getContacts(){try{return JSON.parse(localStorage.getItem(contactsKey())||"{}")||{}}catch(e){return{}}}
  function saveContacts(obj){localStorage.setItem(contactsKey(),JSON.stringify(obj))}
  function normalizeContactName(v){return String(v||"").trim().replace(/\s+/g," ").toLocaleLowerCase("pt-BR")}
  function renderContactTools(){
    const info=$("kmContactInfo"),del=$("deleteContactBtn"),dedupe=$("dedupeContactBtn");if(!info)return;
    const uid=$("chatTarget")?.value||"all",contacts=getContacts(),contact=contacts[uid];
    if(uid==="all"||!contact){info.textContent="SELECIONE UM OPERADOR DIRETO PARA GERENCIAR O CONTATO.";if(del)del.disabled=true;if(dedupe)dedupe.disabled=true;return}
    const same=Object.values(contacts).filter(c=>c.uid!==uid&&normalizeContactName(c.name)===normalizeContactName(contact.name));
    info.textContent=`ATIVO // ${contact.name} // ${contact.playerId||"SEM P-ID"}${same.length?` // ${same.length} DUPLICADO(S) DE NOME`:""}`;
    if(del)del.disabled=false;if(dedupe)dedupe.disabled=!same.length;
  }
  function dropContactLocally(uid,dropProfile=true){
    const contacts=getContacts(),contact=contacts[uid];if(!contact)return null;
    delete contacts[uid];saveContacts(contacts);
    if(dropProfile&&contact.playerId&&state.comms?.operatorProfiles)delete state.comms.operatorProfiles[contact.playerId];
    if(requests?.[uid]){const next=Object.assign({},requests);delete next[uid];requests=next}
    if(selectedChat?.uid===uid)selectedChat=null;
    if(selectedProfileUid===uid)selectedProfileUid="";
    return contact;
  }
  async function deleteSelectedContact(){
    const uid=$("chatTarget")?.value||"all",contact=getContacts()[uid];
    if(uid==="all"||!contact){toast("SELECIONE UM CONTATO DIRETO");return}
    if(!confirm(`Excluir ${contact.name} // ${contact.playerId||uid} da lista do Keymaster?\n\nIsso remove a presença/caixa desse UID e o perfil individual associado. Se o jogador ainda estiver ativo, ele poderá reaparecer quando publicar a identidade novamente.`))return;
    dropContactLocally(uid,true);
    await save();
    try{await OPH.Realtime.removeOperator(uid)}catch(e){console.error(e)}
    renderChat();renderOperatorProfiles();toast("CONTATO EXCLUÍDO");
  }
  async function removeNameDuplicates(){
    const keepUid=$("chatTarget")?.value||"all",contacts=getContacts(),keep=contacts[keepUid];
    if(keepUid==="all"||!keep){toast("SELECIONE O CONTATO QUE DEVE FICAR");return}
    const same=Object.values(contacts).filter(c=>c.uid!==keepUid&&normalizeContactName(c.name)===normalizeContactName(keep.name));
    if(!same.length){toast("NENHUM DUPLICADO DESSE NOME");return}
    if(!confirm(`Manter ${keep.name} // ${keep.playerId||keepUid} e excluir ${same.length} contato(s) antigo(s) com o mesmo nome?`))return;
    const uids=same.map(c=>c.uid);uids.forEach(uid=>dropContactLocally(uid,contacts[uid]?.playerId!==keep.playerId));
    await save();
    await Promise.allSettled(uids.map(uid=>OPH.Realtime.removeOperator(uid)));
    $("chatTarget").value=keepUid;renderChat();renderOperatorProfiles();toast(`${same.length} DUPLICADO(S) REMOVIDO(S)`);
  }
  function rememberContacts(inbox){
    const contacts=getContacts();let changed=false;
    const seen=[];
    inbox.forEach(({uid,msg})=>seen.push({uid,msg}));
    for(const [uid,node] of Object.entries(requests||{})){
      const identity=node?.identity;
      if(identity?.nickname)seen.push({uid,msg:{nickname:identity.nickname,playerId:identity.playerId||"",ts:identity.ts||Date.now()}});
    }
    seen.forEach(({uid,msg})=>{
      const pid=msg.playerId||"";
      if(pid){
        for(const [oldUid,old] of Object.entries(contacts)){
          if(oldUid!==uid&&old?.playerId===pid){delete contacts[oldUid];changed=true}
        }
      }
      const prev=contacts[uid]||{};
      const next={uid,name:msg.nickname||prev.name||uid.slice(0,8),playerId:pid||prev.playerId||"",lastSeen:Math.max(+prev.lastSeen||0,+msg.ts||Date.now())};
      if(JSON.stringify(prev)!==JSON.stringify(next)){contacts[uid]=next;changed=true}
    });
    if(changed)saveContacts(contacts);
    return contacts;
  }
  function addArchive(item){
    const items=getArchive();
    items.push(Object.assign({archiveId:crypto.randomUUID?.()||"arc-"+Date.now()+Math.random(),archivedAt:Date.now()},item));
    saveArchive(items);renderArchive();
  }
  function removeLocalRequestChat(uid,id){
    if(!requests?.[uid]?.chat)return;
    const next=Object.assign({},requests);next[uid]=Object.assign({},next[uid]);next[uid].chat=Object.assign({},next[uid].chat);delete next[uid].chat[id];
    if(!Object.keys(next[uid].chat).length)delete next[uid].chat;
    requests=next;
  }
  function merge(s){
    const d=OPH.cloneDefault();
    return Object.assign(d,s||{}, {
      visible:Object.assign(d.visible,s?.visible||{}),
      approaches:Object.assign(d.approaches,s?.approaches||{}),
      preps:{
        assault:Object.assign(d.preps.assault,s?.preps?.assault||{}),
        stealth:Object.assign(d.preps.stealth,s?.preps?.stealth||{}),
        con:Object.assign(d.preps.con,s?.preps?.con||{})
      },
      n02:Object.assign(d.n02,s?.n02||{}, {clues:Object.assign(d.n02.clues,s?.n02?.clues||{})}),
      emergency:Object.assign(d.emergency,s?.emergency||{}),
      comms:Object.assign(d.comms,s?.comms||{}, {
        messages:Array.isArray(s?.comms?.messages)?s.comms.messages:[],
        timeline:Array.isArray(s?.comms?.timeline)?s.comms.timeline:[],
        sequence:Number(s?.comms?.sequence)||0,
        clearVersion:Number(s?.comms?.clearVersion)||0,
        processing:Object.assign(d.comms.processing,s?.comms?.processing||{}),
        affect:Object.assign(d.comms.affect,s?.comms?.affect||{}),
        operatorProfiles:Object.assign({},d.comms.operatorProfiles||{},s?.comms?.operatorProfiles||{})
      })
    })
  }
  function timeline(){state.comms.timeline=Array.isArray(state.comms.timeline)?state.comms.timeline:[];return state.comms.timeline}
  function nextSeq(){state.comms.sequence=Math.max(Number(state.comms.sequence)||0,...timeline().map(e=>Number(e.seq)||0))+1;return state.comms.sequence}
  function playerCanonicalId(item){return String(item?.msg?.clientMessageId||(`request-${item?.uid||"unknown"}-${item?.id||"unknown"}`))}
  function appendIncomingCanonical(item){
    if(!item?.msg)return false;
    const cid=playerCanonicalId(item);
    if(timeline().some(e=>e.kind==="player"&&(e.clientMessageId===cid||e.id===`player:${cid}`)))return false;
    timeline().push({id:`player:${cid}`,kind:"player",seq:nextSeq(),uid:item.uid,requestId:item.id,playerId:item.msg.playerId||"",nickname:item.msg.nickname||"Jogador",text:item.msg.text||"",clientMessageId:cid,clientTs:Number(item.msg.clientTs)||0,serverTs:Number(item.msg.serverTs)||Number(item.msg.ts)||Date.now(),ts:Number(item.msg.serverTs)||Number(item.msg.ts)||Date.now()});
    state.comms.timeline=timeline().slice(-500);
    return true;
  }
  async function syncIncomingTimeline(){
    if(!stateLoaded||timelineSyncing||suppressTimelineSync)return;
    const items=chatRequests().slice().sort((a,b)=>(Number(a.msg.serverTs||a.msg.ts)||0)-(Number(b.msg.serverTs||b.msg.ts)||0));
    let changed=false;items.forEach(item=>{if(appendIncomingCanonical(item))changed=true});
    if(!changed)return;
    timelineSyncing=true;
    try{await OPH.Realtime.setState(state)}catch(e){console.error("Falha ao sincronizar timeline canônica",e)}finally{timelineSyncing=false}
  }
  function yumiyaControlBusy(){
    const a=document.activeElement;
    return !!(a && a.closest?.('[data-km-view="yumiya"]') && ["INPUT","SELECT","TEXTAREA"].includes(a.tagName));
  }
  function safeRender(){
    if(yumiyaControlBusy()){renderDeferred=true;return}
    renderDeferred=false;render();
  }
  function safeYumiyaRender(){
    if(yumiyaControlBusy()){renderDeferred=true;return}
    renderDeferred=false;renderRequests();renderChat();renderOperatorProfiles();
  }
  async function save(){await OPH.Realtime.setState(state);safeRender()}
  function renderVisibility(){
    const defs=[["government","Contexto político"],["h01","H-01"],["approaches","Abordagens"],["preps","Preparações"],["n02","N-02"],["protocol","Protocolo"],["emergencySim","Simulador H-01"],["comms","Yumiya // Remote"]];
    $("visibility").innerHTML=defs.map(d=>`<label class="toggle"><span>${d[1]}</span><input type="checkbox" ${state.visible[d[0]]?'checked':''} onchange="KM.toggleVisible('${d[0]}',this.checked)"></label>`).join("");
  }
  function renderApproaches(){
    $("approachCtl").innerHTML=Object.entries(OPH.APPROACHES).map(([k,a])=>`<div class="adminRow"><div class="topline"><b>${a.name}</b><label><input type="checkbox" ${state.approaches[k]?'checked':''} onchange="KM.toggleApproach('${k}',this.checked)"> mostrar</label></div><button class="btn ${state.approaches.selected===k?'gold':''}" onclick="KM.selectApproach('${k}')">Selecionar</button></div>`).join("");
  }
  function renderPreps(){
    const k=state.approaches.selected||"con";$("prepCtlTitle").textContent="Preparações — "+OPH.APPROACHES[k].name;$("prepCtl").innerHTML=OPH.PREP_DEFS[k].map(d=>`<label class="toggle"><span><b>${d[1]}</b><br><small style="color:#8095a8">${d[2]}</small></span><input type="checkbox" ${state.preps[k][d[0]]?'checked':''} onchange="KM.togglePrep('${k}','${d[0]}',this.checked)"></label>`).join("");
  }
  function renderClues(){
    $("clueCtl").innerHTML=OPH_GM.clues.map(c=>`<div class="adminRow"><div class="topline"><b>${c.title}</b><code>${c.key}</code></div><p>${c.gm}<br><b>Onde:</b> ${c.where}</p><button class="btn ${state.n02.clues[c.id]?'gold':''}" onclick="KM.toggleClue('${c.id}')">${state.n02.clues[c.id]?'BLOQUEAR':'LIBERAR PARA TODOS'}</button></div>`).join("");
  }

  function clueRequests(){
    const arr=[];
    for(const [uid,node] of Object.entries(requests||{})){
      if(node?.type==="clue") arr.push({uid,req:node,legacy:true});
      else if(node?.clue?.type==="clue") arr.push({uid,req:node.clue,legacy:false});
    }
    return arr;
  }
  function chatRequests(){
    const arr=[];
    for(const [uid,node] of Object.entries(requests||{})){
      const chat=node?.chat||{};
      for(const [id,msg] of Object.entries(chat)){
        if(msg?.type==="chat" || msg?.text) arr.push({uid,id,msg});
      }
    }
    return arr.sort((a,b)=>(+a.msg.ts||0)-(+b.msg.ts||0));
  }
  function renderRequests(){
    const vals=clueRequests();$("requests").innerHTML=vals.length?vals.map(({uid,req})=>`<div class="request"><b>${esc(req.nickname||"Jogador")} enviou uma chave</b><p>Fragmento solicitado: ${esc(req.clueId)}</p><button class="btn gold" onclick="KM.acceptRequest('${uid}','${esc(req.clueId)}')">CONFIRMAR PARA TODOS</button> <button class="btn" onclick="KM.dismissRequest('${uid}')">Ignorar</button></div>`).join(""):`<div class="card"><p>Nenhuma chave aguardando confirmação.</p></div>`;
  }
  function renderChat(){
    const inbox=chatRequests();
    const contacts=rememberContacts(inbox);
    $("chatInboxCount").textContent=`${inbox.length} PENDENTE${inbox.length===1?"":"S"}`;
    $("chatInbox").innerHTML=inbox.length?inbox.map(({uid,id,msg})=>`
      <div class="chatInboxRow ${selectedChat?.uid===uid&&selectedChat?.id===id?'selected':''}">
        <div class="chatInboxTop"><b>${esc(msg.nickname||"Jogador")}</b><small>${msg.ts?new Date(msg.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}${msg.playerId?` · ${esc(msg.playerId)}`:""}</small></div>
        <p>${esc(msg.text)}</p>
        <div class="actions"><button class="btn gold" onclick="KM.selectChat('${uid}','${id}')">RESPONDER</button><button class="btn" onclick="KM.archiveIncoming('${uid}','${id}')">ARQUIVAR</button><button class="btn" onclick="KM.dismissChat('${uid}','${id}')">DESCARTAR</button></div>
      </div>`).join(""):`<div class="card"><p>Nenhuma mensagem aguardando resposta.</p></div>`;

    const target=$("chatTarget"),current=target?.value||"all";
    const sortedContacts=Object.values(contacts).sort((a,b)=>(+b.lastSeen||0)-(+a.lastSeen||0));
    const targetItems=[{value:"all",label:"TODOS // GLOBAL"},...sortedContacts.map(who=>({value:who.uid,label:`${who.name}${who.playerId?` // ${who.playerId}`:""} // DIRETO`}))];
    const preferred=targetItems.some(x=>x.value===current)?current:(selectedChat?.uid&&targetItems.some(x=>x.value===selectedChat.uid)?selectedChat.uid:"all");
    syncSelect(target,targetItems,preferred);
    renderContactTools();

    const canonicalOutgoing=(state.comms.timeline||[]).filter(m=>m?.kind==="yumiya");
    const hist=(canonicalOutgoing.length?canonicalOutgoing:(state.comms.messages||[])).slice(-50).reverse();
    $("chatHistory").innerHTML=hist.length?hist.map(m=>{
      const contact=contacts[m.targetUid]||{};
      const target=m.targetUid==="all"||!m.targetUid?"GLOBAL":`DIRETO // ${m.targetName||contact.name||m.targetPlayerId||"OPERADOR"}`;
      return `<div class="chatHistoryRow ${esc(m.style||"normal")}"><div><b>${esc(target)}</b><small>${m.ts?new Date(m.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</small></div><p>${esc(m.text)}</p><div class="chatHistoryActions"><button class="btn" onclick="KM.archiveOutgoing('${esc(m.id)}')">ARQUIVAR</button></div></div>`
    }).join(""):`<div class="card"><p>Nenhuma transmissão enviada.</p></div>`;
    renderArchive();
  }
  function renderArchive(){
    if(!$("chatArchive"))return;
    const items=getArchive().sort((a,b)=>(+b.archivedAt||0)-(+a.archivedAt||0));
    if($("chatArchiveCount"))$("chatArchiveCount").textContent=`${items.length} ITEM${items.length===1?"":"S"}`;
    $("chatArchive").innerHTML=items.length?items.map(a=>{
      const dir=a.direction==="incoming"?"JOGADOR → YUMIYA":"YUMIYA → "+(a.targetName||a.nickname||a.targetPlayerId||"GLOBAL");
      const who=a.direction==="incoming"?(a.nickname||a.playerId||"Jogador"):(a.targetUid==="all"?"GLOBAL":(a.targetName||a.targetPlayerId||"OPERADOR"));
      return `<div class="kmArchiveRow"><div class="kmArchiveMeta"><b>${esc(dir)}</b><small>${a.ts?new Date(a.ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):""} · ${esc(who)}</small></div><p>${esc(a.text)}</p><button class="btn" onclick="KM.deleteArchive('${esc(a.archiveId)}')">REMOVER DO ARQUIVO</button></div>`
    }).join(""):`<div class="card"><p>Nada arquivado. O arquivo é local deste navegador do Keymaster e não é enviado aos jogadores.</p></div>`;
  }
  function clampMood(v){return Math.max(0,Math.min(100,Math.round(Number(v)||0)))}
  function renderAffect(){
    const a=state.comms.affect||{anger:12,tension:18,euphoria:10,portrait:"normal"};
    const anger=clampMood(a.anger),tension=clampMood(a.tension),euphoria=clampMood(a.euphoria),portrait=["normal","fear","embarrassed","anger","happy"].includes(a.portrait)?a.portrait:"normal";
    syncValue($("yumiyaAngerCtl"),anger);
    syncValue($("yumiyaTensionCtl"),tension);
    syncValue($("yumiyaEuphoriaCtl"),euphoria);
    if($("yumiyaAngerValue"))$("yumiyaAngerValue").textContent=anger+"%";
    if($("yumiyaTensionValue"))$("yumiyaTensionValue").textContent=tension+"%";
    if($("yumiyaEuphoriaValue"))$("yumiyaEuphoriaValue").textContent=euphoria+"%";
    document.querySelectorAll("#yumiyaPortraitCtl [data-portrait]").forEach(b=>b.classList.toggle("gold",b.dataset.portrait===portrait));
  }
  function previewMood(kind,value){
    const v=clampMood(value),ids={anger:"yumiyaAngerValue",tension:"yumiyaTensionValue",euphoria:"yumiyaEuphoriaValue"},out=$(ids[kind]);
    if(out)out.textContent=v+"%";
  }
  async function setMood(kind,value){
    if(!["anger","tension","euphoria"].includes(kind))return;
    state.comms.affect=Object.assign({anger:12,tension:18,euphoria:10,portrait:"normal"},state.comms.affect||{});
    state.comms.affect[kind]=clampMood(value);
    await save();
  }
  async function setPortrait(portrait){
    if(!["normal","fear","embarrassed","anger","happy"].includes(portrait))return;
    state.comms.affect=Object.assign({anger:12,tension:18,euphoria:10,portrait:"normal"},state.comms.affect||{});
    state.comms.affect.portrait=portrait;
    await save();
    toast("PORTRAIT // "+portrait.toUpperCase());
  }
  function selectedProfileContact(){
    const contacts=getContacts();
    if(selectedProfileUid&&contacts[selectedProfileUid])return contacts[selectedProfileUid];
    return null;
  }
  function profileKey(contact){return contact?.playerId||""}
  function defaultOperatorProfile(contact){
    const base=state.comms.affect||{anger:12,tension:18,euphoria:10,portrait:"normal"};
    const isKang=/^kang(?:\s|$)/i.test(contact?.name||"");
    return {enabled:true,preset:isKang?"kang":"standard",tone:isKang?"provocative":"professional",anger:clampMood(base.anger),tension:clampMood(base.tension),euphoria:clampMood(base.euphoria),portrait:base.portrait||"normal",updatedAt:Date.now()};
  }
  function getOperatorProfile(contact,create=false){
    const key=profileKey(contact);if(!key)return null;
    state.comms.operatorProfiles=state.comms.operatorProfiles||{};
    if(!state.comms.operatorProfiles[key]&&create)state.comms.operatorProfiles[key]=defaultOperatorProfile(contact);
    return state.comms.operatorProfiles[key]||null;
  }
  function renderOperatorProfiles(){
    const select=$("operatorProfileSelect");if(!select)return;
    const contacts=getContacts();
    const current=selectedProfileUid||select.value||"";
    const sorted=Object.values(contacts).filter(c=>c.playerId).sort((a,b)=>(+b.lastSeen||0)-(+a.lastSeen||0));
    const operatorItems=[{value:"",label:"SELECIONE UM OPERADOR"},...sorted.map(c=>({value:c.uid,label:`${c.name} // ${c.playerId}`}))];
    const operatorPreferred=operatorItems.some(x=>x.value===current)?current:"";syncSelect(select,operatorItems,operatorPreferred);
    if(operatorPreferred)selectedProfileUid=operatorPreferred;else if(current&&!focused(select))selectedProfileUid=""
    const contact=selectedProfileContact();
    const body=$("operatorProfileBody"),enabled=$("operatorProfileEnabled"),status=$("operatorProfileStatus");
    if(!contact){
      body?.classList.add("disabled");if(enabled){syncCheck(enabled,false);enabled.disabled=true}if(status){status.textContent="SEM OPERADOR";status.classList.remove("active")};return;
    }
    if(enabled)enabled.disabled=false;
    const p=getOperatorProfile(contact,false);
    const active=!!p?.enabled;
    syncCheck(enabled,active);
    body?.classList.toggle("disabled",!active);
    if(status){status.textContent=active?`EXCLUSIVO // ${contact.name}`:`GLOBAL // ${contact.name}`;status.classList.toggle("active",active)}
    const base=state.comms.affect||{anger:12,tension:18,euphoria:10,portrait:"normal"};
    const view=Object.assign({preset:"standard",tone:"professional",anger:base.anger,tension:base.tension,euphoria:base.euphoria,portrait:base.portrait||"normal"},p||{});
    syncValue($("operatorPreset"),["standard","kang"].includes(view.preset)?view.preset:"standard");
    syncValue($("operatorTone"),["professional","warm","provocative","cold","hostile"].includes(view.tone)?view.tone:"professional");
    const anger=clampMood(view.anger),tension=clampMood(view.tension),euphoria=clampMood(view.euphoria);
    syncValue($("operatorAngerCtl"),anger);syncValue($("operatorTensionCtl"),tension);syncValue($("operatorEuphoriaCtl"),euphoria);
    if($("operatorAngerValue"))$("operatorAngerValue").textContent=anger+"%";if($("operatorTensionValue"))$("operatorTensionValue").textContent=tension+"%";if($("operatorEuphoriaValue"))$("operatorEuphoriaValue").textContent=euphoria+"%";
    document.querySelectorAll("#operatorPortraitCtl [data-portrait]").forEach(b=>b.classList.toggle("gold",b.dataset.portrait===(view.portrait||"normal")));
    if($("operatorAssetHint"))$("operatorAssetHint").textContent=view.preset==="kang"?"Kang procura yumiya-kang-normal/medo/envergonhada/raiva/feliz.png e cai nos portraits padrão se não encontrar.":"Preset padrão usa os cinco portraits atuais da Yumiya.";
  }
  function selectOperatorProfile(uid){selectedProfileUid=uid||"";renderOperatorProfiles()}
  async function toggleOperatorProfile(on){
    const contact=selectedProfileContact();if(!contact){toast("SELECIONE UM OPERADOR");return}
    const key=profileKey(contact);if(!key){toast("OPERADOR SEM P-ID");return}
    const p=getOperatorProfile(contact,true);p.enabled=!!on;p.updatedAt=Date.now();await save();toast(on?"PERFIL INDIVIDUAL ATIVADO":"OPERADOR VOLTOU AO GLOBAL");
  }
  function previewOperatorMood(kind,value){const v=clampMood(value),ids={anger:"operatorAngerValue",tension:"operatorTensionValue",euphoria:"operatorEuphoriaValue"},out=$(ids[kind]);if(out)out.textContent=v+"%"}
  async function setOperatorMood(kind,value){
    if(!["anger","tension","euphoria"].includes(kind))return;const contact=selectedProfileContact();if(!contact)return;const p=getOperatorProfile(contact,true);p.enabled=true;p[kind]=clampMood(value);p.updatedAt=Date.now();await save();
  }
  async function setOperatorPortrait(portrait){
    if(!["normal","fear","embarrassed","anger","happy"].includes(portrait))return;const contact=selectedProfileContact();if(!contact)return;const p=getOperatorProfile(contact,true);p.enabled=true;p.portrait=portrait;p.updatedAt=Date.now();await save();toast(`PORTRAIT INDIVIDUAL // ${contact.name.toUpperCase()}`);
  }
  async function setOperatorPreset(preset){
    if(!["standard","kang"].includes(preset))return;const contact=selectedProfileContact();if(!contact)return;const p=getOperatorProfile(contact,true);p.enabled=true;p.preset=preset;p.updatedAt=Date.now();if(preset==="kang"&&p.tone==="professional")p.tone="provocative";await save();toast(`PRESET // ${preset.toUpperCase()}`);
  }
  async function setOperatorTone(tone){
    if(!["professional","warm","provocative","cold","hostile"].includes(tone))return;const contact=selectedProfileContact();if(!contact)return;const p=getOperatorProfile(contact,true);p.enabled=true;p.tone=tone;p.updatedAt=Date.now();await save();toast(`TOM // ${tone.toUpperCase()}`);
  }
  async function resetOperatorProfile(){
    const contact=selectedProfileContact();if(!contact)return;const key=profileKey(contact);if(!key)return;state.comms.operatorProfiles=state.comms.operatorProfiles||{};delete state.comms.operatorProfiles[key];await save();toast(`${contact.name.toUpperCase()} // PERFIL GLOBAL`);
  }
  function renderEvents(){
    $("emLevel").value=state.emergency.level||0;$("emLevelLabel").textContent=OPH.EMERGENCY_STATES[state.emergency.level||0].title;
  }
  function render(){renderVisibility();renderApproaches();renderPreps();renderClues();renderRequests();renderChat();renderAffect();renderOperatorProfiles();renderEvents();$("roomLabel").textContent=room;$("playerUrl").value=location.origin+location.pathname.replace(/keymaster\.html$/,"")+`?room=${encodeURIComponent(room)}`}
  async function connect(){
    room=$("room").value.trim().toUpperCase()||"FRIA-01";history.replaceState(null,"",`?room=${encodeURIComponent(room)}`);
    const fb=window.OPH_CONFIG?.firebase?.enabled;
    const credentials=fb?{email:$("email").value,password:$("password").value}:{password:$("localPassword").value};
    try{const r=await OPH.Realtime.connect({roomId:room,asHost:true,credentials});$("login").classList.add("hidden");$("console").classList.remove("hidden");$("mode").textContent=r.mode.toUpperCase();await window.DCX?.Admin?.init?.(true);toast("KEYMASTER CONECTADO")}
    catch(e){toast("FALHA DE AUTENTICAÇÃO/CONEXÃO");console.error(e)}
  }
  function event(type,title,body){state.event={id:crypto.randomUUID?.()||String(Date.now())+Math.random(),type,title,body,duration:5200,ts:Date.now()};save()}
  async function selectChat(uid,id){
    const item=chatRequests().find(x=>x.uid===uid&&x.id===id);
    selectedChat=item?{uid,id}:null;
    if(item){
      const contacts=rememberContacts([item]);
      renderChat();
      $("chatTarget").value=uid;
      selectedProfileUid=uid;renderOperatorProfiles();
      $("chatReply").placeholder=`Responder a ${item.msg.nickname||"jogador"}...`;
    }
    state.comms.processing={active:true,targetUid:uid,targetPlayerId:item?.msg?.playerId||getContacts()?.[uid]?.playerId||"",label:"PROCESSANDO SOLICITAÇÃO...",until:Date.now()+90000};
    await save();
    $("chatReply").focus();
  }
  async function archiveIncoming(uid,id){
    const item=chatRequests().find(x=>x.uid===uid&&x.id===id);if(!item)return;
    addArchive({direction:"incoming",uid,nickname:item.msg.nickname||"Jogador",playerId:item.msg.playerId||"",text:item.msg.text,ts:item.msg.ts||Date.now()});
    await OPH.Realtime.clearChat(uid,id);removeLocalRequestChat(uid,id);
    if(selectedChat?.uid===uid&&selectedChat?.id===id)selectedChat=null;
    renderChat();toast("MENSAGEM ARQUIVADA // PRIVADO");
  }
  async function dismissChat(uid,id){
    await OPH.Realtime.clearChat(uid,id);removeLocalRequestChat(uid,id);
    if(selectedChat?.uid===uid&&selectedChat?.id===id)selectedChat=null;
    renderChat();toast("MENSAGEM DESCARTADA");
  }
  function archiveOutgoing(id){
    const m=(state.comms.timeline||[]).find(x=>x?.kind==="yumiya"&&String(x.id)===String(id))||(state.comms.messages||[]).find(x=>String(x.id)===String(id));if(!m)return;
    addArchive({direction:"outgoing",targetUid:m.targetUid||"all",targetPlayerId:m.targetPlayerId||"",targetName:m.targetName||"",text:m.text,style:m.style||"normal",ts:m.ts||Date.now()});
    toast("TRANSMISSÃO ARQUIVADA // PRIVADO");
  }
  function deleteArchive(id){
    saveArchive(getArchive().filter(x=>String(x.archiveId)!==String(id)));renderArchive();toast("ITEM REMOVIDO DO ARQUIVO");
  }
  function exportArchive(){
    const data={room,exportedAt:new Date().toISOString(),items:getArchive()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`yumiya-archive-${room}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast("ARQUIVO EXPORTADO");
  }
  function clearArchive(){
    if(!confirm("Apagar também o ARQUIVO PRIVADO deste navegador? Essa ação não pode ser desfeita."))return;
    saveArchive([]);renderArchive();toast("ARQUIVO PRIVADO LIMPO");
  }
  async function clearAllChat(){
    if(!confirm("LIMPAR A PORRA TODA?\n\nIsso apaga o chat ativo da Yumiya, as entradas pendentes dos jogadores e faz os clientes esconderem/apagarem o histórico local anterior. O ARQUIVO PRIVADO será preservado."))return;
    const clearedAt=Date.now();
    suppressTimelineSync=true;
    state.comms.messages=[];state.comms.timeline=[];state.comms.sequence=0;state.comms.clearVersion=(Number(state.comms.clearVersion)||0)+1;state.comms.clearedAt=clearedAt;state.comms.processing={active:false,targetUid:"all",targetPlayerId:"",label:"PROCESSANDO SOLICITAÇÃO...",until:0};
    selectedChat=null;
    const pendingBeforeClear=chatRequests();
    await save();
    try{
      if(OPH.Realtime.getMode()==="ws")await Promise.all(pendingBeforeClear.map(x=>OPH.Realtime.clearChat(x.uid,x.id)));
      else await OPH.Realtime.clearAllChats();
    }catch(e){console.error(e)}
    const next={};for(const [uid,node] of Object.entries(requests||{})){const copy=Object.assign({},node);delete copy.chat;if(Object.keys(copy).length)next[uid]=copy}requests=next;
    suppressTimelineSync=false;
    renderChat();toast("CHAT ATIVO LIMPO");
  }
  async function sendComms(){
    const text=$("chatReply").value.trim();if(!text){toast("ESCREVA UMA MENSAGEM");return}
    const targetUid=$("chatTarget").value||"all";
    const style=$("chatStyle").value||"normal";
    const contact=getContacts()[targetUid]||{};
    const replyItem=selectedChat&&selectedChat.uid===targetUid?chatRequests().find(x=>x.uid===selectedChat.uid&&x.id===selectedChat.id):null;
    // Se for uma resposta, a pergunta entra primeiro na timeline canônica, no mesmo write do host.
    if(replyItem)appendIncomingCanonical(replyItem);
    const msg={
      id:crypto.randomUUID?.()||String(Date.now())+Math.random(),kind:"yumiya",seq:nextSeq(),sender:"YUMIYA KIRYUIN",text,style,targetUid,
      targetPlayerId:targetUid==="all"?"":(contact.playerId||replyItem?.msg?.playerId||""),
      targetName:targetUid==="all"?"GLOBAL":(contact.name||replyItem?.msg?.nickname||"OPERADOR"),
      replyToClientMessageId:replyItem?.msg?.clientMessageId||"",
      replyToRequestId:replyItem?.id||"",
      replyToPlayerTs:Number(replyItem?.msg?.clientTs||replyItem?.msg?.ts)||0,
      ts:Date.now()
    };
    timeline().push(msg);state.comms.timeline=timeline().slice(-500);
    // Compatibilidade temporária com clients antigos; FINAL-11 usa timeline.
    state.comms.messages=[...(state.comms.messages||[]),msg].slice(-120);
    state.comms.processing={active:false,targetUid:"all",targetPlayerId:"",label:"PROCESSANDO SOLICITAÇÃO...",until:0};
    $("chatReply").value="";
    await save();
    if(replyItem){
      try{await OPH.Realtime.clearChat(replyItem.uid,replyItem.id)}catch(e){console.error(e)}
      removeLocalRequestChat(replyItem.uid,replyItem.id);selectedChat=null;renderChat();
    }
    toast(targetUid==="all"?"TRANSMISSÃO GLOBAL ENVIADA":"RESPOSTA DIRETA ENVIADA");
  }

  window.KM={
    connect,
    toggleVisible:(k,v)=>{state.visible[k]=v;save()},
    toggleApproach:(k,v)=>{state.approaches[k]=v;save()},
    selectApproach:k=>{state.approaches.selected=k;save()},
    togglePrep:(k,id,v)=>{state.preps[k][id]=v;save()},
    toggleClue:id=>{state.n02.clues[id]=!state.n02.clues[id];save()},
    imageMode:m=>{state.n02.imageMode=m;save()},
    focus:i=>{state.focusStage=i;save()},
    emergency:l=>{state.emergency.level=+l;save()},
    fireH01:()=>event("h01","H-01 // ATIVIDADE NEURAL","A cápsula registrou atividade cerebral acima da linha base."),
    fireN02:()=>event("n02","N-02 // MOVIMENTO DETECTADO","Movimento não identificado em área técnica. Verifiquem teto, dutos e vibrações."),
    custom:()=>{const t=$("customTitle").value||"ALERTA DCX",b=$("customBody").value||"";event("custom",t,b)},
    acceptRequest:async(id,clueId)=>{state.n02.clues[clueId]=true;await save();await OPH.Realtime.clearRequest(id)},
    dismissRequest:id=>OPH.Realtime.clearRequest(id),
    copyLink:()=>navigator.clipboard?.writeText($("playerUrl").value),
    selectChat,
    archiveIncoming,
    dismissChat,
    archiveOutgoing,
    deleteArchive,
    exportArchive,
    clearArchive,
    clearAllChat,
    deleteSelectedContact,
    removeNameDuplicates,
    sendComms,
    previewMood,
    setMood,
    setPortrait,
    selectOperatorProfile,
    toggleOperatorProfile,
    previewOperatorMood,
    setOperatorMood,
    setOperatorPortrait,
    setOperatorPreset,
    setOperatorTone,
    resetOperatorProfile,
    processing:async()=>{
      const targetUid=$("chatTarget").value||"all",contact=getContacts()[targetUid]||{}; state.comms.processing={active:true,targetUid,targetPlayerId:targetUid==="all"?"":(contact.playerId||""),label:"PROCESSANDO SOLICITAÇÃO...",until:Date.now()+90000};
      await save()
    },
    stopProcessing:async()=>{state.comms.processing={active:false,targetUid:"all",targetPlayerId:"",label:"PROCESSANDO SOLICITAÇÃO...",until:0};await save()}
  };
  OPH.Realtime.onState(s=>{state=merge(s);stateLoaded=true;safeRender();syncIncomingTimeline()});OPH.Realtime.onRequests(r=>{
    if(OPH.Realtime.getMode()==="firebase")requests=r||{};
    else{
      const merged=Object.assign({},requests);
      for(const [uid,node] of Object.entries(r||{}))merged[uid]=Object.assign({},merged[uid]||{},node||{});
      requests=merged;
    }
    safeYumiyaRender();syncIncomingTimeline()
  });
  window.addEventListener("DOMContentLoaded",()=>{document.addEventListener("focusout",()=>{if(renderDeferred)setTimeout(()=>{if(!yumiyaControlBusy())safeRender()},40)});$("room").value=room;$("firebaseLogin").classList.toggle("hidden",!window.OPH_CONFIG?.firebase?.enabled);$("localLogin").classList.toggle("hidden",!!window.OPH_CONFIG?.firebase?.enabled);$("chatReply").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.ctrlKey){e.preventDefault();sendComms()}});$("chatTarget")?.addEventListener("change",e=>{if(e.target.value!=="all"){selectedProfileUid=e.target.value;renderOperatorProfiles()}renderContactTools()});render()});
})();