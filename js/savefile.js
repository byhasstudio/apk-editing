/* SIMPAN HASIL EXPORT YANG ANDAL (browser, APK, EXE). Dimuat paling awal di <head> index.html.
   Masalah yang diperbaiki: export 2D dan 3D selesai (bar 100%) tetapi file tidak pernah turun di APK / EXE. Penyebabnya, file disimpan lewat
   <a download>.click() sekali saja, setelah render yang lama. Di WebView / aplikasi pembungkus, klik semacam itu sering diam-diam diabaikan
   (izin gerakan pengguna sudah kedaluwarsa, atau pembungkus tidak menangani unduhan blob:), lalu link blob dihapus 4 sampai 10 detik kemudian
   sehingga hasil render yang lama itu hilang.
   Cara kerja: setiap <a download> berisi blob: yang di-click() dicegat. Isinya langsung diambil ke memori (sebelum link dihapus), lalu muncul
   dialog "Export selesai" dengan tombol Simpan. Tombol ditekan oleh pengguna sehingga izin gerakan pasti segar. Metode simpan dicoba berurutan:
   1) Simpan Sebagai (showSaveFilePicker: Chrome, Edge, EXE WebView2 / Electron)
   2) Capacitor Filesystem + Share (APK buatan Capacitor), ditulis bertahap supaya file besar aman
   3) Bagikan (Web Share dengan file: banyak peramban ponsel)
   4) <a download> biasa (peramban umum)
   File tetap ada di memori sampai dialog ditutup, jadi kalau satu cara gagal tinggal tekan lagi atau pilih Bagikan. Kalau hasil export kosong
   (0 byte), pengguna diberi tahu, bukan diam. Juga tersedia APK.saveFile(blob, namaFile) untuk dipakai langsung. */
(function(){
'use strict';
if(window.__swSave)return;window.__swSave=1;
window.APK=window.APK||{};
const UA=navigator.userAgent||'';
const WRAPPED=/Electron/i.test(UA)||!!window.Capacitor||/; wv\)/.test(UA)||/wv\b/.test(UA);   /* pembungkus APK / EXE: jangan coba klik otomatis */
const origClick=HTMLAnchorElement.prototype.click;
let cur=null,dlg=null;

const mb=n=>(n/1048576).toFixed(n>=10485760?0:1)+' MB';
const isAbort=e=>!!e&&(e.name==='AbortError'||e.code===20);

/* ===== metode simpan ===== */
async function viaPicker(item,say){
  if(!window.showSaveFilePicker)return false;
  const m=/\.([a-z0-9]+)$/i.exec(item.name),ext=m?'.'+m[1].toLowerCase():'.mp4',type=item.blob.type||'video/mp4',acc={};acc[type]=[ext];
  const h=await window.showSaveFilePicker({suggestedName:item.name,types:[{description:'Video',accept:acc}]});
  const w=await h.createWritable();
  try{await w.write(item.blob)}finally{await w.close()}
  say('Tersimpan: '+(h.name||item.name));return true;
}
function b64(blob){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error||new Error('gagal membaca file'));r.readAsDataURL(blob)});
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
  if(S&&S.share){try{await S.share({title:item.name,url:uri,dialogTitle:'Simpan atau bagikan video'})}catch(e){if(!isAbort(e)&&!/cancel/i.test(String(e&&e.message)))throw e}}
  say('Tersimpan di '+(dir==='DOCUMENTS'?'folder Documents':'penyimpanan aplikasi')+': '+item.name);return true;
}
async function viaShare(item,say){
  if(!navigator.share||!navigator.canShare)return false;
  let f;try{f=new File([item.blob],item.name,{type:item.blob.type||'video/mp4'})}catch(_){return false}
  if(!navigator.canShare({files:[f]}))return false;
  await navigator.share({files:[f],title:item.name});
  say('Dibagikan / disimpan lewat menu perangkat.');return true;
}
function viaAnchor(item,say){
  const u=URL.createObjectURL(item.blob),a=document.createElement('a');
  a.href=u;a.download=item.name;a.style.display='none';document.body.appendChild(a);
  origClick.call(a);
  setTimeout(()=>{try{a.remove();URL.revokeObjectURL(u)}catch(_){}},120000);
  say('Unduhan dimulai. Kalau tidak muncul, coba tombol Bagikan.');return true;
}

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
  try{if(navigator.share&&navigator.canShare)canShare=navigator.canShare({files:[new File([item.blob],item.name,{type:item.blob.type||'video/mp4'})]})}catch(_){}
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
  q('save').onclick=()=>run([viaPicker,viaCapacitor,viaShare,viaAnchor]);
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

/* ===== cegat <a download>.click() berisi blob: (export.js, scene3d.js, ekspor subtitle, dst) ===== */
HTMLAnchorElement.prototype.click=function(){
  let hit=false;
  try{hit=this.hasAttribute('download')&&/^blob:/i.test(this.href)}catch(_){}
  if(!hit)return origClick.apply(this,arguments);
  const name=this.getAttribute('download')||'export',self=this;
  /* ambil isinya SEKARANG, sebelum pemanggil mencabut link blob-nya */
  fetch(this.href).then(r=>r.blob()).then(b=>offer(b,name)).catch(()=>{try{origClick.call(self)}catch(_){}});
};
})();
