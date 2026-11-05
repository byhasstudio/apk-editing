/* Tanda Biru di clip media + JJ Tipis yang geterannya MUTER, halus, dan mengikuti tanda biru itu.
   Dimuat paling akhir (setelah js/fxclip.js, js/fxlib.js, js/fxperf.js).

   TANDA BIRU
   - Tombol "Biru" di bar timeline TIDAK lagi membuka pengaturan. Fungsinya menandai clip media (video atau foto) di posisi playhead.
     Ketuk sekali = tambah tanda, ketuk lagi di titik yang sama = hapus tanda itu. Bisa ditekan sambil video diputar untuk menandai ketukan.
   - Tombol "Hapus Biru" menghapus semua tanda biru di clip media terpilih.
   - Data ada di clip.blue = [[detikSumber, kekuatan 0..1], ...] (detik di media sumber, bukan detik timeline), jadi tanda ikut tepat saat clip digeser, dipotong, atau diubah kecepatannya.
   - Kurva biru digambar di atas clip media di timeline: tiap tanda = satu puncak.

   JJ TIPIS (dan JJ Tipis Pintar)
   - Taruh clip JJ Tipis di atas clip media. Geterannya mengikuti kurva biru clip media di bawahnya (atau clip yang dipilih lewat "Pilih clip tertentu").
     Tiap puncak kurva = satu hentakan. Di luar puncak gambar diam.
   - Gerakan MUTER: gambar bergeser mengikuti lingkaran (bukan bolak-balik satu arah), disertai putaran tipis dan zoom, semuanya dikali nilai kurva.
     Fase putarannya jalan terus dari waktu timeline dan kurvanya mulus (naik pelan, turun mulus tanpa patahan), jadi tidak kaku.
   - Kalau clip media di bawahnya belum ditandai: JJ Tipis memberi satu hentakan muter mulus di awal clip efek, JJ Tipis Pintar tetap memakai kurvanya sendiri seperti sebelumnya.
   - Parameter baru "Kecepatan putar" (0 = tidak muter). "Kecepatan kembali" mengatur seberapa cepat getaran mereda. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip,T=APK.timeline;if(!F||!F.DEF||!T)return;
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const RISE=0.06;                                            /* detik: naik ke puncak sebelum titik tanda */
  const decayOf=dec=>Math.max(0.08,0.5-0.004*(dec==null?60:dec));   /* detik: turun dari puncak sampai diam */
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2600)}
  const mediaOf=id=>{const p=P();return p?p.media.find(m=>m.id===id):null};
  const spOf=c=>c.speed||1;
  const srcAt=(c,t)=>c.reverse?c.in+c.dur*spOf(c)-(t-c.start)*spOf(c):c.in+(t-c.start)*spOf(c);
  const timeOf=(c,s)=>c.reverse?c.start+(c.in+c.dur*spOf(c)-s)/spOf(c):c.start+(s-c.in)/spOf(c);
  const isMedia=(c,tr)=>!!c&&!c.fx&&!!c.mediaId&&!!tr&&tr.kind!=='audio'&&(m=>!!m&&(m.type==='video'||m.type==='image'))(mediaOf(c.mediaId));

  /* tanda yang jatuh di dalam clip (setelah dipotong atau diubah kecepatannya), dalam detik timeline: [[waktu, kekuatan], ...] */
  function marks(c){
    const a=c.blue;if(!Array.isArray(a)||!a.length)return [];
    const lo=c.in-1e-3,hi=c.in+c.dur*spOf(c)+1e-3,out=[];
    for(const q of a){
      const s=+q[0];if(!isFinite(s)||s<lo||s>hi)continue;
      out.push([timeOf(c,s),clamp(q[1]==null?1:+q[1],0,1)]);
    }
    return out;
  }
  /* satu hentakan: naik halus ke puncak di titik tanda, lalu turun mulus (kemiringan nol di puncak dan di dasar, jadi tidak ada patahan) */
  function bump(x,D){
    if(x<-RISE||x>=D)return 0;
    return x<0?ss(1+x/RISE):1-ss(x/D);
  }
  function blueVal(c,t,D){
    let v=0;
    for(const m of marks(c)){const b=m[1]*bump(t-m[0],D);if(b>v)v=b}
    return v;
  }

  /* ===== kanvas bantu ===== */
  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    return g;
  }

  /* ===== gerakan JJ yang muter =====
     v (0..1) = nilai kurva saat ini. Geseran mengikuti lingkaran: arahnya berputar terus mengikuti waktu timeline, jaraknya = v. */
  function jolt(g,w,h,p,tm,opaque,v){
    if(v<0.003)return;
    const turns=(p.spn==null?50:p.spn)/100*6;                 /* putaran lingkaran per detik */
    const f=2*Math.PI*turns*tm+0.7;
    const A=p.amt/100*0.03*Math.min(w,h)*v;
    const dx=A*Math.cos(f),dy=A*Math.sin(f);
    const r=p.rot*Math.PI/180*v*Math.sin(f+1.2);
    /* zoom sentak, dinaikkan kalau perlu supaya geser dan putar tidak membuka tepi kosong (dihitung dari besar geseran, bukan arahnya, jadi tidak berdenyut) */
    const need=1+2*Math.max((A+Math.abs(r)*h/2+v)/w,(A+Math.abs(r)*w/2+v)/h);
    const z=Math.max(1+p.zm/100*v,need);
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.save();
    g.translate(w/2+dx,h/2+dy);g.rotate(r);g.scale(z,z);g.translate(-w/2,-h/2);
    g.drawImage(S.canvas,0,0);
    g.restore();
  }

  /* ===== mencari clip media yang ditandai di bawah clip efek ===== */
  let cur=null;   /* clip media yang sedang diolah layerEnd (efek bertarget) */
  const oLE=F.layerEnd;
  F.layerEnd=function(main,c){cur=c;try{return oLE.apply(this,arguments)}finally{cur=null}};
  /* clip efek pemilik apply ini, dicari lewat waktu mulai dan lamanya (apply tidak diberi tahu fx-nya) */
  function owner(tm,rel,dur){
    const p=P();if(!p||!(dur>0))return null;
    const s=tm-rel;
    for(let i=0;i<p.tracks.length;i++)for(const c of p.tracks[i].clips){
      if(c.fx&&(c.fx.type==='jj'||c.fx.type==='jjp')&&Math.abs(c.start-s)<1e-4&&Math.abs(c.dur-dur)<1e-4)return{c,ti:i};
    }
    return null;
  }
  function cands(own,tm){
    if(cur)return [cur];
    const p=P(),out=[];if(!p||!own)return out;
    const fx=own.c.fx,on=(c,tr)=>isMedia(c,tr)&&!tr.hidden&&tm>=c.start&&tm<c.start+c.dur-1e-6;
    if(Array.isArray(fx.targets)){
      for(const tr of p.tracks)for(const c of tr.clips)if(fx.targets.includes(c.id)&&on(c,tr))out.push(c);
    }else{
      for(let k=own.ti+1;k<p.tracks.length;k++){const tr=p.tracks[k];for(const c of tr.clips)if(on(c,tr))out.push(c)}
    }
    return out;
  }
  function mk(orig){
    return function(g,w,h,p,tm,opaque,rel,dur){
      const D=decayOf(p.dec),cs=cands(owner(tm,rel,dur),tm).filter(c=>Array.isArray(c.blue)&&c.blue.length);
      let v=null;
      if(cs.length){v=0;for(const c of cs)v=Math.max(v,blueVal(c,tm,D))}
      if(v==null){
        if(orig)return orig.apply(this,arguments);      /* JJ Tipis Pintar tanpa tanda biru: kurva miliknya seperti dulu */
        v=bump(rel-RISE,D);                             /* JJ Tipis tanpa tanda biru: satu hentakan muter di awal clip efek */
      }
      jolt(g,w,h,p,tm,opaque,v);
    };
  }
  const SPN=['spn','Kecepatan putar geteran (0 = tidak muter, makin besar makin cepat muter)',0,100,50];
  for(const id of ['jj','jjp']){
    const d=F.DEF[id];if(!d)continue;
    if(!d.params.some(q=>q[0]==='spn'))d.params.push(SPN.slice());
    d.apply=mk(id==='jjp'?d.apply:null);
  }
  if(F.DEF.jj)F.DEF.jj.desc='Hentakan zoom, geser muter, dan putar tipis yang mulus, mengikuti tanda biru di clip media';
  if(F.DEF.jjp)F.DEF.jjp.desc='Seperti JJ Tipis (mengikuti tanda biru di clip media); kalau belum ditandai memakai kurva biru miliknya sendiri';

  /* ===== tombol Biru: menandai clip media di playhead ===== */
  function target(){
    const p=P();if(!p)return null;
    const s=T.selectedClip();
    if(s&&isMedia(s.c,s.tr))return{c:s.c,tr:s.tr};
    const t=APK.preview.time;
    for(const tr of p.tracks){
      if(tr.hidden||tr.kind==='audio')continue;
      for(const c of tr.clips)if(isMedia(c,tr)&&t>=c.start&&t<c.start+c.dur-1e-6)return{c,tr};
    }
    return null;
  }
  const fmt=t=>APK.preview&&APK.preview.fmt?APK.preview.fmt(t,false):t.toFixed(2);
  function mark(){
    const z=target();
    if(!z){toast('Pilih clip video atau foto dulu, lalu taruh playhead di dalam clip');return}
    const c=z.c,t=APK.preview.time;
    if(z.tr.locked){toast('Layer terkunci. Buka kunci dulu');return}
    if(!(t>=c.start-1e-6&&t<c.start+c.dur-1e-6)){toast('Taruh playhead di dalam clip yang ditandai');return}
    const list=Array.isArray(c.blue)?c.blue:[];
    let hit=-1,best=0.08;
    list.forEach((q,i)=>{const d=Math.abs(timeOf(c,+q[0])-t);if(d<best){best=d;hit=i}});
    APK.history.record();
    if(hit>=0){c.blue=list.filter((q,i)=>i!==hit);toast('Tanda biru dihapus')}
    else{
      const s=Math.round(srcAt(c,t)*1000)/1000;
      c.blue=list.concat([[s,1]]).sort((a,b)=>a[0]-b[0]);
      toast('Tanda biru ditambahkan di '+fmt(t)+' ('+c.blue.length+' tanda di clip ini)');
    }
    if(!c.blue.length)delete c.blue;
    T.commit();
  }
  function clearMarks(){
    const z=target();
    if(!z||!Array.isArray(z.c.blue)||!z.c.blue.length){toast('Clip ini belum punya tanda biru');return}
    if(z.tr.locked){toast('Layer terkunci. Buka kunci dulu');return}
    if(!confirm('Hapus semua '+z.c.blue.length+' tanda biru di clip ini?'))return;
    APK.history.record();delete z.c.blue;T.commit();toast('Semua tanda biru dihapus');
  }
  function buttons(){
    let blu=$('tl-blu');
    if(!blu){
      const after=$('tl-ext')||$('tl-fx');if(!after)return;
      blu=document.createElement('button');blu.type='button';blu.className='btn';blu.id='tl-blu';
      blu.style.cssText='border-color:#3b82f6;color:#3b82f6;font-weight:700';
      after.after(blu);
    }
    blu.textContent='〰 Biru';
    blu.title='Tandai clip video/foto di posisi playhead (ketuk lagi di titik yang sama untuk menghapus). JJ Tipis akan menggetar mengikuti tanda ini.';
    blu.onclick=mark;
    if(!$('tl-bluclr')){
      const b=document.createElement('button');b.type='button';b.className='btn';b.id='tl-bluclr';
      b.textContent='✕ Biru';b.title='Hapus semua tanda biru di clip media terpilih';
      b.style.cssText='border-color:#3b82f6;color:#3b82f6';
      blu.after(b);b.onclick=clearMarks;
    }
  }

  /* ===== kurva biru digambar di atas clip media di timeline ===== */
  function decorate(){
    const p=P(),root=$('tl-content');if(!p||!root)return;
    const m=new Map();
    for(const tr of p.tracks)for(const c of tr.clips)if(Array.isArray(c.blue)&&c.blue.length&&isMedia(c,tr))m.set(c.id,c);
    if(!m.size)return;
    const D=decayOf(60),Y0=0.92,YH=0.8;
    root.querySelectorAll('.clip').forEach(el=>{
      const c=m.get(el.dataset.id);if(!c||el.querySelector('.bluec'))return;
      const ms=marks(c);if(!ms.length)return;
      const ts=[0,c.dur];
      for(const q of ms)for(let i=0;i<=14;i++)ts.push(q[0]-c.start-RISE+(RISE+D)*i/14);
      const pts=[...new Set(ts.map(x=>clamp(x,0,c.dur)))].sort((a,b)=>a-b);
      const L=pts.map((x,i)=>(i?'L':'M')+x.toFixed(4)+' '+(Y0-YH*blueVal(c,c.start+x,D)).toFixed(3)).join('');
      const lines=ms.filter(q=>q[0]>=c.start&&q[0]<=c.start+c.dur).map(q=>{const x=(q[0]-c.start).toFixed(4);return `<line x1="${x}" x2="${x}" y1="0.04" y2="0.98" stroke="#bfdbfe" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`}).join('');
      el.insertAdjacentHTML('beforeend',`<svg class="bluec" viewBox="0 0 ${c.dur} 1" preserveAspectRatio="none" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2;overflow:visible"><path d="${L}L${c.dur} ${Y0}L0 ${Y0}Z" fill="rgba(59,130,246,0.28)" stroke="none"/><path d="${L}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${lines}</svg>`);
    });
  }
  if(APK.properties){
    const oldRefresh=APK.properties.refresh;
    APK.properties.refresh=function(){const r=oldRefresh.apply(this,arguments);try{decorate()}catch(e){console.error('Kurva biru gagal digambar',e)}return r};
  }
  try{buttons()}catch(e){console.error('Tombol biru gagal dimuat',e)}
  try{T.render()}catch(_){}
})();
