/* KURVA OTOMATIS untuk Edit 3D (add-on, dimuat setelah js/s3cam.js dan js/s3gizmo.js; isi file lain tidak diubah).
   Tombol "⏺ Kurva otomatis" di samping "🎥 Kamera" / "▦ Ruang 3D". Saat AKTIF, setiap kali kamera digeser atau diputar
   (seret di tampilan Kamera, seret titik kamera / gizmo di Ruang 3D, atau geser slider / ketik angka di properti kamera),
   properti yang berubah otomatis dibuatkan keyframe:
   - properti yang BELUM punya keyframe: dibuat 2 keyframe, nilai awal di detik 0 dan nilai baru di posisi playhead,
     jadi kamera bergerak dari posisi semula ke posisi baru. (Kalau playhead di detik 0, cukup 1 keyframe.)
   - properti yang SUDAH punya keyframe: sudah ditangani bawaan (keyframe di playhead ditimpa / ditambah), tidak diubah.
   Kurva gerak keyframe baru mengikuti pilihan "Kurva untuk keyframe baru" di properti.
   Cara kerja: perubahan nilai kamera yang tanpa keyframe dideteksi dengan membandingkan nilai sebelum dan sesudah, hanya untuk
   perubahan yang berasal dari seretan atau input pengguna. Undo, hapus keyframe, dan fitur lain tidak dipicu. Ikut undo/redo,
   simpan otomatis, preview, dan export karena hasilnya keyframe biasa. Otomatis mati saat project berganti. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
/* semua properti gerak kamera; "follow" (kecepatan ikut) adalah pengaturan, bukan gerak, jadi tidak ikut */
const CP=['x','y','z','rx','ry','rz','fov','focus','fd','dist','az','el','frx','fry'];
let on=false,snap=null,armed=false,armT=0,btn=null;
const cams=s=>s.items.filter(i=>i.kind==='camera');

function takeSnap(){
  const s=scn();if(!s){snap=null;return}
  snap={id:s.id,c:{}};
  cams(s).forEach(c=>{const o={ref:c};CP.forEach(p=>{o[p]=c.props[p]});snap.c[c.id]=o});
}
function ease(){const e=document.querySelector('#s3-props [data-ease]');return e?e.value:'inout'}
function setK(it,p,tt,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-tt)<.02);
  if(k){k.v=v;if(e)k.e=e}else{a.push({t:Math.round(tt*1000)/1000,v:v,e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
/* tanda ◆ di bawah slider waktu (sama seperti ticks() di scene3d.js) */
function refreshTicks(){
  const s=scn(),it=byId(selId()),box=$('s3-ticks');if(!s||!it||!box)return;
  const set=new Set();Object.values(it.keys).forEach(a=>a.forEach(k=>set.add(Math.round(k.t*100)/100)));
  box.innerHTML=[...set].map(x=>'<button type="button" style="left:'+(x/s.dur*100)+'%" data-tt="'+x+'" aria-label="Keyframe '+x+' detik"></button>').join('');
}

function check(){
  if(!on)return;
  const s=scn();
  if(!s||!snap||snap.id!==s.id){setOn(false);return}
  let n=0,t=0;
  if(armed){
    t=curT();const e=ease();
    cams(s).forEach(c=>{
      const o=snap.c[c.id];
      if(!o||o.ref!==c)return;   /* objek diganti (undo / redo / project lain): bukan gerakan pengguna */
      CP.forEach(p=>{
        const a=c.keys[p];if(a&&a.length)return;
        const ov=o[p],nv=c.props[p];
        if(typeof nv!=='number'||typeof ov!=='number'||nv===ov)return;
        if(t>.02)setK(c,p,0,ov,e);   /* posisi semula di detik 0 */
        setK(c,p,t,nv,e);n++;
      });
    });
  }
  takeSnap();
  if(n){try{A().render()}catch(_){}refreshTicks();toast('Kurva otomatis: keyframe dipasang di '+t.toFixed(2)+' dtk')}
}

function setOn(v,quiet){
  on=!!v;
  if(btn){btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',on?'true':'false')}
  if(on){
    takeSnap();
    if(!quiet)toast('Kurva otomatis AKTIF: geser kamera di detik mana pun, keyframe terpasang sendiri (posisi awal di 0 dtk dan posisi baru di playhead)');
  }else{snap=null;armed=false;if(!quiet)toast('Kurva otomatis mati')}
}

/* hanya seretan dan input pengguna yang dihitung sebagai gerakan; fase capture supaya mendahului penangan lain */
function arm(){armed=true;clearTimeout(armT);armT=setTimeout(function(){armed=false},0)}
document.addEventListener('pointermove',function(e){if(on&&e.buttons)arm()},true);
document.addEventListener('input',function(e){
  if(!on)return;
  const t=e.target;
  if(t&&t.dataset&&t.dataset.p&&t.closest&&t.closest('#s3-props'))arm();
},true);

function init(){
  const w=document.querySelector('#s3d .s3v');
  if(!w||!$('s3-save'))return false;
  if($('s3-vauto'))return true;
  btn=document.createElement('button');btn.type='button';btn.className='btn';btn.id='s3-vauto';btn.textContent='⏺ Kurva otomatis';
  btn.title='Saat aktif, setiap kamera digeser atau diputar, keyframe otomatis dipasang di posisi playhead (posisi semula disimpan di detik 0)';
  btn.setAttribute('aria-pressed','false');
  w.insertBefore(btn,$('s3-vfit')||null);
  btn.onclick=function(){
    if(!scn()){toast('Buka project 3D dulu');return}
    setOn(!on);
  };
  const st=document.createElement('style');
  st.textContent='#s3-vauto.on{background:#c62828;border-color:#ff6b6b;color:#fff}';
  document.head.appendChild(st);
  /* setiap perubahan scene memanggil dirty() yang menulis di #s3-save: itu pemicu pengecekan */
  new MutationObserver(check).observe($('s3-save'),{childList:true,characterData:true,subtree:true});
  /* mati sendiri kalau keluar dari project atau berganti project */
  setInterval(function(){
    if(!on)return;
    const r=$('s3d'),s=scn();
    if(!r||r.hidden||!s||!snap||snap.id!==s.id)setOn(false,true);
  },400);
  return true;
}
try{if(!init())setTimeout(init,500)}catch(e){console.error('Kurva otomatis Edit 3D gagal dimuat',e)}
window.APK=window.APK||{};
APK.s3autokey={get on(){return on},set:setOn};
})();
