/* GERAKAN KAMERA PRO 2 untuk Edit 3D (add-on, dimuat lewat js/waveform.js). Menambah tombol ke panel "🎬 Gerakan Pro" (js/s3camfx.js):
   Zoom beat (denyut zoom sesuai BPM), Putar 360°, Tilt reveal, Bounce masuk, Geser parallax, Pull-back dramatis. Semua berupa keyframe. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r2=v=>Math.round(v*100)/100;
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=r2(v);k.e=e||k.e}else{a.push({t:Math.round(t*1000)/1000,v:r2(v),e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
function ani(it,p,t0,t1,v1,e){
  const v0=A().val(it,p,t0),a=it.keys[p]||(it.keys[p]=[]);
  for(let i=a.length-1;i>=0;i--)if(a[i].t>t0+.02&&a[i].t<t1-.02)a.splice(i,1);
  K(it,p,t0,v0,e);K(it,p,t1,v1,e);
}
const NAMES={beat:'Zoom beat',spin:'Putar 360°',reveal:'Tilt reveal',bounce:'Bounce masuk',slide:'Geser parallax',pull:'Pull-back'};
function run(kind){
  const s=scn(),it=byId(selId());if(!s||!it||it.kind!=='camera')return;
  const t0=curT(),g=p=>A().val(it,p,t0),dd=parseFloat(($('s3x-pdur')||{}).value)||3,te=t=>Math.min(t,s.dur);
  if(s.dur-t0<.4){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal atau perpanjang durasi.');return}
  if(kind==='beat'){
    const bpm=clamp(parseFloat(($('s3x-bpm')||{}).value)||120,40,240),st=60/bpm,f0=g('fov');
    const n=Math.min(200,Math.floor((te(t0+dd)-t0)/st));if(n<1){toast('Durasi terlalu pendek untuk BPM ini');return}
    for(let i=0;i<n;i++){const b=t0+i*st;K(it,'fov',b,f0,'out');K(it,'fov',b+st*.12,clamp(f0*.9,20,120),'out');K(it,'fov',b+st*.85,f0,'inout')}
  }else if(kind==='spin')ani(it,'rz',t0,te(t0+1.2),g('rz')+360,'inout');
  else if(kind==='reveal')ani(it,'rx',t0,te(t0+1.5),g('rx'),'out'),K(it,'rx',t0,g('rx')+25,'out');
  else if(kind==='bounce'){const f0=g('fov');K(it,'fov',t0,clamp(f0*1.35,20,120),'back');K(it,'fov',te(t0+.6),f0,'back')}
  else if(kind==='slide')ani(it,'x',t0,te(t0+dd),g('x')+300,'inout');
  else if(kind==='pull')ani(it,'fov',t0,te(t0+dd),clamp(g('fov')*1.5,20,120),'inout');
  touch();toast(NAMES[kind]+' dipasang di '+t0.toFixed(2)+' dtk. Tekan ↶ untuk membatalkan.');
}
function inject(){
  const box=document.getElementById('s3x-pro');if(!box||box.querySelector('[data-sxq]'))return;
  const row=box.querySelector('.s3x-row');if(!row)return;
  Object.keys(NAMES).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='btn';b.dataset.sxq=k;b.textContent=NAMES[k];row.appendChild(b)});
  const l=document.createElement('label');l.className='s3-fl';l.innerHTML='BPM untuk Zoom beat<input type="number" id="s3x-bpm" min="40" max="240" value="'+(window.__s3bpm||120)+'">';
  l.querySelector('input').onchange=e=>{window.__s3bpm=e.target.value};
  box.appendChild(l);
}
function boot(){
  if(!$('s3d'))return;
  const P=$('s3-props');if(P)new MutationObserver(inject).observe(P,{childList:true});
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sxq]');if(b&&$('s3d').contains(b))run(b.dataset.sxq)});
  inject();
}
try{boot()}catch(e){console.error('Gerakan kamera pro 2 gagal dimuat',e)}
})();
