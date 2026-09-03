window.DCX = window.DCX || {};
(() => {
  const BUILD = "POLLS-V1.2-PLAYER-VIEW";
  const MAX_DURATION_SECONDS = 86400;
  const MAX_RETENTION_HOURS = 720;
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const clean = (v,max=140) => String(v||"").trim().replace(/\s+/g," ").slice(0,max);
  const uid = prefix => `${prefix}-${(crypto.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,"").slice(0,10).toUpperCase()}`;
  const palette = ["#67dcff","#ffcf66","#ff7f9a","#8cffaa","#c499ff","#ff9b66","#7bb3ff","#f7f07a"];

  let db=null, auth=null, room="FRIA-01", base="", polls={}, pollRef=null, publicPollRef=null, publicPollSignature="", retryTimer=null, tickTimer=null, editId="", initialized=false;
  const closing = new Set();


  function ensureNavigation(){
    const tabs=document.getElementById("kmWorkspaceTabs");
    let tab=document.querySelector('.kmWorkspaceTab[data-tab="polls"]');
    if(tabs&&!tab){
      tab=document.createElement("button");
      tab.type="button";
      tab.className="kmWorkspaceTab pollsNavTab";
      tab.dataset.tab="polls";
      tab.textContent="VOTAÇÕES";
      const yumiya=tabs.querySelector('.kmWorkspaceTab[data-tab="yumiya"]');
      tabs.insertBefore(tab,yumiya||null);
    }
    if(tab&&!tab.dataset.pollsBound){
      tab.dataset.pollsBound="1";
      tab.addEventListener("click",openAdmin);
    }
    return !!tab;
  }

  function openAdmin(){
    ensureNavigation();
    if(window.DCX?.Admin?.switchTab){
      window.DCX.Admin.switchTab("polls");
    }else{
      document.querySelectorAll(".kmWorkspaceTab").forEach(b=>b.classList.toggle("active",b.dataset.tab==="polls"));
      document.querySelectorAll(".kmWorkspaceView").forEach(v=>v.classList.toggle("active",v.dataset.kmView==="polls"));
    }
    requestAnimationFrame(()=>{
      const view=document.querySelector('[data-km-view="polls"]');
      if(view){view.scrollTop=0;view.querySelector("#pollTitle")?.focus({preventScroll:true});}
    });
  }

  function toast(text){const e=$("toast");if(!e)return;e.textContent=text;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1900)}
  function rt(){return window.OPH?.Realtime}
  function path(p=""){return `${base}${p?"/"+p:""}`}
  function ref(p=""){if(!db)throw new Error("Polls ainda não inicializado");return db.ref(path(p))}
  function fmtDate(ts){if(!ts)return"—";try{return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(Number(ts)))}catch{return"—"}}
  function fmtDuration(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;if(h)return`${h}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`;if(m)return`${m}m ${String(s).padStart(2,"0")}s`;return`${s}s`}
  function optionEntries(p){return Object.values(p?.options||{}).sort((a,b)=>(a.order||0)-(b.order||0))}
  function voteCounts(p){const out={};optionEntries(p).forEach(o=>out[o.id]=0);Object.values(p?.votes||{}).forEach(v=>{const id=typeof v==="string"?v:v?.optionId;if(id&&Object.prototype.hasOwnProperty.call(out,id))out[id]++});return out}
  function totalVotes(p){return Object.values(voteCounts(p)).reduce((a,b)=>a+b,0)}
  function winnerByVotes(p){const counts=voteCounts(p), vals=Object.entries(counts);if(!vals.length)return{winner:"",tied:[]};const max=Math.max(...vals.map(([,n])=>n));if(max<=0)return{winner:"",tied:[]};const tied=vals.filter(([,n])=>n===max).map(([id])=>id);return{winner:tied.length===1?tied[0]:"",tied}}
  function getPoll(id){return polls?.[id]||null}


  function publicProjection(p){
    const options={};
    optionEntries(p).forEach(o=>{
      options[o.id]={id:o.id,label:o.label||"",description:o.description||"",order:Number(o.order)||0};
    });
    return {
      id:p.id||"", title:p.title||"", description:p.description||"",
      visualMode:p.visualMode||"standard", closeMode:p.closeMode||"auto",
      durationSeconds:Number(p.durationSeconds)||0, startedAt:Number(p.startedAt)||0,
      endsAt:Number(p.endsAt)||0, resultsVisibility:p.resultsVisibility||"hidden",
      status:"active", options
    };
  }

  async function syncPublicPolls(){
    if(!initialized||!publicPollRef)return;
    const active=Object.entries(polls||{}).filter(([id,p])=>id!=="_init"&&p?.status==="active");
    const payload={};
    active.forEach(([id,p])=>{payload[id]=publicProjection({...p,id})});
    const out=Object.keys(payload).length?payload:null;
    const sig=JSON.stringify(out);
    if(sig===publicPollSignature)return;
    try{
      await publicPollRef.set(out);
      publicPollSignature=sig;
      console.info("VOTAÇÕES // PROJEÇÃO PÚBLICA ATUALIZADA",{ativas:active.length});
    }catch(e){
      console.error("Falha ao publicar votação para jogadores",e);
      toast(`VOTAÇÕES PLAYER // ${e.code||"ERRO"}`);
    }
  }

  function durationSeconds(){
    const value=Math.max(1,Number($("pollDurationValue")?.value)||1);
    const unit=$("pollDurationUnit")?.value||"minutes";
    const mult=unit==="seconds"?1:unit==="hours"?3600:60;
    return Math.min(MAX_DURATION_SECONDS,Math.max(1,Math.round(value*mult)));
  }
  function retentionHours(){return Math.min(MAX_RETENTION_HOURS,Math.max(1,Number($("pollRetentionHours")?.value)||24))}
  function readOptions(){
    return [...document.querySelectorAll(".pollOptionEditor")].map((row,i)=>({
      id: row.dataset.optionId || uid("OPT"),
      label: clean(row.querySelector("[data-field='label']")?.value,100),
      description: String(row.querySelector("[data-field='description']")?.value||"").trim().slice(0,600),
      winnerDescription: String(row.querySelector("[data-field='winnerDescription']")?.value||"").trim().slice(0,1200),
      order:i
    })).filter(o=>o.label);
  }
  function readForm(){
    const opts=readOptions();
    const options={};opts.forEach(o=>options[o.id]=o);
    return {
      title:clean($("pollTitle")?.value,140),
      description:String($("pollDescription")?.value||"").trim().slice(0,1200),
      visualMode:$("pollVisualMode")?.value||"standard",
      closeMode:$("pollCloseMode")?.value||"auto",
      durationSeconds:durationSeconds(),
      allowVoteChange:!!$("pollAllowVoteChange")?.checked,
      resultsVisibility:$("pollResultsVisibility")?.value||"hidden",
      tieRule:$("pollTieRule")?.value||"master",
      retention:{mode:$("pollRetentionMode")?.value||"manual",hours:retentionHours()},
      options
    }
  }
  function validate(data){
    if(!data.title)return"INFORME O TÍTULO DA VOTAÇÃO";
    if(Object.keys(data.options||{}).length<2)return"ADICIONE PELO MENOS 2 OPÇÕES";
    if(data.durationSeconds<1||data.durationSeconds>MAX_DURATION_SECONDS)return"TIMER INVÁLIDO";
    return"";
  }

  function optionEditor(o={}){
    const id=o.id||uid("OPT");
    return `<article class="pollOptionEditor" data-option-id="${esc(id)}"><div class="pollOptionEditorHead"><b>OPÇÃO</b><button type="button" class="btn red" onclick="DCX.Polls.removeOption(this)">REMOVER</button></div><label>TÍTULO DA ESCOLHA<input data-field="label" maxlength="100" value="${esc(o.label||"")}" placeholder="Ex.: RETIRAR H-01"></label><label>DESCRIÇÃO VISÍVEL<textarea data-field="description" maxlength="600" rows="2" placeholder="Opcional. Aparece durante a votação.">${esc(o.description||"")}</textarea></label><label>DESCRIÇÃO DO VENCEDOR<textarea data-field="winnerDescription" maxlength="1200" rows="3" placeholder="Só aparece ao jogador se esta opção vencer.">${esc(o.winnerDescription||"")}</textarea></label></article>`
  }
  function addOption(data={}){const box=$("pollOptions");if(!box)return;box.insertAdjacentHTML("beforeend",optionEditor(data));renderFormPreview()}
  function removeOption(btn){const rows=document.querySelectorAll(".pollOptionEditor");if(rows.length<=2){toast("MÍNIMO DE 2 OPÇÕES");return}btn.closest(".pollOptionEditor")?.remove();renderFormPreview()}

  function resetForm(){
    editId="";if($("pollEditBadge"))$("pollEditBadge").textContent="NOVA VOTAÇÃO";
    const ids={pollTitle:"",pollDescription:"",pollDurationValue:"5",pollRetentionHours:"24"};Object.entries(ids).forEach(([id,v])=>{if($(id))$(id).value=v});
    if($("pollDurationUnit"))$("pollDurationUnit").value="minutes";if($("pollVisualMode"))$("pollVisualMode").value="standard";if($("pollCloseMode"))$("pollCloseMode").value="auto";if($("pollResultsVisibility"))$("pollResultsVisibility").value="hidden";if($("pollTieRule"))$("pollTieRule").value="master";if($("pollRetentionMode"))$("pollRetentionMode").value="manual";if($("pollAllowVoteChange"))$("pollAllowVoteChange").checked=true;
    if($("pollOptions"))$("pollOptions").innerHTML=optionEditor({label:"OPÇÃO A"})+optionEditor({label:"OPÇÃO B"});
    syncRetentionUI();renderFormPreview();
  }
  function loadForm(p,id){
    if(!p||p.status!=="draft"){toast("SÓ RASCUNHOS PODEM SER EDITADOS");return}
    editId=id;if($("pollEditBadge"))$("pollEditBadge").textContent=`EDITANDO // ${id}`;
    $("pollTitle").value=p.title||"";$("pollDescription").value=p.description||"";$("pollVisualMode").value=p.visualMode||"standard";$("pollCloseMode").value=p.closeMode||"auto";$("pollAllowVoteChange").checked=p.allowVoteChange!==false;$("pollResultsVisibility").value=p.resultsVisibility||"hidden";$("pollTieRule").value=p.tieRule||"master";$("pollRetentionMode").value=p.retention?.mode||"manual";$("pollRetentionHours").value=p.retention?.hours||24;
    const sec=Math.max(1,Number(p.durationSeconds)||300);if(sec%3600===0){$("pollDurationValue").value=sec/3600;$("pollDurationUnit").value="hours"}else if(sec%60===0){$("pollDurationValue").value=sec/60;$("pollDurationUnit").value="minutes"}else{$("pollDurationValue").value=sec;$("pollDurationUnit").value="seconds"}
    $("pollOptions").innerHTML=optionEntries(p).map(optionEditor).join("");syncRetentionUI();renderFormPreview();document.querySelector("[data-km-view='polls']")?.scrollTo?.({top:0,behavior:"smooth"});
  }
  function syncRetentionUI(){const auto=$("pollRetentionMode")?.value==="auto";$("pollRetentionHoursWrap")?.classList.toggle("disabled",!auto);if($("pollRetentionHours"))$("pollRetentionHours").disabled=!auto}

  function previewCard(p,{result=false}={}){
    const opts=optionEntries(p),counts=voteCounts(p),total=Object.values(counts).reduce((a,b)=>a+b,0), winner=p.winnerOptionId||"";
    const remaining=p.status==="active"&&p.endsAt?Math.max(0,Math.ceil((p.endsAt-Date.now())/1000)):p.durationSeconds||0;
    const timer=p.status==="active"?(remaining>0?fmtDuration(remaining):(p.closeMode==="manual"?"TEMPO ESGOTADO // AGUARDANDO KEYMASTER":"ENCERRANDO…")):fmtDuration(p.durationSeconds||0);
    let body="";
    if(p.visualMode==="pizza"){
      let acc=0;const segments=[];if(total>0){opts.forEach((o,i)=>{const pct=(counts[o.id]||0)/total*100;segments.push(`${palette[i%palette.length]} ${acc}% ${acc+pct}%`);acc+=pct})}
      const bg=segments.length?`conic-gradient(${segments.join(",")})`:`#17303d`;
      body=`<div class="pollDonutWrap"><div class="pollDonut" style="background:${bg}"><div><b>${total}</b><small>VOTO(S)</small></div></div><div class="pollLegend">${opts.map((o,i)=>`<div><i style="background:${palette[i%palette.length]}"></i><span>${esc(o.label)}</span>${p.resultsVisibility==="visible"||result?`<b>${total?Math.round((counts[o.id]||0)/total*100):0}%</b>`:""}</div>`).join("")}</div></div>`;
    } else {
      body=`<div class="pollStandardOptions">${opts.map(o=>{const pct=total?Math.round((counts[o.id]||0)/total*100):0;return`<article class="pollPlayerOption ${winner===o.id?"winner":""}"><div><b>${esc(o.label)}</b>${o.description?`<p>${esc(o.description)}</p>`:""}</div>${p.resultsVisibility==="visible"||result?`<span>${counts[o.id]||0} · ${pct}%</span>`:"<span>VOTAR</span>"}</article>`}).join("")}</div>`;
    }
    const won=winner?opts.find(o=>o.id===winner):null;
    return `<div class="pollPlayerPreview"><div class="pollPlayerPreviewHead"><div><span>${result?"RESULTADO":"DCX // VOTAÇÃO"}</span><h3>${esc(p.title||"Nova votação")}</h3></div><b>${result?"ENCERRADA":timer}</b></div>${p.description?`<p class="pollPlayerDesc">${esc(p.description)}</p>`:""}${body}${result&&won?`<div class="pollWinnerReveal"><span>ESCOLHA VENCEDORA</span><b>${esc(won.label)}</b>${won.winnerDescription?`<p>${esc(won.winnerDescription)}</p>`:""}</div>`:""}</div>`
  }
  function renderFormPreview(){const box=$("pollPreview");if(!box)return;const p=readForm();p.status="preview";box.innerHTML=previewCard(p)}

  async function saveDraft(){if(!initialized){toast("VOTAÇÕES // SINCRONIZANDO");return}const data=readForm(),error=validate(data);if(error){toast(error);return}const id=editId||uid("POLL"),existing=getPoll(id);if(existing&&existing.status!=="draft"){toast("VOTAÇÃO ATIVA/ENCERRADA NÃO PODE VIRAR RASCUNHO");return}const now=Date.now();await ref(id).set({...existing,...data,id,status:"draft",createdAt:existing?.createdAt||now,updatedAt:now,startedAt:null,endsAt:null,closedAt:null,winnerOptionId:null,deleteAt:null});editId=id;toast("RASCUNHO SALVO");}
  async function startNow(){if(!initialized){toast("VOTAÇÕES // SINCRONIZANDO");return}const data=readForm(),error=validate(data);if(error){toast(error);return}const id=editId||uid("POLL"),existing=getPoll(id);if(existing&&existing.status!=="draft"){toast("ESTA VOTAÇÃO JÁ FOI INICIADA");return}const now=Date.now();await ref(id).set({...existing,...data,id,status:"active",createdAt:existing?.createdAt||now,updatedAt:now,startedAt:now,endsAt:now+data.durationSeconds*1000,closedAt:null,winnerOptionId:null,deleteAt:null,votes:existing?.votes||{}});toast("VOTAÇÃO INICIADA // PUBLICADA PARA JOGADORES");resetForm()}

  async function activateDraft(id){const p=getPoll(id);if(!p||p.status!=="draft")return;const now=Date.now();await ref(id).update({status:"active",startedAt:now,endsAt:now+(Number(p.durationSeconds)||300)*1000,updatedAt:now});toast("VOTAÇÃO INICIADA")}
  async function closePoll(id,winnerId="",auto=false){const p=getPoll(id);if(!p||p.status!=="active"||closing.has(id))return;closing.add(id);try{
    let winner=winnerId||"";const calc=winnerByVotes(p);if(winner==="auto")winner=calc.winner||"";
    const now=Date.now(),ret=p.retention||{mode:"manual",hours:24},deleteAt=ret.mode==="auto"?now+Math.max(1,Number(ret.hours)||24)*3600000:null;
    await ref(id).update({status:"closed",winnerOptionId:winner||null,winnerTiedOptionIds:!winner&&calc.tied.length>1?calc.tied:null,closedAt:now,updatedAt:now,closedBy:auto?"TIMER":"KEYMASTER",deleteAt});toast(auto?"VOTAÇÃO ENCERRADA PELO TIMER":"VOTAÇÃO ENCERRADA");
  } finally {closing.delete(id)}}
  function closeFromCard(id){const sel=$("pollWinner-"+id);closePoll(id,sel?.value||"auto",false)}
  async function archivePoll(id){const p=getPoll(id);if(!p||!["closed","archived"].includes(p.status))return;await ref(id).update({status:"archived",archivedAt:Date.now(),updatedAt:Date.now()});toast("VOTAÇÃO ARQUIVADA")}
  async function deletePoll(id){const p=getPoll(id);if(!p||!confirm(`Excluir definitivamente a votação “${p.title||id}”?\n\nEssa ação remove também opções, resultado e votos armazenados.`))return;await ref(id).remove();if(editId===id)resetForm();toast("VOTAÇÃO EXCLUÍDA")}
  async function duplicatePoll(id){const p=getPoll(id);if(!p)return;const copy=JSON.parse(JSON.stringify(p));delete copy.votes;delete copy.winnerOptionId;delete copy.winnerTiedOptionIds;delete copy.startedAt;delete copy.endsAt;delete copy.closedAt;delete copy.archivedAt;delete copy.deleteAt;copy.id=uid("POLL");copy.title=`${copy.title||"Votação"} // CÓPIA`;copy.status="draft";copy.createdAt=Date.now();copy.updatedAt=Date.now();await ref(copy.id).set(copy);toast("CÓPIA CRIADA COMO RASCUNHO")}

  function statusBadge(p){if(p.status==="draft")return"RASCUNHO";if(p.status==="active")return p.closeMode==="auto"?"ATIVA // AUTO":"ATIVA // MANUAL";if(p.status==="archived")return"ARQUIVADA";return"ENCERRADA"}
  function pollMeta(p){const opts=optionEntries(p).length;return`${opts} OPÇÕES · ${p.visualMode==="pizza"?"PIZZA":"PADRÃO"} · ${p.closeMode==="auto"?"AUTO":"MANUAL"} · ${fmtDuration(p.durationSeconds)}`}
  function renderLists(){
    const drafts=$("pollDrafts"),active=$("pollActive"),history=$("pollHistory");if(!drafts||!active||!history)return;
    const entries=Object.entries(polls||{}).filter(([k])=>k!=="_init").sort((a,b)=>(Number(b[1]?.createdAt)||0)-(Number(a[1]?.createdAt)||0));
    const ds=entries.filter(([,p])=>p.status==="draft"),as=entries.filter(([,p])=>p.status==="active"),hs=entries.filter(([,p])=>["closed","archived"].includes(p.status));
    drafts.innerHTML=ds.map(([id,p])=>`<article class="pollAdminCard"><div class="pollAdminCardHead"><div><span class="tag">${statusBadge(p)}</span><h3>${esc(p.title)}</h3><small>${esc(pollMeta(p))}</small></div><span>${fmtDate(p.updatedAt)}</span></div><p>${esc(p.description||"Sem descrição.")}</p><div class="actions"><button class="btn gold" onclick="DCX.Polls.edit('${esc(id)}')">EDITAR</button><button class="btn" onclick="DCX.Polls.activate('${esc(id)}')">INICIAR</button><button class="btn" onclick="DCX.Polls.duplicate('${esc(id)}')">DUPLICAR</button><button class="btn red" onclick="DCX.Polls.delete('${esc(id)}')">EXCLUIR</button></div></article>`).join("")||`<div class="dcxEmpty">Nenhum rascunho.</div>`;
    active.innerHTML=as.map(([id,p])=>{const opts=optionEntries(p);return`<article class="pollAdminCard activePoll"><div class="pollAdminCardHead"><div><span class="tag">${statusBadge(p)}</span><h3>${esc(p.title)}</h3><small>${esc(pollMeta(p))}</small></div><b data-poll-countdown="${esc(id)}">${fmtDuration(Math.max(0,Math.ceil((p.endsAt-Date.now())/1000)))}</b></div>${previewCard(p)}<div class="pollCloseRow"><label>VENCEDOR AO ENCERRAR<select id="pollWinner-${esc(id)}"><option value="auto">AUTO // PELOS VOTOS</option><option value="">SEM VENCEDOR</option>${opts.map(o=>`<option value="${esc(o.id)}">${esc(o.label)}</option>`).join("")}</select></label><button class="btn red" onclick="DCX.Polls.closeFromCard('${esc(id)}')">ENCERRAR AGORA</button></div></article>`}).join("")||`<div class="dcxEmpty">Nenhuma votação ativa.</div>`;
    history.innerHTML=hs.map(([id,p])=>{const del=p.deleteAt?Math.max(0,Math.ceil((p.deleteAt-Date.now())/3600000)):null;return`<article class="pollAdminCard historyPoll"><div class="pollAdminCardHead"><div><span class="tag">${statusBadge(p)}</span><h3>${esc(p.title)}</h3><small>ENCERRADA ${fmtDate(p.closedAt)} · ${totalVotes(p)} VOTO(S)</small></div>${p.deleteAt?`<span class="pollPurge">AUTO-DELETE ${del>0?`~${del}h`:"PENDENTE"}</span>`:""}</div>${previewCard(p,{result:true})}<div class="actions">${p.status!=="archived"?`<button class="btn" onclick="DCX.Polls.archive('${esc(id)}')">ARQUIVAR</button>`:""}<button class="btn" onclick="DCX.Polls.duplicate('${esc(id)}')">DUPLICAR</button><button class="btn red" onclick="DCX.Polls.delete('${esc(id)}')">EXCLUIR AGORA</button></div></article>`}).join("")||`<div class="dcxEmpty">Nenhuma votação encerrada.</div>`;
    const d=$("pollCountDraft"),a=$("pollCountActive"),h=$("pollCountHistory");if(d)d.textContent=ds.length;if(a)a.textContent=as.length;if(h)h.textContent=hs.length;
  }

  async function lifecycle(){if(!initialized)return;const now=Date.now();for(const [id,p] of Object.entries(polls||{})){if(id==="_init"||!p)continue;if(p.status==="active"&&p.closeMode==="auto"&&p.endsAt&&now>=Number(p.endsAt))await closePoll(id,"auto",true);if(["closed","archived"].includes(p.status)&&p.retention?.mode==="auto"&&p.deleteAt&&now>=Number(p.deleteAt)){try{await ref(id).remove();console.info("Poll auto-delete",id)}catch(e){console.warn("Poll auto-delete",id,e)}}}}
  function tick(){document.querySelectorAll("[data-poll-countdown]").forEach(el=>{const p=getPoll(el.dataset.pollCountdown);if(!p)return;const sec=Math.max(0,Math.ceil((Number(p.endsAt||0)-Date.now())/1000));el.textContent=sec>0?fmtDuration(sec):(p.closeMode==="manual"?"TEMPO ESGOTADO":"ENCERRANDO…")});lifecycle()}

  function render(){renderLists();renderFormPreview()}
  async function init(){
    ensureNavigation();
    clearTimeout(retryTimer);const r=rt();auth=r?.getFirebaseAuth?.()||null;db=r?.getFirebaseDatabase?.()||null;room=r?.getRoom?.()||new URLSearchParams(location.search).get("room")||window.OPH_CONFIG?.defaultRoom||"FRIA-01";
    if(!auth?.currentUser||!db){retryTimer=setTimeout(init,700);return false}
    if(initialized)return true;base=`rooms/${room}/dcx/polls`;pollRef=db.ref(base);publicPollRef=db.ref(`rooms/${room}/dcx/meta/publicPolls`);pollRef.on("value",s=>{polls=s.val()||{};render();lifecycle();syncPublicPolls()},e=>{console.error("Polls listener",e);toast(`VOTAÇÕES // ${e.code||"ERRO"}`)});initialized=true;
    if(!$("pollOptions")?.children.length)resetForm();clearInterval(tickTimer);tickTimer=setInterval(tick,1000);lifecycle();console.info("VOTAÇÕES V1.2 // KEYMASTER ADMIN + PLAYER VIEW // READY",{room,build:BUILD});return true;
  }

  function bindForm(){const root=$("pollCreator");if(!root)return;root.addEventListener("input",renderFormPreview);root.addEventListener("change",e=>{if(e.target?.id==="pollRetentionMode")syncRetentionUI();renderFormPreview()});if(!$("pollOptions")?.children.length)resetForm()}
  window.DCX.Polls={init,openAdmin,addOption,removeOption,resetForm,saveDraft,startNow,edit:id=>loadForm(getPoll(id),id),activate:activateDraft,closeFromCard,archive:archivePoll,delete:deletePoll,duplicate:duplicatePoll,renderFormPreview};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{ensureNavigation();bindForm();init()},{once:true});else{ensureNavigation();bindForm();init()}
})();
