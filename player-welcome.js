window.DCXWelcome = (() => {
  let timer = null;
  const $ = id => document.getElementById(id);
  function show({name="AGENTE", playerId="", room="FRIA-01"}={}){
    const root=$("playerWelcomeNotice");
    if(!root)return;
    clearTimeout(timer);
    $("playerWelcomeName").textContent=`BEM-VINDO, ${String(name||"AGENTE").toUpperCase()}`;
    const meta=[];
    if(playerId)meta.push(playerId);
    if(room)meta.push(`SALA ${room}`);
    $("playerWelcomeMeta").textContent=meta.join(" // ");
    root.classList.remove("show");
    void root.offsetWidth;
    root.classList.add("show");
    timer=setTimeout(()=>root.classList.remove("show"),3600);
  }
  function hide(){clearTimeout(timer);$("playerWelcomeNotice")?.classList.remove("show")}
  return {show,hide};
})();
console.info("PLAYER WELCOME V1 // EVENT BASELINE FIX READY");
