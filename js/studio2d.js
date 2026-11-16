/* Studio Pro 2D (v26): kumpulan alat bantu editor video. Dibuka lewat tombol "Studio" di bar timeline. Dimuat setelah js/replace.js.
   Tab Susun : rapatkan celah, hapus + rapatkan (ripple), samakan durasi, beku frame, buang bagian hening
   Tab Rata  : rata kiri/tengah/kanan/atas/bawah, bagi rata, terhadap layar atau pilihan
   Tab Teks  : 12 gaya teks siap pakai (+ animasi masuk), impor / ekspor subtitle .srt/.vtt
   Tab Musik : deteksi ketukan otomatis, penanda (tombol M), sebar clip ke ketukan
   Tab Kreasi: Ken Burns otomatis untuk foto/video, rekam suara (voice-over)
   Tab Proyek: versi / titik pulih (IndexedDB sendiri, tidak ikut sinkron cloud), salin & tempel pengaturan clip, garis panduan preview
   Data tambahan di project: project.markers = [{t, k:'m'|'b', l}] (kecil, ikut tersimpan). Semua perubahan track lewat APK.history.record() jadi bisa di-Undo.
   Pintasan: M = penanda, , dan . = loncat penanda, G = garis panduan, Shift+Delete = hapus & rapatkan. */
window.APK=window.APK||{};
(function(){
  'use strict';
  const T=APK.timeline;if(!T||!APK.project)return;
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const EPS=1e-4,pad2=n=>String(n).padStart(2,'0');
  let th=0;
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(th);th=setTimeout(()=>t.classList.remove('show'),3400)}

  /* ===== pengaturan (diingat di browser) ===== */
  const S={dur:3,pack:true,rdAll:false,fz:2,fzAll:false,silDb:-40,silMin:0.5,silPad:0.08,silAll:false,
    alignTo:'screen',tanim:'pop',srtAt:'zero',srtStyle:'putih',beatSens:'1',beatN:'1',kb:'mix',kbStr:15,recPlay:true,snapName:'',
    g:{third:false,center:false,safe:false,social:false},cg:{gerak:true,tampil:true,trans:true,kunci:true,audio:true,teks:false}};
  try{const o=JSON.parse(localStorage.getItem('st2d')||'null');if(o){for(const k of Object.keys(S))if(k!=='g'&&k!=='cg'&&o[k]!=null)S[k]=o[k];Object.assign(S.g,o.g);Object.assign(S.cg,o.cg)}}catch(_){}
  const keep=()=>{try{localStorage.setItem('st2d',JSON.stringify(S))}catch(_){}};
  let tab='susun',rec=null,styleBuf=null;

  /* ===== util project ===== */
  const media=id=>{const p=P();return p?p.media.find(m=>m.id===id):null};
  function findClip(id){const p=P();if(p)for(const tr of p.tracks){const c=tr.clips.find(x=>x.id===id);if(c)return{c,tr}}return null}
  const sel=()=>T.selectedIds().map(findClip).filter(Boolean);
  const unlocked=l=>l.filter(f=>!f.tr.locked);
  const free=(tr,s,d,ig)=>{const ex=ig||[];return !tr.clips.some(x=>!ex.includes(x.id)&&s<x.start+x.dur-1e-6&&s+d>x.start+1e-6)};
  const LABEL={video:'Video',audio:'Audio',image:'Gambar'};
  const mkTrack=kind=>({id:uid('t_'),kind,name:`${LABEL[kind]} ${P().tracks.filter(t=>t.kind===kind).length+1}`,muted:false,clips:[]});
  const spOf=c=>Math.min(16,Math.max(0.0625,c.speed||1));
  const hasAudio=f=>{const m=media(f.c.mediaId);return !!m&&(m.type==='audio'||m.type==='video')&&!f.c.fx};
  function mergeRanges(r){
    const a=r.map(x=>[x[0],x[1]]).sort((x,y)=>x[0]-y[0]),o=[];
    for(const q of a){const l=o[o.length-1];if(l&&q[0]<=l[1]+EPS)l[1]=Math.max(l[1],q[1]);else o.push(q)}
    return o;
  }
  /* geser semua clip yang mulai di/after tepi kanan tiap rentang ke kiri sebesar panjang rentangnya */
  function shiftAfter(trs,ranges){
    for(let i=ranges.length-1;i>=0;i--){
      const a=ranges[i][0],b=ranges[i][1],d=b-a;
      for(const tr of trs)for(const c of tr.clips)if(c.start>=b-EPS)c.start=Math.max(0,c.start-d);
    }
  }
  /* belah clip c di waktu t (timeline). Meniru Split bawaan, tapi transisi keluar ikut potongan kiri dan transisi masuk ikut potongan kanan */
  function splitAt(tr,c,t){
    const sp=c.speed||1,d=t-c.start,n=Object.assign({},c);
    n.id=uid('c_');n.props=Object.assign({},c.props);
    for(const k of ['text','shape','chroma','mask','flt','tin','tout','anchor','anim','mp','fx','vec','blue'])if(c[k])n[k]=clone(c[k]);
    n.start=t;n.in=c.in+d*sp;n.dur=c.dur-d;
    delete c.fadeOut;if(c.fadeIn)delete n.fadeIn;
    delete c.tout;delete n.tin;
    if(c.reverse){n.in=c.in;c.in=c.in+(c.dur-d)*sp}
    if(c.kf){const s=APK.kf.split(c,d);c.kf=s.left;n.kf=s.right}
    c.dur=d;tr.clips.push(n);return n;
  }
  /* buang rentang waktu [a,b] dari track trs (clip yang menyilang dibelah), lalu rapatkan sisanya */
  function cutRange(a,b,trs){
    const d=b-a;if(d<=EPS)return;
    for(const tr of trs){
      for(const t of [b,a])for(const c of [...tr.clips])if(t>c.start+EPS&&t<c.start+c.dur-EPS)splitAt(tr,c,t);
      tr.clips=tr.clips.filter(c=>!(c.start>=a-EPS&&c.start+c.dur<=b+EPS));
      for(const c of tr.clips)if(c.start>=b-EPS)c.start=Math.max(0,c.start-d);
    }
  }
  function shiftProp(c,p,d){
    if(APK.kf.animated(c,p)){for(const k of c.kf[p])k.v=Math.round((k.v+d)*100)/100}
    else{c.props=Object.assign({},APK.kf.DEF,c.props);c.props[p]=Math.round(((c.props[p]||0)+d)*100)/100}
  }
  function addOverlay(extra){
    const p=P(),t=APK.preview.time,dur=extra.dur||3,top=p.tracks[0];
    APK.history.record();
    let tr=top&&top.kind==='video'&&!top.locked&&free(top,t,dur,null)?top:null;
    if(!tr){tr=mkTrack('video');p.tracks.unshift(tr)}
    const c=Object.assign({id:uid('c_'),mediaId:null,start:t,in:0,dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}},extra);
    tr.clips.push(c);return{c,tr};
  }

  /* ===== analisis audio ===== */
  async function decode(mid){
    const r=await APK.db.getMedia(mid);if(!r||!r.blob)throw new Error('media tidak ditemukan');
    if(r.blob.size>400*1048576)throw new Error('file terlalu besar untuk dianalisis ('+Math.round(r.blob.size/1048576)+' MB)');
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('browser tidak mendukung analisis audio');
    const ac=new AC();
    try{return await ac.decodeAudioData(await r.blob.arrayBuffer())}
    catch(e){throw new Error('audio tidak bisa dibaca (mungkin videonya tanpa suara)')}
    finally{try{ac.close()}catch(_){}}
  }
  /* bagian hening di rentang sumber [from,to] detik. Mengembalikan [[a,b],...] (detik sumber) yang boleh dibuang, dengan jeda pad di tiap sisi */
  function findSilence(buf,from,to,db,minLen,pad){
    const sr=buf.sampleRate,hop=Math.max(1,Math.round(sr*0.02)),i0=Math.max(0,Math.floor(from*sr)),i1=Math.min(buf.length,Math.floor(to*sr)),n=Math.floor((i1-i0)/hop);
    if(n<2)return[];
    const chs=[];for(let k=0;k<buf.numberOfChannels;k++)chs.push(buf.getChannelData(k));
    const thr=Math.pow(10,db/20),q=new Array(n);
    for(let i=0;i<n;i++){
      let s=0,cnt=0;const a=i0+i*hop;
      for(const d of chs)for(let j=a;j<a+hop;j+=2){s+=d[j]*d[j];cnt++}
      q[i]=Math.sqrt(s/Math.max(1,cnt))<thr;
    }
    const out=[];let i=0;
    while(i<n){
      if(!q[i]){i++;continue}
      let j=i;while(j<n&&q[j])j++;
      const len=(j-i)*hop/sr;
      if(len>=minLen){
        const a=from+i*hop/sr+pad,b=Math.min(to,from+j*hop/sr)-pad;
        if(b-a>=0.1)out.push([a,b]);
      }
      i=j;
    }
    return out;
  }
  /* ketukan (onset bass/drum) di rentang sumber. sens 0 = sedikit, 1 = sedang, 2 = banyak. Hasil: detik sumber */
  function beatTimes(buf,from,to,sens){
    const sr=buf.sampleRate,hop=Math.round(sr*0.01),i0=Math.max(0,Math.floor(from*sr)),i1=Math.min(buf.length,Math.floor(to*sr)),n=Math.floor((i1-i0)/hop);
    if(n<60)return[];
    const c0=buf.getChannelData(0),c1=buf.numberOfChannels>1?buf.getChannelData(1):null,al=Math.exp(-2*Math.PI*180/sr);
    const eL=new Float32Array(n),eF=new Float32Array(n);let y=0;
    for(let i=0;i<n;i++){
      let sl=0,sf=0;const b=i0+i*hop;
      for(let j=0;j<hop;j++){let x=c0[b+j];if(c1)x=(x+c1[b+j])/2;y+=(1-al)*(x-y);sl+=y*y;sf+=x*x}
      eL[i]=Math.sqrt(sl/hop);eF[i]=Math.sqrt(sf/hop);
    }
    const fl=new Float32Array(n);let mx=0;
    for(let i=1;i<n;i++){fl[i]=Math.max(0,eL[i]-eL[i-1])+0.5*Math.max(0,eF[i]-eF[i-1]);if(fl[i]>mx)mx=fl[i]}
    if(mx<=0)return[];
    const s1=new Float64Array(n+1),s2=new Float64Array(n+1);
    for(let i=0;i<n;i++){s1[i+1]=s1[i]+fl[i];s2[i+1]=s2[i]+fl[i]*fl[i]}
    const k=[1.3,0.9,0.55][sens]||0.9,gap=Math.round([0.45,0.3,0.2][sens]/0.01||30),W=60,out=[];
    let last=-1e9,lastV=0;
    for(let i=1;i<n-1;i++){
      if(fl[i]<mx*0.08||fl[i]<fl[i-1]||fl[i]<fl[i+1])continue;
      const a=Math.max(0,i-W),b=Math.min(n,i+W+1),m=(s1[b]-s1[a])/(b-a),v=Math.max(0,(s2[b]-s2[a])/(b-a)-m*m);
      if(fl[i]<=m+k*Math.sqrt(v))continue;
      if(i-last<gap){
        if(fl[i]>lastV&&out.length){out[out.length-1]=i;last=i;lastV=fl[i]}
        continue;
      }
      out.push(i);last=i;lastV=fl[i];
    }
    return out.map(i=>from+i*hop/sr);
  }
  const tlTime=(c,s)=>c.reverse?c.start+(c.in+c.dur*spOf(c)-s)/spOf(c):c.start+(s-c.in)/spOf(c);

  /* ===== penanda ===== */
  const markers=()=>{const p=P();if(!p)return[];if(!Array.isArray(p.markers))p.markers=[];return p.markers};
  function addMarker(t,k,l){
    const ms=markers();
    if(ms.some(m=>Math.abs(m.t-t)<0.02&&m.k===k))return false;
    ms.push({t:Math.round(t*1000)/1000,k:k||'m',l:l||''});ms.sort((a,b)=>a.t-b.t);return true;
  }
  function ppsNow(){
    const t=[...document.querySelectorAll('#tl-ruler .tick')].find(x=>parseFloat(x.style.left)>0);
    if(!t)return 50;
    const q=t.textContent.split(':'),sec=(+q[0])*60+(+q[1]);
    return sec>0?parseFloat(t.style.left)/sec:50;
  }
  function drawMarks(){
    const p=P(),r=$('tl-ruler');if(!p||!r)return;
    r.querySelectorAll('.st-mk').forEach(e=>e.remove());
    const ms=p.markers;if(!ms||!ms.length)return;
    const pps=ppsNow();
    r.insertAdjacentHTML('beforeend',ms.map(m=>`<em class="st-mk${m.k==='b'?' b':''}" style="left:${m.t*pps}px" title="${esc(m.l||(m.k==='b'?'Ketukan':'Penanda'))}"></em>`).join(''));
  }
  function jumpMarker(dir){
    const ms=markers();if(!ms.length){toast('Belum ada penanda. Tekan M untuk menambah');return}
    const t=APK.preview.time,e=0.01,x=dir>0?ms.find(m=>m.t>t+e):[...ms].reverse().find(m=>m.t<t-e);
    if(x)APK.preview.seek(x.t);else toast(dir>0?'Tidak ada penanda berikutnya':'Tidak ada penanda sebelumnya');
  }

  /* ===== SUSUN ===== */
  function closeGaps(){
    const l=unlocked(sel()),trs=[...new Set(l.map(f=>f.tr))];
    if(!trs.length){toast('Pilih clip dulu. Celah dirapatkan di track clip itu');return}
    const plan=[];
    for(const tr of trs){
      let cur=null;
      for(const c of tr.clips.filter(x=>!x.fx).sort((a,b)=>a.start-b.start)){
        let ns=c.start;
        if(cur!==null&&c.start>cur+EPS){ns=cur;plan.push([c,ns])}
        cur=Math.max(cur===null?0:cur,ns+c.dur);
      }
    }
    if(!plan.length){toast('Tidak ada celah di track itu');return}
    APK.history.record();
    for(const q of plan)q[0].start=q[1];
    T.commit();toast(plan.length+' celah dirapatkan');
  }
  function rippleDelete(){
    const l=unlocked(sel());if(!l.length){toast('Pilih clip dulu');return}
    APK.history.record();
    const p=P();let trs;
    const byTr=new Map();
    for(const f of l){if(!byTr.has(f.tr))byTr.set(f.tr,[]);byTr.get(f.tr).push([f.c.start,f.c.start+f.c.dur])}
    for(const f of l)f.tr.clips=f.tr.clips.filter(x=>x!==f.c);
    if(S.rdAll){
      trs=p.tracks.filter(t=>!t.locked);
      shiftAfter(trs,mergeRanges(l.map(f=>[f.c.start,f.c.start+f.c.dur])));
    }else for(const[tr,r]of byTr)shiftAfter([tr],mergeRanges(r));
    T.commit();T.select(null);
    toast(l.length+' clip dihapus dan dirapatkan');
  }
  function equalize(){
    const l=unlocked(sel()).filter(f=>!f.c.fx);if(!l.length){toast('Pilih clip dulu');return}
    const D=Math.max(0.1,+S.dur||3),ids=l.map(f=>f.c.id),byTr=new Map();
    for(const f of l){if(!byTr.has(f.tr))byTr.set(f.tr,[]);byTr.get(f.tr).push(f.c)}
    APK.history.record();
    for(const[tr,cs]of byTr){
      cs.sort((a,b)=>a.start-b.start);
      const oldEnd=Math.max(...cs.map(c=>c.start+c.dur));let cur=cs[0].start;
      for(const c of cs){
        const m=media(c.mediaId);let nd=D;
        if(m&&m.type!=='image'&&m.duration>0)nd=Math.min(nd,Math.max(0.1,(m.duration-c.in)/spOf(c)));
        if(S.pack){c.start=cur;c.dur=nd;cur+=nd}
        else{
          let nx=Infinity;for(const x of tr.clips)if(!ids.includes(x.id)&&x.start>=c.start+EPS)nx=Math.min(nx,x.start);
          c.dur=Math.max(0.1,Math.min(nd,nx-c.start));
        }
      }
      if(S.pack){
        const d=cur-oldEnd;
        if(Math.abs(d)>EPS)for(const x of tr.clips)if(!ids.includes(x.id)&&x.start>=oldEnd-EPS)x.start=Math.max(0,x.start+d);
      }
    }
    T.commit();toast(l.length+' clip diatur ke '+D+' detik'+(S.pack?' dan dirapatkan':''));
  }
  async function freezeFrame(){
    const l=sel();if(l.length!==1){toast('Pilih satu clip video');return}
    const c=l[0].c,tr=l[0].tr,m=media(c.mediaId);
    if(tr.locked){toast('Layer terkunci. Buka kunci dulu');return}
    if(!m||m.type!=='video'||tr.kind==='audio'){toast('Beku frame hanya untuk clip video');return}
    const t=APK.preview.time;
    if(t<c.start+0.05||t>=c.start+c.dur-0.05){toast('Taruh playhead di dalam clip video itu');return}
    const sp=spOf(c),src=c.reverse?c.in+c.dur*sp-(t-c.start)*sp:c.in+(t-c.start)*sp;
    toast('Mengambil frame…');
    let file;
    try{
      const url=await APK.media.getUrl(c.mediaId),v=document.createElement('video');
      v.muted=true;v.preload='auto';v.playsInline=true;
      await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new Error('video tidak terbaca'));v.src=url;setTimeout(()=>rej(new Error('waktu habis')),15000)});
      const x=Math.max(0,Math.min(src,(isFinite(v.duration)&&v.duration>0?v.duration:1e9)-0.02));
      await new Promise(res=>{v.onseeked=res;v.currentTime=x;setTimeout(res,4000)});
      const cv=document.createElement('canvas');cv.width=v.videoWidth;cv.height=v.videoHeight;
      cv.getContext('2d').drawImage(v,0,0);
      const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.95));
      v.removeAttribute('src');v.load();
      if(!blob)throw new Error('frame kosong');
      file=new File([blob],'beku-'+Date.now().toString(36)+'.jpg',{type:'image/jpeg'});
    }catch(e){toast('Beku frame gagal: '+e.message);return}
    const ids=await APK.media.importFiles([file],toast);
    if(!ids||!ids.length)return;
    const cur=findClip(c.id);if(!cur){toast('Clip sudah berubah, ulangi');return}
    const D=Math.max(0.2,+S.fz||2),pr=APK.kf.props(c,t-c.start),p=P();
    APK.history.record();
    const trs=S.fzAll?p.tracks.filter(x=>!x.locked):[tr];
    for(const x of trs)for(const k of [...x.clips])if(t>k.start+EPS&&t<k.start+k.dur-EPS)splitAt(x,k,t);
    for(const x of trs)for(const k of x.clips)if(k.start>=t-EPS)k.start+=D;
    const fc={id:uid('c_'),mediaId:ids[0],start:t,in:0,dur:D,props:{x:pr.x,y:pr.y,scale:pr.scale,opacity:pr.opacity,rotation:pr.rotation,volume:1,sx:pr.sx,sy:pr.sy,skx:pr.skx,sky:pr.sky}};
    for(const k of ['blend','flipX','flipY'])if(c[k])fc[k]=c[k];
    for(const k of ['flt','chroma','mask','anchor'])if(c[k])fc[k]=clone(c[k]);
    tr.clips.push(fc);
    T.commit();T.select(fc.id);
    toast('Frame dibekukan '+D+' detik');
  }
  async function removeSilence(){
    const l=unlocked(sel());
    const pf=l.find(f=>hasAudio(f)&&!f.c.reverse);
    if(!pf){toast('Pilih clip video atau audio (bukan putar mundur) yang mau dibuang hening-nya');return}
    toast('Menganalisis suara…');
    let buf;try{buf=await decode(pf.c.mediaId)}catch(e){toast('Gagal: '+e.message);return}
    const c=pf.c,sp=spOf(c),sil=findSilence(buf,c.in,c.in+c.dur*sp,+S.silDb,Math.max(0.1,+S.silMin||0.5),Math.max(0,+S.silPad||0));
    if(!sil.length){toast('Tidak ada bagian hening yang terdeteksi. Coba naikkan batas (mis. -35 dB) atau perpendek durasi hening');return}
    const ranges=sil.map(q=>[c.start+(q[0]-c.in)/sp,c.start+(q[1]-c.in)/sp]),p=P();
    const trs=p.tracks.filter(t=>!t.locked&&(S.silAll||l.some(f=>f.tr===t)));
    APK.history.record();
    for(let i=ranges.length-1;i>=0;i--)cutRange(ranges[i][0],ranges[i][1],trs);
    const tot=ranges.reduce((a,r)=>a+(r[1]-r[0]),0);
    T.commit();toast(sil.length+' bagian hening dibuang ('+tot.toFixed(1)+' detik)');
  }

  /* ===== RATA ===== */
  function align(mode){
    const l=unlocked(sel()).filter(f=>f.tr.kind!=='audio'&&!f.c.fx);
    if(!l.length){toast('Pilih clip dulu');return}
    const p=P(),W=p.width,H=p.height,items=[];
    for(const f of l){
      const b=APK.preview.bounds(f.c.id);
      if(!b||f.c.parent||(f.c.mp&&f.c.mp.on))continue;
      const a=(b.rot||0)*Math.PI/180,cs=Math.abs(Math.cos(a)),sn=Math.abs(Math.sin(a));
      items.push({f,b,hw:(b.w*cs+b.h*sn)/2,hh:(b.w*sn+b.h*cs)/2});
    }
    if(!items.length){toast('Clip harus tampil di preview pada posisi playhead, dan tidak punya induk atau jalur gerak');return}
    let L=0,R=W,Tp=0,B=H;
    if(S.alignTo==='sel'&&items.length>1){
      L=Math.min(...items.map(i=>i.b.cx-i.hw));R=Math.max(...items.map(i=>i.b.cx+i.hw));
      Tp=Math.min(...items.map(i=>i.b.cy-i.hh));B=Math.max(...items.map(i=>i.b.cy+i.hh));
    }
    const mx=(L+R)/2,my=(Tp+B)/2;
    if((mode==='dh'||mode==='dv')&&items.length<3){toast('Bagi rata butuh minimal 3 clip terpilih');return}
    APK.history.record();
    if(mode==='dh'||mode==='dv'){
      const h=mode==='dh',key=h?'cx':'cy',ext=h?'hw':'hh',ax=h?'x':'y';
      items.sort((a,b)=>a.b[key]-b.b[key]);
      const s=items[0].b[key]-items[0][ext],e=items[items.length-1].b[key]+items[items.length-1][ext],tot=items.reduce((a,i)=>a+2*i[ext],0),gap=((e-s)-tot)/(items.length-1);
      let cur=s;
      for(const i of items){const d=cur+i[ext]-i.b[key];if(Math.abs(d)>0.01)shiftProp(i.f.c,ax,d);cur+=2*i[ext]+gap}
    }else{
      for(const i of items){
        let dx=0,dy=0;
        if(mode==='l')dx=L+i.hw-i.b.cx;else if(mode==='r')dx=R-i.hw-i.b.cx;else if(mode==='ch')dx=mx-i.b.cx;
        else if(mode==='t')dy=Tp+i.hh-i.b.cy;else if(mode==='b')dy=B-i.hh-i.b.cy;else if(mode==='cv')dy=my-i.b.cy;
        if(Math.abs(dx)>0.01)shiftProp(i.f.c,'x',dx);if(Math.abs(dy)>0.01)shiftProp(i.f.c,'y',dy);
      }
    }
    T.commit();
    if(items.length<l.length)toast((l.length-items.length)+' clip dilewati (tidak tampil di playhead atau punya induk)');
  }

  /* ===== TEKS ===== */
  const TS=[
    {n:'Judul tebal',t:{font:'Impact, "Arial Black", sans-serif',size:150,bold:false,color:'#ffffff',stroke:'#000000',strokeW:10}},
    {n:'Neon biru',t:{font:'"Trebuchet MS", Verdana, sans-serif',size:130,color:'#e6fbff',shadowOn:true,shadowColor:'#00d4ff',shadowBlur:40,shadowX:0,shadowY:0}},
    {n:'Neon pink',t:{font:'"Trebuchet MS", Verdana, sans-serif',size:130,color:'#ffe6f6',shadowOn:true,shadowColor:'#ff2fb3',shadowBlur:40,shadowX:0,shadowY:0}},
    {n:'Caption kotak',t:{size:64,color:'#ffffff',bgOn:true,bg:'#000000'},y:0.34},
    {n:'Kuning komik',t:{font:'"Comic Sans MS", "Segoe Script", cursive',size:120,color:'#ffe14d',stroke:'#000000',strokeW:12}},
    {n:'Sunset',t:{size:160,gradOn:true,color:'#ffd93b',color2:'#ff2d87',gradAngle:90,stroke:'#3a0a2e',strokeW:6}},
    {n:'Emas',t:{font:'Georgia, "Times New Roman", serif',size:150,gradOn:true,color:'#fff3b0',color2:'#c9a227',gradAngle:90,stroke:'#4a3600',strokeW:6,shadowOn:true,shadowColor:'#000000',shadowBlur:16,shadowX:3,shadowY:5}},
    {n:'Kotak merah',t:{size:90,color:'#ffffff',bgOn:true,bg:'#e11d48'}},
    {n:'Retro',t:{font:'Impact, "Arial Black", sans-serif',size:140,bold:false,color:'#ff5fb0',stroke:'#2b0b3a',strokeW:8,shadowOn:true,shadowColor:'#2b0b3a',shadowBlur:0,shadowX:10,shadowY:10}},
    {n:'Tulisan tangan',t:{font:'"Comic Sans MS", "Segoe Script", cursive',size:120,bold:false,italic:true,color:'#ffffff',shadowOn:true,shadowColor:'#000000',shadowBlur:10,shadowX:2,shadowY:3}},
    {n:'Elegan',t:{font:'Georgia, "Times New Roman", serif',size:100,bold:false,italic:true,color:'#f5f5f5',shadowOn:true,shadowColor:'#000000',shadowBlur:18,shadowX:0,shadowY:4}},
    {n:'Terminal',t:{font:'"Courier New", monospace',size:90,color:'#39ff14',bgOn:true,bg:'#000000'}}
  ];
  const TANIM=[['none','Tanpa animasi'],['pop','Pop'],['fade','Memudar'],['zoom','Zoom masuk'],['slideU','Geser dari atas'],['slideD','Geser dari bawah'],['drop','Jatuh memantul']];
  function styleTx(st){
    const p=P(),k=Math.min(p.width,p.height)/1080,t=Object.assign({},st.t);
    for(const q of ['size','strokeW','shadowBlur','shadowX','shadowY'])if(t[q])t[q]=Math.round(t[q]*k);
    return t;
  }
  function applyStyle(i){
    const st=TS[i],p=P();if(!p)return;
    const cur=unlocked(sel()).filter(f=>f.c.text&&!f.c.stk);
    if(cur.length){
      APK.history.record();
      for(const f of cur){
        const keepC=f.c.text.content;
        f.c.text=Object.assign({},APK.text.DEF,styleTx(st),{content:keepC});
        if(st.y!=null){f.c.props=Object.assign({},APK.kf.DEF,f.c.props);if(!APK.kf.animated(f.c,'y'))f.c.props.y=Math.round(st.y*p.height)}
      }
      T.commit();toast('Gaya "'+st.n+'" dipakai ke '+cur.length+' teks');return;
    }
    const tx=Object.assign(APK.text.make(),styleTx(st),{content:'Teks baru'});
    const r=addOverlay({text:tx,props:{x:0,y:Math.round((st.y||0)*p.height),scale:1,opacity:1,rotation:0,volume:1}});
    if(S.tanim!=='none'&&APK.anim){try{APK.anim.applyTo(r.c,'in',S.tanim,0.5)}catch(_){}}
    T.commit();T.select(r.c.id);toast('Teks "'+st.n+'" ditambahkan. Ubah isinya di panel Properti');
  }
  function t2s(s){let r=0;for(const x of s.replace(',','.').split(':'))r=r*60+(+x);return r}
  function parseSrt(txt){
    txt=String(txt).replace(/\r/g,'').replace(/^\uFEFF/,'');
    const re=/([\d:]+[,.]\d{1,3})\s*-->\s*([\d:]+[,.]\d{1,3})/,out=[];
    for(const b of txt.split(/\n{2,}/)){
      const ln=b.split('\n'),k=ln.findIndex(x=>re.test(x));if(k<0)continue;
      const m=ln[k].match(re),a=t2s(m[1]),e=t2s(m[2]),text=ln.slice(k+1).join('\n').replace(/<[^>]+>/g,'').trim();
      if(text&&e>a&&isFinite(a)&&isFinite(e))out.push({a,e,text});
    }
    return out.sort((x,y)=>x.a-y.a);
  }
  const SRTST={putih:{color:'#ffffff',stroke:'#000000',strokeW:6,bgOn:false},kotak:{color:'#ffffff',strokeW:0,bgOn:true,bg:'#000000'},kuning:{color:'#ffe14d',stroke:'#000000',strokeW:6,bgOn:false}};
  function importSrt(txt){
    const cues=parseSrt(txt);
    if(!cues.length){toast('Tidak ada subtitle yang terbaca di file itu');return}
    const p=P(),off=S.srtAt==='head'?APK.preview.time:0,k=Math.min(p.width,p.height),st=SRTST[S.srtStyle]||SRTST.putih;
    APK.history.record();
    const tr=mkTrack('video');tr.name='Subtitle';p.tracks.unshift(tr);
    const clips=[];
    for(const q of cues){
      const prev=clips[clips.length-1],s=q.a+off;
      if(prev&&prev.start+prev.dur>s+EPS)prev.dur=Math.max(0.05,s-prev.start);
      clips.push({id:uid('c_'),mediaId:null,start:s,in:0,dur:Math.max(0.1,q.e-q.a),props:{x:0,y:Math.round(p.height*0.36),scale:1,opacity:1,rotation:0,volume:1},
        text:Object.assign(APK.text.make(),{content:q.text.replace(/\n{2,}/g,'\n'),size:Math.round(k*0.06),bold:true},st)});
    }
    tr.clips=clips;
    T.commit();toast(clips.length+' subtitle ditambahkan di track "Subtitle"');
  }
  function exportSrt(){
    const l=[];for(const tr of P().tracks)for(const c of tr.clips)if(c.text&&!c.stk&&String(c.text.content).trim())l.push(c);
    if(!l.length){toast('Belum ada klip teks');return}
    l.sort((a,b)=>a.start-b.start);
    const ts=s=>{const ms=Math.round(s*1000);return pad2(Math.floor(ms/3600000))+':'+pad2(Math.floor(ms%3600000/60000))+':'+pad2(Math.floor(ms%60000/1000))+','+String(ms%1000).padStart(3,'0')};
    const out=l.map((c,i)=>`${i+1}\n${ts(c.start)} --> ${ts(c.start+c.dur)}\n${String(c.text.content).replace(/\n{2,}/g,'\n').trim()}\n`).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:'text/plain'}));
    a.download=(P().name||'subtitle')+'.srt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    toast(l.length+' subtitle diekspor');
  }

  /* ===== MUSIK ===== */
  async function detectBeats(){
    const l=sel(),pf=l.find(f=>hasAudio(f)&&!f.c.reverse);
    if(!pf){toast('Pilih clip audio (atau video bersuara) yang mau dideteksi ketukannya');return}
    toast('Menganalisis ketukan…');
    let buf;try{buf=await decode(pf.c.mediaId)}catch(e){toast('Gagal: '+e.message);return}
    const c=pf.c,sp=spOf(c),bt=beatTimes(buf,c.in,c.in+c.dur*sp,+S.beatSens);
    if(!bt.length){toast('Ketukan tidak terdeteksi. Coba pilihan "Banyak"');return}
    const a=c.start-EPS,b=c.start+c.dur+EPS;
    P().markers=markers().filter(m=>!(m.k==='b'&&m.t>=a&&m.t<=b));
    let n=0;for(const s of bt){const t=tlTime(c,s);if(t>=a&&t<=b&&addMarker(t,'b','Ketukan'))n++}
    T.commit();render();
    toast(n+' ketukan ditandai. Pakai "Sebar clip ke ketukan" untuk menyusun foto/video');
  }
  function snapToMarkers(){
    const l=unlocked(sel()).filter(f=>!f.c.fx&&f.tr.kind!=='audio');
    if(!l.length){toast('Pilih clip video/foto yang mau disebar ke ketukan');return}
    const ms=markers();let pts=ms.filter(m=>m.k==='b').map(m=>m.t);if(pts.length<2)pts=ms.map(m=>m.t);
    const t0=APK.preview.time;pts=pts.filter(t=>t>=t0-0.01).sort((a,b)=>a-b);
    const N=Math.max(1,Math.round(+S.beatN||1));
    if(pts.length<N+1){toast('Penanda kurang. Taruh playhead di awal bagian yang dimau, pastikan ada penanda/ketukan setelahnya');return}
    const list=[...l].sort((a,b)=>a.c.start-b.c.start),ids=list.map(f=>f.c.id),plan=[];
    let skipped=0;
    list.forEach((f,i)=>{
      const s=pts[i*N];if(s==null){skipped++;return}
      let e=pts[(i+1)*N];if(e==null)e=s+(pts[N]-pts[0]);
      let d=e-s;const m=media(f.c.mediaId);
      if(m&&m.type!=='image'&&m.duration>0)d=Math.min(d,(m.duration-f.c.in)/spOf(f.c));
      d=Math.max(0.1,d);
      if(!free(f.tr,s,d,ids)){skipped++;return}
      plan.push([f.c,s,d]);
    });
    if(!plan.length){toast('Tidak ada clip yang bisa dipindah (bentrok dengan clip lain)');return}
    APK.history.record();
    for(const q of plan){q[0].start=q[1];q[0].dur=q[2]}
    T.commit();
    toast(plan.length+' clip disebar ke ketukan'+(skipped?', '+skipped+' dilewati':''));
  }

  /* ===== KREASI ===== */
  function kenBurns(){
    const l=unlocked(sel()).filter(f=>!f.c.fx&&!f.c.text&&!f.c.shape&&f.tr.kind!=='audio');
    if(!l.length){toast('Pilih foto atau video dulu');return}
    const p=P(),W=p.width,str=Math.max(3,Math.min(50,+S.kbStr||15))/100,order=['in','out','kiri','kanan','atas','bawah'],amp=W*str*0.4,ampY=p.height*str*0.4;
    APK.history.record();
    [...l].sort((a,b)=>a.c.start-b.c.start).forEach((f,i)=>{
      const c=f.c,st=S.kb==='mix'?order[i%order.length]:S.kb,b=APK.kf.props(c,0),D=c.dur;
      const set=(pr,a,z)=>{c.kf=c.kf||{};c.kf[pr]=[{t:0,v:Math.round(a*1000)/1000,e:'inout'},{t:D,v:Math.round(z*1000)/1000,e:'inout'}]};
      delete c.anim;
      c.props=Object.assign({},APK.kf.DEF,c.props);
      if(st==='in')set('scale',b.scale,b.scale*(1+str));
      else if(st==='out')set('scale',b.scale*(1+str),b.scale);
      else{
        set('scale',b.scale*(1+str),b.scale*(1+str));
        if(st==='kiri')set('x',b.x+amp,b.x-amp);else if(st==='kanan')set('x',b.x-amp,b.x+amp);
        else if(st==='atas')set('y',b.y+ampY,b.y-ampY);else set('y',b.y-ampY,b.y+ampY);
      }
    });
    T.commit();toast('Ken Burns dipasang ke '+l.length+' clip (jadi keyframe biasa)');
  }
  function encodeWav(buf){
    const sr=buf.sampleRate,n=buf.length,chs=buf.numberOfChannels,mono=new Float32Array(n);
    for(let k=0;k<chs;k++){const d=buf.getChannelData(k);for(let i=0;i<n;i++)mono[i]+=d[i]/chs}
    const ab=new ArrayBuffer(44+n*2),dv=new DataView(ab),ws=(o,s)=>{for(let i=0;i<s.length;i++)dv.setUint8(o+i,s.charCodeAt(i))};
    ws(0,'RIFF');dv.setUint32(4,36+n*2,true);ws(8,'WAVE');ws(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
    dv.setUint32(24,sr,true);dv.setUint32(28,sr*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);ws(36,'data');dv.setUint32(40,n*2,true);
    for(let i=0;i<n;i++){const s=Math.max(-1,Math.min(1,mono[i]));dv.setInt16(44+i*2,s<0?s*0x8000:s*0x7fff,true)}
    return new Blob([ab],{type:'audio/wav'});
  }
  async function addVoice(blob,at){
    let buf;
    try{
      const AC=window.AudioContext||window.webkitAudioContext,ac=new AC();
      try{buf=await ac.decodeAudioData(await blob.arrayBuffer())}finally{try{ac.close()}catch(_){}}
    }catch(e){toast('Rekaman tidak bisa diproses browser ini');return}
    const file=new File([encodeWav(buf)],'rekaman-'+new Date().toTimeString().slice(0,8).replace(/:/g,'')+'.wav',{type:'audio/wav'});
    const ids=await APK.media.importFiles([file],toast);if(!ids||!ids.length)return;
    const m=media(ids[0]),d=m&&m.duration>0?m.duration:buf.duration,p=P();
    APK.history.record();
    let tr=p.tracks.find(t=>t.kind==='audio'&&!t.locked&&free(t,at,d,null));
    if(!tr){tr=mkTrack('audio');p.tracks.push(tr)}
    const c={id:uid('c_'),mediaId:ids[0],start:at,in:0,dur:d,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}};
    tr.clips.push(c);T.commit();T.select(c.id);
    toast('Rekaman ditambahkan di '+APK.preview.fmt(at));
  }
  async function toggleRec(){
    if(rec){rec.mr.stop();return}
    if(!P())return;
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){toast('Browser ini tidak mendukung rekam suara');return}
    let stream;
    try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
    catch(e){toast('Izin mikrofon ditolak atau mikrofon tidak ditemukan');return}
    const mr=new MediaRecorder(stream),chunks=[],at=APK.preview.time;
    mr.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    mr.onstop=async()=>{
      stream.getTracks().forEach(t=>t.stop());
      if(APK.preview.playing)APK.preview.pause();
      rec=null;render();
      await addVoice(new Blob(chunks,{type:mr.mimeType||'audio/webm'}),at);
    };
    rec={mr,at};mr.start();
    if(S.recPlay&&!APK.preview.playing)APK.preview.play();
    render();toast('Merekam… gunakan headset supaya suara video tidak ikut terekam');
  }

  /* ===== PROYEK: versi (IndexedDB sendiri) ===== */
  const SDB={db:null,
    open(){return this.db||(this.db=new Promise((res,rej)=>{const r=indexedDB.open('splineway-snaps',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('s',{keyPath:'id'});s.createIndex('pid','pid')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))},
    async tx(mode,fn){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction('s',mode),rq=fn(t.objectStore('s'));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)})},
    put(o){return this.tx('readwrite',s=>s.put(o))},del(id){return this.tx('readwrite',s=>s.delete(id))},list(pid){return this.tx('readonly',s=>s.index('pid').getAll(pid))}};
  let snaps=[],lastSnapStr='';
  async function loadSnaps(){
    const p=P();if(!p)return;
    try{snaps=((await SDB.list(p.id))||[]).sort((a,b)=>b.time-a.time)}catch(_){snaps=[]}
    if(snaps.length)lastSnapStr=snaps[0].tracks;
    if(tab==='proyek')render();
  }
  async function saveSnap(name,auto){
    const p=P();if(!p)return false;
    const s=JSON.stringify(p.tracks);
    if(auto&&s===lastSnapStr)return false;
    if(s.length>6e6){if(!auto)toast('Project terlalu besar untuk titik pulih');return false}
    const o={id:uid('v_'),pid:p.id,name:name||(auto?'Otomatis':'Versi'),time:Date.now(),auto:!!auto,tracks:s,n:p.tracks.reduce((a,t)=>a+t.clips.length,0)};
    try{
      await SDB.put(o);snaps.unshift(o);lastSnapStr=s;
      const autos=snaps.filter(x=>x.auto);
      for(const x of autos.slice(5)){await SDB.del(x.id);snaps=snaps.filter(y=>y!==x)}
      if(snaps.length>40){const x=snaps[snaps.length-1];await SDB.del(x.id);snaps.pop()}
    }catch(e){if(!auto)toast('Gagal menyimpan versi');return false}
    return true;
  }
  function restoreSnap(id){
    const s=snaps.find(x=>x.id===id);if(!s||!P())return;
    if(!confirm('Pulihkan "'+s.name+'"? Susunan track sekarang diganti (bisa di-Undo).'))return;
    APK.history.record();T.restore(s.tracks);toast('Versi dipulihkan. Tekan Undo untuk membatalkan');
  }

  /* ===== PROYEK: salin & tempel pengaturan ===== */
  const CG={gerak:['Gerakan, posisi, keyframe',['props','kf','anim','mp','anchor']],tampil:['Filter, blend, balik',['flt','blend','flipX','flipY']],trans:['Transisi masuk/keluar',['tin','tout']],
    kunci:['Chroma key & mask',['chroma','mask']],audio:['Fade & bisu audio',['fadeIn','fadeOut','mute']],teks:['Gaya teks (isi tetap)',['text']]};
  function copyStyle(){
    const l=sel();if(l.length!==1){toast('Pilih satu clip sumber');return}
    const c=l[0].c,keys=new Set();
    for(const g in S.cg)if(S.cg[g])for(const k of CG[g][1])keys.add(k);
    styleBuf={dur:c.dur,data:{},keys:[...keys],src:c.id};
    for(const k of keys)if(c[k]!=null)styleBuf.data[k]=clone(c[k]);
    toast('Pengaturan clip disalin ('+Object.keys(styleBuf.data).length+' bagian)');render();
  }
  function pasteStyle(){
    if(!styleBuf){toast('Belum ada pengaturan yang disalin');return}
    const l=unlocked(sel()).filter(f=>f.c.id!==styleBuf.src);
    if(!l.length){toast('Pilih clip tujuan');return}
    APK.history.record();
    for(const f of l){
      const c=f.c,r=c.dur/Math.max(0.01,styleBuf.dur);
      for(const k of styleBuf.keys){
        if(k==='text'){if(c.text&&styleBuf.data.text)c.text=Object.assign({},clone(styleBuf.data.text),{content:c.text.content});continue}
        if(k==='props'&&c.fx)continue;
        if(styleBuf.data[k]!=null){
          c[k]=clone(styleBuf.data[k]);
          if(k==='kf'&&Math.abs(r-1)>0.001)for(const p in c.kf)for(const q of c.kf[p])q.t=Math.round(q.t*r*10000)/10000;
        }else delete c[k];
      }
    }
    T.commit();toast('Pengaturan ditempel ke '+l.length+' clip');
  }

  /* ===== PROYEK: garis panduan preview ===== */
  let gSig='';
  function drawGuides(){
    const wrap=$('preview-wrap'),p=P();if(!wrap||!p)return;
    let cv=$('st-guides');
    const g=S.g,any=g.third||g.center||g.safe||g.social;
    if(!cv){if(!any)return;cv=document.createElement('canvas');cv.id='st-guides';wrap.appendChild(cv)}
    if(!any){cv.style.display='none';gSig='';return}
    const ww=wrap.clientWidth,hh=wrap.clientHeight;if(!ww||!hh)return;
    const sig=[ww,hh,p.width,p.height,g.third,g.center,g.safe,g.social].join();
    if(sig===gSig&&cv.style.display!=='none')return;gSig=sig;
    const a=p.width/p.height;let w=ww,h=ww/a;if(h>hh){h=hh;w=hh*a}
    const dpr=window.devicePixelRatio||1;
    cv.style.cssText=`display:block;position:absolute;left:${(ww-w)/2}px;top:${(hh-h)/2}px;width:${w}px;height:${h}px;pointer-events:none;z-index:3`;
    cv.width=Math.max(1,Math.round(w*dpr));cv.height=Math.max(1,Math.round(h*dpr));
    const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);x.lineWidth=1;
    const line=(x1,y1,x2,y2)=>{x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke()};
    if(g.third){x.strokeStyle='rgba(255,255,255,.55)';line(w/3,0,w/3,h);line(w*2/3,0,w*2/3,h);line(0,h/3,w,h/3);line(0,h*2/3,w,h*2/3)}
    if(g.center){x.strokeStyle='rgba(255,214,10,.85)';line(w/2,0,w/2,h);line(0,h/2,w,h/2)}
    if(g.safe){x.strokeStyle='rgba(120,255,160,.8)';x.setLineDash([6,4]);x.strokeRect(w*0.05,h*0.05,w*0.9,h*0.9);x.strokeRect(w*0.1,h*0.1,w*0.8,h*0.8);x.setLineDash([])}
    if(g.social){
      x.fillStyle='rgba(255,60,60,.2)';x.fillRect(0,0,w,h*0.14);x.fillRect(0,h*0.78,w,h*0.22);x.fillRect(w*0.86,h*0.14,w*0.14,h*0.64);
      x.strokeStyle='rgba(255,90,90,.9)';x.setLineDash([5,4]);x.strokeRect(0,h*0.14,w*0.86,h*0.64);x.setLineDash([]);
    }
  }

  /* ===== antarmuka ===== */
  const TABS=[['susun','✂ Susun'],['rata','⌖ Rata'],['teks','T Teks'],['musik','♪ Musik'],['kreasi','✦ Kreasi'],['proyek','⚙ Proyek']];
  const num=(k,l,min,max,step)=>`<label>${l}<input type="number" data-s="${k}" min="${min}" max="${max}" step="${step}" value="${S[k]}"></label>`;
  const chk=(k,l)=>`<label class="st-ck"><input type="checkbox" data-s="${k}"${S[k]?' checked':''}> ${l}</label>`;
  const sl=(k,l,o)=>`<label>${l}<select data-s="${k}">${o.map(x=>`<option value="${x[0]}"${String(S[k])===String(x[0])?' selected':''}>${x[1]}</option>`).join('')}</select></label>`;
  const bt=(a,l,cls,ttl)=>`<button type="button" class="btn ${cls||''}" data-act="${a}"${ttl?` title="${esc(ttl)}"`:''}>${l}</button>`;
  const sec=(h,body)=>`<section class="st-sec"><h4>${h}</h4>${body}</section>`;
  const note=t=>`<p class="st-note">${t}</p>`;
  const fmtT=t=>APK.preview.fmt(t);
  function tsPreview(st){
    const t=st.t,f=t.font||APK.text.DEF.font;
    let css=`font-family:${f.replace(/"/g,"'")};font-weight:${t.bold===false?400:700};font-style:${t.italic?'italic':'normal'};color:${t.color||'#fff'};`;
    if(t.gradOn)css+=`background:linear-gradient(180deg,${t.color},${t.color2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;`;
    if(t.strokeW&&!t.gradOn)css+=`-webkit-text-stroke:${Math.min(2,t.strokeW/6)}px ${t.stroke};`;
    if(t.shadowOn)css+=`text-shadow:${(t.shadowX||0)/5}px ${(t.shadowY||0)/5}px ${(t.shadowBlur||0)/5}px ${t.shadowColor};`;
    if(t.bgOn)css+=`background:${t.bg};padding:0 6px;border-radius:3px;`;
    return css;
  }
  function body(){
    const p=P();if(!p)return note('Buka project dulu.');
    if(tab==='susun')return sec('Rapikan timeline',
        bt('gaps','Rapatkan celah','','Geser clip di track terpilih supaya tidak ada ruang kosong di antaranya')+' '+bt('ripdel','Hapus &amp; rapatkan','','Hapus clip terpilih lalu geser clip setelahnya ke kiri (Shift+Delete)')+
        chk('rdAll','Hapus &amp; rapatkan juga menggeser track lain')+note('Pilih clip dulu di timeline.'))+
      sec('Samakan durasi',num('dur','Durasi tiap clip (detik)',0.1,600,0.1)+chk('pack','Susun berurutan tanpa celah')+bt('equal','Terapkan ke clip terpilih','primary')+note('Cocok untuk slideshow foto. Video dibatasi panjang aslinya.'))+
      sec('Beku frame',num('fz','Lama beku (detik)',0.2,30,0.1)+chk('fzAll','Geser semua track (musik ikut terbelah)')+bt('freeze','Bekukan frame di playhead','primary')+note('Pilih satu clip video, taruh playhead di frame yang mau dibekukan.'))+
      sec('Buang bagian hening',num('silDb','Dianggap hening di bawah (dB)',-70,-10,1)+num('silMin','Hening minimal (detik)',0.1,10,0.1)+num('silPad','Sisakan di tepi (detik)',0,1,0.01)+chk('silAll','Potong juga track lain (tanpa memilih)')+bt('silence','Buang bagian hening','primary')+note('Pilih clip video/audio bersuara. Track dari clip terpilih ikut dipotong supaya tetap sinkron.'));
    if(tab==='rata')return sec('Ratakan clip terpilih',sl('alignTo','Terhadap',[['screen','Layar'],['sel','Kotak pilihan (butuh 2+ clip)']])+
        `<div class="st-grid3">${bt('al:l','⇤ Kiri')}${bt('al:ch','↔ Tengah')}${bt('al:r','Kanan ⇥')}${bt('al:t','⤒ Atas')}${bt('al:cv','↕ Tengah')}${bt('al:b','Bawah ⤓')}</div>
        <div class="st-grid3 two">${bt('al:dh','⇹ Bagi rata mendatar')}${bt('al:dv','⇕ Bagi rata tegak')}</div>`+
        note('Clip harus terlihat di preview pada posisi playhead. Posisi yang sudah beranimasi ikut digeser seluruhnya.'));
    if(tab==='teks')return sec('Gaya teks siap pakai',sl('tanim','Animasi masuk (teks baru)',TANIM)+
        `<div class="st-ts">${TS.map((s,i)=>`<button type="button" class="st-tsb" data-act="ts:${i}" title="${esc(s.n)}"><span style="${tsPreview(s)}">Aa</span><small>${esc(s.n)}</small></button>`).join('')}</div>`+
        note('Ketuk gaya: dipakai ke teks yang sedang dipilih, atau membuat teks baru di playhead kalau tidak ada teks terpilih.'))+
      sec('Subtitle (.srt / .vtt)',sl('srtAt','Mulai dari',[['zero','Awal timeline'],['head','Posisi playhead']])+sl('srtStyle','Gaya',[['putih','Putih + garis hitam'],['kotak','Putih di kotak hitam'],['kuning','Kuning + garis hitam']])+
        `<div class="st-two">${bt('srtin','Impor subtitle','primary')}${bt('srtout','Ekspor .srt')}</div>`+note('Tiap baris subtitle jadi klip teks di track "Subtitle", bisa diedit satu per satu.'));
    if(tab==='musik'){
      const ms=markers(),shown=ms.slice(0,50);
      return sec('Penanda',`<div class="st-two">${bt('mkadd','◆ Tambah di playhead (M)','primary')}${bt('mkclr','Hapus semua')}</div><div class="st-two">${bt('mkprev','◀ Sebelumnya (,)')}${bt('mknext','Berikutnya (.) ▶')}</div>`+
          (ms.length?`<div class="st-list">${shown.map((m,i)=>`<div class="st-row"><span>${m.k==='b'?'♪':'◆'} ${fmtT(m.t)}</span><span><button type="button" class="btn" data-act="mkgo:${i}" aria-label="Loncat">↦</button><button type="button" class="btn" data-act="mkdel:${i}" aria-label="Hapus penanda">✕</button></span></div>`).join('')}${ms.length>shown.length?`<p class="st-note">+${ms.length-shown.length} penanda lain</p>`:''}</div>`:note('Belum ada penanda.')))+
        sec('Deteksi ketukan otomatis',sl('beatSens','Jumlah ketukan',[['0','Sedikit (beat utama)'],['1','Sedang'],['2','Banyak']])+bt('beats','♪ Deteksi dari clip terpilih','primary')+note('Pilih clip lagu (atau video bersuara). Ketukan jadi penanda kecil di penggaris timeline.'))+
        sec('Sebar clip ke ketukan',sl('beatN','Satu clip tiap',[['1','1 ketukan'],['2','2 ketukan'],['4','4 ketukan'],['8','8 ketukan']])+bt('snapmk','Sebar clip terpilih','primary')+note('Taruh playhead di awal bagian yang dimau, pilih foto/video, lalu tekan. Clip disusun berurutan, panjangnya mengikuti jarak ketukan.'));
    }
    if(tab==='kreasi')return sec('Ken Burns otomatis',sl('kb','Gerakan',[['mix','Berganti-ganti (disarankan)'],['in','Zoom masuk pelan'],['out','Zoom keluar pelan'],['kiri','Geser ke kiri'],['kanan','Geser ke kanan'],['atas','Geser ke atas'],['bawah','Geser ke bawah']])+
        num('kbStr','Kekuatan (%)',3,50,1)+bt('kb','Pasang ke clip terpilih','primary')+note('Memberi keyframe zoom dan geser halus di foto atau video. Pilih banyak foto sekaligus untuk slideshow hidup. Menggantikan animasi cepat clip itu.'))+
      sec('Rekam suara (voice-over)',chk('recPlay','Putar timeline sambil merekam')+bt('rec',rec?'■ Berhenti merekam':'● Mulai rekam',rec?'danger':'primary')+note(rec?'Sedang merekam dari '+fmtT(rec.at)+'…':'Rekaman dimulai dari posisi playhead dan otomatis masuk ke track audio. Pakai headset supaya suara video tidak ikut terekam.'));
    if(tab==='proyek'){
      const fmtD=t=>new Date(t).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'});
      return sec('Versi / titik pulih',`<label>Nama versi<input type="text" data-s="snapName" maxlength="40" placeholder="mis. sebelum edit teks" value="${esc(S.snapName)}"></label>${bt('snap','Simpan versi sekarang','primary')}`+
          (snaps.length?`<div class="st-list">${snaps.map(s=>`<div class="st-row"><span title="${esc(s.name)}">${s.auto?'⟳':'★'} ${esc(s.name)}<small>${fmtD(s.time)} · ${s.n} clip</small></span><span><button type="button" class="btn" data-act="sv:${s.id}" title="Pulihkan versi ini">↺</button><button type="button" class="btn" data-act="sd:${s.id}" aria-label="Hapus versi">✕</button></span></div>`).join('')}</div>`:note('Belum ada versi. Versi otomatis disimpan tiap 4 menit saat ada perubahan.'))+note('Hanya susunan track yang disimpan (bukan file media), dan tersimpan di browser ini saja.'))+
        sec('Salin &amp; tempel pengaturan',Object.keys(CG).map(g=>`<label class="st-ck"><input type="checkbox" data-cg="${g}"${S.cg[g]?' checked':''}> ${CG[g][0]}</label>`).join('')+
          `<div class="st-two">${bt('cpy','Salin dari clip')}${bt('pst','Tempel ke terpilih','primary')}</div>`+note(styleBuf?'Tersalin: '+Object.keys(styleBuf.data).length+' bagian.':'Pilih satu clip sumber, tekan Salin, lalu pilih clip tujuan (boleh banyak) dan tekan Tempel.'))+
        sec('Garis panduan preview',['third:Sepertiga (rule of thirds)','center:Garis tengah','safe:Area aman judul','social:Zona UI Reels/TikTok'].map(s=>{const q=s.split(':');return `<label class="st-ck"><input type="checkbox" data-g="${q[0]}"${S.g[q[0]]?' checked':''}> ${q[1]}</label>`}).join('')+note('Hanya bantuan di preview, tidak ikut ter-export. Pintasan G untuk sepertiga.'));
    }
    return '';
  }
  function render(){
    const b=$('st-body');if(!b)return;
    const sc=b.scrollTop;
    b.innerHTML=body();b.scrollTop=sc;
    document.querySelectorAll('#st-tabs button').forEach(x=>x.classList.toggle('on',x.dataset.tab===tab));
  }
  function selInfo(){
    const e=$('st-sel'),p=$('st-panel');if(!e||!p||p.hidden)return;
    const l=P()?sel():[];
    e.textContent=l.length?l.length+' clip terpilih':'Belum ada clip terpilih';
  }
  const ACT={
    gaps:closeGaps,ripdel:rippleDelete,equal:equalize,freeze:freezeFrame,silence:removeSilence,
    srtin:()=>{$('st-file').value='';$('st-file').click()},srtout:exportSrt,
    mkadd:()=>{if(!P())return;if(addMarker(APK.preview.time,'m','Penanda')){drawMarks();render();toast('Penanda ditambahkan')}else toast('Sudah ada penanda di sini')},
    mkclr:()=>{if(P()&&markers().length&&confirm('Hapus semua penanda?')){P().markers=[];drawMarks();render();APK.project.markDirty()}},
    mkprev:()=>jumpMarker(-1),mknext:()=>jumpMarker(1),beats:detectBeats,snapmk:snapToMarkers,
    kb:kenBurns,rec:toggleRec,
    snap:async()=>{if(await saveSnap((S.snapName||'').trim()||'Versi '+(snaps.filter(x=>!x.auto).length+1),false)){toast('Versi disimpan');render()}},
    cpy:copyStyle,pst:pasteStyle
  };
  function onClick(e){
    const b=e.target.closest('[data-act]');if(!b)return;
    const a=b.dataset.act,i=a.indexOf(':'),k=i<0?a:a.slice(0,i),v=i<0?'':a.slice(i+1);
    if(k==='al')align(v);
    else if(k==='ts')applyStyle(+v);
    else if(k==='mkgo'){const m=markers()[+v];if(m)APK.preview.seek(m.t)}
    else if(k==='mkdel'){const ms=markers();if(ms[+v]){ms.splice(+v,1);drawMarks();render();APK.project.markDirty()}}
    else if(k==='sv')restoreSnap(v);
    else if(k==='sd'){SDB.del(v).then(()=>{snaps=snaps.filter(x=>x.id!==v);render()})}
    else if(ACT[k])Promise.resolve(ACT[k]()).catch(err=>{console.error(err);toast('Gagal: '+(err&&err.message||err))});
  }
  function onChange(e){
    const el=e.target,d=el.dataset;
    if(d.s){
      const k=d.s;
      if(el.type==='checkbox')S[k]=el.checked;
      else if(el.type==='number'){const v=parseFloat(el.value);if(isFinite(v))S[k]=v}
      else S[k]=el.value;
      keep();
    }else if(d.g){S.g[d.g]=el.checked;keep();drawGuides()}
    else if(d.cg){S.cg[d.cg]=el.checked;keep()}
  }
  function open(show){
    const p=$('st-panel');if(!p)return;
    const on=show==null?p.hidden:show;
    p.hidden=!on;
    const b=$('tl-studio');if(b)b.classList.toggle('on',on);
    if(on){render();selInfo();if(tab==='proyek'&&P())loadSnaps()}
  }
  function build(){
    document.body.insertAdjacentHTML('beforeend',`<aside id="st-panel" class="st-panel" hidden aria-label="Studio Pro"><header class="st-head"><b>🧰 Studio Pro</b><span id="st-sel" class="meta"></span><button type="button" class="btn" id="st-x" aria-label="Tutup">✕</button></header>
      <nav id="st-tabs" class="st-tabs">${TABS.map(t=>`<button type="button" data-tab="${t[0]}">${t[1]}</button>`).join('')}</nav><div id="st-body" class="st-body"></div></aside>
      <input type="file" id="st-file" accept=".srt,.vtt,text/plain" hidden>`);
    $('st-x').onclick=()=>open(false);
    $('st-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;render();if(tab==='proyek'&&P())loadSnaps()};
    const bd=$('st-body');bd.addEventListener('click',onClick);bd.addEventListener('change',onChange);
    $('st-file').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{importSrt(await f.text())}catch(err){toast('File subtitle tidak bisa dibaca')}};
    const after=$('tl-fx')||$('tl-group');
    const b=document.createElement('button');b.type='button';b.className='btn';b.id='tl-studio';b.textContent='🧰 Studio';
    b.title='Studio Pro: rapikan timeline, beku frame, buang hening, ratakan, gaya teks, subtitle, ketukan musik, Ken Burns, rekam suara, versi';
    b.onclick=()=>open();
    if(after)after.after(b);else{const bar=document.querySelector('.tl-bar');if(bar)bar.appendChild(b)}
    const tc=$('tl-content');
    if(tc)new MutationObserver(drawMarks).observe(tc,{childList:true});
    const wrap=$('preview-wrap');
    if(wrap&&window.ResizeObserver)new ResizeObserver(()=>drawGuides()).observe(wrap);
    const asp=$('pv-aspect');if(asp)asp.addEventListener('change',()=>setTimeout(drawGuides,80));
    APK.project.onChange(()=>{drawGuides()});
    window.addEventListener('keydown',e=>{
      const p=P();
      if(!p||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;
      const k=e.key;
      if(k==='Delete'&&e.shiftKey){e.preventDefault();e.stopPropagation();rippleDelete()}
      else if(k==='m'||k==='M'){e.preventDefault();ACT.mkadd()}
      else if(k===','){e.preventDefault();jumpMarker(-1)}
      else if(k==='.'){e.preventDefault();jumpMarker(1)}
      else if(k==='g'||k==='G'){e.preventDefault();S.g.third=!S.g.third;keep();drawGuides();if(tab==='proyek')render()}
    },true);
    setInterval(selInfo,700);
    setInterval(()=>{if(P()&&!$('editor').hidden)saveSnap('Otomatis '+new Date().toTimeString().slice(0,5),true)},240000);
    setInterval(()=>{const p=P();if(p&&p.id!==build.pid){build.pid=p.id;snaps=[];lastSnapStr='';loadSnaps();drawMarks();drawGuides()}},1000);
  }
  /* untuk pengujian */
  APK.studio2d={parseSrt,findSilence,beatTimes,splitAt,cutRange,mergeRanges,shiftAfter,encodeWav,tlTime,_S:S};
  try{build()}catch(e){console.error('Studio Pro gagal dimuat',e)}
})();
