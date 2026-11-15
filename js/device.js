/* MODE PERANGKAT OTOMATIS (beranda + editor video 2D). Dimuat paling awal di <head>, jadi tampilan benar sejak frame pertama.
   Dua hal ditentukan terpisah lalu dipasang sebagai atribut di <html> (dipakai css/device.css dan js/controls.js):
   - data-device = "mobile" | "pc"    TATA LETAK, dari lebar layar (<= 900px = mobile, sama dengan batas di css/mobile.css)
   - data-input  = "touch" | "mouse"  KONTROL dan ukuran tombol, dari jenis input:
       ponsel / tablet (input utama sentuh)  -> touch
       PC / laptop biasa                     -> mouse
       laptop layar sentuh (mouse + sentuh)  -> mengikuti alat yang terakhir dipakai
   Berubah sendiri saat layar diputar, jendela diubah ukurannya, atau input berganti. Tanpa tombol manual. */
(function(){
'use strict';
window.APK=window.APK||{};
const R=document.documentElement,BP=900;
const q=s=>window.matchMedia?matchMedia(s):{matches:false,addEventListener(){}};
const coarse=q('(pointer: coarse)'),anyCoarse=q('(any-pointer: coarse)'),anyFine=q('(any-pointer: fine)');
let last='',cur={mode:'',input:''},raf=0;
const hybrid=()=>anyCoarse.matches&&anyFine.matches;
function calc(){
  const w=window.innerWidth||R.clientWidth;
  let input=coarse.matches?'touch':'mouse';
  if(hybrid()&&last)input=last==='mouse'?'mouse':'touch';
  return{mode:w<=BP?'mobile':'pc',input};
}
function apply(){
  raf=0;const n=calc();
  if(n.mode===cur.mode&&n.input===cur.input)return;
  const prev=cur;cur=n;
  R.dataset.device=n.mode;R.dataset.input=n.input;
  try{dispatchEvent(new CustomEvent('apk-device',{detail:{mode:n.mode,input:n.input,prev}}))}catch(_){}
}
const sched=()=>{if(!raf)raf=requestAnimationFrame(apply)};
apply();
addEventListener('resize',sched);addEventListener('orientationchange',sched);
[coarse,anyCoarse,anyFine].forEach(m=>{if(m.addEventListener)m.addEventListener('change',sched);else if(m.addListener)m.addListener(sched)});
/* laptop layar sentuh: alat yang terakhir dipakai menentukan mode kontrol */
addEventListener('pointerdown',e=>{
  if(!hybrid())return;
  const t=e.pointerType==='mouse'?'mouse':'touch';
  if(t!==last){last=t;sched()}
},true);
APK.device={
  get mode(){return cur.mode},get input(){return cur.input},
  get isMobile(){return cur.mode==='mobile'},get isTouch(){return cur.input==='touch'},
  onChange(fn){addEventListener('apk-device',e=>fn(e.detail));fn({mode:cur.mode,input:cur.input})}
};
})();
