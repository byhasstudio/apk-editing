/* SIMPAN HASIL EXPORT YANG ANDAL (browser, APK, EXE). Dimuat paling awal di <head> index.html.
   Masalah yang diperbaiki: export 2D dan 3D selesai (bar 100%) tetapi file tidak pernah turun di APK / EXE. Penyebabnya, file disimpan lewat
   <a download>.click() sekali saja, setelah render yang lama. Di WebView / aplikasi pembungkus, klik semacam itu sering diam-diam diabaikan
   (izin gerakan pengguna sudah kedaluwarsa, atau pembungkus tidak menangani unduhan blob:), lalu link blob dihapus 4 sampai 10 detik kemudian
   sehingga hasil render yang lama itu hilang.
   Cara kerja: setiap <a download> berisi blob: yang di-click() dicegat. Isinya langsung diambil ke memori (sebelum link dihapus), lalu muncul
   dialog "Export selesai" dengan tombol Simpan. Tombol ditekan oleh pengguna sehingga izin gerakan pasti segar. Metode simpan dicoba berurutan
   menurut platform:
   - Browser biasa (Chrome, Edge, dst): 1) Simpan Sebagai (showSaveFilePicker) 2) Bagikan 3) <a download>
   - APK (Capacitor): 1) Filesystem + Share (ditulis bertahap supaya file besar aman) 2) Bagikan 3) pesan jelas kalau plugin belum terpasang
   - EXE (Electron): 1) jembatan asli (window.swNative, jendela Simpan Sebagai dari Electron, ditulis bertahap) 2) <a download> biasa
   v2: showSaveFilePicker TIDAK dipakai di EXE dan APK. Di pembungkus, fungsi itu ada tetapi tidak punya jendela pemilih file, jadi langsung
   gagal dengan AbortError, dan itu dikira pengguna menekan Batal sehingga muncul tulisan "Dibatalkan" terus dan metode lain tidak pernah dicoba.
   File tetap ada di memori sampai dialog ditutup, jadi kalau satu cara gagal tinggal tekan lagi atau pilih Bagikan. Kalau hasil export kosong
   (0 byte), pengguna diberi tahu, bukan diam. Juga tersedia APK.saveFile(blob, namaFile) untuk dipakai langsung.
   v3: (a) di EXE / APK, window.showSaveFilePicker dimatikan untuk SEMUA kode (bukan hanya file ini), jadi simpan preset, QR, subtitle, dst
   yang memanggilnya langsung tidak lagi gagal "Dibatalkan"; (b) EXE memakai jembatan asli window.swNative (dibuat di preload.js EXE baru);
   EXE lama tanpa jembatan itu tetap jalan lewat <a download>; (c) <a download> berisi data: dan klik lewat dispatchEvent ikut dicegat;
   (d) di APK, kalau file sudah tertulis ke Documents tetapi menu Bagikan gagal, tetap dianggap tersimpan; (e) jenis file (MIME) ditebak dari
   ekstensi, jadi preset .json / .apkpreset / .preset tidak lagi dianggap video. */
(function(){
'use strict';
if(window.__swSave)return;window.__swSave=1;
window.APK=window.APK||{};
const UA=navigator.userAgent||'';
const ELECTRON=/Electron/i.test(UA);
const NATIVE=(function(){try{return !!(window.Capacitor&&(window.Capacitor.isNativePlatform?window.Capacitor.isNativePlatform():true))}catch(_){return !!window.Capacitor}})();
const WRAPPED=ELECTRON||NATIVE||/; wv\)/.test(UA)||/wv\b/.test(UA);   /* pembungkus APK / EXE: jangan coba klik otomatis dan jangan pakai showSaveFilePicker */
/* v3: matikan showSaveFilePicker untuk semua kode di pembungkus; fungsinya ada tapi tidak punya jendela, jadi selalu AbortError ("Dibatalkan") */
if(WRAPPED){
  try{delete window.showSaveFilePicker}catch(_){}
  try{if('showSaveFilePicker' in window)Object.defineProperty(window,'showSaveFilePicker',{value:undefined,configurable:true,writable:true})}catch(_){}
}
const origClick=HTMLAnchorElement.prototype.click;
const origDispatch=EventTarget.prototype.dispatchEvent;
let cur=null,dlg=null;

const mb=n=>(n/1048576).toFixed(n>=10485760?0:1)+' MB';
const isAbort=e=>!!e&&(e.name==='AbortError'||e.code===20);
const MIME={json:'application/json',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',zip:'application/zip',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',
  mp3:'audio/mpeg',wav:'audio/wav',srt:'text/plain',txt:'text/plain',html:'text/html'};
const mimeOf=item=>{
  if(item.blob.type)return item.blob.type;
  const m=/\.([a-z0-9]+)$/i.exec(item.name||'');
  return (m&&MIME[m[1].toLowerCase()])||'application/octet-stream';
};

/* ===== metode simpan ===== */
async function viaPicker(item,say){
  if(WRAPPED||!window.showSaveFilePicker)return false;
  const m=/\.([a-z0-9]+)$/i.exec(item.name),ext=m?'.'+m[1].toLowerCase():'.mp4',type=mimeOf(item),acc={};acc[type]=[ext];
  const h=await window.showSaveFilePicker({suggestedName:item.name,types:[{description:'File',accept:acc}]});
  const w=await h.createWritable();
  try{await w.write(item.blob)}finally{await w.close()}
  say('Tersimpan: '+(h.name||item.name));return true;
}
function b64(blob){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error||new Error('gagal membaca file'));r.readAsDataURL(blob)});
}
/* EXE: jembatan asli dari preload.js (window.swNative). Jendela Simpan Sebagai dibuka oleh Electron, file ditulis bertahap. */
async function viaElectron(item,say){
  const nb=window.swNative;
  if(!nb||!nb.begin||!nb.chunk||!nb.end)return false;   /* EXE lama tanpa jembatan: lanjut ke <a download> */
  const id=await nb.begin(item.name);
  if(!id){const e=new Error('Dibatalkan');e.name='AbortError';throw e}   /* pengguna menutup jendela Simpan Sebagai */
  const CH=4*1024*1024;
  try{
    for(let o=0;o<item.blob.size;o+=CH){
      const buf=new Uint8Array(await item.blob.slice(o,o+CH).arrayBuffer());
      await nb.chunk(id,buf);
      say('Menulis file… '+Math.min(100,Math.round((o+CH)/item.blob.size*100))+'%');
    }
    const p=await nb.end(id);
    say('Tersimpan: '+(p||item.name));return true;
  }catch(e){
    try{await nb.abort(id)}catch(_){}
    throw e;
  }
}
async function viaCapacitor(item,say){
  const C=window.Capacitor,P=C&&C.Plugins,FS=P&&P.Filesystem;if(!FS)return false;
  const CH=3*1024*1024;   /* kelipatan 3 byte supaya potongan base64 bisa disambung */
  let dir='DOCUMENTS',uri=null,lastErr=null;
  for(const d of ['DOCUMENTS','CACHE']){
    try{
      dir=d;let first=true;
      for(let o=0;o<item.blob.size;o+=CH){
        const data=await b64(item.blob.slice(o,o+CH));
        if(first){await FS.writeFile({path:item.name,data,directory:dir,recursive:true});first=false}
        else await FS.appendFile({path:item.name,data,directory:dir});
        say('Menulis file… '+Math.min(100,Math.round((o+CH)/item.blob.size*100))+'%');
      }
      const r=await FS.getUri({path:item.name,directory:dir});uri=r&&r.uri;lastErr=null;break;
    }catch(e){lastErr=e}
  }
  if(lastErr||!uri)throw lastErr||new Error('file tidak bisa ditulis');
  const S=P.Share;
  let shared=false;
  if(S&&S.share){
    try{await S.share({title:item.name,url:uri,dialogTitle:'Simpan atau bagikan file'});shared=true}
    catch(e){
      if(isAbort(e)||/cancel/i.test(String(e&&e.message))){/* menu bagikan ditutup pengguna */}
      else if(dir!=='DOCUMENTS')throw e;   /* di Documents file sudah aman walau menu bagikan gagal */
    }
  }else if(dir!=='DOCUMENTS'){
    throw new Error('plugin Share belum terpasang di APK ini. Pasang APK terbaru dari Releases (latest-apk)');
  }
  if(dir==='DOCUMENTS')say('Tersimpan di folder Documents: '+item.name);
  else say(shared?'File dikirim ke menu Bagikan. Pilih tujuan simpan di sana.':'Menu Bagikan ditutup, file belum dipindahkan. Tekan Simpan file lagi untuk memilih tujuan.');
  return true;
}
async function viaShare(item,say){
  if(!navigator.share||!navigator.canShare)return false;
  let f;try{f=new File([item.blob],item.name,{type:mimeOf(item)})}catch(_){return false}
  if(!navigator.canShare({files:[f]}))return false;
  await navigator.share({files:[f],title:item.name});
  say('Dibagikan / disimpan lewat menu perangkat.');return true;
}
function viaAnchor(item,say){
  /* di APK, unduhan blob: lewat <a download> tidak pernah jalan; jangan pura-pura berhasil */
  if(NATIVE&&!ELECTRON)throw new Error('APK ini belum bisa menyimpan file. Pasang APK terbaru dari Releases (latest-apk)');
  const u=URL.createObjectURL(item.blob),a=document.createElement('a');
  a.href=u;a.download=item.name;a.style.display='none';document.body.appendChild(a);
  origClick.call(a);
  setTimeout(()=>{try{a.remove();URL.revokeObjectURL(u)}catch(_){}},120000);
  say(ELECTRON?'Pilih lokasi simpan di jendela yang muncul. Kalau tidak muncul, tekan Simpan file lagi.':'Unduhan dimulai. Kalau tidak muncul, coba tombol Bagikan.');return true;
}
const CHAIN=ELECTRON?[viaElectron,viaAnchor]:WRAPPED?[viaCapacitor,viaShare,viaAnchor]:[viaPicker,viaCapacitor,viaShare,viaAnchor];

/* ===== dialog ===== */
function close(force){
  if(!dlg)return;
  if(!force&&cur&&!cur.tried&&!confirm('File belum disimpan dan akan hilang kalau ditutup. Tutup tetap?'))return;
  try{dlg.close()}catch(_){}
  dlg.remove();dlg=null;cur=null;
}
function build(item){
  if(dlg)close(true);
  dlg=document.createElement('dialog');dlg.id='sw-save';
  dlg.style.cssText='max-width:min(92vw,420px)';
  dlg.innerHTML='<form method="dialog" onsubmit="return false"><h3>File siap disimpan</h3>'
    +'<p style="margin:0 0 6px;word-break:break-all"><b></b></p><p class="meta" data-sw="size"></p>'
    +'<p class="meta" data-sw="msg">Tekan Simpan untuk menaruh file di perangkat. File aman di sini sampai kamu menutup jendela ini.</p>'
    +'<div class="dlg-actions"><button class="btn" type="button" data-sw="close">Tutup</button>'
    +'<button class="btn" type="button" data-sw="share" hidden>Bagikan</button>'
    +'<button class="btn primary" type="button" data-sw="save">Simpan file</button></div></form>';
  dlg.querySelector('b').textContent=item.name;
  dlg.querySelector('[data-sw=size]').textContent=mb(item.blob.size);
  const q=s=>dlg.querySelector('[data-sw='+s+']'),msg=q('msg');
  const say=t=>{msg.textContent=t};
  let canShare=false;
  try{if(navigator.share&&navigator.canShare)canShare=navigator.canShare({files:[new File([item.blob],item.name,{type:mimeOf(item)})]})}catch(_){}
  q('share').hidden=!canShare;
  const run=async chain=>{
    const sv=q('save'),sh=q('share');sv.disabled=sh.disabled=true;
    try{
      let ok=false,err=null;
      for(const fn of chain){
        try{if(await fn(item,say)){ok=true;break}}
        catch(e){if(isAbort(e)){say('Dibatalkan. Tekan Simpan untuk mencoba lagi.');return}err=e}
      }
      item.tried=true;
      if(!ok)say('Tidak bisa menyimpan'+(err?' ('+(err.message||err)+')':'')+'. Coba Bagikan, atau tekan Simpan lagi.');
    }finally{sv.disabled=sh.disabled=false}
  };
  q('save').onclick=()=>run(CHAIN);
  q('share').onclick=()=>run([viaShare]);
  q('close').onclick=()=>close(false);
  dlg.addEventListener('cancel',e=>{e.preventDefault();close(false)});
  document.body.appendChild(dlg);
  dlg.showModal();
}
function offer(blob,name){
  const toast=m=>{try{const t=document.getElementById('toast');if(t){t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000)}}catch(_){}};
  if(!blob||!blob.size){toast('Hasil export kosong (0 byte), export gagal. Coba lagi dengan resolusi atau FPS lebih rendah.');return}
  cur={blob,name:name||'export',tried:false};
  build(cur);
  if(!WRAPPED){   /* peramban biasa: coba unduh otomatis seperti sebelumnya; dialog tetap ada sebagai cadangan */
    try{viaAnchor(cur,()=>{});cur.tried=true}catch(_){}
  }
}
function saveFile(blob,name){offer(blob,name)}
APK.saveFile=saveFile;

/* ===== cegat <a download> berisi blob: / data: (export.js, presets.js, s3preset.js, qrpreset.js, scene3d.js, ekspor subtitle, dst) ===== */
const isDl=a=>{try{return a instanceof HTMLAnchorElement&&a.hasAttribute('download')&&/^(blob|data):/i.test(a.href)}catch(_){return false}};
HTMLAnchorElement.prototype.click=function(){
  if(!isDl(this))return origClick.apply(this,arguments);
  const name=this.getAttribute('download')||'export',self=this;
  /* ambil isinya SEKARANG, sebelum pemanggil mencabut link blob-nya */
  fetch(this.href).then(r=>r.blob()).then(b=>offer(b,name)).catch(()=>{try{origClick.call(self)}catch(_){}});
};
/* kode yang memicu unduhan lewat dispatchEvent(new MouseEvent('click')) juga dicegat */
EventTarget.prototype.dispatchEvent=function(ev){
  try{if(ev&&ev.type==='click'&&isDl(this)){this.click();return true}}catch(_){}
  return origDispatch.apply(this,arguments);
};
})();
