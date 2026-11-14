/* MODEL KAMERA SINEMA 3D untuk Edit 3D (dimuat otomatis oleh js/scene3d.js saat ada kamera yang model 3D-nya dinyalakan).
   Mesin Edit 3D memakai Canvas 2D, jadi model berbadan banyak ini digambar dengan Three.js di kanvas tersembunyi memakai sudut pandang
   kamera editor yang sama (posisi, putaran, FOV), lalu hasilnya ditempel ke scene oleh scene3d.js dan diurutkan berdasarkan kedalaman.
   Three.js (r128) dimuat dari cdnjs hanya saat dibutuhkan. Kalau gagal dimuat (offline), scene3d.js menampilkan kotak penanda.
   Sumbu model: +X = arah lensa, +Y = atas, +Z = kanan. Titik pegangan (pivot) = ujung depan matte box = titik mata kamera.
   Dunia editor: x kanan, y bawah, z maju. Dunia Three: x kanan, y atas, z ke arah penonton. Konversi = putar 180° di sumbu X (y dan z dibalik). */
(function(){
'use strict';
window.APK=window.APK||{};
const SRC='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',D=Math.PI/180;
let T=null,rd=null,sc=null,ob=null,root=null,cg=null,ready=false,failed=false,loadP=null;
const col=(M,j)=>[M[j],M[3+j],M[6+j]];
const mul=(A,B)=>{const r=new Array(9);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i*3+j]=A[i*3]*B[j]+A[i*3+1]*B[3+j]+A[i*3+2]*B[6+j];return r};
const MC=[1,0,0,0,-1,0,0,0,-1];   /* sumbu kamera Three (kanan, atas, belakang) -> sumbu kamera editor (kanan, bawah, maju) */
/* M = matriks rotasi 3x3 (baris demi baris) di dunia editor; kolomnya diubah ke dunia Three */
function basis(obj,M,p,s){
  const c=[0,1,2].map(j=>{const v=col(M,j);return new T.Vector3(v[0]*s,-v[1]*s,-v[2]*s)});
  obj.matrix.makeBasis(c[0],c[1],c[2]);obj.matrix.setPosition(p[0],-p[1],-p[2]);obj.matrixWorldNeedsUpdate=true;
}

function makeSky(){
  return new T.Mesh(new T.SphereGeometry(80,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 p;void main(){p=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 p;void main(){float h=p.y;
      vec3 top=vec3(.12,.2,.45),mid=vec3(.95,.5,.25),low=vec3(1.,.72,.35);
      vec3 c=mix(low,mid,smoothstep(0.,.25,h));c=mix(c,top,smoothstep(.2,.8,h));
      vec3 sd=normalize(vec3(-.8,.12,-.6));float s=max(dot(p,sd),0.);
      c+=vec3(1.,.8,.5)*pow(s,40.)*1.5+vec3(1.,.9,.7)*pow(s,600.)*6.;
      c=mix(c,vec3(.25,.18,.12),smoothstep(0.,-.15,h));
      gl_FragColor=vec4(c,1.);}`}));
}

/* ===== model kamera (badan, lensa, matte box, rel, monitor, baterai, kabel) ===== */
function buildModel(){
  const M={
    body:new T.MeshStandardMaterial({color:0x17171b,roughness:.55,metalness:.45}),
    dark:new T.MeshStandardMaterial({color:0x0c0c0e,roughness:.8,metalness:.2}),
    rubber:new T.MeshStandardMaterial({color:0x080808,roughness:.95,metalness:0}),
    metal:new T.MeshStandardMaterial({color:0xb5b8bd,roughness:.28,metalness:1}),
    red:new T.MeshStandardMaterial({color:0xc0121b,roughness:.35,metalness:.7}),
    glass:new T.MeshPhysicalMaterial({color:0x101830,roughness:.02,metalness:.1,clearcoat:1,clearcoatRoughness:0,envMapIntensity:2}),
    led:c=>new T.MeshBasicMaterial({color:c})
  };
  const cam=new T.Group();
  const box=(w,h,d,x,y,z,m=M.body,p=cam)=>{const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);p.add(o);return o};
  const cylX=(r,l,x,y,z,m=M.body,p=cam,r2=r)=>{const o=new T.Mesh(new T.CylinderGeometry(r2,r,l,48),m);o.rotation.z=-Math.PI/2;o.position.set(x,y,z);p.add(o);return o};
  const cylY=(r,l,x,y,z,m=M.metal,p=cam)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,l,32),m);o.position.set(x,y,z);p.add(o);return o};
  const cylZ=(r,l,x,y,z,m=M.metal,p=cam)=>{const o=new T.Mesh(new T.CylinderGeometry(r,r,l,32),m);o.rotation.x=Math.PI/2;o.position.set(x,y,z);p.add(o);return o};
  const screw=(x,y,z,axis='z')=>(axis==='z'?cylZ:cylY)(.025,.02,x,y,z,M.metal);
  function textTex(draw,w=512,h=256){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=8;return t}

  /* badan */
  box(1.15,.85,.72,0,0,0);
  box(1.17,.12,.74,0,.3,0,M.dark);
  for(let i=0;i<8;i++)box(.03,.5,.01,-.45+i*.06,-.05,.365,M.dark);
  box(.5,.4,.01,.0,.0,-.365,M.dark);
  [[.3,.22],[.3,.1],[.3,-.02]].forEach(([x,y],i)=>{cylZ(.035,.02,x-.35+.0,y,.37,i==1?M.red:M.metal)});
  box(.05,.04,.01,-.2,.25,.37,M.led(0x30ff60));box(.05,.04,.01,-.1,.25,.37,M.led(0xff2020));
  const logo=new T.Mesh(new T.PlaneGeometry(.5,.16),new T.MeshBasicMaterial({transparent:true,map:textTex((g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#c0121b';g.font='bold 190px Arial';g.textAlign='center';g.fillText('RED',w/2,190)},512,256)}));
  logo.position.set(-.15,-.22,.372);cam.add(logo);
  cylX(.33,.14,.62,.08,0,M.metal);cylX(.29,.06,.7,.08,0,M.dark);
  box(.2,.6,.6,.45,.05,0,M.body);
  for(let a=0;a<6;a++){const t=a/6*Math.PI*2;screw(.7,.08+Math.sin(t)*.31,Math.cos(t)*.31,'z')}

  /* lensa */
  function ringTex(label){return textTex((g,w,h)=>{
    g.fillStyle='#0b0b0d';g.fillRect(0,0,w,h);
    g.strokeStyle='#ddd';g.fillStyle='#eee';g.font='bold 34px Arial';g.textAlign='center';
    for(let i=0;i<64;i++){const x=i*w/64;g.lineWidth=i%4?2:4;g.beginPath();g.moveTo(x,10);g.lineTo(x,i%4?30:46);g.stroke()}
    if(label){label.forEach((s,i)=>{g.fillStyle=i%2?'#ffd24a':'#fff';g.fillText(s,(i+.5)*w/label.length,100)})}
    g.fillStyle='#222';for(let i=0;i<128;i++){g.fillRect(i*w/128,150,w/256,106)}
  },1024,256)}
  const ringMat=l=>new T.MeshStandardMaterial({map:ringTex(l),roughness:.5,metalness:.5});
  const lens=new T.Group();cam.add(lens);lens.position.y=.08;
  function ring(r,len,x,mat,r2){const o=new T.Mesh(new T.CylinderGeometry(r2||r,r,len,64,1),[mat,M.dark,M.dark]);o.rotation.z=-Math.PI/2;o.position.x=x;lens.add(o);return o}
  ring(.27,.35,.95,M.body);
  ring(.335,.38,1.3,ringMat(['18','25','35','50','75','\u221e']));
  ring(.31,.08,1.55,M.metal);
  ring(.34,.34,1.76,ringMat(['T2.9','4','5.6','8','11','16']));
  ring(.30,.14,1.99,M.body);
  ring(.36,.18,2.15,M.dark);
  cylX(.3,.04,2.25,0,0,M.metal,lens);
  const front=new T.Mesh(new T.CircleGeometry(.27,48),M.glass);front.rotation.y=Math.PI/2;front.position.x=2.26;lens.add(front);
  [.2,.13,.07].forEach((r,i)=>{const c=new T.Mesh(new T.RingGeometry(r-.012,r,48),new T.MeshBasicMaterial({color:i?0x6a3aa8:0x2a8a6a,transparent:true,opacity:.5,side:2}));c.rotation.y=Math.PI/2;c.position.x=2.265;lens.add(c)});
  const lt=new T.Mesh(new T.PlaneGeometry(.38,.1),new T.MeshBasicMaterial({transparent:true,map:textTex((g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 80px Arial';g.textAlign='center';g.fillText('18 35 75',w/2,110)},512,128)}));
  lt.position.set(1.3,.1,.337);lens.add(lt);

  /* rel dan baseplate */
  box(1.1,.08,.64,.05,-.5,0,M.body);box(.5,.12,.5,.3,-.58,0,M.dark);
  [-.2,.2].forEach(z=>{cylX(.035,2.7,1.0,-.46,z,M.metal)});
  box(.18,.2,.6,.25,-.46,0,M.body);box(.18,.2,.6,1.5,-.46,0,M.body);
  box(.16,.12,.4,1.3,-.28,0,M.dark);cylY(.03,.3,1.3,-.2,0,M.metal);

  /* matte box */
  function frame(w,h,r,depth,mat){
    const s=new T.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();
    const hole=new T.Path();hole.absarc(0,0,r,0,Math.PI*2,true);s.holes.push(hole);
    const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,curveSegments:48});
    g.translate(0,0,-depth/2);g.rotateY(Math.PI/2);return new T.Mesh(g,mat);
  }
  const mb=new T.Group();cam.add(mb);mb.position.y=.08;
  const bel=frame(.92,.86,.36,.5,M.rubber);bel.position.x=2.55;mb.add(bel);
  for(let i=0;i<5;i++){const r=frame(.97,.91,.37,.03,M.dark);r.position.x=2.34+i*.1;mb.add(r)}
  const mf=frame(1.1,1.05,.44,.12,M.body);mf.position.x=2.88;mb.add(mf);
  const lip=frame(1.12,1.07,.5,.04,M.dark);lip.position.x=2.96;mb.add(lip);
  const topF=box(.5,.02,1.1,3.15,.62,0,M.dark,mb);topF.rotation.z=.04;
  [-1,1].forEach(s=>{const w=box(.45,.8,.02,3.1,0,s*.6,M.dark,mb);w.rotation.y=s*.12});
  cylZ(.045,.5,2.3,-.5,0,M.metal);box(.2,.12,.14,2.3,-.46,0,M.body);
  [-.2,.2].forEach(z=>box(.14,.4,.1,2.3,-.28,z*1.3,M.body));
  box(.08,.5,.9,2.35,-.1,0,M.body,mb).position.y=-.15;

  /* handle atas */
  box(.9,.07,.42,-.05,.5,0,M.body);
  for(let i=0;i<6;i++){cylY(.022,.02,-.4+i*.15,.54,.12,M.metal);cylY(.022,.02,-.4+i*.15,.54,-.12,M.metal)}
  box(.3,.14,.3,.1,.4,0,M.dark);
  box(.5,.12,.34,.25,.6,0,M.dark);
  cylY(.03,.2,.25,.7,0,M.metal);
  cylX(.04,.9,-.35,.62,.15,M.body);box(.08,.2,.08,-.75,.55,.15,M.body);box(.08,.2,.08,.0,.55,.15,M.body);
  cylY(.03,.25,.0,.78,.15,M.metal);

  /* monitor */
  const arm=new T.Group();cam.add(arm);
  cylY(.05,.55,-.35,.85,-.05,M.body,arm);
  cylX(.04,.9,.0,1.12,-.05,M.body,arm);
  cylY(.06,.1,-.35,1.12,-.05,M.metal,arm);
  const monTex=textTex((g,w,h)=>{g.fillStyle='#17171a';g.fillRect(0,0,w,h);g.fillStyle='#eee';g.font='bold 62px Arial';g.textAlign='center';g.fillText('RED PRO 5.0',w/2,h/2+8);g.fillStyle='#c0121b';g.fillRect(40,h/2+30,w-80,6)},512,256);
  const monMat=new T.MeshStandardMaterial({map:monTex,roughness:.5,metalness:.4});
  const mon=new T.Mesh(new T.BoxGeometry(1.15,.07,.8),[M.body,M.body,monMat,monMat,M.body,M.body]);
  mon.position.set(.3,1.2,-.1);mon.rotation.set(.0,.0,-.32);mon.rotation.y=.02;arm.add(mon);
  const scr=new T.Mesh(new T.PlaneGeometry(1.0,.68),new T.MeshStandardMaterial({color:0x05070a,roughness:.05,metalness:.3,emissive:0x0a1220}));
  scr.rotation.x=Math.PI/2;scr.position.y=-.037;mon.add(scr);
  box(.12,.1,.12,-.25,1.17,-.05,M.body,arm);

  /* baterai belakang */
  box(.5,.75,.62,-.82,-.02,0,M.body);
  box(.04,.55,.5,-1.08,0,0,M.dark);
  const ab=new T.Mesh(new T.PlaneGeometry(.45,.16),new T.MeshBasicMaterial({transparent:true,map:textTex((g,w,h)=>{g.fillStyle='#141416';g.fillRect(0,0,w,h);g.fillStyle='#e8e8e8';g.font='bold 64px Arial';g.textAlign='center';g.fillText('ANTON',w/2,100);g.fillStyle='#ffc400';g.fillRect(40,125,w-80,10)},512,160)}));
  ab.position.set(-.82,.1,.312);cam.add(ab);
  const ab2=ab.clone();ab2.rotation.y=Math.PI;ab2.position.z=-.312;cam.add(ab2);
  box(.2,.12,.5,-.8,.3,0,M.dark);
  cylY(.03,.1,-.82,.42,0,M.red);

  /* kabel */
  function cable(pts,c=0x1a4fd0,r=.017){const cv=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
    cam.add(new T.Mesh(new T.TubeGeometry(cv,60,r,10),new T.MeshStandardMaterial({color:c,roughness:.4,metalness:.2})))}
  cable([[.0,1.08,-.05],[.1,.95,-.3],[.3,.5,-.45],[.55,.15,-.42],[.55,-.1,-.37]]);
  cable([[-.35,.5,.2],[-.2,.35,.5],[.2,.1,.45],[.5,0,.37]],0x111111,.014);
  cable([[-.82,.3,.25],[-.5,.65,.35],[-.1,.7,.3]],0x111111,.015);
  return cam;
}

/* ===== kerucut pandang (dari titik mata, searah lensa; ujung jauh = bidang fokus) ===== */
function makeCone(){
  const g=new T.Group();
  const lp=new Float32Array(16*3),lg=new T.BufferGeometry();lg.setAttribute('position',new T.BufferAttribute(lp,3));
  const lines=new T.LineSegments(lg,new T.LineBasicMaterial({color:0xffd24a,transparent:true,opacity:.8,depthWrite:false}));lines.frustumCulled=false;
  const fp=new Float32Array(18*3),fg=new T.BufferGeometry();fg.setAttribute('position',new T.BufferAttribute(fp,3));
  const faces=new T.Mesh(fg,new T.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.07,side:T.DoubleSide,depthWrite:false}));faces.frustumCulled=false;
  g.add(faces);g.add(lines);g.userData={lp,fp,lg,fg,lines,faces};
  return g;
}
function updCone(g,L,fov,asp,hi){
  const h=Math.tan(fov*D/2)*L,w=h*asp,u=g.userData,A=[0,0,0],c=[[L,h,w],[L,h,-w],[L,-h,-w],[L,-h,w]];
  let n=0;const put=(arr,v)=>{arr[n++]=v[0];arr[n++]=v[1];arr[n++]=v[2]};
  for(let i=0;i<4;i++){put(u.lp,A);put(u.lp,c[i])}
  for(let i=0;i<4;i++){put(u.lp,c[i]);put(u.lp,c[(i+1)%4])}
  n=0;
  for(let i=0;i<4;i++){put(u.fp,A);put(u.fp,c[i]);put(u.fp,c[(i+1)%4])}
  put(u.fp,c[0]);put(u.fp,c[1]);put(u.fp,c[2]);put(u.fp,c[0]);put(u.fp,c[2]);put(u.fp,c[3]);
  u.lg.attributes.position.needsUpdate=true;u.fg.attributes.position.needsUpdate=true;
  u.lines.material.opacity=hi?1:.75;u.faces.material.opacity=hi?.13:.07;
}

function init(){
  rd=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
  rd.setPixelRatio(1);rd.outputEncoding=T.sRGBEncoding;rd.toneMapping=T.ACESFilmicToneMapping;rd.toneMappingExposure=1.1;rd.setClearColor(0x000000,0);
  sc=new T.Scene();
  {const es=new T.Scene();es.add(makeSky());const pm=new T.PMREMGenerator(rd);sc.environment=pm.fromScene(es,0).texture}
  const sun=new T.DirectionalLight(0xffa860,2.6);sun.position.set(-8,3.5,-6);sc.add(sun);
  sc.add(new T.HemisphereLight(0x8aa0d8,0x3a2a1c,.5));
  const fill=new T.DirectionalLight(0x7f9fff,.5);fill.position.set(6,4,6);sc.add(fill);
  ob=new T.PerspectiveCamera(50,1,10,40000);ob.matrixAutoUpdate=false;
  root=new T.Group();root.matrixAutoUpdate=false;sc.add(root);
  const body=buildModel();body.position.set(-3.2,-.08,0);root.add(body);   /* pivot = ujung depan matte box */
  cg=makeCone();root.add(cg);
  ready=true;
}
function load(){
  if(loadP)return loadP;
  loadP=new Promise(res=>{
    const go=()=>{try{T=window.THREE;init();res(true)}catch(e){console.warn('Model kamera 3D gagal dibuat',e);failed=true;res(false)}};
    if(window.THREE){go();return}
    const s=document.createElement('script');s.src=SRC;s.onload=go;s.onerror=()=>{failed=true;res(false)};document.head.appendChild(s);
  });
  return loadP;
}
/* o: {W,H, obs:{p,R,F} (kamera pengamat), pose:{p,R,s} (posisi, rotasi dunia editor, skala), fov (derajat), range, asp, cone, hi} */
function draw(o){
  if(!ready)return null;
  const W=o.W,H=o.H;
  if(rd.domElement.width!==W||rd.domElement.height!==H)rd.setSize(W,H,false);
  ob.aspect=W/H;ob.fov=2*Math.atan(500/o.obs.F)/D;ob.updateProjectionMatrix();
  basis(ob,mul(o.obs.R,MC),o.obs.p,1);
  basis(root,o.pose.R,o.pose.p,o.pose.s);
  cg.visible=!!o.cone;
  if(o.cone)updCone(cg,Math.max(.01,o.range/o.pose.s),o.fov,o.asp,o.hi);
  rd.render(sc,ob);
  return rd.domElement;
}
APK.s3rig={load,draw,get ready(){return ready},get failed(){return failed}};
})();
