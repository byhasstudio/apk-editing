/* KAMERA FISIK untuk Edit 3D (add-on, dimuat setelah js/scene3d.js dan js/s3tools.js; isi scene3d.js tidak diubah).
   1) Tombol "▦ Ruang 3D": tampilan bebas (putar, geser, zoom) yang memperlihatkan kamera sebagai benda fisik di ruang 3D:
      model kamera sinema (js/s3camrig.js, Three.js), kerucut pandang (frustum) sampai bidang layar z=0, bidang fokus, grid lantai, dan
      semua layer sebagai kotak. Titik kamera bisa diseret (pindah posisi, tahan Shift = maju/mundur) dan titik arah di ujung
      kerucut bisa diseret (pan/tilt). Tombol "🎥 Kamera" kembali ke hasil render asli.
   2) Panel "Kamera fisik" di properti kamera: lensa (mm) dan sensor, bukaan (f/) untuk DOF, fokus ke objek, gerakan siap pakai
      (push-in, dolly zoom, geser, crane, pan, tilt, roll, orbit, rack focus) yang dipasang sebagai keyframe, dan getaran handheld.
   3) Jalur potong kamera di bawah slider waktu (segmen per kamera, ketuk untuk loncat).
   Semua yang diatur di sini memakai properti kamera yang sudah dirender oleh Edit 3D (fov, focus, fd, x/y/z, rx/ry/rz, keyframe),
   jadi preview dan export (frame per frame) hasilnya sama. Getaran handheld ditulis sebagai keyframe (deterministik per frame). */
(function(){
'use strict';
const $=id=>document.getElementById(id),D=Math.PI/180,REFH=1000;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const isCam=it=>!!it&&it.kind==='camera';
const ASPR={'16:9':16/9,'9:16':9/16,'1:1':1,'4:3':4/3,'21:9':21/9};
const aspect=()=>{const s=scn();return ASPR[s&&s.aspect]||16/9};
const r2=v=>Math.round(v*100)/100;

/* ===== matematika (sama dengan scene3d.js: x kanan, y bawah, z maju) ===== */
const mul=(M,N)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=M[i*3]*N[j]+M[i*3+1]*N[3+j]+M[i*3+2]*N[6+j];return r};
const mv=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
const mvT=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]];
function rotM(rx,ry,rz){
  const cx=Math.cos(rx*D),sx=Math.sin(rx*D),cy=Math.cos(ry*D),sy=Math.sin(ry*D),cz=Math.cos(rz*D),sz=Math.sin(rz*D);
  return mul([cz,-sz,0,sz,cz,0,0,0,1],mul([1,0,0,0,cx,-sx,0,sx,cx],[cy,0,sy,0,1,0,-sy,0,cy]));
}
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],scl=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const col=(M,j)=>[M[j],M[3+j],M[6+j]];
const norm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
/* kebalikan rotM: R = Rz*Rx*Ry */
const eulerOf=R=>({rx:Math.asin(clamp(R[7],-1,1))/D,ry:Math.atan2(-R[6],R[8])/D,rz:Math.atan2(-R[1],R[4])/D});

/* ===== kamera: tiruan camState() di scene3d.js (tanpa getar), supaya posisi kamera di ruang 3D sama dengan yang dirender ===== */
const DEF={x:0,y:0,z:0,rx:0,ry:0,rz:0,fov:60,focus:0,fd:900,dist:900,az:0,el:0,frx:0,fry:0,follow:.6};
const gv=(c,p,t)=>{const v=A().val(c,p,t);return v==null?DEF[p]:v};
function targetPos(c,tt){
  const tg=c.target&&byId(c.target);if(!tg)return null;
  const tau=(1-clamp(gv(c,'follow',tt),0,1))*1.6;
  if(tau<.03)return A().world(tg,tt).p;
  let a=[0,0,0],sw=0;
  for(let k=0;k<14;k++){const w=Math.exp(-k*.1/tau),p=A().world(tg,Math.max(0,tt-k*.1)).p;a[0]+=p[0]*w;a[1]+=p[1]*w;a[2]+=p[2]*w;sw+=w}
  return[a[0]/sw,a[1]/sw,a[2]/sw];
}
function camPose(c,tt,asp){
  const g=p=>gv(c,p,tt),fov=g('fov'),F=(REFH/2)/Math.tan(fov*D/2),tp=targetPos(c,tt);
  if(tp){
    const d=Math.max(50,g('dist')),az=g('az')*D,el=g('el')*D;
    const fw=[-Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
    const ry=Math.asin(clamp(fw[0],-1,1))/D,rx=Math.atan2(-fw[1],fw[2])/D;
    const R=mul(rotM(rx,ry,0),rotM(g('rx'),g('ry'),g('rz')));
    const Hd=2*d*Math.tan(fov*D/2),Wd=Hd*asp,sft=mv(R,[-g('frx')*Wd,-g('fry')*Hd,0]);
    return{p:[tp[0]-fw[0]*d+sft[0]+g('x'),tp[1]-fw[1]*d+sft[1]+g('y'),tp[2]-fw[2]*d+sft[2]+g('z')],R,F,fov,tgt:tp,L:d,fdist:d,blur:g('focus')};
  }
  return{p:[g('x'),g('y'),g('z')-F],R:rotM(g('rx'),g('ry'),g('rz')),F,fov,tgt:null,L:F,fdist:g('fd'),blur:g('focus')};
}
const vis=(it,tt)=>it.vis!==false&&tt>=it.start-1e-6&&(it.dur==null||tt<=it.start+it.dur+1e-6);
const spatial=it=>!isCam(it)&&!/^(fx|sunburst|ribbon|dust)$/.test(it.kind);
function activeId(tt){const s=scn();let c=s.items[0].id;(s.cuts||[]).forEach(k=>{if(k.t<=tt+1e-6){const o=byId(k.cam);if(isCam(o))c=o.id}});return c}
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};

/* ===== penulisan nilai: keyframe kalau properti beranimasi, kalau tidak nilai biasa ===== */
const ease=()=>{const e=document.querySelector('#s3-props [data-ease]');return e?e.value:'inout'};
function setK(it,p,tt,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-tt)<.02);
  if(k){k.v=v;if(e)k.e=e}else{a.push({t:Math.round(tt*1000)/1000,v,e:e||ease()});a.sort((x,y)=>x.t-y.t)}
}
function put(it,p,tt,v){const a=it.keys[p];if(a&&a.length)setK(it,p,tt,v);else it.props[p]=v}
/* animasi dari nilai sekarang (t0) ke v1 (t1); keyframe lama di antara keduanya diganti */
function animate(it,p,t0,t1,v1,e){
  const v0=gv(it,p,t0),a=it.keys[p]||(it.keys[p]=[]);
  for(let i=a.length-1;i>=0;i--)if(a[i].t>t0+.02&&a[i].t<t1-.02)a.splice(i,1);
  setK(it,p,t0,v0,e||'inout');setK(it,p,t1,v1,e||'inout');
}
let rq=0,rev=1;
const bump=()=>{rev++};
function touch(){   /* memicu simpan otomatis + riwayat undo (sama seperti s3tools.js) lalu render ulang */
  const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));
  if(!rq)rq=requestAnimationFrame(()=>{rq=0;try{A().render()}catch(_){}bump()});
}

/* ===== lensa dan bukaan ===== */
const SENS={ff:{n:'Full Frame 36×24 mm',h:24},s35:{n:'Super 35 24.9×18.7 mm',h:18.7},m43:{n:'Micro 4/3 17.3×13 mm',h:13},in1:{n:'1 inci 13.2×8.8 mm',h:8.8}};
const sensH=it=>(SENS[it.sensor]||SENS.s35).h;
const fovToMm=(fov,h)=>h/(2*Math.tan(fov*D/2));
const mmToFov=(mm,h)=>2*Math.atan(h/(2*mm))/D;
const LN=Math.log(22/1.4);
const apToBlur=ap=>clamp(Math.log(22/clamp(ap,1.4,22))/LN,0,1);   /* f/22 = tanpa blur, f/1.4 = blur maksimal */
const blurToAp=b=>22*Math.exp(-clamp(b,0,1)*LN);

/* ===== getaran handheld: noise halus deterministik (frekuensi rendah), ditulis jadi keyframe ===== */
function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mb32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function noiseFn(seed){
  const r=mb32(seed),F=[.55+r()*.5,1.3+r()*.8,2.6+r()*1.4],Ph=[r()*6.2832,r()*6.2832,r()*6.2832],Am=[.62,.28,.1];
  return t=>{let v=0;for(let i=0;i<3;i++)v+=Am[i]*Math.sin(6.2832*F[i]*t+Ph[i]);return v};
}
const sstep=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
function bakeHandheld(it,t0,t1,rotA,posA){
  const step=.1,n=Math.max(2,Math.round((t1-t0)/step)),fade=Math.min(.4,(t1-t0)/3);
  [['rx',rotA],['ry',rotA],['rz',rotA*.6],['x',posA],['y',posA]].forEach(([p,amp])=>{
    const nz=noiseFn(hash(it.id+':'+p)),out=[];
    for(let i=0;i<=n;i++){
      const ts=t0+(t1-t0)*i/n,env=sstep((ts-t0)/fade)*sstep((t1-ts)/fade);
      out.push({t:Math.round(ts*1000)/1000,v:r2(A().val(it,p,ts)+amp*env*nz(ts)),e:'linear'});
    }
    const a=it.keys[p]||(it.keys[p]=[]);
    for(let i=a.length-1;i>=0;i--)if(a[i].t>=t0-.02&&a[i].t<=t1+.02)a.splice(i,1);
    out.forEach(k=>a.push(k));a.sort((x,y)=>x.t-y.t);
  });
}

/* ===== gerakan siap pakai ===== */
let DUR=3;
const EF=u=>u<.5?2*u*u:1-2*(1-u)*(1-u);
function doMove(it,kind){
  const s=scn(),t0=curT(),t1=Math.min(t0+DUR,s.dur);
  if(t1-t0<.3){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal atau perpanjang durasi.');return}
  const asp=aspect(),P=camPose(it,t0,asp),right=col(P.R,0),down=col(P.R,1),fw=col(P.R,2),up=scl(down,-1),tg=!!P.tgt;
  const moveBy=v=>['x','y','z'].forEach((p,i)=>animate(it,p,t0,t1,gv(it,p,t0)+v[i]));
  const amt=clamp(P.F*.4,150,600),nm={push:'Push-in',pull:'Pull-out',vertigo:'Dolly zoom',truck_l:'Geser kiri',truck_r:'Geser kanan',crane_up:'Crane naik',crane_dn:'Crane turun',pan_l:'Pan kiri',pan_r:'Pan kanan',tilt_up:'Tilt atas',tilt_dn:'Tilt bawah',roll:'Roll miring',orbit_l:'Orbit kiri',orbit_r:'Orbit kanan',rack:'Rack focus'}[kind];
  if(kind==='push'||kind==='pull'){
    if(tg)animate(it,'dist',t0,t1,gv(it,'dist',t0)*(kind==='push'?.65:1.5));else moveBy(scl(fw,kind==='push'?amt:-amt));
  }else if(kind==='vertigo'){
    const f=.6,fov0=gv(it,'fov',t0);
    if(tg)animate(it,'dist',t0,t1,gv(it,'dist',t0)*f);else moveBy(scl(fw,P.L*(1-f)));
    const f2=2*Math.atan(Math.tan(fov0*D/2)/f)/D;
    animate(it,'fov',t0,t1,clamp(f2,20,120));
    if(f2>120)toast('Sudut lensa mentok di 120°, efek vertigo dipotong');
  }else if(kind==='truck_l'||kind==='truck_r')moveBy(scl(right,kind==='truck_r'?400:-400));
  else if(kind==='crane_up'||kind==='crane_dn')moveBy(scl(up,kind==='crane_up'?300:-300));
  else if(kind==='pan_l'||kind==='pan_r')animate(it,'ry',t0,t1,gv(it,'ry',t0)+(kind==='pan_r'?25:-25));
  else if(kind==='tilt_up'||kind==='tilt_dn')animate(it,'rx',t0,t1,gv(it,'rx',t0)+(kind==='tilt_up'?15:-15));
  else if(kind==='roll')animate(it,'rz',t0,t1,gv(it,'rz',t0)+12);
  else if(kind==='orbit_l'||kind==='orbit_r'){
    if(tg)animate(it,'az',t0,t1,gv(it,'az',t0)+(kind==='orbit_r'?90:-90));
    else{   /* kamera manual: mengitari titik di depan lensa (jarak F), posisi dan putaran dihitung per 0,2 dtk */
      const piv=add(P.p,scl(fw,P.F)),tot=kind==='orbit_r'?-90:90,n=Math.max(4,Math.round((t1-t0)/.2)),keys={x:[],y:[],z:[],rx:[],ry:[],rz:[]};
      let pry=null;
      for(let i=0;i<=n;i++){
        const u=i/n,ts=t0+(t1-t0)*u,th=tot*EF(u),Ry=rotM(0,th,0),pn=add(piv,mv(Ry,sub(P.p,piv))),e=eulerOf(mul(Ry,P.R));
        if(pry!=null){while(e.ry-pry>180)e.ry-=360;while(e.ry-pry<-180)e.ry+=360}pry=e.ry;
        const Fn=(REFH/2)/Math.tan(gv(it,'fov',ts)*D/2);
        keys.x.push([ts,pn[0]]);keys.y.push([ts,pn[1]]);keys.z.push([ts,pn[2]+Fn]);keys.rx.push([ts,e.rx]);keys.ry.push([ts,e.ry]);keys.rz.push([ts,e.rz]);
      }
      Object.keys(keys).forEach(p=>{
        const a=it.keys[p]||(it.keys[p]=[]);
        for(let i=a.length-1;i>=0;i--)if(a[i].t>=t0-.02&&a[i].t<=t1+.02)a.splice(i,1);
        keys[p].forEach(([ts,v])=>a.push({t:Math.round(ts*1000)/1000,v:r2(v),e:'linear'}));a.sort((x,y)=>x.t-y.t);
      });
    }
  }else if(kind==='rack'){
    if(tg){toast('Rack focus butuh kamera manual (tanpa objek yang ditangkap). Fokus kamera ini selalu di objek targetnya.');return}
    const ds=scn().items.filter(o=>spatial(o)&&o.kind!=='group'&&vis(o,t0)).map(o=>mvT(P.R,sub(A().world(o,t0).p,P.p))[2]).filter(z=>z>60).sort((a,b)=>a-b);
    if(ds.length<2){toast('Rack focus butuh minimal 2 objek di depan kamera');return}
    const fb=Math.max(gv(it,'focus',t0),.6);
    animate(it,'focus',t0,t1,fb);setK(it,'focus',t0,fb,'inout');
    animate(it,'fd',t0,t1,Math.round(ds[ds.length-1]/10)*10);setK(it,'fd',t0,Math.round(ds[0]/10)*10,'inout');
  }
  touch();A().select(it.id);toast(nm+' dipasang: '+t0.toFixed(2)+' - '+t1.toFixed(2)+' dtk');
}
function doShake(it,kind){
  const s=scn(),fx=s.items[1],t0=curT();
  if(kind==='h1'||kind==='h2'||kind==='h3'){
    const t1=Math.min(t0+DUR,s.dur);if(t1-t0<.3){toast('Sisa waktu terlalu pendek untuk handheld');return}
    const lv=({h1:[.5,5],h2:[1.1,12],h3:[2.3,26]})[kind];bakeHandheld(it,t0,t1,lv[0],lv[1]);
    touch();A().select(it.id);toast('Handheld dipasang sebagai keyframe: '+t0.toFixed(2)+' - '+t1.toFixed(2)+' dtk. Undo untuk membatalkan.');return;
  }
  if(!fx)return;
  fx.props.shake=kind==='f1'?.12:kind==='f2'?.4:0;if(fx.keys)delete fx.keys.shake;
  touch();A().select(it.id);toast(kind==='off'?'Getar efek dimatikan':'Getar efek layar penuh dipasang');
}

/* ===== panel "Kamera fisik" di properti kamera ===== */
function boxHTML(it){
  const tg=!!it.target,s=scn(),tt=curT();
  const objs=s.items.filter(o=>spatial(o)&&o.kind!=='group');
  return`<div class="s3c" id="s3c-box"><b>🎥 Kamera fisik</b>
  <div class="s3-two"><label class="s3-fl">Lensa (mm)<input type="number" data-cc="mm" step="0.5" min="1" max="400"></label>
  <label class="s3-fl">Sensor<select data-cc="sensor">${Object.keys(SENS).map(k=>`<option value="${k}">${SENS[k].n}</option>`).join('')}</select></label></div>
  <div class="s3-two"><label class="s3-fl">Bukaan lensa (f/)<input type="number" data-cc="ap" step="0.1" min="1.4" max="22"></label>
  ${tg?'<p class="s3-hint" style="margin:0;align-self:end">Fokus otomatis di objek yang ditangkap.</p>'
    :`<label class="s3-fl">Fokus ke objek<select data-cc="fobj"><option value="">Pilih objek…</option>${objs.map(o=>`<option value="${o.id}">${esc(o.kind==='text'?String(o.text||'').split('\n')[0].slice(0,14)||'Teks':(o.name||o.kind).slice(0,16))}</option>`).join('')}</select></label>`}</div>
  <p class="s3-hint">f/22 = semua tajam, makin kecil f/ makin buram di luar jarak fokus. Lensa mm = sudut pandang (FOV) menurut sensor.</p>
  <div class="s3-two"><label class="s3-fl">Gerakan (dipasang di waktu sekarang)<select data-cc="move"><option value="">Pilih gerakan…</option>
    <optgroup label="Maju / mundur"><option value="push">Push-in (maju)</option><option value="pull">Pull-out (mundur)</option><option value="vertigo">Dolly zoom (vertigo)</option></optgroup>
    <optgroup label="Geser"><option value="truck_l">Geser ke kiri</option><option value="truck_r">Geser ke kanan</option><option value="crane_up">Crane naik</option><option value="crane_dn">Crane turun</option></optgroup>
    <optgroup label="Putar"><option value="pan_l">Pan kiri</option><option value="pan_r">Pan kanan</option><option value="tilt_up">Tilt ke atas</option><option value="tilt_dn">Tilt ke bawah</option><option value="roll">Miring (roll)</option><option value="orbit_l">Orbit ke kiri</option><option value="orbit_r">Orbit ke kanan</option></optgroup>
    <optgroup label="Fokus"><option value="rack">Rack focus (pindah fokus)</option></optgroup></select></label>
  <label class="s3-fl">Durasi (dtk)<input type="number" data-cc="dur" step="0.5" min="0.5" max="60" value="${DUR}"></label></div>
  <label class="s3-fl">Getaran kamera<select data-cc="shake"><option value="">Pilih getaran…</option>
    <optgroup label="Handheld (keyframe selama durasi di atas)"><option value="h1">Handheld ringan</option><option value="h2">Handheld sedang</option><option value="h3">Handheld kuat (aksi)</option></optgroup>
    <optgroup label="Getar efek seluruh layar"><option value="f1">Getar ringan</option><option value="f2">Getar kuat</option><option value="off">Matikan getar efek</option></optgroup></select></label>
  ${it.id==='cam'?`<button class="btn" type="button" data-cc="cut">✂ Potong ke Kamera utama di ${tt.toFixed(2)} dtk</button>`:''}
  </div>`;
}
function fillBox(){
  const box=$('s3c-box');if(!box)return;const it=byId(selId());if(!isCam(it))return;
  const tt=curT(),fov=gv(it,'fov',tt),act=document.activeElement;
  const set=(k,v)=>{const el=box.querySelector(`[data-cc="${k}"]`);if(el&&el!==act&&el.value!==String(v))el.value=v};
  set('mm',r2(fovToMm(fov,sensH(it))));set('sensor',it.sensor&&SENS[it.sensor]?it.sensor:'s35');set('ap',Math.round(blurToAp(gv(it,'focus',tt))*10)/10);
}
function injectBox(){
  const P=$('s3-props'),s=scn();if(!P||!s||P.querySelector('#s3c-box'))return;
  const it=byId(selId());if(!isCam(it))return;
  const h=P.querySelector('.s3-hint'),w=document.createElement('div');w.innerHTML=boxHTML(it);const box=w.firstElementChild;
  if(h)h.insertAdjacentElement('afterend',box);else P.insertBefore(box,P.firstChild);
  box.addEventListener('change',onBoxChange);box.addEventListener('click',onBoxClick);fillBox();
}
function onBoxChange(e){
  const el=e.target,k=el.dataset.cc,it=byId(selId());if(!k||!isCam(it))return;
  const tt=curT();
  if(k==='dur'){DUR=clamp(parseFloat(el.value)||3,.5,60);el.value=DUR;return}
  if(k==='mm'){
    const mm=parseFloat(el.value);if(!(mm>0))return;
    const raw=mmToFov(mm,sensH(it)),fov=clamp(raw,20,120);
    if(raw!==fov)toast('Rentang lensa mengikuti sudut pandang 20° sampai 120° untuk sensor ini');
    put(it,'fov',tt,r2(fov));touch();setTimeout(fillBox,60);return;
  }
  if(k==='sensor'){it.sensor=el.value;touch();setTimeout(fillBox,60);return}
  if(k==='ap'){const ap=parseFloat(el.value);if(!(ap>0))return;put(it,'focus',tt,r2(apToBlur(ap)));touch();setTimeout(fillBox,60);return}
  if(k==='fobj'){
    const o=byId(el.value);el.value='';if(!o)return;
    const P=camPose(it,tt,aspect()),z=mvT(P.R,sub(A().world(o,tt).p,P.p))[2];
    if(z<60){toast('Objek itu ada di belakang kamera');return}
    put(it,'fd',tt,clamp(Math.round(z/10)*10,100,5000));
    if(gv(it,'focus',tt)<.05){put(it,'focus',tt,.6);toast('Fokus diarahkan ke objek, bukaan dibuka ke f/'+blurToAp(.6).toFixed(1)+' supaya blur terlihat')}
    touch();setTimeout(fillBox,60);return;
  }
  if(k==='move'){const v=el.value;el.value='';if(v)doMove(it,v);return}
  if(k==='shake'){const v=el.value;el.value='';if(v)doShake(it,v)}
}
function onBoxClick(e){
  const b=e.target.closest('[data-cc="cut"]');if(!b)return;
  const s=scn(),it=byId(selId()),tt=curT();if(!isCam(it))return;
  s.cuts=(s.cuts||[]).filter(k=>Math.abs(k.t-tt)>.02);s.cuts.push({t:r2(tt),cam:it.id});s.cuts.sort((a,c)=>a.t-c.t);
  touch();A().select(it.id);toast('Potong ke '+(it.name||'Kamera')+' di '+tt.toFixed(2)+' dtk');
}

/* ===== jalur potong kamera di bawah slider waktu ===== */
const PAL=['#4d5bff','#9b59ff','#26a69a','#ef6c00','#d81b60','#7cb342'];
let cutbar=null;
function camColor(c){const s=scn();const i=s?s.items.filter(isCam).indexOf(c):0;return PAL[Math.max(0,i)%PAL.length]}
function refreshCutBar(){
  const s=scn();if(!cutbar)return;
  if(!s||$('s3d').hidden){cutbar.style.display='none';return}
  const cams=s.items.filter(isCam),cuts=(s.cuts||[]).slice().sort((a,b)=>a.t-b.t);
  if(cams.length<2&&!cuts.length){cutbar.style.display='none';return}
  const segs=[{t:0,cam:s.items[0].id}];cuts.forEach(k=>{if(k.t<=.001)segs[0].cam=k.cam;else segs.push(k)});
  cutbar.style.display='';
  cutbar.innerHTML=segs.map((k,i)=>{
    const t1=i<segs.length-1?segs[i+1].t:s.dur,c=byId(k.cam),l=k.t/s.dur*100,w=Math.max(0,(t1-k.t)/s.dur*100);
    return`<button type="button" data-cb="${esc(k.cam)}" data-t="${k.t}" style="left:${l}%;width:${w}%;background:${c?camColor(c):'#555'}" title="${esc(c?c.name:'?')} dari ${k.t.toFixed(2)} dtk">${esc(c?c.name:'?')}</button>`;
  }).join('');
}

/* ===== tampilan ruang 3D ===== */
const V={mode:'cam',az:-38,el:24,d:3200,tg:[0,0,900],fov:40,model:true,fitFor:null};
let lv=null,HL=[],HD=[],G=null,loadingRig=false;
const PT=new Map(),MD=new Map();
function obsState(){
  const az=V.az*D,el=V.el*D,fw=[-Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)];
  const ry=Math.asin(clamp(fw[0],-1,1))/D,rx=Math.atan2(-fw[1],fw[2])/D;
  return{p:sub(V.tg,scl(fw,V.d)),R:rotM(rx,ry,0),F:(REFH/2)/Math.tan(V.fov*D/2),fw};
}
function mkProj(O,W,H){
  const k=H/REFH,F=O.F,near=10,cs=w=>mvT(O.R,[w[0]-O.p[0],w[1]-O.p[1],w[2]-O.p[2]]),pr=c=>[W/2+c[0]*F/c[2]*k,H/2+c[1]*F/c[2]*k];
  return{k,cs,pr,
    pt(w){const c=cs(w);return c[2]<near?null:pr(c)},
    seg(g,a,b){
      let ca=cs(a),cb=cs(b);if(ca[2]<near&&cb[2]<near)return false;
      if(ca[2]<near){const f=(near-ca[2])/(cb[2]-ca[2]);ca=[ca[0]+(cb[0]-ca[0])*f,ca[1]+(cb[1]-ca[1])*f,near]}
      else if(cb[2]<near){const f=(near-cb[2])/(ca[2]-cb[2]);cb=[cb[0]+(ca[0]-cb[0])*f,cb[1]+(ca[1]-cb[1])*f,near]}
      const p=pr(ca),q=pr(cb);g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);g.stroke();return true;
    }};
}
/* ukuran asli media (untuk kotak layer): dibaca dari IndexedDB Edit 3D, dihitung sekali */
function mediaDims(id){
  if(!id)return null;if(MD.has(id))return MD.get(id);
  if(/^ph\d+$/.test(id)){const d={w:640,h:800};MD.set(id,d);return d}
  MD.set(id,null);
  try{
    const rq=indexedDB.open('apk-3d');
    rq.onupgradeneeded=e=>{try{e.target.transaction.abort()}catch(_){}};
    rq.onsuccess=()=>{
      let r;try{r=rq.result.transaction('media','readonly').objectStore('media').get(id)}catch(_){return}
      r.onsuccess=async()=>{
        const rec=r.result;if(!rec||!rec.blob)return;
        try{
          if((rec.type||'').startsWith('image')){const b=await createImageBitmap(rec.blob);MD.set(id,{w:b.width,h:b.height});if(b.close)b.close()}
          else if((rec.type||'').startsWith('video')){
            const u=URL.createObjectURL(rec.blob),v=document.createElement('video');v.preload='metadata';v.muted=true;
            await new Promise(res=>{v.onloadedmetadata=res;v.onerror=res;setTimeout(res,4000);v.src=u});
            if(v.videoWidth)MD.set(id,{w:v.videoWidth,h:v.videoHeight});URL.revokeObjectURL(u);
          }
          bump();
        }catch(_){}
      };
    };
  }catch(_){}
  return null;
}
function boxSize(it){
  if(it.kind==='group')return[0,0];
  if(it.kind==='text'){const ln=String(it.text||' ').split('\n'),z=it.size||170,mx=Math.max(1,...ln.map(l=>l.length));return[mx*z*.62+z*.8,ln.length*z*1.12+z*.48]}
  const m=mediaDims(it.mediaId),base=it.kind==='video'?1000:600;
  return m?[base*m.w/m.h,base]:[base*(it.kind==='video'?16/9:.8),base];
}
const KC={text:'#ffffff',image:'#7fb2ff',video:'#ff9a4d',group:'#c8c8d0'};
function inPoly(p,q){let c=false;for(let i=0,j=q.length-1;i<q.length;j=i++){if(((q[i][1]>p[1])!==(q[j][1]>p[1]))&&(p[0]<(q[j][0]-q[i][0])*(p[1]-q[i][1])/(q[j][1]-q[i][1])+q[i][0]))c=!c}return c}

function fitView(){
  const s=scn();if(!s)return;
  const tt=curT(),asp=aspect(),pts=[[-asp*500,-500,0],[asp*500,500,0]];
  s.items.forEach(it=>{
    if(isCam(it)){const P=camPose(it,tt,asp);pts.push(P.p,add(P.p,scl(col(P.R,2),P.L)))}
    else if(spatial(it)&&vis(it,tt))pts.push(A().world(it,tt).p);
  });
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  pts.forEach(p=>{for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i])}});
  V.tg=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2];
  const r=Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2])/2;
  V.d=clamp(r*2.8+400,1600,18000);V.az=-38;V.el=24;V.fitFor=s.id;
}
function drawGrid(g,P){
  const Y0=560;g.lineWidth=1;
  for(let x=-3000;x<=3000;x+=250){g.strokeStyle=x%1000===0?'rgba(150,170,255,.34)':'rgba(150,170,255,.13)';P.seg(g,[x,Y0,-1000],[x,Y0,6000])}
  for(let z=-1000;z<=6000;z+=250){g.strokeStyle=z%1000===0?'rgba(150,170,255,.34)':'rgba(150,170,255,.13)';P.seg(g,[-3000,Y0,z],[3000,Y0,z])}
}
function label(g,P,w,txt,color,dx,dy){const p=P.pt(w);if(!p)return;g.fillStyle=color;g.textAlign='center';g.fillText(txt,p[0]+(dx||0),p[1]+(dy||0))}
const Y0A=560;
function drawAxes(g,P){
  const o=[-1400,Y0A,-300],ax=[[[1000,0,0],'#ff6b6b','LEBAR (x)'],[[0,-1000,0],'#7cf29a','TINGGI (y)'],[[0,0,1400],'#6bb6ff','KEDALAMAN (z)']];
  g.lineWidth=2.5;
  ax.forEach(([d,c,t])=>{g.strokeStyle=c;P.seg(g,o,add(o,d));label(g,P,add(o,scl(d,1.12)),t,c,0,0)});
}
function drawScreen(g,P,asp){
  const w=asp*500,h=500;g.save();g.setLineDash([14,10]);g.lineWidth=1.6;g.strokeStyle='rgba(255,255,255,.55)';
  [[-w,-h],[w,-h],[w,h],[-w,h]].forEach((a,i,arr)=>{const b=arr[(i+1)%4];P.seg(g,[a[0],a[1],0],[b[0],b[1],0])});g.restore();
  g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.18)';P.seg(g,[-w,0,0],[w,0,0]);P.seg(g,[0,-h,0],[0,h,0]);
  label(g,P,[0,-h-60,0],'LAYAR (z = 0)','rgba(255,255,255,.7)',0,0);
}
function drawLayerBox(g,P,it,Wd,Rb,sel,fs){
  const sz=boxSize(it),s=Wd.s;
  if(it.kind==='group'){
    g.lineWidth=2;g.strokeStyle='rgba(200,200,210,.8)';
    [[1,0,0],[0,1,0],[0,0,1]].forEach(a=>{const e=mv(Wd.R,scl(a,90*s));P.seg(g,Wd.p,add(Wd.p,e))});
    label(g,P,Wd.p,'▣ '+(it.name||'Grup'),'rgba(220,220,230,.9)',0,-fs);return;
  }
  const R=Rb||Wd.R,hw=sz[0]/2*s,hh=sz[1]/2*s;
  const cs=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([u,v])=>{const q=mv(R,[u,v,0]);return add(Wd.p,q)});
  const pp=cs.map(c=>P.pt(c));if(pp.some(x=>!x))return;
  const c=KC[it.kind]||'#9be28f';
  g.beginPath();pp.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();
  g.globalAlpha=.16;g.fillStyle=c;g.fill();g.globalAlpha=1;g.lineWidth=sel?3:1.6;g.strokeStyle=sel?'#ffd166':c;g.stroke();
  const cp=P.pt(Wd.p);
  if(cp){g.fillStyle='rgba(255,255,255,.92)';g.textAlign='center';g.fillText((it.kind==='text'?String(it.text||'').split('\n')[0]:(it.name||it.kind)).slice(0,18),cp[0],cp[1])}
  HL.push({id:it.id,pts:pp,z:P.cs(Wd.p)[2]});
}
/* kamera: kerucut pandang sampai bidang layar, tanda atas, bidang fokus, ikon kotak cadangan */
function drawCamera(g,P,c,pose,o){
  const R=pose.R,right=col(R,0),down=col(R,1),fw=col(R,2),asp=o.asp,hh=Math.tan(pose.fov*D/2);
  const at=L=>({c:add(pose.p,scl(fw,L)),w:L*hh*asp,h:L*hh});
  const corners=(pl)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>add(add(pl.c,scl(right,a*pl.w)),scl(down,b*pl.h)));
  const far=at(pose.L),fc=corners(far),col0=o.color;
  g.lineWidth=o.sel?2.6:1.5;g.strokeStyle=col0;g.globalAlpha=o.active?1:.75;
  fc.forEach(p=>P.seg(g,pose.p,p));fc.forEach((p,i)=>P.seg(g,p,fc[(i+1)%4]));
  const tip=add(far.c,scl(down,-far.h*1.22)),tl=add(add(far.c,scl(down,-far.h)),scl(right,-far.w*.1)),tr=add(add(far.c,scl(down,-far.h)),scl(right,far.w*.1));
  P.seg(g,tl,tip);P.seg(g,tip,tr);
  if(pose.blur>.04&&pose.fdist>40&&Math.abs(pose.fdist-pose.L)>20){
    g.save();g.setLineDash([8,8]);g.lineWidth=1.4;g.strokeStyle='#ffd166';const fp=corners(at(pose.fdist));fp.forEach((p,i)=>P.seg(g,p,fp[(i+1)%4]));g.restore();
    label(g,P,add(at(pose.fdist).c,scl(down,at(pose.fdist).h*1.0)),'bidang fokus','#ffd166',0,fs0*.9);
  }
  g.globalAlpha=1;
  if(pose.tgt){g.save();g.setLineDash([3,6]);g.lineWidth=1;g.strokeStyle=col0;P.seg(g,pose.p,pose.tgt);g.restore()}
  /* ikon kotak sederhana (dipakai kalau model 3D belum / tidak termuat) */
  if(!o.model){
    const bl=70,bw=34,bh=28,ctr=sub(pose.p,scl(fw,bl*.9)),vs=[];
    for(const a of[-1,1])for(const b of[-1,1])for(const d of[-1,1])vs.push(add(add(add(ctr,scl(right,a*bw)),scl(down,b*bh)),scl(fw,d*bl)));
    g.lineWidth=1.6;g.strokeStyle=col0;
    [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]].forEach(([i,j])=>P.seg(g,vs[i],vs[j]));
  }
  const ep=P.pt(pose.p);
  if(ep){
    g.fillStyle='#fff';g.font='700 '+fs0+'px system-ui,sans-serif';g.textAlign='left';
    g.fillText((o.active?'● ':'')+c.name,ep[0]+12,ep[1]-14);
    g.font='600 '+fs0+'px system-ui,sans-serif';
  }
}
let fs0=12;
function draw(){
  const s=scn(),cv=$('s3-cv');if(!s||!cv||!lv)return;
  const W=cv.width,H=cv.height;if(lv.width!==W||lv.height!==H){lv.width=W;lv.height=H}
  const g=lv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.setLineDash([]);
  const bg=g.createRadialGradient(W/2,H*.45,0,W/2,H*.45,Math.hypot(W,H)*.7);bg.addColorStop(0,'#2a2c37');bg.addColorStop(1,'#0a0a0f');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const tt=curT(),O=obsState(),P=mkProj(O,W,H),asp=aspect(),sel=selId(),act=activeId(tt);
  fs0=Math.max(11,Math.round(H*.03));g.font='600 '+fs0+'px system-ui,sans-serif';g.textBaseline='middle';
  HL=[];HD=[];
  drawGrid(g,P);drawAxes(g,P);drawScreen(g,P,asp);
  const cams=s.items.filter(isCam).map(c=>({c,pose:camPose(c,tt,asp)}));
  const ap=(cams.find(o=>o.c.id===act)||cams[0]);
  g.font='600 '+fs0+'px system-ui,sans-serif';
  s.items.filter(it=>spatial(it)&&vis(it,tt)).map(it=>({it,W:A().world(it,tt)})).map(o=>({...o,z:P.cs(o.W.p)[2]})).sort((a,b)=>b.z-a.z)
    .forEach(o=>drawLayerBox(g,P,o.it,o.W,o.it.bill&&ap?mul(ap.pose.R,rotM(0,0,gv(o.it,'rz',tt))):null,o.it.id===sel,fs0));
  const rig=window.APK&&APK.s3rig,useModel=!!(V.model&&rig&&rig.ready);
  if(V.model&&rig&&!rig.ready&&!rig.failed&&!loadingRig){loadingRig=true;rig.load().then(()=>{loadingRig=false;bump()})}
  cams.map(o=>({...o,z:P.cs(o.pose.p)[2]})).sort((a,b)=>b.z-a.z).forEach(o=>{
    drawCamera(g,P,o.c,o.pose,{asp,active:o.c.id===act,sel:o.c.id===sel,color:camColor(o.c),model:useModel});
  });
  if(useModel){
    const sc=clamp(V.d/45,25,140);
    cams.map(o=>({...o,z:P.cs(o.pose.p)[2]})).sort((a,b)=>b.z-a.z).forEach(o=>{
      const R=o.pose.R,M=[R[2],-R[1],R[0],R[5],-R[4],R[3],R[8],-R[7],R[6]];   /* sumbu model: +X lensa, +Y atas, +Z kanan */
      let cvm=null;try{cvm=rig.draw({W,H,obs:{p:O.p,R:O.R,F:O.F},pose:{p:o.pose.p,R:M,s:sc},fov:o.pose.fov,range:o.pose.L,asp,cone:false,hi:o.c.id===sel})}catch(_){}
      if(cvm)g.drawImage(cvm,0,0,W,H);
    });
  }
  /* titik kendali */
  cams.forEach(o=>{
    const sc=o.c.id===sel,ep=P.pt(o.pose.p);if(!ep)return;
    const zc=P.cs(o.pose.p)[2];
    HD.push({type:'eye',id:o.c.id,x:ep[0],y:ep[1],zc});
    g.lineWidth=2;g.strokeStyle='#fff';g.fillStyle=camColor(o.c);g.beginPath();g.arc(ep[0],ep[1],sc?9:6,0,7);g.fill();g.stroke();
    if(sc&&!o.pose.tgt){
      const fp=add(o.pose.p,scl(col(o.pose.R,2),o.pose.L)),ap2=P.pt(fp);
      if(ap2){HD.push({type:'aim',id:o.c.id,x:ap2[0],y:ap2[1],zc:P.cs(fp)[2],L:o.pose.L});
        g.fillStyle='#ffd166';g.strokeStyle='#fff';g.beginPath();g.moveTo(ap2[0],ap2[1]-11);g.lineTo(ap2[0]+11,ap2[1]);g.lineTo(ap2[0],ap2[1]+11);g.lineTo(ap2[0]-11,ap2[1]);g.closePath();g.fill();g.stroke()}
    }
  });
  g.font='500 '+Math.round(fs0*.9)+'px system-ui,sans-serif';g.fillStyle='rgba(255,255,255,.7)';g.textAlign='left';
  g.fillText('Ruang 3D · '+tt.toFixed(2)+' dtk · seret kosong: putar · Shift / 2 jari: geser · scroll / cubit: zoom',10,H-fs0);
  g.fillText('Seret titik kamera: pindah (Shift: maju/mundur) · seret belah ketupat kuning: arahkan',10,H-fs0*2.3);
}

/* ===== interaksi tampilan ruang 3D ===== */
const lpos=e=>{const r=lv.getBoundingClientRect();return[(e.clientX-r.left)*lv.width/r.width,(e.clientY-r.top)*lv.height/r.height]};
function hitHandle(p){
  const rad=Math.max(20,lv.height*.045),sel=selId();let best=null,bd=1e9;
  HD.forEach(h=>{
    if(h.type==='aim'&&h.id!==sel)return;
    const d=Math.hypot(h.x-p[0],h.y-p[1]);
    if(d<rad&&(d<bd||(h.id===sel&&h.type==='aim'))){best=h;bd=d}
  });
  return best;
}
function onDown(e){
  if(V.mode!=='3d')return;e.preventDefault();lv.setPointerCapture(e.pointerId);PT.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(PT.size===2){const[a,b]=[...PT.values()];G={type:'pinch',d0:Math.hypot(a.x-b.x,a.y-b.y)||1,dist:V.d,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};return}
  const p=lpos(e),h=hitHandle(p);
  if(h){
    const it=byId(h.id);if(!isCam(it))return;
    if(h.id!==selId())A().select(h.id);
    const pose=camPose(it,curT(),aspect());
    G={type:h.type,id:h.id,zc:h.zc,O:obsState(),last:p,fw:col(pose.R,2),shift:e.shiftKey,aim:h.type==='aim'?add(pose.p,scl(col(pose.R,2),h.L)):null};return;
  }
  const hit=HL.slice().sort((a,b)=>a.z-b.z).find(o=>inPoly(p,o.pts));
  if(hit&&hit.id!==selId())A().select(hit.id);
  G={type:(e.shiftKey||e.button===2)?'pan':'orbit',x:e.clientX,y:e.clientY};
}
function onMove(e){
  if(!PT.has(e.pointerId))return;PT.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!G)return;
  const rect=lv.getBoundingClientRect();
  if(G.type==='pinch'){
    if(PT.size<2)return;const[a,b]=[...PT.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1;
    V.d=clamp(G.dist*G.d0/d,300,20000);
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,c=2*V.d*Math.tan(V.fov*D/2)/rect.height,O=obsState(),dv=mv(O.R,[-(mx-G.mx)*c,-(my-G.my)*c,0]);
    V.tg=add(V.tg,dv);G.mx=mx;G.my=my;bump();return;
  }
  if(G.type==='orbit'){
    const dx=e.clientX-G.x,dy=e.clientY-G.y;G.x=e.clientX;G.y=e.clientY;
    V.az-=dx*.35;V.el=clamp(V.el+dy*.35,-85,85);bump();return;
  }
  if(G.type==='pan'){
    const dx=e.clientX-G.x,dy=e.clientY-G.y;G.x=e.clientX;G.y=e.clientY;
    const c=2*V.d*Math.tan(V.fov*D/2)/rect.height,O=obsState();V.tg=add(V.tg,mv(O.R,[-dx*c,-dy*c,0]));bump();return;
  }
  const it=byId(G.id);if(!isCam(it))return;
  const p=lpos(e),k=lv.height/REFH,dxr=(p[0]-G.last[0])/k,dyr=(p[1]-G.last[1])/k,f=G.zc/G.O.F;G.last=p;
  const tt=curT();
  if(G.type==='eye'){
    const d=(G.shift||e.shiftKey)?scl(G.fw,-dyr*f*1.5):mv(G.O.R,[dxr*f,dyr*f,0]);
    ['x','y','z'].forEach((q,i)=>put(it,q,tt,r2(gv(it,q,tt)+d[i])));
  }else if(G.type==='aim'){
    G.aim=add(G.aim,mv(G.O.R,[dxr*f,dyr*f,0]));
    const eye=camPose(it,tt,aspect()).p,u=mv(rotM(0,0,-gv(it,'rz',tt)),norm(sub(G.aim,eye)));
    put(it,'ry',tt,r2(Math.atan2(u[0],Math.hypot(u[1],u[2]))/D));put(it,'rx',tt,r2(Math.atan2(-u[1],u[2])/D));
  }
  touch();
}
function onUp(e){PT.delete(e.pointerId);if(PT.size<2&&G&&G.type==='pinch')G=null;if(!PT.size)G=null}
function onWheel(e){if(V.mode!=='3d')return;e.preventDefault();V.d=clamp(V.d*(1+e.deltaY*.001),300,20000);bump()}

function setView(m){
  const root=$('s3d');if(!root||!lv)return;
  if(m==='3d'){const s=scn();if(!s)return;if(V.fitFor!==s.id)fitView();try{if(document.activeElement)document.activeElement.blur()}catch(_){}}
  V.mode=m;root.classList.toggle('s3-v3d',m==='3d');
  $('s3-vcam').classList.toggle('on',m==='cam');$('s3-v3d').classList.toggle('on',m==='3d');
  $('s3-vfit').hidden=$('s3-vmodel').hidden=m!=='3d';
  if(m==='cam'){try{A().render()}catch(_){}}bump();
}

/* ===== pasang ke antarmuka ===== */
function initUI(){
  const ctl=document.querySelector('#s3d .s3-ctl'),view=document.querySelector('#s3d .s3-view'),tl=document.querySelector('#s3d .s3-tl'),lab=$('s3-tlabel');
  if(!ctl||!view||!tl||!lab)return false;
  lv=document.createElement('canvas');lv.id='s3-lv';lv.setAttribute('aria-label','Tampilan ruang 3D dengan kamera fisik');view.appendChild(lv);
  const w=document.createElement('span');w.className='s3v';
  w.innerHTML='<button class="btn on" id="s3-vcam" type="button" title="Hasil render dari sudut pandang kamera">🎥 Kamera</button><button class="btn" id="s3-v3d" type="button" title="Lihat kamera sebagai benda fisik di ruang 3D: pindah dan arahkan kamera langsung">▦ Ruang 3D</button><button class="btn" id="s3-vfit" type="button" hidden title="Pas-kan tampilan ke seluruh isi scene">↺</button><button class="btn" id="s3-vmodel" type="button" hidden title="Tampilkan atau sembunyikan model 3D kamera">Model: ON</button>';
  lab.insertAdjacentElement('afterend',w);
  $('s3-vcam').onclick=()=>setView('cam');$('s3-v3d').onclick=()=>setView('3d');
  $('s3-vfit').onclick=()=>{fitView();bump()};
  $('s3-vmodel').onclick=e=>{V.model=!V.model;e.currentTarget.textContent='Model: '+(V.model?'ON':'OFF');bump()};
  lv.addEventListener('pointerdown',onDown);lv.addEventListener('pointermove',onMove);lv.addEventListener('pointerup',onUp);lv.addEventListener('pointercancel',onUp);
  lv.addEventListener('wheel',onWheel,{passive:false});lv.addEventListener('contextmenu',e=>e.preventDefault());
  cutbar=document.createElement('div');cutbar.id='s3-cutbar';cutbar.className='s3-cutbar';cutbar.style.display='none';tl.appendChild(cutbar);
  cutbar.addEventListener('click',e=>{
    const b=e.target.closest('[data-cb]');if(!b||!A())return;
    A().select(b.dataset.cb);A()._setT(parseFloat(b.dataset.t)||0);
  });
  /* export / kirim ke editor selalu memakai render asli */
  [$('s3-export'),$('s3-send')].forEach(b=>{if(b)b.addEventListener('click',()=>{if(V.mode==='3d')setView('cam')},true)});
  /* panel properti dibangun ulang oleh scene3d.js setiap pilihan berubah: sisipkan panel kamera fisik lagi */
  const P=$('s3-props');
  if(P)new MutationObserver(()=>{injectBox();refreshCutBar();bump()}).observe(P,{childList:true});
  const ch=$('s3-chips');if(ch)new MutationObserver(()=>{refreshCutBar();bump()}).observe(ch,{childList:true});
  const sv=$('s3-save');if(sv)new MutationObserver(()=>{refreshCutBar();bump()}).observe(sv,{childList:true,characterData:true,subtree:true});
  const root=$('s3d');['input','change','click','pointerup'].forEach(ev=>root.addEventListener(ev,()=>bump(),true));
  setInterval(()=>{if(!root.hidden)fillBox()},250);
  let lastSig='';
  (function tick(){
    requestAnimationFrame(tick);
    if(root.hidden||V.mode!=='3d'||!scn())return;
    const sig=rev+'|'+curT()+'|'+V.az+'|'+V.el+'|'+V.d+'|'+V.tg+'|'+V.model;
    if(sig!==lastSig){lastSig=sig;try{draw()}catch(err){console.warn('Tampilan ruang 3D gagal digambar',err)}}
  })();
  return true;
}
try{initUI()}catch(e){console.error('Kamera fisik Edit 3D gagal dimuat',e)}
/* dipakai add-on js/s3gizmo.js (gizmo geser/putar kamera) */
window.APK=window.APK||{};APK.s3cam={V,get lv(){return lv},get rev(){return rev},bump,touch,selId,curT,byId,isCam,aspect,gv,put,camPose,obsState,mkProj,rotM,mul,mv,mvT,eulerOf,col,add,sub,scl,norm};
if(window.__S3CAM_TEST)window.__S3CAM_TEST.api={rotM,mul,mv,mvT,eulerOf,camPose,mmToFov,fovToMm,apToBlur,blurToAp,noiseFn,hash,obsState,mkProj,inPoly,setView};
})();
