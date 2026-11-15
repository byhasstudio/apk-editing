/* Bilah navigasi beranda (HP: di bawah, komputer: di kanan) + ikon rapi untuk tombol editor 2D dan 3D.
   Hanya tampilan: ID, struktur, dan logika lama tidak diubah. Tombol lama dipakai lewat .click(). Dimuat dari js/home-ref.js. */
(function(){
'use strict';
const $=id=>document.getElementById(id),home=$('home');
if(!home)return;
const P={
 home:'<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/>',
 preset:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
 cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
 folder:'<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
 timeline:'<path d="M3 7h12M3 12h18M3 17h9"/>',
 media:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5l5 2.5-5 2.5z"/>',
 sliders:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
 spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
 scissors:'<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5L20 18M8 15.5L20 6"/>',
 copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 paste:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 12h6M9 16h4"/>',
 check:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
 type:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
 pen:'<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.5 2.2 2 3.5 2s2.5-.5 3.5-2M9 9.5h.01M15 9.5h.01"/>',
 layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
 rec:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
 wave:'<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
 image:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>',
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
 target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>',
 music:'<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
 up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
 out:'<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
 cloud:'<path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18z"/>'
};
const svg=(n,c)=>'<svg class="'+(c||'ic')+'" viewBox="0 0 24 24" aria-hidden="true">'+P[n]+'</svg>';
const press=id=>{const b=$(id);if(b)b.click();else try{APK.app.toast('Fitur belum tersedia')}catch(_){}};

/* ===== bilah navigasi beranda ===== */
const nav=document.createElement('nav');nav.id='app-nav';nav.setAttribute('aria-label','Menu utama');
const items=[['home','home','Beranda'],['preset','preset','Preset'],['cube','3d','Ruang 3D'],['folder','open','Buka'],['user','me','Saya']];
nav.innerHTML=items.map(i=>'<button type="button" data-n="'+i[1]+'"'+(i[1]==='home'?' class="on" aria-current="page"':'')+'>'+svg(i[0],'ic nv')+'<span>'+i[2]+'</span></button>').join('');
home.appendChild(nav);

const dlg=document.createElement('dialog');dlg.id='dlg-me';
dlg.innerHTML='<form method="dialog"><h3>Akun</h3><div class="me-card">'+svg('user','ic nv')+'<div><b id="me-name"></b><small>Project tersimpan di perangkat ini</small></div></div>'+
 '<div class="me-list"><button type="button" class="btn" id="me-sync">'+svg('cloud')+'Sinkron sekarang</button><button type="button" class="btn danger" id="me-out">'+svg('out')+'Keluar</button></div>'+
 '<div class="dlg-actions"><button class="btn" value="cancel">Tutup</button></div></form>';
document.body.appendChild(dlg);
dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
$('me-sync').onclick=()=>{dlg.close();press('btn-sync')};
$('me-out').onclick=()=>{dlg.close();try{APK.auth.logout()}catch(_){press('btn-logout')}};

nav.addEventListener('click',e=>{
  const b=e.target.closest('[data-n]');if(!b)return;
  const n=b.dataset.n;
  if(n==='home'){const m=home.querySelector('.home-main');if(m)m.scrollTo?m.scrollTo({top:0,behavior:'smooth'}):0;home.scrollTo&&home.scrollTo({top:0,behavior:'smooth'});window.scrollTo(0,0)}
  else if(n==='preset')press('btn-preset-home');
  else if(n==='3d')press('btn-3d');
  else if(n==='open')press('btn-open');
  else if(n==='me'){let u='';try{u=APK.auth.user||''}catch(_){}$('me-name').textContent=u||'Belum masuk';$('me-sync').hidden=!$('btn-sync');dlg.showModal()}
});

/* ===== tab bawah editor 2D (HP): ikon di atas teks ===== */
const tabIc={timeline:'timeline',media:'media',props:'sliders',efek:'spark'};
document.querySelectorAll('#mtabs button').forEach(b=>{
  const k=b.dataset.tab;if(!tabIc[k]||b.querySelector('svg'))return;
  const t=b.textContent.trim();b.innerHTML=svg(tabIc[k],'ic nv')+'<span>'+t+'</span>';
});

/* ===== ikon pada tombol editor 2D dan 3D (teks tetap, simbol lama diganti ikon) ===== */
const map={
 'tl-split':'scissors','tl-dup':'copy','tl-del':'trash','tl-copy':'copy','tl-paste':'paste','tl-multi':'check','tl-text':'type','tl-pen':'pen',
 'tl-sticker':'smile','tl-group':'layers','tl-auto':'rec','tl-fx':'spark','tl-ext':'wave',
 's3-add-text':'type','s3-add-media':'image','s3-add-html':'file','s3-track':'target','s3-add-cam':'video','s3-add-group':'layers','s3-music':'music','s3-dup':'copy','s3-up':'up','s3-del':'trash'
};
const label={'s3-add-cam':'Kamera','s3-up':'Naik','tl-multi':'Pilih banyak'};
Object.keys(map).forEach(id=>{
  const b=$(id);if(!b||b.querySelector('svg'))return;
  const n=b.firstChild;
  if(n&&n.nodeType===3){
    let t=n.nodeValue.replace(/^\s*(?:[^\p{L}\p{N}\s]+|T(?=\s))\s*/u,'');
    if(label[id]&&(!t.trim()||t.trim()==='+'))t=label[id];
    n.nodeValue=t;
  }
  b.insertAdjacentHTML('afterbegin',svg(map[id]));
  b.classList.add('has-ic');
});
})();
