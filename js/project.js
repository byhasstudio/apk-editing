/* Sistem project: buat, simpan, buka, hapus, autosave */
window.APK=window.APK||{};
APK.project=(function(){
  const RATIOS={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:3':[4,3],'21:9':[21,9]};
  let cur=null,dirty=false,timer=null;
  const listeners=[];
  const emit=()=>listeners.forEach(f=>f(cur,dirty));
  function size(aspect,quality){
    const [a,b]=RATIOS[aspect],k=+quality/Math.min(a,b),even=n=>Math.round(n/2)*2;
    return{width:even(a*k),height:even(b*k)};
  }
  function create({name,aspect,quality,fps}){
    const now=Date.now();
    return{id:'p_'+now.toString(36)+Math.random().toString(36).slice(2,6),version:1,
      name:name.trim()||'Project tanpa judul',aspect,fps:+fps,...size(aspect,quality),
      created:now,updated:now,media:[],tracks:[]};
  }
  async function save(){
    if(!cur)return;
    clearTimeout(timer);cur.updated=Date.now();
    await APK.db.put(cur);dirty=false;emit();
  }
  function markDirty(){if(!cur)return;dirty=true;emit();clearTimeout(timer);timer=setTimeout(()=>dirty&&save(),4000)}
  return{
    size,create,save,markDirty,
    get current(){return cur},get dirty(){return dirty},
    onChange:f=>listeners.push(f),
    async open(p){cur=p;dirty=false;APK.history.clear();emit()},
    close(){clearTimeout(timer);APK.preview&&APK.preview.unload();APK.wave&&APK.wave.clear();APK.media&&APK.media.releaseUrls();cur=null;dirty=false},
    async remove(id){const p=await APK.db.get(id);if(p)for(const m of p.media)await APK.db.delMedia(m.id);await APK.db.del(id)},
    rename(n){if(cur&&n.trim()){cur.name=n.trim();markDirty()}},
    setAspect(a){const q=Math.min(cur.width,cur.height);Object.assign(cur,{aspect:a},size(a,q));markDirty()},
    toFile:()=>new Blob([JSON.stringify(cur)],{type:'application/json'}),
    validate:o=>!!o&&typeof o.name==='string'&&o.width>0&&o.height>0&&o.fps>0&&Array.isArray(o.tracks)&&Array.isArray(o.media)
  };
})();
