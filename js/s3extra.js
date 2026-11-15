/* Tambahan Edit 3D (dimuat dari js/home-ref.js). Tidak mengubah scene3d.js: hanya memakai data layer + render/undo bawaan.
   1) Animasi MASUK dan KELUAR siap pakai di awal / akhir layer (fade, pop, geser 4 arah, terbang dari jauh, putar 3D).
   2) Rapikan: Tengahkan posisi, Reset putar, Ukuran 100%.
   3) Geser layer terpilih dengan tombol panah di keyboard (Shift = 10x lebih jauh).
   4) Panduan tata letak di preview: garis sepertiga, titik tengah, dan area aman (tombol ▦ di bawah preview). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const OK=k=>k==='text'||k==='image'||k==='video'||k==='model';
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=v;if(e)k.e=e}else{a.push({t:Math.round(t*1000)/1000,v,e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
function setNow(it,p,v){if(!(p in it.props))return;if(it.keys[p]&&it.keys[p].length)K(it,p,curT(),v,'inout');else it.props[p]=v}

/* [prop, nilaiAwal(base), ease]: awal = nilai di luar layar / transparan, lalu menuju nilai asli */
const ANI={
  fade:['Pudar (fade)',b=>[['opacity',0,'linear']]],
  pop:['Muncul membesar (pop)',b=>[['scale',b.scale*.25,'back'],['opacity',0,'linear']]],
  kiri:['Geser dari kiri',b=>[['x',b.x-520,'out'],['opacity',0,'linear']]],
  kanan:['Geser dari kanan',b=>[['x',b.x+520,'out'],['opacity',0,'linear']]],
  atas:['Geser dari atas',b=>[['y',b.y-420,'out'],['opacity',0,'linear']]],
  bawah:['Geser dari bawah',b=>[['y',b.y+420,'out'],['opacity',0,'linear']]],
  jauh:['Terbang dari jauh (3D)',b=>[['z',b.z+1600,'out'],['opacity',0,'linear']]],
  putar:['Putar 3D',b=>[['ry',b.ry+90,'out'],['opacity',0,'linear']]]
};
function base(it,t){const g=p=>(p in it.props)?A().val(it,p,t):0;return{x:g('x'),y:g('y'),z:g('z'),ry:g('ry'),scale:g('scale')||1,opacity:g('opacity')}}
function applyAni(kind,mode){
  const S=scn(),it=byId(selId());
  if(!S||!it||!OK(it.kind)||it.pano)return;
  const st=it.start||0,en=it.dur==null?S.dur:st+it.dur,d=Math.min(.6,Math.max(.1,(en-st)/2));
  const def=ANI[kind];if(!def)return;
  if(mode==='in'){
    const b=base(it,st+d);
    def[1](b).forEach(([p,v,e])=>{if(!(p in it.props))return;const to=b[p===('scale')?'scale':p];K(it,p,st,v,e);K(it,p,st+d,to,'inout')});
    toast('Animasi masuk dipasang di awal layer');
  }else{
    const b=base(it,en-d);
    /* keluar = kebalikan: dari nilai asli menuju nilai awal animasi masuk */
    def[1](b).forEach(([p,v])=>{if(!(p in it.props))return;const to=p==='x'?b.x*2-v:p==='y'?b.y*2-v:p==='z'?v:p==='ry'?b.ry*2-v:v;
      K(it,p,en-d,b[p],'in');K(it,p,en,to,'in')});
    toast('Animasi keluar dipasang di akhir layer');
  }
  touch();
}
function card(){
  const P=$('s3-props');if(!P||P.querySelector('#s3x-anim'))return;
  const it=byId(selId());if(!it||!OK(it.kind)||it.pano)return;
  const opts='<option value="">Pilih…</option>'+Object.keys(ANI).map(k=>'<option value="'+k+'">'+ANI[k][0]+'</option>').join('');
  const d=document.createElement('div');d.id='s3x-anim';
  d.innerHTML='<b>✨ Animasi &amp; rapikan</b>'
   +'<label class="s3-fl">Animasi masuk (di awal layer)<select data-xin>'+opts+'</select></label>'
   +'<label class="s3-fl">Animasi keluar (di akhir layer)<select data-xout>'+opts+'</select></label>'
   +'<div class="s3x-qrow"><button type="button" class="btn" data-xa="center">⊕ Tengahkan</button><button type="button" class="btn" data-xa="rot">Reset putar</button><button type="button" class="btn" data-xa="size">Ukuran 100%</button></div>';
  const h=P.querySelector('.s3-hint');
  if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
document.addEventListener('change',e=>{
  const el=e.target;if(!el.closest||!el.closest('#s3x-anim'))return;
  if(el.dataset.xin!==undefined&&el.value){applyAni(el.value,'in');el.value=''}
  else if(el.dataset.xout!==undefined&&el.value){applyAni(el.value,'out');el.value=''}
});
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('#s3x-anim [data-xa]');if(!b)return;
  const it=byId(selId());if(!it)return;
  const a=b.dataset.xa;
  if(a==='center'){setNow(it,'x',0);setNow(it,'y',0)}
  else if(a==='rot'){setNow(it,'rx',0);setNow(it,'ry',0);setNow(it,'rz',0)}
  else if(a==='size')setNow(it,'scale',1);
  touch();
});

/* geser dengan panah keyboard */
addEventListener('keydown',e=>{
  const v=$('s3d');if(!v||v.hidden||!scn()||document.querySelector('dialog[open]'))return;
  if(!/^Arrow(Left|Right|Up|Down)$/.test(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;
  const ae=document.activeElement,tg=ae?ae.tagName:'';if(/INPUT|TEXTAREA|SELECT/.test(tg))return;
  const it=byId(selId());if(!it||!OK(it.kind)||it.lock||it.pano)return;
  e.preventDefault();
  const s=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,dy=e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0;
  if(dx)setNow(it,'x',A().val(it,'x',curT())+dx);
  if(dy)setNow(it,'y',A().val(it,'y',curT())+dy);
  try{A().render()}catch(_){}
  const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));
});

/* panduan tata letak */
let gmode=0,gel=null,graf=0;
function guide(){
  if(!gmode){if(gel){gel.remove();gel=null}return}
  graf=requestAnimationFrame(guide);
  const cv=$('s3-cv'),v=$('s3d');if(!cv||!v||v.hidden){if(gel)gel.style.display='none';return}
  const r=cv.getBoundingClientRect(),ok=r.width>20&&r.top>=0&&r.bottom<=innerHeight+1;
  if(!gel){
    gel=document.createElement('div');gel.id='s3x-guide';
    gel.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%"><g stroke="#fff" stroke-opacity=".55" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"><path vector-effect="non-scaling-stroke" d="M33.33 0V100M66.66 0V100M0 33.33H100M0 66.66H100"/><path vector-effect="non-scaling-stroke" stroke-opacity=".9" d="M48 50H52M50 48V52"/><rect class="sf" vector-effect="non-scaling-stroke" x="5" y="5" width="90" height="90" stroke-dasharray="5 4" stroke="#ffd166"/></g></svg>';
    document.body.appendChild(gel);
  }
  gel.style.cssText='position:fixed;pointer-events:none;z-index:31;display:'+(ok?'block':'none')+';left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px';
  const sf=gel.querySelector('.sf');if(sf)sf.style.display=gmode===2?'block':'none';
}
function boot(){
  const P=$('s3-props');if(!P||$('s3x-gbtn'))return;
  const st=document.createElement('style');
  st.textContent='#s3x-anim{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--panel)}#s3x-anim>b{display:block;margin-bottom:8px}'
   +'#s3x-anim .s3x-qrow{display:flex;flex-wrap:wrap;gap:6px}#s3x-anim .btn{padding:6px 10px;font-size:13px}#s3x-gbtn.on{border-color:var(--accent)}';
  document.head.appendChild(st);
  new MutationObserver(card).observe(P,{childList:true});card();
  const ctl=document.querySelector('#s3d .s3-ctl');
  if(ctl){
    const b=document.createElement('button');b.type='button';b.className='btn';b.id='s3x-gbtn';b.textContent='▦';b.title='Panduan tata letak: garis sepertiga dan area aman';
    b.onclick=()=>{gmode=(gmode+1)%3;b.classList.toggle('on',gmode>0);b.textContent=gmode===0?'▦':gmode===1?'▦ 3×3':'▦ Aman';cancelAnimationFrame(graf);guide();toast(gmode===0?'Panduan dimatikan':gmode===1?'Panduan: garis sepertiga':'Panduan: sepertiga + area aman')};
    ctl.appendChild(b);
  }
}
try{boot()}catch(e){console.error('Tambahan Edit 3D gagal dimuat',e)}
})();
