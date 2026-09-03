(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const STORE='dcx-player-local-notifications-v1';
  let notices=[];
  let baselines={yumiya:null,polls:null};
  function read(){try{const v=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(v)?v.slice(0,80):[]}catch{return[]}}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(notices.slice(0,80)))}catch{}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function fmt(ts){try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ts))}catch{return''}}
  function panel(id,force){const el=$(id);if(!el)return;const open=typeof force==='boolean'?force:el.classList.contains('hidden');document.querySelectorAll('.dcxLocalPanel').forEach(p=>{if(p!==el){p.classList.add('hidden');p.setAttribute('aria-hidden','true')}});el.classList.toggle('hidden',!open);el.setAttribute('aria-hidden',String(!open))}
  function addNotice(type,title,body){
    const now=Date.now();
    const same=notices[0]&&notices[0].type===type&&notices[0].title===title&&now-notices[0].ts<4000;
    if(same)return;
    notices.unshift({id:`N-${now}-${Math.random().toString(36).slice(2,6)}`,type,title,body,ts:now});
    notices=notices.slice(0,80);save();render();
  }
  function render(){
    const box=$('localNotificationList');if(!box)return;
    if(!notices.length){box.innerHTML='<div class="localEmptyState"><b>NENHUMA NOTIFICAÇÃO LOCAL</b><small>Novas mensagens da Yumiya e votações detectadas por este terminal aparecerão aqui.</small></div>';return}
    box.innerHTML=notices.map(n=>`<article class="localNotice ${esc(n.type)}"><span>${n.type==='yumiya'?'YK':n.type==='poll'?'✓':'!'}</span><div><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${fmt(n.ts)}</small></div></article>`).join('');
  }
  function num(id){const e=$(id);return Math.max(0,parseInt(e?.textContent||'0',10)||0)}
  function observeBadge(id,key,cb){const e=$(id);if(!e)return;baselines[key]=num(id);new MutationObserver(()=>{const n=num(id),prev=baselines[key];if(prev!==null&&n>prev)cb(n,prev);baselines[key]=n}).observe(e,{subtree:true,childList:true,attributes:true,characterData:true})}
  function bind(){
    $('dcxOpenHandouts')?.addEventListener('click',()=>panel('dcxHandoutsPanel',true));
    $('dcxOpenNotifications')?.addEventListener('click',()=>panel('dcxNotificationsPanel',true));
    $('dcxOpenTeamChannel')?.addEventListener('click',()=>panel('dcxTeamChannelPanel',true));
    document.querySelectorAll('[data-close-local-panel]').forEach(b=>b.addEventListener('click',()=>panel(b.dataset.closeLocalPanel,false)));
    $('clearLocalNotifications')?.addEventListener('click',()=>{if(!notices.length||confirm('Limpar o histórico local de notificações deste navegador?')){notices=[];save();render()}});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.dcxLocalPanel:not(.hidden)').forEach(p=>panel(p.id,false))});
    observeBadge('yumiyaUnread','yumiya',(n)=>addNotice('yumiya','NOVA MENSAGEM // YUMIYA',`${n} mensagem${n===1?'':'s'} não lida${n===1?'':'s'} no canal remoto.`));
    observeBadge('dcxPollsCardCount','poll',(n)=>addNotice('poll','NOVA VOTAÇÃO DISPONÍVEL',`${n} votação${n===1?'':'ões'} ativa${n===1?'':'s'} detectada${n===1?'':'s'} pelo terminal.`));
  }
  function init(){notices=read();render();bind();console.info('[DCX OS] LOCAL MODULES V1 // HANDOUTS + NOTIFICATIONS + TEAM CHANNEL UI READY')}
  window.DCX=window.DCX||{};window.DCX.LocalModules={panel,addNotice};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
