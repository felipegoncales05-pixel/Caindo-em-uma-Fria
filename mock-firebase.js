(() => {
  const store = window.__MOCK_DB__ || (window.__MOCK_DB__ = {});
  const listeners = new Map();
  let pushN = 0;
  const norm = p => String(p||'').replace(/^\/+|\/+$/g,'').replace(/\/+/g,'/');
  const parts = p => norm(p) ? norm(p).split('/') : [];
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  const resolveSV = v => {
    if(v && typeof v==='object' && v.__svTimestamp) return Date.now();
    if(Array.isArray(v)) return v.map(resolveSV);
    if(v && typeof v==='object') { const o={}; for(const [k,x] of Object.entries(v)) o[k]=resolveSV(x); return o; }
    return v;
  };
  function get(p){ let cur=store; for(const k of parts(p)){ if(cur==null || typeof cur!=='object' || !(k in cur)) return null; cur=cur[k]; } return clone(cur); }
  function setRaw(p,v){ const ps=parts(p); if(!ps.length){ for(const k of Object.keys(store)) delete store[k]; Object.assign(store, v||{}); return; } let cur=store; for(let i=0;i<ps.length-1;i++){ const k=ps[i]; if(!cur[k]||typeof cur[k]!=='object')cur[k]={}; cur=cur[k]; } const k=ps.at(-1); if(v===null || v===undefined) delete cur[k]; else cur[k]=resolveSV(clone(v)); }
  function shouldNotify(a,b){ a=norm(a);b=norm(b); return a===b || a.startsWith(b+'/') || b.startsWith(a+'/'); }
  function emit(changed){ for(const [p,cbs] of listeners.entries()){ if(!shouldNotify(p,changed))continue; const snap=new Snap(get(p),p); for(const cb of [...cbs]) queueMicrotask(()=>cb(snap)); } }
  class Snap { constructor(v,p){this._v=v;this.ref=new Ref(p);this.key=parts(p).at(-1)||null} val(){return clone(this._v)} exists(){return this._v!==null&&this._v!==undefined} child(k){return new Snap(get(norm(this.ref.path+'/'+k)),norm(this.ref.path+'/'+k))} }
  class Ref {
    constructor(path){this.path=norm(path);this.key=parts(this.path).at(-1)||null}
    child(k){return new Ref(norm(this.path+'/'+k))}
    async set(v){setRaw(this.path,v);emit(this.path)}
    async update(obj){ for(const [k,v] of Object.entries(obj||{})) setRaw(norm(this.path+'/'+k),v); emit(this.path) }
    async remove(){setRaw(this.path,null);emit(this.path)}
    once(){return Promise.resolve(new Snap(get(this.path),this.path))}
    on(evt,cb){ if(evt!=='value')return; if(!listeners.has(this.path))listeners.set(this.path,new Set()); listeners.get(this.path).add(cb); queueMicrotask(()=>cb(new Snap(get(this.path),this.path))) }
    off(evt,cb){ if(!listeners.has(this.path))return; if(cb)listeners.get(this.path).delete(cb); else listeners.delete(this.path) }
    push(){ return new Ref(norm(this.path+'/mock-'+(++pushN))) }
  }
  const authObj={currentUser:null,_cbs:[],async setPersistence(){},async signInWithEmailAndPassword(){this.currentUser={uid:'1uVVp67PW7c53fs6dstTDNE46Nz1',isAnonymous:false};this._cbs.forEach(cb=>cb(this.currentUser));return{user:this.currentUser}},async signInAnonymously(){this.currentUser={uid:'u-player',isAnonymous:true};this._cbs.forEach(cb=>cb(this.currentUser));return{user:this.currentUser}},async signOut(){this.currentUser=null;this._cbs.forEach(cb=>cb(null))},onAuthStateChanged(cb){this._cbs.push(cb);queueMicrotask(()=>cb(this.currentUser));return()=>{this._cbs=this._cbs.filter(x=>x!==cb)}}};
  function auth(){return authObj} auth.Auth={Persistence:{SESSION:'session'}};
  function database(){return{ref:p=>new Ref(p)}} database.ServerValue={TIMESTAMP:{__svTimestamp:true}};
  window.firebase={apps:[],initializeApp(c){this.apps.push({options:c});return this.apps[0]},auth,database};
})();
