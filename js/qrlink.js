/* QR link: bagikan preset lewat SATU QR berisi link (preset disimpan di Firebase Realtime Database lewat REST, tanpa SDK).
   Dimuat setelah js/qrpreset.js. Menambah tombol "Buat link QR" di dialog ▣ QR, dan membuka link berbentuk  .../#p=<ID>.

   CARA KERJA
   1) BUAT: file preset yang SAMA dengan tombol "⬇ Preset" (2D) / "Simpan preset" (3D) diambil sebagai byte, dikompres gzip bila lebih kecil,
      diubah ke base64, lalu dikirim ke Firebase sebagai presets/<ID> = {name, data, created, ttl, owner}. data = "<jenis>.<gzip 0/1>.<base64>".
      ID dibuat acak 20 karakter (tidak bisa ditebak, dan daftar preset tidak bisa dibaca orang lain). Link = alamat halaman ini + "#p=" + ID.
   2) BUKA: link dibuka (scan QR pakai kamera HP, atau tempel link di tab Scan QR). Preset diunduh dari  <DB>/presets/<ID>.json,
      dibuka kembali, lalu tampil pratinjau dengan tombol Buka / Simpan file / Batal.

   MASA BERLAKU
   - Pembuat memilih lama berlaku (1 sampai 30 hari). ttl dalam hari; created = waktu SERVER. Rules menolak membaca preset kalau created + ttl sudah lewat,
     jadi link mati tepat waktu.
   - Realtime Database tidak punya penghapus terjadwal, jadi file fisik dihapus dengan dua cara: (a) perangkat pembuat menyapu preset miliknya yang sudah
     lewat masa berlaku setiap editor dibuka (daftar disimpan di localStorage), (b) siapa pun yang membuka link yang sudah mati ikut menghapusnya
     (Rules mengizinkan menghapus preset yang sudah kedaluwarsa).

   KEAMANAN (pasangan dengan Rules database)
   - Menulis butuh login anonim Firebase (Identity Toolkit REST). Token disimpan di localStorage perangkat ini.
   - Satu akun anonim hanya boleh menambah 1 preset per 30 detik (users/<uid>/last, ditulis atomik bersama presets/<ID>, dicek Rules dengan waktu server).
   - Isi dibatasi: field name/data/created/ttl/owner saja, data < 8 juta karakter, created dan owner dicek server, preset tidak bisa diubah.
   - Pemilik (akun anonim yang sama) bisa menghapus presetnya lewat tombol "Hapus link ini". */
(function(){
'use strict';
window.APK=window.APK||{};
const DB='https://splineway-default-rtdb.asia-southeast1.firebasedatabase.app';
const KEY='AIzaSyBahNCBMGHzRBTIT4aE2PMHDdTEQVgQkp4';   /* kunci web Firebase: bukan rahasia, tapi sebaiknya dibatasi ke domain github.io di Google Cloud */
const AUTHK='apk-qrlink-auth',MINEK='apk-qrlink-mine';
const MAXPACK=5500000;   /* byte setelah kompres (base64 +33% harus tetap < 8 juta karakter sesuai Rules) */
const DAY=86400000;
const $=id=>document.getElementById(id);
const TE=new TextEncoder(),TD=new TextDecoder();
function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),4200)}
const mb=b=>b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB';
const fmtDate=ms=>new Date(ms).toLocaleString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

/* ===== gzip + base64 ===== */
async function pipe(u,stream){
  const w=stream.writable.getWriter();w.write(u);w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const gzip=u=>pipe(u,new CompressionStream('gzip'));
const gunzip=u=>{if(typeof DecompressionStream!=='function')throw new Error('browser ini tidak bisa membuka data terkompresi (gzip)');return pipe(u,new DecompressionStream('gzip'))};
function b64enc(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
function b64dec(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u}

/* ===== sumber preset (sama dengan js/qrpreset.js) ===== */
const inS3d=()=>{const v=$('s3d');return!!v&&!v.hidden};
const safe=s=>(String(s||'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'preset');
function idb(store,id){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('apk-3d');
    r.onerror=()=>rej(r.error);
    r.onsuccess=()=>{
      const d=r.result;
      try{const q=d.transaction(store,'readonly').objectStore(store).get(id);q.onsuccess=()=>{d.close();res(q.result)};q.onerror=()=>{d.close();rej(q.error)}}
      catch(e){d.close();rej(e)}
    };
  });
}
const readURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
function defaultName(){
  if(inS3d()){const s=APK.s3d&&APK.s3d.scene;return(s&&s.name)||'Preset 3D'}
  const p=APK.project&&APK.project.current;return(p&&p.name)||'Preset';
}
async function source2d(name,withMedia){
  const p=APK.project&&APK.project.current;
  if(!p||!APK.presets||!APK.timeline)throw new Error('Buka project dulu');
  const sel=APK.timeline.selectedIds(),all=sel.length<2,ids=all?p.tracks.flatMap(t=>t.clips.map(c=>c.id)):sel;
  if(!ids.length)throw new Error('Belum ada layer di project ini');
  const r=APK.presets.pack(p,ids,name);
  if(!r.o)throw new Error('Tidak ada layer yang bisa disimpan');
  if(!withMedia)r.media=0;
  const b=await APK.presets.build(p,r,safe(name));
  return{blob:b.blob,kind:'2'};
}
async function source3d(name,withMedia){
  const s=APK.s3d&&APK.s3d.scene;
  if(!s)throw new Error('Buka project 3D dulu');
  const scene=JSON.parse(JSON.stringify({name,aspect:s.aspect,dur:s.dur,music:s.music||null,cuts:s.cuts||[],items:s.items}));
  const pkg={format:'apk-preset',kind:'edit3d',version:1,name,created:Date.now(),scene};
  if(withMedia){
    const ids=new Set();
    s.items.forEach(i=>{if((i.kind==='image'||i.kind==='video')&&i.mediaId&&!/^ph\d+$/.test(i.mediaId))ids.add(i.mediaId)});
    if(s.music)ids.add(s.music);
    pkg.media={};
    for(const id of ids){const r=await idb('media',id);if(r&&r.blob)pkg.media[id]={name:r.name||'media',type:r.type||r.blob.type||'',data:await readURL(r.blob)}}
  }
  return{blob:new Blob([JSON.stringify(pkg)],{type:'application/octet-stream'}),kind:'3'};
}

/* ===== login anonim Firebase (REST) ===== */
function loadAuth(){try{return JSON.parse(localStorage.getItem(AUTHK)||'null')}catch(_){return null}}
function saveAuth(a){try{localStorage.setItem(AUTHK,JSON.stringify(a))}catch(_){}}
async function authToken(){
  const a=loadAuth();
  if(a&&a.refresh){
    try{
      const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+KEY,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(a.refresh)});
      if(r.ok){const j=await r.json();saveAuth({uid:j.user_id,refresh:j.refresh_token});return{token:j.id_token,uid:j.user_id}}
    }catch(_){}
  }
  let r;
  try{r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({returnSecureToken:true})})}
  catch(_){throw new Error('tidak bisa terhubung ke internet / Firebase')}
  if(!r.ok){
    let m='';try{m=((await r.json()).error||{}).message||''}catch(_){}
    if(/ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED/.test(m))throw new Error('Anonymous sign-in belum diaktifkan di Firebase (Authentication > Sign-in method > Anonymous)');
    throw new Error('gagal masuk anonim ('+(m||r.status)+')');
  }
  const j=await r.json();
  saveAuth({uid:j.localId,refresh:j.refreshToken});
  return{token:j.idToken,uid:j.localId};
}
function newId(){const a=new Uint8Array(15);crypto.getRandomValues(a);return b64enc(a).replace(/\+/g,'-').replace(/\//g,'_')}   /* 15 byte = 20 karakter tanpa padding */

/* ===== daftar preset milik perangkat ini (untuk disapu setelah kedaluwarsa) ===== */
function loadMine(){try{const a=JSON.parse(localStorage.getItem(MINEK)||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
function saveMine(a){try{localStorage.setItem(MINEK,JSON.stringify(a.slice(-300)))}catch(_){}}
function addMine(id,exp){const a=loadMine().filter(x=>x.id!==id);a.push({id,exp});saveMine(a)}
function dropMine(id){saveMine(loadMine().filter(x=>x.id!==id))}

/* ===== kirim, ambil, hapus di Firebase (REST) ===== */
async function upload(bytes,name,kind,days){
  let data=bytes,z=0;
  if(typeof CompressionStream==='function'){
    try{const g=await gzip(bytes);if(g.length<bytes.length){data=g;z=1}}catch(_){}
  }
  if(data.length>MAXPACK)throw new Error('preset terlalu besar ('+mb(data.length)+', batas '+mb(MAXPACK)+'). Matikan "Sertakan foto, video, dan musik" lalu coba lagi');
  days=Math.min(30,Math.max(1,Math.round(+days||3)));
  const au=await authToken(),id=newId(),ts={'.sv':'timestamp'};
  const upd={};
  upd['presets/'+id]={name:String(name).slice(0,60),data:kind+'.'+z+'.'+b64enc(data),created:ts,ttl:days,owner:au.uid};
  upd['users/'+au.uid+'/last']=ts;
  let r;
  try{r=await fetch(DB+'/.json?auth='+encodeURIComponent(au.token),{method:'PATCH',body:JSON.stringify(upd)})}
  catch(_){throw new Error('tidak bisa terhubung ke internet / Firebase')}
  if(!r.ok){
    if(r.status===401||r.status===403)throw new Error('Firebase menolak. Pastikan Rules terbaru sudah di-Publish. Kalau baru saja membuat link, tunggu 30 detik lalu coba lagi');
    throw new Error('Firebase error '+r.status);
  }
  /* waktu pembuatan menurut server, supaya tanggal kedaluwarsa tidak terpengaruh jam perangkat */
  let created=Date.now();
  try{const q=await fetch(DB+'/presets/'+id+'/created.json');if(q.ok){const v=await q.json();if(typeof v==='number')created=v}}catch(_){}
  const exp=created+days*DAY;
  addMine(id,exp);
  return{id,packed:data.length,gz:!!z,exp,days};
}
async function remove(id){
  const au=await authToken();
  let r;
  try{r=await fetch(DB+'/presets/'+encodeURIComponent(id)+'.json?auth='+encodeURIComponent(au.token),{method:'DELETE'})}
  catch(_){throw new Error('tidak bisa terhubung ke internet / Firebase')}
  if(!r.ok){
    if(r.status===401||r.status===403)throw new Error('Firebase menolak (hanya perangkat yang membuat link ini yang bisa menghapusnya)');
    throw new Error('Firebase error '+r.status);
  }
  dropMine(id);
}
let sweeping=false;
async function sweep(){
  if(sweeping)return;
  const due=loadMine().filter(x=>x&&x.id&&x.exp<Date.now());
  if(!due.length)return;
  sweeping=true;
  try{for(const x of due){try{await remove(x.id)}catch(e){console.warn('Sapu preset kedaluwarsa gagal',x.id,e);break}}}
  finally{sweeping=false}
}
async function download(id){
  let r;
  try{r=await fetch(DB+'/presets/'+encodeURIComponent(id)+'.json')}
  catch(_){throw new Error('tidak bisa terhubung ke internet / Firebase')}
  if(r.status===401||r.status===403){
    /* Rules menolak baca: link sudah kedaluwarsa, sudah dihapus, atau salah. Bila memang kedaluwarsa, Rules mengizinkan siapa pun menghapusnya. */
    remove(id).catch(()=>{});
    throw new Error('link sudah kedaluwarsa atau sudah dihapus');
  }
  if(!r.ok)throw new Error('Firebase error '+r.status);
  const o=await r.json();
  if(!o||typeof o.data!=='string')throw new Error('preset tidak ditemukan (link salah atau sudah dihapus)');
  const a=o.data.indexOf('.'),b=o.data.indexOf('.',a+1);
  if(a<0||b<0)throw new Error('format data tidak dikenal');
  const kind=o.data.slice(0,a),z=o.data.slice(a+1,b)==='1';
  let bytes=b64dec(o.data.slice(b+1));
  if(z)bytes=await gunzip(bytes);
  const exp=(typeof o.created==='number'&&typeof o.ttl==='number')?o.created+o.ttl*DAY:0;
  return{bytes,kind:kind==='3'?'3':'2',name:String(o.name||'Preset'),exp};
}
const linkFor=id=>location.origin+location.pathname+'#p='+id;
const idFrom=t=>{const m=/#p=([-\w]{6,60})/.exec(String(t||''))||/^([-\w]{10,60})$/.exec(String(t||'').trim());return m?m[1]:null};

/* ===== baca isi preset untuk pratinjau ===== */
async function describe(d){
  const head=TD.decode(d.bytes.subarray(0,10));
  if(head==='APKPRESET3'||d.kind==='2'){
    const fname=safe(d.name)+(head==='APKPRESET3'?'.apkpreset':'.apkpreset.json');
    const file=new File([d.bytes],fname,{type:'application/octet-stream'});
    const o=await APK.presets.readFile(file);
    const n=Array.isArray(o.items)?o.items.length:0;
    if(!n)throw new Error('isi preset tidak dikenal');
    const mm=Array.isArray(o.media)?o.media.length:0;
    return{file,kind:'2',title:String(o.name||d.name),lines:['Editor video (2D)',n+' layer',mm?mm+' media di dalam preset':'tanpa media']};
  }
  const file=new File([d.bytes],safe(d.name)+'.preset',{type:'application/octet-stream'});
  let root;try{root=JSON.parse(TD.decode(d.bytes))}catch(_){throw new Error('isi preset tidak dikenal')}
  const sc=root&&(root.scene&&typeof root.scene==='object'?root.scene:root);
  if(!sc||!Array.isArray(sc.items))throw new Error('isi preset tidak dikenal');
  const mm=root.media&&typeof root.media==='object'?Object.keys(root.media).length:0;
  return{file,kind:'3',title:String(root.name||sc.name||d.name),lines:['Edit 3D',sc.items.length+' layer'+(sc.aspect?' · '+sc.aspect:'')+(sc.dur?' · '+sc.dur+' dtk':''),mm?mm+' media di dalam preset':'tanpa media']};
}

/* ===== dialog pratinjau saat link dibuka (tidak modal, supaya bisa membuka project dulu) ===== */
const CSS=`#qrl-open{position:fixed;left:50%;bottom:16px;top:auto;transform:translateX(-50%);z-index:9999;width:min(92vw,440px);background:#1b1f2a;color:#e8ecf5;border:1px solid #4b5bd6;border-radius:10px;padding:14px;margin:0}
#qrl-open .qrl-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#qrl-open .qrl-msg{color:#ffcf6b;margin:8px 0 0;font-size:13px}
#qrl-box .qrl-sep{text-align:center;opacity:.6;margin:12px 0 4px}
#qrl-box input,#qrl-box select,#qrl-in{width:100%;box-sizing:border-box}`;
let pv=null;
function showOpen(d){
  pv=d;
  let dlg=$('qrl-open');
  if(!dlg){
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    dlg=document.createElement('dialog');dlg.id='qrl-open';
    dlg.innerHTML='<b id="qrl-t"></b><p class="meta" id="qrl-l"></p><p class="qrl-msg" id="qrl-m" hidden></p>'
      +'<div class="qrl-row"><button class="btn primary" type="button" id="qrl-do">Buka</button><button class="btn" type="button" id="qrl-save">⬇ Simpan file</button><button class="btn" type="button" id="qrl-no">Batal</button></div>';
    document.body.appendChild(dlg);
    $('qrl-do').onclick=openPv;
    $('qrl-save').onclick=()=>{if(pv)saveFile(pv.file)};
    $('qrl-no').onclick=()=>{pv=null;dlg.close()};
  }
  $('qrl-t').textContent='Preset dari link: '+d.title;
  $('qrl-l').textContent=d.lines.join(' · ')+' · '+mb(d.file.size)+(d.exp?' · link berlaku sampai '+fmtDate(d.exp):'');
  $('qrl-m').hidden=true;
  if(!dlg.open)dlg.show();
}
function saveFile(f){
  const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
async function openPv(){
  const d=pv;if(!d)return;
  const m=$('qrl-m');
  try{
    if(d.kind==='3'){
      if(!(APK.s3preset&&APK.s3preset.importFile))throw new Error('Edit 3D belum siap');
      await APK.s3preset.importFile(d.file);
    }else{
      if(!(APK.project&&APK.project.current&&APK.presets)){
        m.textContent='Buka atau buat project di editor video dulu, lalu tekan Buka lagi di sini.';m.hidden=false;return;
      }
      await APK.presets.load(d.file);
    }
    pv=null;$('qrl-open').close();
  }catch(e){m.textContent='Gagal membuka preset: '+((e&&e.message)||e);m.hidden=false}
}
let loading=false;
async function openFromId(id){
  if(loading)return;loading=true;
  try{
    toast('Mengunduh preset dari link…');
    const raw=await download(id);
    const d=await describe(raw);d.exp=raw.exp;
    showOpen(d);
  }catch(e){console.warn('Buka link preset gagal',e);toast('Link preset gagal dibuka: '+((e&&e.message)||e))}
  finally{loading=false}
}

/* ===== tombol di dialog ▣ QR ===== */
function drawQR(cv,q,px,quiet){
  const n=(q.size+2*quiet)*px;cv.width=cv.height=n;
  const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,n,n);g.fillStyle='#000';
  for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.get(x,y))g.fillRect((x+quiet)*px,(y+quiet)*px,px,px);
}
let busy=false,lastName='preset',lastId=null;
async function makeLink(){
  if(busy)return;busy=true;
  const go=$('qrl-go'),st=$('qrl-st');go.disabled=true;
  try{
    $('qrl-out').hidden=true;st.textContent='';lastId=null;
    const name=($('qrp-name').value||'').trim().slice(0,40)||defaultName(),media=$('qrp-media').checked,days=+$('qrl-ttl').value||3;
    go.textContent='Menyiapkan preset…';
    const src=inS3d()?await source3d(name,media):await source2d(name,media);
    const bytes=new Uint8Array(await src.blob.arrayBuffer());
    go.textContent='Mengunggah…';
    const up=await upload(bytes,name,src.kind,days);
    const url=linkFor(up.id),q=APK.qr.make(url,{ec:'M'});
    lastId=up.id;
    drawQR($('qrl-cv'),q,8,4);
    $('qrl-url').value=url;lastName=name;
    $('qrl-info').textContent='Selesai. Ukuran '+mb(bytes.length)+(up.gz?' (terkompres jadi '+mb(up.packed)+')':'')+'. Link berlaku sampai '+fmtDate(up.exp)+' lalu otomatis mati dan dihapus. Scan pakai kamera HP biasa.';
    $('qrl-out').hidden=false;
    sweep();
  }catch(e){
    console.warn('Buat link QR gagal',e);st.textContent='Gagal: '+((e&&e.message)||e);
  }finally{busy=false;go.disabled=false;go.textContent='🔗 Buat link QR (cukup 1 QR)'}
}
async function delLink(){
  if(!lastId||busy)return;busy=true;
  const st=$('qrl-st');
  try{
    await remove(lastId);
    lastId=null;$('qrl-out').hidden=true;st.textContent='Link dihapus. QR yang sudah dibagikan tidak berlaku lagi.';
  }catch(e){st.textContent='Gagal menghapus: '+((e&&e.message)||e)}
  finally{busy=false}
}
function inject(d){
  if(d.querySelector('#qrl-box'))return;
  const go=d.querySelector('#qrp-go');
  if(!go||!go.parentElement)return;
  const box=document.createElement('div');box.id='qrl-box';
  box.innerHTML='<div class="qrl-sep">atau</div>'
    +'<label>Link berlaku selama<select id="qrl-ttl"><option value="1">1 hari</option><option value="3" selected>3 hari</option><option value="7">7 hari</option><option value="14">14 hari</option><option value="30">30 hari</option></select></label>'
    +'<p class="meta">Setelah itu link otomatis mati dan presetnya dihapus dari server.</p>'
    +'<div class="dlg-actions"><button class="btn primary" type="button" id="qrl-go">🔗 Buat link QR (cukup 1 QR)</button></div>'
    +'<p class="meta" id="qrl-st"></p>'
    +'<div id="qrl-out" hidden>'
      +'<canvas class="qrp-cv" id="qrl-cv" aria-label="QR link preset"></canvas>'
      +'<p class="meta" id="qrl-info" style="text-align:center"></p>'
      +'<input id="qrl-url" readonly aria-label="Link preset">'
      +'<div class="qrp-row"><button class="btn" type="button" id="qrl-copy">Salin link</button><button class="btn" type="button" id="qrl-png">⬇ Simpan QR (PNG)</button><button class="btn danger" type="button" id="qrl-del">🗑 Hapus link ini</button></div>'
    +'</div>';
  go.parentElement.insertAdjacentElement('afterend',box);
  $('qrl-go').onclick=makeLink;
  $('qrl-del').onclick=delLink;
  $('qrl-copy').onclick=async()=>{
    const u=$('qrl-url');
    try{await navigator.clipboard.writeText(u.value);toast('Link disalin')}
    catch(_){u.select();toast('Tekan Salin / Copy di keyboard')}
  };
  $('qrl-png').onclick=()=>{$('qrl-cv').toBlob(b=>{if(b)saveFile(new File([b],safe(lastName)+'-link-qr.png',{type:'image/png'}))},'image/png')};
  const rs=d.querySelector('#qrp-reset');
  if(rs&&rs.parentElement){
    const w=document.createElement('div');w.id='qrl-scan';
    w.innerHTML='<label class="meta">Atau tempel link preset<input id="qrl-in" placeholder="https://…/#p=…"></label>'
      +'<div class="qrp-row"><button class="btn" type="button" id="qrl-openlink">Buka link</button></div>'
      +'<p class="meta">QR link dari tab Buat tidak terbaca oleh kamera di sini: scan pakai kamera HP biasa, atau tempel link-nya.</p>';
    rs.parentElement.insertAdjacentElement('afterend',w);
    $('qrl-openlink').onclick=()=>{
      const id=idFrom($('qrl-in').value);
      if(!id){toast('Link tidak dikenali');return}
      d.close();openFromId(id);
    };
  }
}

/* ===== pasang ===== */
function watch(){
  const ex=$('qrp-dlg');if(ex)inject(ex);
  new MutationObserver(ms=>{
    for(const m of ms)for(const n of m.addedNodes)if(n.id==='qrp-dlg')inject(n);
  }).observe(document.body,{childList:true});
}
function fromHash(){
  const m=/^#p=([-\w]{6,60})$/.exec(location.hash);
  if(!m)return;
  const id=m[1];
  try{history.replaceState(null,'',location.pathname+location.search)}catch(_){}
  openFromId(id);
}
APK.qrlink={upload,download,remove,sweep,openFromId,linkFor};
try{
  if(document.body)watch();else document.addEventListener('DOMContentLoaded',watch);
  const start=()=>setTimeout(()=>{fromHash();sweep()},400);
  if(document.readyState==='complete')start();else window.addEventListener('load',start);
  window.addEventListener('hashchange',fromHash);
}catch(e){console.error('QR link gagal dimuat',e)}
})();
