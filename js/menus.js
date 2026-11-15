/* Menu tombol (editor 2D dan Edit 3D): tombol yang jarang dipakai dikelompokkan ke menu yang terbuka saat ditekan,
   jadi bilah alat jauh lebih ringkas. Tombol aslinya DIPINDAHKAN (bukan disalin), jadi ID, fungsi, dan pintasan keyboard tidak berubah.
   PC: menu mengambang di bawah tombol. HP: lembar menu dari bawah layar. */
(function(){
'use strict';
if(window.__hxMenus)return;window.__hxMenus=true;
const $=id=>document.getElementById(id);
const mobile=()=>matchMedia('(max-width:700px)').matches;
let openP=null;
const st=document.createElement('style');
st.textContent=
 '.hx-btn small{opacity:.7;margin-left:2px}.hx-btn.open{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 14%,var(--panel))}'
+'.hx-pan{position:fixed;z-index:80;min-width:200px;max-width:92vw;display:flex;flex-direction:column;gap:4px;padding:8px;background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px -12px rgba(0,0,0,.65);max-height:70vh;overflow:auto;animation:hx-in .12s ease-out}'
+'.hx-pan[hidden]{display:none}'
+'.hx-pan>.btn,.hx-pan>select{width:100%;text-align:left;justify-content:flex-start;margin:0!important;min-height:38px;border-radius:10px;white-space:nowrap}'
+'.hx-pan>.btn.on{border-color:var(--accent)}'
+'.hx-bg{position:fixed;inset:0;z-index:79;background:rgba(0,0,0,.45);display:none}'
+'@keyframes hx-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'
+'@media (max-width:700px){.hx-pan{left:0!important;right:0;bottom:0;top:auto!important;max-width:none;border-radius:18px 18px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:16px 12px calc(16px + env(safe-area-inset-bottom,0px));max-height:62vh;animation:none}.hx-pan[hidden]{display:none}.hx-pan>.btn,.hx-pan>select{min-height:44px;white-space:normal;text-align:center;justify-content:center}.hx-bg.show{display:block}}'
+'@media (prefers-reduced-motion:reduce){.hx-pan{animation:none}}';
document.head.appendChild(st);
const bg=document.createElement('div');bg.className='hx-bg';document.body.appendChild(bg);

function close(){
  if(!openP)return;
  openP.pan.hidden=true;openP.btn.classList.remove('open');openP.btn.setAttribute('aria-expanded','false');bg.classList.remove('show');openP=null;
}
function open(btn,pan){
  close();pan.hidden=false;btn.classList.add('open');btn.setAttribute('aria-expanded','true');
  if(mobile())bg.classList.add('show');
  else{
    const r=btn.getBoundingClientRect(),w=pan.offsetWidth,h=pan.offsetHeight;
    pan.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
    let top=r.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);
    pan.style.top=top+'px';
  }
  openP={btn,pan};
}
/* els: elemen (atau id) yang dipindahkan ke menu; onItem(e): dipanggil saat tombol di menu diketuk (untuk tombol yang memakai delegasi) */
function group(label,els,onItem){
  els=els.map(e=>typeof e==='string'?$(e):e).filter(Boolean);
  if(!els.length||els[0].closest('.hx-pan'))return null;
  const btn=document.createElement('button');btn.type='button';btn.className='btn hx-btn';btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');
  btn.innerHTML=label+' <small>▾</small>';
  els[0].before(btn);
  const pan=document.createElement('div');pan.className='hx-pan';pan.hidden=true;
  els.forEach(e=>pan.appendChild(e));document.body.appendChild(pan);
  btn.onclick=e=>{e.stopPropagation();openP&&openP.pan===pan?close():open(btn,pan)};
  pan.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(onItem)onItem(b);
    setTimeout(close,0);
  });
  pan.addEventListener('change',()=>setTimeout(close,0));
  return btn;
}
document.addEventListener('click',e=>{if(openP&&!openP.pan.contains(e.target)&&!openP.btn.contains(e.target))close()});
bg.addEventListener('click',close);
addEventListener('keydown',e=>{if(e.key==='Escape')close()});
addEventListener('resize',close);
addEventListener('scroll',e=>{if(openP&&!openP.pan.contains(e.target)&&!mobile())close()},true);

/* ===== Editor 2D ===== */
group('Tambah',['tl-text','tl-addshape','tl-pen','tl-sticker','tl-group','tl-addtrack']);
group('Edit',['tl-dup','tl-copy','tl-paste','tl-multi','tl-ext','tl-del']);
group('Lainnya',['btn-mode','btn-help','btn-png','btn-export-json']);

/* ===== Edit 3D ===== */
group('Tambah',['s3-add-text','s3-add-media','s3-add-html','s3-add-model','s3-add-bg','s3-add-cam','s3-add-group','s3-music']);
group('Layer',['s3-dup','s3-up','s3-del']);

/* ===== Timeline Edit 3D (tombol memakai delegasi pada bilahnya) ===== */
const host=$('s3x-tl'),bar=host&&host.querySelector('.s3x-bar');
if(bar){
  const q=c=>bar.querySelector('[data-c="'+c+'"]');
  group('Edit',[q('dup'),q('copy'),q('paste'),q('del')].filter(Boolean),b=>{const c=b.closest('[data-c]');if(c&&bar.onclick)bar.onclick({target:c})});
}
})();
