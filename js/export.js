/* Export video. Dua mode:
   - PRESISI (disarankan, MP4): frame dirender satu per satu (tidak bergantung pada kecepatan perangkat), dikodekan dengan WebCodecs (H.264),
     audio dicampur terpisah dengan OfflineAudioContext dan dikodekan (AAC). Hasilnya tidak patah-patah walau efek berat, dan audio tepat waktu.
     Lamanya mengikuti beratnya project (bisa lebih lama dari durasi video). Kalau perangkat/browser tidak mendukung, otomatis pakai mode cepat.
     v17: GERAK HALUS (motion blur): tiap frame dirata-rata dari 2 atau 4 sub-frame di sekitar waktunya (rana 180 derajat), jadi gerak cepat
     dan hentakan antar clip terasa mulus seperti hasil kamera, tanpa mengurangi ketajaman gambar yang diam. Kualitas Maksimal dan resolusi
     di atas resolusi project (misalnya 1080p dari project 720p) tersedia supaya hasilnya jernih.
   - CEPAT (real-time): timeline diputar dan direkam dengan MediaRecorder (MP4 jika didukung, selain itu WebM). Lamanya sama dengan durasi,
     tapi frame bisa terlewat kalau perangkat tidak kuat. */
window.APK=window.APK||{};
APK.export=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const CAND=[['mp4','video/mp4;codecs=avc1.640028,mp4a.40.2'],['mp4','video/mp4'],['webm','video/webm;codecs=vp9,opus'],['webm','video/webm;codecs=vp8,opus'],['webm','video/webm']];
  const LABEL={mp4:'MP4 (H.264)',webm:'WebM'};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let busy=false,abortFn=null,tt,wake=null;
  /* pustaka pembungkus MP4 dimuat di latar belakang (tidak menahan startup aplikasi); kalau gagal dimuat, mode presisi tidak tersedia */
  if(!window.Mp4Muxer){const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.js';s.async=true;document.head.appendChild(s)}
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3500)}
  function formats(){const o={};if(window.MediaRecorder)for(const [e,m] of CAND)if(!o[e]&&MediaRecorder.isTypeSupported(m))o[e]=m;return o}
  function setProg(f,text){$('ex-fill').style.width=Math.round(Math.min(1,Math.max(0,f))*100)+'%';$('ex-status').textContent=text}
  const canPrecise=()=>!!(window.VideoEncoder&&window.AudioEncoder&&window.VideoFrame&&window.AudioData&&window.Mp4Muxer&&(window.OfflineAudioContext||window.webkitOfflineAudioContext));
  const fmtT=s=>{s=Math.max(0,Math.round(s));return s>=60?Math.floor(s/60)+' mnt '+(s%60)+' dtk':s+' dtk'};
  async function keepAwake(){try{if(navigator.wakeLock)wake=await navigator.wakeLock.request('screen')}catch(_){}}
  function releaseWake(){try{wake&&wake.release()}catch(_){}wake=null}

  function fillFormats(){
    const mode=$('ex-mode').value,fm=formats(),keys=Object.keys(fm);
    const mbEl=$('ex-mb');if(mbEl)mbEl.disabled=mode!=='pre';   /* gerak halus hanya untuk mode presisi */
    if(mode==='pre'){
      $('ex-format').innerHTML='<option value="mp4">MP4 (H.264 + AAC)</option>';$('ex-format').disabled=true;
      $('ex-note').textContent='Mode presisi merender frame demi frame, jadi hasilnya tidak patah-patah walau efeknya berat dan audio tepat waktu. Lamanya bisa lebih lama dari durasi video (gerak halus membuatnya lebih lama lagi). Biarkan tab tetap terbuka dan terlihat.';
    }else{
      $('ex-format').disabled=false;
      $('ex-format').innerHTML=keys.map(k=>`<option value="${k}">${LABEL[k]}</option>`).join('');
      $('ex-note').textContent='Mode cepat berjalan real-time seperti memutar video, jadi lamanya sama dengan durasi timeline. Kalau perangkat kurang kuat, frame bisa terlewat. Untuk hasil 60 fps yang jernih dan tidak patah-patah, pakai mode presisi. Biarkan tab tetap terbuka dan terlihat.';
    }
  }
  function open(){
    const p=P();if(!p||busy)return;
    APK.preview.pause();
    if(!APK.preview.duration){toast('Timeline masih kosong, tambahkan clip dulu');return}
    const pre=canPrecise(),fm=formats(),keys=Object.keys(fm);
    if(!pre&&!keys.length){toast('Browser ini tidak mendukung export video');return}
    $('ex-mode').innerHTML=(pre?'<option value="pre">Presisi (tanpa patah-patah, disarankan)</option>':'')+(keys.length?'<option value="rt">Cepat (real-time)</option>':'');
    $('ex-mode').value=pre?'pre':'rt';
    fillFormats();
    const short=Math.min(p.width,p.height);
    /* resolusi boleh di atas resolusi project (dirender ulang lebih tajam); bawaan minimal 1080p supaya jernih */
    const cand=[480,720,1080,1440].concat(short>=1080?[2160]:[]);
    const rs=[...new Set(cand.filter(r=>r<=Math.max(short,1440)).concat([short]))].sort((a,b)=>a-b);
    const defR=short<1080?1080:short;
    $('ex-res').innerHTML=rs.map(r=>{const s=APK.project.size(p.aspect,r);return `<option value="${r}"${r===defR?' selected':''}>${s.width}×${s.height}</option>`}).join('');
    const fps=[...new Set([24,30,60,90,120,p.fps])].sort((a,b)=>a-b);
    $('ex-fps').innerHTML=fps.map(f=>`<option${f===p.fps?' selected':''}>${f}</option>`).join('');
    $('ex-settings').hidden=false;$('ex-progress').hidden=true;
    $('dlg-export').showModal();
  }
  function download(blob,ext){
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=(P().name.replace(/[\\/:*?"<>|]+/g,'_')||'video')+'.'+ext;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
  }

  /* ===== campur audio (mode presisi) =====
     Semua clip yang bersuara dikodekan ulang ke satu rekaman stereo 48 kHz: posisi, titik mulai, kecepatan, volume (termasuk keyframe), dan fade ikut.
     Hasilnya null kalau tidak ada yang bersuara. */
  async function mixAudio(p,D,SR,cancelled){
    const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext,list=[];
    for(const tr of p.tracks){
      if(tr.muted||tr.hidden)continue;
      for(const c of tr.clips){
        if(c.fx||c.text||c.shape||!c.mediaId||c.mute)continue;
        const m=p.media.find(x=>x.id===c.mediaId);
        if(!m||m.type==='image')continue;
        if(m.type==='video'&&c.reverse&&tr.kind!=='audio')continue;   /* putar mundur: audio dibisukan, sama seperti di preview */
        list.push({c,m});
      }
    }
    if(!list.length)return null;
    const dc=new OAC(2,1,SR),cache=new Map();
    const decode=id=>{
      if(!cache.has(id))cache.set(id,(async()=>{
        try{const r=await APK.db.getMedia(id);if(!r||!r.blob)return null;return await dc.decodeAudioData(await r.blob.arrayBuffer())}
        catch(_){return null}   /* video tanpa audio atau format tidak terbaca: dilewati */
      })());
      return cache.get(id);
    };
    const oc=new OAC(2,Math.max(1,Math.ceil(D*SR)+Math.round(SR/10)),SR);
    APK.layers.begin();
    let any=false;
    for(const z of list){
      if(cancelled())return null;
      const c=z.c,buf=await decode(z.m.id);if(!buf)continue;
      const sp=Math.min(16,Math.max(0.0625,c.speed||1)),off=Math.max(0,c.in||0);
      if(off>=buf.duration-0.001)continue;
      const src=oc.createBufferSource(),g=oc.createGain();
      src.buffer=buf;src.playbackRate.value=sp;
      const fi=c.fadeIn||0,fo=c.fadeOut||0,anim=!!(c.kf&&c.kf.volume&&c.kf.volume.length);
      const vAt=rl=>{
        const pr=APK.layers.props(c,c.start+rl);let f=1;
        if(fi>0)f=Math.min(f,rl/fi);
        if(fo>0)f=Math.min(f,(c.dur-rl)/fo);
        return Math.min(1,Math.max(0,pr.volume*Math.min(1,Math.max(0,f))));
      };
      if(!anim&&!fi&&!fo)g.gain.value=vAt(0);
      else{
        const step=Math.max(0.04,c.dur/3000);
        g.gain.setValueAtTime(vAt(0),c.start);
        for(let rl=step;rl<c.dur;rl+=step)g.gain.linearRampToValueAtTime(vAt(rl),c.start+rl);
        g.gain.linearRampToValueAtTime(vAt(c.dur),c.start+c.dur);
      }
      src.connect(g);g.connect(oc.destination);
      src.start(Math.max(0,c.start),off,Math.min(c.dur*sp,buf.duration-off));
      any=true;
    }
    if(!any||cancelled())return null;
    return await oc.startRendering();
  }

  /* ===== mode presisi ===== */
  async function renderPrecise(p,w,h,fps,q,D,N,st,mb){
    const SR=48000,bitrate=Math.min(80e6,Math.max(2e6,Math.round(w*h*fps*q)));
    let vcfg=null;
    for(const codec of ['avc1.640033','avc1.64002a','avc1.640028','avc1.64001f','avc1.42001f']){
      const c={codec,width:w,height:h,bitrate,framerate:fps,avc:{format:'avc'},latencyMode:'quality'};
      try{const s=await VideoEncoder.isConfigSupported(c);if(s&&s.supported){vcfg=c;break}}catch(_){}
    }
    if(!vcfg)throw new Error('encoder H.264 tidak tersedia');
    setProg(0,'Menyiapkan audio...');
    const mix=await mixAudio(p,D,SR,()=>st.cancelled);
    if(st.cancelled)return null;
    let acfg=null,acodec='aac';
    if(mix){
      for(const [cd,mc] of [['mp4a.40.2','aac'],['opus','opus']]){
        try{const c={codec:cd,sampleRate:SR,numberOfChannels:2,bitrate:192000},s=await AudioEncoder.isConfigSupported(c);if(s&&s.supported){acfg=c;acodec=mc;break}}catch(_){}
      }
      if(!acfg)throw new Error('encoder audio tidak tersedia');
    }
    const target=new Mp4Muxer.ArrayBufferTarget(),mo={target,video:{codec:'avc',width:w,height:h,frameRate:fps},fastStart:'in-memory'};
    if(acfg)mo.audio={codec:acodec,numberOfChannels:2,sampleRate:SR};
    const muxer=new Mp4Muxer.Muxer(mo);
    let err=null;
    const venc=st.venc=new VideoEncoder({output:(c,m)=>{try{muxer.addVideoChunk(c,m)}catch(e){err=err||e}},error:e=>{err=err||e}});
    venc.configure(vcfg);
    let aenc=null;
    if(acfg){
      aenc=st.aenc=new AudioEncoder({output:(c,m)=>{try{muxer.addAudioChunk(c,m)}catch(e){err=err||e}},error:e=>{err=err||e}});
      aenc.configure(acfg);
    }
    const c0=mix?mix.getChannelData(0):null,c1=mix?mix.getChannelData(Math.min(1,mix.numberOfChannels-1)):null,total=mix?mix.length:0;
    let aPos=0;
    const feed=to=>{
      while(aPos<to){
        const n=Math.min(SR,to-aPos),buf=new Float32Array(n*2);
        buf.set(c0.subarray(aPos,aPos+n),0);buf.set(c1.subarray(aPos,aPos+n),n);
        const ad=new AudioData({format:'f32-planar',sampleRate:SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(aPos/SR*1e6),data:buf});
        aenc.encode(ad);ad.close();aPos+=n;
      }
    };
    APK.preview.beginOffline(w,h,fps);
    const canvas=$('pv-canvas'),dur=Math.round(1e6/fps);
    /* gerak halus: kanvas penampung untuk merata-ratakan sub-frame */
    let acc=null,ag=null;
    if(mb>1){acc=document.createElement('canvas');acc.width=w;acc.height=h;ag=acc.getContext('2d')}
    let lastProg=0;
    for(let i=0;i<N;i++){
      if(st.cancelled)return null;
      if(err)throw err;
      const tm=i/fps;
      let srcCv=canvas;
      if(mb>1){
        /* rana 180 derajat: sub-frame tersebar simetris di setengah lama frame di sekitar tm; rata-rata progresif (alpha 1/(k+1)) */
        ag.setTransform(1,0,0,1,0,0);ag.globalAlpha=1;ag.globalCompositeOperation='source-over';ag.clearRect(0,0,w,h);
        for(let k=0;k<mb;k++){
          const ts=Math.min(Math.max(0,D-1e-3),Math.max(0,tm+((k+0.5)/mb-0.5)*0.5/fps));
          await APK.preview.prepare(ts);
          if(st.cancelled)return null;
          APK.preview.exportFrame(ts);
          ag.globalAlpha=1/(k+1);
          ag.drawImage(canvas,0,0);
        }
        ag.globalAlpha=1;
        srcCv=acc;
      }else{
        await APK.preview.prepare(tm);
        if(st.cancelled)return null;
        APK.preview.exportFrame(tm);
      }
      const vf=new VideoFrame(srcCv,{timestamp:Math.round(i*1e6/fps),duration:dur});
      venc.encode(vf,{keyFrame:i%(fps*2)===0});
      vf.close();
      if(aenc)feed(Math.min(total,Math.floor((tm+1)*SR)));
      while(venc.encodeQueueSize>8&&!st.cancelled&&!err)await sleep(4);
      const now=Date.now();
      if(now-lastProg>200){
        lastProg=now;
        const el=(now-st.t0)/1000;
        setProg(i/N,`Merender frame ${i}/${N} · ${w}×${h} · ${fps} fps`+(mb>1?` · gerak halus ${mb}x`:'')+(i>=15?` · sisa ±${fmtT(el/i*(N-i))}`:''));
        await sleep(0);
      }else if(i%3===0)await sleep(0);
    }
    if(aenc)feed(total);
    setProg(1,'Menyelesaikan file...');
    await venc.flush();
    if(aenc)await aenc.flush();
    if(err)throw err;
    muxer.finalize();
    return new Blob([target.buffer],{type:'video/mp4'});
  }
  async function startPrecise(){
    if(busy)return;
    const p=P(),fps=+$('ex-fps').value,q=+$('ex-q').value,D=APK.preview.duration;
    const mb=$('ex-mb')?Math.max(1,Math.min(4,Math.round(+$('ex-mb').value)||1)):1;
    const sz=APK.project.size(p.aspect,+$('ex-res').value),w=Math.max(2,sz.width&~1),h=Math.max(2,sz.height&~1);
    const N=Math.max(1,Math.ceil(D*fps-1e-6)),st={venc:null,aenc:null,cancelled:false,t0:Date.now()};
    busy=true;$('ex-settings').hidden=true;$('ex-progress').hidden=false;setProg(0,'Menyiapkan...');
    abortFn=()=>{st.cancelled=true;$('ex-status').textContent='Membatalkan...'};
    keepAwake();
    let blob=null,failed=null;
    try{blob=await renderPrecise(p,w,h,fps,q,D,N,st,mb)}catch(e){failed=e}
    try{if(st.venc&&st.venc.state!=='closed')st.venc.close()}catch(_){}
    try{if(st.aenc&&st.aenc.state!=='closed')st.aenc.close()}catch(_){}
    APK.preview.endExport();releaseWake();busy=false;abortFn=null;
    if(st.cancelled){$('dlg-export').close();toast('Export dibatalkan');return}
    if(failed||!blob){
      console.warn('Export presisi gagal',failed);
      toast('Mode presisi gagal ('+((failed&&failed.message)||'tidak diketahui')+'), beralih ke mode cepat');
      if(Object.keys(formats()).length){$('ex-mode').innerHTML='<option value="rt">Cepat (real-time)</option>';$('ex-mode').value='rt';fillFormats();return startRealtime()}
      $('ex-settings').hidden=false;$('ex-progress').hidden=true;return;
    }
    $('dlg-export').close();
    download(blob,'mp4');
    toast('Export selesai, file diunduh');
  }

  /* ===== mode cepat (real-time) ===== */
  async function startRealtime(){
    if(busy)return;
    const p=P(),fm=formats(),ext=$('ex-format').value,mime=fm[ext],q=+$('ex-q').value,fps=+$('ex-fps').value;
    if(!mime){toast('Format ini tidak didukung browser');$('ex-settings').hidden=false;$('ex-progress').hidden=true;return}
    const {width:w,height:h}=APK.project.size(p.aspect,+$('ex-res').value);
    busy=true;$('ex-settings').hidden=true;$('ex-progress').hidden=false;setProg(0,'Menyiapkan...');
    const AC=window.AudioContext||window.webkitAudioContext,ac=new AC(),dest=ac.createMediaStreamDestination();
    const hook=el=>{try{ac.createMediaElementSource(el).connect(dest)}catch(_){}};
    let rec,timer,cancelled=false;const chunks=[];
    const cleanup=()=>{clearInterval(timer);APK.preview.endExport();ac.close().catch(()=>{});releaseWake();busy=false;abortFn=null};
    abortFn=()=>{cancelled=true;APK.preview.pause();if(rec&&rec.state!=='inactive')rec.stop();else if(!rec){cleanup();$('dlg-export').close();toast('Export dibatalkan')}};
    keepAwake();
    try{
      await ac.resume();
      APK.preview.beginExport(w,h,hook,()=>setTimeout(()=>{if(rec&&rec.state!=='inactive')rec.stop()},400));
      /* media clip pertama dimuat dan diposisikan dulu, supaya video dan audio tidak telat mulai */
      setProg(0,'Memuat media...');
      await APK.preview.prepare(0,true);
      if(cancelled)return;
      const stream=$('pv-canvas').captureStream(fps);
      dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
      rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.min(50e6,Math.round(w*h*fps*q))});
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      rec.onerror=()=>{cancelled=true;if(rec.state!=='inactive')rec.stop();toast('Export gagal')};
      rec.onstop=()=>{
        cleanup();$('dlg-export').close();
        if(cancelled){toast('Export dibatalkan');return}
        download(new Blob(chunks,{type:mime.split(';')[0]}),ext);
        toast('Export selesai, file diunduh');
      };
      rec.start(1000);
      APK.preview.seek(0);APK.preview.play();
      const t0=Date.now();
      timer=setInterval(()=>setProg(APK.preview.time/APK.preview.duration,`Merender ${Math.round((Date.now()-t0)/1000)} dtk · ${w}×${h} · ${fps} fps`),250);
    }catch(e){
      cleanup();$('ex-settings').hidden=false;$('ex-progress').hidden=true;
      toast('Export gagal dimulai: '+(e.message||e));
    }
  }
  function start(){return $('ex-mode').value==='pre'?startPrecise():startRealtime()}
  $('btn-export').onclick=open;
  $('ex-mode').onchange=fillFormats;
  $('ex-start').onclick=start;
  $('ex-cancel').onclick=()=>abortFn&&abortFn();
  $('dlg-export').addEventListener('cancel',e=>{if(busy){e.preventDefault();abortFn&&abortFn()}});
  return{open};
})();
