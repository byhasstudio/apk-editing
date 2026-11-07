/* 3D: rotasi X dan Y dengan perspektif untuk klip teks dan bentuk (properti keyframe rx, ry dalam derajat).
   Cara kerja: klip digambar datar ke kanvas sementara (pada skala hingga 2x supaya tetap tajam), lalu dipetakan ulang
   lewat jaring segitiga kecil dengan proyeksi perspektif. Hanya area klip yang diproses, supaya tetap ringan.
   Urutan transformasi: skala -> putar Y -> putar X -> rotasi (Z) -> perspektif -> geser (x, y). */
window.APK=window.APK||{};
APK.p3d=(function(){
  const K=APK.kf;
  ['rx','ry'].forEach(p=>{
    if(!K.PROPS.includes(p))K.PROPS.push(p);
    if(!K.VISUAL.includes(p))K.VISUAL.push(p);
    K.DEF[p]=0;
  });
  let A=null,B=null;
  function cv(c,w,h){
    if(!c)c=document.createElement('canvas');
    if(c.width!==w||c.height!==h){c.width=w;c.height=h}
    else{const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h)}
    return c;
  }
  function tri(g,img,s0,s1,s2,d0,d1,d2){
    const det=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);
    if(Math.abs(det)<1e-6)return;
    const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/det,
          c=((d2[0]-d0[0])*(s1[0]-s0[0])-(d1[0]-d0[0])*(s2[0]-s0[0]))/det,
          b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/det,
          d=((d2[1]-d0[1])*(s1[0]-s0[0])-(d1[1]-d0[1])*(s2[0]-s0[0]))/det,
          e=d0[0]-a*s0[0]-c*s0[1],f=d0[1]-b*s0[0]-d*s0[1];
    const cx=(d0[0]+d1[0]+d2[0])/3,cy=(d0[1]+d1[1]+d2[1])/3,P=[d0,d1,d2];
    g.save();g.setTransform(1,0,0,1,0,0);g.beginPath();
    P.forEach((v,i)=>{
      const dx=v[0]-cx,dy=v[1]-cy,l=Math.hypot(dx,dy)||1,x=v[0]+dx/l*0.8,y=v[1]+dy/l*0.8;
      i?g.lineTo(x,y):g.moveTo(x,y);
    });
    g.closePath();g.clip();
    g.setTransform(a,b,c,d,e,f);
    const x0=Math.floor(Math.min(s0[0],s1[0],s2[0])),y0=Math.floor(Math.min(s0[1],s1[1],s2[1])),
          x1=Math.ceil(Math.max(s0[0],s1[0],s2[0])),y1=Math.ceil(Math.max(s0[1],s1[1],s2[1]));
    if(x1>x0&&y1>y0)g.drawImage(img,x0,y0,x1-x0,y1-y0,x0,y0,x1-x0,y1-y0);
    g.restore();
  }
  function draw3d(orig,ctx,c,pr,W,H){
    const m=ctx.getTransform(),K0=Math.hypot(m.a,m.b)||1,cw=ctx.canvas.width,ch=ctx.canvas.height;
    const s=Math.max(0,pr.scale);
    if(s<=0||pr.opacity<=0)return{w:300,h:200};
    A=cv(A,cw,ch);B=cv(B,cw,ch);
    /* gambar datar pada skala sd (maks 2x) supaya tajam; sisanya (ratio) dikerjakan proyeksi */
    const sd=Math.min(Math.max(s,0.3),2),ratio=s/sd;
    const g=A.getContext('2d');g.setTransform(K0,0,0,K0,0,0);
    const p2=Object.assign({},pr,{x:0,y:0,rotation:0,scale:sd,opacity:1,rx:0,ry:0});
    const b=orig(g,Object.assign({},c,{blend:'source-over'}),p2,W,H)||{w:300,h:200};
    const sxm=Math.abs(pr.sx==null?1:pr.sx),sym=Math.abs(pr.sy==null?1:pr.sy);
    const hw=Math.min(W/2,(b.w*sxm*sd)*0.62+50),hh=Math.min(H/2,(b.h*sym*sd)*0.7+50);
    const u0=-hw,u1=hw,v0=-hh,v1=hh;
    const rx=(pr.rx||0)*Math.PI/180,ry=(pr.ry||0)*Math.PI/180,rz=(pr.rotation||0)*Math.PI/180;
    const cX=Math.cos(rx),sX=Math.sin(rx),cY=Math.cos(ry),sY=Math.sin(ry),cZ=Math.cos(rz),sZ=Math.sin(rz),D=Math.max(W,H)*1.1;
    const S=(u,v)=>[(W/2+u)*K0,(H/2+v)*K0];
    const P=(u,v)=>{
      let x=u*ratio,y=v*ratio,z=0;
      const x1=x*cY+z*sY,z1=-x*sY+z*cY;x=x1;z=z1;
      const y1=y*cX-z*sX,z2=y*sX+z*cX;y=y1;z=z2;
      const x2=x*cZ-y*sZ,y2=x*sZ+y*cZ;x=x2;y=y2;
      const f=D/Math.max(D*0.08,D-z);
      return[(W/2+pr.x+x*f)*K0+m.e,(H/2+pr.y+y*f)*K0+m.f];
    };
    /* jaring kecil: cukup rapat untuk perspektif teks, tapi tetap ringan */
    const cols=Math.max(6,Math.min(14,Math.ceil((u1-u0)/50))),rows=Math.max(3,Math.min(8,Math.ceil((v1-v0)/50)));
    const gb=B.getContext('2d');gb.imageSmoothingEnabled=true;gb.imageSmoothingQuality='high';
    const D0=[],DS=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const u=u0+(u1-u0)*i/cols,v=v0+(v1-v0)*j/rows;
      D0.push(P(u,v));DS.push(S(u,v));
    }
    let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
    for(const p of D0){if(p[0]<bx0)bx0=p[0];if(p[0]>bx1)bx1=p[0];if(p[1]<by0)by0=p[1];if(p[1]>by1)by1=p[1]}
    const id=(i,j)=>j*(cols+1)+i;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const a=id(i,j),b2=id(i+1,j),c2=id(i,j+1),d2=id(i+1,j+1);
      tri(gb,A,DS[a],DS[b2],DS[c2],D0[a],D0[b2],D0[c2]);
      tri(gb,A,DS[b2],DS[d2],DS[c2],D0[b2],D0[d2],D0[c2]);
    }
    const rx0=Math.max(0,Math.floor(bx0)-2),ry0=Math.max(0,Math.floor(by0)-2),
          rw=Math.min(cw,Math.ceil(bx1)+2)-rx0,rh=Math.min(ch,Math.ceil(by1)+2)-ry0;
    if(rw>0&&rh>0){
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=Math.min(1,Math.max(0,pr.opacity));
      ctx.globalCompositeOperation=c.blend||'source-over';
      ctx.drawImage(B,rx0,ry0,rw,rh,rx0,ry0,rw,rh);
      ctx.restore();
    }
    return b;
  }
  function wrap(obj){
    const o=obj.draw;
    obj.draw=function(ctx,c,pr,W,H){
      if(pr&&(Math.abs(pr.rx||0)>0.01||Math.abs(pr.ry||0)>0.01))return draw3d(o,ctx,c,pr,W,H);
      return o.apply(this,arguments);
    };
  }
  if(APK.text)wrap(APK.text);
  if(APK.shapes)wrap(APK.shapes);

  /* ===== slider rotasi 3D di panel Properti (teks dan bentuk) ===== */
  const panel=document.getElementById('panel-props');
  const rel=s=>Math.min(Math.max(APK.preview.time-s.c.start,0),s.c.dur);
  const row=(k,l)=>`<div class="pr-f" data-q3row="${k}"><div class="pr-lab"><span>${l}</span><span class="kf-ctl"><button type="button" data-kfgo="-1" data-kp="${k}" title="Loncat ke keyframe sebelumnya">◀</button><button type="button" class="kf-d" data-kf="${k}" title="Tambah / hapus keyframe di posisi playhead">◇</button><button type="button" data-kfgo="1" data-kp="${k}" title="Loncat ke keyframe berikutnya">▶</button></span></div><div class="pr-row"><input type="range" data-q3="${k}" min="-180" max="180" step="1"><input type="number" data-q3="${k}" min="-180" max="180" step="1"></div></div>`;
  function inject(){
    if(!panel||panel.querySelector('[data-q3row]'))return;
    const sky=panel.querySelector('input[data-p="sky"]');if(!sky)return;
    const s=APK.timeline&&APK.timeline.selectedClip();
    if(!s||!(s.c.text||s.c.shape))return;
    sky.closest('.pr-f').insertAdjacentHTML('afterend',row('rx','Putar 3D sumbu X (°)')+row('ry','Putar 3D sumbu Y (°)'));
  }
  if(panel)new MutationObserver(inject).observe(panel,{childList:true,subtree:true});
  function sync(){
    requestAnimationFrame(sync);
    if(!panel||!panel.querySelector('[data-q3row]'))return;
    const s=APK.timeline.selectedClip();if(!s)return;
    const pr=K.props(s.c,rel(s));
    panel.querySelectorAll('[data-q3]').forEach(el=>{
      if(document.activeElement===el)return;
      el.value=Math.round((pr[el.dataset.q3]||0)*100)/100;
    });
  }
  requestAnimationFrame(sync);
  if(panel)panel.addEventListener('input',e=>{
    const el=e.target,k=el.dataset&&el.dataset.q3;if(!k)return;
    const s=APK.timeline.selectedClip();if(!s||s.tr.locked)return;
    let v=parseFloat(el.value);if(!isFinite(v))return;
    v=Math.max(-180,Math.min(180,v));
    s.c.props=Object.assign({},s.c.props);
    const AK=APK.autokey,r=rel(s);
    if(AK&&AK.recording){if(AK.key(s.c,k,r,v))APK.timeline.render()}
    else if(K.animated(s.c,k)){if(K.setKey(s.c,k,r,v))APK.timeline.render()}
    else s.c.props[k]=v;
    panel.querySelectorAll(`[data-q3="${k}"]`).forEach(o=>{if(o!==el)o.value=v});
    APK.timeline.touch();
  });
  return{draw3d};
})();
