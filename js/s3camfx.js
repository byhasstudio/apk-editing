/* GERAKAN KAMERA PRO untuk Edit 3D (add-on, dimuat lewat js/waveform.js setelah semua script lain).
   Panel "🎬 Gerakan Pro" muncul di properti kamera: crash zoom, whip pan (dengan getar + pisah warna), dutch angle, Ken Burns,
   impact punch (zoom + kilat), drift melayang, dan ubah kecepatan gerak kamera (percepat / perlambat). Semua dipasang sebagai
   keyframe di waktu sekarang, jadi preview, export, dan undo (↶) bekerja seperti biasa. */
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
let DUR=3;
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=r2(v);k.e=e||k.e}else{a.push({t:Math.round(t*1000)/1000,v:r2(v),e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
/* animasi dari nilai sekarang (t0) ke v1 (t1); keyframe lama di antaranya diganti */
function ani(it,p,t0,t1,v1,e){
  const v0=A().val(it,p,t0),a=it.keys[p]||(it.keys[p]=[]);
  for(let i=a.length-1;i>=0;i--)if(a[i].t>t0+.02&&a[i].t<t1-.02)a.splice(i,1);
  K(it,p,t0,v0,e);K(it,p,t1,v1,e);
}
const fxItem=()=>{const s=scn();return s&&s.items[1]};
/* lonjakan efek layar (ca / shake / flash): 0 -> puncak -> 0 */
function spike(p,t0,tp,t1,peak){const f=fxItem();if(!f)return;K(f,p,t0,0,'linear');K(f,p,tp,peak,'linear');K(f,p,t1,0,'out')}

function run(kind){
  const s=scn(),it=byId(selId());if(!s||!it||it.kind!=='camera')return;
  const t0=curT(),d=kind==='crash'||kind==='whipl'||kind==='whipr'||kind==='punch'?0:DUR,g=p=>A().val(it,p,t0);
  const tEnd=t=>Math.min(t,s.dur);
  if(s.dur-t0<.4){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal atau perpanjang durasi.');return}
  if(kind==='crash'){
    const t1=tEnd(t0+.35);ani(it,'fov',t0,t1,clamp(g('fov')*.45,20,120),'out');spike('ca',t0,t0+.12,t1+.2,10);spike('shake',t0,t0+.1,t1+.2,.35);
  }else if(kind==='whipl'||kind==='whipr'){
    const dir=kind==='whipr'?1:-1,t1=tEnd(t0+.3);ani(it,'ry',t0,t1,g('ry')+dir*70,'in');
    spike('ca',t0,t0+.18,t1+.15,18);spike('shake',t0,t0+.15,t1+.15,.55);
  }else if(kind==='punch'){
    const f0=g('fov');K(it,'fov',t0,f0,'out');K(it,'fov',tEnd(t0+.08),clamp(f0*.85,20,120),'out');K(it,'fov',tEnd(t0+.4),f0,'inout');
    spike('flash',t0,t0+.04,t0+.3,.4);spike('shake',t0,t0+.06,t0+.5,.5);
  }else if(kind==='dutch'){
    ani(it,'rz',t0,tEnd(t0+1.5),g('rz')+8,'inout');
  }else if(kind==='kenburns'){
    const t1=tEnd(t0+d);ani(it,'fov',t0,t1,clamp(g('fov')*.85,20,120));ani(it,'x',t0,t1,g('x')+80);ani(it,'y',t0,t1,g('y')-30);
  }else if(kind==='drift'){
    const n=Math.max(2,Math.round((tEnd(t0+d)-t0)/.5)),b={x:g('x'),y:g('y'),rz:g('rz')};
    for(let i=0;i<=n;i++){const ts=t0+(tEnd(t0+d)-t0)*i/n;K(it,'x',ts,b.x+25*Math.sin(i*1.3),'inout');K(it,'y',ts,b.y+15*Math.sin(i*.9+1),'inout');K(it,'rz',ts,b.rz+1.2*Math.sin(i*1.1+2),'inout')}
  }else if(kind==='fast'||kind==='slow'){
    const f=kind==='fast'?.5:2;let n=0;
    Object.keys(it.keys).forEach(p=>{
      const a=it.keys[p];a.forEach(k=>{if(k.t>t0+.02){k.t=Math.round((t0+(k.t-t0)*f)*1000)/1000;n++}});
      it.keys[p]=a.filter(k=>k.t<=s.dur+1e-6);if(!it.keys[p].length)delete it.keys[p];
    });
    if(!n){toast('Tidak ada keyframe kamera setelah waktu sekarang');return}
    touch();toast(kind==='fast'?'Gerak kamera dipercepat 2x dari waktu sekarang':'Gerak kamera diperlambat 2x dari waktu sekarang (yang lewat durasi dipotong)');return;
  }
  touch();toast('Gerakan dipasang di '+t0.toFixed(2)+' dtk. Tekan ↶ untuk membatalkan.');
}

/* Tata letak baris tombol: dibungkus ke baris berikutnya (tidak meluap), teks tombol tidak terpotong, panah ikut di dalam tombol */
const CSS='.s3x-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}'
  +'.s3x-row .btn{flex:0 0 auto;white-space:nowrap;padding:6px 10px;font-size:13px;line-height:1.2}';

function inject(){
  const P=$('s3-props'),it=byId(selId());
  if(!P||!it||it.kind!=='camera'||P.querySelector('#s3x-pro'))return;
  const d=document.createElement('div');d.id='s3x-pro';d.className='s3c';
  d.innerHTML='<b>🎬 Gerakan Pro</b><div class="s3x-row">'
    +[['crash','Crash zoom'],['whipl','◀ Whip pan kiri'],['whipr','Whip pan kanan ▶'],['punch','Impact punch'],['dutch','Dutch angle'],['kenburns','Ken Burns'],['drift','Drift melayang'],['fast','Percepat 2x'],['slow','Perlambat 2x']]
      .map(([k,t])=>'<button class="btn" type="button" data-sxp="'+k+'">'+t+'</button>').join('')
    +'</div><label class="s3-fl">Durasi Ken Burns / Drift (dtk)<input type="number" id="s3x-pdur" step="0.5" min="0.5" max="60" value="'+DUR+'"></label>'
    +'<p class="s3-hint">Dipasang di waktu sekarang. Whip pan dan Crash zoom ikut menambah getar dan pisah warna. Percepat / Perlambat mengubah semua keyframe kamera setelah waktu sekarang.</p>';
  const h=P.querySelector('.s3-hint');
  if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
function boot(){
  if(!$('s3d'))return;
  if(!document.getElementById('s3x-style')){const st=document.createElement('style');st.id='s3x-style';st.textContent=CSS;document.head.appendChild(st)}
  const P=$('s3-props');if(P)new MutationObserver(inject).observe(P,{childList:true});
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-sxp]');if(b&&$('s3d').contains(b))run(b.dataset.sxp)});
  document.addEventListener('change',e=>{if(e.target&&e.target.id==='s3x-pdur')DUR=clamp(parseFloat(e.target.value)||3,.5,60)});
  inject();
}
try{boot()}catch(e){console.error('Gerakan kamera pro gagal dimuat',e)}
})();
