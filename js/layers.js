/* Transformasi efektif clip: properti keyframe + motion path + rantai induk (parent).
   Anak mengikuti gerak, scale, rotasi, dan opacity induknya. Dipakai preview dan gizmo. */
window.APK=window.APK||{};
APK.layers=(function(){
  let map=new Map();
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const sf=s=>Math.abs(s)<1e-3?1e-3:s;
  /* dipanggil sekali tiap frame preview: indeks id -> clip */
  function begin(){
    map=new Map();const p=APK.project.current;
    if(p)for(const tr of p.tracks)for(const c of tr.clips)map.set(c.id,c);
  }
  /* properti milik clip sendiri (keyframe + offset motion path), belum digabung dengan induk */
  function local(c,t){
    const rel=clamp(t-c.start,0,c.dur),pr=APK.kf.props(c,rel),mp=c.mp;
    if(mp&&mp.on&&mp.pts&&mp.pts.length>1&&c.dur>0){
      const u=APK.kf.easeFn(mp.ease||'inout')(rel/c.dur),q=APK.motion.at(mp,u);
      pr.x+=q.x;pr.y+=q.y;
      if(mp.orient)pr.rotation+=q.angle;
    }
    return pr;
  }
  const parentOf=c=>c.parent&&c.parent!==c.id?(map.get(c.parent)||null):null;
  function eff(c,t,d){
    const pr=local(c,t),par=d<8?parentOf(c):null;
    if(!par)return pr;
    const pp=eff(par,t,d+1),a=pp.rotation*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),s=pp.scale,lx=pr.x*s,ly=pr.y*s;
    pr.x=pp.x+lx*ca-ly*sa;pr.y=pp.y+lx*sa+ly*ca;
    pr.scale*=s;pr.rotation+=pp.rotation;pr.opacity*=pp.opacity;
    return pr;
  }
  const props=(c,t)=>eff(c,t,0);
  /* transformasi efektif induk (null kalau tidak punya induk) */
  const frame=(c,t)=>{const par=parentOf(c);return par?eff(par,t,1):null};
  const hasParent=c=>!!parentOf(c);
  /* selisih posisi di layar (px project) -> selisih posisi lokal di ruang induk */
  function toLocal(c,t,dx,dy){
    const pp=frame(c,t);if(!pp)return{x:dx,y:dy};
    const a=-pp.rotation*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),s=sf(pp.scale);
    return{x:(dx*ca-dy*sa)/s,y:(dx*sa+dy*ca)/s};
  }
  /* titik lokal (di ruang induk) -> koordinat project dari tengah kanvas */
  function world(c,t,lx,ly){
    const pp=frame(c,t);if(!pp)return{x:lx,y:ly};
    const a=pp.rotation*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a),s=pp.scale;
    return{x:pp.x+lx*s*ca-ly*s*sa,y:pp.y+lx*s*sa+ly*s*ca};
  }
  /* true kalau clip x adalah c atau keturunan c (dipakai agar tidak terjadi lingkaran induk) */
  function isDescendant(x,id){
    let c=x,n=0;
    while(c&&n++<10){if(c.id===id)return true;c=c.parent?map.get(c.parent):null}
    return false;
  }
  /* Transformasi bersama semua jenis layer. Urutan: posisi -> titik pusat (anchor) -> putar -> miring -> regang/skala -> balik.
     Titik pusat c.anchor={x,y} (px, relatif ke tengah objek) adalah poros putar dan skala. Tanpa anchor hasilnya sama persis dengan versi lama.
     k = pengali skala (scale). Mengembalikan faktor skala akhir (sumbu x dan y) untuk bayangan. */
  const rad=d=>d*Math.PI/180,tn=d=>Math.tan(rad(Math.max(-80,Math.min(80,d||0))));
  function xf(ctx,c,pr,W,H,k){
    const a=c.anchor||null,ax=a?+a.x||0:0,ay=a?+a.y||0:0;
    const sx=(pr.sx==null?1:pr.sx)*(k==null?1:k),sy=(pr.sy==null?1:pr.sy)*(k==null?1:k);
    ctx.translate(W/2+pr.x,H/2+pr.y);
    if(ax||ay)ctx.translate(ax,ay);
    ctx.rotate(rad(pr.rotation));
    if(pr.skx||pr.sky)ctx.transform(1,tn(pr.sky),tn(pr.skx),1,0,0);
    ctx.scale(sx*(c.flipX?-1:1),sy*(c.flipY?-1:1));
    if(ax||ay)ctx.translate(-ax,-ay);
    return{sx:Math.abs(sx),sy:Math.abs(sy)};
  }
  /* pusat objek di layar (offset dari tengah kanvas) setelah titik pusat/regang/miring; dipakai gizmo */
  function center(c,pr){
    const a=c.anchor;if(!a||(!a.x&&!a.y))return{x:pr.x,y:pr.y};
    const k=pr.scale,sx=(pr.sx==null?1:pr.sx)*k*(c.flipX?-1:1),sy=(pr.sy==null?1:pr.sy)*k*(c.flipY?-1:1);
    let vx=sx*(-a.x),vy=sy*(-a.y);
    if(pr.skx||pr.sky){const nx=vx+tn(pr.skx)*vy,ny=tn(pr.sky)*vx+vy;vx=nx;vy=ny}
    const r=rad(pr.rotation),cs=Math.cos(r),sn=Math.sin(r);
    return{x:pr.x+a.x+vx*cs-vy*sn,y:pr.y+a.y+vx*sn+vy*cs};
  }
  return{begin,props,local,frame,hasParent,toLocal,world,isDescendant,xf,center};
})();
