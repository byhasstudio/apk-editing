/* PEMBARUAN OTOMATIS SplineWay. Dimuat dari js/device.js. Berlaku di browser, APK, dan EXE (ketiganya memuat situs yang sama).
   Cara kerja: mengambil index.html terbaru tanpa cache, lalu membandingkan tanda-tangannya (hash) dengan yang tersimpan.
   Index.html memuat semua file js dan css dengan nomor ?v=, jadi setiap kali satu file diubah, NAIKKAN nomor ?v= file itu di index.html
   supaya pembaruan terdeteksi.
   - Saat aplikasi dibuka: kalau ada pembaruan, langsung dimuat ulang (belum ada yang sedang diedit).
   - Setiap EVERY milidetik, dan saat aplikasi kembali ke layar depan atau internet tersambung lagi: cek lagi.
   - Kalau ada pembaruan di tengah mengedit: muncul pesan di bawah layar. Dimuat ulang otomatis setelah tidak ada sentuhan atau
     ketikan selama IDLE milidetik (autosave sudah jalan tiap 4 detik), atau langsung kalau sedang di beranda.
     Tidak pernah memuat ulang saat ada dialog terbuka (termasuk export). */
(function(){
'use strict';
if(window.__swUpdater)return;window.__swUpdater=1;
const EVERY=5*60*1000,IDLE=15000,COOL=60000,KEY='splineway:index',KEY_AT='splineway:updated-at';
let lastAct=Date.now(),lastCheck=0,pending=null,bar=null;
['pointerdown','keydown','wheel','touchstart'].forEach(function(e){addEventListener(e,function(){lastAct=Date.now()},{passive:true,capture:true})});
function get(k){try{return localStorage.getItem(k)}catch(e){return null}}
function set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
async function signature(){
  const r=await fetch('index.html?_='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw new Error('http '+r.status);
  const t=await r.text();
  let h=5381;for(let i=0;i<t.length;i++)h=((h<<5)+h+t.charCodeAt(i))|0;
  return h+':'+t.length;
}
function busy(){
  if(document.querySelector('dialog[open]'))return true;
  return ['ex-progress','s3-ex-prog'].some(function(id){const e=document.getElementById(id);return !!e&&!e.hidden});
}
function home(){const h=document.getElementById('home');return !!h&&!h.hidden}
function showBar(){
  if(bar||!document.body)return;
  bar=document.createElement('div');bar.setAttribute('role','status');
  bar.style.cssText='position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99999;background:#0b1030;color:#fff;border:1px solid #2bd67b;border-radius:12px;padding:10px 14px;font:14px system-ui,sans-serif;display:flex;gap:12px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.45);max-width:92vw';
  const s=document.createElement('span');s.textContent='Pembaruan SplineWay tersedia.';
  const b=document.createElement('button');b.textContent='Muat ulang';
  b.style.cssText='background:#2bd67b;color:#04122a;border:0;border-radius:8px;padding:6px 12px;font:600 14px system-ui,sans-serif;cursor:pointer';
  b.onclick=function(){reload(pending)};
  bar.appendChild(s);bar.appendChild(b);document.body.appendChild(bar);
}
function hideBar(){if(bar){bar.remove();bar=null}}
function reload(sig){if(sig)set(KEY,sig);set(KEY_AT,String(Date.now()));location.reload()}
function tryApply(){
  if(!pending||busy())return;
  if(!home()&&Date.now()-lastAct<IDLE)return;
  reload(pending);
}
async function check(atOpen){
  lastCheck=Date.now();
  let sig;try{sig=await signature()}catch(e){return}
  const known=get(KEY);
  if(!known){set(KEY,sig);return}
  if(known===sig){pending=null;hideBar();return}
  if(Date.now()-Number(get(KEY_AT)||0)<COOL)return;
  pending=sig;
  if(atOpen&&!busy()){reload(sig);return}
  showBar();tryApply();
}
setInterval(tryApply,5000);
setInterval(function(){check(false)},EVERY);
document.addEventListener('visibilitychange',function(){if(!document.hidden&&Date.now()-lastCheck>30000)check(false)});
addEventListener('online',function(){check(false)});
setTimeout(function(){check(true)},1500);
window.APK=window.APK||{};
APK.updater={check:function(){return check(false)}};
})();
