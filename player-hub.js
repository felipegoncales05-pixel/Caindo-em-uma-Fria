(()=>{
  const $=id=>document.getElementById(id);
  const STORE='oph-player-workspace-v1';
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
    if(name==='dcx') syncUnread();
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
  function init(){
    document.body.classList.add('player-hub-ready');
    let stored='golpe';try{stored=localStorage.getItem(STORE)||'golpe'}catch{}
    switchWorkspace(stored,false);
    const unread=$('yumiyaUnread');
    if(unread)new MutationObserver(syncUnread).observe(unread,{subtree:true,childList:true,attributes:true,characterData:true});
    syncUnread();
  }
  window.DCX=window.DCX||{};
  window.DCX.PlayerHub={switchWorkspace,get current(){return current}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
