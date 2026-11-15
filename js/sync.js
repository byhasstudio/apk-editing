/* SINKRON CLOUD (tanpa Firebase Storage, jadi cukup paket gratis Spark): salin DATA project ke akun Google yang sedang masuk, supaya project yang sama muncul di perangkat lain.
   Dimuat paling akhir di index.html. Memakai sesi dari js/auth.js (refresh token "rt"), tanpa SDK: semua lewat REST ke Realtime Database.

   DATA DI CLOUD (Realtime Database)
   - sync/<uid>/projects/<id> = {name, updated, deleted?}   (daftar ringan, dipakai membandingkan versi)
   - sync/<uid>/data/<id>     = teks JSON isi project       (timeline, efek, keyframe, metadata media; disimpan sebagai teks supaya aman dari aturan nama kunci)
   FILE MEDIA ASLI (video, foto, audio) TIDAK ikut disinkronkan, karena terlalu besar untuk database. Di perangkat lain, project muncul lengkap
   tapi media-nya kosong: impor ulang file yang sama, atau pakai fitur Ganti clip.

   ATURAN SINKRON (per project, versi terbaru menang berdasarkan waktu "updated")
   - Hanya di perangkat: diunggah. Hanya di cloud: diunduh. Dua-duanya ada: yang updated-nya lebih baru menang.
   - Project yang sedang terbuka di editor tidak ditimpa dari cloud (hanya boleh diunggah).
   - Hapus project: ikut menghapus salinan cloud dan menulis tanda hapus supaya perangkat lain ikut menghapus. Kalau sedang offline, tanda hapus
     diantre dan dikirim pada sinkron berikutnya.
   KAPAN JALAN: tombol "☁ Sinkron" di beranda, otomatis 2,5 detik setelah aplikasi dibuka, dan 20 detik setelah project terakhir disimpan.
   BELUM TERMASUK: project Edit 3D dan preset (masih hanya di perangkat). Sesi lama tanpa refresh token harus Keluar lalu Masuk lagi. */
(function(){
'use strict';
window.APK=window.APK||{};
if(APK.sync)return;
const KEY='AIzaSyBahNCBMGHzRBTIT4aE2PMHDdTEQVgQkp4';
const DB='https://splineway-default-rtdb.asia-southeast1.firebasedatabase.app';
const $=id=>document.getElementById(id);
const P=APK.project;
const sess=()=>APK.auth&&APK.auth.session;
const enabled=()=>{const s=sess();return !!(s&&s.rt)};
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
  if(!r.ok){const e=http(r,'database');if(r.status===401||r.status===403)e.message='Rules Realtime Database belum dipasang (blok "sync"), atau project terlalu besar';throw e}
  return r.json();
}

/* ===== catatan lokal: antrean hapus ===== */
const QK=uid=>'splineway:sync:del:'+uid;
function loadJ(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function saveJ(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

/* ===== satu project: unggah / unduh ===== */
async function pushProject(p,uid){
  /* isi dulu, daftar belakangan: daftar tidak pernah menunjuk ke data yang belum ada */
  await rtdb('PUT','sync/'+uid+'/data/'+p.id,JSON.stringify(p));
  await rtdb('PUT','sync/'+uid+'/projects/'+p.id,{name:String(p.name||'Project').slice(0,120),updated:p.updated});
}
async function pullProject(id,uid){
  const s=await rtdb('GET','sync/'+uid+'/data/'+id);
  if(typeof s!=='string')throw new Error('data project di cloud tidak ditemukan');
  let o;
  try{o=JSON.parse(s)}catch(e){throw new Error('data project di cloud rusak')}
  if(!P.validate(o))throw new Error('data project di cloud tidak valid');
  let missing=0;
  for(const m of o.media||[]){
    try{if(!(await APK.db.getMedia(m.id)))missing++}catch(e){missing++}
  }
  await APK.db.put(o);
  return missing;
}

/* ===== hapus ===== */
const origRemove=P.remove;
P.remove=async function(id){
  await origRemove.call(P,id);
  const s=sess();
  if(s&&s.rt){
    const uid=s.id.slice(1);
    const q=loadJ(QK(uid),[]);q.push({id:id,ts:Date.now()});saveJ(QK(uid),q);
    schedule(4000);
  }
};
async function flushDeletes(uid){
  const q=loadJ(QK(uid),[]);if(!q.length)return 0;
  const left=[];let n=0;
  for(const d of q){
    try{
      await rtdb('DELETE','sync/'+uid+'/data/'+d.id);
      await rtdb('PUT','sync/'+uid+'/projects/'+d.id,{name:'-',updated:d.ts,deleted:true});
      n++;
    }catch(e){left.push(d)}
  }
  saveJ(QK(uid),left);
  return n;
}

/* ===== sinkron utama ===== */
function explain(e){
  const m=(e&&e.message)||String(e);
  if(m==='norefresh')return 'Keluar lalu Masuk lagi dengan Google untuk mengaktifkan sinkron';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Tidak ada koneksi internet';
  return m;
}
async function sync(opts){
  opts=opts||{};
  if(running){again=true;return}
  if(!enabled()){if(opts.manual)toast('Keluar lalu Masuk lagi dengan Google untuk mengaktifkan sinkron');return}
  if(!navigator.onLine){if(opts.manual)toast('Tidak ada koneksi internet');return}
  running=true;setLabel('☁ Memeriksa…');
  let up=0,down=0,del=0,fail=0,miss=0,firstErr='';
  try{
    const t=await token(),uid=t.uid;
    del+=await flushDeletes(uid);
    const remote=(await rtdb('GET','sync/'+uid+'/projects'))||{};
    const locals=await APK.db.all();
    const lmap=new Map(locals.map(p=>[p.id,p]));
    const ids=[...new Set([...Object.keys(remote),...lmap.keys()])];
    const cur=P.current,openId=cur&&cur.id;
    let i=0;
    for(const id of ids){
      i++;const label=i+'/'+ids.length;
      const L=lmap.get(id),R=remote[id];
      try{
        if(R&&R.deleted&&L&&L.updated<=R.updated){
          if(id!==openId){await origRemove.call(P,id);del++}
        }else if(L&&(!R||L.updated>R.updated)){
          setLabel('☁ '+label);await pushProject(L,uid);up++;
        }else if(R&&!R.deleted&&(!L||R.updated>L.updated)&&id!==openId){
          setLabel('☁ '+label);miss+=await pullProject(id,uid);down++;
        }
      }catch(e){fail++;if(!firstErr)firstErr=explain(e);console.warn('Sinkron gagal untuk',id,e)}
    }
  }catch(e){
    fail++;firstErr=explain(e);console.warn('Sinkron gagal',e);
  }finally{
    running=false;setLabel();
  }
  if(down||del){const h=$('home');if(h&&!h.hidden&&APK.app&&APK.app.renderHome)APK.app.renderHome()}
  if(fail)toast('Sinkron bermasalah: '+firstErr);
  else if(up||down||del)toast('Sinkron selesai: '+up+' diunggah, '+down+' diunduh'+(del?', '+del+' dihapus':'')+(miss?'. '+miss+' media belum ada di perangkat ini, impor ulang atau pakai Ganti clip':''));
  else if(opts.manual)toast('Sudah sinkron');
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
  b.title='Sinkronkan data project dengan akun Google ini (file media tidak ikut), agar muncul di perangkat lain';
  b.onclick=()=>sync({manual:true});
  a.insertBefore(b,a.firstChild);
}
mountBtn();
P.onChange((p,d)=>{if(d){clearTimeout(timer)}else if(p)schedule(20000)});
window.addEventListener('online',()=>schedule(2000));
if(enabled())setTimeout(()=>sync({auto:true}),2500);
APK.sync={run:sync,enabled:enabled};
})();
