/* Preview: render komposisi timeline ke canvas, playback, sinkron dengan playhead
   Perbaikan performa:
   - media di-load dan di-seek lebih awal (prefetch), jadi audio/video tidak telat saat clip mulai
   - play() menunggu media clip yang sedang tampil siap; sinkron suara memakai penyesuaian kecepatan halus, bukan seek paksa
   - update UI (waktu, playhead, gizmo) dibatasi saat playback dan dilewati saat export
   - gambar dibatasi sesuai fps project (export: fps export) supaya tidak menggambar lebih banyak dari yang perlu */
window.APK=window.APK||{};
APK.preview=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  /* layar sentuh (HP/tablet): kanvas preview dibatasi lebih kecil supaya playback ringan; export tetap resolusi penuh */
  const COARSE=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),PV_MAX=COARSE?960:1280,PF_AHEAD=3;
  let canvas,ctx,t=0,playing=false,starting=false,base=0,t0=0,raf=0,vol=1,K=1,hook=null,onEnd=null,exporting=false,expFps=0,lastDraw=0,lastUI=0,lastGC=0,lastPF=0;
  const els=new Map(),bmap=new Map();
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const mediaOf=id=>P().media.find(m=>m.id===id);
  /* kotak objek di koordinat project (dipakai gizmo untuk memilih dan memindah objek) */
  /* w dan h = ukuran dasar (sudah dikali scale); regang (sx, sy) dan titik pusat ikut dihitung di sini */
  const mark=(c,pr,W,H,w,h)=>{const q=APK.layers.center(c,pr);bmap.set(c.id,{cx:W/2+q.x,cy:H/2+q.y,w:w*(pr.sx==null?1:pr.sx),h:h*(pr.sy==null?1:pr.sy),rot:pr.rotation})};
  function fmt(s,short){s=Math.max(0,s);const m=Math.floor(s/60);
    return short?m+':'+String(Math.floor(s%60)).padStart(2,'0'):String(m).padStart(2,'0')+':'+(s%60).toFixed(2).padStart(5,'0')}
  function duration(){let d=0;if(!P())return 0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}
  /* clip yang memakai elemen media (video, audio, gambar): bukan clip efek, teks, atau bentuk */
  const isMedia=c=>!!c.mediaId&&!c.fx&&!c.text&&!c.shape;

  function getEl(clip){
    let e=els.get(clip.id);if(e)return e;
    const m=mediaOf(clip.mediaId);if(!m)return null;
    const el=m.type==='image'?new Image():document.createElement(m.type);
    e={el,type:m.type,ready:false,gone:false,posed:false};
    e.wait=new Promise(res=>{e.done=res});   /* terpenuhi kalau media siap diputar (atau gagal), dipakai warm() */
    els.set(clip.id,e);
    const fin=()=>e.done();
    if(m.type==='image'){
      el.onload=()=>{e.ready=true;fin();if(!playing)draw()};
      el.onerror=fin;
    }else{
      el.preload='auto';el.playsInline=true;
      el.onloadeddata=()=>{e.ready=true;if(!playing)draw()};
      el.oncanplay=fin;el.onerror=fin;
      el.onseeked=()=>{if(!playing||e.rev)draw()};
    }
    if(hook&&m.type!=='image')hook(el);
    APK.media.getUrl(m.id).then(u=>{if(u&&!e.gone)el.src=u;else fin()});
    return e;
  }
  function release(id){
    const e=els.get(id);if(!e)return;
    e.gone=true;e.done();
    if(e.type!=='image'){e.el.pause();e.el.removeAttribute('src');e.el.load()}else e.el.removeAttribute('src');
    els.delete(id);
  }
  /* muat lebih awal clip yang akan tampil dalam `ahead` detik, lalu taruh posisinya di titik awal clip supaya langsung bisa diputar tanpa seek */
  function prefetch(tm,ahead){
    const p=P();if(!p)return;
    for(const tr of p.tracks){
      if(tr.hidden)continue;
      for(const c of tr.clips){
        if(!isMedia(c)||c.start>tm+ahead||c.start+c.dur<=tm)continue;
        const e=getEl(c);if(!e)continue;
        if(!e.ready||e.type==='image'||e.posed||tm>=c.start)continue;   /* yang sedang tampil diurus frame() */
        if(c.reverse&&e.type==='video'&&tr.kind!=='audio')continue;
        e.posed=true;
        if(Math.abs(e.el.currentTime-c.in)>0.05)e.el.currentTime=c.in;
      }
    }
  }
  /* true kalau semua media clip yang tampil di waktu tm sudah siap, jadi play() bisa langsung jalan tanpa menunggu */
  function allReady(tm){
    const p=P();
    for(const tr of p.tracks){
      if(tr.hidden)continue;
      for(const c of tr.clips){
        if(!isMedia(c)||tm<c.start||tm>=c.start+c.dur-1e-6||!mediaOf(c.mediaId))continue;
        const e=els.get(c.id);
        if(!e||!e.ready||(e.type!=='image'&&e.el.seeking))return false;
      }
    }
    return true;
  }
  /* siapkan media (dipakai play() dan export): buat elemen, tunggu siap, tunggu seek selesai. limit = batas tunggu (ms) supaya tidak macet */
  async function warm(tm,ahead,limit){
    const p=P();if(!p||!ctx)return;
    draw();
    prefetch(tm,ahead);
    const pend=()=>{
      const a=[];
      for(const tr of p.tracks){
        if(tr.hidden)continue;
        for(const c of tr.clips){
          if(!isMedia(c)||c.start>tm+ahead||c.start+c.dur<=tm)continue;
          const e=els.get(c.id);if(e)a.push(e);
        }
      }
      return a;
    };
    await Promise.race([Promise.all(pend().map(e=>e.wait)),sleep(limit)]);
    if(!P())return;
    prefetch(tm,ahead);draw();
    const list=pend(),end=performance.now()+600;
    while(list.some(e=>e.type!=='image'&&e.el.seeking)&&performance.now()<end)await sleep(16);
    if(P()&&!playing)draw();
  }
  function frame(){
    const p=P(),W=p.width,H=p.height,FX=APK.fxclip,ft=FX?FX.targets(p,t):null,now=performance.now();
    bmap.clear();
    APK.layers.begin();
    ctx.setTransform(K,0,0,K,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    /* bersihkan elemen clip yang sudah dihapus: saat playback cukup tiap setengah detik */
    if(!playing||now-lastGC>500){
      lastGC=now;
      const live=new Set();
      for(const tr of p.tracks)for(const c of tr.clips)live.add(c.id);
      for(const id of [...els.keys()])if(!live.has(id))release(id);
    }
    if(playing&&now-lastPF>250){lastPF=now;prefetch(t,PF_AHEAD)}
    for(let i=p.tracks.length-1;i>=0;i--){
      const tr=p.tracks[i];
      if(tr.hidden){
        for(const c of tr.clips){const e=els.get(c.id);if(e&&e.type!=='image'&&!e.el.paused)e.el.pause()}
        continue;
      }
      for(const c of tr.clips){
        const active=t>=c.start&&t<c.start+c.dur-1e-6;
        if(!active){
          const e=els.get(c.id);
          if(e){if(e.type!=='image'&&!e.el.paused)e.el.pause();
            if(t<c.start-5||t>c.start+c.dur+5)release(c.id)}
          continue;
        }
        /* clip efek (js/fxclip.js): tanpa target = mengolah semua yang sudah tergambar di bawahnya; yang bertarget diterapkan per clip di bawah */
        if(c.fx){if(FX&&!Array.isArray(c.fx.targets))FX.run(ctx,c.fx,t,true);continue}
        const E=APK.effects,fl=ft&&ft.get(c.id)||null,main=ctx;
        let drew=false;
        /* clip yang dituju efek digambar dulu ke lapisan terpisah, efek diterapkan ke lapisan itu, lalu ditempel ke kanvas utama */
        if(fl)ctx=FX.layerBegin(main,K);
        try{
          if(c.text){
            const pr=APK.layers.props(c,t),sc=Math.max(0,pr.scale),q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
            drew=true;
            const b=APK.text.draw(ctx,c,q,W,H);
            if(E)E.end(ctx);
            mark(c,pr,W,H,b.w*sc,b.h*sc);continue;
          }
          if(c.shape){
            const pr=APK.layers.props(c,t),sc=Math.max(0,pr.scale),q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
            drew=true;
            const b=APK.shapes.draw(ctx,c,q,W,H);
            if(E)E.end(ctx);
            mark(c,pr,W,H,b.w*sc,b.h*sc);continue;
          }
          const e=getEl(c);if(!e||!e.ready)continue;
          const pr=APK.layers.props(c,t),sp=Math.min(16,Math.max(0.0625,c.speed||1)),
            rev=!!c.reverse&&e.type==='video'&&tr.kind!=='audio',
            src=rev?c.in+c.dur*sp-(t-c.start)*sp:c.in+(t-c.start)*sp;
          e.rev=rev;
          if(e.type!=='image'){
            const el=e.el,rl=t-c.start,fi=c.fadeIn||0,fo=c.fadeOut||0;
            let fg=1;
            if(fi>0)fg=Math.min(fg,rl/fi);
            if(fo>0)fg=Math.min(fg,(c.dur-rl)/fo);
            fg=Math.min(1,Math.max(0,fg));
            el.volume=Math.min(1,Math.max(0,pr.volume*vol*fg));
            el.muted=!!tr.muted||!!c.mute||rev;
            let rate=sp;
            if(el.paused&&el.playbackRate!==sp)el.playbackRate=sp;
            if(rev){
              if(!el.paused)el.pause();
              if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
            }else if(playing){
              if(el.paused){
                /* clip baru mulai: kalau sudah di titik awalnya (hasil prefetch) tidak perlu seek lagi, jadi suara langsung keluar */
                if(Math.abs(el.currentTime-src)>0.08)el.currentTime=src;
                el.play().catch(()=>{});
              }else{
                /* selisih kecil dikejar dengan mengubah kecepatan sedikit (halus); seek paksa hanya kalau selisihnya besar */
                const d=el.currentTime-src;
                if(Math.abs(d)>0.35)el.currentTime=src;
                else if(d<-0.05)rate=sp*1.08;
                else if(d>0.05)rate=sp*0.92;
              }
            }else{
              if(!el.paused)el.pause();
              if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
            }
            rate=Math.min(16,Math.max(0.0625,rate));
            if(el.playbackRate!==rate)el.playbackRate=rate;
          }
          if(tr.kind==='audio')continue;
          const w=e.type==='image'?e.el.naturalWidth:e.el.videoWidth,h=e.type==='image'?e.el.naturalHeight:e.el.videoHeight;
          if(!w||!h)continue;
          const fit=Math.min(W/w,H/h),s=fit*Math.max(0,pr.scale),fxc=APK.fx.process(e.el,w,h,c);
          mark(c,pr,W,H,w*s,h*s);
          const q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
          drew=true;
          ctx.save();
          ctx.globalAlpha=Math.min(1,Math.max(0,q.opacity));
          ctx.globalCompositeOperation=c.blend||'source-over';
          APK.layers.xf(ctx,c,q,W,H,Math.max(0,q.scale));
          ctx.drawImage(fxc||e.el,-w*fit/2,-h*fit/2,w*fit,h*fit);
          ctx.restore();
          if(E)E.end(ctx);
        }finally{
          if(fl){ctx=main;if(drew)FX.layerEnd(main,c,fl,t)}
        }
      }
    }
  }
  /* update UI di luar canvas: waktu, playhead, panel properti, gizmo. Saat playback dibatasi sekitar 30x per detik. */
  function ui(){
    const n=performance.now();
    if(playing&&n-lastUI<33)return;
    lastUI=n;
    $('pv-time').textContent=fmt(t)+' / '+fmt(duration());
    APK.timeline.setPlayhead(t);
    if(APK.properties&&APK.properties.tick)APK.properties.tick();
    if(APK.gizmo)APK.gizmo.draw();
  }
  function draw(){
    if(!P()||!ctx)return;
    frame();
    if(!exporting)ui();   /* selama export UI tidak perlu diperbarui (progres ada di dialog export) */
  }
  function loop(){
    if(!playing)return;
    const n=performance.now();
    t=base+(n-t0)/1000;
    const d=duration();
    if(t>=d){t=d;pause();if(onEnd)onEnd();return}
    /* jangan menggambar lebih sering dari fps project (export: fps export), terutama di layar 90/120 Hz */
    const fps=(exporting&&expFps)||(P()&&P().fps)||30;
    if(n-lastDraw>=1000/fps*0.7){lastDraw=n;draw()}
    raf=requestAnimationFrame(loop);
  }
  function begin(){
    playing=true;base=t;t0=performance.now();lastDraw=0;lastPF=0;
    $('pv-play').textContent='❚❚';loop();
  }
  /* mengembalikan Promise; kalau media sudah siap, playback mulai seketika (sinkron) */
  function play(){
    if(!P()||!duration()||playing||starting)return Promise.resolve();
    if(t>=duration()-0.01)t=0;
    if(allReady(t)){begin();return Promise.resolve()}
    starting=true;$('pv-play').textContent='❚❚';
    return warm(t,PF_AHEAD,2500).then(()=>{if(!starting)return;starting=false;begin()});
  }
  function pause(){
    playing=false;starting=false;cancelAnimationFrame(raf);
    els.forEach(e=>{if(e.type!=='image')e.el.pause()});
    $('pv-play').textContent='▶';draw();
  }
  const toggle=()=>(playing||starting)?pause():play();
  function stop(){pause();seek(0)}
  function seek(x){
    t=Math.max(0,Math.min(x,Math.max(duration(),0)));
    if(playing){base=t;t0=performance.now()}
    draw();
  }
  function resize(){
    const p=P();K=Math.min(1,PV_MAX/Math.max(p.width,p.height));
    canvas.width=Math.round(p.width*K);canvas.height=Math.round(p.height*K);
    $('project-meta').textContent=`${p.width}×${p.height} · ${p.fps} fps · ${p.aspect}`;
  }
  function beginExport(w,h,hk,cb,fps){
    exporting=true;expFps=+fps||0;unload();hook=hk;onEnd=cb;K=w/P().width;canvas.width=w;canvas.height=h;
    draw();if(APK.gizmo)APK.gizmo.draw();   /* gizmo ikut dibersihkan */
  }
  function endExport(){exporting=false;expFps=0;unload();hook=null;onEnd=null;resize();draw()}
  function init(){
    canvas=$('pv-canvas');ctx=canvas.getContext('2d',{alpha:false});
    $('pv-play').onclick=toggle;$('pv-stop').onclick=stop;
    $('pv-vol').oninput=e=>{vol=+e.target.value;draw()};
    $('pv-full').onclick=()=>{const w=$('preview-wrap');document.fullscreenElement?document.exitFullscreen():w.requestFullscreen&&w.requestFullscreen()};
    $('pv-aspect').onchange=e=>{APK.project.setAspect(e.target.value);resize();draw()};
  }
  function load(){t=0;playing=false;starting=false;$('pv-aspect').value=P().aspect;$('pv-play').textContent='▶';resize();draw()}
  function unload(){playing=false;starting=false;cancelAnimationFrame(raf);for(const id of [...els.keys()])release(id)}
  return{init,load,unload,beginExport,endExport,warm,refresh:draw,seek,play,pause,toggle,stop,fmt,bounds:id=>bmap.get(id),
    get exporting(){return exporting},get time(){return t},get playing(){return playing},get duration(){return duration()}};
})();
