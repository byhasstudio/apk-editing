/* Beranda: kartu utama + bar navigasi (HP: di bawah, PC: di kiri). Memakai tombol lama lewat .click(), jadi fungsi tidak berubah. */
(function(){
'use strict';
/* perbaikan tampilan HP: dimuat dari sini supaya index.html tidak perlu diubah */
try{const l=document.createElement('link');l.rel='stylesheet';l.href='css/mobile-fix.css?v=1';document.head.appendChild(l)}catch(_){}
/* perbaikan: garis merah / label timeline 3D tidak boleh menembus preview yang menempel di atas saat panel di-scroll + gaya bar navigasi beranda */
try{
  const fx=document.createElement('style');
  fx.textContent='#s3x-tl{position:relative;z-index:0;isolation:isolate;contain:paint}'
   +'#s3x-tl .s3x-ph{z-index:2}#s3x-tl .s3x-ruler{z-index:3}#s3x-tl .s3x-lab{z-index:1}'
   +'#s3d .s3-stage{z-index:30}'
   /* kartu utama selebar halaman (kartu kecil digantikan bar navigasi) */
   +'#home .hr-go{grid-template-columns:1fr}#home .hr-main{flex-direction:row;align-items:center;min-height:0}'
   /* akun dipindah ke tombol Profil di bar */
   +'#home #au-chip,#home #btn-logout{display:none}'
   +'#home .home-main{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}'
   +'.hr-bar{position:fixed;z-index:20;left:0;right:0;bottom:0;display:flex;background:var(--panel);border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom,0px))}'
   +'.hr-bar button{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 2px;background:none;border:0;color:var(--dim);font:600 11px/1.1 inherit;font-family:inherit;cursor:pointer}'
   +'.hr-bar button svg{width:26px;height:26px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}'
   +'.hr-bar button.on{color:var(--text)}.hr-bar button:hover{color:var(--text)}'
   +'.hr-bar button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:10px}'
   +'.hr-bar .hr-logo{display:none}'
   +'@media (min-width:900px){#home{padding-left:92px}#home .home-main{padding-bottom:56px}'
   +'.hr-bar{top:0;bottom:0;right:auto;width:92px;flex-direction:column;justify-content:flex-start;gap:14px;border-top:0;border-right:1px solid var(--line);padding:20px 4px}'
   +'.hr-bar button{flex:none;padding:8px 2px;border-radius:12px}.hr-bar button:hover{background:color-mix(in srgb,var(--accent) 10%,transparent)}'
   +'.hr-bar .hr-logo{display:block;text-align:center;font-weight:800;font-size:11px;letter-spacing:.5px;color:var(--accent);margin-bottom:6px}}';
  document.head.appendChild(fx);
}catch(_){}
/* tambahan Edit 3D dimuat berurutan dari sini supaya index.html tidak perlu diubah: timeline -> menu tombol -> animasi/panduan -> fitur pro -> beat -> gerak pro */
function load(src,next){
  try{const s=document.createElement('script');s.src=src;s.onload=s.onerror=()=>{if(next)next()};document.body.appendChild(s)}catch(_){if(next)next()}
}
load('js/s3timeline.js?v=1',()=>load('js/menus.js?v=1',()=>load('js/s3extra.js?v=1',()=>load('js/s3pro.js?v=1',()=>load('js/s3beat.js?v=1',()=>load('js/s3move.js?v=1'))))));
const $=id=>document.getElementById(id),home=$('home'),main=home&&home.querySelector('.home-main');
if(!main)return;
const I={
 plus:'<path d="M12 5v14M5 12h14"/>',
 home:'<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
 img:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
 cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
 open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>';
const press=id=>{const b=$(id);if(b)b.click();else try{APK.app.toast('Fitur belum tersedia')}catch(_){}};

/* kartu utama */
const box=document.createElement('div');box.className='hr';
box.innerHTML=
 '<div class="hr-hi"><h1>Mau bikin apa hari ini?</h1><p>Lanjutkan proyekmu atau mulai yang baru.</p></div>'+
 '<div class="hr-go">'+
  '<button class="hr-main" data-b="btn-new"><span class="ic">'+ic('plus')+'</span><div><b>Mulai dari kosong</b><span>Atur rasio, resolusi, dan fps</span></div></button>'+
 '</div>';
main.prepend(box);
box.addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(b)press(b.dataset.b)});

const h=[...main.children].find(e=>e.tagName==='H2'&&/project terakhir/i.test(e.textContent));
if(h){h.textContent='Lanjutkan proyek';h.id='hr-proj'}

/* bar navigasi: Beranda, Preset, Edit 3D, Buka, Profil */
const bar=document.createElement('nav');bar.className='hr-bar hr';bar.setAttribute('aria-label','Menu utama');
const N=[['Beranda','home',()=>{try{(home.scrollTo||window.scrollTo).call(home.scrollTo?home:window,{top:0,behavior:'smooth'})}catch(_){}}],['Preset','img',()=>press('btn-preset-home')],['Edit 3D','cube',()=>press('btn-3d')],['Buka','open',()=>press('btn-open')],['Profil','user',null]];
bar.innerHTML='<div class="hr-logo">SPLINE<br>WAY</div>'+N.map((n,i)=>'<button type="button" data-n="'+i+'"'+(i===0?' class="on"':'')+'>'+ic(n[1])+n[0]+'</button>').join('');
home.appendChild(bar);

/* Profil: akun yang sedang masuk + Keluar */
const dlg=document.createElement('dialog');dlg.id='hr-prof';
dlg.innerHTML='<form method="dialog"><h3>Akun</h3><p class="meta" id="hr-prof-name"></p><div class="dlg-actions"><button class="btn" value="cancel" formnovalidate>Tutup</button><button class="btn danger" type="button" id="hr-out">Keluar</button></div></form>';
document.body.appendChild(dlg);
function profile(){
  let nm='';try{nm=(APK.auth&&APK.auth.user)||''}catch(_){}
  $('hr-prof-name').textContent=nm?'Masuk sebagai '+nm:'Belum masuk dengan akun.';
  $('hr-out').style.display=nm?'':'none';
  dlg.showModal();
}
$('hr-out').onclick=()=>{dlg.close();const b=$('btn-logout');if(b)b.click();else try{APK.auth.logout()}catch(_){}};
bar.addEventListener('click',e=>{
  const b=e.target.closest('[data-n]');if(!b)return;
  const i=+b.dataset.n;
  if(i===4)return profile();
  if(i===0){bar.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))}
  N[i][2]();
});
})();
