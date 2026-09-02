(function(){
  "use strict";
  const KEY="dcx-km-density";
  const VALID=new Set(["comfortable","compact"]);
  function current(){
    const d=document.documentElement.dataset.kmDensity;
    return VALID.has(d)?d:"comfortable";
  }
  function sync(){
    const d=current();
    document.querySelectorAll("[data-km-density-choice]").forEach(btn=>{
      const active=btn.dataset.kmDensityChoice===d;
      btn.classList.toggle("active",active);
      btn.setAttribute("aria-pressed",active?"true":"false");
    });
    const label=document.getElementById("kmDensityCurrent");
    if(label)label.textContent=d==="comfortable"?"CONFORTÁVEL":"COMPACTA";
  }
  function setDensity(value){
    const d=VALID.has(value)?value:"comfortable";
    document.documentElement.dataset.kmDensity=d;
    try{localStorage.setItem(KEY,d)}catch(e){}
    sync();
  }
  function toggleDensity(){setDensity(current()==="comfortable"?"compact":"comfortable")}
  window.KMHUD={setDensity,toggleDensity,current};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();
