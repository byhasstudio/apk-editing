(()=>{'use strict';
const $=i=>document.getElementById(i),TAU=Math.PI*2,FOV=.9,IDENT=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const clamp=(v,a,b)=>Math.min(Math.max(v,a),b);
const cv=$('gl'),gl=cv.getContext('webgl2',{antialias:true,preserveDrawingBuffer:true});
if(!gl){$('err').hidden=false;return}
const toast=m=>{const t=$('t3');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200)};

/* ---------- shader ---------- */
const VS='#version 300 es\nlayout(location=0) in vec3 aP;layout(location=1) in vec3 aN;uniform mat4 uVP,uM;out vec3 vN,vW;void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(transpose(inverse(uM)))*aN;gl_Position=uVP*w;}';
const FS='#version 300 es\nprecision mediump float;in vec3 vN,vW;uniform vec3 uC,uEye;uniform float uGloss,uSel;uniform bool uUnlit;out vec4 o;void main(){if(uUnlit){o=vec4(uC,1.);return;}vec3 V=normalize(uEye-vW),n=normalize(vN);if(dot(n,V)<0.)n=-n;vec3 L=normalize(vec3(.5,.9,.6)),L2=normalize(vec3(-.6,.2,-.5)),H=normalize(L+V);float d=max(dot(n,L),0.)*.8+max(dot(n,L2),0.)*.25;float s=pow(max(dot(n,H),0.),8.+uGloss*120.)*uGloss*.6;vec3 c=uC*(.28+d)+vec3(s);c=mix(c,vec3(1.,.75,.3),uSel*.22);o=vec4(c,1.);}';
const U={};let P;
try{
  const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  P=gl.createProgram();gl.attachShader(P,sh(gl.VERTEX_SHADER,VS));gl.attachShader(P,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(P);
  if(!gl.getProgramParameter(P,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(P));
}catch(e){$('err').hidden=false;$('err').textContent='Gagal memulai WebGL: '+e.message;return}
['uVP','uM','uC','uEye','uGloss','uSel','uUnlit'].forEach(n=>U[n]=gl.getUniformLocation(P,n));
gl.enable(gl.DEPTH_TEST);

/* ---------- mesh ---------- */
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
const NAMES={cube:'Kubus',sphere:'Bola',cylinder:'Silinder',cone:'Kerucut',torus:'Donat',plane:'Bidang'};
const EXT={cube:[.5,.5,.5],sphere:[.5,.5,.5],cylinder:[.5,.5,.5],cone:[.5,.5,.5],torus:[.5,.15,.5],plane:[.5,.03,.5]};
const meshes={};
function buf(t,d,loc,sz,Arr){const b=gl.createBuffer();gl.bindBuffer(t,b);gl.bufferData(t,new Arr(d),gl.STATIC_DRAW);if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,sz,gl.FLOAT,false,0,0)}}
for(const k in gen){const M={p:[],n:[],i:[]};gen[k](M);const vao=gl.createVertexArray();gl.bindVertexArray(vao);buf(gl.ARRAY_BUFFER,M.p,0,3,Float32Array);buf(gl.ARRAY_BUFFER,M.n,1,3,Float32Array);buf(gl.ELEMENT_ARRAY_BUFFER,M.i,-1,0,Uint16Array);meshes[k]={vao,n:M.i.length}}
const gv=[];for(let i=-10;i<=10;i++)if(i)gv.push(-10,0,i,10,0,i,i,0,-10,i,0,10);gv.push(-10,0,0,10,0,0,0,0,-10,0,0,10);
const gvao=gl.createVertexArray();gl.bindVertexArray(gvao);buf(gl.ARRAY_BUFFER,gv,0,3,Float32Array);

/* ---------- matematika ---------- */
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mulk=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],nrm=a=>mulk(a,1/Math.hypot(...a));
const persp=(f,a,n,fa)=>{const t=1/Math.tan(f/2),r=1/(n-fa);return[t/a,0,0,0,0,t,0,0,0,0,(n+fa)*r,-1,0,0,2*n*fa*r,0]};
const mul=(a,b)=>{const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s}return o};
const cam={y:.7,p:.45,d:8,t:[0,.5,0]};
function camV(){const e=add(cam.t,mulk([Math.cos(cam.p)*Math.sin(cam.y),Math.sin(cam.p),Math.cos(cam.p)*Math.cos(cam.y)],cam.d)),f=nrm(sub(cam.t,e)),r=nrm(cross(f,[0,1,0])),u=cross(r,f);return{e,f,r,u}}
const view=c=>[c.r[0],c.u[0],-c.f[0],0,c.r[1],c.u[1],-c.f[1],0,c.r[2],c.u[2],-c.f[2],0,-dot(c.r,c.e),-dot(c.u,c.e),dot(c.f,c.e),1];
function rot(r){const[x,y,z]=r.map(d=>d*Math.PI/180),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  return[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,-sy,cy*sx,cy*cx]}
function model(o){const R=rot(o.r),s=o.s,p=o.p;return[R[0]*s[0],R[3]*s[0],R[6]*s[0],0,R[1]*s[1],R[4]*s[1],R[7]*s[1],0,R[2]*s[2],R[5]*s[2],R[8]*s[2],0,p[0],p[1],p[2],1]}
function toLocal(o,v,pt){const R=rot(o.r);if(pt)v=sub(v,o.p);return[0,1,2].map(i=>(R[i]*v[0]+R[3+i]*v[1]+R[6+i]*v[2])/o.s[i])}
function hit(o,ro,rd){const a=toLocal(o,ro,1),d=toLocal(o,rd,0),e=EXT[o.type];let t0=0,t1=1e9;
  for(let i=0;i<3;i++){if(Math.abs(d[i])<1e-9){if(Math.abs(a[i])>e[i])return-1;continue}let u=(-e[i]-a[i])/d[i],v=(e[i]-a[i])/d[i];if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return-1}return t0}
function ray(px,py){const r=cv.getBoundingClientRect(),x=(px-r.left)/r.width*2-1,y=1-(py-r.top)/r.height*2,k=Math.tan(FOV/2),c=camV();
  return[c.e,nrm(add(add(c.f,mulk(c.r,x*k*r.width/r.height)),mulk(c.u,y*k)))]}
const hex=c=>[1,3,5].map(i=>parseInt(c.substr(i,2),16)/255),HEX=/^#[0-9a-f]{6}$/i;

/* ---------- state ---------- */
const S={objs:[],sel:-1,dur:5,bg:'#121419'},COLORS=['#7f8cff','#ff7f9c','#7fe0a0','#ffd27f','#7fd4ff','#d28fff'];
let T=0,playing=false,last=0,clean=false,rec=null;
const v3=(a,d)=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)?a.slice():d;
function mk(type,s={},n=S.objs.length){return{name:String(s.name||NAMES[type]+' '+(n+1)).slice(0,40),type,
  p:v3(s.p,[((n+2)%5-2)*1.3,type==='plane'?0:.5,-Math.floor((n+2)/5)*1.3]),r:v3(s.r,[0,0,0]),s:v3(s.s,[1,1,1]).map(v=>Math.max(.01,v)),
  c:HEX.test(s.c)?s.c:COLORS[n%6],g:Number.isFinite(s.g)?clamp(s.g,0,1):.3,
  k:(Array.isArray(s.k)?s.k:[]).filter(k=>k&&Number.isFinite(k.t)).map(k=>({t:k.t,p:v3(k.p,[0,0,0]),r:v3(k.r,[0,0,0]),s:v3(k.s,[1,1,1])})).sort((a,b)=>a.t-b.t)}}
function evalObj(o,t){const k=o.k;if(!k.length)return;let a=k[0],b=k[k.length-1];
  if(t<=a.t)b=a;else if(t>=b.t)a=b;else for(let i=0;i<k.length-1;i++)if(t>=k[i].t&&t<=k[i+1].t){a=k[i];b=k[i+1];break}
  const f=a===b?0:(t-a.t)/(b.t-a.t),e=f*f*(3-2*f);['p','r','s'].forEach(q=>o[q]=a[q].map((v,i)=>v+(b[q][i]-v)*e))}
function recordKey(o){const n={t:T,p:o.p.slice(),r:o.r.slice(),s:o.s.slice()},i=o.k.findIndex(k=>Math.abs(k.t-T)<.02);if(i>=0)o.k[i]=n;else{o.k.push(n);o.k.sort((a,b)=>a.t-b.t)}}
const persist=()=>{try{localStorage.setItem('apk3d',JSON.stringify({S,cam}))}catch(e){}};
const changed=()=>{updateTicks();persist()};
function load(j){const s=j&&j.S;if(!s||!Array.isArray(s.objs))throw new Error('format');
  S.objs=s.objs.filter(o=>o&&meshes[o.type]).map((o,i)=>mk(o.type,o,i));S.dur=clamp(+s.dur||5,.5,120);S.bg=HEX.test(s.bg)?s.bg:'#121419';
  if(j.cam&&Array.isArray(j.cam.t)&&[j.cam.y,j.cam.p,j.cam.d].every(Number.isFinite))Object.assign(cam,{y:j.cam.y,p:j.cam.p,d:j.cam.d,t:v3(j.cam.t,[0,.5,0])});
  $('bg').value=S.bg;$('dur').value=S.dur;$('tm').max=S.dur;playing=false;lab();setT(0);select(S.objs.length?0:-1)}

/* ---------- UI ---------- */
const set=(e,v)=>{if(document.activeElement!==e)e.value=v};
$('props').innerHTML='<p id="pe" class="meta">Ketuk objek di kanvas atau di daftar untuk mengedit.</p><div id="pf" hidden><label>Nama<input id="pn" maxlength="40"></label>'+
  [['Posisi','p',.1],['Rotasi °','r',5],['Skala','s',.1]].map(([l,q,st])=>'<div class="prow"><span class="meta">'+l+'</span>'+[0,1,2].map(i=>'<input type="number" step="'+st+'" data-q="'+q+'" data-i="'+i+'" aria-label="'+l+' '+'XYZ'[i]+'">').join('')+'</div>').join('')+
  '<label>Warna<input type="color" id="col"></label><label>Kilap<input type="range" id="gloss" min="0" max="1" step=".05"></label><div class="prow2"><button class="btn" id="b-dup">Duplikat</button><button class="btn" id="b-foc">Fokus</button><button class="btn danger" id="b-del">Hapus</button></div></div>';
Object.keys(NAMES).forEach(k=>{const b=document.createElement('button');b.className='btn';b.textContent='+ '+NAMES[k];b.onclick=()=>{S.objs.push(mk(k));select(S.objs.length-1);persist()};$('shapes').append(b)});
function renderList(){const l=$('list');l.innerHTML='';S.objs.forEach((o,i)=>{const b=document.createElement('button');b.className='btn li'+(i===S.sel?' on':'');b.textContent=o.name;b.onclick=()=>select(i);l.append(b)});
  if(!S.objs.length)l.innerHTML='<p class="meta">Belum ada objek.</p>'}
function syncProps(){const o=S.objs[S.sel];$('pf').hidden=!o;$('pe').hidden=!!o;if(!o)return;
  set($('pn'),o.name);document.querySelectorAll('[data-q]').forEach(e=>set(e,+(+o[e.dataset.q][e.dataset.i]).toFixed(3)));set($('col'),o.c);set($('gloss'),o.g)}
function updateTicks(){const o=S.objs[S.sel];$('ticks').innerHTML=o?o.k.map(k=>'<i style="left:'+(k.t/S.dur*100)+'%"></i>').join(''):'';$('b-kf').disabled=$('b-kd').disabled=!o}
function select(i){S.sel=i;renderList();syncProps();updateTicks()}
function setT(t){T=clamp(t,0,S.dur);$('tm').value=T;$('tt').textContent=T.toFixed(2)+' / '+S.dur.toFixed(2)+' s'}
function lab(){$('b-play').textContent=playing?'❚❚':'▶';$('b-vid').textContent=rec?'■ Selesai':'Rekam Video'}
function del(){const o=S.objs[S.sel];if(!o)return;S.objs.splice(S.sel,1);select(Math.min(S.sel,S.objs.length-1));persist()}
function focusSel(){const o=S.objs[S.sel];if(o)cam.t=o.p.slice()}

$('props').addEventListener('input',e=>{const o=S.objs[S.sel],t=e.target;if(!o)return;
  if(t.dataset.q){const v=parseFloat(t.value);if(isNaN(v))return;o[t.dataset.q][+t.dataset.i]=t.dataset.q==='s'?Math.max(.01,v):v;if(o.k.length)recordKey(o)}
  else if(t.id==='pn'){o.name=t.value||'Objek';renderList()}
  else if(t.id==='col'){o.c=t.value}else if(t.id==='gloss'){o.g=+t.value}
  changed()});
$('props').addEventListener('click',e=>{const id=e.target.id;
  if(id==='b-del')del();else if(id==='b-foc')focusSel();
  else if(id==='b-dup'){const o=S.objs[S.sel];if(!o)return;const c=mk(o.type,JSON.parse(JSON.stringify(o)));c.name=(o.name+' salin').slice(0,40);c.p[0]+=.6;S.objs.push(c);select(S.objs.length-1);persist()}});
$('bg').oninput=e=>{S.bg=e.target.value;persist()};
$('tm').oninput=e=>{playing=false;lab();setT(+e.target.value);S.objs.forEach(o=>evalObj(o,T));syncProps()};
$('dur').onchange=e=>{S.dur=clamp(+e.target.value||5,.5,120);e.target.value=S.dur;$('tm').max=S.dur;setT(T);changed()};
$('b-play').onclick=()=>{if(rec)return;playing=!playing;if(playing&&T>=S.dur)setT(0);last=performance.now();lab()};
$('b-kf').onclick=()=>{const o=S.objs[S.sel];if(!o)return;recordKey(o);changed();toast('Keyframe ditambah di '+T.toFixed(2)+' s')};
$('b-kd').onclick=()=>{const o=S.objs[S.sel];if(!o)return;const n=o.k.length;o.k=o.k.filter(k=>Math.abs(k.t-T)>.05);if(o.k.length===n)toast('Tidak ada keyframe di waktu ini');else{changed();toast('Keyframe dihapus')}};
addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(e.key==='Delete'||e.key==='Backspace')del();else if(e.key===' '){e.preventDefault();$('b-play').click()}else if(e.key==='f'||e.key==='F')focusSel()});

/* ---------- file, PNG, video ---------- */
const dl=(b,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
$('b-save').onclick=()=>dl(new Blob([JSON.stringify({S,cam})],{type:'application/json'}),'project-3d.apk3d.json');
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
cv.addEventListener('pointermove',e=>{const p=ptr.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];ptr.set(e.pointerId,[e.clientX,e.clientY]);
  if(ptr.size===2){const d=pdist();if(pd)cam.d=clamp(cam.d*pd/d,1,60);pd=d;return}
  down.m+=Math.abs(dx)+Math.abs(dy);
  if(e.buttons&2||e.shiftKey){const c=camV(),k=cam.d*.0016;cam.t=add(cam.t,add(mulk(c.r,-dx*k),mulk(c.u,dy*k)))}
  else{cam.y-=dx*.008;cam.p=clamp(cam.p+dy*.008,-1.4,1.4)}});
cv.addEventListener('pointerup',e=>{ptr.delete(e.pointerId);
  if(down&&down.m<6&&e.button===0&&!e.shiftKey){const[r,d]=ray(e.clientX,e.clientY);let b=-1,bt=1e9;S.objs.forEach((o,i)=>{const t=hit(o,r,d);if(t>=0&&t<bt){bt=t;b=i}});select(b)}
  if(!ptr.size){down=null;persist()}pd=0});
cv.addEventListener('pointercancel',e=>{ptr.delete(e.pointerId);if(!ptr.size)down=null});
cv.addEventListener('wheel',e=>{e.preventDefault();cam.d=clamp(cam.d*Math.exp(e.deltaY*.001),1,60)},{passive:false});
cv.addEventListener('contextmenu',e=>e.preventDefault());

/* ---------- render ---------- */
function draw(){const dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,cv.clientWidth*dpr|0),h=Math.max(1,cv.clientHeight*dpr|0);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
  gl.viewport(0,0,w,h);const bg=hex(S.bg);gl.clearColor(bg[0],bg[1],bg[2],1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(P);const c=camV();gl.uniformMatrix4fv(U.uVP,false,mul(persp(FOV,w/h,.1,200),view(c)));gl.uniform3fv(U.uEye,c.e);
  if(!clean){gl.uniform1i(U.uUnlit,1);gl.bindVertexArray(gvao);gl.uniformMatrix4fv(U.uM,false,IDENT);
    gl.uniform3f(U.uC,.22,.25,.31);gl.drawArrays(gl.LINES,0,80);gl.uniform3f(U.uC,.9,.3,.3);gl.drawArrays(gl.LINES,80,2);gl.uniform3f(U.uC,.3,.5,.95);gl.drawArrays(gl.LINES,82,2)}
  gl.uniform1i(U.uUnlit,0);
  S.objs.forEach((o,i)=>{const m=meshes[o.type];gl.bindVertexArray(m.vao);gl.uniformMatrix4fv(U.uM,false,model(o));gl.uniform3fv(U.uC,hex(o.c));gl.uniform1f(U.uGloss,o.g);gl.uniform1f(U.uSel,i===S.sel&&!clean?1:0);gl.drawElements(gl.TRIANGLES,m.n,gl.UNSIGNED_SHORT,0)})}
function frame(now){
  if(playing){T+=(now-last)/1000;if(T>=S.dur){if(rec){T=S.dur;playing=false;finishRec()}else T=0}setT(T)}
  last=now;S.objs.forEach(o=>evalObj(o,T));
  const o=S.objs[S.sel];if(playing&&o&&o.k.length)syncProps();
  draw();requestAnimationFrame(frame)}

/* ---------- mulai ---------- */
try{const j=JSON.parse(localStorage.getItem('apk3d'));if(j)load(j);else throw 0}catch(e){S.objs=[mk('cube')];$('bg').value=S.bg;select(0)}
setT(0);lab();requestAnimationFrame(frame);
})();
