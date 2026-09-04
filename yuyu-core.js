(()=>{
'use strict';
if(!/keymaster\.html$/i.test(location.pathname))return;
const STORE='dcx-yuyu-core-lab-v1';
const $=id=>document.getElementById(id);
const defaults={mode:'off',learning:'supervised',backend:false,memories:[],orixas:false};
const relations={
 KANG:'Muito próxima e feliz; baixa formalidade, brincalhona e protetora.',
 AKIRA:'Respeito forte; tom cordial e mais sério quando necessário.',
 NADEKO:'Maternal; muito carinhosa, paciente e extremamente protetora.',
 ANDREI:'Amiga; casual, calorosa e aberta a brincadeiras.',
 ASHINO:'Amiga; casual, calorosa e protetora.',
 VLAD:'Conhecida; educada, amigável e com formalidade média.',
 OUTROS:'Chefe gente boa do RH; protetora, usa gírias modernas e cria apelidos fofos.'
};
function read(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(STORE)||'{}'))}catch{return{...defaults}}}
let state=read();
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch{}}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mount(){
 const host=document.querySelector('[data-km-view="yumiya"] .kmSingle');
 if(!host||$('yuyuLab'))return;
 host.insertAdjacentHTML('afterbegin',`<section class="yuyuLab" id="yuyuLab">
 <div class="yuyuLabHead"><div><span class="tag">YUYU CORE // EXPERIMENTAL // LOCAL ONLY</span><h2>YUYU // CÉREBRO AUTOMÁTICO</h2><p>Configuração, personalidade e memória estão prontas localmente. A geração por IA ainda NÃO chama nenhum modelo: o backend seguro entra depois, junto da infraestrutura complexa.</p></div><span class="yuyuLabBadge" id="yuyuLabBadge">IA NÃO CONECTADA</span></div>
 <div class="yuyuLabGrid">
  <div class="yuyuLabCard"><h3>CONTROLE DA AUTOMAÇÃO</h3><small>O modo fica salvo só neste Keymaster. Sem backend, ASSISTIDA/AUTO ficam armados mas não enviam mensagens sozinhos.</small><div class="yuyuModeRow"><button class="yuyuChoice" data-yuyu-mode="off">OFF</button><button class="yuyuChoice" data-yuyu-mode="assisted">ASSISTIDA</button><button class="yuyuChoice" data-yuyu-mode="auto">AUTOMÁTICA</button></div><div class="yuyuStatus" id="yuyuStatus"><i></i><b id="yuyuStatusText">OFF</b></div>
  <div class="yuyuLearnRow"><span class="yuyuMuted">APRENDIZADO:</span><button class="yuyuChoice" data-yuyu-learning="off">OFF</button><button class="yuyuChoice" data-yuyu-learning="supervised">SUPERVISIONADO</button><button class="yuyuChoice" data-yuyu-learning="auto">AUTOMÁTICO</button></div>
  <label class="toggle"><span>CANAL PRIVADO ORIXAS // KEYMASTER</span><input id="yuyuOrixas" type="checkbox"></label></div>
  <div class="yuyuLabCard"><h3>PERSONALIDADE TRAVADA</h3><div class="yuyuPolicy"><div class="yuyuPolicyRow"><b>ESSÊNCIA</b><span>Genuína, pura, sem arrogância e incapaz de mentir.</span></div><div class="yuyuPolicyRow"><b>TRATAMENTO</b><span>Respeitosa e gentil; protetora, brincalhona, gírias modernas e apelidos fofos.</span></div><div class="yuyuPolicyRow"><b>ESTRESSE</b><span>Pode soltar algo pesado. Quando se acalma, pede desculpas e mantém a pendência até a pessoa aceitar.</span></div><div class="yuyuPolicyRow"><b>CAOS</b><span>Às vezes incentiva ideias loucas, mas não decide acontecimentos do mundo.</span></div><div class="yuyuPolicyRow"><b>SEGREDOS</b><span>Se souber algo revelador, pede autorização. Se negado: “Foi malzinho, mas eu não posso te contar isso.”</span></div></div></div>
  <div class="yuyuLabCard"><h3>RELAÇÕES-BASE</h3><small>Essas regras alimentam o futuro contexto automático.</small><div class="yuyuRelList">${Object.entries(relations).map(([n,d])=>`<div class="yuyuRel"><b>${n}</b><small>${esc(d)}</small></div>`).join('')}</div></div>
  <div class="yuyuLabCard"><h3>MEMORY ENGINE // LOCAL</h3><small>Aprenda agora sem tocar em Firebase. SUPERVISIONADO deixa tudo pendente até você aprovar.</small><div class="yuyuMemoryComposer"><select id="yuyuMemTarget"><option>GERAL</option>${Object.keys(relations).filter(x=>x!=='OUTROS').map(x=>`<option>${x}</option>`).join('')}</select><input id="yuyuMemText" maxlength="280" placeholder="Ex.: Kang gostou do apelido Kangzinho"><button class="btn" id="yuyuMemAdd" type="button">APRENDER</button></div><div class="yuyuMemoryList" id="yuyuMemoryList"></div></div>
  <div class="yuyuLabCard"><h3>CONTEXTO UTILIZADO // PREVIEW</h3><small>Mostra fatos e regras que seriam enviados ao modelo. Não mostra raciocínio interno.</small><textarea class="yuyuContext" id="yuyuContext" readonly></textarea><div class="actions" style="margin-top:8px"><button class="btn" id="yuyuCopyContext" type="button">COPIAR CONTEXTO</button><button class="btn red yuyuDanger" id="yuyuResetMemory" type="button">APAGAR MEMÓRIA LOCAL</button></div></div>
 </div>
 <div class="yuyuLabFoot"><span>BACKEND IA: <b>NÃO CONECTADO</b> // FIREBASE: <b>INTACTO</b></span><span>Remoção total: excluir yuyu-core.js/css e suas duas referências.</span></div>
 </section>`);
 bind();render();
}
function bind(){
 document.querySelectorAll('[data-yuyu-mode]').forEach(b=>b.onclick=()=>{state.mode=b.dataset.yuyuMode;save();render()});
 document.querySelectorAll('[data-yuyu-learning]').forEach(b=>b.onclick=()=>{state.learning=b.dataset.yuyuLearning;save();render()});
 $('yuyuOrixas').onchange=e=>{state.orixas=e.target.checked;save();renderContext()};
 $('yuyuMemAdd').onclick=addMemory;
 $('yuyuMemText').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addMemory()}});
 $('yuyuResetMemory').onclick=()=>{if(confirm('Apagar somente as memórias locais da Yuyu neste navegador?')){state.memories=[];save();render()}};
 $('yuyuCopyContext').onclick=async()=>{try{await navigator.clipboard.writeText($('yuyuContext').value);toast('CONTEXTO COPIADO')}catch{}};
}
function toast(t){const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}
function addMemory(){const input=$('yuyuMemText'),text=input.value.trim();if(!text)return;const status=state.learning==='auto'?'approved':'pending';state.memories.unshift({id:'MEM-'+Date.now().toString(36).toUpperCase(),target:$('yuyuMemTarget').value,text,status,pinned:false,source:'KEYMASTER',createdAt:Date.now()});input.value='';save();render()}
function memoryAction(id,act){const m=state.memories.find(x=>x.id===id);if(!m)return;if(act==='approve')m.status='approved';if(act==='pin'){m.pinned=!m.pinned;if(m.pinned)m.status='approved'}if(act==='delete')state.memories=state.memories.filter(x=>x.id!==id);save();render()}
function renderMemories(){const box=$('yuyuMemoryList');if(!box)return;if(!state.memories.length){box.innerHTML='<div class="dcxEmpty">Nenhuma memória local ainda.</div>';return}box.innerHTML=state.memories.map(m=>`<article class="yuyuMemory ${m.status==='approved'?'approved':''} ${m.pinned?'pinned':''}"><header><b>${esc(m.target)}</b><small>${m.status==='approved'?'APROVADA':'PENDENTE'}${m.pinned?' // FIXADA':''}</small></header><p>${esc(m.text)}</p><small>${esc(m.source)} // ${new Date(m.createdAt).toLocaleString('pt-BR')}</small><div class="actions">${m.status!=='approved'?`<button class="btn" data-yuyu-mem-act="approve" data-id="${m.id}">APROVAR</button>`:''}<button class="btn" data-yuyu-mem-act="pin" data-id="${m.id}">${m.pinned?'DESAFIXAR':'FIXAR'}</button><button class="btn red" data-yuyu-mem-act="delete" data-id="${m.id}">DESCARTAR</button></div></article>`).join('');box.querySelectorAll('[data-yuyu-mem-act]').forEach(b=>b.onclick=()=>memoryAction(b.dataset.id,b.dataset.yuyuMemAct))}
function renderContext(){const approved=state.memories.filter(m=>m.status==='approved');const lines=[
'YUYU CORE // CONTEXTO PREPARADO',
'',
'PERSONA:',
'- Yumiya é genuína, pura, respeitosa, protetora e não consegue mentir.',
'- Pode usar gírias modernas e apelidos fofos sem virar caricatura.',
'- Quando estressada pode falar pesado; ao se acalmar deve pedir desculpas até a reconciliação ser aceita.',
'- Às vezes incentiva ideias loucas, mas nunca resolve ações de mundo.',
'',
'DISCLOSURE:',
'- Informação reveladora exige autorização do Keymaster.',
'- Se a autorização for negada, não mentir: dizer que não pode contar.',
'- Saber não significa poder revelar.',
'',
'RELAÇÕES:',...Object.entries(relations).map(([n,d])=>`- ${n}: ${d}`),
'',`ORIXAS PRIVATE CHANNEL: ${state.orixas?'ON':'OFF'}`,
'',`MEMÓRIAS APROVADAS (${approved.length}):`,...(approved.length?approved.map(m=>`- [${m.target}] ${m.text}${m.pinned?' [FIXADA]':''}`):['- nenhuma']),
'',`MODO DESEJADO: ${state.mode.toUpperCase()}`,
`APRENDIZADO: ${state.learning.toUpperCase()}`,
'BACKEND: NÃO CONECTADO'
];$('yuyuContext').value=lines.join('\n')}
function render(){document.querySelectorAll('[data-yuyu-mode]').forEach(b=>b.classList.toggle('active',b.dataset.yuyuMode===state.mode));document.querySelectorAll('[data-yuyu-learning]').forEach(b=>b.classList.toggle('active',b.dataset.yuyuLearning===state.learning));if($('yuyuOrixas'))$('yuyuOrixas').checked=!!state.orixas;const st=$('yuyuStatus'),txt=$('yuyuStatusText');if(st&&txt){st.className='yuyuStatus '+(state.mode==='off'?'off':'armed');txt.textContent=state.mode==='off'?'AUTOMAÇÃO OFF':`${state.mode==='auto'?'AUTO':'ASSISTIDA'} ARMADA // AGUARDANDO BACKEND`}$('yuyuLabBadge').textContent='IA NÃO CONECTADA';renderMemories();renderContext()}
function init(){mount();console.info('[YUYU CORE] LAB V1 READY // LOCAL MEMORY + PERSONA // NO MODEL / NO FIREBASE')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
