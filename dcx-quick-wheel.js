(()=>{
'use strict';
const $=id=>document.getElementById(id);
const isKM=/keymaster\.html$/i.test(location.pathname);
const NS='http://www.w3.org/2000/svg';
const STORE=isKM?'dcx-km-qol-v1':'dcx-player-qol-v1';
let open=false,altDown=false,selected=null,executed=false,overlay=null,center=null,items=[];

function editable(t){return !!t?.closest?.('input,textarea,select,[contenteditable="true"]')}
function shortcutsEnabled(){try{const s=JSON.parse(localStorage.getItem(STORE)||'{}');return s.shortcuts!==false}catch{return true}}
function click(id){const e=$(id);if(e){e.click();return true}return false}
function km(tab){if(window.DCX?.Admin?.switchTab){window.DCX.Admin.switchTab(tab);return true}return click(document.querySelector(`.kmWorkspaceTab[data-tab="${tab}"]`)?.id||'')||!!document.querySelector(`.kmWorkspaceTab[data-tab="${tab}"]`)?.click()}
function guide(){const b=$('qolShortcutGuideBtn');if(b){b.click();return true}return false}
function toast(msg){const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),1500)}

const playerItems=[
 {key:'g',label:'GOLPE',desc:'Operação e plano',run:()=>click('workspaceTabGolpe')},
 {key:'d',label:'DCX',desc:'Rede interna',run:()=>click('workspaceTabDCX')},
 {key:'y',label:'YUMIYA',desc:'Remote manual',run:()=>window.OPHPlayer?.toggleYumiyaChat?.(true)},
 {key:'c',label:'CREDENCIAL',desc:'Crachá DCX',run:()=>click('dcxOpenCredentials')||click('qolIdentityChip')},
 {key:'v',label:'VOTAÇÕES',desc:'Decisões ativas',run:()=>window.DCX?.PollsPlayer?.toggle?.(true)||click('dcxOpenPolls')},
 {key:'n',label:'NOTAS',desc:'Bloco de campo',run:()=>window.DCX?.Player?.toggleNotes?.(true)||click('dcxOpenNotes')},
 {key:'t',label:'EQUIPE',desc:'Equipe e status',run:()=>window.DCX?.Player?.toggleTeam?.(true)||click('dcxOpenTeam')},
 {key:'h',label:'HANDOUTS',desc:'Documentos',run:()=>click('dcxOpenHandouts')},
 {key:'s',label:'CONFIG',desc:'Preferências',run:()=>window.DCX?.PlayerSettings?.toggle?.(true)||click('dcxOpenSettings')},
 {key:'f',label:'FOCUS',desc:'Focus da Yumiya',run:()=>window.OPHPlayer?.toggleYumiyaFocus?.()}
];
const kmItems=[
 {key:'m',label:'MASTER',desc:'Controle geral',run:()=>km('master')},
 {key:'o',label:'OPERAÇÃO',desc:'Broadcast e missão',run:()=>km('operation')},
 {key:'p',label:'PLAYERS',desc:'Player Data',run:()=>km('players')},
 {key:'t',label:'EQUIPES',desc:'Status e NPCs',run:()=>km('teams')},
 {key:'c',label:'CREDENCIAIS',desc:'Crachás DCX',run:()=>km('credentials')},
 {key:'h',label:'HANDOUTS',desc:'Documentos',run:()=>km('handouts')},
 {key:'v',label:'VOTAÇÕES',desc:'Central de votos',run:()=>km('polls')},
 {key:'i',label:'YUYU // IA',desc:'Core automático',run:()=>km('yuyu')},
 {key:'y',label:'YUMIYA',desc:'Remote manual',run:()=>km('yumiya')},
 {key:'s',label:'CONFIG',desc:'Preferências',run:()=>km('settings')}
];
items=isKM?kmItems:playerItems;

function polar(cx,cy,r,a){const rad=(a-90)*Math.PI/180;return{x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)}}
function sectorPath(start,end,rin=94,rout=252){const c=300,p1=polar(c,c,rout,start),p2=polar(c,c,rout,end),p3=polar(c,c,rin,end),p4=polar(c,c,rin,start),large=end-start>180?1:0;return `M ${p1.x} ${p1.y} A ${rout} ${rout} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rin} ${rin} 0 ${large} 0 ${p4.x} ${p4.y} Z`}
function svgEl(tag,attrs={}){const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));return e}
function updateCenter(item){if(!center)return;const small=center.querySelector('small'),b=center.querySelector('b'),span=center.querySelector('span');if(item){small.textContent=`ALT + ${item.key.toUpperCase()}`;b.textContent=item.label;span.textContent=item.desc||'SOLTE ALT PARA ABRIR'}else{small.textContent=isKM?'KEYMASTER // QUICK WHEEL':'PLAYER // QUICK WHEEL';b.textContent='DCX QUICK WHEEL';span.textContent='Passe o mouse numa fatia e solte ALT, clique, ou use ALT + tecla.'}}
function setSelected(item){selected=item||null;overlay?.querySelectorAll('.dcxQuickWheelSector').forEach(g=>g.classList.toggle('selected',!!item&&g.dataset.key===item.key));center?.classList.toggle('selected',item?.key==='k');updateCenter(item)}

function build(){
 if($('dcxQuickWheelBackdrop')){overlay=$('dcxQuickWheelBackdrop');center=$('dcxQuickWheelCenter');return}
 overlay=document.createElement('div');overlay.id='dcxQuickWheelBackdrop';overlay.className='dcxQuickWheelBackdrop';overlay.dataset.mode=isKM?'keymaster':'player';overlay.setAttribute('aria-hidden','true');
 const wrap=document.createElement('div');wrap.className='dcxQuickWheelWrap';wrap.setAttribute('role','menu');wrap.setAttribute('aria-label',isKM?'Atalhos do Keymaster':'Atalhos do Player');
 const svg=svgEl('svg',{class:'dcxQuickWheelSvg',viewBox:'0 0 600 600','aria-hidden':'true'});
 const step=360/items.length,offset=-step/2;
 items.forEach((item,i)=>{
   const start=offset+i*step,end=start+step,mid=(start+end)/2,pos=polar(300,300,176,mid);
   const g=svgEl('g',{class:'dcxQuickWheelSector','data-key':item.key,tabindex:'-1'});g.dataset.key=item.key;
   const path=svgEl('path',{d:sectorPath(start,end)});
   const text=svgEl('text',{x:pos.x,y:pos.y});
   const key=svgEl('tspan',{x:pos.x,dy:'-7',class:'qwKey'});key.textContent=item.key.toUpperCase();
   const lab=svgEl('tspan',{x:pos.x,dy:'22',class:'qwLabel'});lab.textContent=item.label;
   text.append(key,lab);g.append(path,text);
   g.addEventListener('pointerenter',()=>{if(open)setSelected(item)});
   g.addEventListener('pointerleave',()=>{if(open&&selected===item)setSelected(null)});
   g.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();execute(item)});
   svg.appendChild(g);
 });
 center=document.createElement('button');center.type='button';center.id='dcxQuickWheelCenter';center.className='dcxQuickWheelCenter';center.innerHTML='<small>DCX // QUICK WHEEL</small><b>DCX QUICK WHEEL</b><span>SEGURE ALT PARA NAVEGAR</span>';center.addEventListener('pointerenter',()=>{if(open)setSelected({key:'k',label:'ATALHOS',desc:'Guia completo',run:guide})});center.addEventListener('pointerleave',()=>{if(open&&selected?.key==='k')setSelected(null)});center.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();execute({key:'k',label:'ATALHOS',desc:'Guia completo',run:guide})});
 const hint=document.createElement('div');hint.className='dcxQuickWheelHint';hint.innerHTML='<kbd>SEGURE ALT</kbd> · MOUSE + SOLTAR · CLIQUE · ALT + TECLA';
 wrap.append(svg,center,hint);overlay.appendChild(wrap);document.body.appendChild(overlay);
 overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)close(false)});
 updateCenter(null);
}
function show(){if(open||!shortcutsEnabled())return;if(isKM&&$('console')?.classList.contains('hidden'))return;const gate=$('dcxAccessGate');if(!isKM&&gate&&!gate.classList.contains('hidden'))return;build();open=true;executed=false;selected=null;overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');document.body.classList.add('dcxQuickWheelOpen');updateCenter(null)}
function close(commit=false){if(!open)return;const choice=commit?selected:null;open=false;altDown=false;selected=null;overlay?.classList.remove('open');overlay?.setAttribute('aria-hidden','true');document.body.classList.remove('dcxQuickWheelOpen');overlay?.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));updateCenter(null);if(choice&&!executed)run(choice)}
function run(item){try{const ok=item?.run?.();if(ok===false)toast(`${item.label} // INDISPONÍVEL`)}catch(err){console.error('[DCX QUICK WHEEL]',item,err);toast('QUICK WHEEL // FALHA')}}
function execute(item){if(!item)return;executed=true;run(item);close(false)}


function annotateGuide(){
 const list=document.querySelector('.qolShortcutGuideList');
 if(list&&!list.querySelector('.qwGuideRow'))list.insertAdjacentHTML('afterbegin','<div class="qolGuideRow qwGuideRow"><span><b>DCX QUICK WHEEL</b><small>Segure ALT para abrir. Passe o mouse numa fatia e solte ALT, clique na fatia ou use ALT + tecla.</small></span><kbd>SEGURE ALT</kbd></div>');
}

function keydown(e){
 if(editable(e.target))return;
 if(e.key==='Alt'&&!e.repeat&&!e.ctrlKey&&!e.metaKey){if(!shortcutsEnabled())return;e.preventDefault();altDown=true;show();return}
 if(!altDown&&!e.altKey)return;
 if(!open&&e.altKey&&shortcutsEnabled())show();
 if(!open)return;
 const k=String(e.key||'').toLowerCase();
 if(k==='escape'){e.preventDefault();e.stopImmediatePropagation();close(false);return}
 if(k==='k'){e.preventDefault();e.stopImmediatePropagation();execute({key:'k',label:'ATALHOS',desc:'Guia completo',run:guide});return}
 const item=items.find(x=>x.key===k);if(item){e.preventDefault();e.stopImmediatePropagation();setSelected(item);execute(item)}
}
function keyup(e){if(e.key!=='Alt')return;if(!open){altDown=false;return}e.preventDefault();e.stopImmediatePropagation();const shouldCommit=!!selected&&!executed;close(shouldCommit)}
function blur(){if(open)close(false);altDown=false}

function init(){build();annotateGuide();document.addEventListener('keydown',keydown,true);document.addEventListener('keyup',keyup,true);window.addEventListener('blur',blur);console.info(`[DCX OS] QUICK WHEEL V1 // ${isKM?'KEYMASTER':'PLAYER'} // ALT HOLD READY`)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.DCX=window.DCX||{};window.DCX.QuickWheel={open:show,close:()=>close(false)};
})();
