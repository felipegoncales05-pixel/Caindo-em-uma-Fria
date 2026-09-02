window.OPH = window.OPH || {};
OPH.Realtime = (() => {
  let mode = "local";
  let ws = null, db = null, auth = null, uid = null, room = null;
  let stateCallbacks = [], requestCallbacks = [];
  let bc = null, stateRef = null, reqRef = null;

  const reqStoreKey = () => `oph-requests-${room}`;
  const stateStoreKey = () => `oph-state-${room}`;
  const safeRoom = value => String(value || "FRIA-01").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24) || "FRIA-01";

  function emitState(value){ stateCallbacks.forEach(cb => { try{ cb(value); }catch(e){ console.error(e); } }); }
  function emitRequests(value){ requestCallbacks.forEach(cb => { try{ cb(value); }catch(e){ console.error(e); } }); }
  function readLocal(key, fallback){ try{ return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; }catch(e){ return fallback; } }
  function writeLocal(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function cfgReady(){
    const c = window.OPH_CONFIG?.firebase;
    return !!(c && c.enabled && c.apiKey && !String(c.apiKey).includes("COLE_AQUI") && window.firebase);
  }

  function cleanup(){
    try{ stateRef?.off(); }catch(e){}
    try{ reqRef?.off(); }catch(e){}
    try{ bc?.close(); }catch(e){}
    try{ if(ws && ws.readyState < 2) ws.close(); }catch(e){}
    stateRef = reqRef = bc = ws = null;
  }

  async function connectFirebase(asHost, creds={}){
    mode = "firebase";
    if(!firebase.apps.length) firebase.initializeApp(window.OPH_CONFIG.firebase);
    auth = firebase.auth();
    db = firebase.database();
    try{ await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); }catch(e){}
    if(asHost){
      if(!creds.email || !creds.password) throw new Error("Credenciais Firebase ausentes");
      await auth.signInWithEmailAndPassword(creds.email, creds.password);
    }else{
      if(auth.currentUser && !auth.currentUser.isAnonymous){ try{ await auth.signOut(); }catch(e){} }
      if(!auth.currentUser) await auth.signInAnonymously();
    }
    uid = auth.currentUser.uid;
    stateRef = db.ref(`rooms/${room}/state`);
    stateRef.on("value", snap => emitState(snap.val() || OPH.cloneDefault()));
    if(asHost){
      reqRef = db.ref(`rooms/${room}/requests`);
      reqRef.on("value", snap => emitRequests(snap.val() || {}));
      const snap = await stateRef.once("value");
      if(!snap.exists()) await stateRef.set(OPH.cloneDefault());
    }
    return {mode, uid};
  }

  function localUid(){
    const k=`oph-local-uid-${room}`;
    let value=sessionStorage.getItem(k);
    if(!value){ value="local-"+(crypto.randomUUID?.() || Math.random().toString(36).slice(2)+Date.now().toString(36)).replace(/-/g,"").slice(0,12); sessionStorage.setItem(k,value); }
    return value;
  }

  function postRequests(requests){
    writeLocal(reqStoreKey(), requests);
    bc?.postMessage({type:"requests", requests});
    emitRequests(requests);
  }

  function connectBroadcast(asHost){
    mode = "broadcast";
    uid = localUid();
    bc = new BroadcastChannel("oph-room-"+room);
    bc.onmessage = e => {
      const m=e.data||{};
      if(m.type==="state" && m.state) emitState(m.state);
      if(m.type==="requests" && asHost) emitRequests(m.requests||{});
      if(m.type==="hello"){
        const saved=readLocal(stateStoreKey(),OPH.cloneDefault());
        bc?.postMessage({type:"state",state:saved});
        if(asHost) bc?.postMessage({type:"requests",requests:readLocal(reqStoreKey(),{})});
      }
    };
    let saved=readLocal(stateStoreKey(),null);
    if(!saved && asHost){ saved=OPH.cloneDefault(); writeLocal(stateStoreKey(),saved); }
    if(saved) setTimeout(()=>emitState(saved),0);
    if(asHost) setTimeout(()=>emitRequests(readLocal(reqStoreKey(),{})),0);
    bc.postMessage({type:"hello"});
    return {mode,uid};
  }

  function connectWebSocket(asHost,password){
    return new Promise((resolve,reject)=>{
      const proto=location.protocol==="https:"?"wss":"ws";
      const url=`${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&role=${asHost?"host":"player"}${asHost?`&password=${encodeURIComponent(password||"")}`:""}`;
      let settled=false;
      try{ ws=new WebSocket(url); }catch(e){ reject(e); return; }
      const fail=()=>{ if(!settled){ settled=true; try{ws.close();}catch(e){} reject(new Error("ws failed")); } };
      const timer=setTimeout(fail,1400);
      ws.onopen=()=>{ clearTimeout(timer); if(!settled){ settled=true; mode="ws"; uid="ws-"+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)).replace(/-/g,"").slice(0,12); resolve({mode,uid}); } };
      ws.onerror=fail;
      ws.onmessage=e=>{
        try{
          const m=JSON.parse(e.data);
          if(m.type==="state") emitState(m.state||OPH.cloneDefault());
          if(m.type==="requests" && asHost) emitRequests(m.requests||{});
          if(m.type==="error") console.warn(m.message);
        }catch(err){ console.warn("Mensagem WS inválida",err); }
      };
    });
  }

  async function connect({roomId,asHost=false,credentials={}}){
    cleanup();
    room=safeRoom(roomId);
    if(cfgReady()) return connectFirebase(asHost,credentials);
    if(location.protocol.startsWith("http")){
      try{ return await connectWebSocket(asHost,credentials.password); }
      catch(e){ console.info("WebSocket indisponível; usando BroadcastChannel."); }
    }
    return connectBroadcast(asHost);
  }

  function onState(cb){ if(typeof cb==="function") stateCallbacks.push(cb); }
  function onRequests(cb){ if(typeof cb==="function") requestCallbacks.push(cb); }

  async function setState(state){
    state.updatedAt=Date.now();
    if(mode==="firebase") return db.ref(`rooms/${room}/state`).set(state);
    if(mode==="ws"){ ws.send(JSON.stringify({type:"set_state",state})); return; }
    writeLocal(stateStoreKey(),state); bc?.postMessage({type:"state",state}); emitState(state);
  }

  async function patchState(patch){
    if(mode==="firebase") return db.ref(`rooms/${room}/state`).update(patch);
    const current=readLocal(stateStoreKey(),OPH.cloneDefault());
    Object.assign(current,patch||{}); return setState(current);
  }

  async function sendRequest(req){
    req=Object.assign({},req,{ts:Date.now()});
    if(mode==="firebase") return db.ref(`rooms/${room}/requests/${uid}/clue`).set(req);
    if(mode==="ws"){ ws.send(JSON.stringify({type:"clue_request",request:req})); return; }
    const all=readLocal(reqStoreKey(),{}); all[uid]=Object.assign({},all[uid]||{},{clue:req}); postRequests(all);
  }

  async function publishIdentity(identity){
    const req={type:"identity",nickname:String(identity?.nickname||"").trim().slice(0,40),playerId:String(identity?.playerId||"").trim().slice(0,32),ts:Date.now()};
    if(!req.nickname || !req.playerId) return;
    if(mode==="firebase") return db.ref(`rooms/${room}/requests/${uid}/identity`).set(req);
    if(mode==="ws"){ ws.send(JSON.stringify({type:"identity_update",identity:req})); return; }
    const all=readLocal(reqStoreKey(),{}); all[uid]=Object.assign({},all[uid]||{},{identity:req}); postRequests(all);
  }

  async function sendChat(req){
    req=Object.assign({},req,{type:"chat",ts:Date.now()});
    if(mode==="firebase"){
      const ref=db.ref(`rooms/${room}/requests/${uid}/chat`).push(); req.id=ref.key; await ref.set(req); return req.id;
    }
    if(mode==="ws"){ ws.send(JSON.stringify({type:"chat_request",request:req})); return "ws-"+Date.now(); }
    const id="local-"+Date.now()+"-"+Math.random().toString(36).slice(2,6); req.id=id;
    const all=readLocal(reqStoreKey(),{}), node=Object.assign({},all[uid]||{}), chat=Object.assign({},node.chat||{}); chat[id]=req; node.chat=chat; all[uid]=node; postRequests(all); return id;
  }

  async function clearRequest(ownerUid){
    if(mode==="firebase"){
      const ref=db.ref(`rooms/${room}/requests/${ownerUid}`),snap=await ref.once("value"),val=snap.val();
      if(val?.type==="clue") return ref.remove();
      return ref.child("clue").remove();
    }
    if(mode==="ws"){ ws.send(JSON.stringify({type:"clear_request",id:ownerUid})); return; }
    const all=readLocal(reqStoreKey(),{}); if(all[ownerUid]){ delete all[ownerUid].clue; if(!Object.keys(all[ownerUid]).length) delete all[ownerUid]; } postRequests(all);
  }

  async function clearChat(ownerUid,messageId){
    if(mode==="firebase") return db.ref(`rooms/${room}/requests/${ownerUid}/chat/${messageId}`).remove();
    if(mode==="ws"){ ws.send(JSON.stringify({type:"clear_chat",ownerUid,messageId})); return; }
    const all=readLocal(reqStoreKey(),{}); const node=all[ownerUid]; if(node?.chat){ delete node.chat[messageId]; if(!Object.keys(node.chat).length) delete node.chat; if(!Object.keys(node).length) delete all[ownerUid]; } postRequests(all);
  }

  async function clearAllChats(){
    if(mode==="firebase"){
      const base=db.ref(`rooms/${room}/requests`),snap=await base.once("value"),val=snap.val()||{},updates={};
      Object.keys(val).forEach(ownerUid=>{ if(val[ownerUid]?.chat) updates[`${ownerUid}/chat`]=null; });
      if(Object.keys(updates).length) await base.update(updates); return;
    }
    if(mode==="ws"){ ws.send(JSON.stringify({type:"clear_all_chats"})); return; }
    const all=readLocal(reqStoreKey(),{}); for(const node of Object.values(all)){ if(node?.chat) delete node.chat; } for(const k of Object.keys(all)){ if(!Object.keys(all[k]||{}).length) delete all[k]; } postRequests(all);
  }

  return {connect,onState,onRequests,setState,patchState,sendRequest,sendChat,publishIdentity,clearRequest,clearChat,clearAllChats,getMode:()=>mode,getUid:()=>uid,getRoom:()=>room};
})();
