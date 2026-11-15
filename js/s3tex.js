/* TEKSTUR DI RUANG 3D (add-on, dimuat lewat js/waveform.js). Di tampilan "▦ Ruang 3D" dan "◫ 2 Tampilan", layer foto / video / teks digambar
   dengan cara yang sama seperti hasil kamera di scene3d.js: ukuran bidang, grid segitiga (6x6, teks 3 baris), opasitas per layer,
   resolusi tekstur (foto 1280, video 960), dan urutan tumpuk menurut kedalaman dari KAMERA AKTIF (bukan dari pengamat), jadi isi dan
   tumpukan layer sama dengan yang dilihat kamera. Tekstur digambar tepat setelah latar kanvas s3cam.js (pandangan pengamat dari
   window.__S3CAM_TEST.api, dibuat kosong oleh js/waveform.js sebelum s3cam.js). Saat Tekstur ON, isian kotak layer, garis kotak
   layer yang tidak dipilih, dan nama di tengah kotak dihilangkan supaya gambarnya bersih; garis kuning layer terpilih tetap ada. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ASPR={'16:9':16/9,'9:16':9/16,'1:1':1,'4:3':4/3,'21:9':21/9};
let ON=true,busy=0,nq=0,warned=false,SCR=null;
const M=new Map(),VC=new Map(),TC=new Map();
const isPlaying=()=>{const p=$('s3-play');return !!p&&p.textContent.trim()==='❚❚'};
function nudge(){if(nq)return;nq=requestAnimationFrame(()=>{nq=0;const r=$('s3d');if(r)r.dispatchEvent(new Event('change'))})}
function idbGet(id){return new Promise(res=>{try{
  const rq=indexedDB.open('apk-3d');rq.onupgradeneeded=e=>{try{e.target.transaction.abort()}catch(_){}};rq.onerror=()=>res(null);
  rq.onsuccess=()=>{try{const r=rq.result.transaction('media','readonly').objectStore('media').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)}catch(_){res(null)}};
}catch(_){res(null)}})}
/* placeholder foto: sama dengan scene3d.js (640x800) */
function ph(n){
  const c=document.createElement('canvas');c.width=640;c.height=800;const g=c.getContext('2d'),h=(n*57+200)%360,gr=g.createLinearGradient(0,0,640,800);
  gr.addColorStop(0,'hsl('+h+',70%,48%)');gr.addColorStop(1,'hsl('+((h+60)%360)+',75%,22%)');g.fillStyle=gr;g.fillRect(0,0,640,800);
  g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=6;g.strokeRect(16,16,608,768);
  g.fillStyle='#fff';g.textAlign='center';g.font='900 120px Arial,sans-serif';g.fillText('FOTO '+n,320,420);
  g.font='600 34px Arial,sans-serif';g.globalAlpha=.8;g.fillText('ganti dengan fotomu',320,490);
  return{k:'i',el:c,w:640,h:800,c};
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
  else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-rel)>.03)el.currentTime=rel}
}
function textTex(it){
  const size=it.size||170,lines=String(it.text||' ').split('\n'),key=[it.text,size,it.color,it.glow].join('|'),e=TC.get(it.id);
  if(e&&e.key===key)return e.v;
  const fnt='900 '+size+'px "Arial Black","Helvetica Neue",Arial,sans-serif',g0=document.createElement('canvas').getContext('2d');g0.font=fnt;
  const tw=Math.max(...lines.map(l=>g0.measureText(l).width),size*.3),pad=size*.4,lh=size*1.12,cw=tw+pad*2,ch=lines.length*lh+pad*1.2,k=Math.min(1.5,1024/cw);
  const c=document.createElement('canvas');c.width=Math.max(8,Math.round(cw*k));c.height=Math.max(8,Math.round(ch*k));
  const g=c.getContext('2d');g.setTransform(c.width/cw,0,0,c.height/ch,0,0);g.font=fnt;g.textAlign='center';g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=size*.22*k;g.shadowOffsetY=size*.05*k;g.fillStyle='#000';
  lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  g.shadowOffsetY=0;if(it.glow){g.shadowColor='rgba(255,255,255,.7)';g.shadowBlur=size*.1*k}else g.shadowBlur=0;
  g.fillStyle=it.color||'#fff';lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  const v={c,cw,ch,text:true};TC.set(it.id,{key,v});return v;
}
function texOf(it,t){
  if(it.kind==='text')return textTex(it);
  const m=media(it.mediaId);if(!m)return null;
  const ar=m.w/m.h,base=it.kind==='video'?1000:600,cw=base*ar,ch=base;
  if(m.k==='i'){
    if(!m.c){const w=Math.min(m.w,1280),h=Math.max(1,Math.round(w/ar)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(m.el,0,0,w,h);m.c=c}
    return{c:m.c,cw,ch};
  }
  syncVid(it,m,t);if(m.el.readyState<2)return null;
  const w=Math.min(m.w,960),h=Math.max(1,Math.round(w/ar));let c=VC.get(it.id);if(!c){c=document.createElement('canvas');VC.set(it.id,c)}
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
  g.save();g.setTransform(1,0,0,1,0,0);g.beginPath();
  [d0,d1,d2].forEach((v,i)=>{const dx=v[0]-cx,dy=v[1]-cy,l=Math.hypot(dx,dy)||1,x=v[0]+dx/l*.8,y=v[1]+dy/l*.8;i?g.lineTo(x,y):g.moveTo(x,y)});
  g.closePath();g.clip();g.setTransform(a,b,c,d,e,f);g.drawImage(img,0,0);g.restore();
}
/* satu layer: digambar penuh ke kanvas bantu lalu ditempel dengan opasitas (seperti scene3d.js, tanpa garis sambungan saat transparan) */
function layer(g,T,P,Wd,R,op,mv){
  const cols=T.text?clamp(Math.round(T.cw*Wd.s/110),3,10):6,rows=T.text?3:6,hw=T.cw*Wd.s,hh=T.ch*Wd.s,pts=[];
  let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const q=mv(R,[(i/cols-.5)*hw,(j/rows-.5)*hh,0]),p=P.pt([Wd.p[0]+q[0],Wd.p[1]+q[1],Wd.p[2]+q[2]]);if(!p)return;
    pts.push(p);bx0=Math.min(bx0,p[0]);bx1=Math.max(bx1,p[0]);by0=Math.min(by0,p[1]);by1=Math.max(by1,p[1]);
  }
  const W=g.canvas.width,H=g.canvas.height;
  const x0=Math.max(0,Math.floor(bx0)-2),y0=Math.max(0,Math.floor(by0)-2),x1=Math.min(W,Math.ceil(bx1)+2),y1=Math.min(H,Math.ceil(by1)+2);
  if(x1<=x0||y1<=y0)return;
  if(!SCR||SCR.width!==W||SCR.height!==H){SCR=document.createElement('canvas');SCR.width=W;SCR.height=H}
  const sg=SCR.getContext('2d');sg.setTransform(1,0,0,1,0,0);sg.globalAlpha=1;sg.imageSmoothingEnabled=true;sg.imageSmoothingQuality='high';
  const sw=T.c.width,sh=T.c.height,id=(i,j)=>j*(cols+1)+i,S=(i,j)=>[i/cols*sw,j/rows*sh];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    tri(sg,T.c,S(i,j),S(i+1,j),S(i,j+1),pts[id(i,j)],pts[id(i+1,j)],pts[id(i,j+1)]);
    tri(sg,T.c,S(i+1,j),S(i+1,j+1),S(i,j+1),pts[id(i+1,j)],pts[id(i+1,j+1)],pts[id(i,j+1)]);
  }
  g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=op;g.drawImage(SCR,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);g.restore();
  sg.setTransform(1,0,0,1,0,0);sg.clearRect(x0,y0,x1-x0,y1-y0);
}
function draw(g){
  const s=scn(),api=window.__S3CAM_TEST&&__S3CAM_TEST.api;
  if(!ON||!s||!api||!api.obsState||busy)return;busy=1;
  try{
    const cv=g.canvas,t=curT(),O=api.obsState(),P=api.mkProj(O,cv.width,cv.height);
    let act=s.items[0];(s.cuts||[]).forEach(k=>{if(k.t<=t+1e-6){const o=s.items.find(i=>i.id===k.cam);if(o&&o.kind==='camera')act=o}});
    const pose=api.camPose(act,t,ASPR[s.aspect]||16/9);
    /* urutan tumpuk = kedalaman dari kamera aktif, sama dengan scene3d.js */
    const L=s.items.slice(2).filter(it=>/^(text|image|video)$/.test(it.kind)&&it.pano!==true&&it.vis!==false&&t>=it.start-1e-6&&(it.dur==null||t<=it.start+it.dur+1e-6))
      .map(it=>{const W=A().world(it,t);return{it,W,z:api.mvT(pose.R,[W.p[0]-pose.p[0],W.p[1]-pose.p[1],W.p[2]-pose.p[2]])[2]}}).sort((a,b)=>b.z-a.z);
    g.save();g.setLineDash([]);
    L.forEach(o=>{
      const T=texOf(o.it,t),op=A().val(o.it,'opacity',t);if(!T||!(op>.002))return;
      layer(g,T,P,o.W,o.it.bill?api.rotM(0,0,0)&&api.mul(pose.R,api.rotM(0,0,A().val(o.it,'rz',t)||0)):o.W.R,clamp(op,0,1),api.mv);
    });
    g.restore();
  }catch(e){if(!warned){warned=true;console.warn('Tekstur Ruang 3D gagal digambar',e)}}
  finally{busy=0}
}
function boot(){
  const lv=$('s3-lv'),w=document.querySelector('#s3d .s3v'),root=$('s3d');
  if(!lv||!w||!root||$('s3-vtex'))return false;
  const g=lv.getContext('2d'),fr=g.fillRect,ft=g.fillText,ff=g.fill,fs=g.stroke;
  g.fillRect=function(x,y,w2,h){fr.apply(this,arguments);if(x===0&&y===0&&w2===lv.width&&h===lv.height)draw(this)};
  /* hilangkan isian kotak layer (alpha .16), garis kotak layer tidak terpilih, dan nama di tengah kotak saat Tekstur ON */
  g.fill=function(){if(ON&&Math.abs(this.globalAlpha-.16)<.002)return;return ff.apply(this,arguments)};
  g.stroke=function(){if(ON&&this.lineWidth===1.6&&/^#(ffffff|7fb2ff|ff9a4d|c8c8d0|9be28f)$/i.test(String(this.strokeStyle)))return;return fs.apply(this,arguments)};
  g.fillText=function(){if(ON&&/255, ?255, ?255, ?0?\.92/.test(String(this.fillStyle)))return;return ft.apply(this,arguments)};
  const b=document.createElement('button');b.type='button';b.className='btn';b.id='s3-vtex';b.textContent='Tekstur: ON';
  b.title='Tampilkan isi foto / video / teks di Ruang 3D sama persis dengan hasil kamera';b.hidden=true;
  w.appendChild(b);
  b.onclick=()=>{ON=!ON;b.textContent='Tekstur: '+(ON?'ON':'OFF');nudge()};
  const sync=()=>{b.hidden=!root.classList.contains('s3-v3d')};
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});sync();
  return true;
}
function start(){if(!boot())setTimeout(()=>{if(!boot())console.warn('Tekstur Ruang 3D: tampilan Ruang 3D (s3cam.js) tidak ditemukan')},500)}
try{start()}catch(e){console.error('Tekstur Ruang 3D gagal dimuat',e)}
})();
