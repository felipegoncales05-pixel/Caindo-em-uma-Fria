window.DCX = window.DCX || {};
(() => {
  const BUILD = "POLLS-V1.2-PLAYER-VIEW";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let db=null, auth=null, room="", pollRef=null, polls={}, retryTimer=null, tickTimer=null;

  function optionEntries(p){return Object.values(p?.options||{}).sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0))}
  function fmtDuration(sec){
    sec=Math.max(0,Math.floor(Number(sec)||0));
    const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    if(h)return `${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;
    if(m)return `${m}m ${String(s).padStart(2,"0")}s`;
    return `${s}s`;
  }
  function activeEntries(){
    return Object.entries(polls||{}).filter(([,p])=>p?.status==="active").sort((a,b)=>(Number(b[1]?.startedAt)||0)-(Number(a[1]?.startedAt)||0));
  }
  function countdownText(p){
    const end=Number(p?.endsAt)||0;
    if(!end)return "SEM TIMER";
    const sec=Math.max(0,Math.ceil((end-Date.now())/1000));
    if(sec>0)return fmtDuration(sec);
    return p?.closeMode==="manual"?"TEMPO ESGOTADO // AGUARDANDO KEYMASTER":"ENCERRANDO…";
  }
  function renderStandard(p){
    return `<div class="playerPollOptions">${optionEntries(p).map((o,i)=>`<article class="playerPollOption"><span>${String(i+1).padStart(2,"0")}</span><div><b>${esc(o.label||`Opção ${i+1}`)}</b>${o.description?`<p>${esc(o.description)}</p>`:""}</div><em>VISUALIZAÇÃO</em></article>`).join("")}</div>`;
  }
  function renderPizza(p){
    const opts=optionEntries(p);
    return `<div class="playerPollPizza"><div class="playerPollDonut"><div><b>${opts.length}</b><small>OPÇÕES</small></div></div><div class="playerPollLegend">${opts.map((o,i)=>`<article><i data-poll-swatch="${i%8}"></i><div><b>${esc(o.label||`Opção ${i+1}`)}</b>${o.description?`<p>${esc(o.description)}</p>`:""}</div></article>`).join("")}</div></div>`;
  }
  function renderPoll(id,p){
    return `<article class="playerPollCard" data-player-poll="${esc(id)}"><header><div><span>DCX // VOTAÇÃO ATIVA</span><h3>${esc(p.title||"Votação")}</h3></div><b data-player-poll-timer="${esc(id)}">${esc(countdownText(p))}</b></header>${p.description?`<p class="playerPollDescription">${esc(p.description)}</p>`:""}${p.visualMode==="pizza"?renderPizza(p):renderStandard(p)}<footer><span>${p.visualMode==="pizza"?"FORMATO // PIZZA":"FORMATO // PADRÃO"}</span><b>VOTO AINDA NÃO HABILITADO NESTA ETAPA</b></footer></article>`;
  }
  function render(){
    const content=$("dcxPollsPlayerContent"), state=$("dcxPollsCardState"), badge=$("dcxPollsCardCount");
    const active=activeEntries();
    if(state) state.textContent = auth?.currentUser ? (active.length ? `${active.length} ATIVA${active.length>1?"S":""}` : "NENHUMA ATIVA") : "CONECTE-SE";
    if(badge){badge.textContent=String(active.length);badge.classList.toggle("hidden",active.length===0)}
    if(!content)return;
    if(!auth?.currentUser){content.innerHTML='<div class="dcxEmpty big">Conecte-se à sala para consultar votações.</div>';return}
    if(!active.length){content.innerHTML='<div class="dcxEmpty big">Nenhuma votação ativa publicada pelo Keymaster.</div>';return}
    content.innerHTML=active.map(([id,p])=>renderPoll(id,p)).join("");
  }
  function tick(){
    document.querySelectorAll("[data-player-poll-timer]").forEach(el=>{
      const p=polls?.[el.dataset.playerPollTimer];
      if(p)el.textContent=countdownText(p);
    });
  }
  function toggle(force){
    const panel=$("dcxPollsPanel");if(!panel)return;
    const open=force===undefined?panel.classList.contains("hidden"):!!force;
    panel.classList.toggle("hidden",!open);
    if(open)render();
  }
  function detach(){
    try{pollRef?.off()}catch(e){}
    pollRef=null;polls={};room="";db=null;auth=null;render();
  }
  function ensureAttached(){
    const r=window.OPH?.Realtime;
    const nextDb=r?.getFirebaseDatabase?.()||null, nextAuth=r?.getFirebaseAuth?.()||null, nextRoom=r?.getRoom?.()||"";
    if(!nextDb||!nextAuth?.currentUser||!nextRoom){render();return false}
    if(pollRef&&db===nextDb&&room===nextRoom)return true;
    try{pollRef?.off()}catch(e){}
    db=nextDb;auth=nextAuth;room=nextRoom;
    pollRef=db.ref(`rooms/${room}/dcx/meta/publicPolls`);
    pollRef.on("value",snap=>{polls=snap.val()||{};render();tick()},err=>{
      console.error("Votações player listener",err);polls={};render();
    });
    console.info("VOTAÇÕES V1.2 // PLAYER VIEW // LISTENER OK",{room,build:BUILD});
    return true;
  }
  function init(){
    $("dcxOpenPolls")?.addEventListener("click",()=>toggle(true));
    clearInterval(tickTimer);tickTimer=setInterval(()=>{ensureAttached();tick()},1000);
    clearTimeout(retryTimer);retryTimer=setTimeout(ensureAttached,250);
    render();
    return true;
  }

  window.DCX.PollsPlayer={init,toggle,render,detach};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
