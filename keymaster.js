window.OPH = window.OPH || {};
(() => {
  let state=OPH.cloneDefault(),room=new URLSearchParams(location.search).get("room")||window.OPH_CONFIG.defaultRoom||"FRIA-01",requests={};
  const $=id=>document.getElementById(id);
  function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1600)}
  function merge(s){return Object.assign(OPH.cloneDefault(),s||{}, {visible:Object.assign(OPH.cloneDefault().visible,s?.visible||{}), approaches:Object.assign(OPH.cloneDefault().approaches,s?.approaches||{}), preps:{assault:Object.assign(OPH.cloneDefault().preps.assault,s?.preps?.assault||{}),stealth:Object.assign(OPH.cloneDefault().preps.stealth,s?.preps?.stealth||{}),con:Object.assign(OPH.cloneDefault().preps.con,s?.preps?.con||{})}, n02:Object.assign(OPH.cloneDefault().n02,s?.n02||{}, {clues:Object.assign(OPH.cloneDefault().n02.clues,s?.n02?.clues||{})}), emergency:Object.assign(OPH.cloneDefault().emergency,s?.emergency||{})})}
  async function save(){await OPH.Realtime.setState(state);render()}
  function renderVisibility(){
    const defs=[["government","Contexto político"],["h01","H-01"],["approaches","Abordagens"],["preps","Preparações"],["n02","N-02"],["protocol","Protocolo"],["emergencySim","Simulador H-01"],["family","Reina's Family"]];
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
  function renderRequests(){
    const vals=Object.entries(requests||{});$("requests").innerHTML=vals.length?vals.map(([id,r])=>`<div class="request"><b>${r.nickname||"Jogador"} enviou uma chave</b><p>Fragmento solicitado: ${r.clueId}</p><button class="btn gold" onclick="KM.acceptRequest('${id}','${r.clueId}')">CONFIRMAR PARA TODOS</button> <button class="btn" onclick="KM.dismissRequest('${id}')">Ignorar</button></div>`).join(""):`<div class="card"><p>Nenhuma chave aguardando confirmação.</p></div>`;
  }
  function renderEvents(){
    $("emLevel").value=state.emergency.level||0;$("emLevelLabel").textContent=OPH.EMERGENCY_STATES[state.emergency.level||0].title;
  }
  function render(){renderVisibility();renderApproaches();renderPreps();renderClues();renderRequests();renderEvents();$("roomLabel").textContent=room;$("playerUrl").value=location.origin+location.pathname.replace(/keymaster\.html$/,"")+`?room=${encodeURIComponent(room)}`}
  async function connect(){
    room=$("room").value.trim().toUpperCase()||"FRIA-01";history.replaceState(null,"",`?room=${encodeURIComponent(room)}`);
    const fb=window.OPH_CONFIG?.firebase?.enabled;
    const credentials=fb?{email:$("email").value,password:$("password").value}:{password:$("localPassword").value};
    try{const r=await OPH.Realtime.connect({roomId:room,asHost:true,credentials});$("login").classList.add("hidden");$("console").classList.remove("hidden");$("mode").textContent=r.mode.toUpperCase();toast("KEYMASTER CONECTADO")}
    catch(e){toast("FALHA DE AUTENTICAÇÃO/CONEXÃO");console.error(e)}
  }
  function event(type,title,body){state.event={id:crypto.randomUUID?.()||String(Date.now())+Math.random(),type,title,body,duration:5200};save()}
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
    copyLink:()=>navigator.clipboard?.writeText($("playerUrl").value)
  };
  OPH.Realtime.onState(s=>{state=merge(s);render()});OPH.Realtime.onRequests(r=>{requests=r;renderRequests()});
  window.addEventListener("DOMContentLoaded",()=>{$("room").value=room;$("firebaseLogin").classList.toggle("hidden",!window.OPH_CONFIG?.firebase?.enabled);$("localLogin").classList.toggle("hidden",!!window.OPH_CONFIG?.firebase?.enabled);render()});
})();