window.OPH = window.OPH || {};
(() => {
  let state = OPH.cloneDefault();
  let room = new URLSearchParams(location.search).get("room") || localStorage.getItem("oph-room") || window.OPH_CONFIG.defaultRoom || "FRIA-01";
  let connected=false, currentStage=0, lastEventId=null;
  const stageDefs=[
    ["home","ABERTURA"],["government","GOVERNO"],["h01","H-01"],["approaches","PLANO"],["preps","D-1"],["n02","N-02"],["protocol","PROTO"]
  ];
  const stageVisibleKey={government:"government",h01:"h01",approaches:"approaches",preps:"preps",n02:"n02",protocol:"protocol"};

  const $=id=>document.getElementById(id);
  function beep(freq=650,d=.04){try{const ac=new (AudioContext||webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain();o.type="square";o.frequency.value=freq;g.gain.value=.02;o.connect(g);g.connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d);o.stop(ac.currentTime+d)}catch(e){}}
  function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1700)}
  function clone(o){return JSON.parse(JSON.stringify(o))}
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
      emergency:Object.assign(d.emergency,s?.emergency||{})
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
  function render(){
    renderNav();renderApproaches();renderPreps();renderN02();renderEmergency();renderEvent();
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
    try{const r=await OPH.Realtime.connect({roomId:room,asHost:false});connected=true;$("conn").classList.add("on");$("mode").textContent=r.mode.toUpperCase();toast("CONECTADO À SALA "+room)}
    catch(e){toast("FALHA AO CONECTAR");console.error(e)}
  }
  OPH.Realtime.onState(s=>{state=mergeDefaults(s);render()});
  window.OPHPlayer={go,submitKey,switchTab,connect};
  window.addEventListener("DOMContentLoaded",()=>{$("room").value=room;$("name").value=localStorage.getItem("oph-name")||"";$("name").onchange=()=>localStorage.setItem("oph-name",$("name").value);connect();render()});
})();