/* ALAT PRO Edit 3D (add-on, dimuat setelah js/s3cam.js; isi scene3d.js tidak diubah).
   Menambah, ala aplikasi editing 3D / kamera profesional:
   1) Bilah alat di ruang 3D: Pilih / Geser / Putar / Ukuran. Layer dan kamera yang dipilih mendapat gizmo:
      panah sumbu X Y Z (geser), cincin X Y Z (putar), lingkaran + belah ketupat (ukuran), kotak tengah (geser bebas di bidang tampilan).
      Perhitungannya memakai sinar dari tampilan ke sumbu / bidang, jadi tepat di sudut pandang mana pun.
   2) Navigasi tampilan yang bisa dipilih tanpa keyboard: Orbit / Geser tampilan / Zoom (berguna di HP).
   3) Auto-key (setiap geser / putar langsung jadi keyframe di waktu sekarang), Snap (kelipatan 10 satuan, 5 derajat, 0,05 ukuran),
      Lintasan gerak (jalur objek / kamera + titik keyframe, ketuk titik untuk loncat ke waktunya).
   4) Tampilan siap pakai: Persp / Depan / Samping / Atas, Fokus ke objek terpilih, "Samakan kamera dengan tampilan".
   5) Panduan komposisi di hasil render: garis sepertiga, tengah, area aman, info lensa (mm, f/, FOV). Hanya overlay layar, tidak ikut export.
   6) HAPUS: tombol 🗑, tombol Delete / Backspace, dan kotak "Hapus & reset" di properti (hapus keyframe di waktu ini,
      hapus semua keyframe, hapus layer, reset posisi). Semuanya bisa dibatalkan dengan ↶ (undo).
   Kait ke s3cam.js lewat APK.s3view (HK.draw / HK.down / HK.move / HK.up). */
(function(){
'use strict';
const X=window.APK&&APK.s3view;
if(!X){console.warn('Alat pro Edit 3D butuh js/s3cam.js');return}
const V=X.V,HK=X.HK,LB=X.lib;
const {D,REFH,clamp,r2,mul,mv,add,sub,scl,col,norm,rotM,eulerOf,camPose,put,scn,byId,curT,selId,aspect,isCam,spatial,boxSize,obsState,activeId,sensH,fovToMm,blurToAp,toast}=LB;
const $=id=>document.getElementById(id);
const A=()=>APK.s3d;
const I3=[1,0,0,0,1,0,0,0,1],COL=['#ff5d5d','#4cf08a','#5da8ff'],TAU=Math.PI*2;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/* ===== keadaan (tanpa Auto-key: itu selalu mati saat dimuat supaya tidak membuat keyframe tanpa sengaja) ===== */
const ST={tool:'move',nav:'orbit',ak:false,snap:false,trail:true,guide:false};
try{
  const o=JSON.parse(localStorage.getItem('s3pro')||'{}');
  if(['select','move','rotate','scale'].indexOf(o.tool)>=0)ST.tool=o.tool;
  if(['orbit','pan','dolly'].indexOf(o.nav)>=0)ST.nav=o.nav;
  ['snap','trail','guide'].forEach(k=>{if(typeof o[k]==='boolean')ST[k]=o[k]});
}catch(_){}
const persist=()=>{try{localStorage.setItem('s3pro',JSON.stringify({tool:ST.tool,nav:ST.nav,snap:ST.snap,trail:ST.trail,guide:ST.guide}))}catch(_){}};
const applyST=()=>{V.nav=ST.nav;HK.ak=ST.ak};
applyST();

/* ===== bantu ===== */
const sel=()=>byId(selId());
const gizmoItem=()=>{const it=sel();return it&&(isCam(it)||spatial(it))?it:null};
const pv=(it,p,tt)=>{const v=A().val(it,p,tt);return v==null?0:v};
const snp=(v,st)=>ST.snap?Math.round(v/st)*st:v;
const nm=it=>it.kind==='text'?(String(it.text||'').split('\n')[0].slice(0,14)||'Teks'):String(it.name||it.kind).slice(0,16);
/* kerangka acuan item: titik asal gizmo di dunia, sumbu induk (Rp) dan skala induk (sp) */
function frame(it,tt){
  if(isCam(it))return{o:camPose(it,tt,aspect()).p,Rp:I3,sp:1};
  const Wd=A().world(it,tt),pa=it.parent&&byId(it.parent);
  if(pa&&pa!==it){const Wp=A().world(pa,tt);return{o:Wd.p,Rp:Wp.R,sp:Wp.s||1}}
  return{o:Wd.p,Rp:I3,sp:1};
}
const itemPos=(it,tt,asp)=>isCam(it)?camPose(it,tt,asp).p:A().world(it,tt).p;
function keyTimes(it){
  const s=new Set();
  Object.keys(it.keys||{}).forEach(p=>it.keys[p].forEach(k=>s.add(Math.round(k.t*100)/100)));
  return[...s].sort((a,b)=>a-b);
}
function rayAt(L,p){
  const F=L.O.F,k=L.P.k;
  return{o:L.O.p,d:norm(mv(L.O.R,[(p[0]-L.W/2)/(F*k),(p[1]-L.H/2)/(F*k),1]))};
}
/* titik terdekat pada garis p0 + s*a ke sinar: kembalikan s (null kalau garis hampir sejajar sinar) */
function axisParam(r,p0,a){
  const w0=sub(p0,r.o),b=dot(a,r.d),c=dot(a,w0),e=dot(r.d,w0),den=1-b*b;
  if(den<1e-3)return null;
  return(b*e-c)/den;
}
function planeHit(r,p0,n){
  const den=dot(r.d,n);if(Math.abs(den)<1e-4)return null;
  const t=dot(sub(p0,r.o),n)/den;return t>0?add(r.o,scl(r.d,t)):null;
}
function segDist(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy||1,t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,0,1);
  return Math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy));
}
const ringBasis=a=>{const t=Math.abs(a[0])<.9?[1,0,0]:[0,1,0],u=norm(cross(t,a));return[u,cross(a,u)]};   /* u x w = a: bertambahnya sudut = putaran kanan terhadap sumbu */
const ringPt=(c,u,w,r,ph)=>add(c,add(scl(u,r*Math.cos(ph)),scl(w,r*Math.sin(ph))));
function ringDist(L,c,rg,r,p){
  const q=[];for(let i=0;i<=64;i++)q.push(L.P.pt(ringPt(c,rg.u,rg.w,r,i/64*TAU)));
  let best=1e9;for(let i=0;i<64;i++)if(q[i]&&q[i+1])best=Math.min(best,segDist(p,q[i],q[i+1]));
  return best;
}
/* sudut di cincin yang paling dekat dengan jari / kursor (kasar lalu halus) */
function nearPhi(L,c,rg,r,p){
  let best=1e18,bp=0;
  const test=ph=>{const s=L.P.pt(ringPt(c,rg.u,rg.w,r,ph));if(!s)return;const d=(s[0]-p[0])*(s[0]-p[0])+(s[1]-p[1])*(s[1]-p[1]);if(d<best){best=d;bp=ph}};
  for(let i=0;i<120;i++)test(i/120*TAU);
  let st=TAU/120;
  for(let k=0;k<3;k++){const c0=bp;for(let j=-4;j<=4;j++)test(c0+j*st/4);st/=4}
  return bp;
}

/* ===== tata letak gizmo (dipakai untuk menggambar dan menguji sentuhan) ===== */
function layout(L){
  const it=gizmoItem();if(!it||!L||ST.tool==='select')return null;
  if(ST.tool==='scale'&&isCam(it))return null;
  const tt=L.tt,fr=frame(it,tt),zc=L.P.cs(fr.o)[2];if(!(zc>60))return null;
  const S0=L.P.pt(fr.o);if(!S0)return null;
  const upp=zc/(L.O.F*L.P.k),H=L.H,out={it,fr,S0,upp,tt,H,tool:ST.tool};
  if(ST.tool==='move'){
    const len=H*.17*upp;
    out.axes=[0,1,2].map(i=>{
      const a=i===1?scl(col(fr.Rp,1),-1):col(fr.Rp,i),e=add(fr.o,scl(a,len)),S1=L.P.pt(e);   /* sumbu Y digambar ke atas */
      return{i,a,e,S1,ok:!!S1&&Math.hypot(S1[0]-S0[0],S1[1]-S0[1])>14,c:COL[i]};
    });
  }else if(ST.tool==='rotate'){
    const Rz=rotM(0,0,pv(it,'rz',tt)),Rx=rotM(pv(it,'rx',tt),0,0),loc=[col(Rz,0),col(mul(Rz,Rx),1),[0,0,1]];   /* sumbu gimbal: R = Rz*Rx*Ry */
    out.rings=['rx','ry','rz'].map((p,i)=>{const a=norm(mv(fr.Rp,loc[i])),b=ringBasis(a);return{p,i,a,u:b[0],w:b[1],c:COL[i]}});
    out.r=H*.12*upp;
  }
  return out;
}

/* ===== lintasan gerak ===== */
let TKH=[];
function drawTrails(g,L){
  TKH=[];
  if(!ST.trail)return;
  const it=gizmoItem();if(!it)return;
  const s=scn(),N=clamp(Math.round(s.dur/.1),10,240),pts=[];
  for(let i=0;i<=N;i++)pts.push(itemPos(it,s.dur*i/N,L.asp));
  let mx=0;for(let i=1;i<pts.length;i++)mx=Math.max(mx,Math.hypot(pts[i][0]-pts[0][0],pts[i][1]-pts[0][1],pts[i][2]-pts[0][2]));
  if(mx<8)return;
  g.save();g.setLineDash([7,5]);g.lineWidth=2;g.strokeStyle='rgba(90,225,255,.9)';
  for(let i=0;i<N;i++)L.P.seg(g,pts[i],pts[i+1]);
  g.setLineDash([]);
  keyTimes(it).forEach(kt=>{
    if(kt>s.dur+.01)return;
    const q=L.P.pt(itemPos(it,kt,L.asp));if(!q)return;
    g.fillStyle=Math.abs(kt-L.tt)<.02?'#fff':'#ffd166';g.strokeStyle='#1a1300';g.lineWidth=1.5;
    g.beginPath();g.moveTo(q[0],q[1]-8);g.lineTo(q[0]+8,q[1]);g.lineTo(q[0],q[1]+8);g.lineTo(q[0]-8,q[1]);g.closePath();g.fill();g.stroke();
    TKH.push({t:kt,x:q[0],y:q[1]});
  });
  const c=L.P.pt(itemPos(it,L.tt,L.asp));
  if(c){g.fillStyle='#5ae1ff';g.beginPath();g.arc(c[0],c[1],4.5,0,TAU);g.fill()}
  g.restore();
}

/* ===== menggambar gizmo ===== */
let DG=null;   /* seretan gizmo yang sedang berjalan */
function drawGizmo(g,L){
  const lay=layout(L);if(!lay)return;
  const S0=lay.S0;
  g.save();g.lineCap='round';g.lineJoin='round';g.setLineDash([]);g.globalAlpha=.95;
  if(lay.tool==='move'){
    lay.axes.forEach(a=>{
      if(!a.ok)return;
      const act=!!DG&&DG.t==='axis'&&DG.i===a.i,S1=a.S1;
      g.strokeStyle=g.fillStyle=act?'#ffffff':a.c;g.lineWidth=act?5:3.5;
      g.beginPath();g.moveTo(S0[0],S0[1]);g.lineTo(S1[0],S1[1]);g.stroke();
      const dx=S1[0]-S0[0],dy=S1[1]-S0[1],l=Math.hypot(dx,dy),ux=dx/l,uy=dy/l,hs=Math.max(9,L.H*.022);
      g.beginPath();g.moveTo(S1[0]+ux*hs*1.2,S1[1]+uy*hs*1.2);g.lineTo(S1[0]-uy*hs*.6,S1[1]+ux*hs*.6);g.lineTo(S1[0]+uy*hs*.6,S1[1]-ux*hs*.6);g.closePath();g.fill();
    });
    if(!isCam(lay.it)){
      const s=Math.max(8,L.H*.018);
      g.fillStyle='rgba(255,255,255,.28)';g.strokeStyle='#fff';g.lineWidth=2;g.fillRect(S0[0]-s,S0[1]-s,2*s,2*s);g.strokeRect(S0[0]-s,S0[1]-s,2*s,2*s);
    }
  }else if(lay.tool==='rotate'){
    lay.rings.forEach(rg=>{
      const act=!!DG&&DG.t==='ring'&&DG.i===rg.i;
      g.strokeStyle=act?'#ffffff':rg.c;g.lineWidth=act?4.5:3;
      let prev=ringPt(lay.fr.o,rg.u,rg.w,lay.r,0);
      for(let k=1;k<=64;k++){const q=ringPt(lay.fr.o,rg.u,rg.w,lay.r,k/64*TAU);L.P.seg(g,prev,q);prev=q}
    });
  }else if(lay.tool==='scale'){
    const r=L.H*.12,dx=S0[0]+r*.7071,dy=S0[1]-r*.7071,act=!!DG&&DG.t==='scale';
    g.strokeStyle='#ffa94d';g.lineWidth=3;g.beginPath();g.arc(S0[0],S0[1],r,0,TAU);g.stroke();
    g.fillStyle=act?'#fff':'#ffa94d';g.strokeStyle='#fff';g.lineWidth=2;
    g.beginPath();g.moveTo(dx,dy-11);g.lineTo(dx+11,dy);g.lineTo(dx,dy+11);g.lineTo(dx-11,dy);g.closePath();g.fill();g.stroke();
  }
  g.restore();
}

/* ===== seretan gizmo ===== */
function startAxis(L,lay,a,p){
  const it=lay.it,r=rayAt(L,p),s=axisParam(r,lay.fr.o,a.a);if(s==null)return false;
  DG={t:'axis',i:a.i,a:a.a,s0:s,o:lay.fr.o,fr:lay.fr,it,tt:lay.tt,base:['x','y','z'].map(q=>pv(it,q,lay.tt))};
  return true;
}
function startPlane(L,lay,p){
  const it=lay.it,r=rayAt(L,p),h=planeHit(r,lay.fr.o,L.O.fw);if(!h)return false;
  DG={t:'plane',h0:h,n:L.O.fw,o:lay.fr.o,fr:lay.fr,it,tt:lay.tt,base:['x','y','z'].map(q=>pv(it,q,lay.tt))};
  return true;
}
function applyMove(d){
  const G=DG;
  for(let j=0;j<3;j++){
    const dl=dot(d,col(G.fr.Rp,j))/G.fr.sp;
    if(Math.abs(dl)<=1e-6)continue;
    put(G.it,'xyz'[j],G.tt,r2(clamp(snp(G.base[j]+dl,10),-3000,j===2?8000:3000)));
  }
  X.touch();
}
HK.down.push((e,p,L)=>{
  if(!L||e.button===2)return false;
  const lay=layout(L);
  if(lay){
    const it=lay.it,cam=isCam(it),s0=lay.S0,dc=Math.hypot(p[0]-s0[0],p[1]-s0[1]),tol=Math.max(14,L.H*.035);
    if(lay.tool==='move'){
      if(!cam&&dc<Math.max(12,L.H*.026))return startPlane(L,lay,p);
      if(dc>(cam?Math.max(22,L.H*.05):0)){
        let best=null,bd=1e9;
        lay.axes.forEach(a=>{if(!a.ok)return;const d=segDist(p,s0,a.S1);if(d<tol&&d<bd){bd=d;best=a}});
        if(best)return startAxis(L,lay,best,p);
      }
    }else if(lay.tool==='rotate'){
      let best=null,bd=1e9;
      lay.rings.forEach(rg=>{const d=ringDist(L,lay.fr.o,rg,lay.r,p);if(d<tol&&d<bd){bd=d;best=rg}});
      if(best){
        DG={t:'ring',i:best.i,rg:best,p:best.p,o:lay.fr.o,r:lay.r,ph:nearPhi(L,lay.fr.o,best,lay.r,p),tot:0,base:pv(it,best.p,lay.tt),it,tt:lay.tt};
        return true;
      }
    }else if(lay.tool==='scale'){
      const r=L.H*.12,dx=s0[0]+r*.7071,dy=s0[1]-r*.7071;
      if(Math.hypot(p[0]-dx,p[1]-dy)<tol*1.2||Math.abs(dc-r)<tol*.8){
        DG={t:'scale',s0,d0:Math.max(dc,10),base:pv(it,'scale',lay.tt)||1,it,tt:lay.tt};
        return true;
      }
    }
  }
  /* titik keyframe di lintasan: ketuk untuk loncat ke waktunya */
  for(const k of TKH){if(Math.hypot(k.x-p[0],k.y-p[1])<Math.max(12,L.H*.028)){try{A()._setT(k.t)}catch(_){}return true}}
  return false;
});
HK.move.push((e,p,L)=>{
  if(!DG||!L)return false;
  const G=DG;
  if(G.t==='axis'){
    const s=axisParam(rayAt(L,p),G.o,G.a);if(s!=null)applyMove(scl(G.a,s-G.s0));
  }else if(G.t==='plane'){
    const h=planeHit(rayAt(L,p),G.o,G.n);if(h)applyMove(sub(h,G.h0));
  }else if(G.t==='ring'){
    const ph=nearPhi(L,G.o,G.rg,G.r,p);let d=(ph-G.ph)/D;
    while(d>180)d-=360;while(d<-180)d+=360;
    G.ph=ph;G.tot+=d;
    const lim=G.p==='rz'?720:360;
    put(G.it,G.p,G.tt,r2(clamp(snp(G.base+G.tot,5),-lim,lim)));X.touch();
  }else if(G.t==='scale'){
    const dc=Math.max(10,Math.hypot(p[0]-G.s0[0],p[1]-G.s0[1]));
    put(G.it,'scale',G.tt,r2(clamp(snp(G.base*dc/G.d0,.05),.05,6)));X.touch();
  }
  return true;
});
HK.up.push(()=>{if(DG){DG=null;X.bump()}});
HK.draw.push((g,L)=>{drawTrails(g,L);drawGizmo(g,L)});

/* ===== hapus & reset ===== */
function delKeysAt(it,tt){
  let n=0;
  Object.keys(it.keys||{}).forEach(p=>{
    const a=it.keys[p],i=a.findIndex(k=>Math.abs(k.t-tt)<.02);if(i<0)return;
    if(a.length===1)it.props[p]=a[0].v;
    a.splice(i,1);if(!a.length)delete it.keys[p];n++;
  });
  return n;
}
function delSel(){
  const it=sel();if(!it)return;
  if(it.id==='cam'||it.id==='fx'){toast('Kamera utama dan Efek tidak bisa dihapus. Pakai "Reset posisi & putaran" atau "Hapus semua keyframe" di properti.');return}
  const n=nm(it);
  $('s3-del').click();
  toast('"'+n+'" dihapus. Ketuk ↶ untuk membatalkan.');
}
function done(it,msg){X.touch();try{A().select(it.id)}catch(_){}toast(msg)}
function onBox(e){
  const b=e.target.closest('[data-pa]');if(!b)return;
  const it=sel();if(!it)return;
  const tt=curT(),k=b.dataset.pa;
  if(k==='delkey'){
    const n=delKeysAt(it,tt);
    if(!n){toast('Tidak ada keyframe di waktu ini (geser playhead ke titik kuning dulu)');return}
    done(it,n+' keyframe dihapus di '+tt.toFixed(2)+' dtk. Ketuk ↶ untuk membatalkan.');
  }else if(k==='clrkeys'){
    const ps=Object.keys(it.keys||{});
    if(!ps.length){toast('"'+nm(it)+'" belum punya keyframe');return}
    if(!confirm('Hapus semua keyframe milik "'+nm(it)+'"? Nilai dibekukan di posisi waktu sekarang. Bisa dibatalkan dengan undo.'))return;
    ps.forEach(p=>{it.props[p]=A().val(it,p,tt);delete it.keys[p]});
    done(it,'Semua keyframe dihapus. Ketuk ↶ untuk membatalkan.');
  }else if(k==='delitem'){delSel()}
  else if(k==='reset'){
    ['x','y','z','rx','ry','rz','frx','fry'].forEach(p=>{if(p in it.props){delete it.keys[p];it.props[p]=0}});
    if('scale' in it.props){delete it.keys.scale;it.props.scale=1}
    done(it,'Posisi dan putaran dikembalikan ke awal. Ketuk ↶ untuk membatalkan.');
  }else if(k==='camview')camToView();
}
function injectBox(){
  const P=$('s3-props'),s=scn();if(!P||!s||P.querySelector('#s3p-box'))return;
  const it=sel();if(!it)return;
  const main=it.id==='cam'||it.id==='fx',cam=isCam(it);
  const w=document.createElement('div');
  w.innerHTML='<div class="s3c" id="s3p-box"><b>🗑 Hapus &amp; reset</b><div class="s3p-row">'
    +'<button class="btn" type="button" data-pa="delkey" title="Hapus semua keyframe milik layer ini tepat di waktu sekarang">Hapus keyframe di sini</button>'
    +'<button class="btn" type="button" data-pa="clrkeys" title="Hapus semua keyframe milik layer ini (nilai dibekukan di waktu sekarang)">Hapus semua keyframe</button>'
    +('x' in it.props?'<button class="btn" type="button" data-pa="reset" title="Kembalikan posisi, putaran, dan ukuran ke awal">Reset posisi &amp; putaran</button>':'')
    +(cam?'<button class="btn" type="button" data-pa="camview" title="Pindahkan kamera ini ke tempat dan arah tampilan ruang 3D sekarang">📷 Samakan dengan tampilan ruang 3D</button>':'')
    +(main?'':'<button class="btn danger" type="button" data-pa="delitem">Hapus layer ini</button>')
    +'</div><p class="s3-hint">Semua bisa dibatalkan dengan ↶. Pintasan: Delete / Backspace menghapus layer terpilih.</p></div>';
  const box=w.firstElementChild;
  P.appendChild(box);box.addEventListener('click',onBox);
}

/* ===== tampilan: preset, fokus, samakan kamera ===== */
function setPreset(n){
  const m={persp:[-38,24],front:[0,0],side:[-90,0],top:[0,85]}[n];
  if(!m)return;V.az=m[0];V.el=m[1];X.bump();
}
function focusSel(){
  const it=sel();if(!it)return;
  const tt=curT();let p,r=500;
  if(isCam(it))p=camPose(it,tt,aspect()).p;
  else if(spatial(it)){const Wd=A().world(it,tt),b=boxSize(it);p=Wd.p;r=Math.max(b[0],b[1])*.5*(Wd.s||1)}
  else{toast('Layer ini tidak punya posisi di ruang 3D');return}
  V.tg=[p[0],p[1],p[2]];V.d=clamp(Math.max(r*3,800),400,18000);X.bump();
}
function camToView(){
  const it=sel();
  if(!isCam(it)){toast('Pilih kamera dulu (ketuk chip Kamera)');return}
  const tt=curT(),O=obsState(),e=eulerOf(O.R),fov=pv(it,'fov',tt)||60,F=(REFH/2)/Math.tan(fov*D/2);
  if(it.target){it.target=null;toast('Objek yang ditangkap dilepas supaya kamera bisa diatur manual')}
  const vals={x:O.p[0],y:O.p[1],z:O.p[2]+F,rx:e.rx,ry:e.ry,rz:e.rz};
  Object.keys(vals).forEach(k=>put(it,k,tt,r2(vals[k])));
  X.touch();try{A().select(it.id)}catch(_){}
  toast('Kamera disamakan dengan tampilan ruang 3D di '+tt.toFixed(2)+' dtk');
}

/* ===== bilah alat ===== */
function paintBar(){
  const tb=$('s3-tb');if(!tb)return;
  tb.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===ST.tool));
  tb.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('on',b.dataset.nav===ST.nav));
  tb.querySelectorAll('[data-tg]').forEach(b=>b.classList.toggle('on',!!ST[b.dataset.tg]));
  const g=$('s3-vguide');if(g)g.classList.toggle('on',ST.guide);
}
function onBar(e){
  const b=e.target.closest('button');if(!b)return;
  const d=b.dataset;
  if(d.tool)ST.tool=d.tool;
  else if(d.nav)ST.nav=d.nav;
  else if(d.tg){
    ST[d.tg]=!ST[d.tg];
    if(d.tg==='ak')toast(ST.ak?'Auto-key MENYALA: geser / putar di ruang 3D langsung jadi keyframe di waktu sekarang':'Auto-key mati');
  }else if(d.view){setPreset(d.view);return}
  else if(d.act==='focus'){focusSel();return}
  else if(d.act==='camview'){camToView();return}
  else if(d.act==='del'){delSel();return}
  applyST();persist();paintBar();X.bump();
}

/* ===== panduan komposisi di hasil render ===== */
let gd=null,gsig='';
function placeGuides(){
  const cv=$('s3-cv'),root=$('s3d');if(!gd||!cv||!root)return;
  if(!ST.guide||root.hidden||cv.offsetParent===null){gd.style.display='none';gsig='';return}
  const s=scn();if(!s)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
  const tt=curT(),act=byId(activeId(tt))||s.items[0],fov=pv(act,'fov',tt)||60,foc=pv(act,'focus',tt);
  const sig=[w,h,dpr,cv.offsetLeft,cv.offsetTop,tt.toFixed(2),act.id,act.name,fov,foc,s.aspect,s.dur,act.sensor||''].join('|');
  if(sig===gsig)return;gsig=sig;
  gd.style.display='';gd.style.left=cv.offsetLeft+'px';gd.style.top=cv.offsetTop+'px';gd.style.width=w+'px';gd.style.height=h+'px';
  gd.width=Math.round(w*dpr);gd.height=Math.round(h*dpr);
  const g=gd.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const ln=(x1,y1,x2,y2)=>{g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke()};
  g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.38)';
  for(let i=1;i<3;i++){ln(w*i/3,0,w*i/3,h);ln(0,h*i/3,w,h*i/3)}
  const cx=w/2,cy=h/2,cs=Math.max(6,h*.025);
  g.strokeStyle='rgba(255,255,255,.7)';ln(cx-cs,cy,cx+cs,cy);ln(cx,cy-cs,cx,cy+cs);
  g.setLineDash([6,5]);g.strokeStyle='rgba(255,230,120,.55)';
  [.9,.8].forEach(f=>g.strokeRect(w*(1-f)/2,h*(1-f)/2,w*f,h*f));
  g.setLineDash([]);
  const fs=Math.max(10,Math.round(h*.04)),mm=Math.round(fovToMm(fov,sensH(act))*10)/10,ap=Math.round(blurToAp(foc)*10)/10;
  g.font='600 '+fs+'px system-ui,sans-serif';g.shadowColor='rgba(0,0,0,.9)';g.shadowBlur=4;
  g.textBaseline='top';g.textAlign='left';g.fillStyle='#ff4d4d';g.fillText('●',8,6);
  g.fillStyle='#fff';g.fillText(String(act.name||'Kamera'),8+fs*1.1,6);
  g.textAlign='right';g.fillText(mm+'mm  f/'+ap+'  '+Math.round(fov)+'°',w-8,6);
  g.textBaseline='bottom';g.textAlign='left';g.fillText(tt.toFixed(2)+' / '+s.dur.toFixed(1)+' dtk',8,h-6);
  g.textAlign='right';g.fillText(String(s.aspect),w-8,h-6);
}

/* ===== pintasan keyboard ===== */
addEventListener('keydown',e=>{
  const root=$('s3d');if(!root||root.hidden||!scn())return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const ae=document.activeElement,tg=ae?ae.tagName:'';
  if(tg==='TEXTAREA'||tg==='SELECT'||(ae&&ae.isContentEditable)||(tg==='INPUT'&&/^(text|number|search|email|url|tel|password|color)$/i.test(ae.type||'text')))return;
  if(document.querySelector('dialog[open]'))return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();delSel();return}
  if(V.mode==='cam')return;
  const k=(e.key||'').toLowerCase(),T={q:'select',w:'move',e:'rotate',r:'scale'}[k];
  if(T){ST.tool=T;persist();paintBar();X.bump();return}
  if(k==='f')focusSel();
});

/* ===== pasang ke antarmuka ===== */
function init(){
  const ctl=document.querySelector('#s3d .s3-ctl'),view=document.querySelector('#s3d .s3-view'),grp=document.querySelector('#s3d .s3v');
  if(!ctl||!view)return false;
  const tb=document.createElement('div');tb.id='s3-tb';tb.className='s3tb';
  tb.innerHTML='<button class="btn" type="button" data-tool="select" title="Pilih saja, tanpa gizmo (Q)">↖ Pilih</button>'
    +'<button class="btn" type="button" data-tool="move" title="Geser: seret panah X Y Z, atau kotak tengah untuk geser bebas (W)">✥ Geser</button>'
    +'<button class="btn" type="button" data-tool="rotate" title="Putar: seret cincin X Y Z (E)">⟳ Putar</button>'
    +'<button class="btn" type="button" data-tool="scale" title="Ukuran layer: seret belah ketupat oranye (R)">⤢ Ukuran</button>'
    +'<i class="sep"></i>'
    +'<button class="btn" type="button" data-nav="orbit" title="Seret area kosong = putar tampilan">Orbit</button>'
    +'<button class="btn" type="button" data-nav="pan" title="Seret area kosong = geser tampilan">Geser tampilan</button>'
    +'<button class="btn" type="button" data-nav="dolly" title="Seret area kosong naik / turun = zoom">Zoom</button>'
    +'<i class="sep"></i>'
    +'<button class="btn" type="button" data-tg="ak" title="Auto-key: setiap geser / putar langsung jadi keyframe di waktu sekarang">⏺ Auto-key</button>'
    +'<button class="btn" type="button" data-tg="snap" title="Snap: geser kelipatan 10 satuan, putar kelipatan 5°, ukuran kelipatan 0,05">🧲 Snap</button>'
    +'<button class="btn" type="button" data-tg="trail" title="Lintasan gerak objek / kamera terpilih. Ketuk titik kuning untuk loncat ke waktunya">〰 Lintasan</button>'
    +'<i class="sep"></i>'
    +'<button class="btn" type="button" data-view="persp" title="Tampilan perspektif">Persp</button>'
    +'<button class="btn" type="button" data-view="front" title="Tampilan depan">Depan</button>'
    +'<button class="btn" type="button" data-view="side" title="Tampilan samping">Samping</button>'
    +'<button class="btn" type="button" data-view="top" title="Tampilan atas">Atas</button>'
    +'<button class="btn" type="button" data-act="focus" title="Tampilan fokus ke objek terpilih (F)">⌖ Fokus</button>'
    +'<i class="sep"></i>'
    +'<button class="btn" type="button" data-act="camview" title="Pindahkan kamera terpilih ke tempat dan arah tampilan ruang 3D sekarang">📷 Samakan</button>'
    +'<button class="btn danger" type="button" data-act="del" title="Hapus layer atau kamera terpilih (Delete)">🗑 Hapus</button>';
  ctl.insertAdjacentElement('afterend',tb);
  tb.addEventListener('click',onBar);
  if(grp){
    const b=document.createElement('button');b.className='btn';b.type='button';b.id='s3-vguide';
    b.title='Panduan komposisi di hasil render: garis sepertiga, tengah, area aman, info lensa';b.textContent='▦ Panduan';
    b.onclick=()=>{ST.guide=!ST.guide;gsig='';persist();paintBar();placeGuides()};
    grp.appendChild(b);
  }
  gd=document.createElement('canvas');gd.id='s3-gd';gd.setAttribute('aria-hidden','true');view.appendChild(gd);
  const P=$('s3-props');if(P)new MutationObserver(()=>injectBox()).observe(P,{childList:true});
  setInterval(placeGuides,120);
  paintBar();
  return true;
}
try{init()}catch(err){console.error('Alat pro Edit 3D gagal dimuat',err)}
window.APK.s3pro={ST,delSel,camToView,focusSel,setPreset,delKeysAt};
})();
