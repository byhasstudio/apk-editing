/* Beranda: 1 kartu utama + 3 jalan pintas ke fitur yang sudah ada. Memakai tombol lama lewat .click(). */
(function(){
'use strict';
/* timeline Edit 3D dimuat dari sini supaya index.html tidak perlu diubah */
try{const s=document.createElement('script');s.src='js/s3timeline.js?v=1';document.body.appendChild(s)}catch(_){}
const $=id=>document.getElementById(id),home=$('home'),main=home&&home.querySelector('.home-main');
if(!main)return;
const I={
 plus:'<path d="M12 5v14M5 12h14"/>',
 img:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
 cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
 file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+I[n]+'</svg>';
const press=id=>{const b=$(id);if(b)b.click();else try{APK.app.toast('Fitur belum tersedia')}catch(_){}};

const box=document.createElement('div');box.className='hr';
box.innerHTML=
 '<div class="hr-hi"><h1>Mau bikin apa hari ini?</h1><p>Lanjutkan proyekmu atau mulai yang baru.</p></div>'+
 '<div class="hr-go">'+
  '<button class="hr-main" data-b="btn-new"><span class="ic">'+ic('plus')+'</span><div><b>Mulai dari kosong</b><span>Atur rasio, resolusi, dan fps</span></div></button>'+
  '<button class="hr-sm" data-b="btn-preset-home"><span class="ic">'+ic('img')+'</span><div><b>Preset</b><span>Ganti foto, animasi sudah jadi</span></div></button>'+
  '<button class="hr-sm" data-b="btn-3d"><span class="ic">'+ic('cube')+'</span><div><b>Ruang 3D</b><span>Kamera dan tracking titik</span></div></button>'+
  '<button class="hr-sm" data-b="btn-open"><span class="ic">'+ic('file')+'</span><div><b>Buka file</b><span>Dari .apkedit.json</span></div></button>'+
 '</div>';
main.prepend(box);
box.addEventListener('click',e=>{const b=e.target.closest('[data-b]');if(b)press(b.dataset.b)});

const h=[...main.children].find(e=>e.tagName==='H2'&&/project terakhir/i.test(e.textContent));
if(h)h.textContent='Lanjutkan proyek';
})();
