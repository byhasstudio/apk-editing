/* GIZMO KAMERA FISIK untuk Edit 3D (add-on, dimuat setelah js/s3cam.js; butuh 1 baris ekspor di akhir s3cam.js: APK.s3cam).
   - Tombol "✥ Gizmo" melayang di pojok kanan atas viewport (hanya tampil di mode Ruang 3D / 2 Tampilan).
   - Mode GESER: 3 panah dua arah (merah X, hijau Y, biru Z), kepala panah di kedua ujung dan huruf sumbu. Seret panah = kamera bergeser sepanjang sumbu itu.
   - Mode PUTAR: 3 cincin besar. Seret cincin = kamera berputar mengelilingi sumbu itu.
   - Ruang: GLOBAL (sumbu dunia) atau LOKAL (sumbu kamera sendiri).
   Hasilnya ditulis lewat put() milik s3cam.js (x, y, z, rx, ry, rz), jadi otomatis jadi keyframe kalau properti itu beranimasi,
   ikut undo/redo, simpan otomatis, preview, dan export. Digambar di kanvas overlay sendiri, s3cam.js tidak digambar ulang. */
(function(){
'use strict';
const S=window.APK&&APK.s3cam;
if(!S){console.warn('s3gizmo.js: APK.s3cam tidak ada. Tambahkan baris ekspor di akhir js/s3cam.js.');return}
const $=id=>document.getElementById(id),D=Math.PI/180;
const {V,gv,put,touch,selId,curT,byId,isCam,aspect,camPose,obsState,mkProj,rotM,mul,mv,eulerOf,col,add,sub,scl,norm}=S;
const r2=v=>Math.round(v*100)/100;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const tr=M=>[M[0],M[3],M[6],M[1],M[4],M[7],M[2],M[5],M[8]];
const COL=['#ff4d4d','#3ddc5b','#4d8dff'],HOT='#ffd166',NAME=['x','y','z'],LBL=['X','Y','Z'];
const ARROW=1.25;   /* panjang panah (kali U) dari titik tengah ke tiap ujung */
const RING=1.8;     /* jari-jari cincin putar (kali U) */
const st={on:false,mode:'move',space:'global',hover:null,drag:null};

/* dunia editor: x kanan, y BAWAH, z maju. Panah "atas" = -y supaya tampil seperti gizmo biasa */
function axesOf(pose){
  if(st.space==='local'){const R=pose.R;return[col(R,0),scl(col(R,1),-1),col(R,2)]}
  return[[1,0,0],[0,-1,0],[0,0,1]];
}
function ctx(){
  const lv=S.lv,it=byId(selId());
  if(!lv||!isCam(it)||!lv.width)return null;
  const W=lv.width,H=lv.height,tt=curT(),pose=camPose(it,tt,aspect()),O=obsState(),P=mkProj(O,W,H),o=pose.p,zc=P.cs(o)[2];
  if(zc<30)return null;
  return{it,W,H,tt,pose,O,P,o,zc,U:.13*H*zc/(O.F*P.k)};   /* U = satuan gizmo dalam dunia, ±13% tinggi layar */
}
const lpos=e=>{const lv=S.lv,r=lv.getBoundingClientRect();return[(e.clientX-r.left)*lv.width/r.width,(e.clientY-r.top)*lv.height/r.height]};
function distSeg(p,a,b){
  const vx=b[0]-a[0],vy=b[1]-a[1],l=vx*vx+vy*vy;
  let t=l?((p[0]-a[0])*vx+(p[1]-a[1])*vy)/l:0;t=Math.max(0,Math.min(1,t));
  return Math.hypot(p[0]-a[0]-vx*t,p[1]-a[1]-vy*t);
}
function basisOf(n){const h=Math.abs(n[1])<.9?[0,1,0]:[1,0,0],u=norm(cross(n,h)),v=cross(n,u);return[u,v]}   /* u x v = n */
function ringPts(c,n){
  const[u,v]=basisOf(n),r=c.U*RING,pts=[];
  for(let i=0;i<=96;i++){const t=i/96*Math.PI*2;pts.push(add(c.o,add(scl(u,Math.cos(t)*r),scl(v,Math.sin(t)*r))))}
  return pts;
}
/* panah dua arah: ujung negatif (pn) dan positif (p1) di layar, dengan puncak kepala panah di luar masing-masing ujung */
function arrowEnds(c,a){
  const L=c.U*ARROW,p0=c.P.pt(c.o),p1=c.P.pt(add(c.o,scl(a,L)));if(!p0||!p1)return null;
  const pn=c.P.pt(add(c.o,scl(a,-L)))||[2*p0[0]-p1[0],2*p0[1]-p1[1]];   /* ujung di belakang kamera pengamat: cerminkan */
  const dx=p1[0]-p0[0],dy=p1[1]-p0[1],l=Math.hypot(dx,dy);if(l<6)return null;
  const nx0=pn[0]-p0[0],ny0=pn[1]-p0[1],nl=Math.hypot(nx0,ny0)||1;
  const hs=c.H*.045,ux=dx/l,uy=dy/l,nx=nx0/nl,ny=ny0/nl;
  return{pn,p1,ux,uy,nx,ny,hs,
    apex:[p1[0]+ux*hs*1.6,p1[1]+uy*hs*1.6],
    apexN:[pn[0]+nx*hs*1.6,pn[1]+ny*hs*1.6]};
}

/* ===== gambar ===== */
let cv=null,box=null;
function head(g,bx,by,ax,ay,dx,dy,hs){   /* kepala panah: dasar di (bx,by), puncak di (ax,ay), arah (dx,dy) */
  const w=hs*.6;
  g.beginPath();g.moveTo(ax,ay);g.lineTo(bx-dy*w,by+dx*w);g.lineTo(bx+dy*w,by-dx*w);g.closePath();g.fill();
}
function drawGizmo(g,c){
  const axes=axesOf(c.pose),hv=st.drag?{k:st.drag.k,i:st.drag.i}:st.hover;
  g.lineCap='round';g.lineJoin='round';
  axes.forEach((a,i)=>{
    const hot=hv&&hv.k===st.mode&&hv.i===i,cl=hot?HOT:COL[i];
    g.strokeStyle=cl;g.fillStyle=cl;
    if(st.mode==='move'){
      g.lineWidth=hot?7:5;
      const e=arrowEnds(c,a);if(!e)return;
      g.beginPath();g.moveTo(e.pn[0],e.pn[1]);g.lineTo(e.p1[0],e.p1[1]);g.stroke();
      head(g,e.p1[0],e.p1[1],e.apex[0],e.apex[1],e.ux,e.uy,e.hs);      /* ujung + */
      head(g,e.pn[0],e.pn[1],e.apexN[0],e.apexN[1],e.nx,e.ny,e.hs);    /* ujung - */
      g.font='700 '+Math.round(c.H*.036)+'px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
      g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.65)';
      const lx=e.apex[0]+e.ux*c.H*.03,ly=e.apex[1]+e.uy*c.H*.03;
      g.strokeText(LBL[i],lx,ly);g.fillText(LBL[i],lx,ly);
    }else{
      g.lineWidth=hot?7:5;
      const pp=ringPts(c,a).map(p=>c.P.pt(p));
      g.beginPath();let pen=false;
      pp.forEach(p=>{if(!p){pen=false;return}if(pen)g.lineTo(p[0],p[1]);else{g.moveTo(p[0],p[1]);pen=true}});
      g.stroke();
    }
  });
  const o2=c.P.pt(c.o);
  if(o2){g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(o2[0],o2[1],4,0,7);g.fill()}
}
function draw(){
  const lv=S.lv,root=$('s3d');if(!lv||!cv||!root)return;
  const show=!root.hidden&&V.mode==='3d'&&lv.offsetWidth>0;
  cv.style.display=show?'block':'none';
  box.style.display=show?'flex':'none';
  if(!show)return;
  if(cv.width!==lv.width||cv.height!==lv.height){cv.width=lv.width;cv.height=lv.height}
  cv.style.left=lv.offsetLeft+'px';cv.style.top=lv.offsetTop+'px';cv.style.width=lv.offsetWidth+'px';cv.style.height=lv.offsetHeight+'px';
  const g=cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,cv.width,cv.height);
  if(!st.on)return;
  const c=ctx();if(c)drawGizmo(g,c);
}

/* ===== hit test ===== */
function hitTest(c,p){
  const th=Math.max(14,c.H*.035),o2=c.P.pt(c.o);if(!o2)return null;
  if(Math.hypot(p[0]-o2[0],p[1]-o2[1])<th*.9)return null;   /* titik tengah: biarkan s3cam.js (seret kamera bebas) */
  let best=null,bd=th;
  axesOf(c.pose).forEach((a,i)=>{
    let d=1e9;
    if(st.mode==='move'){const e=arrowEnds(c,a);if(e)d=distSeg(p,e.apexN,e.apex)}
    else{const pp=ringPts(c,a).map(q=>c.P.pt(q));for(let j=0;j<pp.length-1;j++)if(pp[j]&&pp[j+1])d=Math.min(d,distSeg(p,pp[j],pp[j+1]))}
    if(d<bd){bd=d;best={k:st.mode,i}}
  });
  return best;
}

/* ===== geser ===== */
function startMove(c,h,p){
  const a=axesOf(c.pose)[h.i],p0=c.P.pt(c.o),p1=c.P.pt(add(c.o,scl(a,c.U)));if(!p0||!p1)return null;
  return{k:'move',i:h.i,a,U:c.U,p:p,s:[p1[0]-p0[0],p1[1]-p0[1]],base:NAME.map(q=>gv(c.it,q,c.tt))};
}
function moveDrag(d,p,it,tt){
  const ss=d.s[0]*d.s[0]+d.s[1]*d.s[1];if(ss<64)return;
  const t=((p[0]-d.p[0])*d.s[0]+(p[1]-d.p[1])*d.s[1])/ss,dv=scl(d.a,d.U*t);
  NAME.forEach((q,i)=>put(it,q,tt,r2(d.base[i]+dv[i])));
}

/* ===== putar ===== */
function rodrigues(n,t){
  const c=Math.cos(t),s=Math.sin(t),k=1-c,x=n[0],y=n[1],z=n[2];
  return[k*x*x+c,k*x*y-s*z,k*x*z+s*y, k*x*y+s*z,k*y*y+c,k*y*z-s*x, k*x*z-s*y,k*y*z+s*x,k*z*z+c];
}
function planeAngle(c,p,n,u,v){   /* sudut pointer pada bidang cincin (sinar dari pengamat ke bidang) */
  const F=c.O.F,k=c.P.k,dir=mv(c.O.R,[(p[0]-c.W/2)/(F*k),(p[1]-c.H/2)/(F*k),1]),den=dot(n,dir);
  if(Math.abs(den)<.04*Math.hypot(dir[0],dir[1],dir[2]))return null;   /* cincin terlihat dari samping */
  const t=dot(n,sub(c.o,c.O.p))/den;if(t<=0)return null;
  const x=sub(add(c.O.p,scl(dir,t)),c.o);
  return Math.atan2(dot(x,v),dot(x,u));
}
function startRot(c,h,p){
  const n=axesOf(c.pose)[h.i],[u,v]=basisOf(n),th=planeAngle(c,p,n,u,v);
  const e0=NAME.slice(0).map(()=>0),rp=[gv(c.it,'rx',c.tt),gv(c.it,'ry',c.tt),gv(c.it,'rz',c.tt)];
  const Rp=rotM(rp[0],rp[1],rp[2]),R0=c.pose.R,B=mul(R0,tr(Rp));   /* R0 = B * Rp (B = arah dasar; identitas untuk kamera manual) */
  return{k:'rot',i:h.i,n,u,v,c,last:th,total:0,R0,Bt:tr(B),rp,e0};
}
function rotDrag(d,p,it,tt){
  const th=planeAngle(d.c,p,d.n,d.u,d.v);if(th==null)return;
  if(d.last!=null){let dl=th-d.last;while(dl>Math.PI)dl-=2*Math.PI;while(dl<-Math.PI)dl+=2*Math.PI;d.total+=dl}
  d.last=th;
  const R1=mul(rodrigues(d.n,d.total),d.R0),e=eulerOf(mul(d.Bt,R1));
  const fix=(v,ref)=>v+360*Math.round((ref-v)/360);   /* pilih sudut setara yang paling dekat, supaya keyframe tidak melompat */
  put(it,'rx',tt,r2(fix(e.rx,d.rp[0])));put(it,'ry',tt,r2(fix(e.ry,d.rp[1])));put(it,'rz',tt,r2(fix(e.rz,d.rp[2])));
}

/* ===== pointer (fase capture di .s3-view, jadi mendahului s3cam.js) ===== */
function onDown(e){
  if(!st.on||V.mode!=='3d'||e.target!==S.lv||st.drag||(e.pointerType==='mouse'&&e.button!==0))return;
  const c=ctx();if(!c)return;
  const p=lpos(e),h=hitTest(c,p);if(!h)return;
  const d=h.k==='move'?startMove(c,h,p):startRot(c,h,p);if(!d)return;
  d.pid=e.pointerId;d.id=c.it.id;st.drag=d;st.hover={k:h.k,i:h.i};
  e.preventDefault();e.stopPropagation();
  try{S.lv.setPointerCapture(e.pointerId)}catch(_){}
  S.bump();
}
function onMove(e){
  const d=st.drag;
  if(d){
    if(e.pointerId!==d.pid)return;
    e.preventDefault();e.stopPropagation();
    const it=byId(d.id);if(!isCam(it))return;
    const tt=curT(),p=lpos(e);
    if(d.k==='move')moveDrag(d,p,it,tt);else rotDrag(d,p,it,tt);
    touch();return;
  }
  if(!st.on||V.mode!=='3d'||e.target!==S.lv||e.pointerType!=='mouse')return;
  const c=ctx(),h=c?hitTest(c,lpos(e)):null,cur=st.hover;
  if((h&&h.i)!==(cur&&cur.i)||(h&&h.k)!==(cur&&cur.k)){st.hover=h;S.lv.style.cursor=h?'pointer':'';S.bump()}
}
function onUp(e){
  const d=st.drag;if(!d||e.pointerId!==d.pid)return;
  e.stopPropagation();st.drag=null;st.hover=null;S.bump();
}

/* ===== tombol melayang ===== */
function sync(){
  if(!box)return;
  const q=s=>box.querySelector(s);
  q('#s3g-toggle').classList.toggle('on',st.on);
  q('#s3g-opts').style.display=st.on?'flex':'none';
  [['move','#s3g-move'],['rot','#s3g-rot']].forEach(([m,s])=>q(s).classList.toggle('on',st.mode===m));
  [['global','#s3g-glob'],['local','#s3g-loc']].forEach(([m,s])=>q(s).classList.toggle('on',st.space===m));
  S.bump();
}
function init(){
  const view=document.querySelector('#s3d .s3-view'),lv=S.lv;
  if(!view||!lv)return false;
  if(getComputedStyle(view).position==='static')view.style.position='relative';
  cv=document.createElement('canvas');cv.id='s3g-cv';cv.style.cssText='position:absolute;pointer-events:none;z-index:3;display:none';
  lv.insertAdjacentElement('afterend',cv);
  box=document.createElement('div');box.id='s3g-box';
  box.innerHTML='<button class="btn" id="s3g-toggle" type="button" title="Tampilkan / sembunyikan gizmo geser dan putar untuk kamera terpilih">✥ Gizmo</button>'
    +'<div id="s3g-opts"><div class="s3g-row"><button class="btn on" id="s3g-move" type="button">↔ Geser</button><button class="btn" id="s3g-rot" type="button">⟳ Putar</button></div>'
    +'<div class="s3g-row"><button class="btn on" id="s3g-glob" type="button" title="Sumbu dunia">🌐 Global</button><button class="btn" id="s3g-loc" type="button" title="Sumbu kamera sendiri">◎ Lokal</button></div></div>';
  view.appendChild(box);
  const st0=document.createElement('style');
  st0.textContent='#s3g-box{position:absolute;top:8px;right:8px;z-index:4;display:none;flex-direction:column;align-items:flex-end;gap:6px}'
    +'#s3g-opts{display:none;flex-direction:column;align-items:flex-end;gap:6px}#s3g-box .s3g-row{display:flex;gap:4px}'
    +'#s3g-box .btn{padding:6px 10px;font-size:13px;background:#0009;backdrop-filter:blur(4px)}#s3g-box .btn.on{outline:2px solid #ffd166}';
  document.head.appendChild(st0);
  $('s3g-toggle').onclick=()=>{st.on=!st.on;st.hover=null;sync()};
  $('s3g-move').onclick=()=>{st.mode='move';sync()};$('s3g-rot').onclick=()=>{st.mode='rot';sync()};
  $('s3g-glob').onclick=()=>{st.space='global';sync()};$('s3g-loc').onclick=()=>{st.space='local';sync()};
  view.addEventListener('pointerdown',onDown,true);view.addEventListener('pointermove',onMove,true);
  view.addEventListener('pointerup',onUp,true);view.addEventListener('pointercancel',onUp,true);
  let last='';
  (function tick(){
    requestAnimationFrame(tick);
    const root=$('s3d');if(!root)return;
    const sig=[S.rev,curT(),V.mode,V.az,V.el,V.d,String(V.tg),st.on,st.mode,st.space,st.hover?st.hover.k+st.hover.i:'',st.drag?1:0,selId(),root.hidden,lv.width,lv.height,lv.offsetWidth,lv.offsetLeft].join('|');
    if(sig!==last){last=sig;try{draw()}catch(err){console.warn('Gizmo gagal digambar',err)}}
  })();
  sync();
  return true;
}
try{if(!init())setTimeout(init,500)}catch(e){console.error('Gizmo kamera gagal dimuat',e)}
})();
