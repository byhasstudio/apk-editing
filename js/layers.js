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
  return{begin,props,local,frame,hasParent,toLocal,world,isDescendant};
})();
