/* Preview: render komposisi timeline ke canvas, playback, sinkron dengan playhead */
window.APK=window.APK||{};
APK.preview=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  let canvas,ctx,t=0,playing=false,base=0,t0=0,raf=0,vol=1,K=1,hook=null,onEnd=null;
  const els=new Map();
  const mediaOf=id=>P().media.find(m=>m.id===id);
  function fmt(s,short){s=Math.max(0,s);const m=Math.floor(s/60);
    return short?m+':'+String(Math.floor(s%60)).padStart(2,'0'):String(m).padStart(2,'0')+':'+(s%60).toFixed(2).padStart(5,'0')}
  function duration(){let d=0;if(!P())return 0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}

  function getEl(clip){
    let e=els.get(clip.id);if(e)return e;
    const m=mediaOf(clip.mediaId);if(!m)return null;
    const el=m.type==='image'?new Image():document.createElement(m.type);
    e={el,type:m.type,ready:false,gone:false};els.set(clip.id,e);
    if(m.type==='image')el.onload=()=>{e.ready=true;draw()};
    else{el.preload='auto';el.playsInline=true;el.onloadeddata=()=>{e.ready=true;draw()};el.onseeked=()=>{if(!playing)draw()}}
    if(hook&&m.type!=='image')hook(el);
    APK.media.getUrl(m.id).then(u=>{if(u&&!e.gone)el.src=u});
    return e;
  }
  function release(id){
    const e=els.get(id);if(!e)return;
    e.gone=true;
    if(e.type!=='image'){e.el.pause();e.el.removeAttribute('src');e.el.load()}else e.el.removeAttribute('src');
    els.delete(id);
  }
  function frame(){
    const p=P(),W=p.width,H=p.height;
    ctx.setTransform(K,0,0,K,0,0);ctx.globalAlpha=1;
    ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
    const live=new Set();
    for(const tr of p.tracks)for(const c of tr.clips)live.add(c.id);
    for(const id of [...els.keys()])if(!live.has(id))release(id);
    for(let i=p.tracks.length-1;i>=0;i--){
      const tr=p.tracks[i];
      for(const c of tr.clips){
        const active=t>=c.start&&t<c.start+c.dur-1e-6;
        if(!active){
          const e=els.get(c.id);
          if(e){if(e.type!=='image'&&!e.el.paused)e.el.pause();
            if(t<c.start-5||t>c.start+c.dur+5)release(c.id)}
          continue;
        }
        const e=getEl(c);if(!e||!e.ready)continue;
        const pr=c.props||{},src=c.in+(t-c.start);
        if(e.type!=='image'){
          const el=e.el;
          el.volume=Math.min(1,Math.max(0,(pr.volume==null?1:pr.volume)*vol));el.muted=!!tr.muted;
          if(playing){
            if(el.paused){el.currentTime=src;el.play().catch(()=>{})}
            else if(Math.abs(el.currentTime-src)>0.3)el.currentTime=src;
          }else{
            if(!el.paused)el.pause();
            if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
          }
        }
        if(tr.kind==='audio')continue;
        const w=e.type==='image'?e.el.naturalWidth:e.el.videoWidth,h=e.type==='image'?e.el.naturalHeight:e.el.videoHeight;
        if(!w||!h)continue;
        const s=Math.min(W/w,H/h)*(pr.scale==null?1:pr.scale);
        ctx.save();
        ctx.globalAlpha=pr.opacity==null?1:pr.opacity;
        ctx.translate(W/2+(pr.x||0),H/2+(pr.y||0));
        ctx.rotate((pr.rotation||0)*Math.PI/180);
        ctx.drawImage(e.el,-w*s/2,-h*s/2,w*s,h*s);
        ctx.restore();
      }
    }
  }
  function draw(){
    if(!P()||!ctx)return;
    frame();
    $('pv-time').textContent=fmt(t)+' / '+fmt(duration());
    APK.timeline.setPlayhead(t);
  }
  function loop(){
    if(!playing)return;
    t=base+(performance.now()-t0)/1000;
    const d=duration();
    if(t>=d){t=d;pause();if(onEnd)onEnd();return}
    draw();raf=requestAnimationFrame(loop);
  }
  function play(){
    if(!P()||!duration())return;
    if(t>=duration()-0.01)t=0;
    playing=true;base=t;t0=performance.now();
    $('pv-play').textContent='❚❚';loop();
  }
  function pause(){
    playing=false;cancelAnimationFrame(raf);
    els.forEach(e=>{if(e.type!=='image')e.el.pause()});
    $('pv-play').textContent='▶';draw();
  }
  const toggle=()=>playing?pause():play();
  function stop(){pause();seek(0)}
  function seek(x){
    t=Math.max(0,Math.min(x,Math.max(duration(),0)));
    if(playing){base=t;t0=performance.now()}
    draw();
  }
  function resize(){
    const p=P();K=Math.min(1,1280/Math.max(p.width,p.height));
    canvas.width=Math.round(p.width*K);canvas.height=Math.round(p.height*K);
    $('project-meta').textContent=`${p.width}×${p.height} · ${p.fps} fps · ${p.aspect}`;
  }
  function beginExport(w,h,hk,cb){unload();hook=hk;onEnd=cb;K=w/P().width;canvas.width=w;canvas.height=h;draw()}
  function endExport(){unload();hook=null;onEnd=null;resize();draw()}
  function init(){
    canvas=$('pv-canvas');ctx=canvas.getContext('2d');
    $('pv-play').onclick=toggle;$('pv-stop').onclick=stop;
    $('pv-vol').oninput=e=>{vol=+e.target.value;draw()};
    $('pv-full').onclick=()=>{const w=$('preview-wrap');document.fullscreenElement?document.exitFullscreen():w.requestFullscreen&&w.requestFullscreen()};
    $('pv-aspect').onchange=e=>{APK.project.setAspect(e.target.value);resize();draw()};
  }
  function load(){t=0;playing=false;$('pv-aspect').value=P().aspect;$('pv-play').textContent='▶';resize();draw()}
  function unload(){playing=false;cancelAnimationFrame(raf);for(const id of [...els.keys()])release(id)}
  return{init,load,unload,beginExport,endExport,refresh:draw,seek,play,pause,toggle,stop,fmt,
    get time(){return t},get playing(){return playing},get duration(){return duration()}};
})();
