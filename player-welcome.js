window.DCXWelcome = (() => {
  let timer = null;
  let active = false;
  let afterQueue = [];
  const $ = id => document.getElementById(id);

  function flushAfter(){
    const queue=afterQueue.splice(0);
    queue.forEach(fn=>{try{fn()}catch(e){console.error(e)}});
  }
  function finish(){
    clearTimeout(timer);timer=null;
    $("playerWelcomeNotice")?.classList.remove("show");
    if(!active)return;
    active=false;
    // Espera o fade visual terminar antes de liberar um broadcast cinematográfico.
    setTimeout(flushAfter,240);
  }
  function show({name="AGENTE", playerId="", room="FRIA-01"}={}){
    const root=$("playerWelcomeNotice");
    if(!root)return;
    clearTimeout(timer);
    active=true;
    $("playerWelcomeName").textContent=`BEM-VINDO, ${String(name||"AGENTE").toUpperCase()}`;
    const meta=[];
    if(playerId)meta.push(playerId);
    if(room)meta.push(`SALA ${room}`);
    $("playerWelcomeMeta").textContent=meta.join(" // ");
    root.classList.remove("show");
    void root.offsetWidth;
    root.classList.add("show");
    timer=setTimeout(finish,3600);
  }
  function hide(){finish()}
  function isActive(){return active}
  function after(fn){
    if(typeof fn!=="function")return;
    if(!active){fn();return}
    afterQueue.push(fn);
  }
  return {show,hide,isActive,after};
})();
console.info("PLAYER WELCOME V2 // INTRO QUEUE READY");
