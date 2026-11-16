/* ANIMASI MODEL + BENTUK 3D untuk Edit 3D (add-on, dimuat lewat js/waveform.js). Tidak mengubah alur lama: hanya menambah data pada layer model.
   1) KLIP ANIMASI BAWAAN model (.glb / .gltf / .fbx yang punya rangka, misal berjalan, lambai, menari): pilih klip, kecepatan, mode ulang
      (ulang terus / sekali / bolak-balik), dan mulai dari detik ke-n di dalam klip. Waktu klip mengikuti waktu scene, jadi scrub, preview,
      dan export frame per frame selalu sama. Posisi, putaran, dan ukuran model tetap bisa di-keyframe seperti biasa (jalan sambil bergerak).
   2) BENTUK 3D DASAR tanpa berkas: kubus, bola, silinder, kerucut, donat, piramida, kapsul, lengkap dengan pilihan warna. Cocok dipakai
      sebagai objek animasi (keyframe posisi, putar 3D, ukuran) atau sebagai pengganti sementara karakter.
   3) TOKOH (karakter kartun berkepala besar, ala film animasi) dengan gerakan siap pakai: diam bernapas, jalan, lari, lambai, lompat, menari.
      Warna baju, kulit, dan rambut bisa diganti. Pindahkan dan putar tokoh dengan keyframe seperti layer lain, ganti klip di waktu berbeda
      dengan menduplikat dan memotong layer di timeline.
   4) CAHAYA FILM per model: preset (tiga titik ala film, hangat sore, dingin malam, dramatis), lampu pinggir dari belakang, tone mapping
      filmik, dan bayangan lembut di lantai tepat di bawah model.
   Data tersimpan di layer: it.mc = {clip, speed, mode, off} dan, untuk bentuk dasar, it.fmt='prim', it.prim, it.color. Semua perubahan ikut undo (↶)
   dan simpan otomatis lewat pemicu input pada nama project, sama seperti add-on lain. */
(function(){
'use strict';
window.APK=window.APK||{};
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const isModel=it=>!!it&&it.kind==='model';
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
const PRIM={char:'Tokoh (karakter)',cube:'Kubus',sphere:'Bola',cylinder:'Silinder',cone:'Kerucut',torus:'Donat',pyramid:'Piramida',capsule:'Kapsul'};
const MODE={loop:'Ulang terus',once:'Sekali lalu diam di akhir',ping:'Bolak-balik'};
let tries=0,timer=0;

/* ===== tombol "+ Bentuk 3D" di bilah alat ===== */
async function addPrim(kind){
  const a=A(),s=scn();if(!a||!s||!PRIM[kind])return;
  try{await a.useModel()}catch(e){toast('Bentuk 3D butuh pustaka Three.js (internet sekali per sesi). '+((e&&e.message)||''));return}
  const o={start:curT(),fmt:'prim',prim:kind,color:'#4da3ff',name:PRIM[kind]};
  if(kind==='char')Object.assign(o,{name:'Tokoh',color:'#ff7a59',skin:'#f4c7a1',hair:'#4a2f20',mc:{clip:0,speed:1,mode:'loop',off:0},lk:{p:'film',sh:true}});
  const it=a.mk('model',o);
  a.add(it);touch();
  toast(PRIM[kind]+' ditambahkan. '+(kind==='char'?'Pilih klip gerakannya di kartu Animasi Model.':'Gerakkan dengan keyframe ◆, atau seret di preview.'));
}
function mountTool(){
  const bar=document.querySelector('#s3d .s3-tools');
  if(!bar||$('s3-add-prim'))return;
  const sel=document.createElement('select');sel.id='s3-add-prim';sel.setAttribute('aria-label','Tambah bentuk 3D');
  sel.title='Tambah bentuk 3D dasar (tanpa berkas) untuk dianimasikan';
  sel.innerHTML='<option value="">+ Bentuk 3D</option>'+Object.keys(PRIM).map(k=>'<option value="'+k+'">'+PRIM[k]+'</option>').join('');
  sel.addEventListener('change',()=>{const v=sel.value;sel.value='';if(v)addPrim(v)});
  const bg=$('s3-add-bg');
  if(bg&&bg.parentNode===bar)bg.insertAdjacentElement('afterend',sel);else bar.appendChild(sel);
}

/* ===== panel properti untuk layer model ===== */
function lookUi(it){
  const M=APK.s3model,L=(M&&M.looks)||{},lk=it.lk||{};
  return '<b>🎬 Cahaya film</b><label class="s3-fl">Pencahayaan<select data-mc="lkp"><option value="">Biasa (bawaan)</option>'
    +Object.keys(L).map(k=>'<option value="'+k+'"'+(lk.p===k?' selected':'')+'>'+esc(L[k].n)+'</option>').join('')+'</select></label>'
    +'<label class="s3-ck"><input type="checkbox" data-mc="lksh"'+(lk.sh?' checked':'')+'> Bayangan lembut di lantai</label>'
    +'<p class="s3-hint">Lantai berada tepat di bawah model dan ikut berputar bersamanya. Pilih "Biasa" dan matikan bayangan untuk kembali ke tampilan awal.</p>';
}
function build(it){
  const M=APK.s3model,st=M?M.state(it):{};
  let h='<b>🕺 Animasi Model</b>';
  if(it.fmt==='prim'&&it.prim==='char'){
    h+='<div class="s3-two"><label class="s3-fl">Baju<input type="color" data-mc="color" value="'+esc(it.color||'#ff7a59')+'"></label>'
      +'<label class="s3-fl">Kulit<input type="color" data-mc="skin" value="'+esc(it.skin||'#f4c7a1')+'"></label></div>'
      +'<label class="s3-fl">Rambut<input type="color" data-mc="hair" value="'+esc(it.hair||'#4a2f20')+'"></label>';
  }else if(it.fmt==='prim'){
    h+='<div class="s3-two"><label class="s3-fl">Bentuk<select data-mc="prim">'+Object.keys(PRIM).map(k=>'<option value="'+k+'"'+(it.prim===k?' selected':'')+'>'+PRIM[k]+'</option>').join('')+'</select></label>'
      +'<label class="s3-fl">Warna<input type="color" data-mc="color" value="'+esc(it.color||'#4da3ff')+'"></label></div>'
      +'<p class="s3-hint">Bentuk dasar tidak punya klip bawaan. Putar dengan Putar 3D X / Y / Z lalu pasang keyframe ◆ untuk membuatnya bergerak.</p>';
    return h+lookUi(it);
  }
  if(!st.ready){
    return h+'<p class="s3-hint">'+(st.error?'Model belum bisa dibaca: '+esc(st.error):'Memuat model…')+'</p>';
  }
  const cl=M.clips(it);
  if(!cl.length){
    return h+lookUi(it)+'<p class="s3-hint">Model ini tidak punya animasi bawaan. Gerakkan dengan keyframe (Putar 3D, posisi, ukuran). Untuk karakter yang berjalan atau menari, pakai berkas .glb atau .fbx yang sudah berisi animasi (misal dari Mixamo).</p>';
  }
  const mc=it.mc||{clip:-1,speed:1,mode:'loop',off:0};
  h+='<label class="s3-fl">Klip animasi<select data-mc="clip"><option value="-1"'+(mc.clip<0?' selected':'')+'>Diam (pose awal)</option>'
    +cl.map(c=>'<option value="'+c.i+'"'+(mc.clip===c.i?' selected':'')+'>'+esc(c.name)+' ('+c.dur.toFixed(1)+' dtk)</option>').join('')+'</select></label>';
  h+='<div class="s3-two"><label class="s3-fl">Kecepatan<input type="number" data-mc="speed" min="0" max="8" step="0.1" value="'+(mc.speed==null?1:mc.speed)+'"></label>'
    +'<label class="s3-fl">Mulai dari (dtk dalam klip)<input type="number" data-mc="off" min="0" max="600" step="0.1" value="'+(mc.off||0)+'"></label></div>';
  h+='<label class="s3-fl">Pengulangan<select data-mc="mode">'+Object.keys(MODE).map(k=>'<option value="'+k+'"'+((mc.mode||'loop')===k?' selected':'')+'>'+MODE[k]+'</option>').join('')+'</select></label>';
  h+='<p class="s3-hint">Klip diputar mulai dari waktu "Muncul di detik" layer ini. Kecepatan 0 membekukan pose pada detik yang dipilih. Ada '+cl.length+' klip di model ini.</p>';
  return h+lookUi(it);
}
const isReady=it=>!!(APK.s3model&&APK.s3model.state(it).ready)||(it.fmt==='prim'&&it.prim!=='char');
function inject(){
  const P=$('s3-props'),it=byId(selId());
  if(!P||!isModel(it)){clearTimeout(timer);tries=0;return}
  const old=P.querySelector('#s3x-mc'),rdy=String(isReady(it));
  if(old&&old.dataset.id===it.id&&old.dataset.ready===rdy)return;
  if(old)old.remove();
  const d=document.createElement('div');d.id='s3x-mc';d.className='s3c';d.dataset.id=it.id;
  d.dataset.ready=rdy;
  d.innerHTML=build(it);
  const h=P.querySelector('.s3-hint');
  if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
  /* model masih dimuat: cek lagi sebentar sampai siap supaya daftar klip muncul sendiri */
  clearTimeout(timer);
  if(d.dataset.ready==='false'&&tries<40){tries++;timer=setTimeout(()=>{const x=byId(selId());if(isModel(x))inject()},700)}else tries=0;
}
function onChange(e){
  const el=e.target&&e.target.closest&&e.target.closest('[data-mc]');if(!el)return;
  const it=byId(selId());if(!isModel(it))return;
  const f=el.dataset.mc;
  if(f==='color'||f==='skin'||f==='hair'){it[f]=el.value;try{A().render()}catch(_){}if(e.type==='change')touch();return}
  if(e.type==='input')return;
  if(f==='lkp'||f==='lksh'){
    const lk=it.lk=Object.assign({p:'',sh:false},it.lk||{});
    if(f==='lkp')lk.p=el.value;else lk.sh=!!el.checked;
    if(!lk.p&&!lk.sh)delete it.lk;
    touch();return;
  }
  if(f==='prim'){
    it.prim=el.value;it.name=PRIM[it.prim]||it.name;
    if(it.prim==='char'){it.skin=it.skin||'#f4c7a1';it.hair=it.hair||'#4a2f20';it.mc=it.mc||{clip:0,speed:1,mode:'loop',off:0}}
    try{if(APK.s3model)APK.s3model.drop(it.id)}catch(_){}
    touch();return;
  }
  const mc=it.mc=Object.assign({clip:-1,speed:1,mode:'loop',off:0},it.mc||{});
  if(f==='clip')mc.clip=parseInt(el.value,10);
  else if(f==='speed')mc.speed=clamp(parseFloat(el.value),0,8)||0;
  else if(f==='off')mc.off=clamp(parseFloat(el.value)||0,0,600);
  else if(f==='mode')mc.mode=el.value;
  touch();
}
function boot(){
  if(!$('s3d'))return;
  mountTool();
  const P=$('s3-props');
  if(P){
    new MutationObserver(inject).observe(P,{childList:true});
    P.addEventListener('change',onChange);P.addEventListener('input',onChange);
  }
  inject();
}
try{boot()}catch(e){console.error('Animasi model gagal dimuat',e)}
})();
