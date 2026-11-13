/* EDIT 3D: ruang 3D sungguhan (kamera, layer teks/foto/video, parent, hadap kamera, tracking titik pada video, keyframe,
   efek chromatic aberration / glow / getar / kilat) + contoh referensi. BUKAN pembuat model 3D: ini pengedit dan tracking.
   Dunia: tinggi layar = 1000 satuan. Layer z=0 dan kamera z=0 => ukuran asli. z besar = makin jauh dari kamera.
   Kamera memandang ke arah +z. Transformasi layer: skala -> putar Y -> putar X -> putar Z -> geser -> (parent) -> kamera. */
window.APK=window.APK||{};
APK.s3d=(function(){
'use strict';
const $=id=>document.getElementById(id),D=Math.PI/180,REFH=1000;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rid=()=>Math.random().toString(36).slice(2,8);

/* ===== penyimpanan (IndexedDB terpisah dari editor video) ===== */
let dbp;
function odb(){return dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('apk-3d',1);
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('scenes',{keyPath:'id'});d.createObjectStore('media',{keyPath:'id'})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))}
async function tx(st,mode,fn){const d=await odb();return new Promise((res,rej)=>{const t=d.transaction(st,mode),o=fn(t.objectStore(st));
  t.oncomplete=()=>res(o.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
const DB={put:(s,v)=>tx(s,'readwrite',x=>x.put(v)),get:(s,id)=>tx(s,'readonly',x=>x.get(id)),del:(s,id)=>tx(s,'readwrite',x=>x.delete(id)),all:s=>tx(s,'readonly',x=>x.getAll())};

/* ===== kurva gerak ===== */
const EASE={linear:{n:'Lurus',f:u=>u},inout:{n:'Halus',f:u=>u<.5?2*u*u:1-2*(1-u)*(1-u)},
  out:{n:'Cepat lalu pelan',f:u=>1-Math.pow(1-u,3)},in:{n:'Pelan lalu cepat',f:u=>u*u*u},
  back:{n:'Pegas (melenting)',f:u=>{const c=1.70158;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)}}};

/* ===== definisi properti: [label,min,max,step,default] ===== */
const PD={
  x:['Posisi X',-3000,3000,1,0],y:['Posisi Y',-3000,3000,1,0],z:['Kedalaman Z (makin besar makin jauh)',-3000,8000,1,0],
  rx:['Putar 3D sumbu X (°)',-360,360,1,0],ry:['Putar 3D sumbu Y (°)',-360,360,1,0],rz:['Putar datar / roll (°)',-720,720,1,0],
  scale:['Ukuran',0.05,6,0.01,1],opacity:['Opasitas',0,1,0.01,1],fov:['Sudut lensa FOV (°)',20,120,1,60],
  ca:['Chromatic aberration (pisah warna)',0,30,0.5,0],glow:['Glow / cahaya',0,1,0.01,0],shake:['Getar kamera',0,1,0.01,0],flash:['Kilat putih',0,1,0.01,0],
  speed:['Kecepatan',-360,360,1,30],
  dist:['Jarak kamera ke objek',100,4000,10,900],az:['Sudut keliling kiri/kanan (°)',-180,180,1,0],el:['Sudut atas/bawah (°)',-80,80,1,0],
  frx:['Bingkai: objek geser kiri/kanan',-0.45,0.45,0.01,0],fry:['Bingkai: objek geser atas/bawah',-0.45,0.45,0.01,0],
  follow:['Kecepatan ikut (0 pelan ... 1 kaku)',0,1,0.01,0.6],focus:['Fokus: blur di luar jarak fokus',0,1,0.01,0],fd:['Jarak fokus',100,5000,10,900]
};
const CAMT=['dist','az','el','frx','fry','follow'];
const PDK={sunburst:{speed:['Putar otomatis (°/detik)',-360,360,1,25],rz:['Putar tambahan (°)',-720,720,1,0]},
  ribbon:{speed:['Kecepatan gerak',0,6,0.1,1.2]},dust:{speed:['Kecepatan melaju (satuan/detik)',-3000,3000,10,600]}};
const KINDS={camera:['x','y','z','rx','ry','rz','fov','focus','fd','dist','az','el','frx','fry','follow'],fx:['ca','glow','shake','flash'],
  text:['x','y','z','rx','ry','rz','scale','opacity'],image:['x','y','z','rx','ry','rz','scale','opacity'],video:['x','y','z','rx','ry','rz','scale','opacity'],
  group:['x','y','z','rx','ry','rz','scale'],sunburst:['opacity','rz','scale','speed'],ribbon:['opacity','scale','speed'],dust:['opacity','speed']};
const NAMES={camera:'Kamera',fx:'Efek',text:'Teks',image:'Foto',video:'Video',group:'Grup',sunburst:'Latar kipas',ribbon:'Pita cahaya',dust:'Debu bintang'};
const ICON={camera:'🎥',fx:'✦',text:'T',image:'🖼',video:'🎞',group:'▣',sunburst:'✺',ribbon:'〰',dust:'✧'};
const IS3D=k=>k==='text'||k==='image'||k==='video'||k==='group';
const ISMEDIA=k=>k==='image'||k==='video';
const pd=(kind,p)=>(PDK[kind]&&PDK[kind][p])||PD[p];
const ASPECT={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:3':[4,3],'21:9':[21,9]};

/* ===== model ===== */
let S=null,selId='cam',t=0,playing=false,curEase='inout',dirtyF=false,saveT=0;
const media=new Map();
let HIT={};
function mkItem(kind,o){
  const it={id:'i'+rid(),kind,name:NAMES[kind],props:{},keys:{},start:0,dur:null,parent:null,bill:false,vis:true};
  KINDS[kind].forEach(p=>it.props[p]=pd(kind,p)[4]);
  if(kind==='camera')it.target=null;
  if(kind==='text')Object.assign(it,{text:'TEKS',size:170,color:'#ffffff',glow:true});
  if(kind==='sunburst')Object.assign(it,{beams:8,twist:.7});
  if(kind==='dust')Object.assign(it,{count:220});
  return Object.assign(it,o||{});
}
function newScene(o){
  const cam=mkItem('camera',{id:'cam'}),fx=mkItem('fx',{id:'fx'});
  return Object.assign({id:'s3_'+Date.now().toString(36)+rid(),name:'Project 3D',aspect:'16:9',dur:10,music:null,items:[cam,fx],updated:Date.now()},o||{});
}
const sel=()=>S.items.find(i=>i.id===selId)||S.items[0];
const byId=id=>S.items.find(i=>i.id===id);
function val(it,p,tt){
  const a=it.keys[p];
  if(!a||!a.length)return it.props[p];
  if(tt<=a[0].t)return a[0].v;
  const l=a[a.length-1];if(tt>=l.t)return l.v;
  let i=0;while(a[i+1].t<tt)i++;
  const k0=a[i],k1=a[i+1],u=(tt-k0.t)/(k1.t-k0.t);
  return k0.v+(k1.v-k0.v)*(EASE[k0.e]||EASE.inout).f(u);
}
function keyAt(it,p,tt){const a=it.keys[p];return a?a.find(k=>Math.abs(k.t-tt)<0.02):null}
function setKey(it,p,tt,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-tt)<0.02);
  if(k){k.v=v;if(e)k.e=e}else{a.push({t:Math.round(tt*1000)/1000,v,e:e||curEase});a.sort((x,y)=>x.t-y.t)}
}
function delKey(it,p,tt){
  const a=it.keys[p];if(!a)return;
  const i=a.findIndex(k=>Math.abs(k.t-tt)<0.02);if(i<0)return;
  if(a.length===1)it.props[p]=a[0].v;
  a.splice(i,1);if(!a.length)delete it.keys[p];
}
const visible=(it,tt)=>it.vis!==false&&tt>=it.start-1e-6&&(it.dur==null||tt<=it.start+it.dur+1e-6);

/* ===== matematika 3D ===== */
const mul=(A,B)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return r};
const mv=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
const mvT=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]];
function rotM(rx,ry,rz){
  const cx=Math.cos(rx*D),sx=Math.sin(rx*D),cy=Math.cos(ry*D),sy=Math.sin(ry*D),cz=Math.cos(rz*D),sz=Math.sin(rz*D);
  return mul([cz,-sz,0,sz,cz,0,0,0,1],mul([1,0,0,0,cx,-sx,0,sx,cx],[cy,0,sy,0,1,0,-sy,0,cy]));
}
function world(it,tt,depth){
  const g=p=>val(it,p,tt);
  const L={p:[g('x')||0,g('y')||0,g('z')||0],R:rotM(g('rx')||0,g('ry')||0,g('rz')||0),s:g('scale')==null?1:g('scale')};
  const pa=it.parent&&(depth||0)<6?byId(it.parent):null;
  if(pa&&pa!==it){
    const W=world(pa,tt,(depth||0)+1),q=mv(W.R,[L.p[0]*W.s,L.p[1]*W.s,L.p[2]*W.s]);
    return{p:[W.p[0]+q[0],W.p[1]+q[1],W.p[2]+q[2]],R:mul(W.R,L.R),s:W.s*L.s};
  }
  return L;
}
function activeCam(tt){let c=S.items[0];(S.cuts||[]).forEach(k=>{if(k.t<=tt+1e-6){const o=byId(k.cam);if(o&&o.kind==='camera')c=o}});return c}
function targetPos(c,tt){
  const tg=c.target&&byId(c.target);if(!tg)return null;
  const tau=(1-clamp(val(c,'follow',tt)==null?.6:val(c,'follow',tt),0,1))*1.6;
  if(tau<.03)return world(tg,tt).p;
  let a=[0,0,0],sw=0;
  for(let k=0;k<14;k++){const w=Math.exp(-k*.1/tau),p=world(tg,Math.max(0,tt-k*.1)).p;a[0]+=p[0]*w;a[1]+=p[1]*w;a[2]+=p[2]*w;sw+=w}
  return[a[0]/sw,a[1]/sw,a[2]/sw];
}
function camState(tt){
  const c=activeCam(tt),f=S.items[1],sh=val(f,'shake',tt);
  const g=p=>{const v=val(c,p,tt);return v==null?pd('camera',p)[4]:v};
  const F=(REFH/2)/Math.tan(g('fov')*D/2),tp=targetPos(c,tt);
  let sx=0,sy=0,srz=0;
  if(sh>0){sx=sh*14*(Math.sin(tt*53)+.6*Math.sin(tt*97+1));sy=sh*14*(Math.sin(tt*61+2)+.6*Math.sin(tt*89));srz=sh*.9*Math.sin(tt*71+.5)}
  if(tp){
    const d=Math.max(50,g('dist')),az=g('az')*D,el=g('el')*D,cv=$('s3-cv'),asp=cv.width/cv.height;
    const fw=[-Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
    const ry=Math.asin(clamp(fw[0],-1,1))/D,rx=Math.atan2(-fw[1],fw[2])/D;
    const R=mul(mul(rotM(rx,ry,0),rotM(g('rx'),g('ry'),g('rz')+srz)),[1,0,0,0,1,0,0,0,1]);
    const Hd=2*d*Math.tan(g('fov')*D/2),Wd=Hd*asp,sft=mv(R,[-g('frx')*Wd,-g('fry')*Hd,0]);
    const p=[tp[0]-fw[0]*d+sft[0]+g('x')+sx,tp[1]-fw[1]*d+sft[1]+g('y')+sy,tp[2]-fw[2]*d+sft[2]+g('z')];
    return{p,R,F,rz:g('rz'),focus:g('focus'),fd:d};
  }
  return{p:[g('x')+sx,g('y')+sy,g('z')-F],R:rotM(g('rx'),g('ry'),g('rz')+srz),F,rz:g('rz'),focus:g('focus'),fd:g('fd')};
}
const toCam=(C,w)=>mvT(C.R,[w[0]-C.p[0],w[1]-C.p[1],w[2]-C.p[2]]);

/* ===== kanvas bantu ===== */
let SC=null,BC=null,BK=null,TC=null,BL1=null,BL2=null;
const texPool=new Map();
function fit(c,w,h){if(!c)c=document.createElement('canvas');if(c.width!==w||c.height!==h){c.width=w;c.height=h}return c}
function tri(g,img,s0,s1,s2,d0,d1,d2){
  const det=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);
  if(Math.abs(det)<1e-6)return;
  const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/det,
        c=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/det,
        b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/det,
        d=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/det,
        e=d0[0]-a*s0[0]-c*s0[1],f=d0[1]-b*s0[0]-d*s0[1];
  const cx=(d0[0]+d1[0]+d2[0])/3,cy=(d0[1]+d1[1]+d2[1])/3;
  g.save();g.setTransform(1,0,0,1,0,0);g.beginPath();
  [d0,d1,d2].forEach((v,i)=>{const dx=v[0]-cx,dy=v[1]-cy,l=Math.hypot(dx,dy)||1,x=v[0]+dx/l*0.8,y=v[1]+dy/l*0.8;i?g.lineTo(x,y):g.moveTo(x,y)});
  g.closePath();g.clip();g.setTransform(a,b,c,d,e,f);
  const x0=Math.floor(Math.min(s0[0],s1[0],s2[0])),y0=Math.floor(Math.min(s0[1],s1[1],s2[1])),
        x1=Math.ceil(Math.max(s0[0],s1[0],s2[0])),y1=Math.ceil(Math.max(s0[1],s1[1],s2[1]));
  if(x1>x0&&y1>y0)g.drawImage(img,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);
  g.restore();
}

/* ===== media ===== */
function placeholder(n){
  const c=document.createElement('canvas');c.width=640;c.height=800;const g=c.getContext('2d');
  const h=(n*57+200)%360,gr=g.createLinearGradient(0,0,640,800);
  gr.addColorStop(0,`hsl(${h},70%,48%)`);gr.addColorStop(1,`hsl(${(h+60)%360},75%,22%)`);
  g.fillStyle=gr;g.fillRect(0,0,640,800);
  g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=6;g.strokeRect(16,16,608,768);
  g.fillStyle='#fff';g.textAlign='center';g.font='900 120px Arial,sans-serif';g.fillText('FOTO '+n,320,420);
  g.font='600 34px Arial,sans-serif';g.globalAlpha=.8;g.fillText('ganti dengan fotomu',320,490);
  return c;
}
function getMedia(id){
  if(!id)return null;
  let m=media.get(id);
  if(!m&&/^ph\d+$/.test(id)){const c=placeholder(+id.slice(2));m={kind:'image',el:c,w:c.width,h:c.height,name:'placeholder'};media.set(id,m)}
  return m||null;
}
async function loadMedia(rec){
  const url=URL.createObjectURL(rec.blob),type=rec.type||'';
  if(type.startsWith('image')){
    const el=new Image();el.src=url;try{await el.decode()}catch(_){}
    const m={kind:'image',el,w:el.naturalWidth||1,h:el.naturalHeight||1,name:rec.name,url};media.set(rec.id,m);return m;
  }
  const isAud=type.startsWith('audio'),el=document.createElement(isAud?'audio':'video');
  el.preload='auto';el.src=url;if(!isAud){el.muted=true;el.playsInline=true;el.setAttribute('playsinline','');el.crossOrigin='anonymous'}
  await new Promise(r=>{el.onloadedmetadata=r;el.onerror=r;setTimeout(r,6000)});
  el.addEventListener('seeked',()=>reqRender());
  const m={kind:isAud?'audio':'video',el,w:el.videoWidth||1,h:el.videoHeight||1,name:rec.name,url};media.set(rec.id,m);return m;
}
async function ensureMedia(){
  const ids=new Set(S.items.map(i=>i.mediaId).filter(Boolean));if(S.music)ids.add(S.music);
  for(const id of ids){if(media.has(id)||/^ph\d+$/.test(id))continue;const rec=await DB.get('media',id);if(rec)await loadMedia(rec)}
}
async function addFile(file){
  const id='m'+Date.now().toString(36)+rid();
  await DB.put('media',{id,name:file.name,type:file.type,blob:file});
  const m=await loadMedia({id,name:file.name,type:file.type,blob:file});return{id,m};
}

/* ===== tekstur layer ===== */
function textTex(it,dens){
  let c=texPool.get(it.id);if(!c){c=document.createElement('canvas');texPool.set(it.id,c)}
  const size=it.size||170,lines=String(it.text||' ').split('\n'),fnt=`900 ${size}px "Arial Black","Helvetica Neue",Arial,sans-serif`;
  const g=c.getContext('2d');g.font=fnt;
  const tw=Math.max(...lines.map(l=>g.measureText(l).width),size*.3),pad=size*.4,lh=size*1.12;
  const cw=tw+pad*2,ch=lines.length*lh+pad*1.2;
  const w=Math.max(8,Math.min(2048,Math.round(cw*dens))),h=Math.max(8,Math.min(2048,Math.round(ch*dens*(Math.min(2048,cw*dens)/(cw*dens)))));
  const sx=w/cw,sy=h/ch;
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}else g.clearRect(0,0,w,h);
  g.setTransform(sx,0,0,sy,0,0);g.font=fnt;g.textAlign='center';g.textBaseline='middle';
  g.shadowColor='rgba(0,0,0,.85)';g.shadowBlur=size*.22*sx;g.shadowOffsetY=size*.05*sy;g.fillStyle='#000';
  lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  g.shadowOffsetY=0;
  if(it.glow){g.shadowColor='rgba(255,255,255,.7)';g.shadowBlur=size*.1*sx}else g.shadowBlur=0;
  g.fillStyle=it.color||'#fff';
  lines.forEach((l,i)=>g.fillText(l,cw/2,pad*.6+lh*(i+.5)));
  g.shadowBlur=0;
  return{c,cw,ch,tw:w,th:h};
}
function mediaTex(it){
  const m=getMedia(it.mediaId);
  const base=it.kind==='video'?1000:600;
  if(!m||m.kind==='audio'){return it.kind==='video'?null:mediaTex({kind:'image',mediaId:'ph1'})}
  const ar=m.w/m.h,ch=base,cw=base*ar;
  if(m.kind==='image'){
    if(!m.tex){const mw=Math.min(m.w,1280),mh=Math.round(mw/ar),c=document.createElement('canvas');c.width=mw;c.height=mh;c.getContext('2d').drawImage(m.el,0,0,mw,mh);m.tex=c}
    return{c:m.tex,cw,ch,tw:m.tex.width,th:m.tex.height};
  }
  if(m.el.readyState<2)return null;
  const mw=Math.min(m.w,960),mh=Math.round(mw/ar);
  let c=texPool.get('v'+it.id);if(!c){c=document.createElement('canvas');texPool.set('v'+it.id,c)}
  if(c.width!==mw||c.height!==mh){c.width=mw;c.height=mh}
  try{c.getContext('2d').drawImage(m.el,0,0,mw,mh)}catch(_){}
  return{c,cw,ch,tw:mw,th:mh};
}

/* ===== menggambar ===== */
function drawLayer(it,tt,C,k,W,H){
  const o=it.kind==='group'?0:val(it,'opacity',tt);
  if(o<=0.002||it.kind==='group')return;
  const Wd=world(it,tt),pc0=toCam(C,Wd.p),F=C.F;
  if(pc0[2]<F*0.05)return;
  const dens=clamp(k*Wd.s*F/pc0[2],0.3,3);
  const T=it.kind==='text'?textTex(it,dens):mediaTex(it);
  if(!T)return;
  const text=it.kind==='text',cols=text?clamp(Math.round(T.cw*Wd.s/110),3,10):6,rows=text?3:6;
  const Rb=it.bill?rotM(0,0,val(it,'rz',tt)):null,pts=[];let ok=false;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=(i/cols-.5)*T.cw*Wd.s,v=(j/rows-.5)*T.ch*Wd.s;let pc;
    if(Rb){const q=mv(Rb,[u,v,0]);pc=[pc0[0]+q[0],pc0[1]+q[1],pc0[2]+q[2]]}
    else{const q=mv(Wd.R,[u,v,0]);pc=toCam(C,[Wd.p[0]+q[0],Wd.p[1]+q[1],Wd.p[2]+q[2]])}
    if(pc[2]>F*0.05)ok=true;
    const d=Math.max(pc[2],F*0.05);pts.push([W/2+pc[0]*F/d*k,H/2+pc[1]*F/d*k]);
  }
  if(!ok)return;
  let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;
  for(const p of pts){if(p[0]<bx0)bx0=p[0];if(p[0]>bx1)bx1=p[0];if(p[1]<by0)by0=p[1];if(p[1]>by1)by1=p[1]}
  const x0=Math.max(0,Math.floor(bx0)-2),y0=Math.max(0,Math.floor(by0)-2),x1=Math.min(W,Math.ceil(bx1)+2),y1=Math.min(H,Math.ceil(by1)+2);
  const id=(i,j)=>j*(cols+1)+i;
  HIT[it.id]=[pts[id(0,0)],pts[id(cols,0)],pts[id(cols,rows)],pts[id(0,rows)]];
  if(x1<=x0||y1<=y0)return;
  const gb=BC.getContext('2d');gb.imageSmoothingEnabled=true;gb.imageSmoothingQuality='high';
  const SRC=(i,j)=>[i/cols*T.tw,j/rows*T.th];
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=id(i,j),b=id(i+1,j),c=id(i,j+1),d=id(i+1,j+1);
    tri(gb,T.c,SRC(i,j),SRC(i+1,j),SRC(i,j+1),pts[a],pts[b],pts[c]);
    tri(gb,T.c,SRC(i+1,j),SRC(i+1,j+1),SRC(i,j+1),pts[b],pts[d],pts[c]);
  }
  const g=SC.getContext('2d');g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=clamp(o,0,1);
  const nb=1+(C.focus||0)*10*clamp(Math.abs(pc0[2]-C.fd)/Math.max(100,C.fd),0,1.5);
  if(nb>1.4){
    const bw=Math.max(2,Math.round((x1-x0)/nb)),bh=Math.max(2,Math.round((y1-y0)/nb));BK=fit(BK,bw,bh);
    const bg=BK.getContext('2d');bg.setTransform(1,0,0,1,0,0);bg.clearRect(0,0,bw,bh);bg.imageSmoothingEnabled=true;bg.drawImage(BC,x0,y0,x1-x0,y1-y0,0,0,bw,bh);
    g.imageSmoothingEnabled=true;g.drawImage(BK,0,0,bw,bh,x0,y0,x1-x0,y1-y0);
  }else g.drawImage(BC,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);
  g.restore();
  gb.setTransform(1,0,0,1,0,0);gb.clearRect(x0,y0,x1-x0,y1-y0);
}
function drawSunburst(g,it,tt,W,H,C){
  const o=val(it,'opacity',tt);if(o<=0.002)return;
  const sc=val(it,'scale',tt),rot=(val(it,'rz',tt)+val(it,'speed',tt)*tt-C.rz)*D,n=Math.max(2,it.beams|0),R=Math.hypot(W,H)*.75*sc,st=14;
  g.save();g.translate(W/2,H/2);g.rotate(rot);g.globalAlpha=clamp(o,0,1);
  const gr=g.createRadialGradient(0,0,0,0,0,R);gr.addColorStop(0,'rgba(40,40,48,.9)');gr.addColorStop(.35,'rgba(150,148,160,.85)');gr.addColorStop(1,'rgba(235,232,240,.9)');g.fillStyle=gr;
  for(let i=0;i<n;i++){
    const a0=i*2*Math.PI/n,a1=a0+Math.PI/n*.7;g.beginPath();g.moveTo(0,0);
    for(let j=0;j<=st;j++){const r=R*j/st,a=a0+it.twist*j/st;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
    for(let j=st;j>=0;j--){const r=R*j/st,a=a1+it.twist*j/st;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
    g.closePath();g.fill();
  }
  g.restore();
}
function drawRibbon(g,it,tt,W,H,k){
  const o=val(it,'opacity',tt);if(o<=0.002)return;
  const sp=val(it,'speed',tt),sc=val(it,'scale',tt);
  g.save();g.globalCompositeOperation='lighter';g.globalAlpha=clamp(o,0,1);g.lineCap='round';g.lineJoin='round';
  for(let n=0;n<3;n++){
    const ph=tt*sp*(.55+n*.23)+n*2.1,P=(a,b)=>[W*(.5+.62*Math.sin(ph*a+n*1.7)),H*(.5+.6*Math.sin(ph*b+n*.9+1))];
    const p0=P(.7,.5),p1=P(.9,1.1),p2=P(1.2,.8),p3=P(.6,1.3);
    [[150,'rgba(30,70,255,.28)'],[60,'rgba(60,120,255,.55)'],[16,'rgba(215,228,255,.95)']].forEach(([w,c])=>{
      g.lineWidth=w*k*sc;g.strokeStyle=c;g.beginPath();g.moveTo(p0[0],p0[1]);g.bezierCurveTo(p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]);g.stroke();
    });
  }
  g.restore();
}
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let r=Math.imul(seed^seed>>>15,1|seed);r=r+Math.imul(r^r>>>7,61|r)^r;return((r^r>>>14)>>>0)/4294967296}}
function drawDust(g,it,tt,W,H,k,C){
  const o=val(it,'opacity',tt);if(o<=0.002)return;
  const sp=val(it,'speed',tt),N=clamp(it.count|0,10,600),Z=3600,F=C.F,r=rng(7);
  g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
  for(let i=0;i<N;i++){
    const x=(r()-.5)*3400,y=(r()-.5)*2200,z0=r()*Z,col=r(),
      zr=(((z0-sp*tt)%Z)+Z)%Z,wz=C.p[2]+F+zr*.9+60;
    const pc=toCam(C,[x+C.p[0],y+C.p[1],wz]);if(pc[2]<F*.1)continue;
    const f=F/pc[2]*k,sx=W/2+pc[0]*f,sy=H/2+pc[1]*f;
    if(sx<-20||sx>W+20||sy<-20||sy>H+20)continue;
    const fade=clamp(1-zr/Z,0,1)*clamp(zr/150,0,1);
    g.globalAlpha=clamp(o*fade*(.35+.65*r()),0,1);
    g.strokeStyle=col<.12?'#ff4d4d':col<.35?'#7fb2ff':'#fff';
    g.lineWidth=Math.max(1,2.4*f);
    const tail=clamp(Math.abs(sp)*.025,0,120)*f*.35,dx=(sx-W/2),dy=(sy-H/2),l=Math.hypot(dx,dy)||1;
    g.beginPath();g.moveTo(sx,sy);g.lineTo(sx-dx/l*tail*(sp>0?1:-1)*-1,sy-dy/l*tail*(sp>0?1:-1)*-1);g.stroke();
  }
  g.restore();
}
function post(out,fx,tt,W,H,k){
  const g=out.getContext('2d'),sg=SC.getContext('2d');
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const glow=val(fx,'glow',tt),ca=val(fx,'ca',tt),fl=val(fx,'flash',tt);
  if(glow>0.01){
    BL1=fit(BL1,Math.max(8,W>>3),Math.max(8,H>>3));BL2=fit(BL2,Math.max(4,W>>5),Math.max(4,H>>5));
    const b1=BL1.getContext('2d'),b2=BL2.getContext('2d');b1.imageSmoothingEnabled=b2.imageSmoothingEnabled=true;
    b1.drawImage(SC,0,0,BL1.width,BL1.height);b2.drawImage(BL1,0,0,BL2.width,BL2.height);
    sg.save();sg.globalCompositeOperation='lighter';sg.globalAlpha=clamp(glow*.7,0,1);sg.drawImage(BL1,0,0,W,H);
    sg.globalAlpha=clamp(glow*1.0,0,1);sg.drawImage(BL2,0,0,W,H);sg.restore();
  }
  if(ca>0.2){
    TC=fit(TC,W,H);const tg=TC.getContext('2d'),off=ca*k;
    g.fillStyle='#000';g.fillRect(0,0,W,H);g.globalCompositeOperation='lighter';
    [['#f00',-off,-off*.3],['#0f0',0,0],['#00f',off,off*.3]].forEach(([c,dx,dy])=>{
      tg.globalCompositeOperation='copy';tg.drawImage(SC,0,0);tg.globalCompositeOperation='multiply';tg.fillStyle=c;tg.fillRect(0,0,W,H);
      g.drawImage(TC,dx,dy);
    });
    g.globalCompositeOperation='source-over';
  }else g.drawImage(SC,0,0);
  if(fl>0.01){g.fillStyle=`rgba(255,255,255,${clamp(fl,0,1)})`;g.fillRect(0,0,W,H)}
}
let rr=0;
function reqRender(){if(rr||playing)return;rr=requestAnimationFrame(()=>{rr=0;render()})}
function render(){
  if(!S)return;
  const cv=$('s3-cv'),W=cv.width,H=cv.height,k=H/REFH;
  SC=fit(SC,W,H);BC=fit(BC,W,H);
  const g=SC.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.fillStyle='#000';g.fillRect(0,0,W,H);
  const C=camState(t);syncMedia();HIT={};
  const layers=S.items.slice(2).filter(i=>visible(i,t));
  layers.forEach(it=>{
    if(it.kind==='sunburst')drawSunburst(g,it,t,W,H,C);
    else if(it.kind==='ribbon')drawRibbon(g,it,t,W,H,k);
    else if(it.kind==='dust')drawDust(g,it,t,W,H,k,C);
  });
  const l3=layers.filter(i=>IS3D(i.kind)&&i.kind!=='group').map(it=>({it,d:toCam(C,world(it,t).p)[2]})).sort((a,b)=>b.d-a.d);
  l3.forEach(o=>drawLayer(o.it,t,C,k,W,H));
  post(cv,S.items[1],t,W,H,k);
  const tm=$('s3-time');if(document.activeElement!==tm&&!tm._drag)tm.value=t;
  $('s3-tlabel').textContent=`${t.toFixed(2)} / ${S.dur.toFixed(1)} dtk`+((S.cuts&&S.cuts.length)?' · '+activeCam(t).name:'');
  syncProps();
}

/* ===== sinkron media saat play / scrub ===== */
function syncMedia(){
  S.items.forEach(it=>{
    if(it.kind!=='video')return;const m=getMedia(it.mediaId);if(!m||m.kind!=='video')return;const el=m.el;
    if(trackBusy)return;
    if(!visible(it,t)){if(!el.paused)el.pause();return}
    const rel=Math.max(0,t-it.start+(it.trim||0)),r=Math.min(rel,(el.duration||1e9)-.05);
    if(playing){if(el.paused){el.currentTime=r;el.play().catch(()=>{})}else if(Math.abs(el.currentTime-r)>.35)el.currentTime=r}
    else{if(!el.paused)el.pause();if(Math.abs(el.currentTime-r)>.03)el.currentTime=r}
  });
  const mu=S.music&&media.get(S.music);
  if(mu&&mu.kind==='audio'){
    const el=mu.el;
    if(playing){if(el.paused){el.currentTime=Math.min(t,el.duration||1e9);el.play().catch(()=>{})}else if(Math.abs(el.currentTime-t)>.4)el.currentTime=t}
    else if(!el.paused)el.pause();
  }
}

/* ===== pemutar ===== */
let t0=0,onEnd=null;
function play(){if(playing||!S)return;if(t>=S.dur-.01)t=0;playing=true;t0=performance.now()-t*1000;$('s3-play').textContent='❚❚';loop()}
function pause(){playing=false;$('s3-play').textContent='▶';if(S)syncMedia()}
function loop(){
  if(!playing)return;
  t=(performance.now()-t0)/1000;
  if(t>=S.dur){t=S.dur;pause();render();const f=onEnd;onEnd=null;if(f)f();return}
  render();requestAnimationFrame(loop);
}
function setT(v,noRender){t=clamp(v,0,S.dur);if(!noRender)render()}

/* ===== ukuran kanvas ===== */
function sizeCanvas(short){
  const [a,b]=ASPECT[S.aspect]||ASPECT['16:9'],cv=$('s3-cv');
  let w,h;if(a>=b){h=short;w=Math.round(short*a/b)}else{w=short;h=Math.round(short*b/a)}
  w+=w%2;h+=h%2;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
}

/* ===== UI: chip, panel, tick ===== */
const dirty=()=>{dirtyF=true;$('s3-save').textContent='Belum disimpan';clearTimeout(saveT);saveT=setTimeout(save,1200)};
async function save(){
  if(!S)return;clearTimeout(saveT);S.updated=Date.now();
  try{await DB.put('scenes',JSON.parse(JSON.stringify(S)));dirtyF=false;$('s3-save').textContent='Tersimpan'}catch(_){$('s3-save').textContent='Gagal menyimpan'}
}
function label(it){return it.kind==='text'?(String(it.text||'').split('\n')[0].slice(0,14)||'Teks'):(it.name||NAMES[it.kind]).slice(0,16)}
function chips(){
  $('s3-chips').innerHTML=S.items.map(it=>`<button class="s3-chip${it.id===selId?' on':''}" data-sel="${it.id}">${ICON[it.kind]} ${esc(label(it))}</button>`).join('');
  const c=$('s3-chips').querySelector('.on');if(c&&c.scrollIntoView)c.scrollIntoView({block:'nearest',inline:'nearest'});
}
function row(it,p){
  const d=pd(it.kind,p),v=val(it,p,t),has=!!keyAt(it,p,t),an=it.keys[p]&&it.keys[p].length;
  const r=Math.round(v*100)/100;
  return`<div class="s3-f"><div class="s3-lab"><span>${d[0]}</span><span class="s3-kf"><button type="button" data-go="-1" data-p="${p}" title="Keyframe sebelumnya">◀</button><button type="button" class="${has?'on':an?'half':''}" data-kf="${p}" title="Tambah / hapus keyframe di waktu sekarang">◆</button><button type="button" data-go="1" data-p="${p}" title="Keyframe berikutnya">▶</button></span></div>
  <div class="s3-in"><input type="range" data-p="${p}" min="${d[1]}" max="${d[2]}" step="${d[3]}" value="${r}"><input type="number" data-p="${p}" min="${d[1]}" max="${d[2]}" step="${d[3]}" value="${r}"></div></div>`;
}
function props(){
  const it=sel(),sys=it.kind==='camera'||it.kind==='fx';let h='';
  const hint={camera:'Kamera menangkap objek yang dilihat di video. Manual: gerakkan dengan keyframe ◆ (maju = Z naik). Atau pilih objek supaya kamera mengikutinya.',fx:'Efek untuk seluruh layar. Pakai keyframe ◆ untuk hentakan sesuai beat (Kilat putih, Getar).',
    text:'Seret teks di preview untuk memindahkan. Hadap kamera = teks selalu menghadap lensa.',image:'Seret foto di preview untuk memindahkan.',video:'Pilih video ini lalu tekan Lacak titik di atas untuk membuat teks/foto mengikuti objek.',
    group:'Grup kosong: jadikan "Induk" layer lain supaya semuanya ikut bergerak dan berputar bersama (misal orbit).',sunburst:'Latar kipas berputar seperti di video referensi.',ribbon:'Pita cahaya biru.',dust:'Debu / bintang yang melaju melewati kamera.'}[it.kind];
  h+=`<p class="s3-hint">${hint}</p>`;
  if(!sys)h+=`<label class="s3-fl">Nama<input data-f="name" value="${esc(it.name)}" maxlength="40"></label>`;
  if(it.kind==='text'){
    h+=`<label class="s3-fl">Teks (Enter = baris baru)<textarea data-f="text" rows="2">${esc(it.text)}</textarea></label>
    <div class="s3-two"><label class="s3-fl">Warna<input type="color" data-f="color" value="${esc(it.color||'#ffffff')}"></label><label class="s3-fl">Ukuran huruf<input type="number" data-f="size" min="20" max="600" value="${it.size}"></label></div>
    <label class="s3-ck"><input type="checkbox" data-f="glow"${it.glow?' checked':''}> Cahaya di huruf</label>`;
  }
  if(ISMEDIA(it.kind))h+=`<button class="btn" data-act="replace">Ganti ${it.kind==='video'?'video / foto':'foto / video'}</button>`;
  if(it.kind==='sunburst')h+=`<div class="s3-two"><label class="s3-fl">Jumlah sinar<input type="number" data-f="beams" min="2" max="24" value="${it.beams}"></label><label class="s3-fl">Puntiran<input type="number" step="0.1" data-f="twist" min="-4" max="4" value="${it.twist}"></label></div>`;
  if(it.kind==='dust')h+=`<label class="s3-fl">Jumlah partikel<input type="number" data-f="count" min="10" max="600" value="${it.count}"></label>`;
  if(!sys)h+=`<div class="s3-two"><label class="s3-fl">Muncul di detik<input type="number" step="0.1" min="0" data-f="start" value="${it.start}"></label><label class="s3-fl">Durasi (0 = sampai akhir)<input type="number" step="0.1" min="0" data-f="dur" value="${it.dur==null?0:it.dur}"></label></div>`;
  if(IS3D(it.kind)){
    const opts=S.items.filter(o=>IS3D(o.kind)&&o!==it);
    h+=`<label class="s3-fl">Induk (ikut bergerak bersama)<select data-f="parent"><option value="">Tidak ada</option>${opts.map(o=>`<option value="${o.id}"${it.parent===o.id?' selected':''}>${esc(label(o))}</option>`).join('')}</select></label>`;
    if(it.kind!=='group')h+=`<label class="s3-ck"><input type="checkbox" data-f="bill"${it.bill?' checked':''}> Hadap kamera (billboard)</label>`;
    h+=`<label class="s3-fl">Animasi cepat (dipasang di waktu sekarang)<select data-quick><option value="">Pilih animasi…</option><option value="fly">Terbang dari jauh</option><option value="pass">Lewat melewati kamera</option><option value="spin">Putar 3D masuk</option><option value="snap">Hentak miring</option><option value="wobble">Goyang</option></select></label>`;
  }
  h+=`<label class="s3-fl">Kurva untuk keyframe baru<select data-ease>${Object.keys(EASE).map(e=>`<option value="${e}"${e===curEase?' selected':''}>${EASE[e].n}</option>`).join('')}</select></label>`;
  if(it.kind==='camera'){
    const opts=S.items.filter(o=>IS3D(o.kind)&&o.kind!=='group');
    h+=`<label class="s3-fl">Objek yang ditangkap kamera<select data-f="target"><option value="">Manual (atur sendiri)</option>${opts.map(o=>`<option value="${o.id}"${it.target===o.id?' selected':''}>${esc(label(o))}</option>`).join('')}</select></label>`;
    if(it.target)h+=`<label class="s3-fl">Posisi objek di bingkai<select data-frame><option value="">Pilih…</option><option value="0,0">Tengah</option><option value="-0.17,0">Sepertiga kiri</option><option value="0.17,0">Sepertiga kanan</option><option value="0,-0.17">Sepertiga atas</option><option value="0,0.17">Sepertiga bawah</option></select></label>`;
    h+=`<label class="s3-fl">Gaya gerak kamera (dipasang di waktu sekarang)<select data-camquick><option value="">Pilih gaya…</option><option value="zoom">Zoom in pelan (disarankan)</option><option value="orbit">Orbit mengelilingi objek</option><option value="smooth">Ikuti halus</option><option value="lock">Ikuti kaku (objek selalu di tengah)</option></select></label>`;
    if(it.id!=='cam')h+=`<button class="btn" data-act="cut">✂ Potong ke kamera ini di ${t.toFixed(2)} dtk</button>`;
    else h+=`<p class="s3-hint">Tambah kamera lain dengan tombol 🎥+, lalu pilih kamera itu dan tekan Potong untuk berpindah kamera seperti cut film.</p>`;
    const cuts=S.cuts||[];
    if(cuts.length)h+=`<div class="s3-cuts"><b>Potongan kamera</b>${cuts.map((k,i)=>{const o=byId(k.cam);return`<div class="s3-cut"><span>${k.t.toFixed(2)} dtk → ${esc(o?o.name:'?')}</span><button type="button" data-delcut="${i}">✕</button></div>`}).join('')}<small>Sebelum potongan pertama dipakai Kamera utama.</small></div>`;
  }
  let plist=KINDS[it.kind];
  if(it.kind==='camera')plist=plist.filter(p=>it.target?p!=='fd':!CAMT.includes(p));
  h+=plist.map(p=>row(it,p)).join('');
  $('s3-props').innerHTML=h;ticks();
}
function syncProps(){
  const it=sel(),box=$('s3-props');
  box.querySelectorAll('[data-p]').forEach(el=>{
    if(el.tagName==='BUTTON')return;if(document.activeElement===el)return;
    if(!(el.dataset.p in it.props))return;el.value=Math.round(val(it,el.dataset.p,t)*100)/100;
  });
  box.querySelectorAll('[data-kf]').forEach(b=>{const p=b.dataset.kf,an=it.keys[p]&&it.keys[p].length;b.className=keyAt(it,p,t)?'on':an?'half':''});
}
function ticks(){
  const it=sel(),set=new Set();
  Object.values(it.keys).forEach(a=>a.forEach(k=>set.add(Math.round(k.t*100)/100)));
  $('s3-ticks').innerHTML=[...set].map(x=>`<button type="button" style="left:${x/S.dur*100}%" data-tt="${x}" aria-label="Keyframe ${x} detik"></button>`).join('');
}
function select(id){selId=id;chips();props();render()}

/* ===== animasi cepat ===== */
function quick(kind){
  const it=sel(),a=t,d=.8;
  const K=(p,arr)=>arr.forEach(([tt,v,e])=>setKey(it,p,tt,v,e||'inout'));
  if(kind==='fly'){K('z',[[a,1800,'out'],[a+d,it.props.z||0]]);K('opacity',[[a,0,'linear'],[a+d*.45,1]])}
  else if(kind==='pass'){K('z',[[a,it.props.z||0,'in'],[a+d,-1000]]);K('opacity',[[a,1,'linear'],[a+d*.7,1,'linear'],[a+d,0]])}
  else if(kind==='spin'){K('ry',[[a,90,'out'],[a+d,0]]);K('opacity',[[a,0,'linear'],[a+d*.3,1]])}
  else if(kind==='snap'){K('rz',[[a,-14,'back'],[a+d*.6,0]]);K('scale',[[a,1.45,'out'],[a+d*.6,it.props.scale||1]])}
  else if(kind==='wobble'){const b=it.props.rz||0;for(let i=0;i<7;i++)setKey(it,'rz',a+i*.22,b+(i%2?-5:5)*(i<6?1:0),'inout')}
  it.start=Math.min(it.start,a);dirty();props();render();toast('Animasi dipasang di '+a.toFixed(2)+' dtk');
}

function camQuick(kind){
  const c=sel(),a=t,K=(p,arr)=>arr.forEach(([tt,v,e])=>setKey(c,p,tt,v,e||'inout'));
  const cur=p=>val(c,p,a);
  if(kind==='zoom'){if(c.target)K('dist',[[a,cur('dist')],[a+3,cur('dist')*.65]]);else K('z',[[a,cur('z')],[a+3,cur('z')+350]])}
  else if(kind==='orbit'){if(!c.target){toast('Orbit butuh objek: pilih "Objek yang ditangkap kamera" dulu');return}K('az',[[a,cur('az')],[a+4,cur('az')+90]])}
  else if(kind==='smooth'){if(!c.target){toast('Pilih objek yang ditangkap dulu');return}c.props.follow=.55;delete c.keys.follow}
  else if(kind==='lock'){if(!c.target){toast('Pilih objek yang ditangkap dulu');return}c.props.follow=1;delete c.keys.follow}
  dirty();props();render();toast('Gaya kamera dipasang');
}
function addCamera(){
  const n=S.items.filter(i=>i.kind==='camera').length+1,c=mkItem('camera',{name:'Kamera '+n});
  S.items.push(c);selId=c.id;chips();props();render();dirty();toast('Kamera ditambah. Tekan Potong untuk berpindah ke kamera ini.');
}
/* ===== event panel ===== */
function bindUI(){
  const P=$('s3-props');
  P.addEventListener('input',e=>{
    const el=e.target,it=sel(),p=el.dataset.p,f=el.dataset.f;
    if(p){
      let v=parseFloat(el.value);if(!isFinite(v))return;
      if(it.keys[p]&&it.keys[p].length)setKey(it,p,t,v);else it.props[p]=v;
      P.querySelectorAll(`[data-p="${p}"]`).forEach(o=>{if(o!==el&&o.tagName==='INPUT')o.value=v});
      syncProps();ticks();dirty();reqRender();render();return;
    }
    if(f&&el.type!=='checkbox'&&el.tagName!=='SELECT'){fieldSet(it,f,el);}
  });
  P.addEventListener('change',e=>{
    const el=e.target,it=sel(),f=el.dataset.f;
    if(el.dataset.quick!==undefined){if(el.value)quick(el.value);el.value='';return}
    if(el.dataset.camquick!==undefined){if(el.value)camQuick(el.value);el.value='';return}
    if(el.dataset.frame!==undefined){if(el.value){const[a,b]=el.value.split(',').map(Number);['frx','fry'].forEach((p,i)=>{const v=i?b:a;if(it.keys[p]&&it.keys[p].length)setKey(it,p,t,v);else it.props[p]=v});props();dirty();render()}return}
    if(el.dataset.ease!==undefined){curEase=el.value;const ks=Object.values(it.keys).flatMap(a=>a.filter(k=>Math.abs(k.t-t)<.02));ks.forEach(k=>k.e=curEase);dirty();return}
    if(f&&(el.type==='checkbox'||el.tagName==='SELECT'))fieldSet(it,f,el);
  });
  P.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;const it=sel();
    if(b.dataset.kf){const p=b.dataset.kf;if(keyAt(it,p,t))delKey(it,p,t);else setKey(it,p,t,val(it,p,t));syncProps();ticks();dirty();render()}
    else if(b.dataset.go){
      const a=it.keys[b.dataset.p];if(!a||!a.length){toast('Belum ada keyframe. Ketuk ◆ dulu.');return}
      const dir=+b.dataset.go,c=dir>0?a.find(k=>k.t>t+.02):[...a].reverse().find(k=>k.t<t-.02);
      if(c){pause();setT(c.t)}else toast(dir>0?'Tidak ada keyframe berikutnya':'Tidak ada keyframe sebelumnya');
    }
    else if(b.dataset.delcut){S.cuts.splice(+b.dataset.delcut,1);props();dirty();render()}
    else if(b.dataset.act==='cut'){S.cuts=(S.cuts||[]).filter(k=>Math.abs(k.t-t)>.02);S.cuts.push({t:Math.round(t*100)/100,cam:it.id});S.cuts.sort((a,c)=>a.t-c.t);props();dirty();render();toast('Potong ke '+it.name+' di '+t.toFixed(2)+' dtk')}
    else if(b.dataset.act==='replace'){replaceMode=true;$('s3-file').accept='image/*,video/*';$('s3-file').multiple=false;$('s3-file').click()}
  });
  $('s3-ticks').onclick=e=>{const b=e.target.closest('[data-tt]');if(b){pause();setT(+b.dataset.tt)}};
  $('s3-chips').onclick=e=>{const b=e.target.closest('[data-sel]');if(b)select(b.dataset.sel)};
  const tm=$('s3-time');
  tm.oninput=()=>{pause();tm._drag=true;setT(parseFloat(tm.value))};
  tm.onchange=()=>{tm._drag=false};
  $('s3-play').onclick=()=>playing?pause():play();
  $('s3-stop').onclick=()=>{pause();setT(0)};
  $('s3-aspect').onchange=e=>{S.aspect=e.target.value;sizeCanvas(previewShort());dirty();render()};
  $('s3-dur').onchange=e=>{S.dur=clamp(parseFloat(e.target.value)||10,1,300);tm.max=S.dur;if(t>S.dur)t=S.dur;ticks();dirty();render()};
  $('s3-name').oninput=e=>{S.name=e.target.value;dirty()};
  $('s3-back').onclick=async()=>{pause();await save();closeScene()};
  $('s3-savebtn').onclick=async()=>{await save();toast('Project 3D disimpan')};
  /* toolbar tambah */
  $('s3-add-text').onclick=()=>{const it=mkItem('text',{start:t,text:'TEKS'});it.props.z=0;add(it)};
  $('s3-add-media').onclick=()=>{replaceMode=false;$('s3-file').accept='image/*,video/*';$('s3-file').multiple=true;$('s3-file').click()};
  $('s3-add-cam').onclick=addCamera;
  $('s3-add-group').onclick=()=>add(mkItem('group'));
  $('s3-add-bg').onchange=e=>{const k=e.target.value;e.target.value='';if(!k)return;const it=mkItem(k,{start:0});
    if(k==='sunburst')it.props.opacity=.9;add(it)};
  $('s3-music').onclick=()=>$('s3-file-audio').click();
  $('s3-dup').onclick=()=>{const it=sel();if(it.id==='cam'||it.id==='fx')return toast('Kamera utama dan Efek tidak bisa diduplikat');
    const c=JSON.parse(JSON.stringify(it));c.id='i'+rid();c.name=it.name+' 2';c.props.x=(c.props.x||0)+40;c.props.y=(c.props.y||0)+40;add(c)};
  $('s3-del').onclick=()=>{const it=sel();if(it.id==='cam'||it.id==='fx')return toast('Kamera utama dan Efek tidak bisa dihapus');
    S.items=S.items.filter(i=>i!==it);S.cuts=(S.cuts||[]).filter(k=>k.cam!==it.id);S.items.forEach(i=>{if(i.parent===it.id)i.parent=null});texPool.delete(it.id);select('cam');dirty()};
  $('s3-up').onclick=()=>{const it=sel(),i=S.items.indexOf(it);if(i>2){[S.items[i-1],S.items[i]]=[S.items[i],S.items[i-1]];chips();dirty();render()}};
  $('s3-file').onchange=async e=>{
    const files=[...e.target.files];e.target.value='';if(!files.length)return;
    try{
      for(const f of files){
        const {id,m}=await addFile(f);
        if(replaceMode){const it=sel();if(ISMEDIA(it.kind)){it.mediaId=id;it.kind=m.kind==='video'?'video':'image';it.name=f.name.slice(0,18);if(it.kind==='video'&&it.dur==null)it.dur=m.el.duration||null;select(it.id);dirty()}}
        else{
          const it=mkItem(m.kind==='video'?'video':'image',{mediaId:id,name:f.name.slice(0,18),start:t});
          if(m.kind==='video'&&isFinite(m.el.duration)){it.dur=Math.round(m.el.duration*100)/100;if(t+it.dur>S.dur){S.dur=Math.ceil(t+it.dur);$('s3-dur').value=S.dur;$('s3-time').max=S.dur}}
          add(it);
        }
      }
    }catch(err){toast('Gagal membuka file')}
  };
  $('s3-file-audio').onchange=async e=>{
    const f=e.target.files[0];e.target.value='';if(!f)return;
    try{const {id,m}=await addFile(f);if(m.kind!=='audio'){toast('Pilih file audio (MP3/WAV)');return}
      S.music=id;if(m.el.duration>S.dur&&isFinite(m.el.duration)){S.dur=Math.ceil(Math.min(m.el.duration,300));$('s3-dur').value=S.dur;$('s3-time').max=S.dur}
      $('s3-music').textContent='♪ '+f.name.slice(0,10);dirty();toast('Musik dipasang')}catch(_){toast('Gagal membuka audio')}
  };
  /* seret objek di preview */
  const cv=$('s3-cv');let drag=null;
  const pos=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
  const inPoly=(p,q)=>{let c=false;for(let i=0,j=3;i<4;j=i++){if(((q[i][1]>p[1])!==(q[j][1]>p[1]))&&(p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0]))c=!c}return c};
  cv.addEventListener('pointerdown',e=>{
    if(!S)return;pause();const p=pos(e);
    const order=S.items.slice(2).filter(i=>HIT[i.id]).map(it=>({it,d:toCam(camState(t),world(it,t).p)[2]})).sort((a,b)=>a.d-b.d);
    let hit=null;for(const o of order){if(inPoly(p,HIT[o.it.id])){hit=o.it;break}}
    if(hit&&hit.id!==selId)select(hit.id);
    const it=sel();
    if(!hit&&it.kind!=='camera'){return}
    cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,it,sx:cv.width/cv.getBoundingClientRect().width};
  });
  cv.addEventListener('pointermove',e=>{
    if(!drag)return;const it=drag.it,C=camState(t),k=cv.height/REFH;
    const dx=(e.clientX-drag.x)*drag.sx/k,dy=(e.clientY-drag.y)*drag.sx/k;drag.x=e.clientX;drag.y=e.clientY;
    let f=1;if(it.kind!=='camera'){const d=toCam(C,world(it,t).p)[2];f=d/C.F}
    const sg=it.kind==='camera'?-1:1;
    ['x','y'].forEach((p,i)=>{
      const v=val(it,p,t)+sg*(i?dy:dx)*f;
      if(it.keys[p]&&it.keys[p].length)setKey(it,p,t,v);else it.props[p]=v;
    });
    syncProps();dirty();render();
  });
  const end=()=>{drag=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  /* tracker, export */
  $('s3-track').onclick=openTracker;
  $('s3-export').onclick=()=>{pause();$('s3-ex-set').hidden=false;$('s3-ex-prog').hidden=true;$('s3-dlg-ex').showModal()};
  $('s3-ex-start').onclick=doExport;
  $('s3-ex-cancel').onclick=()=>{exportCancel=true};
  $('s3-tk-canvas').addEventListener('pointerdown',tkPick);
  $('s3-tk-start').onclick=runTrack;
  $('s3-tk-apply').onclick=applyTrack;
  $('s3-tk-close').onclick=()=>{tkAbort=true;$('s3-dlg-tk').close()};
  addEventListener('resize',()=>{if(S&&!exporting)reqRender()});
  addEventListener('keydown',e=>{
    if($('s3d').hidden||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
    if(e.code==='Space'){e.preventDefault();playing?pause():play()}
  });
}
let replaceMode=false;
function add(it){S.items.push(it);selId=it.id;chips();props();render();dirty()}
function fieldSet(it,f,el){
  let v=el.type==='checkbox'?el.checked:el.value;
  if(['size','beams','count'].includes(f))v=parseFloat(v)||0;
  if(['twist'].includes(f))v=parseFloat(v)||0;
  if(f==='start')v=Math.max(0,parseFloat(v)||0);
  if(f==='dur'){v=parseFloat(v)||0;v=v>0?v:null}
  if(f==='parent'||f==='target')v=v||null;
  it[f]=v;
  if(f==='text'||f==='name')chips();
  if(f==='target'){props()}
  if(f==='parent'&&v){const L=world(it,t);/* tidak melompat: biarkan posisi lokal apa adanya */}
  dirty();render();
}
function previewShort(){return matchMedia('(max-width:700px)').matches?480:600}

/* ===== TRACKER TITIK ===== */
let tkPt=null,tkPath=null,tkAbort=false,trackBusy=false;
function seek(el,tt){
  return new Promise(r=>{
    if(Math.abs(el.currentTime-tt)<.001){r();return}
    let done=false;const f=()=>{if(done)return;done=true;el.removeEventListener('seeked',f);r()};
    el.addEventListener('seeked',f);el.currentTime=tt;setTimeout(f,1500);
  });
}
async function openTracker(){
  const it=sel();
  if(it.kind!=='video'){toast('Pilih layer VIDEO dulu (ketuk chip video), lalu Lacak titik.');return}
  const m=getMedia(it.mediaId);if(!m||m.kind!=='video'){toast('Video belum termuat');return}
  pause();tkPt=null;tkPath=null;tkAbort=false;
  const tg=S.items.slice(2).filter(o=>IS3D(o.kind)&&o!==it&&o.kind!=='group');
  $('s3-tk-target').innerHTML=tg.length?tg.map(o=>`<option value="${o.id}">${esc(label(o))}</option>`).join(''):'<option value="">(tambah teks / foto dulu)</option>';
  $('s3-tk-msg').textContent='Ketuk titik/objek di video yang mau diikuti (pilih bagian yang kontras: sudut, tanda, wajah).';
  $('s3-tk-apply').disabled=true;$('s3-tk-start').disabled=true;$('s3-tk-bar').style.width='0';
  $('s3-dlg-tk').showModal();
  await seek(m.el,Math.max(0,t-it.start+(it.trim||0)));tkFrame(m);
}
function tkFrame(m){
  const c=$('s3-tk-canvas'),w=Math.min(420,m.w),h=Math.round(w*m.h/m.w);c.width=w;c.height=h;
  const g=c.getContext('2d');try{g.drawImage(m.el,0,0,w,h)}catch(_){}
  if(tkPath){g.strokeStyle='#7fff9a';g.lineWidth=2;g.beginPath();tkPath.forEach((p,i)=>{const x=p.u*w,y=p.v*h;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()}
  if(tkPt){const x=tkPt.u*w,y=tkPt.v*h;g.strokeStyle='#ff4d6d';g.lineWidth=2;g.strokeRect(x-9,y-9,18,18);g.beginPath();g.moveTo(x-16,y);g.lineTo(x+16,y);g.moveTo(x,y-16);g.lineTo(x,y+16);g.stroke()}
}
function tkPick(e){
  const c=$('s3-tk-canvas'),r=c.getBoundingClientRect();
  tkPt={u:clamp((e.clientX-r.left)/r.width,.02,.98),v:clamp((e.clientY-r.top)/r.height,.02,.98)};tkPath=null;
  tkFrame(getMedia(sel().mediaId));$('s3-tk-start').disabled=false;$('s3-tk-apply').disabled=true;$('s3-tk-msg').textContent='Titik dipilih. Tekan Mulai lacak.';
}
async function runTrack(){
  const it=sel(),m=getMedia(it.mediaId);if(!tkPt||!m)return;
  const el=m.el,TW=240,TH=Math.round(TW*m.h/m.w),c=document.createElement('canvas');c.width=TW;c.height=TH;
  const g=c.getContext('2d',{willReadFrequently:true});
  const gray=()=>{g.drawImage(el,0,0,TW,TH);const d=g.getImageData(0,0,TW,TH).data,a=new Uint8Array(TW*TH);for(let i=0,j=0;i<a.length;i++,j+=4)a[i]=(d[j]*77+d[j+1]*150+d[j+2]*29)>>8;return a};
  const HALF=8,PS=HALF*2+1,SR=18,STEP=.05;
  const t0s=t,tEnd=Math.min(S.dur,it.dur==null?S.dur:it.start+it.dur,t0s+20);
  tkAbort=false;trackBusy=true;$('s3-tk-start').disabled=true;$('s3-tk-apply').disabled=true;
  const vt=ts=>Math.max(0,ts-it.start+(it.trim||0));
  try{
    await seek(el,vt(t0s));let img=gray(),px=tkPt.u*TW,py=tkPt.v*TH;
    px=clamp(px,HALF+1,TW-HALF-2);py=clamp(py,HALF+1,TH-HALF-2);
    const tpl=new Float32Array(PS*PS);
    const grab=(a,cx,cy,w)=>{for(let y=0;y<PS;y++)for(let x=0;x<PS;x++){const v=a[(cy-HALF+y)*TW+(cx-HALF+x)];tpl[y*PS+x]=w==null?v:tpl[y*PS+x]*(1-w)+v*w}};
    grab(img,Math.round(px),Math.round(py));
    const path=[{t:t0s,u:px/TW,v:py/TH}];let lost=0,vx=0,vy=0;
    const n=Math.floor((tEnd-t0s)/STEP);
    for(let i=1;i<=n&&!tkAbort;i++){
      const ts=t0s+i*STEP;await seek(el,vt(ts));img=gray();
      const cx=Math.round(px+vx),cy=Math.round(py+vy);let best=1e18,bx=cx,by=cy,bs=1e18;
      for(let dy=-SR;dy<=SR;dy++){const yy=cy+dy;if(yy-HALF<0||yy+HALF>=TH)continue;
        for(let dx=-SR;dx<=SR;dx++){const xx=cx+dx;if(xx-HALF<0||xx+HALF>=TW)continue;
          let s=0;
          for(let y=0;y<PS&&s<bs;y++){const o=(yy-HALF+y)*TW+xx-HALF,q=y*PS;for(let x=0;x<PS;x++)s+=Math.abs(img[o+x]-tpl[q+x])}
          const sc=s+(dx*dx+dy*dy)*1.5;if(sc<bs){bs=sc;best=s;bx=xx;by=yy}}}
      const avg=best/(PS*PS);
      if(avg<38){vx=(bx-px)*.6+vx*.4;vy=(by-py)*.6+vy*.4;px=bx;py=by;grab(img,bx,by,.12);lost=0}else{lost++;vx*=.5;vy*=.5}
      path.push({t:ts,u:px/TW,v:py/TH});
      if(i%4===0){$('s3-tk-bar').style.width=(i/n*100)+'%';$('s3-tk-msg').textContent=`Melacak… ${Math.round(i/n*100)}%`}
    }
    /* haluskan 3 titik */
    const sm=path.map((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];return{t:p.t,u:(a.u+p.u+b.u)/3,v:(a.v+p.v+b.v)/3}});
    tkPath=sm;$('s3-tk-bar').style.width='100%';
    $('s3-tk-msg').textContent=tkAbort?'Dibatalkan.':`Selesai: ${sm.length} titik${lost>6?'. Titik sempat hilang (objek tertutup / blur); coba titik lain yang lebih kontras.':'. Pilih layer lalu tekan Terapkan.'}`;
    $('s3-tk-apply').disabled=!tkPath||tkAbort;
  }catch(err){$('s3-tk-msg').textContent='Gagal melacak: '+(err&&err.message||err)}
  finally{trackBusy=false;$('s3-tk-start').disabled=false;tkFrame(m);}
}
function applyTrack(){
  const vid=sel(),tg=byId($('s3-tk-target').value);
  if(!tg){toast('Tambah teks atau foto dulu untuk ditempel');return}
  if(!tkPath)return;
  const m=getMedia(vid.mediaId),cwv=1000*m.w/m.h,chv=1000;
  tg.parent=null;['x','y','z'].forEach(p=>delete tg.keys[p]);
  tkPath.forEach((p,i)=>{
    if(i%2&&i!==tkPath.length-1)return;
    const W=world(vid,p.t),lx=(p.u-.5)*cwv*W.s,ly=(p.v-.5)*chv*W.s,q=mv(W.R,[lx,ly,0]);
    setKey(tg,'x',p.t,Math.round((W.p[0]+q[0])*10)/10,'linear');
    setKey(tg,'y',p.t,Math.round((W.p[1]+q[1])*10)/10,'linear');
    setKey(tg,'z',p.t,Math.round((W.p[2]+q[2]-2)*10)/10,'linear');
  });
  tg.start=Math.min(tg.start,tkPath[0].t);
  $('s3-dlg-tk').close();select(tg.id);setT(tkPath[0].t);dirty();toast('Tracking diterapkan: layer akan mengikuti titik');
}

/* ===== EXPORT (rekam kanvas real-time) ===== */
let exporting=false,exportCancel=false;
async function doExport(){
  if(exporting)return;
  if(!window.MediaRecorder||!$('s3-cv').captureStream){toast('Browser ini belum mendukung export video');return}
  exporting=true;exportCancel=false;
  $('s3-ex-set').hidden=true;$('s3-ex-prog').hidden=false;$('s3-ex-fill').style.width='0';$('s3-ex-status').textContent='Merekam… biarkan tab terbuka.';
  const cv=$('s3-cv'),short=+$('s3-ex-res').value,fps=+$('s3-ex-fps').value;
  sizeCanvas(short);t=0;render();
  const stream=cv.captureStream(fps);let actx=null;
  const mu=S.music&&media.get(S.music);
  if(mu&&mu.kind==='audio'){
    try{
      actx=new (window.AudioContext||window.webkitAudioContext)();
      if(!mu.node){mu.node=actx.createMediaElementSource(mu.el)}
      const dest=actx.createMediaStreamDestination();mu.node.connect(dest);mu.node.connect(actx.destination);
      dest.stream.getAudioTracks().forEach(tr=>stream.addTrack(tr));
    }catch(_){}
  }
  const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  const mime=types.find(x=>MediaRecorder.isTypeSupported(x))||'';
  let rec;try{rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:short>=1080?14e6:8e6})}catch(_){rec=new MediaRecorder(stream)}
  const chunks=[];rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
  const done=new Promise(r=>rec.onstop=r);
  rec.start(250);
  const prog=setInterval(()=>{$('s3-ex-fill').style.width=(t/S.dur*100)+'%';if(exportCancel){onEnd=null;pause();render()}},200);
  await new Promise(r=>{onEnd=r;play();const w=setInterval(()=>{if(exportCancel||!playing){clearInterval(w);r()}},150)});
  clearInterval(prog);
  await new Promise(r=>setTimeout(r,300));rec.stop();await done;
  stream.getTracks().forEach(tr=>tr.stop());if(actx){try{actx.close()}catch(_){};if(mu)mu.node=null}
  exporting=false;sizeCanvas(previewShort());t=0;render();
  if(exportCancel){$('s3-dlg-ex').close();toast('Export dibatalkan');return}
  const type=(rec.mimeType||mime||'video/webm').split(';')[0],ext=type.includes('mp4')?'mp4':'webm';
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(chunks,{type}));a.download=(S.name||'edit3d')+'.'+ext;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  $('s3-ex-status').textContent='Selesai. File sudah diunduh.';$('s3-ex-fill').style.width='100%';
  setTimeout(()=>{try{$('s3-dlg-ex').close()}catch(_){}},1200);
}

/* ===== CONTOH REFERENSI ===== */
const K=(it,p,arr)=>{it.keys[p]=arr.map(([tt,v,e])=>({t:tt,v,e:e||'inout'}));return it};
const TPL=[
 {id:'lirik',name:'Lirik 3D Warp',desc:'Seperti video referensimu: kata-kata terbang menembus kamera, latar kipas hitam-putih berputar, pita biru, debu bintang, pisah warna, getar & kilat.',
  build(){
   const s=newScene({name:'Lirik 3D Warp',aspect:'16:9',dur:12.2}),[cam,fx]=s.items;
   K(cam,'z',[[0,0],[12,700]]);K(cam,'rz',[[0,0],[1.5,5],[3,-5],[4.5,4],[6,-5],[7.5,5],[9,-4],[12,0]]);K(cam,'ry',[[0,-4],[6,5],[12,-3]]);
   fx.props.ca=6;fx.props.glow=.3;fx.props.shake=.12;
   K(fx,'flash',[[0,0],[1.3,0],[1.34,.5],[1.7,0],[4.1,0],[4.14,.5],[4.5,0],[7,0],[7.04,.5],[7.4,0],[9.8,0],[9.84,.5],[10.2,0]],'out');
   const sb=mkItem('sunburst',{name:'Latar kipas'});sb.props.opacity=.9;
   const rb=mkItem('ribbon',{name:'Pita biru'});rb.props.opacity=.9;
   const du=mkItem('dust',{name:'Debu bintang'});
   s.items.push(sb,rb,du);
   const W=['FELT IT','BETTER','PARADISE','MAKE THE','COMING','ABOUT THIS','LIFE','WE GO'],
     X=[-260,180,-120,240,-200,120,-60,200],Y=[-60,80,-110,60,100,-90,40,-30],R=[-8,6,-4,9,-10,5,-6,8];
   W.forEach((w,i)=>{
     const st=.3+i*1.45,it=mkItem('text',{text:w,name:w,start:st,dur:1.75,size:i%3===0?250:200});
     it.props.x=X[i];it.props.y=Y[i];it.props.rz=R[i];
     K(it,'z',[[st,2300,'out'],[st+.8,0],[st+1.7,-800,'in']]);
     K(it,'ry',[[st,55,'out'],[st+.8,-6],[st+1.7,-35,'in']]);
     K(it,'opacity',[[st,0,'linear'],[st+.15,1,'linear'],[st+1.4,1,'linear'],[st+1.7,0,'linear']]);
     s.items.push(it);
   });
   return s;
  }},
 {id:'terowongan',name:'Foto Terowongan 3D',desc:'6 foto berjajar di kedalaman, kamera terbang menembus satu per satu sambil miring. Ganti foto dengan fotomu.',
  build(){
   const s=newScene({name:'Foto Terowongan 3D',aspect:'9:16',dur:10}),[cam,fx]=s.items;
   K(cam,'z',[[0,0],[10,4700]]);K(cam,'rz',[[0,0],[2.5,6],[5,-6],[7.5,5],[10,0]]);
   fx.props.ca=4;fx.props.glow=.35;fx.props.shake=.06;
   const du=mkItem('dust');du.props.speed=900;s.items.push(du);
   for(let i=0;i<6;i++){
     const it=mkItem('image',{mediaId:'ph'+(i+1),name:'Foto '+(i+1)});
     it.props.z=500+i*750;it.props.x=(i%2?1:-1)*150;it.props.y=[-80,60,-40,90,-70,30][i];it.props.ry=(i%2?-1:1)*26;it.props.rz=[-4,5,-3,4,-5,3][i];
     s.items.push(it);
   }
   return s;
  }},
 {id:'orbit',name:'Kartu Foto Orbit',desc:'5 foto mengelilingi pusat (pakai Grup sebagai induk), berputar 360° dengan kamera maju pelan dan cahaya.',
  build(){
   const s=newScene({name:'Kartu Foto Orbit',aspect:'9:16',dur:10}),[cam,fx]=s.items;
   K(cam,'z',[[0,0],[10,200]]);fx.props.glow=.4;fx.props.ca=2.5;
   const sb=mkItem('sunburst');sb.props.opacity=.22;const du=mkItem('dust');du.props.speed=250;du.props.opacity=.8;s.items.push(sb,du);
   const gr=mkItem('group',{name:'Pusat orbit'});gr.props.z=950;gr.props.rx=8;K(gr,'ry',[[0,0],[10,360,'linear']]);s.items.push(gr);
   for(let i=0;i<5;i++){
     const a=i*72,it=mkItem('image',{mediaId:'ph'+(i+1),name:'Foto '+(i+1),parent:gr.id});
     it.props.x=Math.round(520*Math.sin(a*D));it.props.z=Math.round(520*Math.cos(a*D));it.props.ry=a+180;it.props.scale=.8;s.items.push(it);
   }
   return s;
  }},
 {id:'tracking',name:'Tracking: teks mengikuti objek',desc:'Mulai dari awal: import videomu, pilih video, tekan "Lacak titik", ketuk objek, lalu tempel ke teks supaya teks menempel mengikuti objek.',
  build(){
   const s=newScene({name:'Tracking teks',aspect:'9:16',dur:8}),[,fx]=s.items;fx.props.glow=.15;
   const tx=mkItem('text',{text:'IKUTI AKU',name:'Teks pelacak',size:130});s.items.push(tx);s.hint='Langkah: 1) tombol 🖼 Foto/Video → pilih videomu. 2) Ketuk chip video. 3) Tekan ◎ Lacak titik.';
   return s;
  }},
 {id:'kosong',name:'Kosong',desc:'Ruang 3D kosong dengan kamera dan efek. Tambah teks, foto, video sendiri.',build(){return newScene({name:'Project 3D',aspect:'16:9',dur:10})}}
];

/* ===== buka / tutup / beranda ===== */
async function openScene(sc,hint){
  pause();S=sc;if(!S.items||S.items.length<2||S.items[0].kind!=='camera')S=newScene({name:S.name});
  S.items.forEach(i=>{i.keys=i.keys||{};i.props=i.props||{}});
  texPool.clear();selId='cam';t=0;
  $('home').hidden=true;$('s3d').hidden=false;
  $('s3-name').value=S.name;$('s3-aspect').value=S.aspect;$('s3-dur').value=S.dur;$('s3-time').max=S.dur;
  $('s3-music').textContent=S.music?'♪ musik':'♪ Musik';
  sizeCanvas(previewShort());
  await ensureMedia();
  chips();props();render();
  if(sc.hint||hint)toast(sc.hint||hint);
  dirty();
}
function closeScene(){
  S=null;pause();$('s3d').hidden=true;$('home').hidden=false;
  if(APK.app&&APK.app.renderHome)APK.app.renderHome();renderHome3d();
}
async function renderHome3d(){
  const box=$('s3d-list'),h=$('s3d-h');let all=[];
  try{all=((await DB.all('scenes'))||[]).sort((a,b)=>b.updated-a.updated)}catch(_){}
  h.hidden=box.hidden=!all.length;
  box.innerHTML=all.map(p=>`<div class="card" data-s3="${p.id}"><div class="thumb"><i style="width:80%;height:80%;border-color:#4b5bd6">3D · ${esc(p.aspect)}</i></div>
    <div class="card-body"><b>${esc(p.name)}</b><small>${p.items.length-2} layer · ${p.dur} dtk</small>
    <div class="card-foot"><small>Diedit ${new Date(p.updated).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</small><button class="btn danger" data-s3del="${p.id}">Hapus</button></div></div></div>`).join('');
}
function init(){
  if(!$('s3d'))return;
  $('s3-dlg-list').innerHTML=TPL.map(x=>`<button type="button" class="s3-tpl" data-tpl="${x.id}"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></button>`).join('');
  $('btn-3d').onclick=()=>$('s3-dlg-new').showModal();
  $('s3-dlg-list').onclick=async e=>{
    const b=e.target.closest('[data-tpl]');if(!b)return;
    const tp=TPL.find(x=>x.id===b.dataset.tpl),sc=tp.build();$('s3-dlg-new').close();
    await DB.put('scenes',JSON.parse(JSON.stringify(sc)));await openScene(sc);
  };
  $('s3-new-close').onclick=()=>$('s3-dlg-new').close();
  $('s3d-list').onclick=async e=>{
    const del=e.target.closest('[data-s3del]'),card=e.target.closest('[data-s3]');
    if(del){if(confirm('Hapus project 3D ini? Tidak bisa dibatalkan.')){await DB.del('scenes',del.dataset.s3del);renderHome3d()}return}
    if(card){const sc=await DB.get('scenes',card.dataset.s3);if(sc)openScene(sc)}
  };
  $('s3-aspect').innerHTML=Object.keys(ASPECT).map(a=>`<option>${a}</option>`).join('');
  bindUI();renderHome3d();
}
init();
return{TPL,world,val,get scene(){return S},render,openScene,_setT:v=>{setT(v)},select,applyQuick:quick};
})();
