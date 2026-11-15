/* GIZMO untuk Edit 3D: kamera DAN layer (teks, foto, video, model 3D, grup). Add-on, dimuat setelah js/s3cam.js; butuh 1 baris ekspor di akhir s3cam.js: APK.s3cam.
   - Tombol "✥ Gizmo" melayang di pojok kanan atas tampilan Ruang 3D (juga di mode 2 Tampilan, apa pun susunannya).
     Tombol itu hanya membuka / menutup MENU gizmo. Gizmo tetap tampil walau menu ditutup; untuk menyembunyikannya pakai "👁 Tampil" di dalam menu.
   - Gizmo muncul di objek yang sedang dipilih (kamera atau layer). Pilih lewat chip di atas properti, atau ketuk kotaknya di Ruang 3D.
   - Semua pilihan (tampil/sembunyi, menu terbuka/tertutup, Geser/Putar, Global/Lokal) disimpan di localStorage 's3gizmo', jadi tidak hilang
     saat pindah tampilan, keluar-masuk 2 Tampilan, buka project lain, atau muat ulang halaman.
   - Mode GESER: 3 panah dua arah (merah X, hijau Y, biru Z), kepala panah di kedua ujung dan huruf sumbu. Seret panah = objek bergeser sepanjang sumbu itu.
   - Mode PUTAR: 3 cincin besar. Seret cincin = objek berputar mengelilingi sumbu itu.
   - Ruang: GLOBAL (sumbu dunia) atau LOKAL (sumbu objek sendiri).
   - Layer yang punya Induk (parent): gizmo berada di posisi dunia layer, dan hasil seretan dikonversi ke nilai lokal terhadap induknya,
     jadi layer bergerak / berputar tepat sesuai arah panah dan cincin.
   Hasilnya ditulis lewat put() milik s3cam.js (x, y, z, rx, ry, rz), jadi otomatis jadi keyframe kalau properti itu beranimasi,
   ikut undo/redo, simpan otomatis, preview, dan export. Digambar di kanvas overlay sendiri, s3cam.js tidak digambar ulang.
   - Di bagian bawah file ini ada pemilih SUSUNAN mode 2 Tampilan (dibuat di js/s3tools.js): kiri-kanan atau atas-bawah, dan mana yang di sisi mana.
     Pilihannya disimpan di localStorage 's3layout'. */
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
/* on = gizmo tampil di objek terpilih, open = menu gizmo terbuka. Keduanya (dan mode / ruang) diingat, jadi gizmo tidak hilang sendiri */
const st={on:true,open:true,mode:'move',space:'global',hover:null,drag:null};
const SKEY='s3gizmo';
try{
  const o=JSON.parse(localStorage.getItem(SKEY)||'{}');
  if(typeof o.on==='boolean')st.on=o.on;
  if(typeof o.open==='boolean')st.open=o.open;
  if(o.mode==='move'||o.mode==='rot')st.mode=o.mode;
  if(o.space==='global'||o.space==='local')st.space=o.space;
}catch(_){}
const keep=()=>{try{localStorage.setItem(SKEY,JSON.stringify({on:st.on,open:st.open,mode:st.mode,space:st.space}))}catch(_){}};

/* objek yang bisa diberi gizmo: yang punya posisi dan putaran (kamera, teks, foto, video, model, grup). Efek dan latar tidak punya */
const hasXf=it=>!!it&&!!it.props&&['x','y','z','rx','ry','rz'].every(p=>p in it.props);
const w3=()=>{const a=window.APK&&APK.s3d;return a&&a.world?a:null};

/* dunia editor: x kanan, y BAWAH, z maju. Panah "atas" = -y supaya tampil seperti gizmo biasa */
function axesOf(pose){
  if(st.space==='local'){const R=pose.R;return[col(R,0),scl(col(R,1),-1),col(R,2)]}
  return[[1,0,0],[0,-1,0],[0,0,1]];
}
function ctx(){
  const lv=S.lv,it=byId(selId());
  if(!lv||!hasXf(it)||!lv.width)return null;
  const W=lv.width,H=lv.height,tt=curT(),cam=isCam(it);
  let pose;
  if(cam)pose=camPose(it,tt,aspect());
  else{const A=w3();if(!A)return null;const Wd=A.world(it,tt);pose={p:Wd.p,R:Wd.R}}   /* layer: posisi dan arah di dunia (sudah termasuk induk) */
  const O=obsState(),P=mkProj(O,W,H),o=pose.p,zc=P.cs(o)[2];
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
  /* tombol melayang selalu di pojok kanan atas tampilan Ruang 3D, juga di 2 Tampilan (kiri-kanan, atas-bawah, atau ditukar) */
  const vw=box.parentNode;
  box.style.top=(lv.offsetTop+8)+'px';
  box.style.right=Math.max(4,vw.clientWidth-(lv.offsetLeft+lv.offsetWidth)+8)+'px';
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
/* layer yang punya induk: selisih di dunia diubah ke selisih lokal (putar balik oleh arah induk, bagi skala induk) */
function parentMap(it,tt){
  const pa=!isCam(it)&&it.parent&&byId(it.parent),A=w3();
  if(!pa||pa===it||!A)return null;
  const Wp=A.world(pa,tt);
  return{Rt:tr(Wp.R),k:1/(Wp.s||1)};
}
function startMove(c,h,p){
  const a=axesOf(c.pose)[h.i],p0=c.P.pt(c.o),p1=c.P.pt(add(c.o,scl(a,c.U)));if(!p0||!p1)return null;
  return{k:'move',i:h.i,a,U:c.U,p:p,s:[p1[0]-p0[0],p1[1]-p0[1]],base:NAME.map(q=>gv(c.it,q,c.tt)),lp:parentMap(c.it,c.tt)};
}
function moveDrag(d,p,it,tt){
  const ss=d.s[0]*d.s[0]+d.s[1]*d.s[1];if(ss<64)return;
  const t=((p[0]-d.p[0])*d.s[0]+(p[1]-d.p[1])*d.s[1])/ss,dv=scl(d.a,d.U*t),dl=d.lp?scl(mv(d.lp.Rt,dv),d.lp.k):dv;
  NAME.forEach((q,i)=>put(it,q,tt,r2(d.base[i]+dl[i])));
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
  const Rp=rotM(rp[0],rp[1],rp[2]),R0=c.pose.R,B=mul(R0,tr(Rp));   /* R0 = B * Rp (B = arah dasar: arah induk untuk layer, identitas untuk kamera manual) */
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
    const it=byId(d.id);if(!hasXf(it))return;
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
  const tg=q('#s3g-toggle');tg.classList.toggle('on',st.on);tg.textContent='✥ Gizmo '+(st.open?'▾':'▸');
  q('#s3g-opts').style.display=st.open?'flex':'none';
  const sh=q('#s3g-show');sh.classList.toggle('on',st.on);sh.textContent=st.on?'👁 Tampil':'🚫 Sembunyi';
  [['move','#s3g-move'],['rot','#s3g-rot']].forEach(([m,s])=>q(s).classList.toggle('on',st.mode===m));
  [['global','#s3g-glob'],['local','#s3g-loc']].forEach(([m,s])=>q(s).classList.toggle('on',st.space===m));
  keep();S.bump();
}
function init(){
  const view=document.querySelector('#s3d .s3-view'),lv=S.lv;
  if(!view||!lv)return false;
  if(getComputedStyle(view).position==='static')view.style.position='relative';
  cv=document.createElement('canvas');cv.id='s3g-cv';cv.style.cssText='position:absolute;pointer-events:none;z-index:3;display:none';
  lv.insertAdjacentElement('afterend',cv);
  box=document.createElement('div');box.id='s3g-box';
  box.innerHTML='<button class="btn" id="s3g-toggle" type="button" title="Buka / tutup menu gizmo. Gizmo tetap tampil walau menu ditutup">✥ Gizmo ▾</button>'
    +'<div id="s3g-opts"><div class="s3g-row"><button class="btn on" id="s3g-show" type="button" title="Tampilkan / sembunyikan gizmo di kamera atau layer terpilih">👁 Tampil</button></div>'
    +'<div class="s3g-row"><button class="btn on" id="s3g-move" type="button">↔ Geser</button><button class="btn" id="s3g-rot" type="button">⟳ Putar</button></div>'
    +'<div class="s3g-row"><button class="btn on" id="s3g-glob" type="button" title="Sumbu dunia">🌐 Global</button><button class="btn" id="s3g-loc" type="button" title="Sumbu objek sendiri">◎ Lokal</button></div></div>';
  view.appendChild(box);
  const st0=document.createElement('style');
  st0.textContent='#s3g-box{position:absolute;top:8px;right:8px;z-index:4;display:none;flex-direction:column;align-items:flex-end;gap:6px}'
    +'#s3g-opts{display:none;flex-direction:column;align-items:flex-end;gap:6px}#s3g-box .s3g-row{display:flex;gap:4px}'
    +'#s3g-box .btn{padding:6px 10px;font-size:13px;background:#0009;backdrop-filter:blur(4px)}#s3g-box .btn.on{outline:2px solid #ffd166}';
  document.head.appendChild(st0);
  $('s3g-toggle').onclick=()=>{st.open=!st.open;sync()};
  $('s3g-show').onclick=()=>{st.on=!st.on;st.hover=null;sync()};
  $('s3g-move').onclick=()=>{st.mode='move';sync()};$('s3g-rot').onclick=()=>{st.mode='rot';sync()};
  $('s3g-glob').onclick=()=>{st.space='global';sync()};$('s3g-loc').onclick=()=>{st.space='local';sync()};
  view.addEventListener('pointerdown',onDown,true);view.addEventListener('pointermove',onMove,true);
  view.addEventListener('pointerup',onUp,true);view.addEventListener('pointercancel',onUp,true);
  let last='';
  (function tick(){
    requestAnimationFrame(tick);
    const root=$('s3d');if(!root)return;
    const sig=[S.rev,curT(),V.mode,V.az,V.el,V.d,String(V.tg),st.on,st.mode,st.space,st.hover?st.hover.k+st.hover.i:'',st.drag?1:0,selId(),root.hidden,lv.width,lv.height,lv.offsetWidth,lv.offsetHeight,lv.offsetLeft,lv.offsetTop,view.clientWidth].join('|');
    if(sig!==last){last=sig;try{draw()}catch(err){console.warn('Gizmo gagal digambar',err)}}
  })();
  sync();
  return true;
}
try{if(!init())setTimeout(init,500)}catch(e){console.error('Gizmo gagal dimuat',e)}
})();

/* ===================== SUSUNAN 2 TAMPILAN (Edit 3D) =====================
   Mode "◫ 2 Tampilan" (dibuat di js/s3tools.js) awalnya hanya kiri = hasil kamera, kanan = ruang 3D. Di sini ditambah pemilih susunan
   di sebelah tombolnya (muncul hanya saat 2 Tampilan aktif):
     lr = Hasil kiri · 3D kanan (bawaan)   rl = 3D kiri · Hasil kanan   tb = Hasil atas · 3D bawah   bt = 3D atas · Hasil bawah
   Pilihan disimpan di localStorage 's3layout'. Susunan diatur lewat kelas s3-lay-xx di #s3d dan CSS grid (order), jadi semua kontrol
   Ruang 3D tetap bekerja. Label "HASIL KAMERA" / "RUANG 3D" dari s3tools.js dipindahkan mengikuti posisi tiap kanvas. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const LAYS={lr:'Hasil kiri · 3D kanan',rl:'3D kiri · Hasil kanan',tb:'Hasil atas · 3D bawah',bt:'3D atas · Hasil bawah'};
const KEY='s3layout';
let lay='lr',sel=null;
try{const v=localStorage.getItem(KEY);if(v&&LAYS[v])lay=v}catch(_){}
function place(){
  const view=document.querySelector('#s3d .s3-view'),cv=$('s3-cv'),lv=$('s3-lv');
  if(!view||!cv||!lv)return;
  const caps=view.querySelectorAll('.s3x-cap');if(caps.length<2)return;
  const at=(el,c)=>{el.style.left=(c.offsetLeft+6)+'px';el.style.top=(c.offsetTop+4)+'px'};
  at(caps[0],cv);at(caps[1],lv);
}
function apply(){
  const r=$('s3d');if(!r)return;
  Object.keys(LAYS).forEach(k=>r.classList.toggle('s3-lay-'+k,k===lay));
  if(sel)sel.value=lay;
  requestAnimationFrame(place);
}
function show(){
  const r=$('s3d');if(!r||!sel)return;
  sel.hidden=!r.classList.contains('s3-vdual');
  place();
}
function init(){
  const r=$('s3d'),w=document.querySelector('#s3d .s3v'),b=$('s3-vdual');
  if(!r||!w||!b)return false;
  if($('s3-vlay'))return true;
  sel=document.createElement('select');sel.id='s3-vlay';sel.hidden=true;
  sel.setAttribute('aria-label','Susunan 2 tampilan');
  sel.title='Susunan 2 tampilan: kiri-kanan atau atas-bawah, dan mana yang di sisi mana';
  sel.innerHTML=Object.keys(LAYS).map(k=>'<option value="'+k+'">'+LAYS[k]+'</option>').join('');
  w.insertBefore(sel,b.nextSibling);
  sel.onchange=()=>{lay=sel.value;try{localStorage.setItem(KEY,lay)}catch(_){}apply()};
  const st=document.createElement('style');
  st.textContent=
    '#s3d.s3-vdual.s3-lay-rl #s3-cv,#s3d.s3-vdual.s3-lay-bt #s3-cv{order:2}'
   +'#s3d.s3-vdual.s3-lay-rl #s3-lv,#s3d.s3-vdual.s3-lay-bt #s3-lv{order:1}'
   +'#s3d.s3-v3d.s3-vdual.s3-lay-tb .s3-view,#s3d.s3-v3d.s3-vdual.s3-lay-bt .s3-view{grid-template-columns:minmax(0,1fr);gap:4px}'
   +'#s3d.s3-vdual.s3-lay-tb #s3-cv,#s3d.s3-vdual.s3-lay-tb #s3-lv,#s3d.s3-vdual.s3-lay-bt #s3-cv,#s3d.s3-vdual.s3-lay-bt #s3-lv{max-height:24vh}'
   +'@media (min-width:900px){#s3d.s3-vdual.s3-lay-tb #s3-cv,#s3d.s3-vdual.s3-lay-tb #s3-lv,#s3d.s3-vdual.s3-lay-bt #s3-cv,#s3d.s3-vdual.s3-lay-bt #s3-lv{max-height:34vh}}'
   +'#s3-vlay{max-width:190px}';
  document.head.appendChild(st);
  new MutationObserver(show).observe(r,{attributes:true,attributeFilter:['class']});
  if(window.ResizeObserver){
    const ro=new ResizeObserver(place);
    ['#s3d .s3-view','#s3-cv','#s3-lv'].forEach(q=>{const e=document.querySelector(q);if(e)ro.observe(e)});
  }
  addEventListener('resize',place);
  apply();show();
  return true;
}
/* tombol "◫ 2 Tampilan" dibuat s3tools.js saat halaman selesai dimuat: tunggu sampai ada */
let tries=0;
const iv=setInterval(()=>{
  try{if(init()||++tries>80)clearInterval(iv)}
  catch(e){clearInterval(iv);console.warn('Susunan 2 tampilan gagal dimuat',e)}
},250);
})();
