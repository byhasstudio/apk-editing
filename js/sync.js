/* SINKRON CLOUD: salin project (data + media) ke akun Google yang sedang masuk, supaya project yang sama muncul di perangkat lain.
   Dimuat paling akhir di index.html. Memakai sesi dari js/auth.js (refresh token "rt"), tanpa SDK: semua lewat REST.

   DATA DI CLOUD
   - Realtime Database  sync/<uid>/projects/<id> = {name, updated, deleted?}          (daftar ringan, dipakai membandingkan versi)
   - Storage            users/<uid>/projects/<id>.json                                (isi project: timeline, efek, metadata media)
   - Storage            users/<uid>/media/<idMedia>                                   (file media asli, diunggah sekali saja)
   Bucket Storage dideteksi otomatis (splineway.firebasestorage.app atau splineway.appspot.com) lalu diingat di perangkat ini.

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
const BUCKETS=['splineway.firebasestorage.app','splineway.appspot.com'];
const BK='splineway:sync:bucket';
const $=id=>document.getElementById(id);
const P=APK.project;
const sess=()=>APK.auth&&APK.auth.session;
const enabled=()=>{const s=sess();return !!(s&&s.rt)};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mb=b=>b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB';
function toast(m){try{APK.app.toast(m)}catch(e){console.log(m)}}
function setLabel(t){const b=$('btn-sync');if(b)b.textContent=t||'☁ Sinkron'}
function http(r,w){const e=new Error((w||'permintaan')+' gagal ('+r.status+')');e.status=r.status;return e}

let tok=null,bucket=null,running=false,again=false,timer=0;

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

/* ===== Realtime Database (daftar versi) ===== */
async function rtdb(method,path,body){
  const t=await token();
  const r=await fetch(DB+'/'+path+'.json?auth='+encodeURIComponent(t.idToken),{method:method,body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok){const e=http(r,'database');if(r.status===401||r.status===403)e.message='Rules Realtime Database belum dipasang (blok "sync")';throw e}
  return r.json();
}

/* ===== Storage (REST) ===== */
const base=()=>'https://firebasestorage.googleapis.com/v0/b/'+bucket+'/o';
async function getBucket(){
  if(bucket)return bucket;
  const t=await token();
  let saved='';try{saved=localStorage.getItem(BK)||''}catch(e){}
  for(const b of saved?[saved]:BUCKETS){
    const r=await fetch('https://firebasestorage.googleapis.com/v0/b/'+b+'/o?maxResults=1&prefix='+encodeURIComponent('users/'+t.uid+'/'),{headers:{Authorization:'Firebase '+t.idToken}});
    if(r.ok||r.status===403||r.status===401){
      if(!r.ok)throw new Error('Rules Storage belum dipasang (atau menolak akun ini)');
      bucket=b;try{localStorage.setItem(BK,b)}catch(e){}
      return b;
    }
  }
  throw new Error('Firebase Storage belum aktif di project splineway');
}
async function head(path){
  const t=await token();
  const r=await fetch(base()+'/'+encodeURIComponent(path),{headers:{Authorization:'Firebase '+t.idToken}});
  if(r.status===404)return null;
  if(!r.ok)throw http(r,'cek file');
  return r.json();
}
async function put(path,blob,mime,prog){
  mime=mime||'application/octet-stream';
  const t=await token();
  const init=await fetch(base()+'?name='+encodeURIComponent(path),{method:'POST',headers:{
    'Authorization':'Firebase '+t.idToken,
    'Content-Type':'application/json;charset=utf-8',
    'X-Goog-Upload-Protocol':'resumable',
    'X-Goog-Upload-Command':'start',
    'X-Goog-Upload-Header-Content-Length':String(blob.size),
    'X-Goog-Upload-Header-Content-Type':mime
  },body:JSON.stringify({name:path,contentType:mime})});
  if(!init.ok)throw http(init,'mulai unggah');
  const url=init.headers.get('x-goog-upload-url');
  if(!url)throw new Error('alamat unggah tidak diterima');
  const CH=8*1048576,n=blob.size;
  let off=0;
  do{
    const end=Math.min(off+CH,n),last=end>=n;
    for(let tries=0;;){
      try{
        const r=await fetch(url,{method:'POST',headers:{'X-Goog-Upload-Command':last?'upload, finalize':'upload','X-Goog-Upload-Offset':String(off)},body:blob.slice(off,end)});
        if(!r.ok)throw http(r,'unggah');
        break;
      }catch(e){if(++tries>=3)throw e;await sleep(1500*tries)}
    }
    off=end;if(prog)prog(off,n);
  }while(off<n);
}
async function getBlob(path){
  const t=await token();
  const r=await fetch(base()+'/'+encodeURIComponent(path)+'?alt=media',{headers:{Authorization:'Firebase '+t.idToken}});
  if(!r.ok)throw http(r,'unduh');
  return r.blob();
}
async function removeObj(path){
  const t=await token();
  const r=await fetch(base()+'/'+encodeURIComponent(path),{method:'DELETE',headers:{Authorization:'Firebase '+t.idToken}});
  if(!r.ok&&r.status!==404)throw http(r,'hapus file');
}

/* ===== catatan lokal: media yang sudah di cloud, dan antrean hapus ===== */
const SK=uid=>'splineway:sync:media:'+uid,QK=uid=>'splineway:sync:del:'+uid;
function loadJ(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?d:v}catch(e){return d}}
function saveJ(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}

/* ===== satu project: unggah / unduh ===== */
async function pushProject(p,uid,label){
  const have=new Set(loadJ(SK(uid),[]));
  for(const m of p.media||[]){
    if(have.has(m.id))continue;
    const rec=await APK.db.getMedia(m.id);
    if(!rec||!rec.blob)continue;
    const path='users/'+uid+'/media/'+m.id;
    const meta=await head(path);
    if(!meta||+meta.size!==rec.blob.size){
      await put(path,rec.blob,m.mime||rec.blob.type,(o,n)=>setLabel('☁ '+label+' · '+Math.round(o/n*100)+'% · '+(m.name||'media').slice(0,14)));
    }
    have.add(m.id);saveJ(SK(uid),[...have].slice(-5000));
  }
  await put('users/'+uid+'/projects/'+p.id+'.json',new Blob([JSON.stringify(p)],{type:'application/json'}),'application/json');
  await rtdb('PUT','sync/'+uid+'/projects/'+p.id,{name:String(p.name||'Project').slice(0,120),updated:p.updated});
}
async function pullProject(id,uid,label){
  const o=JSON.parse(await (await getBlob('users/'+uid+'/projects/'+id+'.json')).text());
  if(!P.validate(o))throw new Error('data project di cloud tidak valid');
  const have=new Set(loadJ(SK(uid),[]));
  for(const m of o.media||[]){
    if(await APK.db.getMedia(m.id)){have.add(m.id);continue}
    setLabel('☁ '+label+' · mengunduh '+(m.name||'media').slice(0,14));
    const b=await getBlob('users/'+uid+'/media/'+m.id);
    await APK.db.putMedia({id:m.id,projectId:o.id,blob:m.mime&&!b.type?new Blob([b],{type:m.mime}):b});
    have.add(m.id);
  }
  saveJ(SK(uid),[...have].slice(-5000));
  await APK.db.put(o);
}

/* ===== hapus ===== */
const origRemove=P.remove;
P.remove=async function(id){
  let mids=[];
  try{const p=await APK.db.get(id);if(p&&Array.isArray(p.media))mids=p.media.map(m=>m.id)}catch(e){}
  await origRemove.call(P,id);
  const s=sess();
  if(s&&s.rt){
    const q=loadJ(QK(s.id.slice(1)),[]);q.push({id:id,mids:mids,ts:Date.now()});saveJ(QK(s.id.slice(1)),q);
    schedule(4000);
  }
};
async function flushDeletes(uid){
  const q=loadJ(QK(uid),[]);if(!q.length)return 0;
  const left=[];let n=0;
  for(const d of q){
    try{
      for(const mid of d.mids||[])await removeObj('users/'+uid+'/media/'+mid);
      await removeObj('users/'+uid+'/projects/'+d.id+'.json');
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
  let up=0,down=0,del=0,fail=0,firstErr='';
  try{
    const t=await token(),uid=t.uid;
    await getBucket();
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
          setLabel('☁ '+label);await pushProject(L,uid,label);up++;
        }else if(R&&!R.deleted&&(!L||R.updated>L.updated)&&id!==openId){
          setLabel('☁ '+label);await pullProject(id,uid,label);down++;
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
  else if(up||down||del)toast('Sinkron selesai: '+up+' diunggah, '+down+' diunduh'+(del?', '+del+' dihapus':''));
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
  b.title='Sinkronkan project (data dan media) dengan akun Google ini, agar muncul di perangkat lain';
  b.onclick=()=>sync({manual:true});
  a.insertBefore(b,a.firstChild);
}
mountBtn();
P.onChange((p,d)=>{if(d){clearTimeout(timer)}else if(p)schedule(20000)});
window.addEventListener('online',()=>schedule(2000));
if(enabled())setTimeout(()=>sync({auto:true}),2500);
APK.sync={run:sync,enabled:enabled};
})();
