/* pro-ui.js (v31): tombol lipat panel kiri (Media) dan kanan (Properti / Efek) di bilah atas editor 2D, khusus PC.
   Melipat panel membuat preview lebih lebar. Pilihan disimpan di perangkat. Hanya memasang atribut data-pl / data-pr di #editor
   (dipakai css/pro-dark.css); logika editor dan timeline tidak diubah. Panel Efek yang dibuka otomatis membuka panel kanan lagi. */
(function(){
'use strict';
const $=id=>document.getElementById(id),KEY='splineway:pro-panels';
let st={l:1,r:1};
try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o){st.l=o.l===0?0:1;st.r=o.r===0?0:1}}catch(_){}
const ICON=(side)=>'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/>'+(side==='l'?'<rect class="f" x="3" y="4" width="6" height="16" rx="2"/><path d="M9 4v16"/>':'<rect class="f" x="15" y="4" width="6" height="16" rx="2"/><path d="M15 4v16"/>')+'</svg>';
function relayout(){
  [0,120,320].forEach(ms=>setTimeout(()=>{
    try{dispatchEvent(new Event('resize'))}catch(_){}
    try{if(window.APK&&APK.preview)APK.preview.refresh()}catch(_){}
    try{if(window.APK&&APK.gizmo&&APK.gizmo.draw)APK.gizmo.draw()}catch(_){}
  },ms));
}
function apply(){
  const ed=$('editor');if(!ed)return;
  ed.dataset.pl=st.l?'1':'0';ed.dataset.pr=st.r?'1':'0';
  for(const p of [['pro-tg-l',st.l,'panel kiri (Media)'],['pro-tg-r',st.r,'panel kanan (Properti / Efek)']]){
    const b=$(p[0]);if(!b)continue;
    b.classList.toggle('on',!!p[1]);b.setAttribute('aria-pressed',p[1]?'true':'false');
    b.title=(p[1]?'Sembunyikan ':'Tampilkan ')+p[2];
  }
  try{localStorage.setItem(KEY,JSON.stringify(st))}catch(_){}
}
function set(l,r){
  if(l!=null)st.l=l?1:0;
  if(r!=null)st.r=r?1:0;
  apply();relayout();
}
function mk(id,side){
  const b=document.createElement('button');
  b.type='button';b.id=id;b.className='btn pro-tg';b.innerHTML=ICON(side);b.setAttribute('aria-label',side==='l'?'Panel kiri':'Panel kanan');
  b.onclick=()=>side==='l'?set(!st.l,null):set(null,!st.r);
  return b;
}
function init(){
  const ed=$('editor'),top=ed&&ed.querySelector('.top');if(!ed||!top||$('pro-tg-l'))return;
  const anchor=$('btn-mode')||$('btn-export');
  const l=mk('pro-tg-l','l'),r=mk('pro-tg-r','r');
  if(anchor){anchor.before(l);anchor.before(r)}else{top.appendChild(l);top.appendChild(r)}
  apply();
  /* daftar Efek dibuka (js/fxlib.js memasang data-right=efek): buka panel kanan supaya terlihat */
  new MutationObserver(()=>{if(ed.dataset.right==='efek'&&!st.r)set(null,1)}).observe(ed,{attributes:true,attributeFilter:['data-right']});
}
window.APK=window.APK||{};
APK.proUI={setPanels:set,get left(){return !!st.l},get right(){return !!st.r}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
