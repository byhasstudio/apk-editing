/* IndexedDB: project (metadata) dan media (blob file asli, tidak diubah) */
window.APK=window.APK||{};
APK.db=(function(){
  let dbp;
  function open(){
    if(dbp)return dbp;
    dbp=new Promise((res,rej)=>{
      const r=indexedDB.open('apk-editing',2);
      r.onupgradeneeded=()=>{
        const d=r.result;
        if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects',{keyPath:'id'});
        if(!d.objectStoreNames.contains('media'))d.createObjectStore('media',{keyPath:'id'});
      };
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>rej(r.error);
    });
    return dbp;
  }
  async function tx(store,mode,fn){
    const db=await open();
    return new Promise((res,rej)=>{
      const t=db.transaction(store,mode),out=fn(t.objectStore(store));
      t.oncomplete=()=>res(out.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);
    });
  }
  return{
    put:p=>tx('projects','readwrite',s=>s.put(p)),
    get:id=>tx('projects','readonly',s=>s.get(id)),
    del:id=>tx('projects','readwrite',s=>s.delete(id)),
    all:async()=>((await tx('projects','readonly',s=>s.getAll()))||[]).sort((a,b)=>b.updated-a.updated),
    putMedia:m=>tx('media','readwrite',s=>s.put(m)),
    getMedia:id=>tx('media','readonly',s=>s.get(id)),
    delMedia:id=>tx('media','readwrite',s=>s.delete(id))
  };
})();
