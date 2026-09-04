window.DCX = window.DCX || {};
(() => {
  const BUILD = "POLLS-V1.3-REAL-VOTE";
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const palette = ["#67dcff","#ffcf66","#ff7f9a","#8cffaa","#c499ff","#ff9b66","#7bb3ff","#f7f07a"];

  let db=null, auth=null, room="", pollRef=null, polls={}, retryTimer=null, tickTimer=null;
  let playerId="", ownVotes={}, voteRefs={}, selected={}, sending=new Set(), expiredSeen=new Set();

  function identity(){
    try{
      const fromDcx=window.DCX?.Player?.getLocalIdentity?.();
      if(fromDcx?.playerId) return {playerId:String(fromDcx.playerId),name:String(fromDcx.name||"AGENTE")};
    }catch(e){}
    const r=room||new URLSearchParams(location.search).get("room")||localStorage.getItem("oph-room")||window.OPH_CONFIG?.defaultRoom||"FRIA-01";
    try{
      const d=JSON.parse(localStorage.getItem("oph-yumiya-identity-"+r)||"null");
      if(d?.playerId)return{playerId:String(d.playerId),name:String(d.name||"AGENTE")};
    }catch(e){}
    return null;
  }
  function toast(text){
    const e=$("toast");if(!e)return;
    e.textContent=text;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800);
  }
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
  function isExpired(p){
    return !!(p?.endsAt && Number(p.endsAt)>0 && Date.now()>Number(p.endsAt));
  }
  function countdownText(p){
    const end=Number(p?.endsAt)||0;
    if(!end)return "SEM TIMER";
    const sec=Math.max(0,Math.ceil((end-Date.now())/1000));
    if(sec>0)return fmtDuration(sec);
    return p?.closeMode==="manual"?"TEMPO ESGOTADO // AGUARDANDO KEYMASTER":"ENCERRADA PELO TIMER";
  }
  function countsFor(p){
    const out={};optionEntries(p).forEach(o=>out[o.id]=0);
    const src=p?.resultsVisibility==="visible"?(p?.counts||{}):{};
    Object.entries(src||{}).forEach(([id,n])=>{if(Object.prototype.hasOwnProperty.call(out,id))out[id]=Math.max(0,Number(n)||0)});
    return out;
  }
  function totalFor(p){return Number(p?.totalVotes)||Object.values(countsFor(p)).reduce((a,b)=>a+b,0)}
  function currentChoice(id){return ownVotes?.[id]?.choiceId||""}
  function pendingChoice(id){return selected[id]||currentChoice(id)||""}
  function canVote(id,p){
    if(!auth?.currentUser||!playerId||p?.status!=="active"||isExpired(p))return false;
    const prior=currentChoice(id);
    return !prior || p.allowVoteChange!==false;
  }
  function choiceState(id,p,o){
    const prior=currentChoice(id),pending=pendingChoice(id);
    return [pending===o.id?"selected":"",prior===o.id?"voted":"",!canVote(id,p)?"locked":""].filter(Boolean).join(" ");
  }
  function resultLabel(p,o){
    if(p?.resultsVisibility!=="visible")return "";
    const c=countsFor(p),t=totalFor(p),n=c[o.id]||0,pct=t?Math.round(n/t*100):0;
    return `${n} · ${pct}%`;
  }
  function renderStandard(id,p){
    return `<div class="playerPollOptions">${optionEntries(p).map((o,i)=>`<button type="button" class="playerPollOption ${choiceState(id,p,o)}" data-poll-choice="${esc(id)}" data-option-id="${esc(o.id)}" ${canVote(id,p)?"":"disabled"}><span>${String(i+1).padStart(2,"0")}</span><div><b>${esc(o.label||`Opção ${i+1}`)}</b>${o.description?`<p>${esc(o.description)}</p>`:""}</div><em>${p.resultsVisibility==="visible"?esc(resultLabel(p,o)):(currentChoice(id)===o.id?"SEU VOTO":"SELECIONAR")}</em></button>`).join("")}</div>`;
  }
  function donutBackground(p){
    if(p?.resultsVisibility!=="visible")return `conic-gradient(${palette.map((c,i)=>`${c} ${i*12.5}% ${(i+1)*12.5}%`).join(",")})`;
    const opts=optionEntries(p),counts=countsFor(p),total=totalFor(p);
    if(!total)return "#173d4e";
    let acc=0;const seg=[];
    opts.forEach((o,i)=>{const pct=(counts[o.id]||0)/total*100;seg.push(`${palette[i%palette.length]} ${acc}% ${acc+pct}%`);acc+=pct});
    return `conic-gradient(${seg.join(",")})`;
  }
  function renderPizza(id,p){
    const opts=optionEntries(p),total=totalFor(p);
    return `<div class="playerPollPizza"><div class="playerPollDonut" style="background:${donutBackground(p)}"><div><b>${p.resultsVisibility==="visible"?total:opts.length}</b><small>${p.resultsVisibility==="visible"?"VOTOS":"OPÇÕES"}</small></div></div><div class="playerPollLegend">${opts.map((o,i)=>`<button type="button" class="playerPollLegendChoice ${choiceState(id,p,o)}" data-poll-choice="${esc(id)}" data-option-id="${esc(o.id)}" ${canVote(id,p)?"":"disabled"}><i data-poll-swatch="${i%8}"></i><div><b>${esc(o.label||`Opção ${i+1}`)}</b>${o.description?`<p>${esc(o.description)}</p>`:""}</div>${p.resultsVisibility==="visible"?`<strong>${esc(resultLabel(p,o))}</strong>`:(currentChoice(id)===o.id?"<strong>SEU VOTO</strong>":"")}</button>`).join("")}</div></div>`;
  }
  function actionFooter(id,p){
    const prior=currentChoice(id),pending=pendingChoice(id),expired=isExpired(p),busy=sending.has(id);
    let note="";
    if(expired)note="VOTAÇÃO ENCERRADA PARA NOVOS VOTOS";
    else if(prior&&p.allowVoteChange===false)note="VOTO REGISTRADO // ALTERAÇÃO BLOQUEADA";
    else if(prior)note="VOTO REGISTRADO // VOCÊ PODE ALTERAR";
    else note="SELECIONE UMA OPÇÃO E CONFIRME";
    const disabled=!canVote(id,p)||!pending||busy||(!prior&&pending==="");
    const same=prior&&pending===prior;
    return `<footer class="playerPollFooter"><div><span>${p.visualMode==="pizza"?"FORMATO // PIZZA":"FORMATO // PADRÃO"}</span><b>${esc(note)}</b></div>${canVote(id,p)?`<button class="btn gold playerPollConfirm" type="button" data-poll-confirm="${esc(id)}" ${disabled||same?"disabled":""}>${busy?"ENVIANDO…":prior?"CONFIRMAR ALTERAÇÃO":"CONFIRMAR VOTO"}</button>`:""}</footer>`;
  }
  function renderPoll(id,p){
    return `<article class="playerPollCard" data-player-poll="${esc(id)}"><header><div><span>DCX // VOTAÇÃO ATIVA</span><h3>${esc(p.title||"Votação")}</h3></div><b data-player-poll-timer="${esc(id)}">${esc(countdownText(p))}</b></header>${p.description?`<p class="playerPollDescription">${esc(p.description)}</p>`:""}${p.visualMode==="pizza"?renderPizza(id,p):renderStandard(id,p)}${actionFooter(id,p)}</article>`;
  }
  function render(){
    const content=$("dcxPollsPlayerContent"), state=$("dcxPollsCardState"), badge=$("dcxPollsCardCount"), id=identity();
    playerId=id?.playerId||"";
    const active=activeEntries();
    if(state) state.textContent = auth?.currentUser ? (active.length ? `${active.length} ATIVA${active.length>1?"S":""}` : "NENHUMA ATIVA") : "CONECTE-SE";
    if(badge){badge.textContent=String(active.length);badge.classList.toggle("hidden",active.length===0)}
    if(!content)return;
    if(!auth?.currentUser){content.innerHTML='<div class="dcxEmpty big">Conecte-se à sala para consultar votações.</div>';return}
    if(!playerId){content.innerHTML='<div class="dcxEmpty big">Identifique seu operador antes de votar.</div>';return}
    if(!active.length){content.innerHTML='<div class="dcxEmpty big">Nenhuma votação ativa publicada pelo Keymaster.</div>';return}
    content.innerHTML=active.map(([pid,p])=>renderPoll(pid,p)).join("");
  }
  function tick(){
    document.querySelectorAll("[data-player-poll-timer]").forEach(el=>{
      const p=polls?.[el.dataset.playerPollTimer];
      if(p)el.textContent=countdownText(p);
    });
    // Re-render somente uma vez quando cada timer cruza zero, para travar os controles.
    for(const [id,p] of activeEntries()){
      if(isExpired(p)&&!expiredSeen.has(id)){expiredSeen.add(id);render();break}
      if(!isExpired(p))expiredSeen.delete(id);
    }
  }
  function toggle(force){
    const panel=$("dcxPollsPanel");if(!panel)return;
    const open=force===undefined?panel.classList.contains("hidden"):!!force;
    panel.classList.toggle("hidden",!open);
    if(open)render();
  }
  function detachVotes(){
    Object.values(voteRefs).forEach(r=>{try{r.off()}catch(e){}});voteRefs={};ownVotes={};selected={};
  }
  function attachOwnVoteListeners(){
    if(!db||!room||!playerId)return;
    const activeIds=new Set(activeEntries().map(([id])=>id));
    Object.keys(voteRefs).forEach(id=>{if(!activeIds.has(id)){try{voteRefs[id].off()}catch(e){};delete voteRefs[id];delete ownVotes[id];delete selected[id]}});
    activeIds.forEach(id=>{
      if(voteRefs[id])return;
      const vr=db.ref(`rooms/${room}/dcx/pollVotes/${id}/${playerId}`);voteRefs[id]=vr;
      vr.on("value",s=>{ownVotes[id]=s.val()||null;if(!selected[id]&&ownVotes[id]?.choiceId)selected[id]=ownVotes[id].choiceId;render()},e=>console.warn("Voto próprio listener",id,e));
    });
  }
  function selectChoice(pollId,optionId){
    const p=polls?.[pollId];if(!p||!canVote(pollId,p))return;
    if(!p.options?.[optionId])return;
    selected[pollId]=optionId;render();
  }
  async function confirmVote(pollId){
    const p=polls?.[pollId],choiceId=selected[pollId];
    if(!p||!choiceId||!canVote(pollId,p)||sending.has(pollId))return;
    if(!p.options?.[choiceId]){toast("OPÇÃO INVÁLIDA");return}
    const prior=currentChoice(pollId);if(prior===choiceId){toast("ESSE JÁ É O SEU VOTO");return}
    sending.add(pollId);render();
    try{
      const vr=db.ref(`rooms/${room}/dcx/pollVotes/${pollId}/${playerId}`);
      await vr.set({choiceId,votedAt:firebase.database.ServerValue.TIMESTAMP});
      toast(prior?"VOTO ALTERADO // REGISTRADO":"VOTO REGISTRADO");
    }catch(e){
      console.error("Falha ao votar",e);toast(`VOTO RECUSADO // ${e.code||"ERRO"}`);
      if(prior)selected[pollId]=prior;
    }finally{sending.delete(pollId);render()}
  }
  function bindClicks(){
    document.addEventListener("click",e=>{
      const choice=e.target.closest?.("[data-poll-choice]");
      if(choice){e.preventDefault();selectChoice(choice.dataset.pollChoice,choice.dataset.optionId);return}
      const confirm=e.target.closest?.("[data-poll-confirm]");
      if(confirm){e.preventDefault();confirmVote(confirm.dataset.pollConfirm)}
    });
  }
  function detach(){
    try{pollRef?.off()}catch(e){};pollRef=null;detachVotes();polls={};room="";db=null;auth=null;playerId="";render();
  }
  function ensureAttached(){
    const r=window.OPH?.Realtime;
    const nextDb=r?.getFirebaseDatabase?.()||null, nextAuth=r?.getFirebaseAuth?.()||null, nextRoom=r?.getRoom?.()||"";
    const nextPid=identity()?.playerId||"";
    if(!nextDb||!nextAuth?.currentUser||!nextRoom){render();return false}
    if(pollRef&&db===nextDb&&room===nextRoom&&playerId===nextPid){attachOwnVoteListeners();return true}
    try{pollRef?.off()}catch(e){};detachVotes();
    db=nextDb;auth=nextAuth;room=nextRoom;playerId=nextPid;
    pollRef=db.ref(`rooms/${room}/dcx/meta/publicPolls`);
    pollRef.on("value",snap=>{polls=snap.val()||{};attachOwnVoteListeners();render();tick()},err=>{
      console.error("Votações player listener",err);polls={};render();
    });
    console.info("VOTAÇÕES V1.3 // REAL VOTE // LISTENER OK",{room,playerId,build:BUILD});
    return true;
  }
  function init(){
    $("dcxOpenPolls")?.addEventListener("click",()=>toggle(true));
    if(!window.__dcxPollVoteClicks){window.__dcxPollVoteClicks=true;bindClicks()}
    clearInterval(tickTimer);tickTimer=setInterval(()=>{ensureAttached();tick()},1000);
    clearTimeout(retryTimer);retryTimer=setTimeout(ensureAttached,250);
    render();return true;
  }

  window.DCX.PollsPlayer={init,toggle,render,detach,selectChoice,confirmVote};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
