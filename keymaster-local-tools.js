(()=>{
  'use strict';
  const STORE='dcx-km-handout-drafts-v1';
  const $=id=>document.getElementById(id);
  let queue=[];let currentFile=null;
  function read(){try{const a=JSON.parse(localStorage.getItem(STORE)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(queue.slice(0,60)))}catch{}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function size(n){n=Number(n)||0;if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
  function renderFile(){const box=$('kmSelectedFile');if(!box)return;if(!currentFile){box.innerHTML='<b>NENHUM ARQUIVO SELECIONADO</b><small>O navegador pode pré-visualizar o arquivo nesta sessão, mas os bytes ainda não serão enviados.</small>';return}box.innerHTML=`<b>${esc(currentFile.name)}</b><small>${esc(currentFile.type||'TIPO DESCONHECIDO')} · ${size(currentFile.size)} · arquivo mantido somente nesta sessão</small>`}
  function renderQueue(){const box=$('kmHandoutQueueList');if(!box)return;if(!queue.length){box.innerHTML='<div class="dcxEmpty big">Nenhum pacote preparado ainda.</div>';return}box.innerHTML=queue.map((q,i)=>`<article class="kmHandoutDraft"><div><span>${esc(q.targetTypeLabel)}</span><b>${esc(q.title)}</b><p>${esc(q.description||'Sem descrição.')}</p><small>${esc(q.fileName||'SEM ARQUIVO')} ${q.fileSize?`· ${size(q.fileSize)}`:''}${q.fileName?' · RESELECIONE O ARQUIVO ANTES DO ENVIO REAL':''}</small></div><button class="btn red" type="button" data-remove-handout="${i}">REMOVER</button></article>`).join('');box.querySelectorAll('[data-remove-handout]').forEach(b=>b.addEventListener('click',()=>{queue.splice(Number(b.dataset.removeHandout),1);save();renderQueue()}))}
  function clearForm(){['kmHandoutTitle','kmHandoutDescription','kmHandoutTarget'].forEach(id=>{if($(id))$(id).value=''});if($('kmHandoutTargetType'))$('kmHandoutTargetType').value='all';if($('kmHandoutFile'))$('kmHandoutFile').value='';currentFile=null;renderFile()}
  function queueDraft(){const title=$('kmHandoutTitle')?.value.trim();if(!title){alert('Informe um título para o handout.');return}const type=$('kmHandoutTargetType')?.value||'all',target=$('kmHandoutTarget')?.value.trim()||'';const labels={all:'TODOS',team:`EQUIPE${target?' // '+target:''}`,player:`PLAYER${target?' // '+target:''}`};queue.unshift({id:`H-${Date.now()}`,title,description:$('kmHandoutDescription')?.value.trim()||'',targetType:type,target,targetTypeLabel:labels[type]||'TODOS',fileName:currentFile?.name||'',fileType:currentFile?.type||'',fileSize:currentFile?.size||0,createdAt:Date.now()});queue=queue.slice(0,60);save();renderQueue();clearForm()}
  function bind(){
    $('kmHandoutFile')?.addEventListener('change',e=>{currentFile=e.target.files?.[0]||null;renderFile()});
    $('kmHandoutClear')?.addEventListener('click',clearForm);
    $('kmHandoutQueue')?.addEventListener('click',queueDraft);
    $('kmHandoutClearQueue')?.addEventListener('click',()=>{if(queue.length&&confirm('Limpar todos os pacotes preparados localmente?')){queue=[];save();renderQueue()}});
  }
  function init(){queue=read();renderFile();renderQueue();bind();console.info('[DCX OS] KEYMASTER LOCAL TOOLS V1 // HANDOUT STAGING READY')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
