/* Bilah transport timeline (gaya editor mobile): snap, frame mundur / maju, play / pause, undo / redo.
   Hanya meneruskan klik ke tombol yang sudah ada dan menyalin statusnya, jadi logika timeline tidak berubah. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const PLAY='<svg viewBox="0 0 24 24"><path class="f" d="M7 4.5v15l13-7.5z"/></svg>',PAUSE='<svg viewBox="0 0 24 24"><path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
function init(){
  const play=$('tr-play');if(!play||!$('pv-play'))return;
  const frame=d=>{const P=APK.project&&APK.project.current;if(!P)return;const fps=P.fps||30;APK.preview.seek(Math.max(0,APK.preview.time+d/fps))};
  $('tr-prev').onclick=()=>frame(-1);
  $('tr-next').onclick=()=>frame(1);
  play.onclick=()=>$('pv-play').click();
  $('tr-snap').onclick=()=>$('tl-snap').click();
  $('tr-undo').onclick=()=>$('btn-undo').click();
  $('tr-redo').onclick=()=>$('btn-redo').click();
  const sync=()=>{
    play.innerHTML=$('pv-play').textContent.trim()==='▶'?PLAY:PAUSE;
    $('tr-snap').classList.toggle('on',$('tl-snap').classList.contains('on'));
    $('tr-undo').disabled=$('btn-undo').disabled;$('tr-redo').disabled=$('btn-redo').disabled;
    $('tr-time').textContent=($('pv-time').textContent.split('/')[0]||'').trim();
  };
  const mo=new MutationObserver(sync),o={attributes:true,childList:true,characterData:true,subtree:true};
  ['pv-play','tl-snap','btn-undo','btn-redo','pv-time'].forEach(id=>mo.observe($(id),o));
  sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* ===== Ikon bilah alat timeline (SVG buatan sendiri, tanpa emoji) =====
   Tombol di bilah bawah dan di menu Edit / Tambah / Lainnya diganti ikon; fungsi, ID, dan pemasangan event tombol tidak berubah.
   Bilah dibangun beberapa skrip lain (menu, efek, ganti media, ...), jadi ikon dipasang ulang saat isi bilah berubah. */
(function(){
'use strict';
const A=(d,c)=>`<svg viewBox="0 0 24 24" class="ti${c?' '+c:''}" aria-hidden="true">${d}</svg>`;
const I={
  split:'<rect x="3" y="7" width="7" height="10" rx="1.5"/><rect x="14" y="7" width="7" height="10" rx="1.5"/><path d="M12 3v18"/>',
  replace:'<path d="M4 8h13l-3-3.5M20 16H7l3 3.5"/>',
  edit:'<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>',
  add:'<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M12 8v8M8 12h8"/>',
  more:'<circle class="f" cx="5" cy="12" r="1.9"/><circle class="f" cx="12" cy="12" r="1.9"/><circle class="f" cx="19" cy="12" r="1.9"/>',
  auto:'<circle cx="12" cy="12" r="9"/><circle class="f" cx="12" cy="12" r="4"/>',
  fx:'<path d="M12 3l2.3 6.4L21 12l-6.7 2.6L12 21l-2.3-6.4L3 12l6.7-2.6z"/>',
  wave:'<path d="M2 12c3-9 6-9 10 0s7 9 10 0"/>',
  waveclr:'<path d="M2 15c2.5-8 5-8 8 0s4.5 8 7 3"/><path d="M17 3l4.5 4.5M21.5 3L17 7.5"/>',
  snap:'<path d="M5 3v8a7 7 0 0014 0V3h-4v8a3 3 0 01-6 0V3z"/><path d="M5 7h4M15 7h4"/>',
  zout:'<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16M8 11h6"/>',
  zin:'<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16M8 11h6M11 8v6"/>',
  dup:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/><path d="M14 11v6M11 14h6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>',
  paste:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>',
  multi:'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M5 7l2 2 3-4M15 17l2 2 3-4"/>',
  ext:'<path d="M3 9v6h4l5 4V5L7 9z"/><path d="M16 12h6M19.5 9.5L22 12l-2.5 2.5"/>',
  del:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  text:'<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  pen:'<path d="M12 3l6 9-3 7H9l-3-7z"/><circle cx="12" cy="13" r="1.6"/><path d="M12 19v2"/>',
  sticker:'<circle cx="12" cy="12" r="9"/><path d="M8.3 14.2a4.2 4.2 0 007.4 0"/><circle class="f" cx="9" cy="10" r="1.1"/><circle class="f" cx="15" cy="10" r="1.1"/>',
  group:'<rect x="3" y="3" width="18" height="18" rx="3.5" stroke-dasharray="3 2.4"/><rect x="8" y="8" width="8" height="8" rx="1.6"/>'
};
/* id tombol -> [ikon, nama (untuk tooltip dan pembaca layar), kelas warna] */
const BAR={'tl-split':['split','Belah clip di playhead'],'tl-replace':['replace','Ganti media clip'],'tl-auto':['auto','Kurva otomatis','c-rec'],'tl-fx':['fx','Efek'],
  'tl-yel':['wave','Garis kuning','c-yel'],'tl-blu':['wave','Garis biru','c-blu'],'tl-bluclr':['waveclr','Hapus garis biru','c-blu'],'tl-snap':['snap','Snap'],'tl-zout':['zout','Perkecil timeline'],'tl-zin':['zin','Perbesar timeline']};
const MENU={'Edit':['edit','Menu Edit'],'Tambah':['add','Menu Tambah'],'Lainnya':['more','Menu Lainnya']};
const ITEM={'tl-dup':'dup','tl-copy':'copy','tl-paste':'paste','tl-multi':'multi','tl-ext':'ext','tl-del':'del','tl-text':'text','tl-pen':'pen','tl-sticker':'sticker','tl-group':'group'};
const clean=t=>t.replace(/^[^\p{L}\p{N}]+/u,'').trim();
const $=id=>document.getElementById(id);
function apply(){
  const bar=document.querySelector('#editor .tl-bar');if(!bar)return;
  for(const b of bar.querySelectorAll(':scope>button')){
    if(b.dataset.ic)continue;
    let def=BAR[b.id];
    if(!def&&b.classList.contains('hx-btn')){
      const m=MENU[clean(b.textContent).replace(/\s*▾$/,'').trim()];
      if(m)def=m;
    }
    if(!def)continue;
    b.dataset.ic='1';b.classList.add('ic-btn');if(def[2])b.classList.add(def[2]);
    const keepTitle=b.getAttribute('title');
    b.innerHTML=A(I[def[0]]);
    b.setAttribute('aria-label',def[1]);b.setAttribute('title',keepTitle||def[1]);
  }
  /* tombol di dalam menu Edit / Tambah: ikon di depan, tulisan tetap supaya jelas */
  for(const id in ITEM){
    const b=$(id);if(!b||b.dataset.ic||b.tagName!=='BUTTON')continue;
    const label=clean(b.textContent);
    b.dataset.ic='1';b.classList.add('ic-item');
    b.innerHTML=A(I[ITEM[id]])+'<span>'+label+'</span>';
    if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',label);
  }
}
function start(){
  apply();
  const bar=document.querySelector('#editor .tl-bar');
  if(bar)new MutationObserver(apply).observe(bar,{childList:true});
  new MutationObserver(apply).observe(document.body,{childList:true});
  [200,800,2000].forEach(t=>setTimeout(apply,t));
}
if(document.readyState==='complete')start();else addEventListener('load',start);
})();
