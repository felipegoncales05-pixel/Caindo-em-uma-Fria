window.OPH = window.OPH || {};
OPH.Realtime = (() => {
  let mode = "local";
  let ws = null, db = null, auth = null, uid = null, room = null, role = "player";
  let stateCallbacks = [], requestCallbacks = [];
  let bc = null;
  let reconnectTimer = null;

  function cfgReady(){
    const c = window.OPH_CONFIG?.firebase;
    return !!(c && c.enabled && c.apiKey && !c.apiKey.includes("COLE_AQUI") && window.firebase);
  }

  async function connectFirebase(asHost, creds){
    mode = "firebase";
    if(!firebase.apps.length) firebase.initializeApp(window.OPH_CONFIG.firebase);
    auth = firebase.auth(); db = firebase.database();
    if(asHost){
      await auth.signInWithEmailAndPassword(creds.email, creds.password);
    } else {
      if(!auth.currentUser) await auth.signInAnonymously();
    }
    uid = auth.currentUser.uid;
    const stateRef = db.ref(`rooms/${room}/state`);
    stateRef.on("value", snap => {
      const val = snap.val() || OPH.cloneDefault();
      stateCallbacks.forEach(cb => cb(val));
    });
    if(asHost){
      const reqRef = db.ref(`rooms/${room}/requests`);
      reqRef.on("value", snap => {
        const val = snap.val() || {};
        requestCallbacks.forEach(cb => cb(val));
      });
      const snap = await stateRef.once("value");
      if(!snap.exists()) await stateRef.set(OPH.cloneDefault());
    }
    return {mode, uid};
  }

  function connectBroadcast(asHost){
    mode = "broadcast";
    bc = new BroadcastChannel("oph-room-"+room);
    bc.onmessage = e => {
      const m = e.data || {};
      if(m.type==="state") stateCallbacks.forEach(cb=>cb(m.state));
      if(m.type==="request" && asHost) requestCallbacks.forEach(cb=>cb(m.requests||{}));
    };
    if(asHost){
      const saved = JSON.parse(localStorage.getItem("oph-state-"+room) || "null") || OPH.cloneDefault();
      setTimeout(()=>stateCallbacks.forEach(cb=>cb(saved)),10);
    }
    return {mode};
  }

  function connectWebSocket(asHost, password){
    return new Promise((resolve,reject)=>{
      const proto = location.protocol==="https:"?"wss":"ws";
      const url = `${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&role=${asHost?"host":"player"}${asHost?`&password=${encodeURIComponent(password||"")}`:""}`;
      let settled=false;
      try{ ws = new WebSocket(url); }catch(e){ reject(e); return; }
      const fail=()=>{ if(!settled){settled=true;try{ws.close()}catch(e){} reject(new Error("ws failed"));}};
      const timer=setTimeout(fail,1200);
      ws.onopen=()=>{ clearTimeout(timer); if(!settled){settled=true;mode="ws";resolve({mode});} };
      ws.onerror=fail;
      ws.onmessage=e=>{
        try{
          const m=JSON.parse(e.data);
          if(m.type==="state") stateCallbacks.forEach(cb=>cb(m.state));
          if(m.type==="requests" && asHost) requestCallbacks.forEach(cb=>cb(m.requests||{}));
          if(m.type==="error") console.warn(m.message);
        }catch(err){}
      };
    });
  }

  async function connect({roomId, asHost=false, credentials={}}){
    room = (roomId||"FRIA-01").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,24);
    role = asHost?"host":"player";
    if(cfgReady()) return connectFirebase(asHost, credentials);

    if(location.protocol.startsWith("http")){
      try{ return await connectWebSocket(asHost, credentials.password); }
      catch(e){ console.info("WebSocket indisponível, usando BroadcastChannel."); }
    }
    return connectBroadcast(asHost);
  }

  function onState(cb){ stateCallbacks.push(cb); }
  function onRequests(cb){ requestCallbacks.push(cb); }

  async function setState(state){
    state.updatedAt = Date.now();
    if(mode==="firebase") return db.ref(`rooms/${room}/state`).set(state);
    if(mode==="ws") return ws.send(JSON.stringify({type:"set_state",state}));
    localStorage.setItem("oph-state-"+room, JSON.stringify(state));
    bc?.postMessage({type:"state",state});
    stateCallbacks.forEach(cb=>cb(state));
  }

  async function patchState(patch){
    if(mode==="firebase") return db.ref(`rooms/${room}/state`).update(patch);
    // ws/broadcast: host maintains full state in client; this is only a fallback helper.
    throw new Error("patchState requires Firebase; use setState in local mode.");
  }

  async function sendRequest(req){
    req.ts = Date.now();
    if(mode==="firebase"){
      const ref = db.ref(`rooms/${room}/requests/${uid}`);
      return ref.set(req);
    }
    if(mode==="ws") return ws.send(JSON.stringify({type:"clue_request",request:req}));
    const obj = {}; obj["local-"+Date.now()] = req;
    bc?.postMessage({type:"request",requests:obj});
  }

  async function clearRequest(id){
    if(mode==="firebase") return db.ref(`rooms/${room}/requests/${id}`).remove();
    if(mode==="ws") return ws.send(JSON.stringify({type:"clear_request",id}));
  }

  return {connect,onState,onRequests,setState,patchState,sendRequest,clearRequest,getMode:()=>mode};
})();