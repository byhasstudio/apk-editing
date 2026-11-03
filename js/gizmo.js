/* Gizmo di preview: pilih, geser, scale, dan putar objek langsung di canvas (seperti Alight Motion).
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

  function draw(){
    if(!cv)return;
    const w=$('preview-wrap'),cw=w.clientWidth,ch=w.clientHeight,dpr=window.devicePixelRatio||1;
    if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);
    if(!P()||APK.preview.exporting)return;
    const v=view();
    if(drag&&(guides.x||guides.y)){
      g.save();g.strokeStyle='#ff6b6b';g.lineWidth=1;g.setLineDash([5,4]);g.beginPath();
      if(guides.x){const x=v.ox+v.W/2*v.pu;g.moveTo(x,v.oy);g.lineTo(x,v.oy+v.H*v.pu)}
      if(guides.y){const y=v.oy+v.H/2*v.pu;g.moveTo(v.ox,y);g.lineTo(v.ox+v.W*v.pu,y)}
      g.stroke();g.restore();
    }
    const s=APK.timeline.selectedClip();if(!s)return;
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
    }
    g.restore();
  }

  function set(c,p,val){
    const K=APK.kf;c.props=Object.assign({},DEFP,c.props);
    if(K.animated(c,p)){if(K.setKey(c,p,drag.r,val))drag.newKey=true}else c.props[p]=val;
  }
  function down(e){
    const p=P();if(!p||e.button!==0)return;
    const[sx,sy]=pos(e),v=view(),multi=e.shiftKey||e.ctrlKey||e.metaKey;
    let sc=APK.timeline.selectedClip(),mode=null,id=null;
    if(sc&&!sc.tr.locked&&!multi){const b=APK.preview.bounds(sc.c.id);if(b){mode=hitHandle(v,b,sx,sy);if(mode)id=sc.c.id}}
    if(!mode){
      const pid=pick(v,sx,sy);
      if(!pid){APK.timeline.select(null);return}
      APK.timeline.select(pid,{toggle:multi});
      if(multi)return;
      sc=APK.timeline.selectedClip();
      if(!sc||sc.c.id!==pid||sc.tr.locked)return;
      mode='move';id=pid;
    }
    const c=sc.c,r=rel(c),pr=APK.kf.props(c,r),[px,py]=toProj(v,sx,sy),cx=p.width/2+pr.x,cy=p.height/2+pr.y,a0=Math.atan2(py-cy,px-cx);
    drag={mode,id,r,x0:pr.x,y0:pr.y,s0:pr.scale,rot0:pr.rotation,px,py,cx,cy,d0:Math.hypot(px-cx,py-cy)||1,last:a0,acc:0,moved:false,newKey:false};
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
      let nx=drag.x0+(px-drag.px),ny=drag.y0+(py-drag.py);const th=6/v.pu;
      if(!e.altKey){
        if(Math.abs(nx)<th){nx=0;guides.x=true}
        if(Math.abs(ny)<th){ny=0;guides.y=true}
      }
      set(c,'x',Math.round(nx*10)/10);set(c,'y',Math.round(ny*10)/10);
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
    if(m)APK.timeline.commit();else draw();
  }
  function hover(e){
    if(!P())return;
    const[sx,sy]=pos(e),v=view(),sc=APK.timeline.selectedClip();let cur='default';
    if(sc&&!sc.tr.locked){const b=APK.preview.bounds(sc.c.id);if(b){const h=hitHandle(v,b,sx,sy);if(h)cur=h==='rot'?'grab':'nwse-resize'}}
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
