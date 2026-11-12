/* Timeline: track, clip, move, trim, split, duplicate, delete, zoom, snap, layer, keyframe, drag & drop pintar, klip teks/bentuk/stiker, kecepatan, pisah audio,
   multi-select, salin/potong/tempel, kunci & sembunyikan layer */
window.APK=window.APK||{};
APK.timeline=(function(){
  const HEAD=164,MIN=0.1,LABEL={video:'Video',audio:'Audio',image:'Gambar'};
  let pps=50,snapOn=true,sel=null,msel=new Set(),multiMode=false,clip=null,drag=null,dragMid=null,tt=()=>{};
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const accepts=(tr,type)=>tr.kind==='audio'?type==='audio':tr.kind==='image'?type==='image':type!=='audio';
  const media=id=>P().media.find(m=>m.id===id);
  const spd=c=>c.speed||1;
  const nameOf=(c,m)=>m?m.name:c.shape?'◆  '+APK.shapes.label(c.shape.type):c.text?(c.stk?'☺  ':'T  ')+String(c.text.content).split('\n')[0]:'(media hilang)';
  const mkTrack=kind=>({id:uid('t_'),kind,name:`${LABEL[kind]} ${P().tracks.filter(t=>t.kind===kind).length+1}`,muted:false,clips:[]});
  /* ig = satu id atau daftar id clip yang diabaikan saat mengecek tabrakan */
  const free=(tr,s,d,ig)=>{const ex=Array.isArray(ig)?ig:[ig];return !tr.clips.some(x=>!ex.includes(x.id)&&s<x.start+x.dur-1e-6&&s+d>x.start+1e-6)};
  function findClip(id){for(const tr of P().tracks){const c=tr.clips.find(c=>c.id===id);if(c)return{tr,c}}return null}
  function endTime(){let d=0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}
  function changed(){APK.project.markDirty();render();APK.preview.refresh()}
  const kfMarks=c=>APK.kf.times(c).filter(t=>t>=-1e-6&&t<=c.dur+1e-6).map(t=>`<em class="kfm" data-t="${t}" style="left:${t*pps}px" title="Keyframe ${t.toFixed(2)} dtk (geser untuk memindah)"></em>`).join('');
  const mkDrag=o=>{o.sl=$('tl-scroll').scrollLeft;return o};
  /* salin objek bersarang (teks, bentuk, chroma, mask) supaya clip hasil duplikat/split tidak berbagi data */
  const copyExtra=(n,c)=>{for(const k of ['text','shape','chroma','mask','flt','tin','tout','anchor'])if(c[k])n[k]={...c[k]};return n};

  /* ===== Seleksi (bisa banyak clip). sel = clip utama (dipakai panel properti dan gizmo), msel = semua clip terpilih ===== */
  const one=id=>{sel=id||null;msel=new Set(id?[id]:[])};
  function prune(){for(const id of [...msel])if(!findClip(id))msel.delete(id);if(!sel||!msel.has(sel))sel=[...msel].pop()||null}
  const selList=()=>[...msel].map(findClip).filter(Boolean);
  function select(id,o){
    if(id==null)one(null);
    else if((o&&o.toggle)||multiMode){
      if(msel.has(id)){msel.delete(id);if(sel===id)sel=[...msel].pop()||null}
      else{msel.add(id);sel=id}
    }else one(id);
    render();APK.preview.refresh();
  }
  function selectAll(){
    const ids=[];for(const tr of P().tracks)for(const c of tr.clips)ids.push(c.id);
    if(!ids.length)return;
    msel=new Set(ids);sel=ids[ids.length-1];render();APK.preview.refresh();
  }

  function load(){const p=P();if(!p.tracks.length)p.tracks=[mkTrack('video'),mkTrack('audio')];one(null);clip=null;render()}
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
      const clips=tr.clips.map(c=>{const m=media(c.mediaId),nm=nameOf(c,m);
        return `<div class="clip ${tr.kind}${c.text?' text':''}${c.shape?' shape':''}${c.stk?' stk':''}${msel.has(c.id)?' sel':''}${c.id===sel?' pri':''}${tr.locked?' locked':''}" data-id="${c.id}" style="left:${c.start*pps}px;width:${Math.max(3,c.dur*pps)}px" title="${esc(nm)}"><i class="h l"></i>${tr.kind==='audio'?`<canvas class="wf" data-c="${c.id}"></canvas>`:''}<span>${esc(nm)}</span>${kfMarks(c)}<i class="h r"></i></div>`}).join('');
      return `<div class="tl-row${tr.hidden?' hid':''}${tr.locked?' lk':''}"><div class="tl-head"><b title="${esc(tr.name)}">${esc(tr.name)}</b><span class="tl-btns">
        <button data-act="up" data-t="${tr.id}" title="Layer naik (tampil lebih depan)" ${i===0?'disabled':''}>▲</button>
        <button data-act="down" data-t="${tr.id}" title="Layer turun (tampil lebih belakang)" ${i===p.tracks.length-1?'disabled':''}>▼</button>
        ${tr.kind==='image'?'':`<button data-act="mute" data-t="${tr.id}" class="${tr.muted?'on':''}" title="${tr.muted?'Suarakan track':'Bisukan track'}">M</button>`}
        <button data-act="lock" data-t="${tr.id}" class="${tr.locked?'on':''}" title="${tr.locked?'Buka kunci layer':'Kunci layer (clip tidak bisa diedit)'}">${tr.locked?'🔒':'🔓'}</button>
        ${tr.kind==='audio'?'':`<button data-act="hide" data-t="${tr.id}" class="${tr.hidden?'on':''}" title="${tr.hidden?'Tampilkan layer':'Sembunyikan layer di preview'}">${tr.hidden?'🚫':'👁'}</button>`}
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
      const sp=spd(c),w=Math.max(1,Math.min(4000,Math.round(c.dur*pps))),h=40,R=APK.wave.RATE,g=cv.getContext('2d');
      cv.width=w;cv.height=h;g.fillStyle='rgba(255,255,255,.75)';
      for(let x=0;x<w;x++){
        const i0=Math.floor((c.in+x/w*c.dur*sp)*R),i1=Math.max(i0+1,Math.floor((c.in+(x+1)/w*c.dur*sp)*R));
        let v=0;for(let i=i0;i<i1&&i<pk.length;i++)if(pk[i]>v)v=pk[i];
        const bh=Math.max(1,v*h);g.fillRect(x,(h-bh)/2,1,bh);
      }
    });
  }

  /* snapping */
  function snapPts(ex){const exs=Array.isArray(ex)?ex:[ex],a=[0,APK.preview.time];for(const t of P().tracks)for(const c of t.clips)if(!exs.includes(c.id))a.push(c.start,c.start+c.dur);return a}
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
    const root=$('tl-content'),ce=e.target.closest('.clip'),multi=e.shiftKey||e.ctrlKey||e.metaKey||multiMode;
    /* garis playhead bisa digeser langsung (kecuali di atas handle trim / penanda keyframe) */
    if(!e.target.closest('.h')&&!e.target.closest('.kfm')&&nearPlayhead(e)){
      drag=mkDrag({mode:'seek'});root.setPointerCapture(e.pointerId);seekTo(e);return;
    }
    if(ce){
      const f=findClip(ce.dataset.id);if(!f)return;
      /* Shift/Ctrl + klik (atau tombol Pilih banyak) = tambah / lepas dari seleksi, tanpa menggeser */
      if(multi){select(f.c.id,{toggle:true});return}
      if(msel.has(f.c.id)&&msel.size>1)sel=f.c.id;else one(f.c.id);
      /* layer terkunci: hanya bisa dipilih, tidak bisa digeser atau dipotong */
      if(f.tr.locked){render();APK.preview.refresh();return}
      const km=e.target.closest('.kfm');
      if(km){
        const from=parseFloat(km.dataset.t);
        drag=mkDrag({mode:'kf',id:f.c.id,x0:e.clientX,from,kf0:APK.kf.clone(f.c.kf||{}),snap:APK.history.snapshot()});
        root.setPointerCapture(e.pointerId);
        APK.preview.seek(f.c.start+from);render();return;
      }
      const mode=e.target.classList.contains('l')?'trimL':e.target.classList.contains('r')?'trimR':'move';
      const grp=mode==='move'&&msel.size>1?selList().filter(x=>!x.tr.locked).map(x=>({id:x.c.id,s0:x.c.start})):null;
      drag=mkDrag({mode,id:f.c.id,x0:e.clientX,o:{...f.c},kf0:f.c.kf?APK.kf.clone(f.c.kf):null,snap:APK.history.snapshot(),grp});
      root.setPointerCapture(e.pointerId);render();APK.preview.refresh();return;
    }
    if(e.target.closest('#tl-ruler')){drag=mkDrag({mode:'seek'});root.setPointerCapture(e.pointerId);seekTo(e);return}
    if(e.target.closest('.tl-lane')&&!multi)select(null);
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
    if(drag.mode==='move'&&drag.grp&&drag.grp.length>1){
      /* geser banyak clip sekaligus: tetap di track masing-masing, jarak antar clip dipertahankan */
      const ids=drag.grp.map(g=>g.id),gp=snapPts(ids);
      let ns=Math.max(0,o.start+dx);
      const b1=snapEdge(ns,gp),b2=snapEdge(ns+c.dur,gp);
      if(b1&&(!b2||b1.d<=b2.d))ns=b1.p;else if(b2)ns=b2.p-c.dur;
      let d=ns-o.start;
      d=Math.max(d,-Math.min(...drag.grp.map(g=>g.s0)));
      const list=drag.grp.map(g=>({g,f:findClip(g.id)})).filter(z=>z.f);
      if(list.every(z=>free(z.f.tr,z.g.s0+d,z.f.c.dur,ids))){
        list.forEach(z=>{z.f.c.start=z.g.s0+d});drag.changed=true;render();
      }
      return;
    }
    if(drag.mode==='move'){
      let ns=Math.max(0,o.start+dx);
      const b1=snapEdge(ns,pts),b2=snapEdge(ns+c.dur,pts);
      if(b1&&(!b2||b1.d<=b2.d))ns=b1.p;else if(b2)ns=b2.p-c.dur;
      ns=Math.max(0,ns);
      let tr=f.tr;
      const lane=document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.dataset&&el.dataset.lane);
      if(lane){
        const cand=P().tracks.find(t=>t.id===lane.dataset.lane),ty=f.tr.kind==='audio'?'audio':(m?m.type:'video');
        if(cand&&!cand.locked&&accepts(cand,ty))tr=cand;
      }
      /* pintar: kalau menabrak clip lain, menempel ke tepi terdekat (jika cukup dekat) */
      if(!c.fx&&!free(tr,ns,c.dur,c.id)){
        let best=null;
        for(const x of tr.clips){
          if(x.id===c.id)continue;
          for(const cand of [x.start+x.dur,x.start-c.dur])
            if(cand>=0&&free(tr,cand,c.dur,c.id)&&(best==null||Math.abs(cand-ns)<Math.abs(best-ns)))best=cand;
        }
        if(best!=null&&Math.abs(best-ns)<=40/pps)ns=best;
      }
      if(c.fx||free(tr,ns,c.dur,c.id)){
        if(tr!==f.tr){f.tr.clips=f.tr.clips.filter(x=>x!==c);tr.clips.push(c)}
        c.start=ns;drag.changed=true;render();
      }
    }else if(drag.mode==='trimL'){
      let ns=o.start+dx;const b=snapEdge(ns,pts);if(b)ns=b.p;
      let prevEnd=0;for(const x of f.tr.clips)if(!c.fx&&x.id!==c.id&&x.start<o.start+1e-6)prevEnd=Math.max(prevEnd,x.start+x.dur);
      const lo=Math.max(prevEnd,m&&m.type!=='image'?o.start-o.in/spd(o):0);
      ns=Math.min(Math.max(ns,lo),o.start+o.dur-MIN);
      c.start=ns;c.in=o.in+(ns-o.start)*spd(o);c.dur=o.dur-(ns-o.start);
      if(drag.kf0)c.kf=APK.kf.shift(drag.kf0,-(ns-o.start));
      drag.changed=true;render();
    }else{
      let ne=o.start+o.dur+dx;const b=snapEdge(ne,pts);if(b)ne=b.p;
      let hi=Infinity;for(const x of f.tr.clips)if(!c.fx&&x.id!==c.id&&x.start>=o.start+o.dur-1e-6)hi=Math.min(hi,x.start);
      if(m&&m.type!=='image'&&m.duration>0)hi=Math.min(hi,o.start+(m.duration-o.in)/spd(o));
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
    const ok=tr=>!tr.locked&&accepts(tr,m.type)&&free(tr,ns,dur,null);
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
    tr.clips.push(c);one(c.id);
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
  function restore(s){P().tracks=JSON.parse(s);prune();APK.project.markDirty();render();APK.preview.refresh()}
  function selectedClip(){const f=sel&&findClip(sel);return f?{c:f.c,tr:f.tr,m:media(f.c.mediaId)}:null}
  function touch(){APK.project.markDirty();APK.preview.refresh()}
  function setTiming(field,v){
    const f=sel&&findClip(sel);if(!f||!isFinite(v)||f.tr.locked)return false;
    const c=f.c,m=media(c.mediaId);
    if(field==='start'){const ns=Math.max(0,v);if(!free(f.tr,ns,c.dur,c.id))return false;c.start=ns}
    else{
      let next=Infinity;for(const x of f.tr.clips)if(x.id!==c.id&&x.start>=c.start+c.dur-1e-6)next=Math.min(next,x.start);
      let hi=next-c.start;
      if(m&&m.type!=='image'&&m.duration>0)hi=Math.min(hi,(m.duration-c.in)/spd(c));
      c.dur=Math.min(Math.max(v,MIN),hi);
    }
    APK.project.markDirty();render();APK.preview.refresh();return true;
  }
  /* ubah kecepatan video/audio; span = panjang sumber (detik) yang dipertahankan selama pengeditan */
  function setSpeed(v,span){
    const f=sel&&findClip(sel);if(!f||!isFinite(v)||f.tr.locked)return;
    const c=f.c,m=media(c.mediaId);if(!m||m.type==='image')return;
    v=Math.min(8,Math.max(0.1,v));
    const src=span||c.dur*spd(c);
    let next=Infinity;for(const x of f.tr.clips)if(x.id!==c.id&&x.start>=c.start+c.dur-1e-6)next=Math.min(next,x.start);
    const nd=Math.max(MIN,Math.min(src/v,next-c.start)),k=nd/c.dur;
    if(c.kf)for(const p in c.kf)for(const q of c.kf[p])q.t*=k;
    c.speed=v;c.dur=nd;
    APK.project.markDirty();render();APK.preview.refresh();
  }
  function addMedia(mid){
    const p=P(),m=media(mid);if(!m)return;
    if(m.type!=='image'&&!(m.duration>0)){tt('Durasi media tidak terbaca');return}
    APK.history.record();
    let tr=p.tracks.find(t=>t.kind===m.type&&!t.locked)||p.tracks.find(t=>!t.locked&&accepts(t,m.type));
    if(!tr){tr=mkTrack(m.type==='audio'?'audio':'video');m.type==='audio'?p.tracks.push(tr):p.tracks.unshift(tr)}
    const start=tr.clips.reduce((a,x)=>Math.max(a,x.start+x.dur),0);
    const c={id:uid('c_'),mediaId:mid,start,in:0,dur:m.type==='image'?5:m.duration,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}};
    tr.clips.push(c);one(c.id);changed();
  }
  /* klip overlay (teks, bentuk, stiker) di posisi playhead, selalu di layer paling atas */
  function addOverlay(extra){
    const p=P();if(!p)return;
    APK.history.record();
    const t=APK.preview.time,dur=3,top=p.tracks[0];
    let tr=top&&top.kind==='video'&&!top.locked&&free(top,t,dur,null)?top:null;
    if(!tr){tr=mkTrack('video');p.tracks.unshift(tr)}
    const c=Object.assign({id:uid('c_'),mediaId:null,start:t,in:0,dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}},extra);
    tr.clips.push(c);one(c.id);changed();
  }
  const addText=()=>addOverlay({text:APK.text.make()});
  const addShape=type=>addOverlay({shape:APK.shapes.make(type)});
  const addSticker=emoji=>addOverlay({text:Object.assign(APK.text.make(),{content:emoji,size:220,bold:false}),stk:1});
  /* pisahkan audio dari clip video: buat clip audio di track audio, lalu bisukan audio clip videonya */
  function extractAudio(){
    const f=sel&&findClip(sel);if(!f){tt('Pilih clip video dulu');return}
    if(f.tr.locked){tt('Layer terkunci. Buka kunci dulu');return}
    const c=f.c,m=media(c.mediaId);
    if(!m||m.type!=='video'||f.tr.kind==='audio'){tt('Pilih clip video untuk dipisah audionya');return}
    if(c.mute){tt('Audio clip ini sudah dipisah / dibisukan');return}
    APK.history.record();
    const p=P();
    let tr=p.tracks.filter(t=>t.kind==='audio'&&!t.locked).find(t=>free(t,c.start,c.dur,null));
    if(!tr){tr=mkTrack('audio');p.tracks.push(tr)}
    const n={id:uid('c_'),mediaId:c.mediaId,start:c.start,in:c.in,dur:c.dur,props:{...c.props}};
    if(c.speed)n.speed=c.speed;
    if(c.fadeIn)n.fadeIn=c.fadeIn;
    if(c.fadeOut)n.fadeOut=c.fadeOut;
    if(c.kf&&c.kf.volume)n.kf={volume:APK.kf.clone(c.kf.volume)};
    tr.clips.push(n);c.mute=true;one(n.id);changed();
    tt('Audio dipisah ke track audio');
  }
  /* split: semua clip terpilih yang dilewati playhead ikut terpotong */
  function split(){
    const l=selList();if(!l.length){tt('Pilih clip dulu');return}
    const t=APK.preview.time,ok=l.filter(f=>!f.tr.locked&&t>f.c.start+MIN&&t<f.c.start+f.c.dur-MIN);
    if(!ok.length){tt(l.every(f=>f.tr.locked)?'Layer terkunci. Buka kunci dulu':'Taruh playhead di dalam clip');return}
    APK.history.record();
    const ids=[];
    for(const f of ok){
      const c=f.c,d=t-c.start,n=copyExtra({...c,id:uid('c_'),props:{...c.props},start:t,in:c.in+d*spd(c),dur:c.dur-d},c);
      /* fade in tetap di potongan kiri, fade out pindah ke potongan kanan */
      if(c.fadeOut){delete c.fadeOut}
      if(c.fadeIn)delete n.fadeIn;
      if(c.reverse){n.in=c.in;c.in=c.in+(c.dur-d)*spd(c)}
      if(c.kf){const sp=APK.kf.split(c,d);c.kf=sp.left;n.kf=sp.right}
      c.dur=d;f.tr.clips.push(n);ids.push(n.id);
    }
    msel=new Set(ids);sel=ids[ids.length-1];changed();
  }
  function duplicate(){
    const all=selList(),l=all.filter(f=>!f.tr.locked);
    if(!l.length){tt(all.length?'Layer terkunci. Buka kunci dulu':'Pilih clip dulu');return}
    APK.history.record();
    const ids=[];
    for(const f of l){
      const c=f.c;let s=c.start+c.dur;
      if(!free(f.tr,s,c.dur,null))s=f.tr.clips.reduce((a,x)=>Math.max(a,x.start+x.dur),0);
      const n=copyExtra({...c,id:uid('c_'),props:{...c.props},start:s},c);
      if(c.kf)n.kf=APK.kf.clone(c.kf);
      f.tr.clips.push(n);ids.push(n.id);
    }
    msel=new Set(ids);sel=ids[ids.length-1];changed();
  }
  function del(){
    const l=selList();if(!l.length){tt('Pilih clip dulu');return}
    const ok=l.filter(f=>!f.tr.locked);
    if(!ok.length){tt('Layer terkunci. Buka kunci dulu');return}
    APK.history.record();
    for(const f of ok)f.tr.clips=f.tr.clips.filter(x=>x!==f.c);
    msel=new Set(l.filter(f=>f.tr.locked).map(f=>f.c.id));sel=[...msel].pop()||null;changed();
  }
  /* salin / potong / tempel (clip tempel di posisi playhead, jarak antar clip dipertahankan) */
  function copy(quiet){
    const l=selList();if(!l.length){tt('Pilih clip dulu');return false}
    const t0=Math.min(...l.map(f=>f.c.start));
    clip={t0,items:l.map(f=>({kind:f.tr.kind,tid:f.tr.id,c:JSON.parse(JSON.stringify(f.c))}))};
    if(!quiet)tt(l.length>1?l.length+' clip disalin':'Clip disalin');
    return true;
  }
  function cut(){if(copy(true))del()}
  function paste(){
    if(!clip||!clip.items.length){tt('Belum ada clip yang disalin');return}
    const p=P(),d=APK.preview.time-clip.t0,items=clip.items.filter(it=>!it.c.mediaId||media(it.c.mediaId));
    if(!items.length){tt('Media clip yang disalin tidak ada di project ini');return}
    APK.history.record();
    const ids=[];
    for(const it of items){
      const c=JSON.parse(JSON.stringify(it.c));c.id=uid('c_');c.start=Math.max(0,it.c.start+d);
      const ok=x=>!!x&&!x.locked&&x.kind===it.kind&&free(x,c.start,c.dur,null);
      let tr=p.tracks.find(x=>x.id===it.tid);
      if(!ok(tr))tr=p.tracks.find(ok)||null;
      if(!tr){tr=mkTrack(it.kind);it.kind==='audio'?p.tracks.push(tr):p.tracks.unshift(tr)}
      tr.clips.push(c);ids.push(c.id);
    }
    msel=new Set(ids);sel=ids[ids.length-1];changed();
  }
  function dropMedia(mid){
    APK.history.clear();
    for(const tr of P().tracks)tr.clips=tr.clips.filter(c=>c.mediaId!==mid);
    prune();render();APK.preview.refresh();
  }
  function addTrack(kind){APK.history.record();const p=P(),tr=mkTrack(kind);kind==='audio'?p.tracks.push(tr):p.tracks.unshift(tr);changed()}
  function headClick(e){
    const b=e.target.closest('[data-act]');if(!b)return;
    const p=P(),i=p.tracks.findIndex(t=>t.id===b.dataset.t);if(i<0)return;
    const tr=p.tracks[i],a=b.dataset.act;
    if(a==='rm'&&tr.locked){tt('Layer terkunci. Buka kunci dulu');return}
    if(a==='rm'&&tr.clips.length&&!confirm(`Hapus track "${tr.name}" beserta ${tr.clips.length} clip?`))return;
    APK.history.record();
    if(a==='up'&&i>0)[p.tracks[i-1],p.tracks[i]]=[tr,p.tracks[i-1]];
    else if(a==='down'&&i<p.tracks.length-1)[p.tracks[i+1],p.tracks[i]]=[tr,p.tracks[i+1]];
    else if(a==='mute')tr.muted=!tr.muted;
    else if(a==='lock')tr.locked=!tr.locked;
    else if(a==='hide')tr.hidden=!tr.hidden;
    else if(a==='rm'){
      p.tracks.splice(i,1);prune();
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
    $('tl-split').onclick=split;$('tl-dup').onclick=duplicate;$('tl-del').onclick=del;$('tl-text').onclick=addText;
    $('tl-copy').onclick=()=>copy();$('tl-paste').onclick=paste;
    $('tl-multi').onclick=e=>{multiMode=!multiMode;e.currentTarget.classList.toggle('on',multiMode);tt(multiMode?'Pilih banyak aktif: ketuk clip untuk menambah / melepas':'Pilih banyak dimatikan')};
    $('tl-ext').onclick=extractAudio;
    $('tl-addshape').innerHTML='<option value="">+ Bentuk</option>'+APK.shapes.TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
    $('tl-addshape').onchange=e=>{if(e.target.value&&P())addShape(e.target.value);e.target.value=''};
    $('stk-grid').innerHTML=APK.shapes.STICKERS.map(s=>`<button type="button" class="stk" data-e="${s}" aria-label="Stiker ${s}">${s}</button>`).join('');
    $('stk-grid').onclick=e=>{const b=e.target.closest('[data-e]');if(!b||!P())return;addSticker(b.dataset.e);$('dlg-sticker').close()};
    $('tl-sticker').onclick=()=>{if(P())$('dlg-sticker').showModal()};
    $('tl-zin').onclick=()=>zoom(1.25);$('tl-zout').onclick=()=>zoom(0.8);
    $('tl-snap').onclick=e=>{snapOn=!snapOn;e.currentTarget.classList.toggle('on',snapOn)};
    $('tl-addtrack').onchange=e=>{if(e.target.value&&P())addTrack(e.target.value);e.target.value=''};
    initDnD();
  }
  return{init,load,render,setPlayhead,addMedia,addText,addShape,addSticker,extractAudio,setSpeed,dropMedia,split,duplicate,del,copy,cut,paste,select,selectAll,restore,selectedClip,touch,setTiming,commit:changed,
    dragMedia:id=>{dragMid=id},selectedIds:()=>[...msel],get selected(){return sel},get multiMode(){return multiMode}};
})();
