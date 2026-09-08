(()=>{
  'use strict';
  const PLAYER_STORE='dcx-player-settings-v1';
  const KM_STORE='dcx-km-settings-v1';
  const THEME_NAMES={
    'midnight-night':'MIDNIGHT // NOTURNO',
    'steel-blue':'STEEL // AÇO',
    'forest-moss':'FOREST // MUSGO',
    'sakura-rose':'SAKURA // ROSÉ',
    'copper-bronze':'COPPER // COBRE',
    'arctic-ice':'ARCTIC // GELO',
    'bloodmoon-dark':'BLOODMOON // ESCURO',
    'royal-sapphire':'ROYAL // SAFIRA',
    'aurora-mint':'AURORA // MENTA',
    'sandstorm-desert':'SANDSTORM // AREIA'
  };
  const ALL=new Set([
    'arc-cyan','dcx-green','ember-amber','void-violet','frost-blue','crimson-ruby',
    'neon-rose','ghost-mono','solar-gold','toxic-lime','ocean-teal','dusk-wine',
    ...Object.keys(THEME_NAMES)
  ]);
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return{}}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
  function isKM(){return /keymaster\.html$/i.test(location.pathname)}
  function sync(theme){
    document.querySelectorAll('[data-theme-choice]').forEach(b=>{
      const a=b.dataset.themeChoice===theme;
      b.classList.toggle('active',a);
      b.setAttribute('aria-pressed',String(a));
      const e=b.querySelector('.settingsSelected');
      if(e)e.textContent=a?'ATIVO':'USAR';
    });
    document.querySelectorAll('[data-km-theme-choice]').forEach(b=>{
      const a=b.dataset.kmThemeChoice===theme;
      b.classList.toggle('active',a);
      b.setAttribute('aria-pressed',String(a));
      const e=b.querySelector('em');
      if(e)e.textContent=a?'ATIVO':'USAR';
    });
    const name=THEME_NAMES[theme];
    if(!name)return;
    const p=document.getElementById('playerSettingsCurrent');
    if(p)p.textContent=name+' // '+((document.documentElement.dataset.playerDensity||'comfortable')==='compact'?'COMPACTO':'CONFORTÁVEL');
    const k=document.getElementById('kmSettingsCurrent');
    if(k)k.textContent=name+' // '+((document.documentElement.dataset.kmDensity||'comfortable')==='compact'?'COMPACTA':'CONFORTÁVEL');
  }
  function applySaved(){
    const km=isKM();
    const key=km?KM_STORE:PLAYER_STORE;
    const obj=read(key);
    if(!ALL.has(obj.theme))return;
    if(km)document.documentElement.dataset.kmTheme=obj.theme;
    else document.documentElement.dataset.playerTheme=obj.theme;
    sync(obj.theme);
  }
  function bind(){
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-theme-choice],[data-km-theme-choice]');
      if(!b)return;
      const theme=b.dataset.themeChoice||b.dataset.kmThemeChoice;
      if(!ALL.has(theme))return;
      const km=!!b.dataset.kmThemeChoice;
      const key=km?KM_STORE:PLAYER_STORE;
      const obj=read(key);
      obj.theme=theme;
      write(key,obj);
      if(km)document.documentElement.dataset.kmTheme=theme;
      else document.documentElement.dataset.playerTheme=theme;
      sync(theme);
    },true);
  }
  function init(){
    bind();
    setTimeout(applySaved,0);
    console.info('[DCX OS] THEME PACK V3 // 22 THEMES // MIDNIGHT READY');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
