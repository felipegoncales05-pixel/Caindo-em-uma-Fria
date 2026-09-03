(()=>{
  'use strict';
  const STORE='dcx-player-settings-v1';
  const THEMES=['arc-cyan','dcx-green','ember-amber','void-violet'];
  const DENSITIES=['comfortable','compact'];
  const DEFAULTS={theme:'arc-cyan',density:'comfortable'};
  const $=id=>document.getElementById(id);
  function read(){try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}');return{theme:THEMES.includes(raw.theme)?raw.theme:DEFAULTS.theme,density:DENSITIES.includes(raw.density)?raw.density:DEFAULTS.density}}catch{return{...DEFAULTS}}}
  let state=read();
  function persist(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch{}}
  function apply(updateUI=true){document.documentElement.dataset.playerTheme=state.theme;document.documentElement.dataset.playerDensity=state.density;if(updateUI)syncUI()}
  function syncUI(){
    document.querySelectorAll('[data-theme-choice]').forEach(btn=>{const active=btn.dataset.themeChoice===state.theme;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));const badge=btn.querySelector('.settingsSelected');if(badge)badge.textContent=active?'ATIVO':'USAR'});
    document.querySelectorAll('[data-density-choice]').forEach(btn=>{const active=btn.dataset.densityChoice===state.density;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
    const label=$('playerSettingsCurrent');if(label){const names={'arc-cyan':'ARC // CIANO','dcx-green':'DCX // VERDE','ember-amber':'EMBER // ÂMBAR','void-violet':'VOID // VIOLETA'};label.textContent=`${names[state.theme]} // ${state.density==='compact'?'COMPACTO':'CONFORTÁVEL'}`}
  }
  function setTheme(theme){if(!THEMES.includes(theme))return;state.theme=theme;persist();apply()}
  function setDensity(density){if(!DENSITIES.includes(density))return;state.density=density;persist();apply()}
  function reset(){state={...DEFAULTS};persist();apply()}
  function toggle(force){const panel=$('dcxSettingsPanel');if(!panel)return;const open=typeof force==='boolean'?force:panel.classList.contains('hidden');panel.classList.toggle('hidden',!open);panel.setAttribute('aria-hidden',String(!open));if(open){syncUI();setTimeout(()=>$('settingsCloseBtn')?.focus(),0)}}
  function bind(){
    ['dcxOpenSettings','playerSettingsQuickBtn'].forEach(id=>$(id)?.addEventListener('click',e=>{e.preventDefault();toggle(true)}));
    document.querySelectorAll('[data-theme-choice]').forEach(btn=>btn.addEventListener('click',()=>setTheme(btn.dataset.themeChoice)));
    document.querySelectorAll('[data-density-choice]').forEach(btn=>btn.addEventListener('click',()=>setDensity(btn.dataset.densityChoice)));
    $('playerSettingsReset')?.addEventListener('click',reset);
    $('playerOpenKeymaster')?.addEventListener('click',()=>window.DCX?.Navigation?.goKeymaster?.());
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('dcxSettingsPanel')?.classList.contains('hidden'))toggle(false)});
  }
  function init(){apply(false);bind();syncUI();console.info('[DCX OS] PLAYER SETTINGS V2 // QUICK ACCESS + 4 THEMES + DENSITY // LOCAL ONLY')}
  window.DCX=window.DCX||{};window.DCX.PlayerSettings={toggle,setTheme,setDensity,reset,get state(){return{...state}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
