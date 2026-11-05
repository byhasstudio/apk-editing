/* Preview: render komposisi timeline ke canvas, playback, sinkron dengan playhead.
   Performa (v22):
   - clip yang akan tampil dalam 1,5 detik disiapkan lebih dulu (dimuat dan diposisikan), jadi audio dan video tidak telat mulai
   - audio disinkronkan lembut (kecepatan putar disesuaikan sedikit) dan jeda start play() dipelajari otomatis, jadi tidak ada delay audio
   - kualitas preview menyesuaikan diri: kalau perangkat tidak kuat, fps dan resolusi preview turun sendiri (hasil export tidak terpengaruh)
   - pembaruan antarmuka (waktu, playhead, gizmo) dibatasi saat memutar
   - export presisi: prepare() dan exportFrame() merender frame demi frame tanpa bergantung pada kecepatan perangkat */
window.APK=window.APK||{};
APK.preview=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  let canvas,ctx,t=0,playing=false,base=0,t0=0,raf=0,vol=1,K=1,hook=null,onEnd=null,exporting=false,off=false,offFps=30;
  const els=new Map(),bmap=new Map();
  const LOOK=1.5;                                                   /* detik: clip yang mulai dalam waktu ini disiapkan lebih awal */
  const LV=[[60,1],[30,1],[30,0.75],[24,0.6],[24,0.45]];            /* tingkat kualitas preview: [fps maksimum, skala resolusi] */
  let lat=0.1,lv=0,Q=1,ema=0,dema=0,slow=0,fast=0,nextDraw=0,lastUi=0,gcN=0,needResize=false;
  const clampN=(v,a,b)=>Math.min(b,Math.max(a,v));
  const mediaOf=id=>P().media.find(m=>m.id===id);
  const capFps=()=>{const p=P();return Math.max(10,Math.min(LV[lv][0],(p&&p.fps)||30))};
  /* kotak objek di koordinat project (dipakai gizmo untuk memilih dan memindah objek) */
  /* w dan h = ukuran dasar (sudah dikali scale); regang (sx, sy) dan titik pusat ikut dihitung di sini */
  const mark=(c,pr,W,H,w,h)=>{const q=APK.layers.center(c,pr);bmap.set(c.id,{cx:W/2+q.x,cy:H/2+q.y,w:w*(pr.sx==null?1:pr.sx),h:h*(pr.sy==null?1:pr.sy),rot:pr.rotation})};
  function fmt(s,short){s=Math.max(0,s);const m=Math.floor(s/60);
    return short?m+':'+String(Math.floor(s%60)).padStart(2,'0'):String(m).padStart(2,'0')+':'+(s%60).toFixed(2).padStart(5,'0')}
  function duration(){let d=0;if(!P())return 0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}

  function getEl(clip){
    let e=els.get(clip.id);if(e)return e;
    const m=mediaOf(clip.mediaId);if(!m)return null;
    const el=m.type==='image'?new Image():document.createElement(m.type);
    e={el,type:m.type,ready:false,gone:false,failed:false,pre:false,playAt:0,seekAt:0,rev:false};
    e.readyP=new Promise(r=>{e.res=r});
    els.set(clip.id,e);
    const done=()=>{if(e.gone)return;e.ready=true;e.res();if(!off&&!playing)draw()};
    if(m.type==='image')el.onload=done;
    else{
      el.preload='auto';el.playsInline=true;
      el.onloadeddata=done;
      el.onseeked=()=>{if(!off&&(!playing||e.rev))draw()};
      /* jeda antara play() dipanggil dan suara benar-benar jalan; dipakai untuk memajukan titik mulai media */
      el.onplaying=()=>{if(e.playAt){const d=(performance.now()-e.playAt)/1000;e.playAt=0;if(d>=0&&d<0.6)lat=clampN(lat*0.6+d*0.4,0.02,0.3)}};
    }
    el.onerror=()=>{if(e.gone)return;e.failed=true;e.res()};
    if(hook&&m.type!=='image')hook(el);
    APK.media.getUrl(m.id).then(u=>{if(e.gone)return;if(u)el.src=u;else{e.failed=true;e.res()}});
    return e;
  }
  function release(id){
    const e=els.get(id);if(!e)return;
    e.gone=true;e.res();
    if(e.type!=='image'){e.el.pause();e.el.removeAttribute('src');e.el.load()}else e.el.removeAttribute('src');
    els.delete(id);
  }
  /* siapkan clip yang akan mulai sebentar lagi: muat media dan taruh di titik mulainya, supaya play() nanti langsung jalan */
  function pre(c,tr){
    const m=mediaOf(c.mediaId);if(!m)return;
    const e=getEl(c);if(!e||e.type==='image'||e.failed)return;
    if(!e.ready||e.pre||!e.el.paused)return;
    const sp=Math.min(16,Math.max(0.0625,c.speed||1)),rev=!!c.reverse&&e.type==='video'&&tr.kind!=='audio',
      x=rev?c.in+c.dur*sp:c.in+lat*sp;
    if(Math.abs(e.el.currentTime-x)>0.04)e.el.currentTime=x;
    e.pre=true;
  }
  function frame(){
    const p=P(),W=p.width,H=p.height,FX=APK.fxclip,ft=FX?FX.targets(p,t):null;
    bmap.clear();
    APK.layers.begin();
    ctx.setTransform(K,0,0,K,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    /* membuang elemen clip yang sudah dihapus: cukup sesekali saat memutar */
    if(!playing||++gcN%20===0){
      const live=new Set();
      for(const tr of p.tracks)for(const c of tr.clips)live.add(c.id);
      for(const id of [...els.keys()])if(!live.has(id))release(id);
    }
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
          if(e){
            if(e.type!=='image'&&!e.el.paused)e.el.pause();
            if(off?(t>c.start+c.dur+0.25||t<c.start-1):(t<c.start-5||t>c.start+c.dur+5))release(c.id);
          }
          if(playing&&c.mediaId&&c.start>t&&c.start-t<LOOK)pre(c,tr);
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
          /* export presisi: audio dicampur terpisah, jadi clip audio tidak perlu elemennya */
          if(off){const mo=mediaOf(c.mediaId);if(tr.kind==='audio'||!mo||mo.type==='audio')continue}
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
            el.muted=!!tr.muted||!!c.mute||rev||off;
            if(!off){
              const now=performance.now();
              if(rev){
                if(el.playbackRate!==sp)el.playbackRate=sp;
                if(!el.paused)el.pause();
                if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
              }else if(playing){
                const want=src+lat*sp;
                if(el.paused){
                  /* mulai: majukan titik mulai sebesar jeda play() supaya suara tepat waktu */
                  e.pre=false;e.playAt=now;e.seekAt=now;
                  if(el.playbackRate!==sp)el.playbackRate=sp;
                  if(Math.abs(el.currentTime-want)>0.03)el.currentTime=want;
                  el.play().catch(()=>{});
                }else if(!el.seeking&&el.readyState>=2){
                  /* sedang jalan: selisih kecil dikoreksi lewat kecepatan putar (tanpa lompatan), selisih besar baru loncat */
                  const dr=el.currentTime-src,ad=Math.abs(dr);
                  let rate=sp;
                  if(ad>0.3){if(now-e.seekAt>600){e.seekAt=now;el.currentTime=want}}
                  else if(ad>0.04)rate=sp*(1-clampN(dr*0.6,-0.1,0.1));
                  if(Math.abs(el.playbackRate-rate)>0.004)el.playbackRate=rate;
                }
              }else{
                if(!el.paused)el.pause();
                if(el.playbackRate!==sp)el.playbackRate=sp;
                if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
              }
            }
          }
          if(tr.kind==='audio')continue;
          const w=e.type==='image'?e.el.naturalWidth:e.el.videoWidth,h=e.type==='image'?e.el.naturalHeight:e.el.videoHeight;
          if(!w||!h)continue;
          const fit=Math.min(W/w,H/h),s=fit*Math.max(0,pr.scale),
            fxc=APK.fx.process(e.el,w,h,c,Math.ceil(Math.max(W,H)*K*clampN(pr.scale,1,2)));
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
  /* live = dipanggil dari loop playback: antarmuka (waktu, playhead, gizmo) tidak perlu diperbarui di setiap frame */
  function draw(live){
    if(!P()||!ctx)return;
    frame();
    if(live){
      const n=performance.now();
      if(n-lastUi<(exporting?250:50))return;
      lastUi=n;
    }
    $('pv-time').textContent=fmt(t)+' / '+fmt(duration());
    APK.timeline.setPlayhead(t);
    if(APK.properties&&APK.properties.tick)APK.properties.tick();
    if(APK.gizmo)APK.gizmo.draw();
  }
  /* kualitas adaptif: ms = lama menggambar satu frame, di = jarak antar frame yang tergambar */
  function adapt(ms,di){
    ema=ema?ema*0.85+ms*0.15:ms;
    if(di<250)dema=dema?dema*0.85+di*0.15:di;
    const bud=1000/capFps();
    if(lv<LV.length-1&&(ema>bud*0.85||dema>bud*1.3)){
      if(++slow>=15){lv++;slow=0;fast=0;ema=0;dema=0;needResize=true}
    }else slow=0;
    if(lv>0&&ema<bud*0.3&&dema<bud*1.15){
      if(++fast>=150){lv--;fast=0;slow=0;ema=0;dema=0;needResize=true}
    }else fast=0;
  }
  function loop(){
    if(!playing)return;
    const n=performance.now();
    t=base+(n-t0)/1000;
    const d=duration();
    if(t>=d){t=d;pause();if(onEnd)onEnd();return}
    if(exporting||n>=nextDraw-2){
      const iv=1000/capFps();
      const di=nextDraw?n-(nextDraw-iv):iv;
      nextDraw+=iv;if(nextDraw<n)nextDraw=n+iv*0.1;
      if(needResize&&!exporting){needResize=false;Q=LV[lv][1];resize()}
      draw(true);
      if(!exporting)adapt(performance.now()-n,di);
    }
    raf=requestAnimationFrame(loop);
  }
  function play(){
    if(!P()||!duration())return;
    if(t>=duration()-0.01)t=0;
    playing=true;
    if(!exporting&&Q!==LV[lv][1]){Q=LV[lv][1];resize()}
    base=t;t0=performance.now();nextDraw=0;ema=0;dema=0;slow=0;fast=0;
    $('pv-play').textContent='❚❚';loop();
  }
  function pause(){
    playing=false;cancelAnimationFrame(raf);
    els.forEach(e=>{if(e.type!=='image')e.el.pause()});
    $('pv-play').textContent='▶';
    if(Q!==1&&!exporting){Q=1;resize()}   /* saat berhenti, tampil dengan kualitas penuh */
    draw();
  }
  const toggle=()=>playing?pause():play();
  function stop(){pause();seek(0)}
  function seek(x){
    t=Math.max(0,Math.min(x,Math.max(duration(),0)));
    if(playing){base=t;t0=performance.now()}
    draw();
  }
  function resize(){
    const p=P();if(!p||!canvas)return;
    K=Math.min(1,1280/Math.max(p.width,p.height))*(exporting?1:Q);
    canvas.width=Math.max(1,Math.round(p.width*K));canvas.height=Math.max(1,Math.round(p.height*K));
    $('project-meta').textContent=`${p.width}×${p.height} · ${p.fps} fps · ${p.aspect}`;
  }
  /* export real-time (mode cepat) */
  function beginExport(w,h,hk,cb){exporting=true;off=false;unload();hook=hk;onEnd=cb;K=w/P().width;canvas.width=w;canvas.height=h;draw()}
  /* export presisi: tidak ada pemutaran; tiap frame disiapkan lewat prepare() lalu digambar lewat exportFrame() */
  function beginOffline(w,h,fps){exporting=true;off=true;offFps=fps||30;unload();hook=null;onEnd=null;K=w/P().width;canvas.width=w;canvas.height=h}
  function endExport(){exporting=false;off=false;unload();hook=null;onEnd=null;Q=1;resize();draw()}
  const sleepP=ms=>new Promise(r=>setTimeout(r,ms));
  function seekEl(el,x){
    return new Promise(res=>{
      let done=false,tm=0;
      const f=()=>{if(done)return;done=true;clearTimeout(tm);el.removeEventListener('seeked',f);res()};
      tm=setTimeout(f,3000);
      el.addEventListener('seeked',f);
      el.currentTime=x;
    });
  }
  async function prepOne(e,c,tt,tol){
    if(!e.ready){
      await Promise.race([e.readyP,sleepP(20000)]);
      if(!e.ready){e.failed=true;return}
    }
    if(e.type==='image')return;
    const sp=Math.min(16,Math.max(0.0625,c.speed||1)),el=e.el,
      rev=!!c.reverse&&e.type==='video',
      src=rev?c.in+c.dur*sp-(tt-c.start)*sp:c.in+(tt-c.start)*sp,
      x=Math.max(0,Math.min(src,(isFinite(el.duration)&&el.duration>0?el.duration:1e9)-0.001));
    if(Math.abs(el.currentTime-x)>tol)await seekEl(el,x);
  }
  /* muat semua media yang tampil di waktu tt dan taruh tepat di frame yang benar (full = termasuk clip audio, untuk export real-time) */
  async function prepare(tt,full){
    const p=P(),jobs=[];
    t=tt;
    for(const tr of p.tracks){
      if(tr.hidden)continue;
      if(tr.kind==='audio'&&!full)continue;
      for(const c of tr.clips){
        if(c.fx||c.text||c.shape||!c.mediaId)continue;
        if(!(tt>=c.start&&tt<c.start+c.dur-1e-6))continue;
        const m=mediaOf(c.mediaId);if(!m||(m.type==='audio'&&!full))continue;
        const e=getEl(c);if(!e||e.failed)continue;
        jobs.push(prepOne(e,c,tt,full?0.03:0.5/offFps));
      }
    }
    await Promise.all(jobs);
  }
  function exportFrame(tt){t=tt;frame()}
  function init(){
    canvas=$('pv-canvas');ctx=canvas.getContext('2d');
    $('pv-play').onclick=toggle;$('pv-stop').onclick=stop;
    $('pv-vol').oninput=e=>{vol=+e.target.value;draw()};
    $('pv-full').onclick=()=>{const w=$('preview-wrap');document.fullscreenElement?document.exitFullscreen():w.requestFullscreen&&w.requestFullscreen()};
    $('pv-aspect').onchange=e=>{APK.project.setAspect(e.target.value);resize();draw()};
  }
  function load(){t=0;playing=false;Q=1;lv=0;needResize=false;$('pv-aspect').value=P().aspect;$('pv-play').textContent='▶';resize();draw()}
  function unload(){playing=false;cancelAnimationFrame(raf);for(const id of [...els.keys()])release(id)}
  return{init,load,unload,beginExport,beginOffline,endExport,prepare,exportFrame,refresh:()=>draw(),seek,play,pause,toggle,stop,fmt,bounds:id=>bmap.get(id),
    get exporting(){return exporting},get time(){return t},get playing(){return playing},get duration(){return duration()}};
})();
