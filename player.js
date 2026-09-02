window.OPH = window.OPH || {};
(() => {
  let state = OPH.cloneDefault();
  let room = new URLSearchParams(location.search).get("room") || localStorage.getItem("oph-room") || window.OPH_CONFIG.defaultRoom || "FRIA-01";
  let connected=false, currentStage=0, lastEventId=null, playerUid=null, chatOpen=false, unread=0, lastSeenCommsTs=0;
  const stageDefs=[
    ["home","ABERTURA"],["government","GOVERNO"],["h01","H-01"],["approaches","PLANO"],["preps","D-1"],["n02","N-02"],["protocol","PROTO"]
  ];
  const stageVisibleKey={government:"government",h01:"h01",approaches:"approaches",preps:"preps",n02:"n02",protocol:"protocol"};

  const $=id=>document.getElementById(id);
  function beep(freq=650,d=.04){try{const ac=new (AudioContext||webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.type="square";o.frequency.value=freq;g.gain.value=.02;o.connect(g);g.connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.stop(ac.currentTime+d)}catch(e){}}
  function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1700)}
  function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

  function identityKey(){return "oph-yumiya-identity-"+room}
  function makePlayerId(){
    const saved=localStorage.getItem("oph-yumiya-player-id");
    if(saved)return saved;
    const id="P-"+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,"").slice(0,10).toUpperCase();
    localStorage.setItem("oph-yumiya-player-id",id);
    return id;
  }
  function getYumiyaIdentity(){
    try{
      const data=JSON.parse(localStorage.getItem(identityKey())||"null");
      if(data?.name)return {name:String(data.name).trim().slice(0,40),playerId:data.playerId||makePlayerId()};
    }catch(e){}
    return null;
  }
  function saveYumiyaIdentity(name){
    name=String(name||"").trim().replace(/\s+/g," ").slice(0,40);
    if(!name)return null;
    const identity={name,playerId:makePlayerId(),room,updatedAt:Date.now()};
    localStorage.setItem(identityKey(),JSON.stringify(identity));
    localStorage.setItem("oph-name",name);
    if($("name"))$("name").value=name;
    return identity;
  }
  function ensureYumiyaIdentityFromMainName(){
    let identity=getYumiyaIdentity();
    if(identity)return identity;
    const mainName=($("name")?.value||localStorage.getItem("oph-name")||"").trim();
    return mainName?saveYumiyaIdentity(mainName):null;
  }
  function renderIdentityGate(){
    const identity=getYumiyaIdentity();
    const gate=$("yumiyaIdentityGate"), messages=$("yumiyaMessages"), composer=$("yumiyaComposer"), foot=$("yumiyaFoot"), processing=$("yumiyaProcessing");
    if(!gate)return !!identity;
    const missing=!identity;
    gate.classList.toggle("hidden",!missing);
    messages?.classList.toggle("hidden",missing);
    composer?.classList.toggle("hidden",missing);
    foot?.classList.toggle("hidden",missing);
    if(missing)processing?.classList.add("hidden");
    if(identity && $("yumiyaOperator"))$("yumiyaOperator").textContent=`OPERADOR // ${identity.name}`;
    return !missing;
  }
  function confirmYumiyaIdentity(){
    const box=$("yumiyaIdentityInput");
    const name=(box?.value||"").trim();
    if(name.length<2){toast("INFORME UM NOME VÁLIDO");box?.focus();return}
    saveYumiyaIdentity(name);
    if(box)box.value="";
    renderYumiya();
    toast("OPERADOR IDENTIFICADO");
    requestAnimationFrame(()=>$("yumiyaInput")?.focus());
  }
  function changeYumiyaIdentity(){
    const current=getYumiyaIdentity();
    localStorage.removeItem(identityKey());
    renderIdentityGate();
    if($("yumiyaIdentityInput")){$("yumiyaIdentityInput").value=current?.name||"";$("yumiyaIdentityInput").focus()}
  }
  function mergeDefaults(s){
    const d=OPH.cloneDefault();
    return Object.assign(d,s||{},{
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
    });
  }
  function visibleStage(i){
    if(i===0)return true;
    const key=stageVisibleKey[stageDefs[i][0]];
    return !!state.visible[key];
  }
  function renderNav(){
    $("nav").innerHTML=stageDefs.map((s,i)=>`<button class="${i===currentStage?'active':''} ${visibleStage(i)?'':'hiddenStage'}" onclick="OPHPlayer.go(${i})"><div class="n">0${i+1}</div><div class="l">${s[1]}</div></button>`).join("");
  }
  function go(i){
    if(!visibleStage(i))return;
    currentStage=i;
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",+v.dataset.stage===i));
    renderNav(); beep();
  }
  function renderApproaches(){
    $("approachGrid").innerHTML=Object.entries(OPH.APPROACHES).filter(([k])=>state.approaches[k]).map(([k,a])=>`
      <div class="approach ${state.approaches.selected===k?'selected':''}" style="--a:${a.color}">
        <div class="tag" style="color:${a.color}">${a.proposal}</div><h3>${a.name}</h3><p>${a.desc}</p>
        ${["RISCO OPERACIONAL","EXPOSIÇÃO POLÍTICA","CUSTO DA FALHA"].map((r,i)=>`<div style="font-size:9px;color:#8fa5bb;margin-top:8px">${r} <span style="float:right">${a.risk[i]}%</span></div><div class="risk"><i style="width:${a.risk[i]}%"></i></div>`).join("")}
      </div>`).join("");
  }
  function renderPreps(){
    const k=state.approaches.selected||"con", defs=OPH.PREP_DEFS[k], vals=state.preps[k]||{};
    $("prepTitle").textContent=OPH.APPROACHES[k].name;
    $("prepGrid").innerHTML=defs.map(d=>`<div class="prep ${vals[d[0]]?'done':''}"><b>${d[1]}</b><p>${d[2]}</p><div class="state">${vals[d[0]]?'CONCLUÍDO':'PENDENTE'}</div></div>`).join("");
    const n=defs.filter(d=>vals[d[0]]).length;$("prepPct").textContent=Math.round(n/defs.length*100)+"%";
  }
  function clueCount(){return OPH.N02_PUBLIC.filter(c=>state.n02.clues[c.id]).length}
  function renderN02(){
    const count=clueCount(), specimen=$("specimen"); $("clueCount").textContent=`${count}/5`;$("clueBar").style.width=`${count*20}%`;
    let mode=state.n02.imageMode==="auto"?(count===5?"full":count>0?"partial":"hidden"):state.n02.imageMode;
    specimen.className="specimen "+(mode==="full"?"full":mode==="partial"?"partial":"");
    $("fragments").innerHTML=OPH.N02_PUBLIC.map(c=>`<div class="fragment ${state.n02.clues[c.id]?'':'locked'}"><div class="tag">${c.code}</div><h4>${state.n02.clues[c.id]?c.title:"FRAGMENTO CRIPTOGRAFADO"}</h4><p>${state.n02.clues[c.id]?c.body:c.locked}</p></div>`).join("");
    $("abilities").innerHTML=OPH.N02_ABILITIES.map(a=>{const on=state.n02.clues[a[0]];return `<div class="ability ${on?'':'off'}"><span class="s">${on?'CONFIRMADA':'NÃO CONFIRMADA'}</span><h4>${on?a[1]+" "+a[2]:"? CAPACIDADE DESCONHECIDA"}</h4><p>${on?a[3]:"Ainda não existem evidências suficientes."}</p></div>`}).join("");
    $("profile").innerHTML=count<5?`<div class="card"><div class="tag">PERFIL PARCIAL</div><h3>${count}/5 fragmentos</h3><p>Use as abas de Intel e Capacidades para ver somente o que já pode ser tratado como fato.</p></div>`:
    `<div class="card"><div class="tag">PERFIL CONSOLIDADO</div><h3>AGREGADO GENÉTICO DE CONTRAMEDIDA</h3><p>N-02 é uma criação deliberada da RAIN composta por múltiplos materiais biológicos. Aprende rotinas, caça em baixa circulação, usa teto/parede/dutos e pode fabricar vibrações capazes de enganar o sentido aracnídeo da Reina. Capturado vivo, vira a prova física mais forte contra a RAIN.</p><div class="sep"></div><p><b>Contramedidas prováveis:</b> luz forte, frio, saturação vibracional/sonora e contenção coordenada.</p></div>`;
    $("family").classList.toggle("hidden",!(state.visible.family||state.n02.family));
  }
  function renderEmergency(){
    const e=OPH.EMERGENCY_STATES[state.emergency.level||0];$("emStatus").textContent=e.status;$("emTitle").textContent=e.title;$("emText").textContent=e.text;$("emMeter").style.width=e.meter+"%";
    $("emSim").classList.toggle("hidden",!state.visible.emergencySim);
  }
  function renderEvent(){
    const ev=state.event;if(!ev||!ev.id||ev.id===lastEventId)return;lastEventId=ev.id;
    $("eventTitle").textContent=ev.title||"ALERTA";$("eventBody").textContent=ev.body||"";$("eventOverlay").classList.add("show");beep(ev.type==="n02"?240:180,.1);
    setTimeout(()=>$("eventOverlay").classList.remove("show"),ev.duration||5000);
  }

  function localChatKey(){return "oph-yumiya-out-"+room}
  function getLocalOutgoing(){
    try{return JSON.parse(localStorage.getItem(localChatKey())||"[]").filter(x=>x&&x.text)}catch(e){return[]}
  }
  function saveLocalOutgoing(arr){localStorage.setItem(localChatKey(),JSON.stringify(arr.slice(-30)))}
  function isForMe(m){return !m.targetUid || m.targetUid==="all" || (playerUid && m.targetUid===playerUid)}
  function renderYumiya(){
    const enabled=!!state.visible.comms;
    $("yumiyaLauncher").classList.toggle("hidden",!enabled);
    if(!enabled){$("yumiyaChat").classList.add("hidden");chatOpen=false;return}

    const identified=renderIdentityGate();
    if(!identified){
      $("yumiyaStatus").textContent="IDENTIFICAÇÃO NECESSÁRIA";
      $("yumiyaLaunchStatus").textContent="IDENTIFIQUE-SE";
      return;
    }

    const remote=(state.comms.messages||[]).filter(isForMe);
    const local=getLocalOutgoing().map(m=>Object.assign({source:"player"},m));
    const merged=[
      {id:"system-welcome",source:"system",ts:0,text:"Canal remoto inicializado. Envie uma solicitação operacional quando necessário."},
      ...local,
      ...remote.map(m=>Object.assign({source:"yumiya"},m))
    ].sort((a,b)=>(a.ts||0)-(b.ts||0));

    $("yumiyaMessages").innerHTML=merged.map(m=>{
      if(m.source==="system") return `<div class="chatSystemMsg">${esc(m.text)}</div>`;
      if(m.source==="player") return `<div class="chatMsg player"><div class="chatMeta">VOCÊ // ${new Date(m.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div><div class="chatBubble">${esc(m.text)}</div></div>`;
      const style=["normal","urgent","glitch"].includes(m.style)?m.style:"normal";
      return `<div class="chatMsg yumiya ${style}"><div class="chatMeta">YUMIYA // ${new Date(m.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div><div class="chatBubble">${esc(m.text)}</div></div>`;
    }).join("");

    const p=state.comms.processing||{};
    const processing=!!p.active && (!p.until || p.until>Date.now()) && (!p.targetUid || p.targetUid==="all" || p.targetUid===playerUid);
    $("yumiyaProcessing").classList.toggle("hidden",!processing);
    $("yumiyaProcessingText").textContent=p.label||"PROCESSANDO SOLICITAÇÃO...";
    $("yumiyaStatus").textContent=processing?"CONSULTANDO...":"CANAL SEGURO";
    $("yumiyaLaunchStatus").textContent=processing?"PROCESSANDO":"CANAL DISPONÍVEL";

    const newest=remote.reduce((n,m)=>Math.max(n,+m.ts||0),0);
    if(newest>lastSeenCommsTs && !chatOpen){
      unread += remote.filter(m=>(+m.ts||0)>lastSeenCommsTs).length;
      if(unread){$("yumiyaUnread").textContent=String(Math.min(unread,99));$("yumiyaUnread").classList.remove("hidden");beep(820,.05)}
    }
    lastSeenCommsTs=Math.max(lastSeenCommsTs,newest);

    if(chatOpen){
      requestAnimationFrame(()=>{$("yumiyaMessages").scrollTop=$("yumiyaMessages").scrollHeight});
    }
  }
  function toggleYumiyaChat(force){
    chatOpen=typeof force==="boolean"?force:!chatOpen;
    $("yumiyaChat").classList.toggle("hidden",!chatOpen);
    if(chatOpen){
      ensureYumiyaIdentityFromMainName();
      unread=0;$("yumiyaUnread").classList.add("hidden");
      renderYumiya();
      requestAnimationFrame(()=>{
        const identity=getYumiyaIdentity();
        if(identity){$("yumiyaMessages").scrollTop=$("yumiyaMessages").scrollHeight;$("yumiyaInput")?.focus()}
        else $("yumiyaIdentityInput")?.focus();
      });
    }
  }
  async function sendYumiyaMessage(){
    if(!connected){toast("CONECTE-SE À SALA PRIMEIRO");return}
    const identity=getYumiyaIdentity()||ensureYumiyaIdentityFromMainName();
    if(!identity){
      renderIdentityGate();
      toast("IDENTIFIQUE O OPERADOR PRIMEIRO");
      $("yumiyaIdentityInput")?.focus();
      return;
    }
    const box=$("yumiyaInput"), text=box.value.trim(); if(!text)return;
    const nickname=identity.name, playerId=identity.playerId;
    const item={id:"out-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),text,ts:Date.now(),nickname,playerId};
    const local=getLocalOutgoing();local.push(item);saveLocalOutgoing(local);
    box.value="";renderYumiya();
    try{
      await OPH.Realtime.sendChat({text,nickname,playerId});
      toast("SOLICITAÇÃO ENVIADA");
    }catch(e){
      toast("FALHA AO ENVIAR");console.error(e)
    }
  }

  function render(){
    renderNav();renderApproaches();renderPreps();renderN02();renderEmergency();renderEvent();renderYumiya();
    if($("followHost").checked && visibleStage(state.focusStage))go(state.focusStage);
  }
  async function sha256(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s.toUpperCase()));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
  async function submitKey(){
    const val=$("keyInput").value.trim();if(!val)return;const hash=await sha256(val);const clueId=Object.entries(OPH.KEY_HASHES).find(([,h])=>h===hash)?.[0];
    if(!clueId){toast("KEYMASTER NÃO RECONHECIDO");beep(220,.08);return}
    $("keyInput").value="";toast("CHAVE VÁLIDA — PEDIDO ENVIADO AO NARRADOR");beep(930,.06);
    await OPH.Realtime.sendRequest({type:"clue",clueId,nickname:localStorage.getItem("oph-name")||"Jogador"});
  }
  function switchTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));$(tab).classList.add("active")}
  async function connect(){
    room=$("room").value.trim().toUpperCase()||"FRIA-01";localStorage.setItem("oph-room",room);history.replaceState(null,"",`?room=${encodeURIComponent(room)}`);
    try{
      const r=await OPH.Realtime.connect({roomId:room,asHost:false});connected=true;playerUid=r.uid||OPH.Realtime.getUid();
      $("conn").classList.add("on");$("mode").textContent=r.mode.toUpperCase();toast("CONECTADO À SALA "+room);renderYumiya()
    }
    catch(e){toast("FALHA AO CONECTAR");console.error(e)}
  }
  OPH.Realtime.onState(s=>{state=mergeDefaults(s);render()});
  window.OPHPlayer={go,submitKey,switchTab,connect,toggleYumiyaChat,sendYumiyaMessage,confirmYumiyaIdentity,changeYumiyaIdentity};
  window.addEventListener("DOMContentLoaded",()=>{
    $("room").value=room;$("name").value=localStorage.getItem("oph-name")||"";
    $("name").oninput=()=>localStorage.setItem("oph-name",$("name").value);
    $("yumiyaInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendYumiyaMessage()}});
    $("yumiyaIdentityInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();confirmYumiyaIdentity()}});
    connect();render()
  });
})();