/* TEKSTUR DI RUANG 3D (add-on, dimuat lewat js/waveform.js). Di tampilan "▦ Ruang 3D" dan "◫ 2 Tampilan", layer foto / video / teks digambar
   dengan isinya (bukan cuma kotak transparan). Menumpang pada gambar bawaan js/s3cam.js: tekstur digambar tepat setelah latar kanvas,
   memakai pandangan pengamat dari window.__S3CAM_TEST.api (dibuat kosong oleh js/waveform.js sebelum s3cam.js dimuat).
   Kotak, garis pilih, kamera, dan titik kendali tetap digambar s3cam.js di atasnya. Tombol "Tekstur: ON/OFF" untuk mematikan. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ASPR={'16:9':16/9,'9:16':9/16,'1:1':1,'4:3':4/3,'21:9':21/9};
let ON=true,busy=0,nq=0,warned=false;
const M=new Map(),VC=new Map(),TC=new Map();
const isPlaying=()=>{const p=$('s3-play');return !!p&&p.textContent.trim()==='❚❚'};
/* minta s3cam.js menggambar ulang (dia memantau event change di #s3d) */
function nudge(){if(nq)return;nq=requestAnimationFrame(()=>{nq=0;const r=$('s3d');if(r)r.dispatchEvent(new Event('change'))})}
function idbGet(id){return new Promise(res=>{try{
  const rq=indexedDB.open('apk-3d');rq.onupgradeneeded=e=>{try{e.target.transaction.abort()}catch(_){}};rq.onerror=()=>res(null);
  rq.onsuccess=()=>{try{const r=rq.result.transaction('media','readonly').objectStore('media').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)}catch(_){res(null)}};
}catch(_){res(null)}})}
function ph(n){
  const c=document.createElement('canvas');c.width=320;c.height=400;const g=c.getContext('2d'),h=(n*57+200)%360,gr=g.createLinearGradient(0,0,320,400);
  gr.addColorStop(0,'hsl('+h+',70%,48%)');gr.addColorStop(1,'hsl('+((h+60)%360)+',75%,22%)');g.fillStyle=gr;g.fillRect(0,0,320,400);
  g.fillStyle='#fff';g.textAlign='center';g.font='900 60px Arial,sans-serif';g.fillText('FOTO '+n,160,210);
  return{k:'i',el:c,w:320,h:400,c};
}
function media(id){
  if(!id)return null;if(M.has(id))return M.get(id);
  M.set(id,null);
  if(/^ph\d+$/.test(id)){M.set(id,ph(+id.slice(2)));return M.get(id)}
  idbGet(id).then(async rec=>{
    if(!rec||!rec.blob)return;const url=URL.createObjectURL(rec.blob),type=rec.type||'';
    if(type.startsWith('image')){const el=new Image();el.src=url;try{await el.decode()}catch(_){}M.set(id,{k:'i',el,w:el.naturalWidth||1,h:el.naturalHeight||1})}
    else if(type.startsWith('video')){
      const el=document.createElement('video');el.muted=true;el.playsInline=true;el.preload='auto';el.src=url;el.addEventListener('seeked',nudge);
      await new Promise(r=>{el.onloadeddata=r;el.onerror=r;setTimeout(r,5000)});M.set(id,{k:'v',el,w:el.videoWidth||1,h:el.videoHeight||1});
    }
    nudge();
  });
  return null;
}
function syncVid(it,m,t){
  const el=m.el,rel=clamp(t-it.start+(it.trim||0),0,Math.max(0,(el.duration||1e9)-.05));
  if(isPlaying()){if(el.paused)el.play().catch(()=>{});if(Math.abs(el.currentTime-rel)>.4)el.currentTime=rel}
  else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-rel)>.05)el.currentTime=rel}
}
function textTex(it){
  const size=it.size||170,lines=String(it.text||' ').split('\n'),key=[it.text,size,it.color,it.glow].join('|'),e=TC.get(it.id);
  if(e&&e.key===key)return e.v;
  const fnt='900 '+size+'px "Arial Black","Helvetica Neue",Arial,sans-serif',g0=document.createElement('canvas').getContext('2d');g0.font=fnt;
  const tw=Math.max(...lines.map(l=>g0.measureText(l).width),size*.3),pad=size*.4,lh=size*1.12,cw=tw+pad*2,ch=lines.length*lh+pad*1.2,k=Math.min(1,512/cw);
  const c=document.createElement('canvas');c.width=Math.max(8,Math.round(cw*k));c.height=Math.max(8,Math.round(ch*k));
  const g=c.getContext('2d');g.setTransform(k,0,0,k,0,0);g.font=fnt;g.textAlign='center';g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=size*.22*k;g.shadowOffsetY=size*.05*k;g.fillStyle='#000';
  lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  g.shadowOffsetY=0;if(it.glow){g.shadowColor='rgba(255,255,255,.7)';g.shadowBlur=size*.1*k}else g.shadowBlur=0;
  g.fillStyle=it.color||'#fff';lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  const v={c,cw,ch};TC.set(it.id,{key,v});return v;
}
function texOf(it,t){
  if(it.kind==='text')return textTex(it);
  const m=media(it.mediaId);if(!m)return null;
  const ar=m.w/m.h,base=it.kind==='video'?1000:600,cw=base*ar,ch=base;
  if(m.k==='i'){
    if(!m.c){const w=Math.min(m.w,512),h=Math.max(1,Math.round(w/ar)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(m.el,0,0,w,h);m.c=c}
    return{c:m.c,cw,ch};
  }
  syncVid(it,m,t);if(m.el.readyState<2)return null;
  const w=Math.min(m.w,384),h=Math.max(1,Math.round(w/ar));let c=VC.get(it.id);if(!c){c=document.createElement('canvas');VC.set(it.id,c)}
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  try{c.getContext('2d').drawImage(m.el,0,0,w,h)}catch(_){}
  return{c,cw,ch};
}
/* segitiga bertekstur (sama dengan tri() di scene3d.js) */
function tri(g,img,s0,s1,s2,d0,d1,d2){
  const det=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);if(Math.abs(det)<1e-6)return;
  const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/det,c=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/det,
    b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/det,d=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/det,
    e=d0[0]-a*s0[0]-c*s0[1],f=d0[1]-b*s0[0]-d*s0[1],cx=(d0[0]+d1[0]+d2[0])/3,cy=(d0[1]+d1[1]+d2[1])/3;
  g.save();g.beginPath();
  [d0,d1,d2].forEach((v,i)=>{const dx=v[0]-cx,dy=v[1]-cy,l=Math.hypot(dx,dy)||1,x=v[0]+dx/l*.8,y=v[1]+dy/l*.8;i?g.lineTo(x,y):g.moveTo(x,y)});
  g.closePath();g.clip();g.setTransform(a,b,c,d,e,f);g.drawImage(img,0,0);g.restore();
}
function quad(g,T,P,Wd,R,alpha,mv){
  const n=5,hw=T.cw*Wd.s,hh=T.ch*Wd.s,pts=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const q=mv(R,[(i/n-.5)*hw,(j/n-.5)*hh,0]),p=P.pt([Wd.p[0]+q[0],Wd.p[1]+q[1],Wd.p[2]+q[2]]);if(!p)return;pts.push(p);
  }
  g.globalAlpha=alpha;const sw=T.c.width,sh=T.c.height,id=(i,j)=>j*(n+1)+i,S=(i,j)=>[i/n*sw,j/n*sh];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    tri(g,T.c,S(i,j),S(i+1,j),S(i,j+1),pts[id(i,j)],pts[id(i+1,j)],pts[id(i,j+1)]);
    tri(g,T.c,S(i+1,j),S(i+1,j+1),S(i,j+1),pts[id(i+1,j)],pts[id(i+1,j+1)],pts[id(i,j+1)]);
  }
}
function draw(g){
  const s=scn(),api=window.__S3CAM_TEST&&__S3CAM_TEST.api;
  if(!ON||!s||!api||!api.obsState||busy)return;busy=1;
  try{
    const cv=g.canvas,t=curT(),O=api.obsState(),P=api.mkProj(O,cv.width,cv.height);
    let act=s.items[0];(s.cuts||[]).forEach(k=>{if(k.t<=t+1e-6){const o=s.items.find(i=>i.id===k.cam);if(o&&o.kind==='camera')act=o}});
    const pose=api.camPose(act,t,ASPR[s.aspect]||16/9);
    const L=s.items.filter(it=>/^(text|image|video)$/.test(it.kind)&&it.vis!==false&&t>=it.start-1e-6&&(it.dur==null||t<=it.start+it.dur+1e-6))
      .map(it=>{const W=A().world(it,t);return{it,W,z:P.cs(W.p)[2]}}).sort((a,b)=>b.z-a.z);
    g.save();g.imageSmoothingEnabled=true;g.setLineDash([]);
    L.forEach(o=>{
      const T=texOf(o.it,t),op=A().val(o.it,'opacity',t);if(!T||!(op>.003))return;
      quad(g,T,P,o.W,o.it.bill?api.mul(pose.R,api.rotM(0,0,A().val(o.it,'rz',t)||0)):o.W.R,clamp(op,0,1),api.mv);
    });
    g.restore();
  }catch(e){if(!warned){warned=true;console.warn('Tekstur Ruang 3D gagal digambar',e)}}
  finally{busy=0}
}
function boot(){
  const lv=$('s3-lv'),w=document.querySelector('#s3d .s3v'),root=$('s3d');
  if(!lv||!w||!root||$('s3-vtex'))return false;
  const g=lv.getContext('2d'),fr=g.fillRect,ft=g.fillText;
  g.fillRect=function(x,y,w2,h){fr.apply(this,arguments);if(x===0&&y===0&&w2===lv.width&&h===lv.height)draw(this)};
  /* nama layer di tengah kotak ditiadakan saat tekstur aktif supaya gambar tidak tertutup tulisan */
  g.fillText=function(){if(ON&&/255, ?255, ?255, ?0?\.92/.test(String(this.fillStyle)))return;return ft.apply(this,arguments)};
  const b=document.createElement('button');b.type='button';b.className='btn';b.id='s3-vtex';b.textContent='Tekstur: ON';
  b.title='Tampilkan isi foto / video / teks di Ruang 3D';b.hidden=true;
  w.appendChild(b);
  b.onclick=()=>{ON=!ON;b.textContent='Tekstur: '+(ON?'ON':'OFF');nudge()};
  const sync=()=>{b.hidden=!root.classList.contains('s3-v3d')};
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});sync();
  return true;
}
function start(){if(!boot())setTimeout(()=>{if(!boot())console.warn('Tekstur Ruang 3D: tampilan Ruang 3D (s3cam.js) tidak ditemukan')},500)}
try{start()}catch(e){console.error('Tekstur Ruang 3D gagal dimuat',e)}
})();
