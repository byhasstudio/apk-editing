/* Motion path: jalur gerak objek. Data per clip: clip.mp = { on, pts:[[x,y],...], smooth, ease, orient }
   Titik jalur adalah offset (px, di ruang induk) yang ditambahkan ke posisi X/Y clip. Kecepatan konstan di sepanjang jalur. */
window.APK=window.APK||{};
APK.motion=(function(){
  const cache=new Map();
  function build(mp){
    const key=(mp.smooth===false?'L':'S')+JSON.stringify(mp.pts);
    let s=cache.get(key);if(s)return s;
    const P=mp.pts,n=P.length,pts=[],len=[0];
    if(mp.smooth===false){for(const p of P)pts.push([p[0],p[1]])}
    else{
      /* Catmull-Rom: kurva halus melewati semua titik */
      for(let i=0;i<n-1;i++){
        const p0=P[Math.max(0,i-1)],p1=P[i],p2=P[i+1],p3=P[Math.min(n-1,i+2)],N=24;
        for(let k=0;k<N;k++){
          const t=k/N,t2=t*t,t3=t2*t,f=a=>0.5*((2*p1[a])+(-p0[a]+p2[a])*t+(2*p0[a]-5*p1[a]+4*p2[a]-p3[a])*t2+(-p0[a]+3*p1[a]-3*p2[a]+p3[a])*t3);
          pts.push([f(0),f(1)]);
        }
      }
      pts.push([P[n-1][0],P[n-1][1]]);
    }
    for(let i=1;i<pts.length;i++)len.push(len[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    s={pts,len,total:len[len.length-1]};
    if(cache.size>100)cache.clear();
    cache.set(key,s);return s;
  }
  /* titik di jalur pada progres u (0..1) beserta arah gerak (derajat) */
  function at(mp,u){
    const s=build(mp);u=Math.min(1,Math.max(0,u));
    if(s.total<1e-6)return{x:s.pts[0][0],y:s.pts[0][1],angle:0};
    const d=u*s.total;let lo=0,hi=s.len.length-1;
    while(hi-lo>1){const m=(lo+hi)>>1;if(s.len[m]<=d)lo=m;else hi=m}
    const a=s.pts[lo],b=s.pts[hi],seg=s.len[hi]-s.len[lo]||1,f=(d-s.len[lo])/seg;
    return{x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,angle:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI};
  }
  const samples=mp=>build(mp).pts;
  return{at,samples};
})();
