/* Beranda gaya referensi: menambah promo, kartu besar, grid alat, ide kreatif, dan navigasi.
   Semua tombol memakai tombol lama lewat .click() (btn-new, btn-open, btn-3d, btn-preset-home), jadi logika tidak berubah. */
(function(){
'use strict';
const $=id=>document.getElementById(id),home=$('home'),main=home&&home.querySelector('.home-main');
if(!main)return;
const S={
 plus:'<path d="M12 5v14M5 12h14"/>',img:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M21 16l-5-5-8 9"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',post:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 9l5 3-5 3z"/>',
 cut:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l5 3-5 3z"/>',retouch:'<path d="M7 21v-4a5 5 0 0 1 10 0v4z"/><circle cx="12" cy="9" r="3"/>',
 cc:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 10a2 2 0 0 0-3 1v2a2 2 0 0 0 3 1M17 10a2 2 0 0 0-3 1v2a2 2 0 0 0 3 1"/>',
 cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',open:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 all:'<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>',
 scissor:'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M8 15L19 3M16 15L5 3"/>',tpl:'<rect x="3" y="4" width="12" height="16" rx="2"/><path d="M18 8v8"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',gem:'<path d="M6 3h12l4 6-10 12L2 9z"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+S[n]+'</svg>';
const toast=m=>{try{APK.app.toast(m)}catch(_){}};
const press=id=>{const b=$(id);if(b)b.click();else toast('Fitur ini belum tersedia')};
const soon=()=>toast('Segera hadir');

const TOOLS=[['Preset foto','post',()=>press('btn-preset-home')],['Edit 3D','cube',()=>press('btn-3d')],['Buka project','open',()=>press('btn-open')],['Project baru','plus',()=>press('btn-new')],
 ['AutoCut','cut',soon],['Retouch','retouch',soon],['Keterangan otomatis','cc',soon],['Semua alat','all',soon]];

const top=document.createElement('div');top.className='hr-top';
top.innerHTML='<div class="hr-promo">'+ic('gem').replace('<svg','<svg style="font-size:20px;flex:none;color:#7b5cff"')+'<span>Selamat datang di SplineWay</span></div><button class="hr-srch" aria-label="Cari">'+ic('search')+'</button>';
const hero=document.createElement('div');hero.className='hr-hero hr';
hero.innerHTML='<button class="hr-big" data-a="new"><span class="hr-ico">'+ic('plus')+'</span>Video baru</button><button class="hr-big" data-a="photo"><span class="hr-badge">Preset</span><span class="hr-ico">'+ic('img')+'</span>Edit foto</button>';
const tools=document.createElement('div');tools.className='hr-tools hr';
tools.innerHTML=TOOLS.map((t,i)=>'<button class="hr-tool" data-t="'+i+'"><i>'+ic(t[1])+'</i>'+t[0]+'</button>').join('');
const idea=document.createElement('section');idea.className='hr-sec';
idea.innerHTML='<h2>Ide kreatif</h2><button class="hr-idea" data-a="photo"><span class="im">✨</span><div><b>Ganti foto, animasi tetap jadi</b><span>Pakai preset</span></div></button>';
main.prepend(top,hero,tools,idea);

/* judul daftar project */
const h=[...main.children].find(e=>e.tagName==='H2'&&/project terakhir/i.test(e.textContent));
if(h){h.textContent='Proyek';h.id='hr-proj'}

home.addEventListener('click',e=>{
 const a=e.target.closest('[data-a]'),t=e.target.closest('[data-t]');
 if(a)return press(a.dataset.a==='new'?'btn-new':'btn-preset-home');
 if(t)return TOOLS[+t.dataset.t][2]();
 if(e.target.closest('.hr-srch'))soon();
});

/* navigasi bawah (mobile) / sidebar (PC) */
const nav=document.createElement('nav');nav.className='hr-nav hr';nav.setAttribute('aria-label','Menu utama');
const N=[['Edit','scissor',()=>main.scrollTo?main.scrollTo({top:0,behavior:'smooth'}):0,1],['Template','tpl',()=>press('btn-preset-home')],['Edit 3D','cube',()=>press('btn-3d')],['Pustaka','open',()=>{const p=$('hr-proj');if(p)p.scrollIntoView({behavior:'smooth'})}],['Saya','user',soon]];
nav.innerHTML='<div class="hr-logo">SPLINE<br>WAY</div>'+N.map((n,i)=>'<button data-n="'+i+'"'+(n[3]?' class="on"':'')+'>'+ic(n[1])+n[0]+'</button>').join('');
nav.onclick=e=>{const b=e.target.closest('[data-n]');if(!b)return;N[+b.dataset.n][2]();
 if(+b.dataset.n===0||+b.dataset.n===3){nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))}};
home.appendChild(nav);
})();
