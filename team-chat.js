window.DCX = window.DCX || {};
(() => {
  'use strict';
  const BUILD='TEAMCHAT-V1';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let db=null, auth=null, room='', playerId='', teamId='', msgRef=null, pollTimer=null, initialized=false;

  function rt(){return window.OPH?.Realtime}
  function identity(){try{return window.DCX?.Player?.getLocalIdentity?.()||null}catch{return null}}
  function credential(id){try{return window.DCX?.Player?.getCredentialData?.(id)||null}catch{return null}}
  function status(text,kind=''){const e=$('teamChatStatus');if(!e)return;e.textContent=text;e.dataset.state=kind}
  function setComposer(enabled,placeholder='Mensagem para sua equipe...'){
    const i=$('teamChannelInput'),b=$('teamChannelSend');
    if(i){i.disabled=!enabled;i.placeholder=placeholder}
    if(b)b.disabled=!enabled;
  }
  function fmt(ts){try{return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(Number(ts)||Date.now()))}catch{return''}}
  function renderEmpty(title,body){const box=$('teamChannelMessages');if(box)box.innerHTML=`<div class="localEmptyState"><b>${esc(title)}</b><small>${esc(body)}</small></div>`}
  function detach(){try{msgRef?.off()}catch{};msgRef=null;teamId='';}
  function senderName(pid){const c=credential(pid);return c?.name||pid||'OPERADOR'}
  function renderMessages(raw){
    const box=$('teamChannelMessages');if(!box)return;
    const rows=Object.entries(raw||{}).map(([id,m])=>({id,...(m||{}) })).sort((a,b)=>(Number(a.createdAt)||0)-(Number(b.createdAt)||0));
    if(!rows.length){renderEmpty('CANAL LIVRE','Nenhuma mensagem enviada por esta equipe ainda.');return}
    box.innerHTML=rows.map(m=>{
      const mine=String(m.senderPlayerId||'')===playerId;
      return `<article class="teamChatMessage ${mine?'mine':''}"><header><b>${esc(senderName(m.senderPlayerId))}</b><span>${esc(fmt(m.createdAt))}</span></header><p>${esc(m.text||'')}</p></article>`;
    }).join('');
    box.scrollTop=box.scrollHeight;
  }
  function attachForTeam(nextTeam){
    if(!db||!room||!nextTeam)return false;
    if(teamId===nextTeam&&msgRef)return true;
    detach();teamId=nextTeam;
    const c=credential(playerId), teamName=c?.teamName||nextTeam, code=c?.teamCode||'EQUIPE';
    if($('teamChatTitle'))$('teamChatTitle').textContent=teamName||'CANAL TÁTICO';
    if($('teamChatTag'))$('teamChatTag').textContent=`COMMS // ${code||'EQUIPE'}`;
    if($('teamChatSubtitle'))$('teamChatSubtitle').textContent='Mensagens visíveis somente para membros desta equipe e para o Keymaster.';
    status('ONLINE','online');setComposer(true);
    msgRef=db.ref(`rooms/${room}/dcx/teamChat/${teamId}/messages`).limitToLast(100);
    msgRef.on('value',s=>renderMessages(s.val()||{}),e=>{console.error('Team chat listener',e);status(e.code||'ERRO','error');setComposer(false,'Sem permissão para este canal');renderEmpty('FALHA AO ABRIR CANAL',e.code||'Permissão negada')});
    console.info('TEAM CHAT // LISTENER OK',{room,teamId,playerId,build:BUILD});
    return true;
  }
  function ensureAttached(){
    const r=rt();const nextDb=r?.getFirebaseDatabase?.()||null,nextAuth=r?.getFirebaseAuth?.()||null,nextRoom=r?.getRoom?.()||'';const id=identity();
    if(!nextDb||!nextAuth?.currentUser||!nextRoom||!id?.playerId){status('OFFLINE','offline');setComposer(false,'Conecte-se à sala primeiro');return false}
    db=nextDb;auth=nextAuth;room=nextRoom;playerId=String(id.playerId);
    const c=credential(playerId);const nextTeam=String(c?.teamId||'');
    if(!nextTeam){detach();status('SEM EQUIPE','idle');setComposer(false,'Você ainda não possui equipe');if($('teamChatTitle'))$('teamChatTitle').textContent='CANAL TÁTICO';if($('teamChatSubtitle'))$('teamChatSubtitle').textContent='O Keymaster precisa alocar seu operador em uma equipe antes de liberar este canal.';renderEmpty('SEM EQUIPE','Entre em uma equipe para usar o canal tático.');return false}
    return attachForTeam(nextTeam);
  }
  async function send(text){
    text=String(text||'').trim().slice(0,1200);if(!text)return false;
    if(!ensureAttached()||!db||!teamId||!playerId){return false}
    const input=$('teamChannelInput'),button=$('teamChannelSend');if(input)input.disabled=true;if(button)button.disabled=true;status('ENVIANDO','busy');
    try{
      const r=db.ref(`rooms/${room}/dcx/teamChat/${teamId}/messages`).push();
      await r.set({senderPlayerId:playerId,text,createdAt:window.firebase.database.ServerValue.TIMESTAMP});
      if(input){input.value='';input.focus()}
      status('ONLINE','online');return true;
    }catch(e){console.error('Team chat send',e,{room,teamId,playerId});status(e.code||'ERRO','error');const t=$('toast');if(t){t.textContent=`CANAL DA EQUIPE // ${e.code||'ERRO'}`;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}return false}
    finally{if(input)input.disabled=false;if(button)button.disabled=false}
  }
  function open(){const panel=$('dcxTeamChannelPanel');if(panel){panel.classList.remove('hidden');panel.setAttribute('aria-hidden','false')}ensureAttached();setTimeout(()=>$('teamChannelInput')?.focus(),80)}
  function bind(){
    $('dcxOpenTeamChannel')?.addEventListener('click',open);
    $('teamChannelForm')?.addEventListener('submit',e=>{e.preventDefault();send($('teamChannelInput')?.value)});
    clearInterval(pollTimer);pollTimer=setInterval(()=>{const p=$('dcxTeamChannelPanel');if(p&&!p.classList.contains('hidden'))ensureAttached()},2500);
  }
  function init(){if(initialized)return;initialized=true;bind();ensureAttached();console.info('[DCX OS] TEAM CHAT V1 READY')}
  window.DCX.TeamChat={init,open,send,ensureAttached,detach};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
