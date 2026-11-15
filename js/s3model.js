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

async function parse(it,getRec,s){
  const fmt=String(it.fmt||'').toLowerCase();
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
    obj=await new Promise((res,rej)=>new T.GLTFLoader(mgr).load(url,g=>res(g.scene),undefined,()=>rej(new Error('berkas GLTF/GLB tidak bisa dibaca'))));
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
  }else throw new Error('format tidak didukung: '+fmt);
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

/* ===== render ===== */
let R=null,warned=false;
function rig(W,H){
  const T=THREE;
  if(!R){
    const canvas=document.createElement('canvas'),renderer=new T.WebGLRenderer({canvas:canvas,alpha:true,antialias:true,premultipliedAlpha:true});
    renderer.setPixelRatio(1);renderer.outputEncoding=T.sRGBEncoding;renderer.setClearColor(0x000000,0);
    const scene=new T.Scene(),cam=new T.PerspectiveCamera(60,1,20,30000),amb=new T.AmbientLight(0xffffff,.6),dir=new T.DirectionalLight(0xffffff,1);
    cam.matrixAutoUpdate=false;scene.add(amb,dir,dir.target);
    R={canvas:canvas,renderer:renderer,scene:scene,cam:cam,amb:amb,dir:dir,W:0,H:0};
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
  r.amb.intensity=.55*L;r.dir.intensity=1.1*L;
  const cp=new T.Vector3(0,0,0).applyMatrix4(cam.matrixWorld);
  r.dir.position.set(-500,700,900).applyMatrix4(cam.matrixWorld);r.dir.target.position.copy(cp);
  setM(s.pivot.matrix,Wd.R,Wd.p,Wd.s);s.pivot.matrixWorldNeedsUpdate=true;
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
APK.s3model={prepare:prepare,load:load,state:state,draw:draw,drop:drop};
})();
