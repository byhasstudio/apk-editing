/* Export video: render timeline real-time ke MediaRecorder (MP4 jika didukung browser, selain itu WebM) */
window.APK=window.APK||{};
APK.export=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const CAND=[['mp4','video/mp4;codecs=avc1.640028,mp4a.40.2'],['mp4','video/mp4'],['webm','video/webm;codecs=vp9,opus'],['webm','video/webm;codecs=vp8,opus'],['webm','video/webm']];
  const LABEL={mp4:'MP4 (H.264)',webm:'WebM'};
  let busy=false,abortFn=null,tt;
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3000)}
  function formats(){const o={};if(window.MediaRecorder)for(const [e,m] of CAND)if(!o[e]&&MediaRecorder.isTypeSupported(m))o[e]=m;return o}
  function setProg(f,text){$('ex-fill').style.width=Math.round(Math.min(1,Math.max(0,f))*100)+'%';$('ex-status').textContent=text}

  function open(){
    const p=P();if(!p||busy)return;
    APK.preview.pause();
    if(!APK.preview.duration){toast('Timeline masih kosong, tambahkan clip dulu');return}
    const fm=formats(),keys=Object.keys(fm);
    if(!keys.length){toast('Browser ini tidak mendukung export video (MediaRecorder)');return}
    $('ex-format').innerHTML=keys.map(k=>`<option value="${k}">${LABEL[k]}</option>`).join('');
    const short=Math.min(p.width,p.height);
    const rs=[...new Set([480,720,1080,2160].filter(r=>r<short).concat([short]))].sort((a,b)=>a-b);
    $('ex-res').innerHTML=rs.map(r=>{const s=APK.project.size(p.aspect,r);return `<option value="${r}"${r===short?' selected':''}>${s.width}×${s.height}</option>`}).join('');
    const fps=[...new Set([24,30,60,p.fps])].sort((a,b)=>a-b);
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
  async function start(){
    if(busy)return;
    const p=P(),fm=formats(),ext=$('ex-format').value,mime=fm[ext],q=+$('ex-q').value,fps=+$('ex-fps').value;
    const {width:w,height:h}=APK.project.size(p.aspect,+$('ex-res').value);
    busy=true;$('ex-settings').hidden=true;$('ex-progress').hidden=false;setProg(0,'Menyiapkan...');
    const AC=window.AudioContext||window.webkitAudioContext,ac=new AC(),dest=ac.createMediaStreamDestination();
    const hook=el=>{try{ac.createMediaElementSource(el).connect(dest)}catch(_){}};
    let rec,timer,cancelled=false;const chunks=[];
    const cleanup=()=>{clearInterval(timer);APK.preview.endExport();ac.close().catch(()=>{});busy=false;abortFn=null};
    try{
      await ac.resume();
      APK.preview.beginExport(w,h,hook,()=>setTimeout(()=>{if(rec&&rec.state!=='inactive')rec.stop()},400));
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
      abortFn=()=>{cancelled=true;APK.preview.pause();if(rec.state!=='inactive')rec.stop()};
      rec.start(1000);
      APK.preview.seek(0);APK.preview.play();
      const t0=Date.now();
      timer=setInterval(()=>setProg(APK.preview.time/APK.preview.duration,`Merender ${Math.round((Date.now()-t0)/1000)} dtk · ${w}×${h} · ${fps} fps`),250);
    }catch(e){
      cleanup();$('ex-settings').hidden=false;$('ex-progress').hidden=true;
      toast('Export gagal dimulai: '+(e.message||e));
    }
  }
  $('btn-export').onclick=open;
  $('ex-start').onclick=start;
  $('ex-cancel').onclick=()=>abortFn&&abortFn();
  $('dlg-export').addEventListener('cancel',e=>{if(busy){e.preventDefault();abortFn&&abortFn()}});
  return{open};
})();
