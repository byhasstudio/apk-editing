/* SINKRON CLOUD (tanpa Firebase Storage, jadi cukup paket gratis Spark): semua lewat Realtime Database (REST, tanpa SDK).
   Menyalin project Edit Video, project Edit 3D, dan file media-nya ke akun Google yang sedang masuk, supaya muncul di perangkat lain.
   Dimuat paling akhir di index.html. Memakai sesi dari js/auth.js (refresh token "rt").

   DATA DI CLOUD (Realtime Database), di bawah sync/<uid>/
   - projects/<id>   {name, updated, deleted?}   daftar ringan project video (dipakai membandingkan versi)
   - data/<id>       teks JSON isi project video
   - projects3/<id>  daftar ringan project 3D          - data3/<id>   teks JSON isi project 3D
   - mmeta/<2d|3d>/<idMedia>  {name, type, size, n}   info file media
   - mdata/<2d|3d>/<idMedia>/<0..n-1>                 isi file media, dipotong 768 KB per bagian lalu di-base64
   BATAS: file media lebih dari 10 MB TIDAK ikut (kuota gratis Realtime Database cuma 1 GB, dan base64 membengkak sekitar sepertiga).
   File yang tidak ikut ditandai di pesan sinkron; di perangkat lain impor ulang atau pakai Ganti clip.

   ATURAN SINKRON (per project, versi terbaru menang berdasarkan waktu "updated")
   - Hanya di perangkat: diunggah. Hanya di cloud: diunduh. Dua-duanya ada: yang updated-nya lebih baru menang.
   - Project yang sedang terbuka di editor tidak ditimpa dari cloud (hanya boleh diunggah).
   - Hapus project: ikut menghapus salinan cloud (data dan media) dan menulis tanda hapus supaya perangkat lain ikut menghapus.
     Kalau offline, tanda hapus diantre dan dikirim pada sinkron berikutnya.
   KAPAN JALAN: tombol "☁ Sinkron" di beranda, otomatis 2,5 detik setelah aplikasi dibuka, 20 detik setelah project video disimpan,
   4 detik setelah keluar dari Edit 3D, dan tiap 2 menit selama aplikasi terbuka.
   BELUM TERMASUK: preset. Sesi lama tanpa refresh token harus Keluar lalu Masuk lagi. */
(function(){
'use strict';
window.APK=window.APK||{};
if(APK.sync)return;
const KEY='AIzaSyBahNCBMGHzRBTIT4aE2PMHDdTEQVgQkp4';
const DB='https://splineway-default-rtdb.asia-southeast1.firebasedatabase.app';
const CH=786432,MAXMEDIA=10*1048576;   /* 786432 = kelipatan 3, jadi base64 tiap bagian tanpa padding */
const $=id=>document.getElementById(id);
const P=APK.project;
const sess=()=>APK.auth&&APK.auth.session;
const enabled=()=>{const s=sess();return !!(s&&s.rt)};
const safe=s=>String(s).replace(/[.$#\[\]\/]/g,'_');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m){try{APK.app.toast(m)}catch(e){console.log(m)}}
function setLabel(t){const b=$('btn-sync');if(b)b.textContent=t||'☁ Sinkron'}
function http(r,w){const e=new Error((w||'permintaan')+' gagal ('+r.status+')');e.status=r.status;return e}

let tok=null,running=false,again=false,timer=0;

/* ===== token Firebase dari refresh token ===== */
async function token(){
  const s=sess();
  if(!s||!s.rt)throw new Error('norefresh');
  if(tok&&tok.exp>Date.now()+120000)return tok;
  const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+KEY,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(s.rt)});
  if(!r.ok)throw new Error('sesi kedaluwarsa, Keluar lalu Masuk lagi');
  const j=await r.json();
  if('g'+j.user_id!==s.id)throw new Error('akun sesi tidak cocok, Keluar lalu Masuk lagi');
  tok={idToken:j.id_token,uid:j.user_id,exp:Date.now()+(+j.expires_in||3600)*1000};
  return tok;
}

/* ===== Realtime Database ===== */
async function rtdb(method,path,body){
  const t=await token();
  const r=await fetch(DB+'/'+path+'.json?auth='+encodeURIComponent(t.idToken),{method:method,body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok){const e=http(r,'database');if(r.status===401||r.status===403)e.message='Rules Realtime Database belum dipasang (blok "sync" versi terbaru)';throw e}
  return r.json();
}

/* ===== catatan lokal: antrean hapus dan media yang sudah di cloud ===== */
const QK=uid=>'splineway:sync:del:'+uid,HK=uid=>'splineway:sync:have2:'+uid;
function loadJ(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function saveJ(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

/* ===== IndexedDB Edit 3D (sama dengan js/scene3d.js: apk-3d, versi 1) ===== */
let d3p;
function open3(){return d3p||(d3p=new Promise((res,rej)=>{
  const r=indexedDB.open('apk-3d',1);
  r.onupgradeneeded=()=>{const d=r.result;
    if(!d.objectStoreNames.contains('scenes'))d.createObjectStore('scenes',{keyPath:'id'});
    if(!d.objectStoreNames.contains('media'))d.createObjectStore('media',{keyPath:'id'})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
}))}
async function tx3(st,mode,fn){
  const d=await open3();
  return new Promise((res,rej)=>{const t=d.transaction(st,mode),o=fn(t.objectStore(st));
    t.oncomplete=()=>res(o.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)});
}

/* ===== dua jenis project: d2 = Edit Video, d3 = Edit 3D ===== */
const origRemove=P.remove;
const isPh=x=>/^ph\d+$/.test(String(x));
const A={
  d2:{ms:'2d',list:'projects',data:'data',
    all:()=>APK.db.all(),put:o=>APK.db.put(o),del:id=>origRemove.call(P,id),
    valid:o=>P.validate(o),
    mids:p=>(p.media||[]).map(m=>({id:m.id,name:m.name,type:m.mime})),
    getM:id=>APK.db.getMedia(id),
    putM:(id,meta,blob,pid)=>APK.db.putMedia({id:id,projectId:pid,blob:meta.type&&!blob.type?new Blob([blob],{type:meta.type}):blob}),
    openId:()=>{const c=P.current;return c&&c.id}},
  d3:{ms:'3d',list:'projects3',data:'data3',
    all:async()=>(await tx3('scenes','readonly',s=>s.getAll()))||[],
    get:id=>tx3('scenes','readonly',s=>s.get(id)),
    put:o=>tx3('scenes','readwrite',s=>s.put(o)),del:id=>tx3('scenes','readwrite',s=>s.delete(id)),
    valid:o=>!!(o&&typeof o.id==='string'&&Array.isArray(o.items)&&o.items.length>=2),
    mids:p=>{const a=(p.items||[]).map(i=>i.mediaId).filter(x=>x&&!isPh(x));if(p.music&&!isPh(p.music))a.push(p.music);return [...new Set(a)].map(id=>({id:id}))},
    getM:id=>tx3('media','readonly',s=>s.get(id)),
    putM:(id,meta,blob)=>tx3('media','readwrite',s=>s.put({id:id,name:meta.name||'media',type:meta.type||blob.type||'',blob:blob})),
    openId:()=>{const s=APK.s3d&&APK.s3d.scene;return s&&s.id}}
};

/* ===== konversi file <-> teks base64 ===== */
function toB64(b){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result);res(s.slice(s.indexOf(',')+1))};r.onerror=()=>rej(r.error);r.readAsDataURL(b)})}
function fromB64(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}

/* ===== media ===== */
async function pushMedia(k,uid,m,label,st){
  const a=A[k],id=safe(m.id),hk=k+':'+id,have=new Set(loadJ(HK(uid),[]));
  if(have.has(hk))return;
  const rec=await a.getM(m.id);
  if(!rec||!rec.blob)return;
  const blob=rec.blob;
  if(blob.size>MAXMEDIA){st.big++;return}
  const base='sync/'+uid+'/';
  const meta=await rtdb('GET',base+'mmeta/'+a.ms+'/'+id);
  if(!meta||+meta.size!==blob.size){
    const n=Math.max(1,Math.ceil(blob.size/CH)),nm=String(m.name||rec.name||'media').slice(0,14);
    for(let i=0;i<n;i++){
      setLabel('☁ '+label+' · '+Math.round(i/n*100)+'% · '+nm);
      const b64=await toB64(blob.slice(i*CH,Math.min(blob.size,(i+1)*CH)));
      await rtdb('PUT',base+'mdata/'+a.ms+'/'+id+'/'+i,b64);
    }
    await rtdb('PUT',base+'mmeta/'+a.ms+'/'+id,{name:String(m.name||rec.name||'').slice(0,120),type:String(m.type||rec.type||blob.type||'').slice(0,100),size:blob.size,n:n});
  }
  const h2=new Set(loadJ(HK(uid),[]));h2.add(hk);saveJ(HK(uid),[...h2].slice(-5000));
}
async function pullMedia(k,uid,m,pid,label,st){
  const a=A[k],id=safe(m.id);
  if(await a.getM(m.id))return;
  const base='sync/'+uid+'/',meta=await rtdb('GET',base+'mmeta/'+a.ms+'/'+id);
  if(!meta||!(+meta.n>0)){st.miss++;return}
  const parts=[],nm=String(meta.name||m.name||'media').slice(0,14);
  for(let i=0;i<meta.n;i++){
    setLabel('☁ '+label+' · unduh '+Math.round(i/meta.n*100)+'% · '+nm);
    const s=await rtdb('GET',base+'mdata/'+a.ms+'/'+id+'/'+i);
    if(typeof s!=='string')throw new Error('bagian media di cloud hilang');
    parts.push(fromB64(s));
  }
  await a.putM(m.id,meta,new Blob(parts,{type:meta.type||''}),pid);
  const have=new Set(loadJ(HK(uid),[]));have.add(k+':'+id);saveJ(HK(uid),[...have].slice(-5000));
}

/* ===== satu project: unggah / unduh ===== */
async function pushProject(k,p,uid,label,st){
  const a=A[k];
  for(const m of a.mids(p)){   /* gagal satu media tidak menahan project */
    try{await pushMedia(k,uid,m,label,st)}catch(e){st.merr++;if(!st.firstErr)st.firstErr=explain(e);console.warn('Unggah media gagal',m.id,e)}
  }
  await rtdb('PUT','sync/'+uid+'/'+a.data+'/'+p.id,JSON.stringify(p));   /* isi dulu, daftar belakangan */
  await rtdb('PUT','sync/'+uid+'/'+a.list+'/'+p.id,{name:String(p.name||'Project').slice(0,120),updated:p.updated});
}
async function pullProject(k,id,uid,label,st){
  const a=A[k],s=await rtdb('GET','sync/'+uid+'/'+a.data+'/'+id);
  if(typeof s!=='string')throw new Error('data project di cloud tidak ditemukan');
  let o;try{o=JSON.parse(s)}catch(e){throw new Error('data project di cloud rusak')}
  if(!a.valid(o))throw new Error('data project di cloud tidak valid');
  for(const m of a.mids(o)){
    try{await pullMedia(k,uid,m,o.id,label,st)}catch(e){st.miss++;if(!st.firstErr)st.firstErr=explain(e);console.warn('Unduh media gagal',m.id,e)}
  }
  await a.put(o);
}

/* ===== hapus ===== */
function queueDelete(k,id,mids){
  const s=sess();if(!(s&&s.rt))return;
  const uid=s.id.slice(1),q=loadJ(QK(uid),[]);
  q.push({k:k,id:id,mids:mids||[],ts:Date.now()});saveJ(QK(uid),q);
  schedule(4000);
}
P.remove=async function(id){
  let mids=[];
  try{const p=await APK.db.get(id);if(p)mids=A.d2.mids(p).map(m=>m.id)}catch(e){}
  await origRemove.call(P,id);
  queueDelete('d2',id,mids);
};
/* hapus project 3D dilakukan di js/scene3d.js (tombol Hapus di beranda), jadi dipantau dari klik tombolnya */
document.addEventListener('click',function(e){
  const b=e.target&&e.target.closest&&e.target.closest('[data-s3del]');
  if(!b)return;
  const id=b.dataset.s3del,pend=A.d3.get(id).catch(()=>null);
  setTimeout(async function(){
    try{
      if(await A.d3.get(id))return;   /* tidak jadi dihapus (dibatalkan) */
      const sc=await pend;
      queueDelete('d3',id,sc?A.d3.mids(sc).map(m=>m.id):[]);
    }catch(x){}
  },2500);
},true);
async function flushDeletes(uid){
  const q=loadJ(QK(uid),[]);if(!q.length)return 0;
  const left=[],have=new Set(loadJ(HK(uid),[]));let n=0;
  for(const d of q){
    const k=d.k==='d3'?'d3':'d2',a=A[k];
    try{
      for(const mid of d.mids||[]){
        const id=safe(mid);
        await rtdb('DELETE','sync/'+uid+'/mdata/'+a.ms+'/'+id);
        await rtdb('DELETE','sync/'+uid+'/mmeta/'+a.ms+'/'+id);
        have.delete(k+':'+id);
      }
      await rtdb('DELETE','sync/'+uid+'/'+a.data+'/'+d.id);
      await rtdb('PUT','sync/'+uid+'/'+a.list+'/'+d.id,{name:'-',updated:d.ts,deleted:true});
      n++;
    }catch(e){left.push(d)}
  }
  saveJ(HK(uid),[...have].slice(-5000));
  saveJ(QK(uid),left);
  return n;
}

/* ===== daftar project 3D di beranda (salinan dari js/scene3d.js, supaya langsung terlihat setelah unduh) ===== */
async function renderHome3d(){
  const box=$('s3d-list'),h=$('s3d-h');if(!box||!h)return;
  let all=[];try{all=((await A.d3.all())||[]).sort((a,b)=>b.updated-a.updated)}catch(e){}
  h.hidden=box.hidden=!all.length;
  box.innerHTML=all.map(p=>`<div class="card" data-s3="${p.id}"><div class="thumb"><i style="width:80%;height:80%;border-color:#4b5bd6">3D · ${esc(p.aspect)}</i></div>
    <div class="card-body"><b>${esc(p.name)}</b><small>${p.items.length-2} layer · ${p.dur} dtk</small>
    <div class="card-foot"><small>Diedit ${new Date(p.updated).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</small><button class="btn danger" data-s3del="${p.id}">Hapus</button></div></div></div>`).join('');
}

/* ===== sinkron utama ===== */
function explain(e){
  const m=(e&&e.message)||String(e);
  if(m==='norefresh')return 'Keluar lalu Masuk lagi dengan Google untuk mengaktifkan sinkron';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Tidak ada koneksi internet';
  return m;
}
async function syncKind(k,uid,st){
  const a=A[k],remote=(await rtdb('GET','sync/'+uid+'/'+a.list))||{};
  const locals=await a.all(),lmap=new Map(locals.map(p=>[p.id,p]));
  const ids=[...new Set([...Object.keys(remote),...lmap.keys()])],openId=a.openId();
  let i=0;
  for(const id of ids){
    i++;const label=(k==='d3'?'3D ':'')+i+'/'+ids.length;
    const L=lmap.get(id),R=remote[id];
    try{
      if(R&&R.deleted&&L&&L.updated<=R.updated){
        if(id!==openId){await a.del(id);st.del++;st.chg[k]=1}
      }else if(L&&(!R||L.updated>R.updated)){
        setLabel('☁ '+label);await pushProject(k,L,uid,label,st);st.up++;
      }else if(R&&!R.deleted&&(!L||R.updated>L.updated)&&id!==openId){
        setLabel('☁ '+label);await pullProject(k,id,uid,label,st);st.down++;st.chg[k]=1;
      }
    }catch(e){st.fail++;if(!st.firstErr)st.firstErr=explain(e);console.warn('Sinkron gagal untuk',id,e)}
  }
}
async function sync(opts){
  opts=opts||{};
  if(running){again=true;return}
  if(!enabled()){if(opts.manual)toast('Keluar lalu Masuk lagi dengan Google untuk mengaktifkan sinkron');return}
  if(!navigator.onLine){if(opts.manual)toast('Tidak ada koneksi internet');return}
  running=true;setLabel('☁ Memeriksa…');
  const st={up:0,down:0,del:0,fail:0,miss:0,big:0,merr:0,firstErr:'',chg:{}};
  try{
    const t=await token(),uid=t.uid;
    st.del+=await flushDeletes(uid);
    await syncKind('d2',uid,st);
    await syncKind('d3',uid,st);
  }catch(e){
    st.fail++;st.firstErr=explain(e);console.warn('Sinkron gagal',e);
  }finally{
    running=false;setLabel();
  }
  if(st.chg.d2){const h=$('home');if(h&&!h.hidden&&APK.app&&APK.app.renderHome)APK.app.renderHome()}
  if(st.chg.d3||st.del)renderHome3d();
  const notes=(st.big?'. '+st.big+' media lebih dari 10 MB tidak ikut':'')+(st.miss?'. '+st.miss+' media belum ada di perangkat ini, impor ulang atau pakai Ganti clip':'');
  if(st.fail)toast('Sinkron bermasalah: '+st.firstErr);
  else if(st.merr)toast('Sinkron selesai, tapi ada media gagal: '+st.firstErr+notes);
  else if(st.up||st.down||st.del)toast('Sinkron selesai: '+st.up+' diunggah, '+st.down+' diunduh'+(st.del?', '+st.del+' dihapus':'')+notes);
  else if(opts.manual)toast('Sudah sinkron'+notes);
  if(again){again=false;schedule(1500)}
}
function schedule(ms){
  clearTimeout(timer);
  if(!enabled())return;
  timer=setTimeout(()=>sync({auto:true}),ms);
}

/* ===== tombol dan pemicu ===== */
function mountBtn(){
  const a=document.querySelector('.home-head .actions');
  if(!a||$('btn-sync'))return;
  const b=document.createElement('button');
  b.className='btn';b.id='btn-sync';b.textContent='☁ Sinkron';
  b.title='Sinkronkan project video, project 3D, dan media (maks 10 MB per file) dengan akun Google ini, agar muncul di perangkat lain';
  b.onclick=()=>sync({manual:true});
  a.insertBefore(b,a.firstChild);
}
mountBtn();
P.onChange((p,d)=>{if(d){clearTimeout(timer)}else if(p)schedule(20000)});
document.addEventListener('click',function(e){if(e.target&&e.target.closest&&e.target.closest('#s3-back'))schedule(4000)},true);   /* keluar dari Edit 3D */
window.addEventListener('online',()=>schedule(2000));
setInterval(()=>{if(!document.hidden&&enabled())schedule(500)},120000);
if(enabled())setTimeout(()=>sync({auto:true}),2500);
APK.sync={run:sync,enabled:enabled};
})();
