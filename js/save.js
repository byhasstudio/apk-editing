/* SIMPAN FILE UNTUK APK / EXE / WEB (dimuat dari js/device.js, jadi index.html tidak perlu diubah).
   Masalah: di APK (Capacitor WebView) unduhan lewat <a download href="blob:..."> tidak pernah jalan, jadi hasil export (video, preset, project)
   tidak tersimpan walau prosesnya selesai. Solusi: klik <a download> berisi blob:/data: dicegat di APK, filenya dikirim potongan demi potongan
   ke plugin native "SaveFile" (lihat assets/android/SaveFilePlugin.java) dan disimpan ke folder  Download/SplineWay  di ponsel.
   - APK: perlu APK versi terbaru (build-apk.yml sudah memasang plugin). Kalau plugin belum ada, dicoba menu Bagikan (Web Share) sebagai cadangan.
   - EXE (Electron) dan browser: tidak diubah di sisi web, tetap memakai unduhan biasa (EXE disimpan ke folder Downloads lewat main.js).
   API: APK.saveFile(blob, namaFile) -> Promise. */
(function(){
'use strict';
window.APK=window.APK||{};
if(APK.saveFile)return;
let tt;
function say(m,ms){
  try{const t=document.getElementById('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(tt);if(ms!==0)tt=setTimeout(()=>t.classList.remove('show'),ms||4500)}catch(_){}
}
const native=()=>{try{return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform())}catch(_){return false}};
let plug=null;
function plugin(){
  if(plug)return plug;
  const C=window.Capacitor;
  try{plug=C.registerPlugin('SaveFile')}catch(_){}
  if(!plug&&C&&C.Plugins)plug=C.Plugins.SaveFile;
  return plug;
}
const toB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=()=>rej(r.error||new Error('gagal membaca data'));r.readAsDataURL(b)});
const origClick=HTMLAnchorElement.prototype.click;
function plainDownload(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  origClick.call(a);setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
async function nativeSave(blob,name){
  const P=plugin();if(!P)throw new Error('plugin SaveFile tidak ada');
  const id='s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),CH=1024*1024;
  await P.begin({id,name,mime:blob.type||'application/octet-stream'});
  try{
    for(let o=0;o<blob.size;o+=CH){
      await P.append({id,data:await toB64(blob.slice(o,o+CH))});
      say('Menyimpan '+name+' ... '+Math.min(100,Math.round((o+CH)/blob.size*100))+'%',0);
    }
    return await P.end({id});
  }catch(e){try{await P.abort({id})}catch(_){}throw e}
}
let chain=Promise.resolve();
APK.saveFile=function(blob,name){
  name=String(name||'file').replace(/[\\/:*?"<>|]+/g,'_')||'file';
  if(!native()){plainDownload(blob,name);return Promise.resolve({location:'Downloads'})}
  const job=chain.then(async()=>{
    say('Menyimpan '+name+' ...',0);
    try{
      const r=await nativeSave(blob,name);
      say('Tersimpan di '+((r&&r.location)||'folder Download')+' ('+(blob.size/1048576).toFixed(1)+' MB)',7000);
      return r;
    }catch(e){
      console.warn('Simpan native gagal',e);
      try{   /* cadangan: menu Bagikan sistem (APK lama yang belum punya plugin) */
        const f=new File([blob],name,{type:blob.type||'application/octet-stream'});
        if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});say('File dibagikan. Pilih "Simpan" di menu yang muncul.',6000);return{location:'menu Bagikan'}}
      }catch(_){}
      say('Gagal menyimpan file. Pasang APK terbaru dari Releases (latest-apk) lalu coba lagi.',9000);
      throw e;
    }
  });
  chain=job.catch(()=>{});
  return job;
};
/* cegat klik <a download> berisi blob:/data: hanya di APK */
function takeover(a){
  if(!a||!a.hasAttribute||!a.hasAttribute('download'))return false;
  const href=a.href||'';
  if(!/^(blob|data):/i.test(href)||!native())return false;
  const name=(a.getAttribute('download')||'file').trim()||'file';
  fetch(href).then(r=>r.blob()).then(b=>APK.saveFile(b,name)).catch(e=>say('Gagal menyimpan: '+((e&&e.message)||e),7000));
  return true;
}
HTMLAnchorElement.prototype.click=function(){if(takeover(this))return;return origClick.apply(this,arguments)};
document.addEventListener('click',e=>{
  const a=e.target&&e.target.closest&&e.target.closest('a[download]');
  if(a&&takeover(a)){e.preventDefault();e.stopPropagation()}
},true);
})();
