(()=>{'use strict';
const $=i=>document.getElementById(i),TAU=Math.PI*2,NL=48,HEX=/^#[0-9a-f]{6}$/i,IDENT=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
const cv=$('gl'),gl=cv.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
if(!gl){$('err').hidden=false;return}
const toast=m=>{const t=$('t3');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2400)};

/* ---------- shader ---------- */
const VS='#version 300 es\nlayout(location=0) in vec3 aP;layout(location=1) in vec3 aN;uniform mat4 uVP,uM;out vec3 vN,vW;void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(transpose(inverse(uM)))*aN;gl_Position=uVP*w;}';
const LIT='vec3 L=normalize(vec3(.5,.9,.6)),L2=normalize(vec3(-.6,.2,-.5)),H=normalize(L+V);float d=max(dot(n,L),0.)*.8+max(dot(n,L2),0.)*.25,sp=pow(max(dot(n,H),0.),8.+uGloss*120.)*uGloss*.6;';
const FS='#version 300 es\nprecision mediump float;in vec3 vN,vW;uniform vec3 uC,uEye;uniform float uGloss,uSel;uniform bool uUnlit;out vec4 o;void main(){if(uUnlit){o=vec4(uC,1.);return;}vec3 V=normalize(uEye-vW),n=normalize(vN);if(dot(n,V)<0.)n=-n;'+LIT+'vec3 c=uC*(.28+d)+vec3(sp);c=mix(c,vec3(1.,.75,.3),uSel*.22);o=vec4(c,1.);}';
/* teks 3D: NL lapisan quad bertekstur (alpha-test) yang ditumpuk di sumbu Z; bevel = ambang yang naik di lapisan depan/belakang */
const TVS='#version 300 es\nuniform mat4 uVP,uM;uniform vec2 uSz;uniform float uDepth;uniform int uN;out vec2 vUV;out float vU;out vec3 vW;flat out mat3 vNM;void main(){vec2 c=vec2(float(gl_VertexID&1),float(gl_VertexID>>1));float u=float(gl_InstanceID)/float(uN-1);vec3 p=vec3((c.x-.5)*uSz.x,(c.y-.5)*uSz.y,(u-.5)*uDepth);vUV=vec2(c.x,1.-c.y);vU=u;vec4 w=uM*vec4(p,1.);vW=w.xyz;vNM=transpose(inverse(mat3(uM)));gl_Position=uVP*w;}';
const TFS='#version 300 es\nprecision highp float;in vec2 vUV;in float vU;in vec3 vW;flat in mat3 vNM;uniform sampler2D uTex;uniform vec2 uTs;uniform vec3 uC,uC2,uEye;uniform float uGloss,uSel,uBev;out vec4 o;void main(){vec2 s=texture(uTex,vUV).rg;float e=abs(2.*vU-1.),th=uBev*.9*pow(e,2.5);if(s.r<.5||s.g<th)discard;vec2 px=3./uTs;float gx=texture(uTex,vUV+vec2(px.x,0.)).g-texture(uTex,vUV-vec2(px.x,0.)).g,gy=texture(uTex,vUV+vec2(0.,px.y)).g-texture(uTex,vUV-vec2(0.,px.y)).g;vec3 nl=normalize(vec3(-gx*12.,gy*12.,vU>.5?1.:-1.));vec3 n=normalize(vNM*nl),V=normalize(uEye-vW);if(dot(n,V)<0.)n=-n;'+LIT+'vec3 base=mix(uC2,uC,smoothstep(.55,.9,abs(nl.z)));vec3 c=base*(.28+d)+vec3(sp);c=mix(c,vec3(1.,.75,.3),uSel*.22);o=vec4(c,smoothstep(.5,.75,s.r));}';
let P,PT,U,UT;
try{
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const prog=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p};
  P=prog(VS,FS);PT=prog(TVS,TFS);
}catch(e){$('err').hidden=false;$('err').textContent='Gagal memulai WebGL: '+e.message;return}
const locs=(p,n)=>Object.fromEntries(n.map(k=>[k,gl.getUniformLocation(p,k)]));
U=locs(P,['uVP','uM','uC','uEye','uGloss','uSel','uUnlit']);
UT=locs(PT,['uVP','uM','uSz','uDepth','uN','uTex','uTs','uC','uC2','uEye','uGloss','uSel','uBev']);
gl.enable(gl.DEPTH_TEST);

/* ---------- mesh bentuk pendukung ---------- */
function grid(M,nu,nv,f){const b=M.p.length/3;for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const r=f(i/nu,j/nv);M.p.push(r[0],r[1],r[2]);M.n.push(r[3],r[4],r[5])}
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=b+j*(nu+1)+i,c=a+nu+1;M.i.push(a,c,a+1,a+1,c,c+1)}}
const FACES=[[0,1,0,1,0,0,0,0,1],[0,-1,0,1,0,0,0,0,-1],[1,0,0,0,0,-1,0,1,0],[-1,0,0,0,0,1,0,1,0],[0,0,1,1,0,0,0,1,0],[0,0,-1,-1,0,0,0,1,0]];
const gen={
  cube:M=>FACES.forEach(q=>grid(M,1,1,(u,v)=>[q[0]/2+(u-.5)*q[3]+(v-.5)*q[6],q[1]/2+(u-.5)*q[4]+(v-.5)*q[7],q[2]/2+(u-.5)*q[5]+(v-.5)*q[8],q[0],q[1],q[2]])),
  sphere:M=>grid(M,32,20,(u,v)=>{const a=u*TAU,b=v*Math.PI,x=Math.sin(b)*Math.cos(a),y=Math.cos(b),z=Math.sin(b)*Math.sin(a);return[x/2,y/2,z/2,x,y,z]}),
  cylinder:M=>{grid(M,32,1,(u,v)=>{const a=u*TAU,c=Math.cos(a),s=Math.sin(a);return[c/2,v-.5,s/2,c,0,s]});[-1,1].forEach(k=>grid(M,32,1,(u,v)=>{const a=u*TAU;return[Math.cos(a)*v/2,k/2,Math.sin(a)*v/2,0,k,0]}))},
  cone:M=>{grid(M,32,1,(u,v)=>{const a=u*TAU,c=Math.cos(a),s=Math.sin(a),r=(1-v)/2;return[c*r,v-.5,s*r,c*.894,.447,s*.894]});grid(M,32,1,(u,v)=>{const a=u*TAU;return[Math.cos(a)*v/2,-.5,Math.sin(a)*v/2,0,-1,0]})},
  torus:M=>grid(M,32,16,(u,v)=>{const a=u*TAU,b=v*TAU,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);return[(.35+.15*cb)*ca,.15*sb,(.35+.15*cb)*sa,cb*ca,sb,cb*sa]}),
  plane:M=>grid(M,1,1,(u,v)=>[u-.5,0,v-.5,0,1,0])
};
const SHAPES={cube:'Kubus',sphere:'Bola',cylinder:'Silinder',cone:'Kerucut',torus:'Donat',plane:'Bidang'},NAMES={text:'Teks 3D',...SHAPES};
const EXT={cube:[.5,.5,.5],sphere:[.5,.5,.5],cylinder:[.5,.5,.5],cone:[.5,.5,.5],torus:[.5,.15,.5],plane:[.5,.03,.5]};
const FONTS=['Impact','Arial Black','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Comic Sans MS','Brush Script MT','sans-serif'];
const meshes={};
function buf(t,d,loc,Arr){const b=gl.createBuffer();gl.bindBuffer(t,b);gl.bufferData(t,new Arr(d),gl.STATIC_DRAW);if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0)}}
for(const k in gen){const M={p:[],n:[],i:[]};gen[k](M);const vao=gl.createVertexArray();gl.bindVertexArray(vao);buf(gl.ARRAY_BUFFER,M.p,0,Float32Array);buf(gl.ARRAY_BUFFER,M.n,1,Float32Array);buf(gl.ELEMENT_ARRAY_BUFFER,M.i,-1,Uint16Array);meshes[k]={vao,n:M.i.length}}
const gv=[];for(let i=-10;i<=10;i++)if(i)gv.push(-10,0,i,10,0,i,i,0,-10,i,0,10);gv.push(-10,0,0,10,0,0,0,0,-10,0,0,10);
const gvao=gl.createVertexArray();gl.bindVertexArray(gvao);buf(gl.ARRAY_BUFFER,gv,0,Float32Array);

/* ---------- tekstur teks ---------- */
function box(s,d,n,m,ls,es,r){const k=1/(2*r+1);for(let l=0;l<n;l++){const b=l*ls;let acc=0;for(let x=-r;x<=r;x++)acc+=s[b+clamp(x,0,m-1)*es];for(let x=0;x<m;x++){d[b+x*es]=acc*k;acc+=s[b+Math.min(x+r+1,m-1)*es]-s[b+Math.max(x-r,0)*es]}}}
function buildTex(o){
  const lines=(o.text||' ').split('\n').slice(0,8),PAD=70,FS=200,c=document.createElement('canvas'),x=c.getContext('2d',{willReadFrequently:true});
  const font=p=>(o.bold?'bold ':'')+p+'px "'+o.font+'",sans-serif',widest=()=>Math.max(20,...lines.map(l=>x.measureText(l).width));
  let px=FS;x.font=font(px);let mw=widest();
  if(mw+PAD*2>2048){px=Math.floor(FS*(2048-PAD*2)/mw);x.font=font(px);mw=widest()}
  const lh=Math.round(px*1.2),w=Math.ceil(mw)+PAD*2,h=lh*lines.length+PAD*2;
  c.width=w;c.height=h;x.font=font(px);x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fff';
  lines.forEach((l,i)=>x.fillText(l,w/2,PAD+lh*(i+.5)));
  const im=x.getImageData(0,0,w,h).data,n=w*h,a=new Float32Array(n),t=new Float32Array(n),d=new Uint8Array(n*4);
  for(let i=0;i<n;i++){a[i]=im[i*4+3];d[i*4]=a[i]}
  for(let p=0;p<3;p++){box(a,t,h,w,w,1,11);box(t,a,w,h,1,w,11)}
  for(let i=0;i<n;i++)d[i*4+1]=a[i];
  if(!o._gt)o._gt=gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D,o._gt);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,d);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  o._w=w/px;o._h=h/px;o._tw=w;o._th=h;o._dirty=false}
const ensureTex=o=>{if(!o._gt||(o._dirty&&performance.now()-o._at>150))buildTex(o)};

/* ---------- matematika ---------- */
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mulk=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nrm=a=>mulk(a,1/Math.hypot(...a));
const persp=(f,a,n,fa)=>{const t=1/Math.tan(f/2),r=1/(n-fa);return[t/a,0,0,0,0,t,0,0,0,0,(n+fa)*r,-1,0,0,2*n*fa*r,0]};
const mul=(a,b)=>{const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o};
const CAM0=()=>({y:.35,p:.2,d:5.5,t:[0,.5,0],f:.9,r:0}),cam=CAM0();
function camV(){const e=add(cam.t,mulk([Math.cos(cam.p)*Math.sin(cam.y),Math.sin(cam.p),Math.cos(cam.p)*Math.cos(cam.y)],cam.d)),f=nrm(sub(cam.t,e));let r=nrm(cross(f,[0,1,0])),u=cross(r,f);
  const cr=Math.cos(cam.r),sr=Math.sin(cam.r);[r,u]=[sub(mulk(r,cr),mulk(u,sr)),add(mulk(u,cr),mulk(r,sr))];return{e,f,r,u}}
const view=c=>[c.r[0],c.u[0],-c.f[0],0,c.r[1],c.u[1],-c.f[1],0,c.r[2],c.u[2],-c.f[2],0,-dot(c.r,c.e),-dot(c.u,c.e),dot(c.f,c.e),1];
function rot(r){const[x,y,z]=r.map(d=>d*Math.PI/180),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  return[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,-sy,cy*sx,cy*cx]}
function model(o){const R=rot(o.r),s=o.s,p=o.p;return[R[0]*s[0],R[3]*s[0],R[6]*s[0],0,R[1]*s[1],R[4]*s[1],R[7]*s[1],0,R[2]*s[2],R[5]*s[2],R[8]*s[2],0,p[0],p[1],p[2],1]}
function toLocal(o,v,pt){const R=rot(o.r);if(pt)v=sub(v,o.p);return[0,1,2].map(i=>(R[i]*v[0]+R[3+i]*v[1]+R[6+i]*v[2])/o.s[i])}
const extOf=o=>o.type==='text'?[(o._w||1)/2,(o._h||1)/2,o.depth/2]:EXT[o.type];
function hit(o,ro,rd){const a=toLocal(o,ro,1),d=toLocal(o,rd,0),e=extOf(o);let t0=0,t1=1e9;
  for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(Math.abs(a[i])>e[i])return-1;continue}let u=(-e[i]-a[i])/d[i],v=(e[i]-a[i])/d[i];if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return-1}return t0}
function ray(px,py){const r=cv.getBoundingClientRect(),x=(px-r.left)/r.width*2-1,y=1-(py-r.top)/r.height*2,k=Math.tan(cam.f/2),c=camV();
  return[c.e,nrm(add(add(c.f,mulk(c.r,x*k*r.width/r.height)),mulk(c.u,y*k)))]}
const hex=c=>[1,3,5].map(i=>parseInt(c.substr(i,2),16)/255);

/* ---------- state ---------- */
const S={objs:[],sel:-1,dur:5,bg:'#121419',mo:'smooth',asp:'16:9',res:1080,grid:true,camAnim:true,ck:[]},COLORS=['#7f8cff','#ff7f9c','#7fe0a0','#ffd27f','#7fd4ff','#d28fff'];
let T=0,playing=false,last=0,clean=false,rec=null,fitKey='';
const v3=(a,d)=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)?a.slice():d;
function mk(type,s={},n=S.objs.length){
  const tx=type==='text',k=S.objs.filter(o=>o.type==='text').length;
  const o={name:String(s.name||NAMES[type]+' '+(n+1)).slice(0,40),type,
    p:v3(s.p,tx?[0,.6-1.3*k,0]:[((n+2)%5-2)*1.3,type==='plane'?0:.5,-Math.floor((n+2)/5)*1.3]),r:v3(s.r,[0,0,0]),s:v3(s.s,[1,1,1]).map(v=>Math.max(.01,v)),
    c:HEX.test(s.c)?s.c:(tx?'#ffd27f':COLORS[n%6]),g:Number.isFinite(s.g)?clamp(s.g,0,1):.3,
    k:cleanKeys((Array.isArray(s.k)?s.k:[]).filter(k=>k&&Number.isFinite(k.t)).map(k=>({t:k.t,p:v3(k.p,[0,0,0]),r:v3(k.r,[0,0,0]),s:v3(k.s,[1,1,1])})))};
  if(tx){o.text=String(s.text??'TEKS 3D').slice(0,200);o.font=FONTS.includes(s.font)?s.font:FONTS[0];o.bold=!!s.bold;o.depth=clamp(+s.depth||.4,.05,3);o.bev=Number.isFinite(+s.bev)&&s.bev!=null?clamp(+s.bev,0,1):.35;o.c2=HEX.test(s.c2)?s.c2:'#b5652b'}
  return o}
function cleanKeys(a){a.sort((x,y)=>x.t-y.t);return a.filter((k,i)=>!i||k.t-a[i-1].t>.001)}

/* interpolasi keyframe: Mulus (kubik Hermite), Halus (ease in-out per segmen), Linear */
function interp(V,Ts,t){const n=Ts.length;if(t<=Ts[0])return V[0];if(t>=Ts[n-1])return V[n-1];let i=0;while(t>Ts[i+1])i++;
  const dt=Ts[i+1]-Ts[i];let u=(t-Ts[i])/dt;const a=V[i],b=V[i+1];
  if(S.mo==='linear')return a.map((x,j)=>x+(b[j]-x)*u);
  if(S.mo==='ease'){u=u*u*(3-2*u);return a.map((x,j)=>x+(b[j]-x)*u)}
  const tg=(k,j)=>k<=0||k>=n-1?0:(V[k+1][j]-V[k-1][j])/(Ts[k+1]-Ts[k-1]),u2=u*u,u3=u2*u,h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
  return a.map((x,j)=>h00*x+h10*dt*tg(i,j)+h01*b[j]+h11*dt*tg(i+1,j))}
function evalObj(o,t){const k=o.k;if(!k.length)return;const v=interp(k.map(x=>[...x.p,...x.r,...x.s]),k.map(x=>x.t),t);o.p=v.slice(0,3);o.r=v.slice(3,6);o.s=v.slice(6,9).map(x=>Math.max(.01,x))}
function recordKey(o){const n={t:T,p:o.p.slice(),r:o.r.slice(),s:o.s.slice()},i=o.k.findIndex(k=>Math.abs(k.t-T)<.02);if(i>=0)o.k[i]=n;else{o.k.push(n);o.k.sort((a,b)=>a.t-b.t)}}
const camVec=()=>[cam.y,cam.p,cam.d,...cam.t,cam.f,cam.r];
function evalCam(t){const k=S.ck;if(!k.length)return;const v=interp(k.map(x=>x.v),k.map(x=>x.t),t);cam.y=v[0];cam.p=clamp(v[1],-1.45,1.45);cam.d=Math.max(.5,v[2]);cam.t=[v[3],v[4],v[5]];cam.f=clamp(v[6],.3,1.7);cam.r=v[7]}
function recordCamKey(){const n={t:T,v:camVec()},i=S.ck.findIndex(k=>Math.abs(k.t-T)<.02);if(i>=0){S.ck[i]=n;return false}S.ck.push(n);S.ck.sort((a,b)=>a.t-b.t);return true}
function camEdit(){if(S.camAnim&&S.ck.length&&!playing&&!rec&&recordCamKey())updateTicks()}

/* gerakan kamera siap pakai: dibuat dari posisi kamera sekarang sepanjang durasi timeline */
const mv=(b,f)=>{const v=b.slice();f(v);return v},cp=x=>clamp(x,-1.3,1.3);
function slide(b,D,s){const c=camV(),k=b[2]*.45*s,m=a=>mv(b,v=>{v[3]+=c.r[0]*k*a;v[4]+=c.r[1]*k*a;v[5]+=c.r[2]*k*a});return[{t:0,v:m(-1)},{t:D,v:m(1)}]}
const PRESETS={
  'Orbit 360°':(b,D)=>Array.from({length:9},(_,i)=>({t:D*i/8,v:mv(b,v=>{v[0]+=TAU*i/8})})),
  'Zoom masuk':(b,D)=>[{t:0,v:b},{t:D,v:mv(b,v=>{v[2]*=.45})}],
  'Zoom keluar':(b,D)=>[{t:0,v:b},{t:D,v:mv(b,v=>{v[2]*=2})}],
  'Geser kanan':(b,D)=>slide(b,D,1),
  'Geser kiri':(b,D)=>slide(b,D,-1),
  'Naik (crane)':(b,D)=>[{t:0,v:mv(b,v=>{v[1]=cp(v[1]-.45)})},{t:D,v:mv(b,v=>{v[1]=cp(v[1]+.4)})}],
  'Sinematik':(b,D)=>[{t:0,v:mv(b,v=>{v[0]-=.7;v[2]*=1.25;v[1]=cp(v[1]-.08)})},{t:D*.55,v:b},{t:D,v:mv(b,v=>{v[0]+=.7;v[2]*=.7;v[1]=cp(v[1]+.1)})}],
  'Dolly zoom':(b,D)=>{const k=b[2]*Math.tan(b[6]/2),m=f=>mv(b,v=>{v[6]=f;v[2]=k/Math.tan(f/2)});return[{t:0,v:m(.45)},{t:D,v:m(1.5)}]},
  'Getar tangan':(b,D)=>{let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647-.5,n=Math.min(400,Math.max(2,Math.round(D/.2))),o=[];
    for(let i=0;i<=n;i++)o.push({t:D*i/n,v:i?mv(b,v=>{v[0]+=r()*.03;v[1]+=r()*.025;v[3]+=r()*.08;v[4]+=r()*.06;v[7]+=r()*.03}):b});return o}
};
function applyPreset(n){S.ck=PRESETS[n](camVec(),S.dur).map(k=>({t:k.t,v:k.v.slice()}));S.camAnim=true;$('camAnim').checked=true;playing=false;lab();setT(0);evalCam(0);changed();toast('Gerakan kamera: '+n)}

const ser=()=>JSON.stringify({S,cam},(k,v)=>k[0]==='_'?undefined:v);
const persist=()=>{try{localStorage.setItem('apk3d',ser())}catch(e){}};
const changed=()=>{updateTicks();persist()};
function load(j){const s=j&&j.S;if(!s||!Array.isArray(s.objs))throw new Error('format');
  S.objs.forEach(o=>o._gt&&gl.deleteTexture(o._gt));
  S.objs=[];s.objs.filter(o=>o&&(o.type==='text'||meshes[o.type])).forEach((o,i)=>S.objs.push(mk(o.type,o,i)));
  S.dur=clamp(+s.dur||5,.5,120);S.bg=HEX.test(s.bg)?s.bg:'#121419';S.mo=['smooth','ease','linear'].includes(s.mo)?s.mo:'smooth';
  S.asp=['16:9','9:16','1:1'].includes(s.asp)?s.asp:'16:9';S.res=s.res===720?720:1080;S.grid=s.grid!==false;S.camAnim=s.camAnim!==false;
  S.ck=cleanKeys((Array.isArray(s.ck)?s.ck:[]).filter(k=>k&&Number.isFinite(k.t)&&Array.isArray(k.v)&&k.v.length===8&&k.v.every(Number.isFinite)).map(k=>({t:k.t,v:k.v.slice()})));
  Object.assign(cam,CAM0());const c=j.cam;if(c&&Array.isArray(c.t)&&[c.y,c.p,c.d].every(Number.isFinite))Object.assign(cam,{y:c.y,p:c.p,d:c.d,t:v3(c.t,[0,.5,0]),f:Number.isFinite(c.f)?c.f:.9,r:Number.isFinite(c.r)?c.r:0});
  $('bg').value=S.bg;$('dur').value=S.dur;$('tm').max=S.dur;$('mo').value=S.mo;$('asp').value=S.asp;$('res').value=S.res;$('grid').checked=S.grid;$('camAnim').checked=S.camAnim;
  playing=false;lab();setT(0);select(S.objs.length?0:-1)}

/* ---------- UI ---------- */
const set=(e,v)=>{if(document.activeElement!==e)e.value=v};
$('props').innerHTML='<p id="pe" class="meta">Ketuk objek di kanvas atau di daftar untuk mengedit.</p><div id="pf" hidden><label>Nama<input id="pn" maxlength="40"></label>'+
  '<div id="tx" hidden><label>Teks (Enter = baris baru)<textarea data-t="text" rows="2" maxlength="200"></textarea></label><label>Font<select data-t="font">'+FONTS.map(f=>'<option>'+f+'</option>').join('')+'</select></label>'+
  '<label class="row"><span>Tebal</span><input type="checkbox" data-t="bold"></label><label>Kedalaman<input type="range" data-t="depth" min=".05" max="2" step=".05"></label><label>Bevel (tepi membulat)<input type="range" data-t="bev" min="0" max="1" step=".05"></label><label>Warna sisi<input type="color" data-t="c2"></label></div>'+
  [['Posisi','p',.1],['Rotasi °','r',5],['Skala','s',.1]].map(([l,q,st])=>'<div class="prow"><span class="meta">'+l+'</span>'+[0,1,2].map(i=>'<input type="number" step="'+st+'" data-q="'+q+'" data-i="'+i+'" aria-label="'+l+' '+'XYZ'[i]+'">').join('')+'</div>').join('')+
  '<label>Warna depan<input type="color" id="col"></label><label>Kilap<input type="range" id="gloss" min="0" max="1" step=".05"></label><div class="prow2"><button class="btn" id="b-dup">Duplikat</button><button class="btn" id="b-foc">Fokus kamera</button><button class="btn danger" id="b-del">Hapus</button></div></div>';
$('campane').innerHTML='<label>Sudut pandang (FOV)<input type="range" id="cfov" min="20" max="110" step="1"></label><label>Miring (roll)<input type="range" id="croll" min="-45" max="45" step="1"></label>'+
  '<label class="row"><span>Pakai keyframe kamera</span><input type="checkbox" id="camAnim" checked></label><div class="prow2"><button class="btn" id="b-ckd">Hapus keyframe di waktu ini</button><button class="btn danger" id="b-cclr">Hapus semua</button></div>'+
  '<h3>Gerakan kamera siap pakai</h3><p class="meta">Mulai dari posisi kamera sekarang dan memakai durasi timeline. Setelah itu geser kamera di waktu tertentu untuk menambah keyframe.</p><div id="presets" class="prow2"></div>';
Object.keys(PRESETS).forEach(n=>{const b=document.createElement('button');b.className='btn';b.textContent=n;b.onclick=()=>applyPreset(n);$('presets').append(b)});
Object.keys(SHAPES).forEach(k=>{const b=document.createElement('button');b.className='btn';b.textContent='+ '+SHAPES[k];b.onclick=()=>{S.objs.push(mk(k));select(S.objs.length-1);persist()};$('shapes').append(b)});
$('add-text').onclick=()=>{S.objs.push(mk('text'));select(S.objs.length-1);persist()};
function renderList(){const l=$('list');l.innerHTML='';S.objs.forEach((o,i)=>{const b=document.createElement('button');b.className='btn li'+(i===S.sel?' on':'');b.textContent=o.name;b.onclick=()=>select(i);l.append(b)});
  if(!S.objs.length)l.innerHTML='<p class="meta">Belum ada objek.</p>'}
function syncProps(){const o=S.objs[S.sel];$('pf').hidden=!o;$('pe').hidden=!!o;if(!o)return;
  $('tx').hidden=o.type!=='text';set($('pn'),o.name);
  document.querySelectorAll('[data-q]').forEach(e=>set(e,+(+o[e.dataset.q][e.dataset.i]).toFixed(3)));set($('col'),o.c);set($('gloss'),o.g);
  if(o.type==='text')document.querySelectorAll('[data-t]').forEach(e=>{if(e.type==='checkbox')e.checked=!!o[e.dataset.t];else set(e,o[e.dataset.t])})}
function syncCam(){set($('cfov'),Math.round(cam.f*180/Math.PI));set($('croll'),Math.round(cam.r*180/Math.PI))}
function updateTicks(){const o=S.objs[S.sel],tk=a=>a.map(k=>'<i style="left:'+(k.t/S.dur*100)+'%"></i>').join('');$('ticks').innerHTML=o?tk(o.k):'';$('ticksc').innerHTML=tk(S.ck);$('b-kf').disabled=$('b-kd').disabled=!o}
function select(i){S.sel=i;renderList();syncProps();updateTicks()}
function setT(t){T=clamp(t,0,S.dur);$('tm').value=T;$('tt').textContent=T.toFixed(2)+' / '+S.dur.toFixed(2)+' s'}
function lab(){$('b-play').textContent=playing?'\u275a\u275a':'\u25b6';$('b-vid').textContent=rec?'\u25a0 Selesai':'Rekam Video'}
function del(){const o=S.objs[S.sel];if(!o)return;if(o._gt)gl.deleteTexture(o._gt);S.objs.splice(S.sel,1);select(Math.min(S.sel,S.objs.length-1));persist()}
function focusSel(){const o=S.objs[S.sel];if(o){cam.t=o.p.slice();camEdit()}}

document.querySelectorAll('.tabs [data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs [data-tab]').forEach(x=>x.classList.toggle('on',x===b));$('props').hidden=b.dataset.tab!=='o';$('campane').hidden=b.dataset.tab!=='c'});
$('props').addEventListener('input',e=>{const o=S.objs[S.sel],t=e.target;if(!o)return;
  if(t.dataset.q){const v=parseFloat(t.value);if(isNaN(v))return;o[t.dataset.q][+t.dataset.i]=t.dataset.q==='s'?Math.max(.01,v):v;if(o.k.length)recordKey(o)}
  else if(t.dataset.t){const k=t.dataset.t;o[k]=t.type==='checkbox'?t.checked:t.type==='range'?parseFloat(t.value):t.value;if(k==='text'||k==='font'||k==='bold'){o._dirty=true;o._at=performance.now()}}
  else if(t.id==='pn'){o.name=t.value||'Objek';renderList()}
  else if(t.id==='col'){o.c=t.value}else if(t.id==='gloss'){o.g=+t.value}
  changed()});
$('props').addEventListener('click',e=>{const id=e.target.id;
  if(id==='b-del')del();else if(id==='b-foc')focusSel();
  else if(id==='b-dup'){const o=S.objs[S.sel];if(!o)return;const c=mk(o.type,JSON.parse(JSON.stringify(o,(k,v)=>k[0]==='_'?undefined:v)));c.name=(o.name+' salin').slice(0,40);c.p[0]+=.6;S.objs.push(c);select(S.objs.length-1);persist()}});
$('campane').addEventListener('input',e=>{const t=e.target;if(t.id==='cfov'){cam.f=t.value*Math.PI/180;camEdit();persist()}else if(t.id==='croll'){cam.r=t.value*Math.PI/180;camEdit();persist()}else if(t.id==='camAnim'){S.camAnim=t.checked;persist()}});
$('campane').addEventListener('click',e=>{const id=e.target.id;
  if(id==='b-ckd'){const n=S.ck.length;S.ck=S.ck.filter(k=>Math.abs(k.t-T)>.05);if(S.ck.length===n)toast('Tidak ada keyframe kamera di waktu ini');else{changed();toast('Keyframe kamera dihapus')}}
  else if(id==='b-cclr'){S.ck=[];changed();toast('Semua keyframe kamera dihapus')}});
$('bg').oninput=e=>{S.bg=e.target.value;persist()};
$('grid').onchange=e=>{S.grid=e.target.checked;persist()};
$('asp').onchange=e=>{S.asp=e.target.value;persist()};
$('res').onchange=e=>{S.res=+e.target.value;persist()};
$('mo').onchange=e=>{S.mo=e.target.value;persist()};
$('tm').oninput=e=>{playing=false;lab();setT(+e.target.value);S.objs.forEach(o=>evalObj(o,T));syncProps()};
$('dur').onchange=e=>{S.dur=clamp(+e.target.value||5,.5,120);e.target.value=S.dur;$('tm').max=S.dur;setT(T);changed()};
$('b-play').onclick=()=>{if(rec)return;playing=!playing;if(playing&&T>=S.dur)setT(0);last=performance.now();lab()};
$('b-kf').onclick=()=>{const o=S.objs[S.sel];if(!o)return;recordKey(o);changed();toast('Keyframe objek di '+T.toFixed(2)+' s')};
$('b-kd').onclick=()=>{const o=S.objs[S.sel];if(!o)return;const n=o.k.length;o.k=o.k.filter(k=>Math.abs(k.t-T)>.05);if(o.k.length===n)toast('Tidak ada keyframe objek di waktu ini');else{changed();toast('Keyframe objek dihapus')}};
$('b-ckf').onclick=()=>{recordCamKey();S.camAnim=true;$('camAnim').checked=true;changed();toast('Keyframe kamera di '+T.toFixed(2)+' s')};
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(e.key==='Delete'||e.key==='Backspace')del();else if(e.key===' '){e.preventDefault();$('b-play').click()}else if(e.key==='f'||e.key==='F')focusSel()});

/* ---------- file, PNG, video ---------- */
const dl=(b,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
const dims=()=>{const[a,b]=S.asp.split(':').map(Number),r=a/b;return r>=1?[Math.round(S.res*r/2)*2,S.res]:[S.res,Math.round(S.res/r/2)*2]};
$('b-save').onclick=()=>dl(new Blob([ser()],{type:'application/json'}),'project-3d.apk3d.json');
$('b-open').onclick=()=>$('f-open').click();
$('f-open').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{load(JSON.parse(await f.text()));persist();toast('Project dibuka')}catch(x){toast('File project 3D tidak valid')}};
$('b-png').onclick=()=>{clean=true;draw();cv.toBlob(b=>b&&dl(b,'editor3d.png'),'image/png');clean=false};
function finishRec(){if(rec&&rec.state==='recording')rec.stop()}
$('b-vid').onclick=()=>{if(rec){finishRec();return}
  if(!window.MediaRecorder||!cv.captureStream){toast('Browser tidak mendukung rekam video');return}
  const mt=['video/mp4;codecs=avc1','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)),ch=[];
  const mr=new MediaRecorder(cv.captureStream(30),mt?{mimeType:mt,videoBitsPerSecond:12e6}:{videoBitsPerSecond:12e6});
  mr.ondataavailable=e=>{if(e.data.size)ch.push(e.data)};
  mr.onstop=()=>{rec=null;clean=false;playing=false;lab();const ty=mr.mimeType||'video/webm';dl(new Blob(ch,{type:ty}),'animasi-3d.'+(ty.includes('mp4')?'mp4':'webm'));toast('Video disimpan. Import ke editor video lewat tombol Import.')};
  rec=mr;clean=true;setT(0);playing=true;last=performance.now();mr.start();lab()};

/* ---------- kamera (pointer) ---------- */
const ptr=new Map();let down=null,pd=0;
const pdist=()=>{const a=[...ptr.values()];return Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])};
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptr.set(e.pointerId,[e.clientX,e.clientY]);if(!down)down={m:0};if(ptr.size===2){pd=pdist();down.m=99}});
cv.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p||!down)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.size===2){const d=pdist();if(pd)cam.d=clamp(cam.d*pd/d,.5,60);pd=d;camEdit();return}
  down.m+=Math.abs(dx)+Math.abs(dy);if(down.m<6)return;
  if(e.buttons&2||e.shiftKey){const c=camV(),k=cam.d*.0016;cam.t=add(cam.t,add(mulk(c.r,-dx*k),mulk(c.u,dy*k)))}
  else{cam.y-=dx*.008;cam.p=clamp(cam.p+dy*.008,-1.4,1.4)}
  camEdit()});
cv.addEventListener('pointerup',e=>{ptr.delete(e.pointerId);
  if(down&&down.m<6&&e.button===0&&!e.shiftKey){const[r,d]=ray(e.clientX,e.clientY);let b=-1,bt=1e9;S.objs.forEach((o,i)=>{const t=hit(o,r,d);if(t>=0&&t<bt){bt=t;b=i}});select(b)}
  if(!ptr.size){down=null;persist()}pd=0});
cv.addEventListener('pointercancel',e=>{ptr.delete(e.pointerId);if(!ptr.size)down=null});
cv.addEventListener('wheel',e=>{e.preventDefault();cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),.5,60);camEdit();persist()},{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- render ---------- */
function fit(){const v=cv.parentElement,cw=v.clientWidth,ch=v.clientHeight,[a,b]=S.asp.split(':').map(Number),r=a/b;let w=cw,h=cw/r;if(h>ch){h=ch;w=ch*r}w=Math.max(1,Math.floor(w));h=Math.max(1,Math.floor(h));const k=w+'x'+h;if(k!==fitKey){fitKey=k;cv.style.width=w+'px';cv.style.height=h+'px'}}
function draw(){fit();const dpr=Math.min(devicePixelRatio||1,2),[w,h]=clean?dims():[Math.max(1,cv.clientWidth*dpr|0),Math.max(1,cv.clientHeight*dpr|0)];
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  gl.viewport(0,0,w,h);const bg=hex(S.bg);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const c=camV(),VP=mul(persp(cam.f,w/h,.1,200),view(c));
  gl.useProgram(P);gl.uniformMatrix4fv(U.uVP,false,VP);gl.uniform3fv(U.uEye,c.e);
  if(!clean&&S.grid){gl.uniform1i(U.uUnlit,1);gl.bindVertexArray(gvao);gl.uniformMatrix4fv(U.uM,false,IDENT);
    gl.uniform3f(U.uC,.22,.25,.31);gl.drawArrays(gl.LINES,0,80);gl.uniform3f(U.uC,.9,.3,.3);gl.drawArrays(gl.LINES,80,2);gl.uniform3f(U.uC,.3,.5,.95);gl.drawArrays(gl.LINES,82,2)}
  gl.uniform1i(U.uUnlit,0);
  S.objs.forEach((o,i)=>{if(o.type==='text')return;const m=meshes[o.type];gl.bindVertexArray(m.vao);gl.uniformMatrix4fv(U.uM,false,model(o));gl.uniform3fv(U.uC,hex(o.c));gl.uniform1f(U.uGloss,o.g);gl.uniform1f(U.uSel,i===S.sel&&!clean?1:0);gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0)});
  if(S.objs.some(o=>o.type==='text')){gl.useProgram(PT);gl.uniformMatrix4fv(UT.uVP,false,VP);gl.uniform3fv(UT.uEye,c.e);gl.uniform1i(UT.uTex,0);gl.uniform1i(UT.uN,NL);gl.bindVertexArray(null);gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    S.objs.forEach((o,i)=>{if(o.type!=='text')return;ensureTex(o);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,o._gt);
      gl.uniformMatrix4fv(UT.uM,false,model(o));gl.uniform2f(UT.uSz,o._w,o._h);gl.uniform2f(UT.uTs,o._tw,o._th);gl.uniform1f(UT.uDepth,o.depth);gl.uniform3fv(UT.uC,hex(o.c));gl.uniform3fv(UT.uC2,hex(o.c2));
      gl.uniform1f(UT.uGloss,o.g);gl.uniform1f(UT.uSel,i===S.sel&&!clean?1:0);gl.uniform1f(UT.uBev,o.bev);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,NL)});
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE)}}
function frame(now){
  if(playing){T+=(now-last)/1000;if(T>=S.dur){if(rec){T=S.dur;playing=false;finishRec()}else T=0}setT(T)}
  last=now;S.objs.forEach(o=>evalObj(o,T));
  if(S.ck.length&&(rec||(S.camAnim&&!down)))evalCam(T);
  const o=S.objs[S.sel];if(playing&&o&&o.k.length)syncProps();
  if(!$('campane').hidden)syncCam();
  draw();requestAnimationFrame(frame)}

/* ---------- mulai ---------- */
try{const j=JSON.parse(localStorage.getItem('apk3d'));if(j)load(j);else throw 0}catch(e){S.objs=[mk('text')];select(0)}
setT(0);lab();requestAnimationFrame(frame);
})();
