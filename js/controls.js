/* KONTROL PER PERANGKAT (beranda + editor video 2D + Edit 3D untuk shortcut, tombol ⌨, dan getar). Dimuat setelah js/ui.js; butuh js/device.js.
   PC / keyboard : shortcut tambahan (+ - zoom timeline, F layar penuh, N snap, Ctrl+E export, ? daftar shortcut; di beranda N / O),
                   tombol ⌨ di bilah atas (hanya saat input mouse) yang membuka daftar shortcut.
   Mobile / sentuh: cubit 2 jari di timeline = zoom (berpusat di playhead / jari), geser kiri-kanan di panel Media / Properti / Efek
                   = pindah tab, ketuk 2 jari di preview = play / pause, getar singkat pada tombol (Android).
   Semua memakai tombol dan fungsi yang sudah ada (tl-zin, tl-zout, pv-full, tl-snap, btn-export, preview.toggle), jadi tidak mengubah logika timeline. */
(function(){
'use strict';
const $=id=>document.getElementById(id),HEAD=56;
const dev=()=>(window.APK&&APK.device)||{mode:'pc',input:'mouse',isMobile:false,isTouch:false};
const shown=id=>{const e=$(id);return !!e&&!e.hidden};
const typing=e=>{const t=e.target;return !!t&&(/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)||!!t.isContentEditable)};
const dlgOpen=()=>!!document.querySelector('dialog[open]');
const editorOpen=()=>shown('editor')&&!!(window.APK&&APK.project&&APK.project.current);
const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(_){return null}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(m,ms){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),ms||2200)}

/* ===== zoom timeline yang menjaga posisi: berpusat di playhead (kalau terlihat), di jari, atau di tengah ===== */
function zoomBy(dir,anchorX){
  const sc=$('tl-scroll'),b=$(dir>0?'tl-zin':'tl-zout'),ph=$('tl-ph');if(!sc||!b)return;
  const sl=sc.scrollLeft,vw=sc.clientWidth,x0=ph?parseFloat(ph.style.left)||0:0;
  const ax=anchorX!=null?anchorX:((x0-sl>=HEAD&&x0-sl<=vw-10)?x0-sl:vw/2);   /* posisi jangkar di layar */
  const c0=sl+ax;                                                            /* posisi jangkar di dalam konten */
  b.click();
  const ph2=$('tl-ph'),x1=ph2?parseFloat(ph2.style.left)||0:0;
  let k=dir>0?1.25:.8;
  if(x0-HEAD>5&&x1>0)k=(x1-HEAD)/(x0-HEAD);                                  /* faktor zoom sebenarnya (bisa 1 kalau sudah mentok) */
  sc.scrollLeft=HEAD+(c0-HEAD)*k-ax;
}

/* ===== daftar shortcut ===== */
const KEYS=[
  ['Umum',[['Spasi','Play / Pause'],['Ctrl + S','Simpan'],['Ctrl + Z / Ctrl + Y','Undo / Redo'],['Ctrl + E','Export video'],['F','Layar penuh preview'],['?','Daftar shortcut ini']]],
  ['Timeline',[['S','Belah clip di playhead'],['Delete','Hapus clip terpilih'],['Ctrl + D','Duplikat'],['Ctrl + C / X / V','Salin / potong / tempel'],['Ctrl + A','Pilih semua clip'],['Shift / Ctrl + klik','Pilih banyak clip'],['Esc','Batal pilih'],['T','Tambah teks'],['N','Snap nyala / mati'],['+ / −','Zoom timeline'],['Ctrl + scroll','Zoom timeline'],['Alt + seret','Seret playhead tanpa snap']]],
  ['Playhead dan keyframe',[['← / →','Mundur / maju 1 frame (Shift: 1 detik)'],['Home / End','Ke awal / akhir'],['K','Keyframe semua properti'],['[ / ]','Loncat ke keyframe sebelum / sesudah']]],
  ['Edit 3D',[['Spasi','Play / Pause'],['Ctrl + S','Simpan'],['Ctrl + Z / Ctrl + Y','Undo / Redo'],['Q / W / E / R','Alat Pilih / Geser / Putar / Skala'],['F','Fokus ke objek terpilih'],['Delete','Hapus objek terpilih'],['?','Daftar shortcut ini']]],
  ['Beranda',[['N','Project baru'],['O','Buka project']]]
];
function openKeys(){
  let d=$('dlg-keys');
  if(!d){
    d=document.createElement('dialog');d.id='dlg-keys';
    d.innerHTML='<form method="dialog"><h3>Shortcut keyboard</h3>'+KEYS.map(s=>'<div class="keys-sec">'+esc(s[0])+'</div>'+s[1].map(r=>'<div class="keys-row"><span>'+esc(r[1])+'</span><kbd>'+esc(r[0])+'</kbd></div>').join('')).join('')
      +'<div class="dlg-actions"><button class="btn primary" value="cancel" formnovalidate>Tutup</button></div></form>';
    document.body.appendChild(d);
  }
  if(!d.open)d.showModal();
}
(function(){
  const help=$('btn-help');if(!help||$('btn-keys'))return;
  const b=document.createElement('button');b.className='btn';b.id='btn-keys';b.type='button';b.textContent='⌨';
  b.title='Daftar shortcut keyboard (?)';b.setAttribute('aria-label','Shortcut keyboard');b.onclick=openKeys;
  help.insertAdjacentElement('beforebegin',b);
})();
/* tombol ⌨ yang sama di bilah atas Edit 3D (tampil hanya saat input mouse, lihat css/device3d.css) */
(function(){
  const anchor=$('s3-export');if(!anchor||$('btn-keys3'))return;
  const b=document.createElement('button');b.className='btn';b.id='btn-keys3';b.type='button';b.textContent='⌨';
  b.title='Daftar shortcut keyboard (?)';b.setAttribute('aria-label','Shortcut keyboard');b.onclick=openKeys;
  anchor.insertAdjacentElement('beforebegin',b);
})();

/* ===== shortcut tambahan (tidak aktif saat mengetik atau saat dialog terbuka; melengkapi js/keyboard.js) ===== */
addEventListener('keydown',e=>{
  if(dlgOpen()||typing(e)||e.altKey)return;
  const k=e.key,lk=k.toLowerCase(),ctrl=e.ctrlKey||e.metaKey;
  if(editorOpen()){
    if(!ctrl&&(k==='+'||k==='=')){e.preventDefault();zoomBy(1)}
    else if(!ctrl&&(k==='-'||k==='_')){e.preventDefault();zoomBy(-1)}
    else if(!ctrl&&lk==='f'){e.preventDefault();const b=$('pv-full');if(b)b.click()}
    else if(!ctrl&&lk==='n'){e.preventDefault();const b=$('tl-snap');if(b){b.click();toast(b.classList.contains('on')?'Snap nyala':'Snap mati')}}
    else if(ctrl&&!e.shiftKey&&lk==='e'){e.preventDefault();const b=$('btn-export');if(b)b.click()}
    else if(k==='?'){e.preventDefault();openKeys()}
  }else if(shown('s3d')){
    if(ctrl&&!e.shiftKey&&lk==='s'){e.preventDefault();const b=$('s3-savebtn');if(b)b.click()}
    else if(k==='?'){e.preventDefault();openKeys()}
  }else if(shown('home')){
    if(!ctrl&&lk==='n'){e.preventDefault();const b=$('btn-new');if(b)b.click()}
    else if(!ctrl&&lk==='o'){e.preventDefault();const b=$('btn-open');if(b)b.click()}
    else if(k==='?'){e.preventDefault();openKeys()}
  }
});

/* ===== gestur sentuh ===== */
const touches=new Set();   /* id pointer sentuh yang sedang menempel */
addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touches.add(e.pointerId)},true);
['pointerup','pointercancel'].forEach(t=>addEventListener(t,e=>{touches.delete(e.pointerId)},true));
/* jari kedua = awal cubit / ketuk 2 jari: batalkan seretan clip yang sempat dimulai jari pertama dan jangan teruskan ke timeline */
function secondFinger(e,area){
  if(e.pointerType!=='touch'||touches.size<2)return;
  if(area==='tl'){
    const first=[...touches].find(id=>id!==e.pointerId),root=$('tl-content');
    if(first!=null&&root){try{root.dispatchEvent(new PointerEvent('pointercancel',{pointerId:first,pointerType:'touch',bubbles:true}))}catch(_){}}
  }
  e.stopPropagation();
}
(function(){
  const tls=$('tl-scroll'),pw=$('preview-wrap');
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  if(tls){
    tls.addEventListener('pointerdown',e=>secondFinger(e,'tl'),true);
    let pin=null;
    tls.addEventListener('touchstart',e=>{pin=e.touches.length===2?{d:dist(e.touches)||1}:null},{passive:true});
    tls.addEventListener('touchmove',e=>{
      if(!pin||e.touches.length!==2)return;
      const d=dist(e.touches),r=d/pin.d,rect=tls.getBoundingClientRect(),cx=(e.touches[0].clientX+e.touches[1].clientX)/2-rect.left;
      if(r>1.22){zoomBy(1,cx);pin.d=d}else if(r<1/1.22){zoomBy(-1,cx);pin.d=d}
    },{passive:true});
    tls.addEventListener('touchend',e=>{if(e.touches.length<2)pin=null},{passive:true});
  }
  if(pw){
    pw.addEventListener('pointerdown',e=>secondFinger(e,'pv'),true);
    let tap=null;
    pw.addEventListener('touchstart',e=>{
      if(e.touches.length===2)tap={t:Date.now(),x:e.touches[0].clientX,y:e.touches[0].clientY};
      else tap=null;
    },{passive:true});
    pw.addEventListener('touchmove',e=>{if(tap&&Math.hypot(e.touches[0].clientX-tap.x,e.touches[0].clientY-tap.y)>14)tap=null},{passive:true});
    pw.addEventListener('touchend',e=>{
      if(tap&&e.touches.length===0&&Date.now()-tap.t<350&&window.APK&&APK.preview){tap=null;APK.preview.toggle()}
      else if(e.touches.length===0)tap=null;
    },{passive:true});
  }
})();

/* geser kiri / kanan di panel Media, Properti, Efek = pindah tab (hanya tata letak mobile) */
(function(){
  const AREA='#panel-media,#panel-props,#panel-efek,#mtabs';
  const hScroll=t=>{
    for(let el=t;el&&el!==document.body;el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+4&&/(auto|scroll)/.test(getComputedStyle(el).overflowX))return true;
      if(el.matches&&el.matches(AREA))break;
    }
    return false;
  };
  let sw=null;
  document.addEventListener('touchstart',e=>{
    sw=null;
    if(!dev().isMobile||e.touches.length!==1||dlgOpen())return;
    const t=e.target;if(!t.closest||!t.closest(AREA))return;
    if(t.closest('input,select,textarea,canvas,[contenteditable]')||hScroll(t))return;
    sw={x:e.touches[0].clientX,y:e.touches[0].clientY,t:Date.now()};
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(!sw)return;
    const p=e.changedTouches[0],dx=p.clientX-sw.x,dy=p.clientY-sw.y,dt=Date.now()-sw.t;sw=null;
    if(dt>600||Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.8)return;
    const ed=$('editor'),btns=[...document.querySelectorAll('#mtabs button[data-tab]')];if(!ed||!btns.length)return;
    const i=btns.findIndex(b=>b.dataset.tab===ed.dataset.tab),n=btns[i+(dx<0?1:-1)];
    if(i>=0&&n)n.click();
  },{passive:true});
})();

/* getar singkat saat menekan tombol (Android; iOS mengabaikan) */
document.addEventListener('click',e=>{
  if(!dev().isTouch||!navigator.vibrate||!e.target.closest)return;
  const b=e.target.closest('#editor button,#home button,#s3d button');
  if(b&&!b.disabled)navigator.vibrate(6);
},true);

/* petunjuk gestur sekali saja saat pertama membuka editor di layar sentuh */
(function(){
  const ed=$('editor');if(!ed)return;
  new MutationObserver(()=>{
    if(ed.hidden||!dev().isTouch||LS('apk.gesture'))return;
    LS('apk.gesture','1');
    setTimeout(()=>{if(!ed.hidden)toast('Gestur: cubit di timeline = zoom · geser kiri / kanan di panel = pindah tab · ketuk 2 jari di preview = play / pause',6500)},1200);
  }).observe(ed,{attributes:true,attributeFilter:['hidden']});
})();
})();
