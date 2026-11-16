/* MODEL 3D untuk Edit 3D (dipakai js/scene3d.js, dimuat otomatis saat dibutuhkan): .glb .gltf .obj (+ .mtl dan tekstur) .stl .fbx
   Cara kerja: model dirender dengan Three.js (WebGL) di kanvas tersembunyi memakai kamera yang SAMA dengan kamera Edit 3D, lalu
   hasilnya ditempel ke kanvas 2D sebagai layer. Jadi kamera, keyframe, parent, opasitas, efek, dan export ikut bekerja seperti layer lain.
   Pustaka Three.js (r128) dimuat dari jsDelivr hanya saat ada model, jadi butuh internet sekali per sesi (di-cache browser).
   Konversi sumbu: dunia Edit 3D (x kanan, y BAWAH, z maju) -> Three.js (x kanan, y ATAS, z mundur) lewat T = diag(1,-1,-1), yaitu
   putaran 180 derajat di sumbu x (bukan cermin). Kamera: R3 = T R T, posisi = T p. Model dinormalkan: pusat di titik asal, sisi terpanjang 600 satuan.
   Berkas model disimpan di IndexedDB 'media' milik Edit 3D; item menyimpan: mediaId (berkas utama), files [{id,name}] (mtl, tekstur, bin), fmt. */
(function(){
'use strict';
window.APK=window.APK||{};
if(APK.s3model)return;
const CDN='https://cdn.jsdelivr.net/npm/three@0.128.0/';
const LIB={
  base:['build/three.min.js'],
  glb:['examples/js/loaders/GLTFLoader.js'],
  gltf:['examples/js/loaders/GLTFLoader.js'],
  obj:['examples/js/loaders/MTLLoader.js','examples/js/loaders/OBJLoader.js'],
  stl:['examples/js/loaders/STLLoader.js'],
  fbx:['examples/js/libs/fflate.min.js','examples/js/curves/NURBSUtils.js','examples/js/curves/NURBSCurve.js','examples/js/loaders/FBXLoader.js']
};
const ORDER=['glb','gltf','obj','fbx','stl'];
const ext=n=>String(n||'').split('.').pop().toLowerCase();
const base=n=>String(n||'').split(/[\\/]/).pop().split('?')[0].toLowerCase();

const loaded=new Map();
function loadScript(src){
  if(loaded.has(src))return loaded.get(src);
  const p=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=src;s.onload=res;
    s.onerror=()=>{loaded.delete(src);rej(new Error('tidak bisa memuat '+src.split('/').pop()+' (butuh internet)'))};
    document.head.appendChild(s);
  });
  loaded.set(src,p);return p;
}
async function need(fmt){
  for(const f of LIB.base)await loadScript(CDN+f);
  for(const f of LIB[fmt]||[])await loadScript(CDN+f);
}

/* pilih berkas utama dari beberapa berkas yang dipilih; sisanya (mtl, tekstur, bin) ikut disimpan */
async function prepare(files,store){
  const list=[...files];let main=null;
  for(const o of ORDER){main=list.find(f=>ext(f.name)===o);if(main)break}
  if(!main)throw new Error('format tidak didukung. Pilih berkas .glb, .gltf, .obj, .fbx, atau .stl (untuk .obj pilih sekalian .mtl dan teksturnya)');
  const mediaId=await store(main),extra=[];
  for(const f of list){if(f===main)continue;extra.push({id:await store(f),name:f.name})}
  return{fmt:ext(main.name),mediaId:mediaId,files:extra,name:main.name.replace(/\.[^.]+$/,'').slice(0,18)||'Model'};
}

const cache=new Map();
const key=it=>it.id+'|'+it.mediaId;
const state=it=>cache.get(key(it))||{};
function defMat(){const T=THREE;return new T.MeshStandardMaterial({color:0xc8ccd8,roughness:.55,metalness:.1,side:T.DoubleSide})}

/* bentuk dasar tanpa berkas (fmt 'prim'): kubus, bola, silinder, kerucut, donat, piramida, kapsul. Warna dibaca ulang tiap frame di draw() */
/* TOKOH: tokoh kartun berkepala besar (ala film animasi) dari bentuk dasar bersendi. Gerakannya dihitung dari rumus (tanpa berkas),
   jadi semua kecepatan, ulang, dan scrub memakai mesin klip yang sama dengan model berkerangka. Menghadap +z (ke arah kamera). */
const CHAR_CLIPS=[['Diam bernapas',3,'idle'],['Jalan',1,'walk'],['Lari',.6,'run'],['Lambai',2,'wave'],['Lompat',1.2,'jump'],['Menari',2,'dance']];
function buildChar(it,s){
  const T=THREE,G=T.Group,M=c=>new T.MeshStandardMaterial({color:new T.Color(c),roughness:.55,metalness:.05,side:T.DoubleSide});
  const body=M(it.color||'#ff7a59'),skin=M(it.skin||'#f4c7a1'),hair=M(it.hair||'#4a2f20'),white=M('#ffffff'),dark=M('#1b1b22'),pants=M('#34406a'),shoe=M('#2a2a35');
  const sph=r=>new T.SphereGeometry(r,28,20);
  const mesh=(g,m,x,y,z,sx,sy,sz)=>{const o=new T.Mesh(g,m);o.position.set(x||0,y||0,z||0);if(sx!=null)o.scale.set(sx,sy,sz);return o};
  const root=new G(),torso=new G(),head=new G();
  torso.add(mesh(sph(55),body,0,60,0,1,1.15,.8));
  head.position.set(0,150,0);
  head.add(mesh(sph(58),skin,0,22,0));
  head.add(mesh(new T.SphereGeometry(61,28,14,0,Math.PI*2,0,Math.PI*.34),hair,0,24,-6));
  const eyeW=[],eyeP=[],brows=[];
  for(const sx of[-1,1]){
    const w=mesh(sph(13),white,sx*22,28,50,1,1.25,.7),p=mesh(sph(6.5),dark,sx*22,28,58.5,.9,1.2,.5);
    head.add(w,p);eyeW.push(w);eyeP.push(p);
    const b=mesh(new T.BoxGeometry(20,4.5,4),hair,sx*22,50,48);head.add(b);brows.push(b);
  }
  head.add(mesh(sph(7),skin,0,14,58));
  const smile=mesh(new T.TorusGeometry(14,2.6,8,20,Math.PI),dark,0,2,54);smile.rotation.z=Math.PI;head.add(smile);
  const mouthO=mesh(sph(10),dark,0,-2,53,1.3,.05,.5);mouthO.visible=false;head.add(mouthO);
  const arm=sx=>{const g=new G();g.position.set(sx*66,108,0);g.add(mesh(new T.CylinderGeometry(13,12,70,16),body,0,-35,0));g.add(mesh(sph(14),skin,0,-78,0));return g};
  const leg=sx=>{const g=new G();g.position.set(sx*28,5,0);g.add(mesh(new T.CylinderGeometry(17,15,70,16),pants,0,-35,0));g.add(mesh(sph(18),shoe,0,-76,10,1,.6,1.6));return g};
  const armL=arm(-1),armR=arm(1),legL=leg(-1),legR=leg(1);
  root.add(torso,head,armL,armR,legL,legR);
  s.char={root:root,torso:torso,head:head,armL:armL,armR:armR,legL:legL,legR:legR,mats:{body:body,skin:skin,hair:hair},eyeW:eyeW,eyeP:eyeP,brows:brows,smile:smile,mouthO:mouthO};
  s.anims=CHAR_CLIPS.map(c=>({name:c[0],duration:c[1],proc:c[2]}));
  return root;
}
/* atur sendi tokoh untuk klip 'proc' di detik t (detik di dalam klip). proc kosong = pose berdiri. */
function poseChar(c,proc,t){
  const P=Math.PI*2,sn=Math.sin,ab=Math.abs;
  const list=[c.root,c.torso,c.head,c.armL,c.armR,c.legL,c.legR];
  list.forEach(o=>o.rotation.set(0,0,0));
  c.root.position.set(0,0,0);c.torso.scale.set(1,1,1);
  c.armL.rotation.z=-.1;c.armR.rotation.z=.1;
  if(proc==='idle'){
    const b=sn(P*t/3);c.torso.scale.set(1+.012*b,1+.02*b,1);c.head.rotation.z=.05*sn(P*t/3+1);
    c.armL.rotation.z=-.1-.03*b;c.armR.rotation.z=.1+.03*b;c.head.position.y=150+1.5*b;
  }else if(proc==='walk'||proc==='run'){
    const run=proc==='run',ph=P*t/(run?.6:1),a=run?1.0:.7,w=run?1.1:.6;
    c.legL.rotation.x=sn(ph)*a;c.legR.rotation.x=-sn(ph)*a;
    c.armL.rotation.x=-sn(ph)*w;c.armR.rotation.x=sn(ph)*w;
    c.root.position.y=ab(sn(ph))*(run?16:8);c.root.rotation.z=sn(ph)*.04;c.root.rotation.y=sn(ph)*.08;
    if(run){c.root.rotation.x=.18;c.armL.rotation.z=-.25;c.armR.rotation.z=.25}
  }else if(proc==='wave'){
    c.armR.rotation.z=2.55+.32*sn(P*t*1.5);c.armR.rotation.x=0;
    c.head.rotation.z=-.1;c.root.rotation.z=.03*sn(P*t/2);
    c.legL.rotation.x=0;c.legR.rotation.x=0;
  }else if(proc==='jump'){
    const u=Math.min(1,Math.max(0,t/1.2)),air=Math.sin(Math.PI*Math.min(1,Math.max(0,(u-.2)/.6)));
    const cr=u<.2?Math.sin(Math.PI*u/.2):(u>.8?Math.sin(Math.PI*(u-.8)/.2):0);
    c.root.position.y=150*air-18*cr;c.torso.scale.set(1+.05*cr,1-.06*cr,1);
    c.armL.rotation.z=-.1-2.2*air;c.armR.rotation.z=.1+2.2*air;
    c.legL.rotation.x=-.5*air+.2*cr;c.legR.rotation.x=-.35*air+.2*cr;
  }else if(proc==='dance'){
    const ph=P*t/2,b=sn(ph*2);
    c.root.position.y=ab(b)*14;c.root.rotation.y=.45*sn(ph);c.root.rotation.z=.06*sn(ph*2);
    c.armR.rotation.z=1.7+.8*sn(ph*2);c.armL.rotation.z=-(1.7+.8*sn(ph*2+Math.PI));
    c.legL.rotation.x=.25*sn(ph*2);c.legR.rotation.x=-.25*sn(ph*2);c.head.rotation.z=.15*sn(ph*2);
  }
  if(proc!=='idle')c.head.position.y=150;
}
/* wajah tokoh: f = {smile -1..1 (sedih..senyum), brow -1..1 (marah..alis naik), mouth 0..1 (mulut terbuka)}; kedip otomatis tiap ±3,4 detik */
function faceChar(c,f,t){
  f=f||{};
  const cl=(v,a,b)=>Math.min(b,Math.max(a,+v||0)),sm=cl(f.smile,-1,1),br=cl(f.brow,-1,1),mo=cl(f.mouth,0,1);
  const ph=((t%3.4)+3.4)%3.4/3.4,bl=ph<.04?Math.sin(Math.PI*ph/.04):0;
  c.eyeW.forEach(e=>e.scale.set(1,1.25*(1-.92*bl),.7));c.eyeP.forEach(e=>e.scale.set(.9,1.2*(1-.92*bl),.5));
  c.brows.forEach((b,i)=>{const sx=i?1:-1;b.rotation.z=sx*(-br)*.45;b.position.y=50+(br>0?10*br:4*br)});
  const a=Math.abs(sm);
  c.smile.rotation.z=sm>=0?Math.PI:0;c.smile.scale.set(1+.1*a,.12+.58*a,1);
  c.mouthO.visible=mo>.04;c.mouthO.scale.set(1.3,.05+1.0*mo,.5);c.mouthO.position.y=-2-4*mo;
  c.smile.visible=mo<.6;
}
function makePrim(it,s){
  const T=THREE,k=it.prim||'cube',S=300;
  if(k==='char')return buildChar(it,s);
  let g;
  if(k==='sphere')g=new T.SphereGeometry(S/2,40,28);
  else if(k==='cylinder')g=new T.CylinderGeometry(S/3,S/3,S,40);
  else if(k==='cone')g=new T.ConeGeometry(S/2.4,S,40);
  else if(k==='torus')g=new T.TorusGeometry(S/3,S/8,24,56);
  else if(k==='pyramid')g=new T.ConeGeometry(S/2,S,4);
  else if(k==='capsule')g=T.CapsuleGeometry?new T.CapsuleGeometry(S/5,S*.55,8,24):new T.CylinderGeometry(S/5,S/5,S,24);
  else g=new T.BoxGeometry(S,S,S);
  const mat=new T.MeshStandardMaterial({color:new T.Color(it.color||'#4da3ff'),roughness:.4,metalness:.15,side:T.DoubleSide});
  return new T.Mesh(g,mat);
}
async function parse(it,getRec,s){
  const fmt=String(it.fmt||'').toLowerCase();
  if(fmt==='prim'){
    await need('base');
    const T=THREE,obj=makePrim(it,s);s.urls=[];if(obj.material)s.mat=obj.material;
    const box=new T.Box3().setFromObject(obj),size=new T.Vector3(),ctr=new T.Vector3();
    box.getSize(size);box.getCenter(ctr);
    const sc=600/(Math.max(size.x,size.y,size.z)||1),inner=new T.Group(),pivot=new T.Group();
    obj.position.sub(ctr);inner.add(obj);inner.scale.setScalar(sc);pivot.add(inner);pivot.matrixAutoUpdate=false;
    s.pivot=pivot;s.half=[size.x*sc/2,size.y*sc/2,size.z*sc/2];s.anims=s.anims||[];
    return;
  }
  await need(fmt);
  const T=THREE,main=await getRec(it.mediaId);
  if(!main||!main.blob)throw new Error('berkas model tidak ada di perangkat ini, impor ulang model');
  const urls=new Map();s.urls=[];
  for(const f of it.files||[]){
    const r=await getRec(f.id);
    if(r&&r.blob){const u=URL.createObjectURL(r.blob);s.urls.push(u);urls.set(base(f.name),{u:u,blob:r.blob})}
  }
  const mgr=new T.LoadingManager();
  mgr.setURLModifier(u=>{
    if(/^data:/.test(u))return u;
    let b;try{b=base(decodeURIComponent(u))}catch(e){b=base(u)}
    const h=urls.get(b);return h?h.u:u;
  });
  let obj;
  if(fmt==='glb'||fmt==='gltf'){
    const url=URL.createObjectURL(main.blob);s.urls.push(url);
    obj=await new Promise((res,rej)=>new T.GLTFLoader(mgr).load(url,g=>{s.anims=g.animations||[];res(g.scene)},undefined,()=>rej(new Error('berkas GLTF/GLB tidak bisa dibaca'))));
  }else if(fmt==='obj'){
    const txt=await main.blob.text(),OL=new T.OBJLoader(mgr),m=txt.match(/^\s*mtllib\s+(.+?)\s*$/m),mh=m&&urls.get(base(m[1]));
    if(mh){const mats=new T.MTLLoader(mgr).parse(await mh.blob.text(),'');mats.preload();OL.setMaterials(mats)}
    obj=OL.parse(txt);
    obj.traverse(o=>{
      if(!o.isMesh)return;
      if(!mh)o.material=defMat();
      else[].concat(o.material).forEach(mm=>{mm.side=T.DoubleSide;if(mm.map)mm.map.encoding=T.sRGBEncoding});
      if(o.geometry&&!o.geometry.attributes.normal)o.geometry.computeVertexNormals();
    });
  }else if(fmt==='stl'){
    const g=new T.STLLoader().parse(await main.blob.arrayBuffer());
    if(!g.attributes.normal)g.computeVertexNormals();
    obj=new T.Mesh(g,defMat());
  }else if(fmt==='fbx'){
    obj=new T.FBXLoader(mgr).parse(await main.blob.arrayBuffer(),'');
    s.anims=obj.animations||[];
  }else throw new Error('format tidak didukung: '+fmt);
  s.anims=s.anims||[];s.root=obj;
  /* model beranimasi (rangka / skin): jangan dibuang kamera karena kotak pembatasnya diambil dari pose awal */
  if(s.anims.length)obj.traverse(o=>{o.frustumCulled=false});
  /* normalkan: pusat di titik asal, sisi terpanjang 600 satuan (tinggi layar = 1000) */
  const box=new T.Box3().setFromObject(obj),size=new T.Vector3(),ctr=new T.Vector3();
  box.getSize(size);box.getCenter(ctr);
  if(!isFinite(size.x+size.y+size.z)||size.x+size.y+size.z===0)throw new Error('model kosong atau tidak punya geometri');
  const sc=600/(Math.max(size.x,size.y,size.z)||1),inner=new T.Group(),pivot=new T.Group();
  obj.position.sub(ctr);inner.add(obj);inner.scale.setScalar(sc);pivot.add(inner);pivot.matrixAutoUpdate=false;
  s.pivot=pivot;s.half=[size.x*sc/2,size.y*sc/2,size.z*sc/2];
}
function load(it,getRec,force){
  const k=key(it);let s=cache.get(k);
  if(s&&s.ready)return Promise.resolve(s);
  if(s&&s.loading)return s.promise;
  if(s&&s.error&&!force)return Promise.resolve(s);
  s={loading:true};cache.set(k,s);
  s.promise=parse(it,getRec,s).then(()=>{s.ready=true;s.loading=false;return s},e=>{s.loading=false;s.error=(e&&e.message)||String(e);throw e});
  return s.promise;
}
function drop(id){
  for(const [k,s] of [...cache]){
    if(k.indexOf(id+'|')!==0)continue;
    (s.urls||[]).forEach(u=>{try{URL.revokeObjectURL(u)}catch(e){}});
    cache.delete(k);
  }
}

/* ===== animasi klip bawaan model (glb / gltf / fbx) =====
   it.mc = {clip:indeks klip (-1 = diam), speed:kecepatan, mode:'loop'|'once'|'ping', off:mulai dari detik ke-n di dalam klip}.
   Waktu klip dihitung dari waktu scene, jadi hasilnya sama saat preview, scrub, dan export frame per frame. */
function clips(it){
  const s=state(it);
  return(s.anims||[]).map((c,i)=>({i:i,name:c.name||('Klip '+(i+1)),dur:c.duration||0}));
}
function clipTime(it,mc,dur,t){
  const sp=mc.speed==null?1:mc.speed;
  let lt=(t-(it.start||0))*sp+(mc.off||0);
  if(lt<0)lt=0;
  if(mc.mode==='once')return Math.min(lt,dur);
  if(mc.mode==='ping'){const p=lt%(dur*2);return p>dur?dur*2-p:p}
  return lt%dur;
}
function pose(it,s,t,face){
  const T=THREE;
  if(s.mat&&it.color)s.mat.color.set(it.color);
  if(s.char){
    const c=s.char;c.mats.body.color.set(it.color||'#ff7a59');c.mats.skin.color.set(it.skin||'#f4c7a1');c.mats.hair.color.set(it.hair||'#4a2f20');
    const mc=it.mc,clip=mc&&mc.clip!=null&&mc.clip>=0?s.anims[mc.clip]:null;
    if(!clip||t==null)poseChar(c,'',0);
    else poseChar(c,clip.proc,clipTime(it,mc,Math.max(clip.duration,1e-3),t));
    faceChar(c,face,t==null?0:t);return;
  }
  if(!s.anims||!s.anims.length||!s.root||t==null)return;
  const mc=it.mc,clip=mc&&mc.clip!=null&&mc.clip>=0?s.anims[mc.clip]:null;
  if(!clip){
    if(s.mixer&&s.cur!=null){s.mixer.stopAllAction();s.mixer.update(0);s.cur=null;s.act=null}
    return;
  }
  if(!s.mixer)s.mixer=new T.AnimationMixer(s.root);
  if(s.cur!==mc.clip){
    s.mixer.stopAllAction();
    s.act=s.mixer.clipAction(clip);s.act.setLoop(T.LoopRepeat,Infinity);s.act.play();s.cur=mc.clip;
  }
  s.act.time=clipTime(it,mc,Math.max(clip.duration,1e-3),t);s.mixer.update(0);
}

/* ===== cahaya film =====
   it.lk = {p: preset cahaya, sh: bayangan di lantai}. Tanpa it.lk, tampilan model sama seperti sebelumnya.
   Preset memakai tiga lampu: utama (key), isian lembut (amb), dan lampu pinggir dari belakang (rim) yang memberi garis cahaya di tepi tokoh,
   ditambah tone mapping filmik. Lantai bayangan adalah bidang tak terlihat tepat di bawah model yang hanya menerima bayangan. */
const LOOK={
  neutral:{n:'Netral',key:[0xffffff,1.1],amb:[0xffffff,.55],rim:[0xffffff,0],exp:1},
  film:{n:'Tiga titik ala film',key:[0xfff0dc,1.35],amb:[0xc0d2ff,.7],rim:[0xffffff,1],exp:1.05},
  warm:{n:'Hangat (sore)',key:[0xffd6a0,1.5],amb:[0xb08a6a,.55],rim:[0xff9a55,1],exp:1.05},
  cool:{n:'Dingin (malam)',key:[0xa8c4ff,1.1],amb:[0x3a4a80,.6],rim:[0x5aa0ff,1.2],exp:1},
  drama:{n:'Dramatis',key:[0xffffff,1.9],amb:[0x202030,.25],rim:[0xffffff,1.6],exp:1.1}
};
function setShadow(s,on){
  const T=THREE;
  if(on&&!s.floor){
    const m=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.ShadowMaterial({opacity:.4}));
    m.rotation.x=-Math.PI/2;m.receiveShadow=true;s.floor=m;s.pivot.add(m);
  }
  if(s.floor){s.floor.visible=!!on;s.floor.position.set(0,-s.half[1],0)}
  if(s.shOn!==!!on){s.shOn=!!on;s.pivot.traverse(o=>{if(o.isMesh&&o!==s.floor)o.castShadow=!!on})}
}
function lighting(r,s,it,Wd,cam,L){
  const T=THREE,lk=it.lk,P=lk?LOOK[lk.p||'neutral']||LOOK.neutral:null;
  if(!P){
    r.amb.color.set(0xffffff);r.amb.intensity=.55*L;r.dir.color.set(0xffffff);r.dir.intensity=1.1*L;
    r.rim.visible=false;r.dir.castShadow=false;r.renderer.toneMapping=T.NoToneMapping;
    const cp=new T.Vector3(0,0,0).applyMatrix4(cam.matrixWorld);
    r.dir.position.set(-500,700,900).applyMatrix4(cam.matrixWorld);r.dir.target.position.copy(cp);
    if(s.floor||s.shOn)setShadow(s,false);
    return;
  }
  const Pw=new T.Vector3().setFromMatrixPosition(s.pivot.matrix),pc=Pw.clone().applyMatrix4(cam.matrixWorldInverse),ws=Math.max(Wd.s||1,.05);
  r.amb.color.set(P.amb[0]);r.amb.intensity=P.amb[1]*L;
  r.dir.color.set(P.key[0]);r.dir.intensity=P.key[1]*L;
  r.dir.position.set(pc.x-500*ws,pc.y+700*ws,pc.z+900*ws).applyMatrix4(cam.matrixWorld);r.dir.target.position.copy(Pw);
  r.rim.visible=P.rim[1]>0;r.rim.color.set(P.rim[0]);r.rim.intensity=P.rim[1]*L;
  r.rim.position.set(pc.x+600*ws,pc.y+500*ws,pc.z-1500*ws).applyMatrix4(cam.matrixWorld);r.rim.target.position.copy(Pw);
  const sh=!!lk.sh;r.dir.castShadow=sh;
  if(sh){const c=r.dir.shadow.camera;c.left=-700*ws;c.right=700*ws;c.top=700*ws;c.bottom=-700*ws;c.near=10;c.far=5000*ws;c.updateProjectionMatrix()}
  setShadow(s,sh);
  r.renderer.toneMapping=T.ACESFilmicToneMapping;r.renderer.toneMappingExposure=P.exp||1;
}

/* ===== render ===== */
let R=null,warned=false;
function rig(W,H){
  const T=THREE;
  if(!R){
    const canvas=document.createElement('canvas'),renderer=new T.WebGLRenderer({canvas:canvas,alpha:true,antialias:true,premultipliedAlpha:true});
    renderer.setPixelRatio(1);renderer.outputEncoding=T.sRGBEncoding;renderer.setClearColor(0x000000,0);
    const scene=new T.Scene(),cam=new T.PerspectiveCamera(60,1,20,30000),amb=new T.AmbientLight(0xffffff,.6),dir=new T.DirectionalLight(0xffffff,1),rim=new T.DirectionalLight(0xffffff,0);
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    dir.shadow.mapSize.set(1024,1024);dir.shadow.bias=-.0006;rim.visible=false;
    cam.matrixAutoUpdate=false;scene.add(amb,dir,dir.target,rim,rim.target);
    R={canvas:canvas,renderer:renderer,scene:scene,cam:cam,amb:amb,dir:dir,rim:rim,W:0,H:0};
  }
  if(R.W!==W||R.H!==H){R.renderer.setSize(W,H,false);R.W=W;R.H=H}
  return R;
}
/* matriks 4x4 Three.js dari rotasi 3x3 + posisi Edit 3D (dengan konversi sumbu T = diag(1,-1,-1)) */
function setM(m,Rm,p,s){
  const t=[1,-1,-1],e=[];
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)e.push(t[i]*t[j]*Rm[i*3+j]*s);
  m.set(e[0],e[1],e[2],p[0],e[3],e[4],e[5],-p[1],e[6],e[7],e[8],-p[2],0,0,0,1);
}
/* mengembalikan {canvas, quad} atau null. Wd = world(item) dari scene3d, C = camState, o = {W,H,light} */
function draw(it,Wd,C,o){
  const s=cache.get(key(it));if(!s||!s.ready||typeof THREE==='undefined')return null;
  let r;try{r=rig(o.W,o.H)}catch(e){if(!warned){warned=true;try{APK.app.toast('Browser ini tidak mendukung WebGL, model 3D tidak bisa ditampilkan')}catch(_){}}return null}
  const T=THREE,cam=r.cam,L=o.light==null?1:o.light;
  cam.fov=2*Math.atan((1000/2)/C.F)*180/Math.PI;cam.aspect=o.W/o.H;cam.near=20;cam.far=30000;cam.updateProjectionMatrix();
  setM(cam.matrix,C.R,C.p,1);cam.matrixWorld.copy(cam.matrix);cam.matrixWorldInverse.copy(cam.matrixWorld).invert();cam.matrixWorldNeedsUpdate=false;
  try{pose(it,s,o.t,o.face)}catch(e){}
  setM(s.pivot.matrix,Wd.R,Wd.p,Wd.s);s.pivot.matrixWorldNeedsUpdate=true;
  try{lighting(r,s,it,Wd,cam,L)}catch(e){}
  r.scene.add(s.pivot);
  try{r.renderer.render(r.scene,cam)}finally{r.scene.remove(s.pivot)}
  /* kotak pembatas di layar (untuk memilih model dengan ketukan di preview) */
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,any=false;
  const v=new T.Vector3(),w=new T.Vector3();
  for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1]){
    v.set(sx*s.half[0],sy*s.half[1],sz*s.half[2]).applyMatrix4(s.pivot.matrixWorld);
    w.copy(v).applyMatrix4(cam.matrixWorldInverse);
    if(w.z>=-cam.near)continue;
    v.project(cam);any=true;
    const px=(v.x+1)/2*o.W,py=(1-v.y)/2*o.H;
    if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;
  }
  return{canvas:r.canvas,quad:any?[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]:null};
}
APK.s3model={prepare:prepare,load:load,state:state,draw:draw,drop:drop,clips:clips,looks:LOOK};
})();
