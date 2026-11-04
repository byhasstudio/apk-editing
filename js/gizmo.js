/* Gizmo di preview: pilih, geser, scale, dan putar objek langsung di canvas (seperti Alight Motion).
   Juga menggambar dan mengedit titik motion path, dan memahami induk (parent).
   Digambar di canvas terpisah (#pv-gizmo) sehingga tidak ikut ter-export. */
window.APK=window.APK||{};
APK.gizmo=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const DEFP={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches,HR=coarse?13:7;
  let cv=null,g=null,drag=null,guides={x:false,y:false};
  const rel=c=>Math.min(Math.max(APK.preview.time-c.start,0),c.dur);
  const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};

  function view(){
    const w=$('preview-wrap'),p=P(),cw=w.clientWidth,ch=w.clientHeight,pu=Math.min(cw/p.width,ch/p.height)||1;
    return{cw,ch,pu,ox:(cw-p.width*pu)/2,oy:(ch-p.height*pu)/2,W:p.width,H:p.height};
  }
  const toProj=(v,sx,sy)=>[(sx-v.ox)/v.pu,(sy-v.oy)/v.pu];
  /* titik layar -> koordinat lokal kotak objek (px layar), memperhitungkan rotasi */
  function local(v,b,sx,sy){
    const dx=sx-(v.ox+b.cx*v.pu),dy=sy-(v.oy+b.cy*v.pu),a=-b.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
    return[dx*ca-dy*sa,dx*sa+dy*ca];
  }
  function hitHandle(v,b,sx,sy){
    const[lx,ly]=local(v,b,sx,sy),hw=b.w*v.pu/2,hh=b.h*v.pu/2,r=HR+5;
    if(Math.hypot(lx,ly+hh+28)<=r)return 'rot';
    for(const[cx,cy] of [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]])if(Math.hypot(lx-cx,ly-cy)<=r)return 'scale';
    /* pegangan di tengah sisi: kiri/kanan = panjangkan/pendekkan lebar, atas/bawah = tinggi */
    if(Math.hypot(lx-hw,ly)<=r||Math.hypot(lx+hw,ly)<=r)return 'sx';
    if(Math.hypot(lx,ly-hh)<=r||Math.hypot(lx,ly+hh)<=r)return 'sy';
    return null;
  }
  /* objek paling atas di titik tersebut (track urutan pertama = layer paling atas) */
  function pick(v,sx,sy){
    for(const tr of P().tracks){
      if(tr.hidden||tr.kind==='audio')continue;
      for(let i=tr.clips.length-1;i>=0;i--){
        const c=tr.clips[i],b=APK.preview.bounds(c.id);if(!b)continue;
        const[lx,ly]=local(v,b,sx,sy);
        if(Math.abs(lx)<=Math.max(b.w*v.pu/2,12)&&Math.abs(ly)<=Math.max(b.h*v.pu/2,12))return c.id;
      }
    }
    return null;
  }

  /* ===== motion path: titik jalur di layar ===== */
  function ptScreen(v,c,i){
    const pr=APK.kf.props(c,rel(c)),q=c.mp.pts[i],w=APK.layers.world(c,APK.preview.time,pr.x+q[0],pr.y+q[1]);
    return[v.ox+(v.W/2+w.x)*v.pu,v.oy+(v.H/2+w.y)*v.pu];
  }
  function hitPt(v,c,sx,sy){
    let best=-1,bd=HR+6;
    for(let i=0;i<c.mp.pts.length;i++){const[x,y]=ptScreen(v,c,i),d=Math.hypot(x-sx,y-sy);if(d<=bd){bd=d;best=i}}
    return best;
  }
  function drawPath(v,s){
    const c=s.c,mp=c.mp;
    if(!mp||!mp.on||!mp.pts||mp.pts.length<2)return;
    const t=APK.preview.time,pr=APK.kf.props(c,rel(c)),smp=APK.motion.samples(mp);
    g.save();g.strokeStyle='#4cc38a';g.lineWidth=1.5;g.setLineDash([6,4]);g.beginPath();
    smp.forEach((q,i)=>{
      const w=APK.layers.world(c,t,pr.x+q[0],pr.y+q[1]),x=v.ox+(v.W/2+w.x)*v.pu,y=v.oy+(v.H/2+w.y)*v.pu;
      i?g.lineTo(x,y):g.moveTo(x,y);
    });
    g.stroke();g.setLineDash([]);
    if(!s.tr.locked)mp.pts.forEach((q,i)=>{
      const[x,y]=ptScreen(v,c,i);
      g.beginPath();g.arc(x,y,HR*0.8,0,Math.PI*2);
      g.fillStyle=i===0?'#4cc38a':i===mp.pts.length-1?'#ff6b6b':'#fff';g.fill();
      g.strokeStyle='#1e2327';g.lineWidth=1.5;g.stroke();
    });
    g.restore();
  }

  function draw(){
    if(!cv)return;
    const w=$('preview-wrap'),cw=w.clientWidth,ch=w.clientHeight,dpr=window.devicePixelRatio||1;
    if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);
    if(!P()||APK.preview.exporting)return;
    const v=view(),s=APK.timeline.selectedClip();
    /* layer grup (kosong) tidak terlihat di hasil, jadi diberi garis putus-putus tipis agar mudah ditemukan */
    g.save();g.strokeStyle='rgba(139,147,163,.85)';g.lineWidth=1;g.setLineDash([4,4]);
    for(const tr of P().tracks){
      if(tr.hidden)continue;
      for(const c of tr.clips){
        if(!c.shape||c.shape.type!=='group'||(s&&s.c.id===c.id))continue;
        const b=APK.preview.bounds(c.id);if(!b)continue;
        g.save();g.translate(v.ox+b.cx*v.pu,v.oy+b.cy*v.pu);g.rotate(b.rot*Math.PI/180);
        g.strokeRect(-b.w*v.pu/2,-b.h*v.pu/2,b.w*v.pu,b.h*v.pu);g.restore();
      }
    }
    g.restore();
    if(drag&&(guides.x||guides.y)){
      g.save();g.strokeStyle='#ff6b6b';g.lineWidth=1;g.setLineDash([5,4]);g.beginPath();
      if(guides.x){const x=v.ox+v.W/2*v.pu;g.moveTo(x,v.oy);g.lineTo(x,v.oy+v.H*v.pu)}
      if(guides.y){const y=v.oy+v.H/2*v.pu;g.moveTo(v.ox,y);g.lineTo(v.ox+v.W*v.pu,y)}
      g.stroke();g.restore();
    }
    if(!s)return;
    drawPath(v,s);
    const b=APK.preview.bounds(s.c.id);if(!b)return;
    const hw=b.w*v.pu/2,hh=b.h*v.pu/2,lock=!!s.tr.locked;
    g.save();
    g.translate(v.ox+b.cx*v.pu,v.oy+b.cy*v.pu);g.rotate(b.rot*Math.PI/180);
    g.lineWidth=1.5;g.strokeStyle=lock?'#ff6b6b':'#7f8cff';
    if(lock)g.setLineDash([6,4]);
    g.strokeRect(-hw,-hh,hw*2,hh*2);g.setLineDash([]);
    if(!lock){
      g.beginPath();g.moveTo(0,-hh);g.lineTo(0,-hh-28);g.stroke();
      g.fillStyle='#fff';g.strokeStyle='#7f8cff';
      for(const[cx,cy] of [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]]){g.beginPath();g.rect(cx-HR*0.7,cy-HR*0.7,HR*1.4,HR*1.4);g.fill();g.stroke()}
      g.beginPath();g.arc(0,-hh-28,HR*0.75,0,Math.PI*2);g.fill();g.stroke();
      g.fillStyle='#ffd166';g.strokeStyle='#7f8cff';
      for(const[cx,cy] of [[-hw,0],[hw,0]]){g.beginPath();g.rect(cx-HR*0.4,cy-HR*0.9,HR*0.8,HR*1.8);g.fill();g.stroke()}
      for(const[cx,cy] of [[0,-hh],[0,hh]]){g.beginPath();g.rect(cx-HR*0.9,cy-HR*0.4,HR*1.8,HR*0.8);g.fill();g.stroke()}
    }
    g.restore();
  }

  function set(c,p,val){
    const K=APK.kf,A=APK.autokey;c.props=Object.assign({},DEFP,c.props);
    /* mode kurva otomatis sedang merekam: setiap gerakan langsung jadi keyframe di playhead */
    if(A&&A.recording&&K.VISUAL.includes(p)){if(A.key(c,p,rel(c),val))drag.newKey=true}   /* waktu SEKARANG: timeline berjalan saat merekam */
    else if(K.animated(c,p)){if(K.setKey(c,p,drag.r,val))drag.newKey=true}else c.props[p]=val;
  }
  function down(e){
    const p=P();if(!p||e.button!==0)return;
    const[sx,sy]=pos(e),v=view(),multi=e.shiftKey||e.ctrlKey||e.metaKey;
    let sc=APK.timeline.selectedClip(),mode=null,id=null,pi=-1;
    /* titik motion path punya prioritas tertinggi */
    if(sc&&!sc.tr.locked&&!multi&&sc.c.mp&&sc.c.mp.on&&sc.c.mp.pts&&sc.c.mp.pts.length>1){
      pi=hitPt(v,sc.c,sx,sy);
      if(pi>=0){mode='mpt';id=sc.c.id}
    }
    if(!mode&&sc&&!sc.tr.locked&&!multi){const b=APK.preview.bounds(sc.c.id);if(b){mode=hitHandle(v,b,sx,sy);if(mode)id=sc.c.id}}
    if(!mode){
      const pid=pick(v,sx,sy);
      if(!pid){APK.timeline.select(null);return}
      APK.timeline.select(pid,{toggle:multi});
      if(multi)return;
      sc=APK.timeline.selectedClip();
      if(!sc||sc.c.id!==pid||sc.tr.locked)return;
      mode='move';id=pid;
    }
    const c=sc.c,r=rel(c),pr=APK.kf.props(c,r),[px,py]=toProj(v,sx,sy),b0=APK.preview.bounds(c.id),
      cx=b0?b0.cx:p.width/2+pr.x,cy=b0?b0.cy:p.height/2+pr.y,a0=Math.atan2(py-cy,px-cx);
    drag={mode,id,r,x0:pr.x,y0:pr.y,s0:pr.scale,rot0:pr.rotation,px,py,cx,cy,d0:Math.hypot(px-cx,py-cy)||1,last:a0,acc:0,moved:false,newKey:false,
      b0:b0||null,l0:b0?local(v,b0,sx,sy):[1,1],st0x:pr.sx==null?1:pr.sx,st0y:pr.sy==null?1:pr.sy,
      pi,q0:mode==='mpt'?c.mp.pts[pi].slice():null};
    cv.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function move(e){
    if(!drag){hover(e);return}
    const s=APK.timeline.selectedClip();if(!s||s.c.id!==drag.id){drag=null;return}
    const c=s.c,v=view(),[sx,sy]=pos(e),[px,py]=toProj(v,sx,sy);
    if(!drag.moved){
      if(Math.hypot(px-drag.px,py-drag.py)*v.pu<3)return;
      APK.history.record();drag.moved=true;
    }
    guides={x:false,y:false};
    if(drag.mode==='move'){
      /* selisih di layar diubah ke ruang induk supaya anak bergerak mengikuti jari/kursor */
      const d=APK.layers.toLocal(c,APK.preview.time,px-drag.px,py-drag.py),follow=APK.layers.hasParent(c)||(c.mp&&c.mp.on);
      let nx=drag.x0+d.x,ny=drag.y0+d.y;const th=6/v.pu;
      if(!e.altKey&&!follow){
        if(Math.abs(nx)<th){nx=0;guides.x=true}
        if(Math.abs(ny)<th){ny=0;guides.y=true}
      }
      set(c,'x',Math.round(nx*10)/10);set(c,'y',Math.round(ny*10)/10);
    }else if(drag.mode==='mpt'){
      const d=APK.layers.toLocal(c,APK.preview.time,px-drag.px,py-drag.py);
      if(c.mp&&c.mp.pts[drag.pi])c.mp.pts[drag.pi]=[Math.round((drag.q0[0]+d.x)*10)/10,Math.round((drag.q0[1]+d.y)*10)/10];
    }else if((drag.mode==='sx'||drag.mode==='sy')&&drag.b0){
      /* regang satu sumbu: perbandingan jarak jari ke pusat (di sumbu objek) sekarang dibanding saat mulai */
      const i=drag.mode==='sx'?0:1,l=local(v,drag.b0,sx,sy),ratio=Math.abs(l[i])/(Math.abs(drag.l0[i])||1);
      set(c,drag.mode,Math.round(Math.min(20,Math.max(0.01,(i?drag.st0y:drag.st0x)*ratio))*1000)/1000);
    }else if(drag.mode==='scale'){
      const k=Math.hypot(px-drag.cx,py-drag.cy)/drag.d0;
      set(c,'scale',Math.min(10,Math.max(0.01,drag.s0*k)));
    }else{
      const a=Math.atan2(py-drag.cy,px-drag.cx);
      let da=a-drag.last;
      while(da>Math.PI)da-=2*Math.PI;
      while(da<-Math.PI)da+=2*Math.PI;
      drag.acc+=da;drag.last=a;
      let r=drag.rot0+drag.acc*180/Math.PI;
      if(e.shiftKey)r=Math.round(r/15)*15;
      set(c,'rotation',Math.round(r*10)/10);
    }
    APK.timeline.touch();
  }
  function up(){
    if(!drag)return;
    const m=drag.moved;drag=null;guides={x:false,y:false};
    if(m&&APK.autokey)APK.autokey.flush();
    if(m)APK.timeline.commit();else draw();
  }
  function hover(e){
    if(!P())return;
    const[sx,sy]=pos(e),v=view(),sc=APK.timeline.selectedClip();let cur='default';
    if(sc&&!sc.tr.locked){
      if(sc.c.mp&&sc.c.mp.on&&sc.c.mp.pts&&sc.c.mp.pts.length>1&&hitPt(v,sc.c,sx,sy)>=0)cur='pointer';
      if(cur==='default'){const b=APK.preview.bounds(sc.c.id);if(b){const h=hitHandle(v,b,sx,sy);if(h)cur=h==='rot'?'grab':h==='sx'?'ew-resize':h==='sy'?'ns-resize':'nwse-resize'}}
    }
    if(cur==='default'&&pick(v,sx,sy))cur='move';
    cv.style.cursor=cur;
  }
  function init(){
    cv=$('pv-gizmo');g=cv.getContext('2d');
    cv.addEventListener('pointerdown',down);
    cv.addEventListener('pointermove',move);
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    if(window.ResizeObserver)new ResizeObserver(()=>draw()).observe($('preview-wrap'));
  }
  return{init,draw};
})();
