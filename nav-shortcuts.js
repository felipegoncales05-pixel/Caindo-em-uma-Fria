(()=>{
  'use strict';
  function editableTarget(t){return !!t?.closest?.('input,textarea,select,[contenteditable="true"]')}
  function qs(){return location.search||''}
  function goKeymaster(){location.href=`keymaster.html${qs()}`}
  function goPlayer(){location.href=`index.html${qs()}`}
  function isKeymaster(){return /keymaster\.html$/i.test(location.pathname)}
  document.addEventListener('keydown',e=>{
    if(!e.shiftKey||String(e.key).toLowerCase()!=='n'||e.ctrlKey||e.altKey||e.metaKey)return;
    if(editableTarget(e.target))return;
    e.preventDefault();
    isKeymaster()?goPlayer():goKeymaster();
  });
  window.DCX=window.DCX||{};
  window.DCX.Navigation={goKeymaster,goPlayer,isKeymaster};
  console.info('[DCX OS] NAV SHORTCUT // SHIFT+N READY');
})();
