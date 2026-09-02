window.OPH = window.OPH || {};
(() => {
  let state=OPH.cloneDefault(),room=new URLSearchParams(location.search).get("room")||window.OPH_CONFIG.defaultRoom||"FRIA-01",requests={};
  const $=id=>document.getElementById(id);
  function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1600)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
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
        processing:Object.assign(d.comms.processing,s?.comms?.processing||{})
      })
    })
  }
  async function save(){await OPH.Realtime.setState(state);render()}
  function renderVisibility(){
    const defs=[["government","Contexto político"],["h01","H-01"],["approaches","Abordagens"],["preps","Preparações"],["n02","N-02"],["protocol","Protocolo"],["emergencySim","Simulador H-01"],["family","Reina's Family"],["comms","Yumiya // Remote"]];
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
    $("chatInboxCount").textContent=`${inbox.length} PENDENTE${inbox.length===1?"":"S"}`;
    $("chatInbox").innerHTML=inbox.length?inbox.map(({uid,id,msg})=>`
      <div class="chatInboxRow">
        <div class="chatInboxTop"><b>${esc(msg.nickname||"Jogador")}</b><small>${msg.ts?new Date(msg.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}${msg.playerId?` · ${esc(msg.playerId)}`:""}</small></div>
        <p>${esc(msg.text)}</p>
        <div class="actions"><button class="btn gold" onclick="KM.selectChat('${uid}','${id}')">RESPONDER</button><button class="btn" onclick="KM.dismissChat('${uid}','${id}')">ARQUIVAR</button></div>
      </div>`).join(""):`<div class="card"><p>Nenhuma mensagem aguardando resposta.</p></div>`;

    const senders=new Map();
    inbox.forEach(({uid,msg})=>senders.set(uid,{name:msg.nickname||uid.slice(0,8),playerId:msg.playerId||""}));
    const current=$("chatTarget").value||"all";
    $("chatTarget").innerHTML=`<option value="all">TODOS // GLOBAL</option>`+[...senders].map(([uid,who])=>`<option value="${esc(uid)}">${esc(who.name)}${who.playerId?` // ${esc(who.playerId)}`:""} // DIRETO</option>`).join("");
    if([...$("chatTarget").options].some(o=>o.value===current))$("chatTarget").value=current;

    const hist=(state.comms.messages||[]).slice(-20).reverse();
    $("chatHistory").innerHTML=hist.length?hist.map(m=>`<div class="chatHistoryRow ${esc(m.style||"normal")}"><div><b>${m.targetUid==="all"||!m.targetUid?"GLOBAL":"DIRETO"}</b><small>${m.ts?new Date(m.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):""}</small></div><p>${esc(m.text)}</p></div>`).join(""):`<div class="card"><p>Nenhuma transmissão enviada.</p></div>`;
  }
  function renderEvents(){
    $("emLevel").value=state.emergency.level||0;$("emLevelLabel").textContent=OPH.EMERGENCY_STATES[state.emergency.level||0].title;
  }
  function render(){renderVisibility();renderApproaches();renderPreps();renderClues();renderRequests();renderChat();renderEvents();$("roomLabel").textContent=room;$("playerUrl").value=location.origin+location.pathname.replace(/keymaster\.html$/,"")+`?room=${encodeURIComponent(room)}`}
  async function connect(){
    room=$("room").value.trim().toUpperCase()||"FRIA-01";history.replaceState(null,"",`?room=${encodeURIComponent(room)}`);
    const fb=window.OPH_CONFIG?.firebase?.enabled;
    const credentials=fb?{email:$("email").value,password:$("password").value}:{password:$("localPassword").value};
    try{const r=await OPH.Realtime.connect({roomId:room,asHost:true,credentials});$("login").classList.add("hidden");$("console").classList.remove("hidden");$("mode").textContent=r.mode.toUpperCase();toast("KEYMASTER CONECTADO")}
    catch(e){toast("FALHA DE AUTENTICAÇÃO/CONEXÃO");console.error(e)}
  }
  function event(type,title,body){state.event={id:crypto.randomUUID?.()||String(Date.now())+Math.random(),type,title,body,duration:5200};save()}
  async function selectChat(uid,id){
    $("chatTarget").value=uid;
    const item=chatRequests().find(x=>x.uid===uid&&x.id===id);
    if(item)$("chatReply").placeholder=`Responder a ${item.msg.nickname||"jogador"}...`;
    state.comms.processing={active:true,targetUid:uid,label:"PROCESSANDO SOLICITAÇÃO...",until:Date.now()+90000};
    await save();
    $("chatReply").focus();
  }
  async function sendComms(){
    const text=$("chatReply").value.trim();if(!text){toast("ESCREVA UMA MENSAGEM");return}
    const targetUid=$("chatTarget").value||"all";
    const style=$("chatStyle").value||"normal";
    const msg={id:crypto.randomUUID?.()||String(Date.now())+Math.random(),sender:"YUMIYA KIRYUIN",text,style,targetUid,ts:Date.now()};
    state.comms.messages=[...(state.comms.messages||[]),msg].slice(-50);
    state.comms.processing={active:false,targetUid:"all",label:"PROCESSANDO SOLICITAÇÃO...",until:0};
    $("chatReply").value="";
    await save();
    toast(targetUid==="all"?"TRANSMISSÃO GLOBAL ENVIADA":"RESPOSTA ENVIADA");
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
    dismissChat:async(uid,id)=>{await OPH.Realtime.clearChat(uid,id);toast("MENSAGEM ARQUIVADA")},
    sendComms,
    processing:async()=>{
      state.comms.processing={active:true,targetUid:$("chatTarget").value||"all",label:"PROCESSANDO SOLICITAÇÃO...",until:Date.now()+90000};
      await save()
    },
    stopProcessing:async()=>{state.comms.processing={active:false,targetUid:"all",label:"PROCESSANDO SOLICITAÇÃO...",until:0};await save()}
  };
  OPH.Realtime.onState(s=>{state=merge(s);render()});OPH.Realtime.onRequests(r=>{requests=r;renderRequests();renderChat()});
  window.addEventListener("DOMContentLoaded",()=>{$("room").value=room;$("firebaseLogin").classList.toggle("hidden",!window.OPH_CONFIG?.firebase?.enabled);$("localLogin").classList.toggle("hidden",!!window.OPH_CONFIG?.firebase?.enabled);$("chatReply").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.ctrlKey){e.preventDefault();sendComms()}});render()});
})();