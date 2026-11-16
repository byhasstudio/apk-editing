/* Animasi halus seluruh tampilan: css/smooth.css ditaruh paling akhir di <head> supaya menimpa transisi lama */
(function(){try{if(!document.getElementById('smooth-css')){const l=document.createElement('link');l.id='smooth-css';l.rel='stylesheet';l.href='css/smooth.css?v=1';document.head.appendChild(l)}}catch(_){}})();

/* Waveform audio: puncak amplitudo per 20 ms, dihitung sekali per media */
window.APK=window.APK||{};
APK.wave=(function(){
  const RATE=50,cache=new Map();let ctx;
  async function compute(id){
    cache.set(id,'pending');
    try{
      const r=await APK.db.getMedia(id);
      if(!r||r.blob.size>80*1048576)throw 0;
      ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();
      const buf=await ctx.decodeAudioData(await r.blob.arrayBuffer());
      const ch=buf.getChannelData(0),step=Math.max(1,Math.floor(buf.sampleRate/RATE)),n=Math.ceil(ch.length/step),pk=new Float32Array(n);
      let mx=0;
      for(let i=0;i<n;i++){let v=0;const e=Math.min(ch.length,(i+1)*step);for(let j=i*step;j<e;j++){const a=Math.abs(ch[j]);if(a>v)v=a}pk[i]=v;if(v>mx)mx=v}
      if(mx>0)for(let i=0;i<n;i++)pk[i]/=mx;
      cache.set(id,pk);
    }catch(_){cache.set(id,null)}
    if(APK.project.current)APK.timeline.render();
  }
  return{RATE,peaks(id){const v=cache.get(id);if(v===undefined){compute(id);return null}return v==='pending'?null:v},clear(){cache.clear()}};
})();

/* Dibuat kosong SEBELUM js/s3cam.js dimuat: s3cam.js lalu menaruh fungsi pandangan Ruang 3D di __S3CAM_TEST.api, dipakai js/s3tex.js. */
window.__S3CAM_TEST=window.__S3CAM_TEST||{};

/* Memuat tambahan Edit 3D (kamera pro, layer pro, animasi lanjutan, tekstur Ruang 3D) setelah semua script lain selesai dimuat. */
addEventListener('DOMContentLoaded',()=>{['js/s3camfx.js?v=2','js/s3camfx2.js?v=1','js/s3layerpro.js?v=1','js/s3anim.js?v=1','js/s3tex.js?v=3','js/s3mclip.js?v=3'].reduce((p,src)=>p.then(()=>new Promise(r=>{const s=document.createElement('script');s.src=src;s.onload=s.onerror=r;document.body.appendChild(s)})),Promise.resolve())});
