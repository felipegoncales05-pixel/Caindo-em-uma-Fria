(()=>{
  const $=id=>document.getElementById(id);
  const STORE='oph-player-workspace-v2';
  let current='golpe';

  function switchWorkspace(name,save=true){
    name=name==='dcx'?'dcx':'golpe';
    current=name;
    $('workspaceGolpe')?.classList.toggle('active',name==='golpe');
    $('workspaceDCX')?.classList.toggle('active',name==='dcx');
    $('workspaceTabGolpe')?.classList.toggle('active',name==='golpe');
    $('workspaceTabDCX')?.classList.toggle('active',name==='dcx');
    document.body.dataset.playerWorkspace=name;
    if(save){try{localStorage.setItem(STORE,name)}catch{}}
    if(name==='dcx')syncUnread();
  }

  function syncUnread(){
    const source=$('yumiyaUnread');
    const count=source&&!source.classList.contains('hidden')?Math.max(0,parseInt(source.textContent||'0',10)||0):0;
    for(const id of ['dcxWorkspaceUnread','dcxYumiyaCardUnread']){
      const el=$(id);if(!el)continue;
      el.textContent=String(Math.min(count,99));
      el.classList.toggle('hidden',!count);
    }
  }

  function call(fn,label){
    try{fn?.()}catch(e){console.error('PLAYER HUB V2 // '+label,e)}
  }

  function bind(){
    $('workspaceTabGolpe')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();switchWorkspace('golpe')});
    $('workspaceTabDCX')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();switchWorkspace('dcx')});
    $('dcxOpenYumiya')?.addEventListener('click',e=>{e.preventDefault();call(()=>window.OPHPlayer?.toggleYumiyaChat?.(true),'YUMIYA')});
    $('dcxOpenTeam')?.addEventListener('click',e=>{e.preventDefault();call(()=>window.DCX?.Player?.toggleTeam?.(true),'EQUIPE')});
    $('dcxOpenNotes')?.addEventListener('click',e=>{e.preventDefault();call(()=>window.DCX?.Player?.toggleNotes?.(true),'ANOTACOES')});
  }

  function init(){
    document.body.classList.add('player-hub-ready');
    bind();
    let stored='golpe';try{stored=localStorage.getItem(STORE)||'golpe'}catch{}
    switchWorkspace(stored,false);
    const unread=$('yumiyaUnread');
    if(unread)new MutationObserver(syncUnread).observe(unread,{subtree:true,childList:true,attributes:true,characterData:true});
    syncUnread();
    console.info('[DCX OS] PLAYER HUB V2 // CSS ISOLADO // INTERACTION BIND OK');
  }

  window.DCX=window.DCX||{};
  window.DCX.PlayerHub={switchWorkspace,get current(){return current}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
