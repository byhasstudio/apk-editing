/* LAYAR PEMBUKA / WELCOME SplineWay: tampil saat aplikasi dibuka (browser, APK, dan EXE).
   Dimuat di <head> setelah js/brand.js (memakai APK.brand.logo) dan js/auth.js (memakai APK.auth.user untuk sapaan nama).
   Layar dipasang langsung ke <html> supaya muncul sebelum halaman selesai dimuat.
   Isi: latar aurora bergerak + grid + partikel naik, logo dengan cincin berputar dan denyut cahaya, judul huruf demi huruf dengan kilau
   bergelombang, kurva spline yang digambar dengan titik kontrol dan titik yang berjalan di kurva, sapaan sesuai jam + nama akun, kata kunci
   fitur yang berganti-ganti, dan bilah loading bergradasi.
   Tampil minimal MIN milidetik supaya animasinya terbaca, hilang setelah semua file selesai dimuat (event load), lalu memudar sambil membesar dan
   dibuang. Setelah selesai dimuat, ketuk layar untuk melewati. Batas aman MAX: kalau load tak kunjung selesai, layar tetap ditutup.
   Mengikuti prefers-reduced-motion. Tidak menyentuh apa pun di aplikasi. */
(function(){
'use strict';
if(window.__swSplash)return;window.__swSplash=1;
const BUILD='build 21-11-26 a',MIN=2600,MAX=8000,t0=Date.now();
const logo=(window.APK&&APK.brand&&APK.brand.logo)||'';
const PHRASES=['Animasi halus','Keyframe presisi','Efek & transisi','Edit 3D','Export 60 fps'];

/* sapaan: sesuai jam + nama dari akun (bagian sebelum @) */
function greet(){
  const h=new Date().getHours();
  const w=h<11?'pagi':h<15?'siang':h<18?'sore':'malam';
  let n='';
  try{n=String((window.APK&&APK.auth&&APK.auth.user)||'').split('@')[0].replace(/[._\-]+/g,' ').trim().slice(0,18)}catch(e){}
  if(n)n=n.charAt(0).toUpperCase()+n.slice(1);
  return n?('Selamat '+w+', '+n):('Selamat datang, selamat '+w);
}

const st=document.createElement('style');
st.textContent=`
#sw-splash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#050818;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;overflow:hidden;transition:opacity .65s ease,transform .65s cubic-bezier(.4,0,.2,1),filter .65s ease}
#sw-splash.out{opacity:0;transform:scale(1.08);filter:blur(10px);pointer-events:none}
#sw-splash *{box-sizing:border-box}
#sw-splash .sw-blob{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;mix-blend-mode:screen;will-change:transform}
#sw-splash .b1{width:60vmax;height:60vmax;left:-20vmax;top:-18vmax;background:#2bd67b;animation:sw-d1 9s ease-in-out infinite alternate}
#sw-splash .b2{width:55vmax;height:55vmax;right:-20vmax;bottom:-20vmax;background:#2f6bff;animation:sw-d2 11s ease-in-out infinite alternate}
#sw-splash .b3{width:40vmax;height:40vmax;right:-8vmax;top:8vmax;background:#9b5cff;opacity:.35;animation:sw-d3 13s ease-in-out infinite alternate}
@keyframes sw-d1{to{transform:translate(22vmax,16vmax) scale(1.2)}}
@keyframes sw-d2{to{transform:translate(-20vmax,-14vmax) scale(1.15)}}
@keyframes sw-d3{to{transform:translate(-26vmax,18vmax) scale(.85)}}
#sw-splash .sw-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 0,transparent 68%);mask-image:radial-gradient(circle at 50% 50%,#000 0,transparent 68%);animation:sw-grid 5s linear infinite}
@keyframes sw-grid{to{background-position:44px 44px,44px 44px}}
#sw-splash .sw-p{position:absolute;bottom:-12px;left:var(--x);width:var(--s);height:var(--s);border-radius:50%;background:#fff;opacity:0;box-shadow:0 0 8px 2px rgba(43,214,123,.65);animation:sw-rise var(--d) var(--dl) linear infinite}
@keyframes sw-rise{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}100%{transform:translate(var(--dx),-112vh);opacity:0}}
#sw-splash .sw-c{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 16px}
#sw-splash .sw-logo{position:relative;width:132px;height:132px;display:flex;align-items:center;justify-content:center;animation:sw-pop .95s cubic-bezier(.2,.9,.3,1.25) both}
#sw-splash .sw-ring{position:absolute;inset:-14px;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 50%,#2bd67b,#3b9bff,transparent);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 1px));animation:sw-rot 2.6s linear infinite}
#sw-splash .sw-ring.r2{inset:-30px;opacity:.5;animation-duration:4.4s;animation-direction:reverse}
#sw-splash .sw-logo::after{content:'';position:absolute;inset:10px;border-radius:30px;box-shadow:0 0 0 0 rgba(43,214,123,.5);animation:sw-pulse 2.2s ease-out 1s infinite}
@keyframes sw-pulse{to{box-shadow:0 0 0 52px rgba(43,214,123,0)}}
#sw-splash .sw-logo img,#sw-splash .sw-mono{position:relative;z-index:1;width:112px;height:112px;border-radius:28px;box-shadow:0 12px 50px rgba(43,214,123,.38),0 0 0 1px rgba(255,255,255,.1);animation:sw-float 4s ease-in-out 1s infinite}
#sw-splash .sw-mono{display:flex;align-items:center;justify-content:center;font-size:58px;font-weight:800;background:linear-gradient(135deg,#2bd67b,#2f6bff)}
@keyframes sw-float{50%{transform:translateY(-7px)}}
@keyframes sw-pop{from{opacity:0;transform:scale(.45) rotate(-12deg)}to{opacity:1;transform:none}}
@keyframes sw-rot{to{transform:rotate(360deg)}}
#sw-splash .sw-title{display:flex;margin:36px 0 0;font-size:clamp(34px,9vw,50px);font-weight:800;letter-spacing:1px;line-height:1.1}
#sw-splash .sw-title span{display:inline-block;opacity:0;background:linear-gradient(100deg,#fff 35%,#6dffb4 50%,#fff 65%) 0 0/300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;animation:sw-letter .75s cubic-bezier(.2,.9,.3,1.2) both,sw-shine 2.6s linear infinite;animation-delay:calc(.4s + var(--i)*.06s),calc(1.4s + var(--i)*.09s)}
@keyframes sw-letter{from{opacity:0;transform:translateY(26px) scale(.8);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
@keyframes sw-shine{from{background-position:100% 0}to{background-position:-100% 0}}
#sw-splash .sw-spl{width:220px;height:34px;margin-top:6px;overflow:visible}
#sw-splash .sw-spl path{stroke-dasharray:300;stroke-dashoffset:300;animation:sw-draw 1.5s .95s ease forwards}
@keyframes sw-draw{to{stroke-dashoffset:0}}
#sw-splash .sw-spl .kp{transform-box:fill-box;transform-origin:center;opacity:0;animation:sw-kp .5s cubic-bezier(.2,.9,.3,1.5) forwards}
@keyframes sw-kp{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
#sw-splash .sw-hi{margin-top:16px;font-size:17px;font-weight:600;color:#e2e8ff;opacity:0;animation:sw-blurin .85s 1.15s ease forwards}
#sw-splash .sw-rotor{margin-top:8px;height:20px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#8ea0d8;opacity:0;animation:sw-blurin .85s 1.4s ease forwards}
#sw-splash .sw-rotor i{display:inline-block;font-style:normal;animation:sw-swap .5s ease both}
@keyframes sw-blurin{from{opacity:0;filter:blur(8px);transform:translateY(8px)}to{opacity:1;filter:none;transform:none}}
@keyframes sw-swap{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
#sw-splash .sw-bar{width:min(220px,58vw);height:3px;margin-top:26px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;opacity:0;animation:sw-blurin .6s 1.2s ease forwards}
#sw-splash .sw-bar i{display:block;height:100%;width:0;border-radius:3px;background:linear-gradient(90deg,#2bd67b,#3b9bff,#9b5cff);box-shadow:0 0 12px #2bd67b}
#sw-splash .sw-by{margin-top:22px;font-size:11px;letter-spacing:4px;color:#7480b0;opacity:0;animation:sw-by 1.4s 1.5s ease forwards}
@keyframes sw-by{from{opacity:0;letter-spacing:14px}to{opacity:.9;letter-spacing:4px}}
#sw-splash .sw-bd{position:absolute;bottom:max(14px,env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-size:10px;letter-spacing:1px;opacity:.3}
@media (prefers-reduced-motion:reduce){#sw-splash *{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important}}
`;

/* partikel */
let parts='';
for(let i=0;i<26;i++){
  const s=(1.5+Math.random()*3).toFixed(1),x=(Math.random()*100).toFixed(1),dx=Math.round(Math.random()*120-60),d=(5+Math.random()*5).toFixed(1),dl=(Math.random()*5).toFixed(1);
  parts+='<i class="sw-p" style="--s:'+s+'px;--x:'+x+'%;--dx:'+dx+'px;--d:'+d+'s;--dl:'+dl+'s"></i>';
}
const letters='SplineWay'.split('').map(function(c,i){return '<span style="--i:'+i+'">'+c+'</span>'}).join('');
const PATH='M4 26 C 36 26, 48 6, 80 6 S 122 30, 150 19 S 192 4, 216 12';
const spline='<svg class="sw-spl" viewBox="0 0 220 34" aria-hidden="true"><defs><linearGradient id="swg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2bd67b"/><stop offset=".55" stop-color="#3b9bff"/><stop offset="1" stop-color="#9b5cff"/></linearGradient></defs>'
 +'<path d="'+PATH+'" pathLength="300" fill="none" stroke="url(#swg)" stroke-width="2.2" stroke-linecap="round"/>'
 +'<circle class="kp" cx="4" cy="26" r="3.2" fill="#050818" stroke="#2bd67b" stroke-width="1.6" style="animation-delay:.95s"/>'
 +'<circle class="kp" cx="80" cy="6" r="3.2" fill="#050818" stroke="#2bd67b" stroke-width="1.6" style="animation-delay:1.35s"/>'
 +'<circle class="kp" cx="150" cy="19" r="3.2" fill="#050818" stroke="#3b9bff" stroke-width="1.6" style="animation-delay:1.8s"/>'
 +'<circle class="kp" cx="216" cy="12" r="3.2" fill="#050818" stroke="#9b5cff" stroke-width="1.6" style="animation-delay:2.25s"/>'
 +'<circle r="3.6" fill="#fff" opacity="0" style="filter:drop-shadow(0 0 5px #7dffc0)"><set attributeName="opacity" to="1" begin="2.4s"/><animateMotion dur="2.2s" begin="2.4s" repeatCount="indefinite" path="'+PATH+'"/></circle></svg>';

const el=document.createElement('div');el.id='sw-splash';el.setAttribute('role','status');el.setAttribute('aria-label','SplineWay sedang dimuat');
el.innerHTML='<div class="sw-blob b1"></div><div class="sw-blob b2"></div><div class="sw-blob b3"></div><div class="sw-grid"></div>'+parts
 +'<div class="sw-c"><div class="sw-logo"><i class="sw-ring"></i><i class="sw-ring r2"></i>'+(logo?'<img alt="" src="'+logo+'">':'<div class="sw-mono">S</div>')+'</div>'
 +'<h1 class="sw-title" aria-label="SplineWay">'+letters+'</h1>'+spline
 +'<div class="sw-hi" id="sw-hi"></div><div class="sw-rotor" id="sw-rotor"></div>'
 +'<div class="sw-bar"><i id="sw-fill"></i></div><div class="sw-by">BY BYHASSSTUDIO</div></div>'
 +'<div class="sw-bd">'+BUILD+'</div>';
el.querySelector('.sw-title').style.margin='36px 0 0';
el.querySelector('#sw-hi').textContent=greet();
const root=document.documentElement;root.appendChild(st);root.appendChild(el);

/* kata kunci fitur berganti-ganti */
const rotor=el.querySelector('#sw-rotor');let pi=0;
function showPhrase(){rotor.innerHTML='<i></i>';rotor.firstChild.textContent=PHRASES[pi++%PHRASES.length]}
showPhrase();
const rt=setInterval(showPhrase,1100);

/* bilah loading: naik pelan ke 92% selama MIN, penuh saat selesai */
const fill=el.querySelector('#sw-fill');
fill.style.transition='width '+(MIN-300)+'ms cubic-bezier(.3,.6,.3,1)';
setTimeout(function(){fill.style.width='92%'},60);

let done=false,closed=false;
function close(){
  if(closed)return;closed=true;clearInterval(rt);
  fill.style.transition='width .25s ease';fill.style.width='100%';
  setTimeout(function(){
    el.classList.add('out');
    setTimeout(function(){el.remove();st.remove()},750);
  },260);
}
function finish(){
  if(done)return;done=true;
  setTimeout(close,Math.max(250,MIN-(Date.now()-t0)));
}
/* setelah aplikasi selesai dimuat, ketuk layar untuk melewati */
el.addEventListener('click',function(){if(done&&Date.now()-t0>900)close()});
if(document.readyState==='complete')finish();else addEventListener('load',finish);
setTimeout(finish,MAX);
})();
