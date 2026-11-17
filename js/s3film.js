/* STUDIO FILM untuk model 3D di Edit 3D (add-on, tahap 1 menuju tampilan animasi film). Tidak mengubah js/s3model.js maupun js/scene3d.js:
   modul ini menunggu APK.s3model dimuat lalu membungkus APK.s3model.draw. Semua data tersimpan di layer model, jadi ikut simpan otomatis, undo, dan export.
   1) LAMPU SENDIRI (maks 4 per model): matahari (arah), titik, sorot (spot). Warna, terang, posisi X/Y/Z relatif ke model (satuan model, sisi terpanjang = 600,
      +Y atas, +Z ke arah kamera), bayangan lembut untuk matahari dan sorot. Tombol "Studio 3 lampu" memasang lampu utama, isian, dan pinggir.
      "Matikan cahaya bawaan" memakai preset "Hanya lampu sendiri" supaya hasilnya hanya dari lampu yang kamu atur.
   2) REFLEKSI LINGKUNGAN: ruang studio / matahari sore / malam dilukis sebagai peta kubus, jadi logam dan permukaan licin memantulkan sekeliling.
   3) BAHAN (PBR) untuk seluruh model: Logam, Kasar, Bercahaya (emisif), Transparansi (kaca). Bisa dimatikan untuk kembali ke bahan asli.
   4) KUALITAS RENDER MODEL saat Export / Kirim ke editor: 1x, 2x, atau 3x (supersampling, tepi mulus dan bayangan lebih halus, lebih lama). Preview tidak berubah.
   Data layer: it.lights=[{t,c,i,x,y,z,sh}], it.env={p,i}, it.pbr={on,metal,rough,emi,op}. Bayangan lampu butuh "Bayangan lembut di lantai" (kartu Cahaya film), otomatis dinyalakan. */
(function(){
'use strict';
window.APK=window.APK||{};
if(APK.s3film)return;
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const num=(v,d)=>{const n=parseFloat(v);return isFinite(n)?n:d};
const isModel=it=>!!it&&it.kind==='model';
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
const MAXL=4;
const LT={dir:'Matahari (arah)',point:'Titik',spot:'Sorot (spot)'};
const ENVN={'':'Mati (bawaan)',studio:'Ruang studio',sunset:'Matahari sore',night:'Malam'};
let QUALITY=1;   /* pengali supersampling, hanya aktif selama export */

/* ===== peta lingkungan (peta kubus dilukis di kanvas, tanpa akses ke renderer) ===== */
const envCache=new Map();
function envCube(T,name){
  if(envCache.has(name))return envCache.get(name);
  const P={studio:{top:'#e8edf5',hor:'#aab3c2',bot:'#2b2e36',b:['#ffffff','#fff1dc']},
    sunset:{top:'#4b5c9e',hor:'#ff9a5c',bot:'#2a1912',b:['#ffe2b8','#ff8a3d']},
    night:{top:'#070b22',hor:'#1b2c66',bot:'#04050c',b:['#8fbcff','#3d6cff']}}[name];
  if(!P)return null;
  const N=128,mk=f=>{const c=document.createElement('canvas');c.width=c.height=N;f(c.getContext('2d'));return c};
  const side=box=>mk(g=>{
    const gr=g.createLinearGradient(0,0,0,N);gr.addColorStop(0,P.top);gr.addColorStop(.5,P.hor);gr.addColorStop(1,P.bot);
    g.fillStyle=gr;g.fillRect(0,0,N,N);
    if(box){g.fillStyle=box[2];g.fillRect(box[0]*N,box[1]*N,.4*N,.22*N)}
  });
  const top=mk(g=>{g.fillStyle=P.top;g.fillRect(0,0,N,N);g.fillStyle=P.b[0];g.fillRect(.3*N,.3*N,.4*N,.4*N)});
  const bot=mk(g=>{g.fillStyle=P.bot;g.fillRect(0,0,N,N)});
  const tex=new T.CubeTexture([side([.3,.15,P.b[0]]),side([.3,.2,P.b[1]]),top,bot,side(null),side([.3,.15,P.b[1]])]);
  tex.encoding=T.sRGBEncoding;tex.needsUpdate=true;
  envCache.set(name,tex);return tex;
}

/* ===== menerapkan lampu, lingkungan, dan bahan ke model yang sudah dimuat ===== */
function std(m){return m&&(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial)}
function eachMat(s,fn){
  s.pivot.traverse(o=>{
    if(!o.isMesh||o===s.floor)return;
    [].concat(o.material).forEach(m=>{if(std(m))fn(m)});
  });
}
function applyMaterials(s,it,T){
  const p=it.pbr&&it.pbr.on?it.pbr:null,e=it.env&&it.env.p?it.env:null,et=e?envCube(T,e.p):null;
  eachMat(s,m=>{
    const u=m.userData;
    if(!u.__o)u.__o={metalness:m.metalness,roughness:m.roughness,emissive:m.emissive.clone(),emissiveIntensity:m.emissiveIntensity,
      opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,envMap:m.envMap,envMapIntensity:m.envMapIntensity};
    const o=u.__o;
    if(p){
      m.metalness=clamp(num(p.metal,o.metalness),0,1);m.roughness=clamp(num(p.rough,o.roughness),0,1);
      const em=clamp(num(p.emi,0),0,3);
      if(em>0){m.emissive.copy(m.color);m.emissiveIntensity=em}else{m.emissive.copy(o.emissive);m.emissiveIntensity=o.emissiveIntensity}
      const op=clamp(num(p.op,1),0,1);
      m.opacity=op;m.transparent=op<.999||o.transparent;m.depthWrite=op>.98?o.depthWrite:false;
    }else{
      m.metalness=o.metalness;m.roughness=o.roughness;m.emissive.copy(o.emissive);m.emissiveIntensity=o.emissiveIntensity;
      m.opacity=o.opacity;m.transparent=o.transparent;m.depthWrite=o.depthWrite;
    }
    const wantEnv=et||o.envMap;
    if(m.envMap!==wantEnv){m.envMap=wantEnv;m.needsUpdate=true}
    m.envMapIntensity=et?clamp(num(e.i,1),0,4):o.envMapIntensity;
  });
}
function buildLights(s,it,T){
  if(s.xg){s.pivot.remove(s.xg);s.xg=null}
  s.xl=[];
  const list=Array.isArray(it.lights)?it.lights.slice(0,MAXL):[];
  if(!list.length)return;
  const g=new T.Group();
  for(const l of list){
    const col=new T.Color(l.c||'#ffffff'),i=num(l.i,1);let L;
    if(l.t==='spot')L=new T.SpotLight(col,i,0,.7,.6,1);
    else if(l.t==='point')L=new T.PointLight(col,i,0,1);
    else L=new T.DirectionalLight(col,i);
    L.position.set(num(l.x,0),num(l.y,300),num(l.z,500));
    g.add(L);
    if(L.target){L.target.position.set(0,0,0);g.add(L.target)}
    const sh=!!l.sh&&l.t!=='point';
    if(sh){L.castShadow=true;L.shadow.mapSize.set(2048,2048);L.shadow.bias=-.0006}
    s.xl.push({L:L,i:i,sh:sh,t:l.t||'dir'});
  }
  s.pivot.add(g);s.xg=g;s.xws=0;
}
function prep(s,it,Wd,light){
  const T=THREE,sig=JSON.stringify([it.lights||null,it.env||null,it.pbr||null]);
  if(s.xsig!==sig){
    s.xsig=sig;
    applyMaterials(s,it,T);buildLights(s,it,T);
  }
  if(s.xl&&s.xl.length){
    const ws=Math.max(Wd.s||1,.05),lm=light==null?1:light;
    s.xl.forEach(o=>{o.L.intensity=o.i*lm});
    if(Math.abs(ws-(s.xws||0))>.01*ws){   /* kotak bayangan mengikuti ukuran model di layar */
      s.xws=ws;
      s.xl.forEach(o=>{
        if(!o.sh)return;const c=o.L.shadow.camera;
        if(o.t==='dir'){c.left=-700*ws;c.right=700*ws;c.top=700*ws;c.bottom=-700*ws;c.near=10;c.far=6000*ws}
        else{c.near=10*ws;c.far=6000*ws}
        c.updateProjectionMatrix();
      });
    }
  }
}

/* ===== pasang ke APK.s3model ===== */
function install(){
  const M=APK.s3model;if(!M||M.__film||typeof M.draw!=='function')return false;
  M.__film=1;
  if(M.looks&&!M.looks.custom)M.looks.custom={n:'Hanya lampu sendiri',key:[0xffffff,0],amb:[0xffffff,.12],rim:[0xffffff,0],exp:1.05};
  const od=M.draw;
  M.draw=function(it,Wd,C,o){
    try{
      const s=M.state(it);
      if(s&&s.ready&&s.pivot&&typeof THREE!=='undefined')prep(s,it,Wd,o&&o.light);
    }catch(e){if(!install.warned){install.warned=1;console.warn('Studio Film gagal diterapkan',e)}}
    const ss=clamp(QUALITY,1,3),k=Math.min(ss,4096/Math.max(o.W,o.H));
    if(k>1.01){
      const r=od(it,Wd,C,Object.assign({},o,{W:Math.round(o.W*k),H:Math.round(o.H*k)}));
      if(r&&r.quad)r.quad=r.quad.map(p=>[p[0]/k,p[1]/k]);
      return r;
    }
    return od(it,Wd,C,o);
  };
  return true;
}
const poll=setInterval(()=>{if(install())clearInterval(poll)},400);

/* ===== panel properti ===== */
function lightRow(l,i){
  const t=l.t||'dir';
  return '<div class="s3f-l"><div class="s3-two"><label class="s3-fl">Lampu '+(i+1)+'<select data-fl="t" data-i="'+i+'">'
    +Object.keys(LT).map(k=>'<option value="'+k+'"'+(t===k?' selected':'')+'>'+LT[k]+'</option>').join('')+'</select></label>'
    +'<label class="s3-fl">Warna<input type="color" data-fl="c" data-i="'+i+'" value="'+esc(l.c||'#ffffff')+'"></label></div>'
    +'<div class="s3-two"><label class="s3-fl">Terang<input type="number" data-fl="i" data-i="'+i+'" min="0" max="8" step="0.1" value="'+num(l.i,1)+'"></label>'
    +(t!=='point'?'<label class="s3-ck"><input type="checkbox" data-fl="sh" data-i="'+i+'"'+(l.sh?' checked':'')+'> Bayangan</label>':'<span></span>')+'</div>'
    +'<div class="s3f-xyz">'+['x','y','z'].map(a=>'<label class="s3-fl">'+a.toUpperCase()+'<input type="number" data-fl="'+a+'" data-i="'+i+'" min="-3000" max="3000" step="10" value="'+Math.round(num(l[a],0))+'"></label>').join('')+'</div>'
    +'<button class="btn danger" type="button" data-flx="del" data-i="'+i+'">Hapus lampu '+(i+1)+'</button></div>';
}
function build(it){
  const ls=Array.isArray(it.lights)?it.lights:[],env=it.env||{},pb=it.pbr||{},only=!!(it.lk&&it.lk.p==='custom');
  let h='<b>💡 Lampu sendiri</b>'+ls.map(lightRow).join('')
    +'<div class="s3f-row">'+(ls.length<MAXL?'<button class="btn" type="button" data-flx="add">+ Lampu</button>':'')
    +'<button class="btn" type="button" data-flx="preset">Studio 3 lampu</button>'
    +(ls.length?'<button class="btn" type="button" data-flx="clear">Hapus semua</button>':'')+'</div>'
    +'<label class="s3-ck"><input type="checkbox" data-fo="only"'+(only?' checked':'')+'> Matikan cahaya bawaan (hanya lampu sendiri)</label>'
    +'<p class="s3-hint">Posisi lampu relatif ke model: +X kanan, +Y atas, +Z ke arah kamera (sisi terpanjang model = 600). Maksimal '+MAXL+' lampu. Bayangan memakai lantai di kartu Cahaya film dan otomatis dinyalakan.</p>';
  h+='<b>🪞 Refleksi lingkungan</b><div class="s3-two"><label class="s3-fl">Ruangan<select data-fe="p">'
    +Object.keys(ENVN).map(k=>'<option value="'+k+'"'+((env.p||'')===k?' selected':'')+'>'+ENVN[k]+'</option>').join('')+'</select></label>'
    +'<label class="s3-fl">Kuat<input type="number" data-fe="i" min="0" max="4" step="0.1" value="'+num(env.i,1)+'"></label></div>'
    +'<p class="s3-hint">Membuat logam dan permukaan licin memantulkan sekelilingnya. Paling terlihat kalau Logam tinggi dan Kasar rendah.</p>';
  const sl=(k,l,mn,mx,st,d)=>'<label class="s3-fl">'+l+'<input type="range" data-fp="'+k+'" min="'+mn+'" max="'+mx+'" step="'+st+'" value="'+num(pb[k],d)+'"></label>';
  h+='<b>🧪 Bahan (PBR)</b><label class="s3-ck"><input type="checkbox" data-fp="on"'+(pb.on?' checked':'')+'> Atur bahan seluruh model</label>';
  if(pb.on)h+=sl('metal','Logam',0,1,.05,.3)+sl('rough','Kasar',0,1,.05,.5)+sl('emi','Bercahaya',0,3,.1,0)+sl('op','Transparansi (kaca)',0,1,.05,1)
    +'<p class="s3-hint">Matikan kotak di atas untuk kembali ke bahan asli model. Warna tetap diatur dari kartu Animasi Model atau teksturnya.</p>';
  return h;
}
function inject(){
  const P=$('s3-props'),it=byId(selId());
  if(!P||!isModel(it))return;
  const old=P.querySelector('#s3x-film');
  const sig=JSON.stringify([it.id,it.lights||null,it.env||null,it.pbr||null,it.lk||null]);
  if(old&&old.dataset.sig===sig)return;
  if(old)old.remove();
  const d=document.createElement('div');d.id='s3x-film';d.className='s3c';d.dataset.sig=sig;d.innerHTML=build(it);
  const first=P.querySelector('.s3-f');
  if(first)P.insertBefore(d,first);else P.appendChild(d);
}
function ensureShadow(it){
  const lk=it.lk=Object.assign({p:'',sh:false},it.lk||{});
  lk.sh=true;
}
function onChange(e){
  const el=e.target&&e.target.closest&&e.target.closest('[data-fl],[data-fe],[data-fp],[data-fo]');if(!el)return;
  const it=byId(selId());if(!isModel(it)||e.type==='input'&&el.type!=='range')return;
  const d=el.dataset;
  if(d.fl!=null){
    const l=(it.lights||[])[+d.i];if(!l)return;const k=d.fl;
    if(k==='t'){l.t=el.value;if(l.t==='point')l.sh=false}
    else if(k==='c')l.c=el.value;
    else if(k==='sh'){l.sh=!!el.checked;if(l.sh)ensureShadow(it)}
    else l[k]=clamp(num(el.value,0),k==='i'?0:-3000,k==='i'?8:3000);
    touch();return;
  }
  if(d.fe!=null){
    const env=it.env=Object.assign({p:'',i:1},it.env||{});
    if(d.fe==='p')env.p=el.value;else env.i=clamp(num(el.value,1),0,4);
    if(!env.p)delete it.env;
    touch();return;
  }
  if(d.fp!=null){
    const pb=it.pbr=Object.assign({on:false,metal:.3,rough:.5,emi:0,op:1},it.pbr||{});
    if(d.fp==='on')pb.on=!!el.checked;else pb[d.fp]=num(el.value,0);
    if(e.type==='input'){try{A().render()}catch(_){}return}   /* geser slider: lihat langsung, simpan saat dilepas */
    touch();return;
  }
  if(d.fo==='only'){
    const lk=it.lk=Object.assign({p:'',sh:false},it.lk||{});
    lk.p=el.checked?'custom':'';
    if(!lk.p&&!lk.sh)delete it.lk;
    touch();
  }
}
function onClick(e){
  const b=e.target.closest&&e.target.closest('[data-flx]');if(!b||!$('s3d')||!$('s3d').contains(b))return;
  const it=byId(selId());if(!isModel(it))return;
  const a=b.dataset.flx;it.lights=Array.isArray(it.lights)?it.lights:[];
  if(a==='add'&&it.lights.length<MAXL)it.lights.push({t:'point',c:'#ffffff',i:1.2,x:300,y:400,z:500,sh:false});
  else if(a==='del')it.lights.splice(+b.dataset.i,1);
  else if(a==='clear')it.lights=[];
  else if(a==='preset'){
    it.lights=[{t:'dir',c:'#fff0dc',i:1.4,x:-400,y:600,z:700,sh:true},{t:'point',c:'#bcd0ff',i:.6,x:500,y:100,z:500,sh:false},{t:'dir',c:'#ffffff',i:1.2,x:300,y:400,z:-700,sh:false}];
    ensureShadow(it);
    it.lk.p='custom';
  }
  else return;
  if(!it.lights.length)delete it.lights;
  touch();
}

/* ===== kualitas render model di dialog export ===== */
function mountQuality(){
  const defs=[['s3-ex-set','s3x-q'],['s3-dlg-send','s3x-q2']];
  for(const [host,id] of defs){
    const h=$(host);if(!h||$(id))continue;
    const act=h.querySelector('.dlg-actions'),lab=document.createElement('label');
    lab.innerHTML='Kualitas model 3D<select id="'+id+'"><option value="1">1x (cepat)</option><option value="2">2x (halus, lebih lama)</option><option value="3">3x (sangat halus, paling lama)</option></select>';
    if(act&&act.parentNode)act.parentNode.insertBefore(lab,act);else h.appendChild(lab);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('#s3-ex-start,#s3-sd-go');if(!b)return;
    const q=$(b.id==='s3-ex-start'?'s3x-q':'s3x-q2');QUALITY=q?clamp(parseInt(q.value,10)||1,1,3):1;
  },true);
  ['s3-dlg-ex','s3-dlg-send'].forEach(id=>{const d=$(id);if(d)d.addEventListener('close',()=>{QUALITY=1;try{A().render()}catch(_){}})});
}
function boot(){
  if(!$('s3d'))return;
  try{const st=document.createElement('style');st.textContent='.s3f-l{border:1px solid rgba(128,128,128,.35);border-radius:8px;padding:8px;margin:6px 0}.s3f-xyz{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:4px 0 8px}.s3f-row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.s3f-row .btn{flex:0 0 auto;white-space:nowrap;padding:6px 10px;font-size:13px}';document.head.appendChild(st)}catch(_){}
  mountQuality();
  const P=$('s3-props');
  if(P){
    new MutationObserver(inject).observe(P,{childList:true});
    P.addEventListener('change',onChange);P.addEventListener('input',onChange);
  }
  document.addEventListener('click',onClick);
  inject();
}
APK.s3film={install:install,envCube:envCube,get quality(){return QUALITY},set quality(v){QUALITY=clamp(+v||1,1,3)}};
try{boot()}catch(e){console.error('Studio Film gagal dimuat',e)}
})();
