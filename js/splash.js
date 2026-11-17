/* LAYAR PEMBUKA SplineWay: logo + nama + bilah loading saat aplikasi dibuka (browser, APK, dan EXE).
   Dimuat di <head> setelah js/brand.js (memakai APK.brand.logo). Layar dipasang langsung ke <html> supaya muncul sebelum halaman selesai dimuat.
   Bilah loading naik pelan sampai 90%, lalu penuh saat semua file selesai dimuat (event load). Tampil minimal MIN milidetik supaya terbaca,
   lalu memudar dan dibuang. Batas aman MAX: kalau load tak kunjung selesai, layar tetap ditutup. Tidak menyentuh apa pun di aplikasi. */
(function(){
'use strict';
if(window.__swSplash)return;window.__swSplash=1;
const MIN=1400,MAX=8000,t0=Date.now();
const logo=(window.APK&&APK.brand&&APK.brand.logo)||'';
const st=document.createElement('style');
st.textContent='#sw-splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0b1030;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .45s ease}'
+'#sw-splash.out{opacity:0;pointer-events:none}'
+'#sw-splash img{width:112px;height:112px;border-radius:26px;box-shadow:0 10px 40px rgba(43,214,123,.28);animation:sw-pop .7s cubic-bezier(.2,.9,.3,1.2) both}'
+'#sw-splash b{font-size:30px;letter-spacing:.5px;animation:sw-up .6s .15s ease both}'
+'#sw-splash small{opacity:.6;font-size:12px;letter-spacing:1.5px;animation:sw-up .6s .25s ease both}'
+'#sw-splash .sw-bar{width:180px;height:5px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:18px}'
+'#sw-splash .sw-bar i{display:block;height:100%;width:0;border-radius:5px;background:#2bd67b;transition:width .25s ease}'
+'#sw-splash .sw-txt{font-size:12px;opacity:.7;animation:sw-blink 1.2s infinite}'
+'@keyframes sw-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}'
+'@keyframes sw-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
+'@keyframes sw-blink{50%{opacity:.3}}';
const el=document.createElement('div');el.id='sw-splash';el.setAttribute('role','status');
el.innerHTML=(logo?'<img alt="" src="'+logo+'">':'')+'<b>SplineWay</b><small>BY BYHASSSTUDIO</small><div class="sw-bar"><i></i></div><div class="sw-txt">Loading…</div>';
const root=document.documentElement;root.appendChild(st);root.appendChild(el);
const bar=el.querySelector('i');
let p=0,done=false;
const tick=setInterval(function(){if(done)return;p+=(90-p)*0.08;bar.style.width=p.toFixed(1)+'%'},120);
function finish(){
  if(done)return;done=true;clearInterval(tick);bar.style.width='100%';
  setTimeout(function(){
    el.classList.add('out');
    setTimeout(function(){el.remove();st.remove()},500);
  },Math.max(250,MIN-(Date.now()-t0)));
}
if(document.readyState==='complete')finish();else addEventListener('load',finish);
setTimeout(finish,MAX);
})();
