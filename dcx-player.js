window.DCX = window.DCX || {};
(() => {
  const BUILD="DCX-OS-A1";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let room=new URLSearchParams(location.search).get("room")||localStorage.getItem("oph-room")||window.OPH_CONFIG?.defaultRoom||"FRIA-01";
  let db=null,uid="",playerId="",name="",teams={},operators={},connected=false,initialized=false,lastInteraction=Date.now();
  let heartbeatTimer=null, refs=[];

  function identity(){
    try{const d=JSON.parse(localStorage.getItem("oph-yumiya-identity-"+room)||"null");if(d?.name&&d?.playerId)return {name:String(d.name).trim().slice(0,48),playerId:String(d.playerId)}}catch(e){}
    const n=(localStorage.getItem("oph-name")||$("name")?.value||"").trim(); const p=localStorage.getItem("oph-yumiya-player-id")||""; return n&&p?{name:n.slice(0,48),playerId:p}:null;
  }
  function now(){return firebase.database.ServerValue.TIMESTAMP}
  function base(p=""){return `rooms/${room}/dcx${p?"/"+p:""}`}
  function ref(p=""){return db.ref(base(p))}
  function narrative(op){return Object.assign({teamId:"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true},op?.narrative||{})}
  function operatorName(op,id){return op?.identity?.name||op?.name||id}
  function touch(){lastInteraction=Date.now()}

  async function heartbeat(){
    if(!connected||!uid||!playerId)return;
    try{await ref(`presence/${uid}`).set({uid,playerId,name,build:window.OPH_BUILD||BUILD,visibility:document.visibilityState,focused:document.hasFocus(),lastInteraction,lastSeen:now()})}catch(e){console.warn("heartbeat",e)}
  }
  async function register(){
    const i=identity(); if(!i)return false; playerId=i.playerId;name=i.name;
    try{
      await ref(`operators/${playerId}/identity`).update({type:"player",playerId,name,updatedAt:now()});
      const snap=await ref(`operators/${playerId}/narrative`).once("value");
      if(!snap.exists())await ref(`operators/${playerId}/narrative`).set({teamId:"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true});
      connected=true; await heartbeat(); return true;
    }catch(e){console.warn("DCX register",e);return false}
  }
  function renderTeams(){
    const box=$("dcxTeamContent");if(!box)return;
    const teamEntries=Object.entries(teams||{}).filter(([id])=>id!=="_init");
    if(!teamEntries.length){box.innerHTML=`<div class="dcxEmpty big">Nenhuma equipe operacional publicada.</div>`;return}
    box.innerHTML=teamEntries.map(([tid,t])=>{
      const members=Object.entries(operators||{}).filter(([id,op])=>narrative(op).teamId===tid&&narrative(op).visible!==false);
      return `<article class="dcxPlayerTeamCard"><div class="dcxPlayerTeamHead"><div><span>${esc(t.codename||"EQUIPE")}</span><h3>${esc(t.name||tid)}</h3></div><b>${esc(t.status||"OPERACIONAL")}</b></div>${t.description?`<p>${esc(t.description)}</p>`:""}<div class="dcxPlayerRoster">${members.map(([id,op])=>{const n=narrative(op),me=id===playerId;return `<div class="dcxPlayerMember ${me?"self":""}"><div><b>${esc(operatorName(op,id))}${me?" · VOCÊ":""}</b><small>${esc(n.role||"OPERADOR")}${n.location?` · ${esc(n.location)}`:""}</small></div><span>${esc(n.status||"OPERACIONAL")}</span><em>${esc(n.commsStatus||"ONLINE")}</em></div>`}).join("")||`<div class="dcxEmpty">Sem membros visíveis.</div>`}</div></article>`;
    }).join("");
  }
  function toggleTeam(force){const panel=$("dcxTeamPanel");if(!panel)return;const open=typeof force==="boolean"?force:panel.classList.contains("hidden");panel.classList.toggle("hidden",!open);if(open)renderTeams()}
  async function init(force=false){
    if(!window.firebase?.apps?.length||!firebase.auth().currentUser)return;
    const targetRoom=OPH.Realtime?.getRoom?.()||room;
    if(initialized && !force && targetRoom===room)return;
    if(initialized){refs.forEach(r=>{try{r.off()}catch(e){}});refs=[];clearInterval(heartbeatTimer);initialized=false;connected=false}
    db=firebase.database();uid=firebase.auth().currentUser.uid;room=targetRoom;
    if(!(await register())){setTimeout(init,1200);return}
    initialized=true;
    const tr=ref("teams"),or=ref("operators");tr.on("value",s=>{teams=s.val()||{};renderTeams()});or.on("value",s=>{operators=s.val()||{};const me=operators[playerId]?.identity?.name;if(me&&me!==name){name=me;const key="oph-yumiya-identity-"+room;try{const d=JSON.parse(localStorage.getItem(key)||"{}");d.name=me;d.playerId=playerId;localStorage.setItem(key,JSON.stringify(d));localStorage.setItem("oph-name",me);if($("name"))$("name").value=me}catch(e){}}renderTeams()});refs.push(tr,or);
    clearInterval(heartbeatTimer);heartbeatTimer=setInterval(heartbeat,20000);heartbeat();
  }
  firebase.auth().onAuthStateChanged(user=>{if(user?.isAnonymous)setTimeout(init,350)});
  ["pointerdown","keydown","touchstart"].forEach(ev=>window.addEventListener(ev,touch,{passive:true}));
  document.addEventListener("visibilitychange",()=>{touch();heartbeat()});window.addEventListener("focus",()=>{touch();heartbeat()});window.addEventListener("blur",heartbeat);
  window.addEventListener("beforeunload",()=>{try{if(db&&uid)ref(`presence/${uid}`).update({visibility:"hidden",focused:false,lastSeen:firebase.database.ServerValue.TIMESTAMP})}catch(e){}});
  window.DCX.Player={toggleTeam,init};
})();
