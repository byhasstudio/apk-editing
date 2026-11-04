/* Layer vektor dan Pen Tool (sistem vektor, bagian 1 dari 3).
   Data per clip: clip.vec = { rule:'nonzero'|'evenodd',
     paths:[{closed, pts:[{x,y,i:[dx,dy],o:[dx,dy],t:'c'|'s'}]}],   (titik dalam px project, relatif ke pusat layer; i/o = offset handle masuk/keluar; c = sudut, s = halus)
     st:[{k:'f'|'s', on, type:'solid'|'lin'|'rad', color, color2, angle, op, w, cap, join, dash, gap}],   (daftar isi dan garis, digambar berurutan)
     sh:{on,color,blur,x,y} }
   clip.shape = {type:'path'} hanya penanda agar timeline, preview, gizmo, dan panel properti lama memperlakukannya sebagai layer bentuk.
   Project lama tidak punya field ini dan tidak terpengaruh. */
window.APK=window.APK||{};
APK.vector=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current,T=()=>APK.timeline;
  const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches,HR=coarse?13:7;
  const KAPPA=0.5523,Z=[0,0];
  const clone=o=>JSON.parse(JSON.stringify(o));
  const rd=v=>Math.round(v*10)/10+0;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const len=a=>Math.hypot(a[0],a[1]);
  const hd=(q,w)=>q[w]||Z;
  const DEFST={
    f:{k:'f',on:true,type:'solid',color:'#ff6b6b',color2:'#4dabf7',angle:90,op:100},
    s:{k:'s',on:true,type:'solid',color:'#ffffff',color2:'#4dabf7',angle:90,op:100,w:6,cap:'round',join:'round',dash:0,gap:0}
  };
  const DEFSH={on:false,color:'#000000',blur:16,x:6,y:6};
  const mkItem=k=>clone(DEFST[k]);
  const mkPt=(x,y)=>({x,y,i:[0,0],o:[0,0],t:'c'});
  const mkVec=()=>({rule:'nonzero',paths:[{closed:false,pts:[]}],st:[mkItem('f'),mkItem('s')],sh:clone(DEFSH)});
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}
  function find(id){const p=P();if(!p)return null;for(const tr of p.tracks){const c=tr.clips.find(x=>x.id===id);if(c)return{tr,c}}return null}

  /* ===== geometri ===== */
  function seg(p,u,v){const o=hd(u,'o'),i=hd(v,'i');p.bezierCurveTo(u.x+o[0],u.y+o[1],v.x+i[0],v.y+i[1],v.x,v.y)}
  function build(v){
    const p=new Path2D();
    for(const pa of v.paths||[]){
      const a=pa.pts||[],n=a.length;if(!n)continue;
      p.moveTo(a[0].x,a[0].y);
      for(let k=1;k<n;k++)seg(p,a[k-1],a[k]);
      if(pa.closed&&n>1){seg(p,a[n-1],a[0]);p.closePath()}
    }
    return p;
  }
  /* kotak simetris di sekitar pusat layer yang memuat semua titik dan handle (dipakai gizmo dan gradien) */
  function extent(v){
    let mx=0,my=0;
    for(const pa of v.paths||[])for(const q of pa.pts||[]){
      const o=hd(q,'o'),i=hd(q,'i');
      mx=Math.max(mx,Math.abs(q.x),Math.abs(q.x+o[0]),Math.abs(q.x+i[0]));
      my=Math.max(my,Math.abs(q.y),Math.abs(q.y+o[1]),Math.abs(q.y+i[1]));
    }
    return{w:Math.max(24,mx*2),h:Math.max(24,my*2)};
  }
  function bz(a,b,u){
    const o=hd(a,'o'),i=hd(b,'i'),m=1-u,c0=m*m*m,c1=3*m*m*u,c2=3*m*u*u,c3=u*u*u;
    return[c0*a.x+c1*(a.x+o[0])+c2*(b.x+i[0])+c3*b.x,c0*a.y+c1*(a.y+o[1])+c2*(b.y+i[1])+c3*b.y];
  }
  /* pecah segmen a->b di parameter u (de Casteljau): bentuk kurva tetap sama. Mengembalikan titik baru (halus). */
  function splitSeg(a,b,u){
    const lp=(p,q)=>[p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u],o=hd(a,'o'),i=hd(b,'i');
    const P0=[a.x,a.y],P1=[a.x+o[0],a.y+o[1]],P2=[b.x+i[0],b.y+i[1]],P3=[b.x,b.y];
    const q0=lp(P0,P1),q1=lp(P1,P2),q2=lp(P2,P3),r0=lp(q0,q1),r1=lp(q1,q2),s=lp(r0,r1);
    a.o=[rd(q0[0]-P0[0]),rd(q0[1]-P0[1])];b.i=[rd(q2[0]-P3[0]),rd(q2[1]-P3[1])];
    return{x:rd(s[0]),y:rd(s[1]),i:[rd(r0[0]-s[0]),rd(r0[1]-s[1])],o:[rd(r1[0]-s[0]),rd(r1[1]-s[1])],t:'s'};
  }
  /* ubah tipe titik. Halus: handle dibuat segaris (kalau belum ada, dibuat otomatis dari titik tetangga). */
  function setType(pa,idx,t){
    const q=pa.pts[idx];if(!q)return;
    if(t==='s'){
      const n=pa.pts.length,hasP=pa.closed||idx>0,hasN=pa.closed||idx<n-1;
      const prev=pa.pts[(idx-1+n)%n],next=pa.pts[(idx+1)%n],lo=len(hd(q,'o')),li=len(hd(q,'i'));
      if(lo<0.5&&li<0.5){
        const ax=hasP?prev.x:q.x,ay=hasP?prev.y:q.y,bx=hasN?next.x:q.x,by=hasN?next.y:q.y;
        const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1;
        const dp=hasP?Math.hypot(q.x-prev.x,q.y-prev.y):0,dn=hasN?Math.hypot(next.x-q.x,next.y-q.y):0;
        q.i=[rd(-dx/L*dp/3),rd(-dy/L*dp/3)];q.o=[rd(dx/L*dn/3),rd(dy/L*dn/3)];
      }else if(lo>=0.5&&li<0.5)q.i=[-q.o[0],-q.o[1]];
      else if(li>=0.5&&lo<0.5)q.o=[-q.i[0],-q.i[1]];
      else q.i=[rd(-q.o[0]/lo*li),rd(-q.o[1]/lo*li)];
    }
    q.t=t;
  }
  /* geser satu handle; titik halus menjaga handle lawannya tetap segaris (sym = panjang sama) */
  function moveHandle(q,w,lx,ly,sym){
    const d=[rd(lx-q.x),rd(ly-q.y)],L=len(d),ow=w==='o'?'i':'o';
    q[w]=d;
    if(sym||q.t==='s'){
      const lo=sym?L:(len(hd(q,ow))||L);
      q[ow]=L>1e-6?[rd(-d[0]/L*lo),rd(-d[1]/L*lo)]:[0,0];
    }
  }
  /* titik-titik path bawaan untuk mengubah bentuk dasar menjadi path */
  function shapePts(type,w,h,r){
    const x=-w/2,y=-h/2,A=Math.abs,pt=(px,py,i,o,t)=>({x:rd(px),y:rd(py),i:i?[rd(i[0]),rd(i[1])]:[0,0],o:o?[rd(o[0]),rd(o[1])]:[0,0],t:t||'c'});
    if(type==='ellipse'){
      const a=A(w)/2,b=A(h)/2;
      return[pt(0,-b,[-a*KAPPA,0],[a*KAPPA,0],'s'),pt(a,0,[0,-b*KAPPA],[0,b*KAPPA],'s'),pt(0,b,[a*KAPPA,0],[-a*KAPPA,0],'s'),pt(-a,0,[0,b*KAPPA],[0,-b*KAPPA],'s')];
    }
    if(type==='rounded'){
      const q=Math.max(0,Math.min(r||0,A(w)/2,A(h)/2)),k=q*KAPPA;
      if(q<0.5)return shapePts('rect',w,h);
      return[pt(x+q,y,[-k,0]),pt(x+w-q,y,0,[k,0]),pt(x+w,y+q,[0,-k]),pt(x+w,y+h-q,0,[0,k]),pt(x+w-q,y+h,[k,0]),pt(x+q,y+h,0,[-k,0]),pt(x,y+h-q,[0,k]),pt(x,y+q,0,[0,-k])];
    }
    if(type==='triangle')return[pt(0,y),pt(x+w,y+h),pt(x,y+h)];
    if(type==='diamond')return[pt(0,y),pt(x+w,0),pt(0,y+h),pt(x,0)];
    if(type==='star'){
      const a=[];
      for(let i=0;i<10;i++){const g=-Math.PI/2+i*Math.PI/5,k=i%2?0.42:1;a.push(pt(Math.cos(g)*k*w/2,Math.sin(g)*k*h/2))}
      return a;
    }
    if(type==='heart')return[pt(0,h*.5,[.7*w,-.4*h],[-.7*w,-.4*h]),pt(0,-h*.2,[-.62*w,-.4*h],[.62*w,-.4*h])];
    return[pt(x,y),pt(x+w,y),pt(x+w,y+h),pt(x,y+h)];
  }

  /* ===== gambar ke canvas (dipanggil lewat APK.shapes.draw) ===== */
  function paint(ctx,it,ex){
    if(it.type==='lin')return APK.fx.grad(ctx,it.color,it.color2,it.angle,ex.w/2,ex.h/2);
    if(it.type==='rad'){
      const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(ex.w,ex.h)/2||1);
      g.addColorStop(0,it.color);g.addColorStop(1,it.color2);return g;
    }
    return it.color;
  }
  function draw(ctx,c,pr,W,H){
    const v=c.vec,ex=extent(v),fx=APK.fx,m=ctx.getTransform(),K0=Math.hypot(m.a,m.b)||1;
    const sh=Object.assign({},DEFSH,v.sh),path=build(v),rule=v.rule==='evenodd'?'evenodd':'nonzero';
    ctx.save();
    ctx.globalAlpha=clamp(pr.opacity,0,1);
    ctx.globalCompositeOperation=c.blend||'source-over';
    const k=Math.max(0,pr.scale),kk=K0*k;
    APK.layers.xf(ctx,c,pr,W,H,k);
    let shDone=false;
    for(const raw of v.st||[]){
      if(!raw||raw.on===false)continue;
      const it=Object.assign({},DEFST[raw.k]||DEFST.f,raw),useSh=sh.on&&!shDone;
      shDone=shDone||useSh;
      ctx.save();
      ctx.globalAlpha*=clamp(it.op/100,0,1);
      fx.shadow(ctx,useSh,{shadowColor:sh.color,shadowBlur:sh.blur,shadowX:sh.x,shadowY:sh.y},kk);
      const style=paint(ctx,it,ex);
      if(it.k==='f'){ctx.fillStyle=style;ctx.fill(path,rule)}
      else if(it.w>0){
        ctx.strokeStyle=style;ctx.lineWidth=it.w;ctx.lineCap=it.cap||'round';ctx.lineJoin=it.join||'round';ctx.miterLimit=10;
        ctx.setLineDash(it.dash>0?[it.dash,it.gap>0?it.gap:it.dash]:[]);
        ctx.stroke(path);
      }
      ctx.restore();
    }
    ctx.restore();
    return{w:ex.w,h:ex.h};
  }
  /* sambungkan ke modul bentuk: clip yang punya vec digambar oleh modul ini, selain itu perilaku lama */
  const S=APK.shapes,oDraw=S.draw,oLabel=S.label;
  S.draw=function(ctx,c){return c.vec?draw.apply(null,arguments):oDraw.apply(this,arguments)};
  S.label=t=>t==='path'?'Path vektor':oLabel(t);
  /* duplikat dan split membuat salinan clip: data vektor salinan harus terpisah dari aslinya */
  function unshare(){for(const id of T().selectedIds()){const f=find(id);if(f&&f.c.vec)f.c.vec=clone(f.c.vec)}}
  for(const n of ['duplicate','split']){const o=T()[n];T()[n]=function(){o.apply(this,arguments);unshare()}}

  /* ===== pemetaan layar <-> koordinat lokal layer ===== */
  let cv=null,pen=false,penId=null,penPi=0,drag=null,lastTap=null,sel={id:null,pi:0,i:-1},editing=false;
  const selOf=c=>{if(sel.id!==c.id)sel={id:c.id,pi:0,i:-1};return sel};
  function view(){
    const w=$('preview-wrap'),p=P(),cw=w.clientWidth,ch=w.clientHeight,pu=Math.min(cw/p.width,ch/p.height)||1;
    return{cw,ch,pu,ox:(cw-p.width*pu)/2,oy:(ch-p.height*pu)/2,W:p.width,H:p.height};
  }
  function xf(c){
    const v=view(),L=APK.layers;L.begin();
    const pr=L.props(c,APK.preview.time),k=Math.max(1e-3,pr.scale),a=pr.rotation*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
    const g=n=>Math.abs(n)<1e-4?(n<0?-1e-4:1e-4):n;
    const sx=g(k*(pr.sx==null?1:pr.sx)*(c.flipX?-1:1)),sy=g(k*(pr.sy==null?1:pr.sy)*(c.flipY?-1:1));
    const an=c.anchor||{x:0,y:0},ax=+an.x||0,ay=+an.y||0,cx=v.ox+(v.W/2+pr.x)*v.pu,cy=v.oy+(v.H/2+pr.y)*v.pu,u=v.pu;
    const tn=d=>Math.tan(Math.max(-80,Math.min(80,d||0))*Math.PI/180),tx=tn(pr.skx),ty=tn(pr.sky),det=(1-tx*ty)||1e-6;
    /* sama dengan urutan APK.layers.xf: titik pusat -> putar -> miring -> regang -> balik */
    return{
      to:(x,y)=>{const X=(x-ax)*sx,Y=(y-ay)*sy,X2=X+tx*Y,Y2=ty*X+Y;return[cx+(X2*ca-Y2*sa+ax)*u,cy+(X2*sa+Y2*ca+ay)*u]},
      from:(px,py)=>{const dx=(px-cx)/u-ax,dy=(py-cy)/u-ay,ux=dx*ca+dy*sa,uy=-dx*sa+dy*ca;return[(ux-tx*uy)/det/sx+ax,(uy-ty*ux)/det/sy+ay]}
    };
  }
  const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  const activeNow=c=>{const t=APK.preview.time;return t>=c.start&&t<c.start+c.dur};
  /* clip yang titiknya sedang bisa diedit: clip pena yang aktif, atau clip vektor terpilih */
  function editClip(){
    const p=P();if(!p)return null;
    if(pen){
      if(!penId)return null;
      const f=find(penId);
      if(f&&f.c.vec&&!f.tr.locked&&!f.tr.hidden&&activeNow(f.c))return f;
      penId=null;return null;
    }
    const s=T().selectedClip();
    return s&&s.c.vec&&!s.tr.locked&&!s.tr.hidden&&activeNow(s.c)?s:null;
  }
  function hit(s,sx,sy){
    const c=s.c,X=xf(c),v=c.vec,S2=selOf(c),R=HR+6;
    const sp=v.paths[S2.pi],q=sp&&sp.pts[S2.i];
    if(q)for(const w of ['o','i']){
      if(len(hd(q,w))<0.5)continue;
      const h=X.to(q.x+q[w][0],q.y+q[w][1]);
      if(Math.hypot(h[0]-sx,h[1]-sy)<=R)return{t:'h',pi:S2.pi,i:S2.i,w};
    }
    let best=null,bd=R;
    v.paths.forEach((pa,pi)=>pa.pts.forEach((p,i)=>{const a=X.to(p.x,p.y),d=Math.hypot(a[0]-sx,a[1]-sy);if(d<=bd){bd=d;best={t:'p',pi,i}}}));
    if(best)return best;
    let sd=coarse?16:10,sb=null;
    v.paths.forEach((pa,pi)=>{
      const n=pa.pts.length,m=pa.closed?n:n-1;
      for(let i=0;i<m;i++){
        const a=pa.pts[i],b=pa.pts[(i+1)%n];
        for(let k=1;k<40;k++){
          const u=k/40,p=bz(a,b,u),s2=X.to(p[0],p[1]),d=Math.hypot(s2[0]-sx,s2[1]-sy);
          if(d<sd){sd=d;sb={t:'seg',pi,i,u}}
        }
      }
    });
    return sb;
  }

  /* ===== overlay titik di preview (digambar di canvas gizmo, tidak ikut export) ===== */
  function overlay(){
    if(!cv||!P()||APK.preview.exporting)return;
    const s=editClip();if(!s)return;
    const c=s.c,v=c.vec,X=xf(c),S2=selOf(c),g=cv.getContext('2d');
    g.save();
    g.strokeStyle='rgba(127,140,255,.9)';g.lineWidth=1;
    for(const pa of v.paths){
      const n=pa.pts.length,m=pa.closed?n:n-1;
      if(n<1)continue;
      g.beginPath();
      for(let i=0;i<m;i++){
        const a=pa.pts[i],b=pa.pts[(i+1)%n];
        for(let k=0;k<=20;k++){const p=bz(a,b,k/20),q=X.to(p[0],p[1]);(i===0&&k===0)?g.moveTo(q[0],q[1]):g.lineTo(q[0],q[1])}
      }
      g.stroke();
    }
    const sp=v.paths[S2.pi],sq=sp&&sp.pts[S2.i];
    if(sq){
      const a=X.to(sq.x,sq.y);
      g.strokeStyle='#8b93a3';g.fillStyle='#fff';
      for(const w of ['o','i']){
        if(len(hd(sq,w))<0.5)continue;
        const h=X.to(sq.x+sq[w][0],sq.y+sq[w][1]);
        g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(h[0],h[1]);g.stroke();
        g.beginPath();g.arc(h[0],h[1],HR*0.6,0,Math.PI*2);g.fill();g.stroke();
      }
    }
    v.paths.forEach((pa,pi)=>pa.pts.forEach((p,i)=>{
      const a=X.to(p.x,p.y),on=pi===S2.pi&&i===S2.i;
      g.fillStyle=on?'#7f8cff':'#fff';g.strokeStyle='#1e2327';g.lineWidth=1.5;g.beginPath();
      if(p.t==='s')g.arc(a[0],a[1],HR*0.7,0,Math.PI*2);else g.rect(a[0]-HR*0.65,a[1]-HR*0.65,HR*1.3,HR*1.3);
      g.fill();g.stroke();
      if(pen&&penId===c.id&&pi===penPi&&i===0&&!pa.closed&&pa.pts.length>=3){
        g.strokeStyle='#4cc38a';g.lineWidth=2;g.beginPath();g.arc(a[0],a[1],HR*1.3,0,Math.PI*2);g.stroke();
      }
    }));
    g.restore();
  }
  function redraw(){if(APK.gizmo)APK.gizmo.draw()}
  if(APK.gizmo){const og=APK.gizmo.draw;APK.gizmo.draw=function(){og.apply(this,arguments);overlay()}}

  /* ===== pena dan edit titik lewat pointer ===== */
  const take=e=>{e.stopPropagation();e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}};
  function startLayer(sx,sy){
    const v=view(),px=(sx-v.ox)/v.pu-v.W/2,py=(sy-v.oy)/v.pu-v.H/2;
    T().addShape('path');
    const s=T().selectedClip();if(!s||!s.c.shape||s.c.shape.type!=='path')return null;
    const c=s.c;
    c.vec=mkVec();c.props=Object.assign({},c.props,{x:rd(px),y:rd(py)});
    c.vec.paths[0].pts.push(mkPt(0,0));
    penId=c.id;penPi=0;sel={id:c.id,pi:0,i:0};
    T().commit();
    return find(c.id);
  }
  function addPoint(s,sx,sy){
    const c=s.c,v=c.vec;
    if(!v.paths[penPi])penPi=v.paths.length-1;
    const pa=v.paths[penPi],p=xf(c).from(sx,sy);
    APK.history.record();
    pa.pts.push(mkPt(rd(p[0]),rd(p[1])));
    const S2=selOf(c);S2.pi=penPi;S2.i=pa.pts.length-1;
    drag={m:'new',c:c.id,pi:penPi,i:S2.i,x0:sx,y0:sy,moved:false};
    T().touch();extUI();
  }
  function onDown(e){
    if(!P()||e.button!==0||e.target!==cv)return;
    const[sx,sy]=pos(e),now=e.timeStamp;
    const dbl=!pen&&!!lastTap&&now-lastTap.t<380&&Math.hypot(sx-lastTap.x,sy-lastTap.y)<18;
    lastTap=dbl?null:{t:now,x:sx,y:sy};
    let s=editClip();
    const h=s?hit(s,sx,sy):null;
    if(s&&h){
      const c=s.c,S2=selOf(c),pa=c.vec.paths[h.pi];
      if(dbl&&h.t==='p'){
        take(e);S2.pi=h.pi;S2.i=h.i;APK.history.record();
        setType(pa,h.i,pa.pts[h.i].t==='s'?'c':'s');T().commit();return;
      }
      if(dbl&&h.t==='seg'){
        take(e);APK.history.record();
        const np=splitSeg(pa.pts[h.i],pa.pts[(h.i+1)%pa.pts.length],h.u);
        pa.pts.splice(h.i+1,0,np);S2.pi=h.pi;S2.i=h.i+1;T().commit();return;
      }
      if(h.t==='h'){
        take(e);drag={m:'h',c:c.id,pi:h.pi,i:h.i,w:h.w,x0:sx,y0:sy,moved:false};return;
      }
      if(h.t==='p'){
        take(e);
        if(pen&&penId===c.id&&h.pi===penPi&&h.i===0&&!pa.closed&&pa.pts.length>=3){
          APK.history.record();pa.closed=true;penId=null;T().commit();return;
        }
        S2.pi=h.pi;S2.i=h.i;
        const q=pa.pts[h.i],l=xf(c).from(sx,sy);
        drag={m:'p',c:c.id,pi:h.pi,i:h.i,x0:sx,y0:sy,lx:l[0],ly:l[1],qx:q.x,qy:q.y,moved:false};
        redraw();extUI();return;
      }
    }
    if(!pen)return;
    take(e);
    if(!s){
      s=startLayer(sx,sy);if(!s)return;
      drag={m:'new',c:s.c.id,pi:0,i:0,x0:sx,y0:sy,moved:false};return;
    }
    addPoint(s,sx,sy);
  }
  function onMove(e){
    if(!drag){if(pen&&e.target===cv)e.stopPropagation();return}
    e.stopPropagation();
    const f=find(drag.c);if(!f){drag=null;return}
    const c=f.c,pa=c.vec&&c.vec.paths[drag.pi],q=pa&&pa.pts[drag.i];if(!q){drag=null;return}
    const[sx,sy]=pos(e),l=xf(c).from(sx,sy);
    if(!drag.moved){
      if(Math.hypot(sx-drag.x0,sy-drag.y0)<3)return;
      if(drag.m!=='new')APK.history.record();
      drag.moved=true;
    }
    if(drag.m==='p'){q.x=rd(drag.qx+l[0]-drag.lx);q.y=rd(drag.qy+l[1]-drag.ly)}
    else if(drag.m==='h')moveHandle(q,drag.w,l[0],l[1],false);
    else{q.t='s';moveHandle(q,'o',l[0],l[1],true)}
    T().touch();
  }
  function onUp(e){
    if(!drag)return;
    e.stopPropagation();
    const d=drag;drag=null;
    if(d.moved||d.m==='new')T().commit();else redraw();
  }

  /* ===== aksi pada titik / path / isi-garis ===== */
  function delPoint(c){
    const S2=selOf(c),v=c.vec,pa=v.paths[S2.pi];
    if(!pa||!pa.pts[S2.i])return false;
    if(v.paths.reduce((n,p)=>n+p.pts.length,0)<=1){T().del();return true}
    APK.history.record();
    pa.pts.splice(S2.i,1);
    if(pa.pts.length<2)pa.closed=false;
    S2.i=pa.pts.length?Math.min(S2.i,pa.pts.length-1):-1;
    T().commit();return true;
  }
  function convert(c){
    const s=Object.assign({},APK.shapes.DEF,c.shape);
    const v={rule:'nonzero',paths:[{closed:true,pts:shapePts(s.type,s.w,s.h,s.radius)}],st:[],
      sh:{on:!!s.shadowOn,color:s.shadowColor,blur:s.shadowBlur,x:s.shadowX,y:s.shadowY}};
    if(s.fillOn){const f=mkItem('f');f.color=s.fill;if(s.gradOn){f.type='lin';f.color2=s.fill2;f.angle=s.gradAngle}v.st.push(f)}
    if(s.strokeW>0){const t=mkItem('s');t.color=s.stroke;t.w=s.strokeW;v.st.push(t)}
    APK.history.record();
    c.vec=v;c.shape={type:'path'};
    T().commit();toast('Bentuk diubah jadi path vektor. Pilih layer lalu seret titiknya di preview.');
  }
  function act(name){
    const s=T().selectedClip();if(!s||s.tr.locked)return;
    const c=s.c;
    if(name==='conv'){if(!c.vec&&c.shape)convert(c);return}
    if(!c.vec)return;
    const v=c.vec,S2=selOf(c),pa=v.paths[S2.pi],q=pa&&pa.pts[S2.i];
    if(name==='addf'||name==='adds'){APK.history.record();v.st.push(mkItem(name==='addf'?'f':'s'))}
    else if(name==='close'){
      if(!pa)return;
      if(!pa.closed&&pa.pts.length<3){toast('Path butuh minimal 3 titik untuk ditutup');return}
      APK.history.record();pa.closed=!pa.closed;
    }
    else if(name==='ptype'){if(!q)return;APK.history.record();setType(pa,S2.i,q.t==='s'?'c':'s')}
    else if(name==='pins'){
      if(!q)return;
      const n=pa.pts.length;
      if(n<2||(!pa.closed&&S2.i>=n-1)){toast('Pilih titik yang punya segmen setelahnya');return}
      APK.history.record();
      pa.pts.splice(S2.i+1,0,splitSeg(pa.pts[S2.i],pa.pts[(S2.i+1)%n],0.5));S2.i+=1;
    }
    else if(name==='pdel'){if(!q){toast('Pilih titik di preview dulu');return}delPoint(c);return}
    else if(name==='sub'){
      APK.history.record();
      v.paths.push({closed:false,pts:[]});
      pen=true;penId=c.id;penPi=v.paths.length-1;S2.pi=penPi;S2.i=-1;
      syncPenUI();
      toast('Ketuk di preview untuk menambah titik sub-path');
    }
    T().commit();
  }
  function itemAct(btn){
    const s=T().selectedClip();if(!s||s.tr.locked||!s.c.vec)return;
    const st=s.c.vec.st,d=btn.closest('.vi'),n=d?+d.dataset.n:-1;
    if(n<0||!st[n])return;
    const a=btn.dataset.va;
    if(a==='up'&&n>0){APK.history.record();[st[n-1],st[n]]=[st[n],st[n-1]]}
    else if(a==='dn'&&n<st.length-1){APK.history.record();[st[n+1],st[n]]=[st[n],st[n+1]]}
    else if(a==='rm'){APK.history.record();st.splice(n,1)}
    else return;
    T().commit();
  }

  /* ===== panel properti (ditempel lewat pembungkus APK.properties.refresh) ===== */
  function itemHTML(it,n){
    const f=it.k==='f';
    return `<div class="vi" data-n="${n}"><div class="vi-h"><label><input type="checkbox" data-vi="on">${f?'Isi':'Garis'} ${n+1}</label><span>
      <button type="button" data-va="up" title="Naikkan urutan gambar">▲</button><button type="button" data-va="dn" title="Turunkan urutan gambar">▼</button><button type="button" data-va="rm" title="Hapus ${f?'isi':'garis'} ini">✕</button></span></div>
      <label>Warna<input type="color" data-vi="color"></label>
      <label>Opacity (%)<input type="range" data-vi="op" min="0" max="100" step="1"></label>
      ${f?'':'<label>Lebar garis (px)<input type="number" data-vi="w" min="0" max="500" step="1"></label>'}
      <div class="adv"><label>Jenis cat<select data-vi="type"><option value="solid">Warna polos</option><option value="lin">Gradien linear</option><option value="rad">Gradien radial</option></select></label>
      <label>Warna kedua (gradien)<input type="color" data-vi="color2"></label>
      <label>Arah gradien linear (°)<input type="range" data-vi="angle" min="0" max="360" step="1"></label>
      ${f?'':`<label>Ujung garis<select data-vi="cap"><option value="round">Bulat</option><option value="butt">Rata</option><option value="square">Kotak</option></select></label>
      <label>Sambungan sudut<select data-vi="join"><option value="round">Bulat</option><option value="miter">Runcing</option><option value="bevel">Miring</option></select></label>
      <label>Garis putus: panjang (px, 0 = menerus)<input type="number" data-vi="dash" min="0" max="500" step="1"></label>
      <label>Garis putus: jarak (px)<input type="number" data-vi="gap" min="0" max="500" step="1"></label>`}</div></div>`;
  }
  function sigOf(c){
    const v=c.vec,S2=sel.id===c.id?sel:{pi:0,i:-1},pa=v.paths[S2.pi],q=pa&&pa.pts[S2.i];
    return JSON.stringify([c.id,v.rule,v.sh,v.st,v.paths.length,pa?[pa.closed,pa.pts.length]:0,q?q.t:null,S2.i,pen&&penId===c.id]);
  }
  function boxHTML(c){
    const v=c.vec,S2=sel.id===c.id?sel:{pi:0,i:-1},pa=v.paths[S2.pi],q=pa&&pa.pts[S2.i],dis=q?'':' disabled';
    return `<h3 class="kf-title">Path vektor</h3>
      <div class="kf-bar"><button type="button" class="btn" data-vb="sub" title="Mulai sub-path baru di layer ini (Pena aktif)">+ Sub-path</button><button type="button" class="btn" data-vb="close"${pa?'':' disabled'} title="Tutup atau buka path terpilih">${pa&&pa.closed?'Buka path':'Tutup path'}</button></div>
      <div class="kf-bar"><button type="button" class="btn" data-vb="ptype"${dis} title="Ubah titik terpilih antara sudut dan halus (di preview: ketuk dua kali pada titik)">Sudut ⇄ Halus</button><button type="button" class="btn" data-vb="pins"${dis} title="Sisip titik di tengah segmen setelah titik terpilih (di preview: ketuk dua kali pada garis)">Sisip titik</button><button type="button" class="btn danger" data-vb="pdel"${dis} title="Hapus titik terpilih (Delete)">Hapus titik</button></div>
      <p class="kf-hint">${q?'Titik '+(S2.i+1)+' dari '+pa.pts.length+' ('+(q.t==='s'?'halus':'sudut')+'). Seret titik atau handle-nya di preview.':'Ketuk titik di preview untuk memilihnya. Kotak = sudut, bulat = halus.'}</p>
      <h3 class="kf-title">Isi &amp; garis (digambar berurutan)</h3>${v.st.map(itemHTML).join('')}
      <div class="kf-bar"><button type="button" class="btn" data-vb="addf" title="Tambah lapisan isi warna">+ Isi</button><button type="button" class="btn" data-vb="adds" title="Tambah lapisan garis (stroke)">+ Garis</button></div>
      <div class="adv"><label>Aturan isi<select data-vr="rule"><option value="nonzero">Nonzero (isi penuh)</option><option value="evenodd">Even-odd (bagian tumpang tindih jadi lubang)</option></select></label>
      <div class="tx-row"><label title="Bayangan di belakang layer"><input type="checkbox" data-vs="on">Bayangan</label></div>
      <label>Warna bayangan<input type="color" data-vs="color"></label>
      <label>Blur bayangan<input type="range" data-vs="blur" min="0" max="100" step="1"></label>
      <label>Geser bayangan X<input type="range" data-vs="x" min="-100" max="100" step="1"></label>
      <label>Geser bayangan Y<input type="range" data-vs="y" min="-100" max="100" step="1"></label></div>`;
  }
  function fillBox(box,c){
    const v=c.vec,sh=Object.assign({},DEFSH,v.sh);
    box.querySelectorAll('.vi').forEach(d=>{
      const it=Object.assign({},DEFST[(v.st[+d.dataset.n]||{}).k]||DEFST.f,v.st[+d.dataset.n]);
      d.querySelectorAll('[data-vi]').forEach(el=>{const val=it[el.dataset.vi];if(el.type==='checkbox')el.checked=val!==false;else el.value=val})
    });
    box.querySelectorAll('[data-vs]').forEach(el=>{const val=sh[el.dataset.vs];if(el.type==='checkbox')el.checked=!!val;else el.value=val});
    const r=box.querySelector('[data-vr]');if(r)r.value=v.rule==='evenodd'?'evenodd':'nonzero';
  }
  function wireBox(box){
    box.addEventListener('input',e=>{
      const el=e.target,d=el.dataset,s=T().selectedClip();
      if(!s||!s.c.vec||s.tr.locked||!(d.vi||d.vs||d.vr))return;
      e.stopPropagation();
      const c=s.c,v=c.vec,num=el.type==='number'||el.type==='range';
      let val=el.type==='checkbox'?el.checked:num?parseFloat(el.value):el.value;
      if(num){
        if(!isFinite(val))return;
        val=clamp(val,el.min!==''?+el.min:-Infinity,el.max!==''?+el.max:Infinity);
      }
      if(!editing){APK.history.record();editing=true}
      if(d.vi){const it=v.st[+el.closest('.vi').dataset.n];if(!it)return;it[d.vi]=val}
      else if(d.vs){v.sh=Object.assign({},DEFSH,v.sh);v.sh[d.vs]=val}
      else v.rule=val;
      box.dataset.sig=sigOf(c);T().touch();
    });
    box.addEventListener('change',e=>{editing=false;e.stopPropagation()});
    box.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      e.stopPropagation();
      if(b.dataset.va)itemAct(b);else if(b.dataset.vb)act(b.dataset.vb);
    });
  }
  /* bagian "Bentuk" bawaan tidak berlaku untuk path, jadi dibuang dari panel (sampai blok gradien/bayangan-nya) */
  function trimShape(fs){
    const h=[...fs.children].find(e=>e.tagName==='H3'&&e.textContent.trim()==='Bentuk');
    if(!h)return;
    let n=h.nextElementSibling;h.remove();
    while(n){const nx=n.nextElementSibling,adv=n.classList.contains('adv');n.remove();if(adv)break;n=nx}
  }
  function extUI(){
    const panel=$('panel-props'),fs=panel&&panel.querySelector('fieldset');
    let box=$('vec-props'),cb=$('vec-conv');
    const s=P()&&T().selectedClip();
    if(!s||!fs||s.tr.kind==='audio'){if(box)box.remove();if(cb)cb.remove();return}
    const c=s.c;
    if(c.vec){
      if(cb)cb.remove();
      trimShape(fs);
      const nm=panel.querySelector('.pr-name');if(nm)nm.textContent='Layer vektor';
      if(!box||box.dataset.cid!==c.id||!fs.contains(box)){
        if(box)box.remove();
        box=document.createElement('div');box.id='vec-props';box.dataset.cid=c.id;box.dataset.sig='';
        fs.insertBefore(box,fs.firstChild);wireBox(box);
      }
      const sg=sigOf(c);
      if(box.dataset.sig!==sg){box.innerHTML=boxHTML(c);fillBox(box,c);box.dataset.sig=sg}
    }else if(c.shape&&c.shape.type!=='group'&&c.shape.type!=='path'){
      if(box)box.remove();
      if(!cb||cb.dataset.cid!==c.id||!fs.contains(cb)){
        if(cb)cb.remove();
        cb=document.createElement('div');cb.id='vec-conv';cb.className='adv';cb.dataset.cid=c.id;
        cb.innerHTML='<h3 class="kf-title">Vektor</h3><button type="button" class="btn" data-vb="conv" title="Ubah bentuk ini menjadi path vektor yang titiknya bisa diedit">Ubah jadi path vektor</button><p class="kf-hint">Setelah diubah, titik dan handle bisa diseret di preview. Pengaturan bentuk (lebar, tinggi, sudut) diganti dengan titik path.</p>';
        cb.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.vb){e.stopPropagation();act(b.dataset.vb)}});
        fs.appendChild(cb);
      }
    }else{if(box)box.remove();if(cb)cb.remove()}
  }
  const oRefresh=APK.properties.refresh;
  APK.properties.refresh=function(f){oRefresh.apply(this,arguments);extUI()};

  /* ===== mode pena dan shortcut ===== */
  function syncPenUI(){
    const b=$('tl-pen');if(b)b.classList.toggle('on',pen);
    document.body.classList.toggle('pen-on',pen);
    if(cv)cv.style.cursor=pen?'crosshair':'default';
    redraw();
  }
  function setPen(on,quiet){
    pen=!!on;if(!pen)penId=null;
    syncPenUI();
    if(!quiet)toast(pen?'Pena aktif: ketuk di preview untuk membuat titik, tarik untuk lengkung. Ketuk titik awal (cincin hijau) untuk menutup path.':'Pena dimatikan');
  }
  addEventListener('keydown',e=>{
    if(!P()||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
    const lk=e.key.toLowerCase(),ctrl=e.ctrlKey||e.metaKey;
    if(!ctrl&&!e.altKey&&lk==='p'){e.preventDefault();e.stopPropagation();setPen(!pen);return}
    if(pen&&(e.key==='Enter'||e.key==='Escape')){
      e.preventDefault();e.stopPropagation();
      if(penId){penId=null;redraw();if(window.APK&&APK.properties)APK.properties.refresh()}
      else if(e.key==='Escape')setPen(false);
      return;
    }
    if(e.key==='Delete'||e.key==='Backspace'){
      const s=editClip();if(!s)return;
      const S2=selOf(s.c);
      if(S2.i>=0&&s.c.vec.paths[S2.pi]&&s.c.vec.paths[S2.pi].pts[S2.i]){e.preventDefault();e.stopPropagation();delPoint(s.c)}
    }
  },true);

  function init(){
    cv=$('pv-gizmo');if(!cv)return;
    const w=$('preview-wrap');
    w.addEventListener('pointerdown',onDown,true);
    w.addEventListener('pointermove',onMove,true);
    w.addEventListener('pointerup',onUp,true);w.addEventListener('pointercancel',onUp,true);
    if(window.ResizeObserver)new ResizeObserver(()=>redraw()).observe(w);
    const b=$('tl-pen');if(b)b.onclick=()=>{if(P())setPen(!pen)};
  }
  init();
  return{xf,build,extent,bz,splitSeg,setType,moveHandle,shapePts,draw,mkVec,mkItem,mkPt,setPen,get pen(){return pen}};
})();
