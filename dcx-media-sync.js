(()=>{
'use strict';
const ADMIN_UID='luVVp67PW7c53fs6dstTDNE46Nz1';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const role=()=>/keymaster\.html$/i.test(location.pathname)?'host':'player';
const roomFallback=()=>new URLSearchParams(location.search).get('room')||localStorage.getItem('oph-room')||window.OPH_CONFIG?.defaultRoom||'FRIA-01';
let ctx=null,publicCreds={},npcCreds={},avatarUrls={},handouts={},handoutAcks={},handoutRefs=[],ackRefs=new Map(),teamId='',initTimer=null,credRefs=[],hostHandouts={},hostHandoutAcks={},hostHandoutRef=null,hostAckRef=null;
function identity(){
  try{const room=roomFallback(),d=JSON.parse(localStorage.getItem('oph-yumiya-identity-'+room)||'null');if(d?.playerId)return{playerId:d.playerId,name:d.name||localStorage.getItem('oph-name')||'AGENTE',room}}catch{}
  const p=window.DCX?.Player?.getLocalIdentity?.();
  return{playerId:p?.playerId||localStorage.getItem('oph-yumiya-player-id')||'',name:p?.name||localStorage.getItem('oph-name')||'AGENTE',room:p?.room||roomFallback()};
}
function context(){
  try{const rt=window.OPH?.Realtime,auth=rt?.getFirebaseAuth?.(),db=rt?.getFirebaseDatabase?.();if(!auth?.currentUser||!db)return null;return{auth,db,uid:auth.currentUser.uid,room:rt?.getRoom?.()||roomFallback()}}catch{return null}
}
function readFileDataUrl(file){return new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok(String(r.result||''));r.onerror=()=>fail(new Error('Falha ao ler arquivo.'));r.readAsDataURL(file)})}
function imageFromFile(file){return new Promise((ok,fail)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>{URL.revokeObjectURL(u);ok(i)};i.onerror=()=>{URL.revokeObjectURL(u);fail(new Error('Não foi possível ler a imagem.'))};i.src=u})}
async function compressImageDataUrl(file,{maxChars,maxW,maxH,startQ=.84,minQ=.42}={}){
  if(!file||!/^image\//i.test(file.type))throw new Error('Selecione uma imagem válida.');
  if(file.size>12*1024*1024)throw new Error('Imagem muito grande. Máximo 12 MB antes da compressão.');
  const img=await imageFromFile(file);let scale=Math.min(1,maxW/img.width,maxH/img.height),q=startQ;
  for(let attempt=0;attempt<16;attempt++){
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#080b10';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);const data=c.toDataURL('image/jpeg',q);
    if(data.length<=maxChars)return{dataUrl:data,width:w,height:h,sizeChars:data.length};
    if(q>minQ+.03)q-=.08;else{scale*=.84;q=Math.min(startQ,.78)}
  }
  throw new Error('Não foi possível comprimir a imagem o suficiente para o RTDB. Tente uma imagem menor.');
}
async function avatarData(file){return compressImageDataUrl(file,{maxChars:210000,maxW:520,maxH:680,startQ:.82,minQ:.44})}
async function handoutImageData(file){return compressImageDataUrl(file,{maxChars:710000,maxW:1400,maxH:1400,startQ:.82,minQ:.42})}
async function textData(file){
  if(file.size>440*1024)throw new Error('Arquivo de texto muito grande para o modo gratuito (máx. ~440 KB). Use LINK EXTERNO.');
  const data=await readFileDataUrl(file);if(data.length>710000)throw new Error('Arquivo excede o limite do RTDB. Use LINK EXTERNO.');return{dataUrl:data,sizeChars:data.length};
}
function validateExternalUrl(raw){const s=String(raw||'').trim();if(!s)return'';let u;try{u=new URL(s)}catch{throw new Error('LINK EXTERNO inválido. Use uma URL completa https://...')};if(!/^https?:$/.test(u.protocol))throw new Error('O link deve começar com http:// ou https://');if(s.length>1900)throw new Error('Link externo muito longo.');return s}
function emitAvatar(id){window.dispatchEvent(new CustomEvent('dcx-avatar-updated',{detail:{playerId:id,url:getAvatarUrl(id)}}))}
function resolveCredMap(map,type){
  const seen=new Set();for(const [id,v] of Object.entries(map||{})){seen.add(id);const u=String(v?.avatarDataUrl||v?.photoDataUrl||'');const sig=`${v?.updatedAt||0}|${u.length}|${u.slice(0,32)}`;if(!u){if(avatarUrls[id]){delete avatarUrls[id];emitAvatar(id)};continue}if(avatarUrls[id]?.sig===sig)continue;avatarUrls[id]={sig,url:u,type};emitAvatar(id)}
  for(const id of Object.keys(avatarUrls)){if(avatarUrls[id]?.type===type&&!seen.has(id)){delete avatarUrls[id];emitAvatar(id)}}
}
function getAvatarUrl(id){return avatarUrls[String(id||'')]?.url||''}
function credentialMeta(id){return publicCreds[id]||npcCreds[id]||null}
function cleanupCredentialListeners(){credRefs.forEach(r=>{try{r.off()}catch{}});credRefs=[]}
async function startCredentialListeners(){
  if(!ctx)return;cleanupCredentialListeners();const base=ctx.db.ref(`rooms/${ctx.room}/dcx/credentials`),a=base.child('public'),b=base.child('npcPublic');
  a.on('value',s=>{publicCreds=s.val()||{};resolveCredMap(publicCreds,'player')},e=>console.warn('[DCX MEDIA] credentials/public',e?.code||e));
  b.on('value',s=>{npcCreds=s.val()||{};resolveCredMap(npcCreds,'npc')},e=>console.warn('[DCX MEDIA] credentials/npcPublic',e?.code||e));credRefs.push(a,b)
}
async function uploadOwnAvatar(file){
  ctx=context();if(!ctx)throw new Error('Conecte o Player antes de alterar a foto.');const i=identity();if(!i.playerId)throw new Error('P-ID ainda não disponível.');const pic=await avatarData(file);
  await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/public/${i.playerId}`).update({playerId:i.playerId,ownerUid:ctx.uid,avatarDataUrl:pic.dataUrl,active:true,updatedAt:firebase.database.ServerValue.TIMESTAMP});return pic
}
async function removeOwnAvatar(){ctx=context();const i=identity();if(!ctx||!i.playerId)return;await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/public/${i.playerId}/avatarDataUrl`).remove();await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/public/${i.playerId}`).update({updatedAt:firebase.database.ServerValue.TIMESTAMP})}
async function uploadAdminAvatar(id,type,file){
  ctx=context();if(!ctx||ctx.uid!==ADMIN_UID)throw new Error('Somente o Keymaster pode alterar esta credencial.');const npc=type==='npc'||String(id).startsWith('NPC-'),branch=npc?'npcPublic':'public',pic=await avatarData(file);
  await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/${branch}/${id}`).update({id,playerId:npc?null:id,ownerUid:ADMIN_UID,avatarDataUrl:pic.dataUrl,active:true,updatedAt:firebase.database.ServerValue.TIMESTAMP});return pic
}
async function removeAdminAvatar(id,type){ctx=context();if(!ctx||ctx.uid!==ADMIN_UID)throw new Error('Somente o Keymaster pode remover esta foto.');const npc=type==='npc'||String(id).startsWith('NPC-'),branch=npc?'npcPublic':'public';await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/${branch}/${id}/avatarDataUrl`).remove();await ctx.db.ref(`rooms/${ctx.room}/dcx/credentials/${branch}/${id}`).update({updatedAt:firebase.database.ServerValue.TIMESTAMP})}
function snapshot(){return window.DCX?.Admin?.getSnapshot?.()||{operators:{},teams:{}}}
function resolvePlayer(raw){raw=String(raw||'').trim();const ops=snapshot().operators||{};if(ops[raw])return raw;const q=raw.toLowerCase();return Object.entries(ops).find(([id,o])=>String(o?.identity?.name||o?.name||id).toLowerCase()===q)?.[0]||''}
function resolveTeam(raw){raw=String(raw||'').trim();const t=snapshot().teams||{};if(t[raw])return raw;const q=raw.toLowerCase();return Object.entries(t).find(([id,v])=>[v?.name,v?.codename,id].some(x=>String(x||'').toLowerCase()===q))?.[0]||''}
async function prepareInlineFile(file){
  if(!file)return null;const type=String(file.type||'').toLowerCase(),name=String(file.name||'arquivo');
  if(/^image\//.test(type)){const x=await handoutImageData(file);return{dataUrl:x.dataUrl,fileName:name,fileType:'image/jpeg',fileSize:file.size,storedMode:'rtdb-image'}}
  if(type.startsWith('text/')||/\.(txt|md|json)$/i.test(name)){const x=await textData(file);return{dataUrl:x.dataUrl,fileName:name,fileType:type||'text/plain',fileSize:file.size,storedMode:'rtdb-text'}}
  throw new Error('Neste modo gratuito, apenas imagens e TXT/MD/JSON pequenos podem ser anexados. Para PDF/ZIP/outros arquivos, use LINK EXTERNO.')
}
async function sendHandoutFromForm(){
  ctx=context();if(!ctx||ctx.uid!==ADMIN_UID)throw new Error('Keymaster não autenticado.');
  const title=String($('kmHandoutTitle')?.value||'').trim(),description=String($('kmHandoutDescription')?.value||'').trim(),textContent=String($('kmHandoutBody')?.value||'').trim(),type=$('kmHandoutTargetType')?.value||'all',raw=String($('kmHandoutTarget')?.value||'').trim(),file=$('kmHandoutFile')?.files?.[0],externalUrl=validateExternalUrl($('kmHandoutExternalUrl')?.value||'');
  if(!title)throw new Error('Informe um título.');
  if(!file&&!externalUrl&&!textContent&&!description)throw new Error('Escreva o conteúdo/descrição do Handout ou anexe um arquivo/link.');
  if(file&&externalUrl)throw new Error('Use arquivo OU link externo, não os dois ao mesmo tempo. O texto pode acompanhar qualquer um deles.');
  let targetId='all';if(type==='player'){targetId=resolvePlayer(raw);if(!targetId)throw new Error('Player não encontrado. Use P-ID ou nome exato.')}if(type==='team'){targetId=resolveTeam(raw);if(!targetId)throw new Error('Equipe não encontrada. Use ID, nome ou codinome exato.')}
  const id=`H-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,inline=file?await prepareInlineFile(file):null,rawBody=textContent||(!file&&!externalUrl?description:'');
  const meta={id,title,description,targetType:type,targetId,fileName:inline?.fileName||(externalUrl?'LINK EXTERNO':rawBody?'TEXTO INTERNO':'HANDOUT'),fileType:inline?.fileType||(externalUrl?'text/uri-list':rawBody?'text/plain':''),fileSize:inline?.fileSize||0,dataUrl:inline?.dataUrl||null,textContent:rawBody||null,externalUrl:externalUrl||null,storedMode:inline?.storedMode||(externalUrl?'external-link':rawBody?'rtdb-raw-text':'metadata'),createdAt:firebase.database.ServerValue.TIMESTAMP,createdBy:'KEYMASTER',archived:false};
  const dest=type==='all'?`handouts/public/${id}`:type==='player'?`handouts/players/${targetId}/${id}`:`handouts/teams/${targetId}/${id}`;await ctx.db.ref(`rooms/${ctx.room}/dcx/${dest}`).set(meta);return meta
}
function decodeTextDataUrl(dataUrl){
  try{const [head,body='']=String(dataUrl||'').split(',',2);if(!/^data:/i.test(head))return'';if(/;base64/i.test(head)){const bin=atob(body),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder('utf-8').decode(bytes)}return decodeURIComponent(body)}catch{return''}
}
function ensureHandoutReader(){
  let ov=$('dcxHandoutReaderOverlay');if(ov)return ov;
  ov=document.createElement('div');ov.id='dcxHandoutReaderOverlay';ov.className='dcxHandoutReaderOverlay hidden';ov.innerHTML=`<section class="dcxHandoutReader" role="dialog" aria-modal="true"><header><div><small id="dcxHandoutReaderEyebrow">DCX // HANDOUT</small><h2 id="dcxHandoutReaderTitle">HANDOUT</h2></div><button class="chatIconBtn" id="dcxHandoutReaderClose" type="button">×</button></header><div class="dcxHandoutReaderMeta" id="dcxHandoutReaderMeta"></div><div class="dcxHandoutReaderBody" id="dcxHandoutReaderBody"></div><footer id="dcxHandoutReaderFooter"></footer></section>`;document.body.appendChild(ov);
  const close=()=>ov.classList.add('hidden');$('dcxHandoutReaderClose').onclick=close;ov.addEventListener('click',e=>{if(e.target===ov)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.classList.contains('hidden'))close()});return ov
}
function makeDownload(dataUrl,fileName){try{const a=document.createElement('a');a.href=dataUrl;a.download=fileName||'handout';document.body.appendChild(a);a.click();a.remove()}catch{}}
async function showHandoutReader(h,{ackView=false}={}){
  if(!h)return;const ov=ensureHandoutReader();$('dcxHandoutReaderTitle').textContent=h.title||'HANDOUT';$('dcxHandoutReaderEyebrow').textContent=`DCX // ${h.targetType==='team'?'EQUIPE':h.targetType==='player'?'DIRETO':'GERAL'} // ${h.archived?'ARQUIVADO':'ATIVO'}`;$('dcxHandoutReaderMeta').innerHTML=`<span>${esc(fmtDate(h.createdAt))}</span><span>${esc(h.fileName||'SEM ANEXO')}</span><span>${esc(h.storedMode||'texto')}</span>`;
  const body=$('dcxHandoutReaderBody'),footer=$('dcxHandoutReaderFooter');body.innerHTML='';footer.innerHTML='';
  if(h.description){const d=document.createElement('div');d.className='dcxHandoutReaderDescription';d.innerHTML=`<small>DESCRIÇÃO</small><p>${esc(h.description).replace(/\n/g,'<br>')}</p>`;body.appendChild(d)}
  if(h.textContent){const sec=document.createElement('section');sec.className='dcxHandoutReaderText';sec.innerHTML=`<small>CONTEÚDO</small><pre>${esc(h.textContent)}</pre>`;body.appendChild(sec)}
  if(h.dataUrl&&String(h.fileType||'').startsWith('image/')){const img=document.createElement('img');img.className='dcxHandoutReaderImage';img.src=h.dataUrl;img.alt=h.title||'Handout';body.appendChild(img);const b=document.createElement('button');b.className='btn';b.textContent='BAIXAR IMAGEM';b.onclick=()=>makeDownload(h.dataUrl,h.fileName||'handout.jpg');footer.appendChild(b)}
  else if(h.dataUrl){const txt=decodeTextDataUrl(h.dataUrl);if(txt){const sec=document.createElement('section');sec.className='dcxHandoutReaderText';sec.innerHTML=`<small>ARQUIVO DE TEXTO</small><pre>${esc(txt)}</pre>`;body.appendChild(sec)}const b=document.createElement('button');b.className='btn';b.textContent='BAIXAR ARQUIVO';b.onclick=()=>makeDownload(h.dataUrl,h.fileName||'handout.txt');footer.appendChild(b)}
  if(h.externalUrl){const a=document.createElement('a');a.className='btn gold';a.href=h.externalUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent='ABRIR LINK EXTERNO';footer.appendChild(a)}
  if(!h.description&&!h.textContent&&!h.dataUrl&&!h.externalUrl)body.innerHTML='<div class="localEmptyState"><b>HANDOUT SEM CONTEÚDO</b><small>Somente os metadados deste registro estão disponíveis.</small></div>';
  ov.classList.remove('hidden');
  if(ackView&&role()==='player'){const panel=$('dcxHandoutsPanel');if(panel?.dataset.handoutFilter==='new'){panel.dataset.handoutFilter='all';document.querySelectorAll('#dcxHandoutFilters [data-hfilter]').forEach(x=>x.classList.toggle('active',x.dataset.hfilter==='all'))}try{await ack(h.id,{viewedAt:firebase.database.ServerValue.TIMESTAMP})}catch(e){console.warn('[DCX HANDOUT] ack viewed',e)}}
}
function flattenHostHandouts(raw){const out={};for(const [id,h] of Object.entries(raw?.public||{}))out[id]=Object.assign({},h,{id:h?.id||id,_path:`handouts/public/${id}`,_scope:'GERAL',_scopeId:'all'});for(const [pid,items] of Object.entries(raw?.players||{}))for(const [id,h] of Object.entries(items||{}))out[id]=Object.assign({},h,{id:h?.id||id,_path:`handouts/players/${pid}/${id}`,_scope:'PLAYER',_scopeId:pid});for(const [tid,items] of Object.entries(raw?.teams||{}))for(const [id,h] of Object.entries(items||{}))out[id]=Object.assign({},h,{id:h?.id||id,_path:`handouts/teams/${tid}/${id}`,_scope:'EQUIPE',_scopeId:tid});return out}
function hostAckCounts(id){const m=hostHandoutAcks[id]||{},vals=Object.values(m);return{viewed:vals.filter(x=>x?.viewedAt).length,confirmed:vals.filter(x=>x?.confirmedAt).length}}
function renderHostHandoutHistory(){
  if(role()!=='host')return;const box=$('kmHandoutHistoryList');if(!box)return;const filter=$('kmHandoutHistoryFilter')?.value||'active';let arr=Object.values(hostHandouts).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0));if(filter==='active')arr=arr.filter(h=>!h.archived);if(filter==='archived')arr=arr.filter(h=>!!h.archived);if(!arr.length){box.innerHTML='<div class="dcxEmpty">Nenhum Handout neste filtro.</div>';return}
  box.innerHTML=arr.map(h=>{const c=hostAckCounts(h.id);return`<article class="kmHandoutHistoryItem ${h.archived?'archived':''}"><div class="kmHandoutHistoryMain"><span>${esc(h._scope)} // ${esc(h._scopeId)} // ${h.archived?'ARQUIVADO':'ATIVO'}</span><b>${esc(h.title||'HANDOUT')}</b><p>${esc(h.description||h.textContent||'Sem descrição.').slice(0,280)}</p><small>${esc(fmtDate(h.createdAt))} · ${c.viewed} visualizado(s) · ${c.confirmed} confirmado(s)</small></div><div class="kmHandoutHistoryActions"><button class="btn gold" data-kh-open="${esc(h.id)}" type="button">ABRIR</button><button class="btn" data-kh-archive="${esc(h.id)}" type="button">${h.archived?'RESTAURAR':'ARQUIVAR'}</button><button class="btn danger" data-kh-delete="${esc(h.id)}" type="button">EXCLUIR</button></div></article>`}).join('');
  box.querySelectorAll('[data-kh-open]').forEach(b=>b.onclick=()=>showHandoutReader(hostHandouts[b.dataset.khOpen]));box.querySelectorAll('[data-kh-archive]').forEach(b=>b.onclick=()=>setHostHandoutArchived(b.dataset.khArchive));box.querySelectorAll('[data-kh-delete]').forEach(b=>b.onclick=()=>deleteHostHandout(b.dataset.khDelete))
}
async function setHostHandoutArchived(id){const h=hostHandouts[id];if(!ctx||!h)return;try{await ctx.db.ref(`rooms/${ctx.room}/dcx/${h._path}`).update({archived:!h.archived,archivedAt:!h.archived?firebase.database.ServerValue.TIMESTAMP:null})}catch(e){alert('Falha ao arquivar Handout: '+(e?.message||e))}}
async function deleteHostHandout(id){const h=hostHandouts[id];if(!ctx||!h)return;if(!confirm(`Excluir definitivamente o Handout "${h.title||id}"?`))return;try{const u={};u[`rooms/${ctx.room}/dcx/${h._path}`]=null;u[`rooms/${ctx.room}/dcx/handoutAcks/${id}`]=null;await ctx.db.ref().update(u)}catch(e){alert('Falha ao excluir Handout: '+(e?.message||e))}}
function exportHostHandoutHistory(){const clean=Object.values(hostHandouts).map(({dataUrl,...h})=>Object.assign({},h,{hasInlineData:!!dataUrl}));const blob=new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`dcx-handouts-${ctx?.room||'sala'}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function attachHostHandoutHistory(){if(role()!=='host'||!ctx)return;if(hostHandoutRef)try{hostHandoutRef.off()}catch{};if(hostAckRef)try{hostAckRef.off()}catch{};hostHandoutRef=ctx.db.ref(`rooms/${ctx.room}/dcx/handouts`);hostAckRef=ctx.db.ref(`rooms/${ctx.room}/dcx/handoutAcks`);hostHandoutRef.on('value',s=>{hostHandouts=flattenHostHandouts(s.val()||{});renderHostHandoutHistory()},e=>console.warn('[DCX HANDOUT HISTORY]',e));hostAckRef.on('value',s=>{hostHandoutAcks=s.val()||{};renderHostHandoutHistory()},e=>console.warn('[DCX HANDOUT ACK HISTORY]',e));$('kmHandoutHistoryFilter')?.addEventListener('change',renderHostHandoutHistory);$('kmHandoutExportHistory')?.addEventListener('click',exportHostHandoutHistory)}

function fmtSize(n){n=Number(n)||0;if(!n)return'LINK';if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
function fmtDate(ts){try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(Number(ts)||Date.now()))}catch{return''}}
function cleanupHandoutRefs(){handoutRefs.forEach(r=>{try{r.off()}catch{}});handoutRefs=[];for(const r of ackRefs.values())try{r.off()}catch{};ackRefs.clear()}
function mergeHandoutSource(kind,obj){for(const k of Object.keys(handouts))if(handouts[k]._source===kind)delete handouts[k];for(const [id,v] of Object.entries(obj||{}))handouts[id]=Object.assign({},v,{id:v?.id||id,_source:kind});bindAckRefs();renderHandouts()}
function bindAckRefs(){if(!ctx)return;const pid=identity().playerId;if(!pid)return;for(const id of Object.keys(handouts)){if(ackRefs.has(id))continue;const r=ctx.db.ref(`rooms/${ctx.room}/dcx/handoutAcks/${id}/${pid}`);r.on('value',s=>{handoutAcks[id]=s.val()||{};renderHandouts()});ackRefs.set(id,r)}}
function currentTeam(){const i=identity();return window.DCX?.Player?.getCredentialData?.(i.playerId)?.teamId||''}
function attachPlayerHandouts(){
  if(role()!=='player'||!ctx)return;const pid=identity().playerId;if(!pid)return;const nt=currentTeam();if(handoutRefs.length&&nt===teamId)return;cleanupHandoutRefs();handouts={};handoutAcks={};teamId=nt;
  const base=ctx.db.ref(`rooms/${ctx.room}/dcx/handouts`),r1=base.child('public'),r2=base.child(`players/${pid}`);r1.on('value',s=>mergeHandoutSource('public',s.val()||{}),e=>handoutError(e));r2.on('value',s=>mergeHandoutSource('player',s.val()||{}),e=>handoutError(e));handoutRefs.push(r1,r2);if(teamId){const r3=base.child(`teams/${teamId}`);r3.on('value',s=>mergeHandoutSource('team',s.val()||{}),e=>handoutError(e));handoutRefs.push(r3)}renderHandouts()
}
function handoutError(e){console.error('[DCX HANDOUT]',e);const b=$('dcxHandoutStatus');if(b){b.textContent=String(e?.code||'ERRO').toUpperCase();b.classList.add('error')}}
function handoutList(){return Object.values(handouts).filter(h=>!h.archived).sort((a,b)=>(Number(b.createdAt)||0)-(Number(a.createdAt)||0))}
function renderHandouts(){
  if(role()!=='player')return;const panel=$('dcxHandoutsPanel');if(!panel)return;let box=$('dcxHandoutRuntime');if(!box){const content=panel.querySelector('.dcxLocalPanelContent');if(!content)return;content.innerHTML=`<div class="localModuleHero"><div><span class="tag">PLAYER // CAIXA DE DOCUMENTOS</span><h2>ARQUIVOS DA OPERAÇÃO</h2><p>Handouts publicados pelo Keymaster para você, sua equipe ou toda a operação.</p></div><span class="localOnlyPill" id="dcxHandoutStatus">ONLINE // RTDB</span></div><div class="localToolbar" id="dcxHandoutFilters"><button class="btn active" data-hfilter="all" type="button">TODOS</button><button class="btn" data-hfilter="new" type="button">NOVOS</button><button class="btn" data-hfilter="confirmed" type="button">CONFIRMADOS</button></div><div id="dcxHandoutRuntime"></div>`;box=$('dcxHandoutRuntime');$('dcxHandoutFilters')?.addEventListener('click',e=>{const b=e.target.closest('[data-hfilter]');if(!b)return;panel.dataset.handoutFilter=b.dataset.hfilter;document.querySelectorAll('#dcxHandoutFilters [data-hfilter]').forEach(x=>x.classList.toggle('active',x===b));renderHandouts()})}
  const filter=panel.dataset.handoutFilter||'all',all=handoutList(),arr=all.filter(h=>filter==='all'||filter==='new'?!handoutAcks[h.id]?.viewedAt:filter==='confirmed'?!!handoutAcks[h.id]?.confirmedAt:true),newCount=all.filter(h=>!handoutAcks[h.id]?.viewedAt).length,state=$('dcxOpenHandouts')?.querySelector('.dcxModuleState');if(state)state.textContent=newCount?`${newCount} NOVO${newCount===1?'':'S'}`:'ABRIR';if(!arr.length){box.innerHTML=`<div class="localEmptyState"><b>${filter==='new'?'NENHUM HANDOUT NOVO':filter==='confirmed'?'NENHUM HANDOUT CONFIRMADO':'NENHUM HANDOUT RECEBIDO'}</b><small>Os documentos publicados pelo Keymaster aparecerão aqui.</small></div>`;return}
  box.innerHTML=`<div class="dcxHandoutList">${arr.map(h=>{const a=handoutAcks[h.id]||{},status=a.confirmedAt?'CONFIRMADO':a.viewedAt?'VISUALIZADO':'NOVO',kind=h.externalUrl?'LINK':h.storedMode==='rtdb-text'?'TEXTO':'IMAGEM';return`<article class="dcxHandoutItem ${status.toLowerCase()}"><div class="dcxHandoutIcon">▤</div><div class="dcxHandoutMeta"><span>${esc(h.targetType==='team'?'EQUIPE':h.targetType==='player'?'DIRETO':'GERAL')} // ${esc(status)} // ${esc(kind)}</span><b>${esc(h.title||'HANDOUT')}</b><p>${esc(h.description||'Sem descrição.')}</p><small>${esc(h.fileName||'HANDOUT')} · ${esc(fmtSize(h.fileSize))} · ${esc(fmtDate(h.createdAt))}</small></div><div class="dcxHandoutActions"><button class="btn gold" data-handout-open="${esc(h.id)}" type="button">ABRIR</button>${a.confirmedAt?'':`<button class="btn" data-handout-confirm="${esc(h.id)}" type="button">CONFIRMAR</button>`}</div></article>`}).join('')}</div>`;box.querySelectorAll('[data-handout-open]').forEach(b=>b.onclick=()=>openHandout(b.dataset.handoutOpen));box.querySelectorAll('[data-handout-confirm]').forEach(b=>b.onclick=()=>confirmHandout(b.dataset.handoutConfirm))
}
async function ack(id,patch){ctx=context();const pid=identity().playerId;if(!ctx||!pid)return;return ctx.db.ref(`rooms/${ctx.room}/dcx/handoutAcks/${id}/${pid}`).update(Object.assign({},patch,{playerId:pid,updatedAt:firebase.database.ServerValue.TIMESTAMP}))}
function dataUrlToObjectUrl(dataUrl){const [head,body]=String(dataUrl||'').split(',',2);if(!head||body==null)throw new Error('Handout inválido.');const mime=(head.match(/^data:([^;,]+)/)||[])[1]||'application/octet-stream',base64=/;base64/i.test(head),bin=base64?atob(body):decodeURIComponent(body),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return URL.createObjectURL(new Blob([arr],{type:mime}))}
async function openHandout(id){const h=handouts[id];if(!h)return;try{await showHandoutReader(h,{ackView:true})}catch(e){alert('Falha ao abrir Handout: '+(e?.message||e))}}
async function confirmHandout(id){try{await ack(id,{viewedAt:handoutAcks[id]?.viewedAt||firebase.database.ServerValue.TIMESTAMP,confirmedAt:firebase.database.ServerValue.TIMESTAMP})}catch(e){alert('Falha ao confirmar Handout: '+(e?.message||e))}}
function bindKeymasterHandout(){
  if(role()!=='host')return;const btn=$('kmHandoutSend');if(!btn||btn.dataset.noStorageBound==='2')return;btn.dataset.noStorageBound='2';btn.disabled=false;btn.classList.add('kmHandoutSendLive');btn.innerHTML='<b>ENVIAR AOS JOGADORES</b><small>TEXTO / IMAGEM / LINK // RTDB</small>';btn.title='Enviar texto puro, imagem leve ou link externo pelo RTDB';btn.addEventListener('click',async()=>{if(btn.disabled)return;btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<b>ENVIANDO...</b><small>RTDB</small>';try{const h=await sendHandoutFromForm();alert(`Handout enviado: ${h.title}`);$('kmHandoutClear')?.click();if($('kmHandoutExternalUrl'))$('kmHandoutExternalUrl').value='';if($('kmHandoutBody'))$('kmHandoutBody').value=''}catch(e){console.error(e);alert('Falha ao enviar Handout: '+(e?.message||e))}finally{btn.disabled=false;btn.innerHTML=old}});$('kmHandoutClear')?.addEventListener('click',()=>{if($('kmHandoutBody'))$('kmHandoutBody').value='';if($('kmHandoutExternalUrl'))$('kmHandoutExternalUrl').value=''})
}
async function boot(){ctx=context();if(!ctx)return false;await startCredentialListeners();if(role()==='player')attachPlayerHandouts();else{bindKeymasterHandout();attachHostHandoutHistory()}return true}
function tick(){const c=context();if(!c)return;if(!ctx||ctx.uid!==c.uid||ctx.room!==c.room){ctx=c;startCredentialListeners();if(role()==='player')attachPlayerHandouts();else{bindKeymasterHandout();attachHostHandoutHistory()}}else if(role()==='player'){const t=currentTeam();if(t!==teamId)attachPlayerHandouts()}}
window.DCX=window.DCX||{};window.DCX.Media={getAvatarUrl,credentialMeta,uploadOwnAvatar,removeOwnAvatar,uploadAdminAvatar,removeAdminAvatar,sendHandoutFromForm,refreshHandouts:attachPlayerHandouts,showHandoutReader,refreshHandoutHistory:attachHostHandoutHistory};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{boot();initTimer=setInterval(tick,1800)},{once:true});else{boot();initTimer=setInterval(tick,1800)}
})();
