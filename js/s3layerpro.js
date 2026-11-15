/* LAYER PRO untuk Edit 3D (add-on, dimuat lewat js/waveform.js). Panel "✨ Animasi Layer" dan "🧩 Susun & Klon" muncul di properti teks / foto / video / grup.
   Animasi: pop, slide masuk kiri/kanan, flip 3D, spiral masuk, float melayang, pulse beat (BPM), fade out.
   Susun & Klon: klon melingkar, grid, atau terowongan (berderet di kedalaman) dari layer terpilih. Semua jadi keyframe / layer biasa, bisa di-undo (↶). */
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
const is3=it=>!!it&&/^(text|image|video|group)$/.test(it.kind);
const num=(id,d)=>{const v=parseFloat(($(id)||{}).value);return isFinite(v)?v:d};
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=r2(v);k.e=e||k.e}else{a.push({t:Math.round(t*1000)/1000,v:r2(v),e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
const clr=(it,p,a,b)=>{const l=it.keys[p];if(l)it.keys[p]=l.filter(k=>k.t<a-.02||k.t>b+.02);if(it.keys[p]&&!it.keys[p].length)delete it.keys[p]};
/* pasang rangkaian keyframe [[waktu, nilai, kurva], ...] pada properti p; keyframe lama di rentang itu diganti */
function seq(it,p,arr){clr(it,p,arr[0][0],arr[arr.length-1][0]);arr.forEach(([t,v,e])=>K(it,p,t,v,e))}
const NA={pop:'Pop',sl:'Slide dari kiri',sr:'Slide dari kanan',flip:'Flip 3D',spiral:'Spiral masuk',float:'Float melayang',pulse:'Pulse beat',fade:'Fade out'};
function anim(kind){
  const s=scn(),it=byId(selId());if(!s||!is3(it))return;
  const t=curT(),g=p=>A().val(it,p,t),sc=g('scale')||1,op=it.kind==='group'?1:(g('opacity')==null?1:g('opacity')),x=g('x')||0,y=g('y')||0,z=g('z')||0,te=v=>Math.min(v,s.dur);
  if(s.dur-t<.4){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal.');return}
  const hasOp=it.kind!=='group',dd=num('s3x-ldur',3);
  if(kind==='pop'){seq(it,'scale',[[t,Math.max(.05,sc*.05),'out'],[te(t+.25),sc*1.15,'inout'],[te(t+.5),sc,'inout']]);if(hasOp)seq(it,'opacity',[[t,0,'linear'],[te(t+.1),op,'linear']])}
  else if(kind==='sl'||kind==='sr'){seq(it,'x',[[t,x+(kind==='sl'?-900:900),'out'],[te(t+.6),x,'inout']]);if(hasOp)seq(it,'opacity',[[t,0,'linear'],[te(t+.25),op,'linear']])}
  else if(kind==='flip'){seq(it,'ry',[[t,(g('ry')||0)+180,'out'],[te(t+.7),g('ry')||0,'inout']]);if(hasOp)seq(it,'opacity',[[t,0,'linear'],[te(t+.2),op,'linear']])}
  else if(kind==='spiral'){seq(it,'z',[[t,z+1500,'out'],[te(t+.9),z,'inout']]);seq(it,'rz',[[t,(g('rz')||0)+360,'out'],[te(t+.9),g('rz')||0,'inout']]);seq(it,'scale',[[t,Math.max(.05,sc*.3),'out'],[te(t+.9),sc,'inout']]);if(hasOp)seq(it,'opacity',[[t,0,'linear'],[te(t+.3),op,'linear']])}
  else if(kind==='float'){const n=Math.max(2,Math.round((te(t+dd)-t)/.5));seq(it,'y',Array.from({length:n+1},(_,i)=>[t+(te(t+dd)-t)*i/n,y+30*Math.sin(i*1.4),'inout']));seq(it,'rz',Array.from({length:n+1},(_,i)=>[t+(te(t+dd)-t)*i/n,(g('rz')||0)+2*Math.sin(i*1.1+1),'inout']))}
  else if(kind==='pulse'){const bpm=clamp(num('s3x-lbpm',120),40,240),st=60/bpm,n=Math.min(200,Math.floor((te(t+dd)-t)/st));if(n<1){toast('Durasi terlalu pendek');return}
    const arr=[];for(let i=0;i<n;i++){const b=t+i*st;arr.push([b,sc,'out'],[b+st*.12,sc*1.12,'out'],[b+st*.85,sc,'inout'])}seq(it,'scale',arr)}
  else if(kind==='fade'){if(!hasOp){toast('Grup tidak punya opasitas');return}seq(it,'opacity',[[t,op,'linear'],[te(t+.5),0,'linear']])}
  it.start=Math.min(it.start||0,t);touch();toast(NA[kind]+' dipasang di '+t.toFixed(2)+' dtk. Tekan ↶ untuk membatalkan.');
}
function arrange(kind){
  const s=scn(),it=byId(selId());if(!s||!is3(it))return;
  const N=clamp(Math.round(num('s3x-n',6)),2,40),R=clamp(num('s3x-r',500),50,3000),t=curT();
  const x0=it.props.x||0,y0=it.props.y||0,z0=it.props.z||0,cols=Math.ceil(Math.sqrt(N)),rows=Math.ceil(N/cols);
  const place=(o,i)=>{
    ['x','y','z','ry'].forEach(p=>{if(o.keys&&o.keys[p]){o.props[p]=A().val(o,p,t);delete o.keys[p]}});
    if(kind==='ring'){const a=i*360/N,r=a*Math.PI/180;o.props.x=Math.round(x0+R*Math.sin(r));o.props.z=Math.round(z0+R*Math.cos(r));o.props.ry=a+180}
    else if(kind==='grid'){o.props.x=Math.round(x0+(i%cols-(cols-1)/2)*R);o.props.y=Math.round(y0+(Math.floor(i/cols)-(rows-1)/2)*R)}
    else{o.props.z=Math.round(z0+i*R);o.props.x=Math.round(x0+(i%2?1:-1)*150);o.props.ry=(i%2?-1:1)*26}
  };
  place(it,0);
  const at=s.items.indexOf(it);
  for(let i=1;i<N;i++){
    const c=JSON.parse(JSON.stringify(it));c.id='i'+Math.random().toString(36).slice(2,8);c.name=(it.name||it.kind)+' '+(i+1);
    place(c,i);s.items.splice(at+i,0,c);
  }
  touch();toast(N+' layer disusun ('+({ring:'melingkar',grid:'grid',tunnel:'terowongan'})[kind]+'). Tekan ↶ untuk membatalkan.');
}
function inject(){
  const P=$('s3-props'),it=byId(selId());
  if(!P||!is3(it)||P.querySelector('#s3x-lay'))return;
  const d=document.createElement('div');d.id='s3x-lay';d.className='s3c';
  d.innerHTML='<b>✨ Animasi Layer</b><div class="s3x-row">'+Object.keys(NA).map(k=>'<button class="btn" type="button" data-sxa="'+k+'">'+NA[k]+'</button>').join('')+'</div>'
    +'<div class="s3-two"><label class="s3-fl">Durasi Float / Pulse (dtk)<input type="number" id="s3x-ldur" min="0.5" max="60" step="0.5" value="3"></label><label class="s3-fl">BPM Pulse<input type="number" id="s3x-lbpm" min="40" max="240" value="120"></label></div>'
    +'<b>🧩 Susun &amp; Klon</b><div class="s3x-row"><button class="btn" type="button" data-sxs="ring">Melingkar</button><button class="btn" type="button" data-sxs="grid">Grid</button><button class="btn" type="button" data-sxs="tunnel">Terowongan</button></div>'
    +'<div class="s3-two"><label class="s3-fl">Jumlah layer<input type="number" id="s3x-n" min="2" max="40" value="6"></label><label class="s3-fl">Radius / jarak<input type="number" id="s3x-r" min="50" max="3000" step="50" value="500"></label></div>'
    +'<p class="s3-hint">Animasi dipasang di waktu sekarang. Susun & Klon memperbanyak layer ini lalu menatanya; posisi X/Y/Z lama layer diganti.</p>';
  const h=P.querySelector('.s3-hint');
  if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
function boot(){
  if(!$('s3d'))return;
  const P=$('s3-props');if(P)new MutationObserver(inject).observe(P,{childList:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-sxa],[data-sxs]');if(!b||!$('s3d').contains(b))return;
    if(b.dataset.sxa)anim(b.dataset.sxa);else arrange(b.dataset.sxs);
  });
  inject();
}
try{boot()}catch(e){console.error('Layer pro gagal dimuat',e)}
})();
