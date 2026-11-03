/* Timeline: track, clip, move, trim, split, duplicate, delete, zoom, snap, layer, keyframe, drag & drop pintar */
window.APK=window.APK||{};
APK.timeline=(function(){
  const HEAD=132,MIN=0.1,LABEL={video:'Video',audio:'Audio',image:'Gambar'};
  let pps=50,snapOn=true,sel=null,drag=null,dragMid=null,tt=()=>{};
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const accepts=(tr,type)=>tr.kind==='audio'?type==='audio':tr.kind==='image'?type==='image':type!=='audio';
  const media=id=>P().media.find(m=>m.id===id);
  const mkTrack=kind=>({id:uid('t_'),kind,name:`${LABEL[kind]} ${P().tracks.filter(t=>t.kind===kind).length+1}`,muted:false,clips:[]});
  const free=(tr,s,d,ig)=>!tr.clips.some(x=>x.id!==ig&&s<x.start+x.dur-1e-6&&s+d>x.start+1e-6);
  function findClip(id){for(const tr of P().tracks){const c=tr.clips.find(c=>c.id===id);if(c)return{tr,c}}return null}
  function endTime(){let d=0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}
  function changed(){APK.project.markDirty();render();APK.preview.refresh()}
  const kfMarks=c=>APK.kf.times(c).filter(t=>t>=-1e-6&&t<=c.dur+1e-6).map(t=>`<em class="kfm" data-t="${t}" style="left:${t*pps}px" title="Keyframe ${t.toFixed(2)} dtk (geser untuk memindah)"></em>`).join('');
  const mkDrag=o=>{o.sl=$('tl-scroll').scrollLeft;return o};

  function load(){const p=P();if(!p.tracks.length)p.tracks=[mkTrack('video'),mkTrack('audio')];sel=null;render()}
  function setPlayhead(t){
    const ph=$('tl-ph');if(!ph)return;
    const x=HEAD+t*pps,sc=$('tl-scroll');
    ph.style.left=x+'px';
    if(APK.preview.playing&&(x>sc.scrollLeft+sc.clientWidth-20||x<sc.scrollLeft+HEAD))sc.scrollLeft=Math.max(0,x-HEAD-40);
  }
  function render(){
    const p=P();if(!p)return;
    const total=Math.max(30,endTime()+10),W=total*pps;
    const step=[1,2,5,10,15,30,60,120,300,600,1800].find(s=>s*pps>=80)||3600;
    let ticks='';for(let s=0;s<=total;s+=step)ticks+=`<span class="tick" style="left:${s*pps}px">${APK.preview.fmt(s,true)}</span>`;
    const rows=p.tracks.map((tr,i)=>{
      const clips=tr.clips.map(c=>{const m=media(c.mediaId);
        return `<div class="clip ${tr.kind}${c.id===sel?' sel':''}" data-id="${c.id}" style="left:${c.start*pps}px;width:${Math.max(3,c.dur*pps)}px" title="${esc(m?m.name:'')}"><i class="h l"></i>${tr.kind==='audio'?`<canvas class="wf" data-c="${c.id}"></canvas>`:''}<span>${esc(m?m.name:'(media hilang)')}</span>${kfMarks(c)}<i class="h r"></i></div>`}).join('');
      return `<div class="tl-row"><div class="tl-head"><b title="${esc(tr.name)}">${esc(tr.name)}</b><span class="tl-btns">
        <button data-act="up" data-t="${tr.id}" title="Layer naik" ${i===0?'disabled':''}>▲</button>
        <button data-act="down" data-t="${tr.id}" title="Layer turun" ${i===p.tracks.length-1?'disabled':''}>▼</button>
        ${tr.kind==='image'?'':`<button data-act="mute" data-t="${tr.id}" class="${tr.muted?'on':''}" title="Mute/unmute">M</button>`}
        <button data-act="rm" data-t="${tr.id}" title="Hapus track">✕</button></span></div>
        <div class="tl-lane" data-lane="${tr.id}" style="width:${W}px">${clips}</div></div>`}).join('');
    const root=$('tl-content');
    root.style.width=(HEAD+W)+'px';
    root.innerHTML=`<div class="tl-row tl-ruler"><div class="tl-head"></div><div class="tl-lane" id="tl-ruler" style="width:${W}px">${ticks}</div></div>${rows}<div class="playhead" id="tl-ph"></div>`;
    setPlayhead(APK.preview.time);
    drawWaves();APK.properties&&APK.properties.refresh();
  }
  function drawWaves(){
    document.querySelectorAll('#tl-content canvas.wf').forEach(cv=>{
      const f=findClip(cv.dataset.c);if(!f)return;
      const c=f.c,pk=APK.wave.peaks(c.mediaId);if(!pk)return;
      const w=Math.max(1,Math.min(4000,Math.round(c.dur*pps))),h=40,R=APK.wave.RATE,g=cv.getContext('2d');
      cv.width=w;cv.height=h;g.fillStyle='rgba(255,255,255,.75)';
      for(let x=0;x<w;x++){
        const i0=Math.floor((c.in+x/w*c.dur)*R),i1=Math.max(i0+1,Math.floor((c.in+(x+1)/w*c.dur)*R));
        let v=0;for(let i=i0;i<i1&&i<pk.length;i++)if(pk[i]>v)v=pk[i];
        const bh=Math.max(1,v*h);g.fillRect(x,(h-bh)/2,1,bh);
      }
    });
  }

  /* snapping */
  function snapPts(id){const a=[0,APK.preview.time];for(const t of P().tracks)for(const c of t.clips)if(c.id!==id)a.push(c.start,c.start+c.dur);return a}
  function snapEdge(v,pts){
    if(!snapOn)return null;
    const thr=8/pps,g=pps>=80?1:5;let best=null;
    for(const p of pts.concat([Math.round(v/g)*g])){const d=Math.abs(v-p);if(d<thr&&(!best||d<best.d))best={d,p}}
    return best;
  }
  /* snap khusus playhead: ke tepi clip dan keyframe (tanpa grid), tahan Alt untuk mematikan */
  function snapPlay(t){
    if(!snapOn)return t;
    const thr=8/pps;let best=null;
    for(const tr of P().tracks)for(const c of tr.clips){
      for(const p of [c.start,c.start+c.dur].concat(APK.kf.times(c).map(k=>c.start+k))){
        const d=Math.abs(t-p);if(d<thr&&(!best||d<best.d))best={d,p};
      }
    }
    return best?best.p:t;
  }
  function snapSpan(ns,dur){
    const pts=snapPts(null),b1=snapEdge(ns,pts),b2=snapEdge(ns+dur,pts);
    if(b1&&(!b2||b1.d<=b2.d))ns=b1.p;else if(b2)ns=b2.p-dur;
    return Math.max(0,ns);
  }
  function seekTo(e){
    const r=$('tl-ruler').getBoundingClientRect();
    let t=Math.max(0,(e.clientX-r.left)/pps);
    if(!e.altKey)t=snapPlay(t);
    APK.preview.seek(t);
  }
  function nearPlayhead(e){
    const ph=$('tl-ph');if(!ph)return false;
    const r=ph.getBoundingClientRect();
    return Math.abs(e.clientX-(r.left+r.width/2))<=5;
  }
  function autoScroll(e){
    const sc=$('tl-scroll'),r=sc.getBoundingClientRect();
    if(e.clientX>r.right-40)sc.scrollLeft+=18;
    else if(e.clientX<r.left+HEAD+30)sc.scrollLeft-=18;
  }

  function down(e){
    if(e.button!==0||e.target.closest('.tl-head'))return;
    const root=$('tl-content'),ce=e.target.closest('.clip');
    /* garis playhead bisa digeser langsung (kecuali di atas handle trim / penanda keyframe) */
    if(!e.target.closest('.h')&&!e.target.closest('.kfm')&&nearPlayhead(e)){
      drag=mkDrag({mode:'seek'});root.setPointerCapture(e.pointerId);seekTo(e);return;
    }
    if(ce){
      const f=findClip(ce.dataset.id);if(!f)return;
      sel=f.c.id;
      const km=e.target.closest('.kfm');
      if(km){
        const from=parseFloat(km.dataset.t);
        drag=mkDrag({mode:'kf',id:f.c.id,x0:e.clientX,from,kf0:APK.kf.clone(f.c.kf||{}),snap:APK.history.snapshot()});
        root.setPointerCapture(e.pointerId);
        APK.preview.seek(f.c.start+from);render();return;
      }
      drag=mkDrag({mode:e.target.classList.contains('l')?'trimL':e.target.classList.contains('r')?'trimR':'move',id:f.c.id,x0:e.clientX,o:{...f.c},kf0:f.c.kf?APK.kf.clone(f.c.kf):null,snap:APK.history.snapshot()});
      root.setPointerCapture(e.pointerId);render();return;
    }
    if(e.target.closest('#tl-ruler')){drag=mkDrag({mode:'seek'});root.setPointerCapture(e.pointerId);seekTo(e);return}
    if(e.target.closest('.tl-lane')){sel=null;render()}
  }
  function move(e){
    if(!drag){
      const root=$('tl-content');
      root.style.cursor=(!e.target.closest('.tl-head')&&!e.target.closest('.h')&&!e.target.closest('.kfm')&&nearPlayhead(e))?'ew-resize':'';
      return;
    }
    autoScroll(e);
    if(drag.mode==='seek'){seekTo(e);return}
    const sx=$('tl-scroll').scrollLeft-(drag.sl||0);
    if(drag.mode==='kf'){
      const kf=findClip(drag.id);if(!kf)return;
      let to=drag.from+(e.clientX-drag.x0+sx)/pps;
      const b=snapEdge(kf.c.start+to,[APK.preview.time,kf.c.start,kf.c.start+kf.c.dur]);
      if(b)to=b.p-kf.c.start;
      to=Math.min(Math.max(to,0),kf.c.dur);
      APK.kf.move(kf.c,drag.kf0,drag.from,to);
      drag.changed=Math.abs(to-drag.from)>1e-4;
      render();APK.preview.seek(kf.c.start+to);return;
    }
    const f=findClip(drag.id);if(!f)return;
    const c=f.c,o=drag.o,m=media(c.mediaId),dx=(e.clientX-drag.x0+sx)/pps,pts=snapPts(c.id);
    if(drag.mode==='move'){
      let ns=Math.max(0,o.start+dx);
      const b1=snapEdge(ns,pts),b2=snapEdge(ns+c.dur,pts);
      if(b1&&(!b2||b1.d<=b2.d))ns=b1.p;else if(b2)ns=b2.p-c.dur;
      ns=Math.max(0,ns);
      let tr=f.tr;
      const lane=document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.dataset&&el.dataset.lane);
      if(lane){const cand=P().tracks.find(t=>t.id===lane.dataset.lane);if(cand&&accepts(cand,m?m.type:'video'))tr=cand}
      /* pintar: kalau menabrak clip lain, menempel ke tepi terdekat (jika cukup dekat) */
      if(!free(tr,ns,c.dur,c.id)){
        let best=null;
        for(const x of tr.clips){
          if(x.id===c.id)continue;
          for(const cand of [x.start+x.dur,x.start-c.dur])
            if(cand>=0&&free(tr,cand,c.dur,c.id)&&(best==null||Math.abs(cand-ns)<Math.abs(best-ns)))best=cand;
        }
        if(best!=null&&Math.abs(best-ns)<=40/pps)ns=best;
      }
      if(free(tr,ns,c.dur,c.id)){
        if(tr!==f.tr){f.tr.clips=f.tr.clips.filter(x=>x!==c);tr.clips.push(c)}
        c.start=ns;drag.changed=true;render();
      }
    }else if(drag.mode==='trimL'){
      let ns=o.start+dx;const b=snapEdge(ns,pts);if(b)ns=b.p;
      let prevEnd=0;for(const x of f.tr.clips)if(x.id!==c.id&&x.start<o.start+1e-6)prevEnd=Math.max(prevEnd,x.start+x.dur);
      const lo=Math.max(prevEnd,m&&m.type!=='image'?o.start-o.in:0);
      ns=Math.min(Math.max(ns,lo),o.start+o.dur-MIN);
      c.start=ns;c.in=o.in+(ns-o.start);c.dur=o.dur-(ns-o.start);
      if(drag.kf0)c.kf=APK.kf.shift(drag.kf0,-(ns-o.start));
      drag.changed=true;render();
    }else{
      let ne=o.start+o.dur+dx;const b=snapEdge(ne,pts);if(b)ne=b.p;
      let hi=Infinity;for(const x of f.tr.clips)if(x.id!==c.id&&x.start>=o.start+o.dur-1e-6)hi=Math.min(hi,x.start);
      if(m&&m.type!=='image'&&m.duration>0)hi=Math.min(hi,o.start+(m.duration-o.in));
      ne=Math.min(Math.max(ne,o.start+MIN),hi);
      c.dur=ne-o.start;drag.changed=true;render();
    }
  }
  function up(){if(drag&&drag.changed){APK.history.record(drag.snap);changed()}drag=null}

  /* ===== Drag & drop media / file ke timeline dan preview ===== */
  const timeAt=e=>{const r=$('tl-ruler');return r?Math.max(0,(e.clientX-r.getBoundingClientRect().left)/pps):0};
  const laneAt=e=>{const l=document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.dataset&&el.dataset.lane);return l?l.dataset.lane:null};
  const durOf=m=>m.type==='image'?5:(m.duration||5);
  const dragOk=e=>!!P()&&(!!dragMid||(!!e.dataTransfer&&[...e.dataTransfer.types].includes('Files')));
  /* rencana penempatan: lane yang dituju, kalau bentrok/tidak cocok cari track lain yang kosong, kalau tidak ada buat track baru */
  function plan(m,t,laneId){
    const p=P(),dur=durOf(m),ns=Math.max(0,t);
    const ok=tr=>accepts(tr,m.type)&&free(tr,ns,dur,null);
    const lane=laneId&&p.tracks.find(x=>x.id===laneId);
    let tr=lane&&ok(lane)?lane:null;
    if(!tr){
      const pref=p.tracks.filter(x=>x.kind===m.type),rest=p.tracks.filter(x=>x.kind!==m.type);
      tr=pref.concat(rest).find(ok)||null;
    }
    return{tr,start:ns,dur,kind:m.type==='audio'?'audio':'video'};
  }
  function placeMedia(mid,t,laneId,quiet){
    const p=P(),m=media(mid);if(!m)return null;
    if(m.type!=='image'&&!(m.duration>0)){tt('Durasi media tidak terbaca');return null}
    const pl=plan(m,t,laneId);
    if(!quiet)APK.history.record();
    let tr=pl.tr;
    if(!tr){tr=mkTrack(pl.kind);pl.kind==='audio'?p.tracks.push(tr):p.tracks.unshift(tr)}
    const c={id:uid('c_'),mediaId:mid,start:pl.start,in:0,dur:pl.dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}};
    tr.clips.push(c);sel=c.id;
    return c;
  }
  function hideDrop(){const g=$('tl-drop');if(g)g.remove();$('tl-scroll').classList.remove('dropping')}
  function showDrop(m,t,dur,laneId){
    const root=$('tl-content');let g=$('tl-drop');
    if(!g){g=document.createElement('div');g.id='tl-drop';root.appendChild(g)}
    $('tl-scroll').classList.add('dropping');
    const pl=m?plan(m,t,laneId):null;
    let laneEl=null;
    if(pl&&pl.tr)laneEl=root.querySelector(`[data-lane="${pl.tr.id}"]`);
    else if(!m&&laneId)laneEl=root.querySelector(`[data-lane="${laneId}"]`);
    let top,h;
    if(laneEl){top=laneEl.offsetTop+4;h=laneEl.offsetHeight-8;g.className='';g.textContent=m?m.name:''}
    else{
      const lanes=root.querySelectorAll('.tl-lane[data-lane]'),last=lanes[lanes.length-1];
      top=m&&m.type==='audio'&&last?last.offsetTop+last.offsetHeight:26;h=22;
      g.className='new';g.textContent='+ Track baru';
    }
    g.style.cssText=`left:${HEAD+t*pps}px;top:${top}px;height:${h}px;width:${Math.max(24,dur*pps)}px`;
  }
  async function handleDrop(e,t,laneId){
    const mid=e.dataTransfer.getData('application/x-apk-media')||dragMid;
    if(mid){const c=placeMedia(mid,t,laneId);if(c)changed();return}
    const files=[...e.dataTransfer.files];if(!files.length)return;
    const ids=await APK.media.importFiles(files,tt);
    if(!ids||!ids.length)return;
    APK.history.record();
    let cur=t,last=null;
    for(const id of ids){const c=placeMedia(id,cur,laneId,true);if(c){last=c;cur=c.start+c.dur}}
    if(last)changed();
  }
  function initDnD(){
    const sc=$('tl-scroll'),pv=$('panel-preview');
    sc.addEventListener('dragover',e=>{
      if(!dragOk(e))return;
      e.preventDefault();e.dataTransfer.dropEffect='copy';
      const m=dragMid&&media(dragMid),dur=m?durOf(m):0;
      showDrop(m,snapSpan(timeAt(e),dur),dur||2,laneAt(e));
      autoScroll(e);
    });
    sc.addEventListener('dragleave',e=>{if(!sc.contains(e.relatedTarget))hideDrop()});
    sc.addEventListener('drop',e=>{
      if(!dragOk(e))return;
      e.preventDefault();hideDrop();
      const m=dragMid&&media(dragMid),dur=m?durOf(m):0;
      handleDrop(e,snapSpan(timeAt(e),dur),laneAt(e));
    });
    pv.addEventListener('dragover',e=>{if(!dragOk(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';pv.classList.add('drop')});
    pv.addEventListener('dragleave',e=>{if(!pv.contains(e.relatedTarget))pv.classList.remove('drop')});
    pv.addEventListener('drop',e=>{
      if(!dragOk(e))return;
      e.preventDefault();pv.classList.remove('drop');
      handleDrop(e,APK.preview.time,null);
    });
    addEventListener('dragend',()=>{dragMid=null;hideDrop()});
  }

  /* operasi */
  function restore(s){P().tracks=JSON.parse(s);if(sel&&!findClip(sel))sel=null;APK.project.markDirty();render();APK.preview.refresh()}
  function selectedClip(){const f=sel&&findClip(sel);return f?{c:f.c,tr:f.tr,m:media(f.c.mediaId)}:null}
  function touch(){APK.project.markDirty();APK.preview.refresh()}
  function setTiming(field,v){
    const f=sel&&findClip(sel);if(!f||!isFinite(v))return false;
    const c=f.c,m=media(c.mediaId);
    if(field==='start'){const ns=Math.max(0,v);if(!free(f.tr,ns,c.dur,c.id))return false;c.start=ns}
    else{
      let next=Infinity;for(const x of f.tr.clips)if(x.id!==c.id&&x.start>=c.start+c.dur-1e-6)next=Math.min(next,x.start);
      let hi=next-c.start;
      if(m&&m.type!=='image'&&m.duration>0)hi=Math.min(hi,m.duration-c.in);
      c.dur=Math.min(Math.max(v,MIN),hi);
    }
    APK.project.markDirty();render();APK.preview.refresh();return true;
  }
  function addMedia(mid){
    const p=P(),m=media(mid);if(!m)return;
    if(m.type!=='image'&&!(m.duration>0)){tt('Durasi media tidak terbaca');return}
    APK.history.record();
    let tr=p.tracks.find(t=>t.kind===m.type)||p.tracks.find(t=>accepts(t,m.type));
    if(!tr){tr=mkTrack(m.type==='audio'?'audio':'video');m.type==='audio'?p.tracks.push(tr):p.tracks.unshift(tr)}
    const start=tr.clips.reduce((a,x)=>Math.max(a,x.start+x.dur),0);
    const c={id:uid('c_'),mediaId:mid,start,in:0,dur:m.type==='image'?5:m.duration,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}};
    tr.clips.push(c);sel=c.id;changed();
  }
  function split(){
    const f=sel&&findClip(sel);if(!f){tt('Pilih clip dulu');return}
    const t=APK.preview.time,c=f.c;
    if(t<=c.start+MIN||t>=c.start+c.dur-MIN){tt('Taruh playhead di dalam clip');return}
    APK.history.record();
    const d=t-c.start,n={...c,id:uid('c_'),props:{...c.props},start:t,in:c.in+d,dur:c.dur-d};
    if(c.kf){const sp=APK.kf.split(c,d);c.kf=sp.left;n.kf=sp.right}
    c.dur=d;f.tr.clips.push(n);sel=n.id;changed();
  }
  function duplicate(){
    const f=sel&&findClip(sel);if(!f){tt('Pilih clip dulu');return}
    APK.history.record();
    const c=f.c;let s=c.start+c.dur;
    if(!free(f.tr,s,c.dur,null))s=f.tr.clips.reduce((a,x)=>Math.max(a,x.start+x.dur),0);
    const n={...c,id:uid('c_'),props:{...c.props},start:s};
    if(c.kf)n.kf=APK.kf.clone(c.kf);
    f.tr.clips.push(n);sel=n.id;changed();
  }
  function del(){
    const f=sel&&findClip(sel);if(!f){tt('Pilih clip dulu');return}
    APK.history.record();
    f.tr.clips=f.tr.clips.filter(x=>x!==f.c);sel=null;changed();
  }
  function dropMedia(mid){
    APK.history.clear();
    for(const tr of P().tracks)tr.clips=tr.clips.filter(c=>{if(c.mediaId===mid){if(c.id===sel)sel=null;return false}return true});
    render();APK.preview.refresh();
  }
  function addTrack(kind){APK.history.record();const p=P(),tr=mkTrack(kind);kind==='audio'?p.tracks.push(tr):p.tracks.unshift(tr);changed()}
  function headClick(e){
    const b=e.target.closest('[data-act]');if(!b)return;
    const p=P(),i=p.tracks.findIndex(t=>t.id===b.dataset.t);if(i<0)return;
    const tr=p.tracks[i],a=b.dataset.act;
    if(a==='rm'&&tr.clips.length&&!confirm(`Hapus track "${tr.name}" beserta ${tr.clips.length} clip?`))return;
    APK.history.record();
    if(a==='up'&&i>0)[p.tracks[i-1],p.tracks[i]]=[tr,p.tracks[i-1]];
    else if(a==='down'&&i<p.tracks.length-1)[p.tracks[i+1],p.tracks[i]]=[tr,p.tracks[i+1]];
    else if(a==='mute')tr.muted=!tr.muted;
    else if(a==='rm'){
      if(tr.clips.some(c=>c.id===sel))sel=null;
      p.tracks.splice(i,1);
    }
    changed();
  }
  function zoom(k){pps=Math.min(400,Math.max(5,pps*k));render()}
  function init(toast){
    tt=toast;
    const root=$('tl-content');
    root.addEventListener('pointerdown',down);
    root.addEventListener('pointermove',move);
    root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
    root.addEventListener('click',headClick);
    $('tl-scroll').addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();zoom(e.deltaY<0?1.15:1/1.15)}},{passive:false});
    $('tl-split').onclick=split;$('tl-dup').onclick=duplicate;$('tl-del').onclick=del;
    $('tl-zin').onclick=()=>zoom(1.25);$('tl-zout').onclick=()=>zoom(0.8);
    $('tl-snap').onclick=e=>{snapOn=!snapOn;e.currentTarget.classList.toggle('on',snapOn)};
    $('tl-addtrack').onchange=e=>{if(e.target.value&&P())addTrack(e.target.value);e.target.value=''};
    initDnD();
  }
  return{init,load,render,setPlayhead,addMedia,dropMedia,split,duplicate,del,restore,selectedClip,touch,setTiming,commit:changed,dragMedia:id=>{dragMid=id},get selected(){return sel}};
})();
