/* SINEMATIK PRO untuk Edit 3D (add-on, dimuat lewat js/waveform.js setelah semua script lain; scene3d.js tidak diubah).
   Tahap pasca-proses terakhir untuk seluruh layar, dipasang di properti "Efek" (chip ✦ Efek). Meniru gaya edit sinema / GFX:
   1) MOTION BLUR OTOMATIS: blur arah, zoom, dan putaran dihitung dari gerak kamera aktif (pan, tilt, roll, geser, maju-mundur, FOV)
      dan getar kamera, jadi whip pan / crash zoom / dolly langsung punya blur sungguhan. Plus blur arah dan zoom blur manual.
   2) KEDIP WARNA: wash warna (merah dsb., 5 mode campur), gelapkan, saturasi, kontras. Tombol bake kedip ke beat (BPM).
   3) VIGNETTE, FILM GRAIN, PERCIKAN CAHAYA (emas / debu melayang), BOKEH besar, BAR SINEMATIK atas-bawah.
   Semua angka bisa di-keyframe (◆) seperti properti lain, tersimpan di project (fx.props / fx.keys, warna di fx.cine), dan dihitung
   deterministik dari waktu, jadi preview, export frame per frame, dan "→ Editor" hasilnya sama.
   Cara kerja: scene3d.js menggambar ke #s3-cv lalu menulis label waktu (#s3-tlabel). Add-on ini memantau penulisan label itu
   (sinkron, di dalam render()) dan menimpa efeknya ke kanvas yang sama. Kalau semua nilai di nilai awal, tidak ada pekerjaan tambahan. */
(function(){
'use strict';
const $=id=>document.getElementById(id),D=Math.PI/180;
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r3=v=>Math.round(v*1000)/1000;
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const fxItem=()=>{const s=scn();return s&&s.items[1]&&s.items[1].kind==='fx'?s.items[1]:null};

/* ===== definisi properti: [label, min, max, step] ===== */
const DEF={mb:0,mbx:0,mba:0,zb:0,sat:1,con:1,wash:0,dark:0,vig:0,grain:0,spark:0,bokeh:0,bars:0};
const ORDER=['mb','mbx','mba','zb','sat','con','wash','dark','vig','grain','spark','bokeh','bars'];
const PD={
  mb:['Motion blur otomatis (ikut gerak kamera)',0,3,.05],
  mbx:['Blur arah manual (px)',0,200,1],
  mba:['Sudut blur arah (° · 0 = datar, 90 = tegak)',-90,90,1],
  zb:['Zoom blur (dari tengah)',0,1,.01],
  sat:['Saturasi warna',0,2,.01],
  con:['Kontras',.5,2,.01],
  wash:['Wash warna (kedip warna)',0,1,.01],
  dark:['Gelapkan (kedip gelap)',0,1,.01],
  vig:['Vignette (tepi gelap)',0,1,.01],
  grain:['Film grain',0,1,.01],
  spark:['Percikan cahaya (emas / debu)',0,1,.01],
  bokeh:['Bokeh cahaya besar',0,1,.01],
  bars:['Bar sinematik atas-bawah',0,.4,.005]
};
const CINE0={wc:'#ff1a2a',wm:'overlay',vc:'#000000',sc:'#ffcf6b'};
const cine=fx=>Object.assign({},CINE0,(fx&&fx.cine)||{});
function ensure(fx){ORDER.forEach(p=>{if(!(p in fx.props))fx.props[p]=DEF[p]})}
const V=(it,p,t)=>{const v=A().val(it,p,t);return(v==null||!isFinite(v))?(DEF[p]==null?0:DEF[p]):v};
function params(fx,tt){
  const P={};let any=false;
  ORDER.forEach(p=>{const v=V(fx,p,tt);P[p]=v;if(Math.abs(v-DEF[p])>.0015)any=true});
  P.any=any;return P;
}
const hex=h=>{const m=/^#?([0-9a-f]{6})$/i.exec(h||'');const n=m?parseInt(m[1],16):0;return[n>>16&255,n>>8&255,n&255]};
const rgba=(h,a)=>{const c=hex(h);return'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'};

/* ===== gerak kamera -> vektor blur ===== */
const SH=(sh,t)=>({x:sh*14*(Math.sin(t*53)+.6*Math.sin(t*97+1)),y:sh*14*(Math.sin(t*61+2)+.6*Math.sin(t*89)),r:sh*.9*Math.sin(t*71+.5)});
function activeCam(S,tt){let c=S.items[0];(S.cuts||[]).forEach(k=>{if(k.t<=tt+1e-6){const o=S.items.find(i=>i.id===k.cam);if(o&&o.kind==='camera')c=o}});return c}
function motion(S,fx,P,tt,W,H){
  const k=H/1000;let bx=0,by=0,rot=0,s=1;
  const C=window.APK&&APK.s3cam;
  if(P.mb>.001&&C&&C.camPose&&C.mvT){
    const dt=1/30;let a=tt-dt/2,b=tt+dt/2;if(a<0){a=0;b=dt}
    try{
      const cam=activeCam(S,tt),asp=W/H,p0=C.camPose(cam,a,asp),p1=C.camPose(cam,b,asp),R0=p0.R,R1=p1.R,M=new Array(9);
      /* M = R0^T x R1: orientasi kamera b dilihat dari kamera a */
      for(let i=0;i<3;i++)for(let j=0;j<3;j++)M[i*3+j]=R0[i]*R1[j]+R0[3+i]*R1[3+j]+R0[6+i]*R1[6+j];
      const F=p0.F,Z=Math.max(150,p0.fdist||F),fw=Math.max(.2,M[8]);
      bx=-F*M[2]/fw;by=-F*M[5]/fw;rot=Math.atan2(M[3],M[0]);
      const d=C.mvT(R0,[p1.p[0]-p0.p[0],p1.p[1]-p0.p[1],p1.p[2]-p0.p[2]]);
      bx+=-d[0]*F/Z;by+=-d[1]*F/Z;
      const zz=Math.min(Z*.8,d[2]);
      s=(Z/(Z-zz))*(Math.tan(p0.fov*D/2)/Math.tan(p1.fov*D/2));
      const sh=V(fx,'shake',tt);
      if(sh>0){const q0=SH(sh,a),q1=SH(sh,b);bx+=-(q1.x-q0.x)*F/Z;by+=-(q1.y-q0.y)*F/Z;rot+=(q1.r-q0.r)*D}
    }catch(_){bx=by=rot=0;s=1}
    bx*=P.mb*k;by*=P.mb*k;rot*=P.mb;s=1+(s-1)*P.mb;
  }
  if(P.mbx>.5){const an=P.mba*D;bx+=P.mbx*k*Math.cos(an);by+=P.mbx*k*Math.sin(an)}
  if(P.zb>.003)s*=1+P.zb*.22;
  const lim=Math.max(W,H)*.4;
  bx=clamp(bx,-lim,lim);by=clamp(by,-lim,lim);rot=clamp(rot,-.35,.35);s=clamp(s,.7,1.45);
  const ext=Math.hypot(bx,by)+Math.abs(s-1)*Math.max(W,H)*.5+Math.abs(rot)*Math.max(W,H)*.5;
  const n=ext<1.5?0:clamp(Math.ceil(ext/2.2),3,W*H>1.4e6?14:22);
  return{bx,by,rot,s,n};
}

/* ===== kanvas bantu, grain, percikan ===== */
let TMP=null;
function tmp(W,H){if(!TMP)TMP=document.createElement('canvas');if(TMP.width!==W||TMP.height!==H){TMP.width=W;TMP.height=H}return TMP}
const tiles=[],pats=[];
function tile(i){
  if(tiles[i])return tiles[i];
  const c=document.createElement('canvas');c.width=c.height=160;
  const g=c.getContext('2d'),im=g.createImageData(160,160),d=im.data;
  let s=((i+1)*2654435761)>>>0;
  const r=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  for(let p=0;p<d.length;p+=4){const v=clamp(128+(r()+r()-1)*140,0,255);d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}
  g.putImageData(im,0,0);tiles[i]=c;return c;
}
const spr={};
function sprite(col,soft){
  const key=col+(soft?'s':'p');if(spr[key])return spr[key];
  const c=document.createElement('canvas');c.width=c.height=64;
  const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);
  if(soft){gr.addColorStop(0,rgba(col,.3));gr.addColorStop(.72,rgba(col,.55));gr.addColorStop(.9,rgba(col,.2));gr.addColorStop(1,rgba(col,0))}
  else{gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.18,rgba(col,.95));gr.addColorStop(.5,rgba(col,.28));gr.addColorStop(1,rgba(col,0))}
  g.fillStyle=gr;g.fillRect(0,0,64,64);spr[key]=c;return c;
}
let PART=null;
function parts(){
  if(PART)return PART;
  let s=1234567;
  const r=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  PART={sp:[],bk:[]};
  for(let i=0;i<220;i++)PART.sp.push({x:r(),y:r(),v:.025+r()*.09,a:.01+r()*.04,f:.4+r()*1.6,p:r()*6.283,d:Math.pow(r(),1.6),tf:1.5+r()*4,tp:r()*6.283,w:(r()-.5)*.015});
  for(let i=0;i<18;i++)PART.bk.push({x:r(),y:r(),v:.006+r()*.02,a:.02+r()*.03,f:.1+r()*.3,p:r()*6.283,rad:.04+r()*.09,al:.5+r()*.5});
  return PART;
}
const wrap1=v=>((v%1)+1)%1;
function sparks(g,W,H,tt,amt,col){
  const P=parts(),k=H/1000,im=sprite(col,false),n=Math.ceil(P.sp.length*clamp(.25+amt*.75,0,1));
  g.save();g.globalCompositeOperation='lighter';
  for(let i=0;i<n;i++){
    const q=P.sp[i],x=wrap1(q.x+Math.sin(tt*q.f+q.p)*q.a+tt*q.w),y=wrap1(q.y-tt*q.v),R=(4+16*q.d)*k,tw=.55+.45*Math.sin(tt*q.tf+q.tp);
    g.globalAlpha=clamp(amt*(.3+.7*q.d)*tw*1.4,0,1);
    g.drawImage(im,x*W-R,y*H-R,2*R,2*R);
  }
  g.restore();
}
function bokeh(g,W,H,tt,amt,col){
  const P=parts(),im=sprite(col,true);
  g.save();g.globalCompositeOperation='lighter';
  P.bk.forEach(q=>{
    const x=wrap1(q.x+Math.sin(tt*q.f+q.p)*q.a),y=wrap1(q.y-tt*q.v),R=q.rad*H;
    g.globalAlpha=clamp(amt*q.al*.55,0,1);
    g.drawImage(im,x*W-R,y*H-R,2*R,2*R);
  });
  g.restore();
}

/* ===== proses satu frame ===== */
let busy=false,fresh=false,warned=false;
function blur(g,cv,m,W,H){
  const t=tmp(W,H),tg=t.getContext('2d');
  tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='copy';tg.globalAlpha=1;tg.drawImage(cv,0,0);tg.globalCompositeOperation='source-over';
  const cx=W/2,cy=H/2,over=1+Math.min(.08,Math.hypot(m.bx,m.by)/W*.5+Math.abs(m.s-1)*.5+Math.abs(m.rot)*.3);
  g.save();g.globalCompositeOperation='source-over';
  for(let i=0;i<m.n;i++){
    const u=i/(m.n-1)-.5,sc=(1+u*(m.s-1))*over;
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1/(i+1);
    g.translate(cx+u*m.bx,cy+u*m.by);g.rotate(u*m.rot);g.scale(sc,sc);g.translate(-cx,-cy);
    g.drawImage(t,0,0);
  }
  g.restore();
}
function process(cv,S,fx,P,tt){
  const g=cv.getContext('2d'),W=cv.width,H=cv.height,C=cine(fx);
  busy=true;
  try{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if(P.mb>.001||P.mbx>.5||P.zb>.003){const m=motion(S,fx,P,tt,W,H);if(m.n>1)blur(g,cv,m,W,H)}
    if((P.sat!==1||P.con!==1)&&('filter' in g)){
      const t=tmp(W,H),tg=t.getContext('2d');tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='copy';tg.drawImage(cv,0,0);tg.globalCompositeOperation='source-over';
      g.save();g.filter='saturate('+r3(P.sat)+') contrast('+r3(P.con)+')';g.drawImage(t,0,0);g.restore();
    }
    if(P.wash>.002){g.save();g.globalAlpha=clamp(P.wash,0,1);g.globalCompositeOperation=C.wm;g.fillStyle=C.wc;g.fillRect(0,0,W,H);g.restore()}
    if(P.dark>.002){g.save();g.globalAlpha=clamp(P.dark,0,1);g.fillStyle='#000';g.fillRect(0,0,W,H);g.restore()}
    if(P.bokeh>.003)bokeh(g,W,H,tt,P.bokeh,C.sc);
    if(P.spark>.003)sparks(g,W,H,tt,P.spark,C.sc);
    if(P.vig>.003){
      const R=Math.hypot(W,H)/2,gr=g.createRadialGradient(W/2,H/2,R*.25,W/2,H/2,R*1.02);
      gr.addColorStop(0,rgba(C.vc,0));gr.addColorStop(.55,rgba(C.vc,clamp(P.vig,0,1)*.25));gr.addColorStop(1,rgba(C.vc,clamp(P.vig,0,1)));
      g.save();g.fillStyle=gr;g.fillRect(0,0,W,H);g.restore();
    }
    if(P.grain>.003){
      const i=Math.floor(tt*24)%6;let pt=pats[i];if(!pt)pt=pats[i]=g.createPattern(tile(i),'repeat');
      if(pt){const sc=Math.max(1,H/540);g.save();g.scale(sc,sc);g.globalCompositeOperation='overlay';g.globalAlpha=clamp(P.grain*.6,0,1);g.fillStyle=pt;g.fillRect(0,0,W/sc,H/sc);g.restore()}
    }
    if(P.bars>.002){const h=clamp(P.bars,0,.49)*H;g.save();g.fillStyle='#000';g.fillRect(0,0,W,h);g.fillRect(0,H-h,W,h);g.restore()}
  }finally{
    busy=false;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  }
}
function onFrame(label){
  if(!fresh)return;fresh=false;
  const S=scn(),fx=fxItem(),cv=$('s3-cv');if(!S||!fx||!cv)return;
  ensure(fx);
  const tt=parseFloat(label)||0,P=params(fx,tt);if(!P.any)return;
  process(cv,S,fx,P,tt);
}

/* ===== pemasangan kait ke render() scene3d.js ===== */
function install(){
  const cv=$('s3-cv'),lab=$('s3-tlabel');if(!cv||!lab||lab.__cine)return false;
  const g=cv.getContext('2d');
  if(g&&!g.__cine){   /* tanda bahwa post() sudah menggambar frame baru ke kanvas */
    const od=g.drawImage;
    g.drawImage=function(){if(!busy)fresh=true;return od.apply(this,arguments)};
    g.__cine=1;
  }
  const d=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  Object.defineProperty(lab,'textContent',{configurable:true,
    get(){return d.get.call(this)},
    set(v){d.set.call(this,v);try{onFrame(v)}catch(e){if(!warned){warned=true;console.error('Sinematik Pro gagal diproses',e)}}}});
  lab.__cine=1;return true;
}

/* ===== keyframe (dipasang di waktu sekarang) ===== */
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=r3(v);k.e=e||k.e}else{a.push({t:r3(Math.max(0,t)),v:r3(v),e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
function clearRange(it,p,a,b){const arr=it.keys[p];if(!arr)return;it.keys[p]=arr.filter(k=>k.t<a-.001||k.t>b+.001);if(!it.keys[p].length)delete it.keys[p]}
/* lonjakan: nilai awal -> puncak -> kembali ke nilai awal */
function spike(it,p,a,b,c,peak){const v=V(it,p,a);clearRange(it,p,a,c);K(it,p,a,v,'linear');K(it,p,b,peak,'out');K(it,p,c,v,'inout')}
function angle(it,a0,t0,t1){const v=V(it,'mba',t0);clearRange(it,'mba',t0,t1+.05);K(it,'mba',t0,a0,'linear');K(it,'mba',t1,a0,'linear');K(it,'mba',t1+.05,v,'linear')}
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function touchLite(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().render()}catch(_){}}
let NBPM=120,NDUR=6;

const LOOKS={
  merah:{p:{vig:.6,wash:.22,sat:1.2,con:1.15,grain:.25,spark:.55,mb:1,bokeh:.25},c:{wc:'#ff1020',wm:'overlay',vc:'#1a0000',sc:'#ffc65a'}},
  film:{p:{vig:.4,wash:.12,sat:1.05,con:1.1,grain:.35,mb:1,bars:.1},c:{wc:'#ffb066',wm:'overlay',vc:'#000000',sc:'#ffd9a0'}},
  dingin:{p:{vig:.45,wash:.2,sat:.9,con:1.15,grain:.22,spark:.25,mb:1,bokeh:.15},c:{wc:'#3a7bff',wm:'overlay',vc:'#00040f',sc:'#bcd6ff'}}
};
function look(name){
  const fx=fxItem();if(!fx)return;ensure(fx);
  if(name==='reset'){ORDER.forEach(p=>{fx.props[p]=DEF[p];delete fx.keys[p]});delete fx.cine;touch();toast('Efek sinematik di-reset');return}
  const L=LOOKS[name];if(!L)return;
  ORDER.forEach(p=>{fx.props[p]=(p in L.p)?L.p[p]:DEF[p];delete fx.keys[p]});
  fx.cine=Object.assign({},CINE0,L.c);touch();toast('Look dipasang. Atur lewat slider, atau pakai tombol kedip beat.');
}
function beat(fx,kind,t0,dur){
  const st=60/clamp(NBPM,40,240),t1=Math.min(t0+NDUR,dur),n=Math.min(300,Math.floor((t1-t0)/st));
  if(n<1){toast('Durasi terlalu pendek untuk BPM ini');return false}
  const ps=kind==='bwash'?['wash']:kind==='bdark'?['dark']:['wash','dark'];
  ps.forEach(p=>clearRange(fx,p,t0,t1+.001));
  for(let i=0;i<n;i++){
    const b=t0+i*st;
    ps.forEach(p=>{
      const on=kind!=='balt'||((i%2===0)===(p==='wash')),pk=on?(p==='wash'?.9:.7):0;
      K(fx,p,b,0,'linear');if(pk>0){K(fx,p,b+.025,pk,'out');K(fx,p,b+st*.6,0,'inout')}
    });
  }
  ps.forEach(p=>K(fx,p,t1,0,'linear'));
  return true;
}
function quick(kind){
  const S=scn(),fx=fxItem();if(!S||!fx)return;
  ensure(fx);
  const t0=curT(),dur=S.dur,names={
    impact:'Impact',whip:'Whip blur',tilt:'Tilt blur',zpunch:'Zoom blur punch',barin:'Bar masuk',barout:'Bar keluar',
    bwash:'Kedip warna ke beat',bdark:'Kedip gelap ke beat',balt:'Kedip merah ↔ gelap'};
  if(kind==='mbauto'){
    const on=V(fx,'mb',t0)>.001;fx.props.mb=on?0:1;delete fx.keys.mb;touch();
    toast(on?'Motion blur otomatis dimatikan':'Motion blur otomatis aktif: blur mengikuti gerak kamera');return;
  }
  if(kind==='boff'){['wash','dark'].forEach(p=>{fx.props[p]=0;delete fx.keys[p]});touch();toast('Kedipan dihapus');return}
  if(dur-t0<.4){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal atau perpanjang durasi.');return}
  if(kind==='impact'){
    spike(fx,'mbx',t0,t0+.1,t0+.45,110);angle(fx,0,t0,t0+.45);spike(fx,'zb',t0,t0+.08,t0+.4,.55);
    spike(fx,'flash',t0,t0+.04,t0+.3,.45);spike(fx,'ca',t0,t0+.1,t0+.5,14);spike(fx,'shake',t0,t0+.08,t0+.55,.5);
  }else if(kind==='whip'){
    spike(fx,'mbx',t0,t0+.12,t0+.35,150);angle(fx,0,t0,t0+.35);spike(fx,'ca',t0,t0+.15,t0+.4,10);
  }else if(kind==='tilt'){
    spike(fx,'mbx',t0,t0+.12,t0+.35,150);angle(fx,90,t0,t0+.35);
  }else if(kind==='zpunch'){
    spike(fx,'zb',t0,t0+.06,t0+.35,.8);spike(fx,'flash',t0,t0+.03,t0+.25,.3);
  }else if(kind==='barin'){
    const v=V(fx,'bars',t0);clearRange(fx,'bars',t0,t0+.6);K(fx,'bars',t0,v,'inout');K(fx,'bars',t0+.6,.11,'out');
  }else if(kind==='barout'){
    const v=V(fx,'bars',t0);clearRange(fx,'bars',t0,t0+.5);K(fx,'bars',t0,v,'inout');K(fx,'bars',t0+.5,0,'inout');
  }else if(/^b(wash|dark|alt)$/.test(kind)){
    if(!beat(fx,kind,t0,dur))return;
  }else return;
  touch();toast((names[kind]||'Efek')+' dipasang di '+t0.toFixed(2)+' dtk. Tekan ↶ untuk membatalkan.');
}

/* ===== kartu di properti Efek ===== */
function rowHTML(fx,p){
  const d=PD[p],tt=curT(),v=V(fx,p,tt),r=Math.round(v*1000)/1000,a=fx.keys[p],has=!!(a&&a.some(k=>Math.abs(k.t-tt)<.02)),an=a&&a.length;
  return'<div class="s3-f"><div class="s3-lab"><span>'+esc(d[0])+'</span><span class="s3-kf"><button type="button" data-go="-1" data-p="'+p+'" title="Keyframe sebelumnya">◀</button><button type="button" class="'+(has?'on':an?'half':'')+'" data-kf="'+p+'" title="Tambah / hapus keyframe di waktu sekarang">◆</button><button type="button" data-go="1" data-p="'+p+'" title="Keyframe berikutnya">▶</button></span></div>'
   +'<div class="s3-in"><input type="range" data-p="'+p+'" min="'+d[1]+'" max="'+d[2]+'" step="'+d[3]+'" value="'+r+'"><input type="number" data-p="'+p+'" min="'+d[1]+'" max="'+d[2]+'" step="'+d[3]+'" value="'+r+'"></div></div>';
}
function cardHTML(fx){
  const C=cine(fx),btn=(k,t,tip)=>'<button class="btn" type="button" data-ncq="'+k+'" title="'+esc(tip||t)+'">'+t+'</button>';
  const bm=[['overlay','Overlay (disarankan)'],['color','Warna (ganti rona)'],['multiply','Multiply (gelap berwarna)'],['screen','Screen (terang)'],['source-over','Biasa (menutup)']];
  return'<b>🎞 Sinematik Pro</b>'
   +'<p class="s3-hint">Efek lapisan akhir seluruh layar ala edit sinema. Motion blur otomatis menghitung blur dari gerak kamera (whip pan, crash zoom, dolly, getar). Semua angka bisa di-keyframe (◆) dan ikut export.</p>'
   +'<div class="s3n-sub">Hentakan (dipasang di waktu sekarang)</div><div class="s3n-row">'
   +btn('mbauto','⟲ Blur otomatis ON/OFF','Nyalakan / matikan motion blur yang mengikuti gerak kamera')
   +btn('impact','💥 Impact','Blur arah + zoom blur + kilat + pisah warna + getar')
   +btn('whip','↔ Whip blur','Blur datar singkat + pisah warna')+btn('tilt','↕ Tilt blur','Blur tegak singkat')+btn('zpunch','◎ Zoom blur punch','Zoom blur singkat dari tengah')
   +btn('barin','▬ Bar masuk')+btn('barout','Bar keluar')+'</div>'
   +'<div class="s3n-sub">Kedip ke beat (dibuat jadi keyframe)</div>'
   +'<div class="s3-two"><label class="s3-fl">BPM<input type="number" data-ncs="bpm" min="40" max="240" value="'+NBPM+'"></label><label class="s3-fl">Lama (dtk)<input type="number" data-ncs="dur" min="1" max="120" step="0.5" value="'+NDUR+'"></label></div>'
   +'<div class="s3n-row">'+btn('bwash','🔴 Kedip warna')+btn('bdark','⚫ Kedip gelap')+btn('balt','🔴⚫ Bergantian')+btn('boff','Hapus kedipan')+'</div>'
   +'<label class="s3-fl">Look siap pakai<select data-ncs="look"><option value="">Pilih look…</option><option value="merah">Merah dramatis (vignette, grain, percikan emas)</option><option value="film">Film hangat</option><option value="dingin">Dingin malam</option><option value="reset">Reset semua efek sinematik</option></select></label>'
   +ORDER.map(p=>rowHTML(fx,p)).join('')
   +'<div class="s3-two"><label class="s3-fl">Warna wash<input type="color" data-ncs="wc" value="'+C.wc+'"></label><label class="s3-fl">Campur wash<select data-ncs="wm">'+bm.map(o=>'<option value="'+o[0]+'"'+(o[0]===C.wm?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></label></div>'
   +'<div class="s3-two"><label class="s3-fl">Warna vignette<input type="color" data-ncs="vc" value="'+C.vc+'"></label><label class="s3-fl">Warna percikan / bokeh<input type="color" data-ncs="sc" value="'+C.sc+'"></label></div>';
}
function inject(){
  const P=$('s3-props'),fx=fxItem();
  if(!P||!fx||selId()!=='fx'||P.querySelector('#s3n-card'))return;
  ensure(fx);
  const d=document.createElement('div');d.id='s3n-card';d.innerHTML=cardHTML(fx);P.appendChild(d);
}
function onField(e){
  const el=e.target;if(!el||!el.closest||!el.closest('#s3n-card')||!el.dataset.ncs)return;
  const k=el.dataset.ncs,fx=fxItem();if(!fx)return;
  const isColor=el.type==='color',ev=e.type;
  if(k==='bpm'){if(ev==='change')NBPM=clamp(parseFloat(el.value)||120,40,240);return}
  if(k==='dur'){if(ev==='change')NDUR=clamp(parseFloat(el.value)||6,1,120);return}
  if(k==='look'){if(ev==='change'&&el.value){const v=el.value;el.value='';look(v)}return}
  if(!/^(wc|wm|vc|sc)$/.test(k))return;
  if(isColor?ev==='input'||ev==='change':ev==='change'){
    fx.cine=Object.assign(cine(fx),{[k]:el.value});
    if(ev==='change')touchLite();else try{A().render()}catch(_){}
  }
}
function boot(){
  if(!$('s3d')||!$('s3-cv'))return;
  if(!document.getElementById('s3n-style')){
    const st=document.createElement('style');st.id='s3n-style';
    st.textContent='#s3n-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--panel)}#s3n-card>b{display:block;margin-bottom:8px}'
     +'.s3n-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.s3n-row .btn{flex:0 0 auto;white-space:nowrap;padding:6px 10px;font-size:13px;line-height:1.2}'
     +'.s3n-sub{font-size:12.5px;font-weight:600;margin:10px 0 6px}';
    document.head.appendChild(st);
  }
  install();
  const P=$('s3-props');if(P)new MutationObserver(inject).observe(P,{childList:true});
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#s3n-card [data-ncq]');if(b)quick(b.dataset.ncq)});
  document.addEventListener('input',onField);document.addEventListener('change',onField);
  inject();
}
try{boot()}catch(e){console.error('Sinematik Pro gagal dimuat',e)}
})();
