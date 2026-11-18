/* LAYAR PEMBUKA SplineWay: logo + nama + lingkaran loading saat aplikasi dibuka (browser, APK, dan EXE).
   Dimuat di <head> setelah js/brand.js (memakai APK.brand.logo). Layar dipasang langsung ke <html> supaya muncul sebelum halaman selesai dimuat.
   Hanya lingkaran loading berputar (tanpa persen), hilang saat semua file selesai dimuat (event load). Tampil minimal MIN milidetik supaya terbaca,
   lalu memudar dan dibuang. Batas aman MAX: kalau load tak kunjung selesai, layar tetap ditutup. Tidak menyentuh apa pun di aplikasi. */
(function(){
'use strict';
if(window.__swSplash)return;window.__swSplash=1;
const BUILD='build 18-11-26 f',MIN=1400,MAX=8000,t0=Date.now();
const logo=(window.APK&&APK.brand&&APK.brand.logo)||'';
const st=document.createElement('style');
st.textContent='#sw-splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0b1030;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .45s ease}'
+'#sw-splash.out{opacity:0;pointer-events:none}'
+'#sw-splash img{width:112px;height:112px;border-radius:26px;box-shadow:0 10px 40px rgba(43,214,123,.28);animation:sw-pop .7s cubic-bezier(.2,.9,.3,1.2) both}'
+'#sw-splash b{font-size:30px;letter-spacing:.5px;animation:sw-up .6s .15s ease both}'
+'#sw-splash small{opacity:.6;font-size:12px;letter-spacing:1.5px;animation:sw-up .6s .25s ease both}'
+'#sw-splash .sw-spin{width:34px;height:34px;margin-top:22px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:#2bd67b;animation:sw-rot .8s linear infinite}'
+'@keyframes sw-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}'
+'@keyframes sw-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
+'@keyframes sw-rot{to{transform:rotate(360deg)}}';
const el=document.createElement('div');el.id='sw-splash';el.setAttribute('role','status');
el.innerHTML=(logo?'<img alt="" src="'+logo+'">':'')+'<b>SplineWay</b><small>BY BYHASSSTUDIO</small><div class="sw-spin"></div><small style="opacity:.4;font-size:10px;letter-spacing:1px">'+BUILD+'</small>';
const root=document.documentElement;root.appendChild(st);root.appendChild(el);
let done=false;
function finish(){
  if(done)return;done=true;
  setTimeout(function(){
    el.classList.add('out');
    setTimeout(function(){el.remove();st.remove()},500);
  },Math.max(250,MIN-(Date.now()-t0)));
}
if(document.readyState==='complete')finish();else addEventListener('load',finish);
setTimeout(finish,MAX);
})();
