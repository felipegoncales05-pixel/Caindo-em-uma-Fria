window.DCX = window.DCX || {};
(() => {
  const BUILD="DCX-OS-A2.2-AUTH-ISOLATION";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let room=new URLSearchParams(location.search).get("room")||localStorage.getItem("oph-room")||window.OPH_CONFIG?.defaultRoom||"FRIA-01";
  let db=null,uid="",playerId="",name="",teams={},operators={},notes={},connected=false,initialized=false,lastInteraction=Date.now(),heartbeatTimer=null,refs=[],selectedNote="",noteSaveTimer=null;

  function toast(t){const e=$("toast");if(!e)return;e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
  function identity(){try{const d=JSON.parse(localStorage.getItem("oph-yumiya-identity-"+room)||"null");if(d?.name&&d?.playerId)return{name:String(d.name).trim().slice(0,48),playerId:String(d.playerId)}}catch(e){}const n=(localStorage.getItem("oph-name")||$("name")?.value||"").trim();let p=localStorage.getItem("oph-yumiya-player-id")||"";if(n&&!p){p="P-"+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,"").slice(0,10).toUpperCase();localStorage.setItem("oph-yumiya-player-id",p)}return n&&p?{name:n.slice(0,48),playerId:p}:null}
  function keyNorm(v){return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12).replace(/(.{4})(?=.)/g,"$1-")}
  function base(p=""){return `rooms/${room}/dcx${p?"/"+p:""}`}
  function ref(p=""){return db.ref(base(p))}
  function now(){return firebase.database.ServerValue.TIMESTAMP}
  function narrative(op){return Object.assign({teamId:"",role:"",status:"OPERACIONAL",location:"",commsStatus:"ONLINE",visible:true},op?.narrative||{})}
  function operatorName(op,id){return op?.identity?.name||op?.name||id}
  function touch(){lastInteraction=Date.now()}
  function accessStorageKey(){return `dcx-access-key-${room}`}
  function setGate(show,msg=""){const g=$("dcxAccessGate");if(!g)return;g.classList.toggle("hidden",!show);document.body.classList.toggle("dcxAccessLocked",!!show);if($("dcxAccessStatus"))$("dcxAccessStatus").textContent=msg;if(show){const saved=localStorage.getItem("oph-name")||"";if($("dcxAccessName")&&!$("dcxAccessName").value)$("dcxAccessName").value=saved;setTimeout(()=>$("dcxAccessName")?.focus(),60)}}
  function playerApp(){try{return firebase.app("OPH_PLAYER")}catch(e){return firebase.initializeApp(window.OPH_CONFIG.firebase,"OPH_PLAYER")}}
  async function ensureFirebase(){if(!window.OPH_CONFIG?.firebase?.enabled)return false;if(!window.firebase)throw new Error("Firebase SDK indisponível");const app=playerApp(),auth=app.auth();try{await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)}catch(e){}if(auth.currentUser&&!auth.currentUser.isAnonymous){try{await auth.signOut()}catch(e){}}if(!auth.currentUser)await auth.signInAnonymously();db=app.database();uid=auth.currentUser.uid;return true}
  async function readPublicAccess(){try{return (await ref("access/public").once("value")).val()||{requireKey:false,allowNewPlayers:true}}catch(e){console.warn("access public",e);return{requireKey:false,allowNewPlayers:true}}}
  async function validateSavedKey(code){if(!code)return false;try{const s=await ref(`access/invitations/${code}`).once("value"),v=s.val();return !!(v&&v.enabled!==false)}catch(e){return false}}
  async function blocked(pid){if(!pid)return false;try{const s=await ref(`access/blockedPlayers/${pid}`).once("value");return !!s.val()?.blocked}catch(e){return false}}

  async function bootstrap(){
    try{room=new URLSearchParams(location.search).get("room")||localStorage.getItem("oph-room")||window.OPH_CONFIG?.defaultRoom||"FRIA-01";await ensureFirebase();const pub=await readPublicAccess();const i=identity();if(i&&await blocked(i.playerId)){setGate(true,"ACESSO BLOQUEADO PELO KEYMASTER");return}
      if(!pub.requireKey){setGate(false);await window.OPHPlayer?.connect?.();return}
      const saved=localStorage.getItem(accessStorageKey())||"";if(saved&&i?.name&&await validateSavedKey(saved)){setGate(false);await window.OPHPlayer?.connect?.();return}
      setGate(true,saved&&!i?.name?"CONFIRME O NOME DO OPERADOR PARA CONTINUAR":"INSIRA UMA KEY LIBERADA PELO KEYMASTER");
    }catch(e){console.error("DCX bootstrap",e);setGate(true,"FALHA AO VALIDAR ACESSO")}
  }
  async function submitAccess(){
    const nm=String($("dcxAccessName")?.value||"").trim().replace(/\s+/g," ").slice(0,40),code=keyNorm($("dcxAccessKey")?.value||"");if(!nm){setGate(true,"INFORME O NOME DO OPERADOR");return}if(!code){setGate(true,"INFORME A KEY");return}
    try{await ensureFirebase();const pub=await readPublicAccess();if(pub.allowNewPlayers===false&&!localStorage.getItem(accessStorageKey())){setGate(true,"NOVOS ACESSOS ESTÃO FECHADOS");return}const s=await ref(`access/invitations/${code}`).once("value"),v=s.val();if(!v||v.enabled===false){setGate(true,"KEY INVÁLIDA OU REVOGADA");return}localStorage.setItem(accessStorageKey(),code);localStorage.setItem("oph-name",nm);if($("name"))$("name").value=nm;setGate(false);await window.OPHPlayer?.connect?.();
    }catch(e){console.error(e);setGate(true,"FALHA AO VALIDAR KEY")}
  }

  async function heartbeat(){if(!connected||!uid||!playerId)return;try{await ref(`presence/${uid}`).set({uid,playerId,name,build:BUILD,visibility:document.visibilityState,focused:document.hasFocus(),lastInteraction,lastSeen:now()})}catch(e){console.warn("heartbeat",e)}}
  async function claimAccess(){const code=localStorage.getItem(accessStorageKey())||"";if(!code||!uid||!playerId)return;try{await ref(`access/claims/${uid}`).set({uid,key:code,playerId,name,ts:now(),build:BUILD})}catch(e){console.warn("claim",e)}}
  async function init(force=false){
    try{const rt=window.OPH?.Realtime,rtAuth=rt?.getFirebaseAuth?.(),rtDb=rt?.getFirebaseDatabase?.();if(!rtAuth?.currentUser||!rtDb)return false;const target=rt?.getRoom?.()||room;if(initialized&&!force&&target===room)return true;refs.forEach(r=>{try{r.off()}catch(e){}});refs=[];clearInterval(heartbeatTimer);initialized=false;connected=false;db=rtDb;uid=rtAuth.currentUser.uid;room=target;const i=identity();if(!i){console.warn("DCX Player: identidade ainda não disponível");return false}playerId=i.playerId;name=i.name;if(await blocked(playerId)){setGate(true,"ACESSO BLOQUEADO PELO KEYMASTER");return false}
      connected=true;const tr=ref("teams"),or=ref("operators"),nr=ref(`notes/${playerId}`);tr.on("value",s=>{teams=s.val()||{};renderTeams()});or.on("value",s=>{operators=s.val()||{};const newName=operators[playerId]?.identity?.name;if(newName&&newName!==name){name=newName;localStorage.setItem("oph-name",newName);if($("name"))$("name").value=newName}renderTeams()});nr.on("value",s=>{notes=s.val()||{};renderNotes()});refs.push(tr,or,nr);await heartbeat();await claimAccess();heartbeatTimer=setInterval(heartbeat,20000);return true;
    }catch(e){console.error("DCX Player init",e);return false}
  }

  function renderTeams(){const box=$("dcxTeamContent");if(!box)return;const entries=Object.entries(teams||{}).filter(([id])=>id!=="_init");if(!entries.length){box.innerHTML=`<div class="dcxEmpty big">Nenhuma equipe operacional publicada.</div>`;return}box.innerHTML=entries.map(([tid,t])=>{const members=Object.entries(operators||{}).filter(([id,op])=>narrative(op).teamId===tid&&narrative(op).visible!==false);return `<article class="dcxPlayerTeamCard"><div class="dcxPlayerTeamHead"><div><span>${esc(t.codename||"EQUIPE")}</span><h3>${esc(t.name||tid)}</h3></div><b>${esc(t.status||"OPERACIONAL")}</b></div>${t.description?`<p>${esc(t.description)}</p>`:""}<div class="dcxPlayerRoster">${members.map(([id,op])=>{const n=narrative(op),me=id===playerId;return `<div class="dcxPlayerMember ${me?"self":""}" data-credential-pid="${esc(id)}" role="button" tabindex="0"><div><b>${esc(operatorName(op,id))}${me?" · VOCÊ":""}</b><small>${esc(n.role||"OPERADOR")}${n.location?` · ${esc(n.location)}`:""}</small></div><span>${esc(n.status||"OPERACIONAL")}</span><em>${esc(n.commsStatus||"ONLINE")}</em></div>`}).join("")||`<div class="dcxEmpty">Sem membros visíveis.</div>`}</div></article>`}).join("")}
  function toggleTeam(force){const p=$("dcxTeamPanel");if(!p)return;const open=typeof force==="boolean"?force:p.classList.contains("hidden");p.classList.toggle("hidden",!open);if(open)renderTeams()}

  function noteEntries(){return Object.entries(notes||{}).filter(([id])=>id!=="_init").sort((a,b)=>(Number(b[1]?.updatedAt)||0)-(Number(a[1]?.updatedAt)||0))}
  function renderNotes(){const list=$("dcxPlayerNoteList"),editor=$("dcxPlayerNoteEditor");if(!list||!editor)return;const arr=noteEntries();list.innerHTML=`<button class="btn gold dcxNoteNew" onclick="DCX.Player.newNote()">+ NOVA NOTA</button>`+arr.map(([id,n])=>`<button class="dcxNoteRow ${selectedNote===id?"active":""}" onclick="DCX.Player.selectNote('${esc(id)}')"><b>${esc(n.title||"Sem título")}</b><small>${new Date(Number(n.updatedAt)||Date.now()).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small></button>`).join("");const n=notes[selectedNote];if(!n){editor.innerHTML=`<div class="dcxEmpty big">Crie ou selecione uma anotação.</div>`;return}editor.innerHTML=`<div class="dcxNotePlayerHead"><div><small>DCX // BLOCO DE CAMPO</small><b>${esc(name||"OPERADOR")}</b></div><span id="dcxNoteSaveState">SALVO</span></div><input class="dcxNoteTitle" id="dcxPlayerNoteTitle" maxlength="100" value="${esc(n.title||"")}" placeholder="Título"><textarea class="dcxNoteBody" id="dcxPlayerNoteBody" maxlength="20000" placeholder="Escreva suas anotações...">${esc(n.body||"")}</textarea><div class="actions"><button class="btn" onclick="DCX.Player.exportNote()">EXPORTAR / SALVAR PDF</button><button class="btn red" onclick="DCX.Player.deleteNote()">EXCLUIR</button></div>`;const saveLater=()=>{const st=$("dcxNoteSaveState");if(st)st.textContent="SALVANDO...";clearTimeout(noteSaveTimer);noteSaveTimer=setTimeout(saveNote,650)};$("dcxPlayerNoteTitle")?.addEventListener("input",saveLater);$("dcxPlayerNoteBody")?.addEventListener("input",saveLater)}
  function toggleNotes(force){const p=$("dcxNotesPanel");if(!p)return;const open=typeof force==="boolean"?force:p.classList.contains("hidden");p.classList.toggle("hidden",!open);if(open)renderNotes()}
  async function newNote(){if(!connected)return toast("CONECTE-SE PRIMEIRO");try{const r=ref(`notes/${playerId}`).push();await r.set({title:"Nova anotação",body:"",createdAt:now(),updatedAt:now(),updatedBy:"PLAYER"});selectedNote=r.key;renderNotes();setTimeout(()=>$("dcxPlayerNoteTitle")?.select(),40)}catch(e){console.error(e);toast("FALHA AO CRIAR NOTA")}}
  function selectNote(id){selectedNote=id;renderNotes()}
  async function saveNote(){if(!selectedNote)return;const title=String($("dcxPlayerNoteTitle")?.value||"Sem título").trim().slice(0,100)||"Sem título",body=String($("dcxPlayerNoteBody")?.value||"").slice(0,20000);try{await ref(`notes/${playerId}/${selectedNote}`).update({title,body,updatedAt:now(),updatedBy:"PLAYER"});const st=$("dcxNoteSaveState");if(st)st.textContent="SALVO NO SERVIDOR ✓"}catch(e){console.error(e);const st=$("dcxNoteSaveState");if(st)st.textContent="ERRO AO SALVAR"}}
  async function deleteNote(){if(!selectedNote||!confirm("Excluir esta anotação?"))return;try{await ref(`notes/${playerId}/${selectedNote}`).remove();selectedNote="";renderNotes()}catch(e){toast("FALHA AO EXCLUIR")}}
  function exportNote(){const n=notes[selectedNote];if(!n)return;const title=$("dcxPlayerNoteTitle")?.value||n.title||"Anotação",body=$("dcxPlayerNoteBody")?.value||n.body||"";const w=window.open("","_blank","width=800,height=900");if(!w)return toast("POP-UP BLOQUEADO");w.document.write(`<!doctype html><html><head><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:48px;color:#111}small{color:#666}h1{margin:8px 0 24px}pre{white-space:pre-wrap;font:16px/1.6 Arial,sans-serif}</style></head><body><small>DCX // OPERAÇÃO H // BLOCO DE CAMPO</small><h1>${esc(title)}</h1><p><b>Operador:</b> ${esc(name)}</p><pre>${esc(body)}</pre><script>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close()}


  function getCredentialData(id=playerId){
    id=String(id||playerId||"");
    const op=operators?.[id]||{};
    const n=narrative(op);
    const t=n.teamId?teams?.[n.teamId]:null;
    const type=op?.identity?.type||(id.startsWith("NPC-")?"npc":"player");
    const fallbackName=id===playerId?(name||localStorage.getItem("oph-name")||id):id;
    return {
      id,playerId:id,type,
      name:operatorName(op,id)||fallbackName,
      teamId:n.teamId||"",teamName:t?.name||"",teamCode:t?.codename||"",
      role:n.role||"OPERADOR",status:n.status||"OPERACIONAL",location:n.location||"",
      commsStatus:n.commsStatus||"ONLINE",visible:n.visible!==false,isSelf:id===playerId,
      room
    };
  }
  function getLocalIdentity(){return {playerId,name,room,connected};}

  ["pointerdown","keydown","touchstart"].forEach(ev=>window.addEventListener(ev,touch,{passive:true}));document.addEventListener("visibilitychange",()=>{touch();heartbeat()});window.addEventListener("focus",()=>{touch();heartbeat()});window.addEventListener("blur",heartbeat);
  window.DCX.Player={bootstrap,submitAccess,init,toggleTeam,toggleNotes,newNote,selectNote,saveNote,deleteNote,exportNote,getCredentialData,getLocalIdentity};
})();