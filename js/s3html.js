/* Latar / elemen dari file untuk Edit 3D (dimuat setelah js/s3tools.js; isi scene3d.js tidak diubah).
   File HTML, SVG, atau gambar dipasang sebagai layer 3D biasa, jadi otomatis bisa digeser, diputar 3D, diberi keyframe,
   dijadikan anak dari Grup, dan ikut ke Export / Kirim ke editor.
   - Latar penuh layar: layer dipasang jauh di belakang dan diperbesar supaya memenuhi layar (ikut rasio scene).
   - Elemen biasa: ukuran bebas (lebar x tinggi), dipasang di kedalaman 0 pada detik playhead.
   GERAK: kalau file HTML / SVG punya animasi CSS (@keyframes), animasinya dirender frame per frame (waktu tiap frame diatur
   tepat lewat animation-delay negatif + pause) lalu dikodekan jadi video MP4 (WebCodecs + mp4-muxer dari export.js), dan video
   itu dipasang sebagai layer Video. Jadi latarnya bergerak mulus di preview, Export, dan Kirim ke editor.
   Kalau tidak ada animasi CSS, atau browser tidak punya WebCodecs, dipasang sebagai gambar diam (PNG).
   Batas: HTML harus mandiri (CSS di dalam file, gambar dan font lewat data: URI). Script tidak dijalankan, jadi animasi
   yang digerakkan JavaScript tidak ikut; animasi CSS dan transform/opacity/warna lewat @keyframes ikut. Transition (hover)
   tidak ikut. Video MP4 tidak punya transparansi: area transparan diisi "Warna dasar". GIF diambil frame pertamanya. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const sc=()=>{try{return(APK.s3d&&APK.s3d.scene)||null}catch(_){return null}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const ASP={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:3':[4,3],'21:9':[21,9]};
function dims(aspect,short){
  const [a,b]=ASP[aspect]||ASP['16:9'];let w,h;
  if(a>=b){h=short;w=Math.round(short*a/b)}else{w=short;h=Math.round(short*b/a)}
  return[w+w%2,h+h%2];
}
const loadImg=url=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('file tidak bisa dirender, cek isi file'));i.src=url});
const dataUri=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
const canVideo=()=>!!(window.VideoEncoder&&window.VideoFrame&&window.Mp4Muxer);
function toPng(c){
  return new Promise((res,rej)=>{
    try{c.toBlob(b=>b?res(b):rej(new Error('gagal membuat gambar')),'image/png')}
    catch(e){rej(new Error('browser memblokir hasil render, coba pakai Chrome'))}
  });
}
function draw(c,img,mode){
  const g=c.getContext('2d'),w=c.width,h=c.height,iw=img.naturalWidth||w,ih=img.naturalHeight||h;
  const k=mode==='cover'?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih),dw=iw*k,dh=ih*k;
  g.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
}
async function natural(blob){
  const u=URL.createObjectURL(blob);
  try{const i=await loadImg(u);return(i.naturalWidth/i.naturalHeight)||1}finally{URL.revokeObjectURL(u)}
}

/* ===== HTML / SVG -> bagian yang bisa dirender (tanpa script dan tanpa sumber luar) ===== */
function sanitize(text,isSvg,w,h,mode){
  if(isSvg)text='<body>'+text.replace(/<\?xml[^>]*\?>/i,'').replace(/<!DOCTYPE[^>]*>/i,'')+'</body>';
  const doc=new DOMParser().parseFromString(text,'text/html');
  doc.querySelectorAll('script,link,iframe,object,embed,base').forEach(n=>n.remove());
  doc.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)}));
  if(isSvg){
    const sv=doc.querySelector('svg');
    if(sv){
      if(!sv.getAttribute('viewBox')){
        const ww=parseFloat(sv.getAttribute('width')),hh=parseFloat(sv.getAttribute('height'));
        if(ww>0&&hh>0)sv.setAttribute('viewBox','0 0 '+ww+' '+hh);
      }
      sv.removeAttribute('width');sv.removeAttribute('height');
      sv.setAttribute('preserveAspectRatio',mode==='bg'?'xMidYMid slice':'xMidYMid meet');
      sv.setAttribute('style',(sv.getAttribute('style')||'')+';width:100%;height:100%;display:block');
    }
  }
  const css=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n')
    .replace(/(^|[\s,{}>+~])(?:html|body)(?=[\s,{.:#\[>+~]|$)/gi,'$1.apk-body');
  const b=doc.body,wrap=doc.createElement('div');
  wrap.className=(b.className?b.className+' ':'')+'apk-body';
  const st=b.getAttribute('style')||'';
  wrap.setAttribute('style',st+(st&&!/;\s*$/.test(st)?';':'')+'margin:0;box-sizing:border-box;position:relative;overflow:hidden;width:'+w+'px;height:'+h+'px');
  b.querySelectorAll('style').forEach(n=>n.remove());
  wrap.innerHTML=b.innerHTML;
  return{css,wrap};
}
const svgWrap=(w,h,inner)=>'<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><foreignObject x="0" y="0" width="'+w+'" height="'+h+'">'+inner+'</foreignObject></svg>';

/* gambar diam */
async function rasterHtml(text,w,h){
  const P=sanitize(text,false,w,h,'el'),doc=P.wrap.ownerDocument,sty=doc.createElement('style');
  sty.textContent=P.css;
  const ser=new XMLSerializer();
  const img=await loadImg(dataUri(svgWrap(w,h,ser.serializeToString(sty)+ser.serializeToString(P.wrap))));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);
  return toPng(c);
}
/* ubah file pilihan jadi gambar diam. ar = lebar / tinggi hasilnya */
async function build(file,mode,s){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(/^(png|jpe?g|webp|gif)$/.test(ext)||(file.type&&file.type.startsWith('image/')&&ext!=='svg'))return{blob:file,ar:await natural(file)};
  let w,h;
  if(mode==='bg')[w,h]=dims(s.aspect,1080);
  else{w=clamp(Math.round(+$('s3-hx-w').value)||1080,64,2048);h=clamp(Math.round(+$('s3-hx-h').value)||1080,64,2048)}
  const text=await file.text();
  if(ext==='svg'){
    const img=await loadImg(dataUri(text)),c=document.createElement('canvas');c.width=w;c.height=h;
    draw(c,img,mode==='bg'?'cover':'contain');
    return{blob:await toPng(c),ar:w/h};
  }
  return{blob:await rasterHtml(text,w,h),ar:w/h};
}

/* ===== animasi: tiap frame dirender pada waktu t dengan animation-delay negatif + pause =====
   Dokumen dimuat di iframe tersembunyi (sandbox tanpa script) hanya untuk membaca animation-name dan animation-delay tiap
   elemen (juga ::before dan ::after). Untuk waktu t, animation-delay diganti (delay asli - t) dan animasi di-pause, sehingga
   posisi animasinya tepat di detik t. Hasilnya dirender lewat SVG foreignObject seperti gambar diam. */
async function prepAnim(text,w,h,isSvg,mode){
  const P=sanitize(text,isSvg,w,h,mode);
  const ifr=document.createElement('iframe');
  ifr.setAttribute('sandbox','allow-same-origin');
  ifr.style.cssText='position:fixed;left:-99999px;top:0;border:0;visibility:hidden;width:'+w+'px;height:'+h+'px';
  ifr.srcdoc='<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}'+P.css+'</style></head><body>'+P.wrap.outerHTML+'</body></html>';
  document.body.appendChild(ifr);
  const cleanup=()=>{try{ifr.remove()}catch(_){}};
  try{
    await new Promise(r=>{ifr.onload=r;setTimeout(r,4000)});
    const idoc=ifr.contentDocument,iw=ifr.contentWindow,root=idoc&&idoc.querySelector('.apk-body');
    if(!root)throw new Error('file tidak bisa dibaca');
    const els=[root,...root.querySelectorAll('*')],rules=[];
    els.forEach((el,i)=>{
      el.setAttribute('data-apk',i);
      ['','::before','::after'].forEach(ps=>{
        let cs;try{cs=iw.getComputedStyle(el,ps||null)}catch(_){return}
        const nm=cs.animationName;if(!nm||nm==='none')return;
        const n=nm.split(',').length,dl=cs.animationDelay.split(',').map(x=>{x=x.trim();return x.endsWith('ms')?parseFloat(x)/1000:(parseFloat(x)||0)});
        rules.push({sel:'[data-apk="'+i+'"]'+ps,d:Array.from({length:n},(_,k)=>dl[k%dl.length])});
      });
    });
    if(!rules.length){cleanup();return{hasAnim:false}}
    const ser=new XMLSerializer(),sty=idoc.querySelector('head style');
    const styXml=sty?ser.serializeToString(sty):'',wrapXml=ser.serializeToString(root);
    const frameSvg=t=>{
      const ov=rules.map(r=>r.sel+'{animation-delay:'+r.d.map(d=>(d-t).toFixed(4)+'s').join(',')+' !important;animation-play-state:paused !important}').join('');
      return svgWrap(w,h,styXml+'<style xmlns="http://www.w3.org/1999/xhtml">'+xe(ov)+'</style>'+wrapXml);
    };
    return{hasAnim:true,frameSvg,count:rules.length,cleanup};
  }catch(e){cleanup();throw e}
}
let cancel=false;
const msg=t=>{const e=$('s3-hx-msg');if(e)e.textContent=t||''};
async function renderVideo(prep,w,h,fps,dur,bgc,q){
  const N=Math.max(1,Math.round(dur*fps)),bitrate=Math.min(40e6,Math.max(2e6,Math.round(w*h*fps*q)));
  let cfg=null;
  for(const codec of ['avc1.640034','avc1.640033','avc1.64002a','avc1.640028','avc1.64001f','avc1.42001f']){
    const c={codec,width:w,height:h,bitrate,framerate:fps,avc:{format:'avc'},latencyMode:'quality'};
    try{const s=await VideoEncoder.isConfigSupported(c);if(s&&s.supported){cfg=c;break}}catch(_){}
  }
  if(!cfg)throw new Error('encoder H.264 tidak tersedia');
  const target=new Mp4Muxer.ArrayBufferTarget(),muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:w,height:h,frameRate:fps},fastStart:'in-memory'});
  let err=null;
  const venc=new VideoEncoder({output:(c,m)=>{try{muxer.addVideoChunk(c,m)}catch(e){err=err||e}},error:e=>{err=err||e}});
  venc.configure(cfg);
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  const g=cv.getContext('2d'),fd=Math.round(1e6/fps),t0=Date.now();
  try{
    for(let i=0;i<N;i++){
      if(cancel)throw new Error('dibatalkan');
      if(err)throw err;
      const img=await loadImg(dataUri(prep.frameSvg(i/fps)));
      g.globalCompositeOperation='source-over';g.fillStyle=bgc;g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
      const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/fps),duration:fd});
      venc.encode(vf,{keyFrame:i%(fps*2)===0});vf.close();
      while(venc.encodeQueueSize>8&&!err)await wait(4);
      if(i%2===0){
        const el=(Date.now()-t0)/1000;
        msg('Merender animasi: frame '+(i+1)+'/'+N+(i>=6?' · sisa ±'+Math.max(1,Math.round(el/(i+1)*(N-i-1)))+' dtk':''));
        await wait(0);
      }
    }
    await venc.flush();if(err)throw err;
    muxer.finalize();
  }finally{try{if(venc.state!=='closed')venc.close()}catch(_){}}
  return new Blob([target.buffer],{type:'video/mp4'});
}

/* ===== pasang ke scene: pakai pemilih file bawaan Edit 3D (js/scene3d.js) supaya media tersimpan seperti Foto / Video biasa ===== */
async function addBlob(blob,name){
  const input=$('s3-file'),before=sc().items.length;
  const f=new File([blob],name,{type:blob.type||'image/png'}),dt=new DataTransfer();dt.items.add(f);
  input.click=()=>{};   /* tombol Foto/Video mereset mode ganti-file; jangan buka dialog file */
  try{$('s3-add-media').click()}finally{delete input.click}
  input.files=dt.files;
  input.dispatchEvent(new Event('change'));
  for(let i=0;i<120&&sc()&&sc().items.length<=before;i++)await wait(50);
  const s=sc();
  return s&&s.items.length>before?s.items[s.items.length-1]:null;
}
let busy=false;
function place(it,mode,ar,s){
  if(mode==='bg'){
    let fov=60;try{fov=APK.s3d.val(s.items[0],'fov',0)||60}catch(_){}
    const base=it.kind==='video'?1000:600;   /* tinggi dasar layer: Video 1000 satuan, Foto 600; layar = 1000 satuan di kedalaman 0 */
    const F=500/Math.tan(fov*Math.PI/360),sar=(ASP[s.aspect]||ASP['16:9']),sr=sar[0]/sar[1];
    const K=(1000/base)*Math.max(1,sr/ar)*1.12;
    let Z=1500,k=K*(1+Z/F);
    if(k>6){Z=Math.max(0,Math.floor(F*(6/K-1)));k=Math.min(6,K*(1+Z/F))}
    it.props.x=0;it.props.y=0;it.props.z=Z;it.props.scale=Math.round(k*100)/100;
    it.start=0;
    if(it.kind!=='video')it.dur=null;
  }
}
async function go(){
  if(busy)return;const s=sc();if(!s){msg('Buka project 3D dulu.');return}
  const f=$('s3-hx-file').files[0];if(!f){msg('Pilih file dulu.');return}
  const mode=$('s3-hx-mode').value,ext=(f.name.split('.').pop()||'').toLowerCase();
  const mv=/^(html?|svg)$/.test(ext)&&$('s3-hx-mv')&&$('s3-hx-mv').checked;
  busy=true;cancel=false;$('s3-hx-go').disabled=true;msg('Memproses…');
  let prep=null;
  try{
    let out=null,vid=false,note='';
    if(mv&&!canVideo())note='Browser ini belum mendukung render animasi (pakai Chrome/Edge terbaru), jadi dipasang sebagai gambar diam';
    else if(mv){
      const res=+$('s3-hx-res').value||720,fps=+$('s3-hx-fps').value||30,dur=clamp(+$('s3-hx-dur').value||s.dur,1,60);
      let w,h;
      if(mode==='bg')[w,h]=dims(s.aspect,res);
      else{w=clamp(Math.round(+$('s3-hx-w').value)||1080,64,1920);h=clamp(Math.round(+$('s3-hx-h').value)||1080,64,1920);w-=w%2;h-=h%2}
      msg('Menyiapkan…');
      prep=await prepAnim(await f.text(),w,h,ext==='svg',mode);
      if(prep.hasAnim){
        const blob=await renderVideo(prep,w,h,fps,dur,$('s3-hx-bgc').value||'#000000',.15);
        out={blob,ar:w/h};vid=true;
      }else note='Tidak ada animasi CSS (@keyframes) di file ini, jadi dipasang sebagai gambar diam';
    }
    if(!out){msg('Memproses…');out=await build(f,mode,s)}
    const base=(f.name.replace(/\.[^.]+$/,'')||'file').slice(0,10),pre=mode==='bg'?'Latar ':'';
    msg('Memasang ke scene…');
    const it=await addBlob(out.blob,pre+base+(vid?'.mp4':'.png'));
    if(!it)throw new Error('layer gagal ditambahkan');
    it.name=(pre+base).slice(0,18);
    place(it,mode,out.ar,sc());
    APK.s3d.select(it.id);
    const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));   /* memicu simpan otomatis dan riwayat undo */
    $('s3-dlg-html').close();
    toast(note||(vid?(mode==='bg'?'Latar bergerak dipasang di belakang semua layer':'Elemen bergerak ditambahkan'):(mode==='bg'?'Latar dipasang di belakang semua layer':'Elemen ditambahkan')));
  }catch(err){
    console.warn('Tambah file ke Edit 3D gagal',err);
    msg(cancel?'Dibatalkan.':'Gagal: '+((err&&err.message)||err));
  }finally{if(prep&&prep.cleanup)prep.cleanup();busy=false;$('s3-hx-go').disabled=false}
}
function isMarkup(){const f=$('s3-hx-file').files[0];return !!f&&/\.(html?|svg)$/i.test(f.name)}
function vis(){
  const b=$('s3-hx-size');if(b)b.style.display=$('s3-hx-mode').value==='el'?'':'none';
  const a=$('s3-hx-anim');if(a)a.style.display=isMarkup()?'':'none';
}
function init(){
  if(!$('s3-add-html'))return;
  /* panel pengaturan animasi disisipkan lewat JS (index.html tidak perlu diubah) */
  const m=$('s3-hx-msg');
  if(m&&!$('s3-hx-anim'))m.insertAdjacentHTML('beforebegin',
    '<div id="s3-hx-anim" style="display:none">'
    +'<label class="s3-ck"><input type="checkbox" id="s3-hx-mv" checked> Gerakkan: animasi CSS (@keyframes) dirender jadi video</label>'
    +'<div class="s3-two"><label class="s3-fl">Durasi video (dtk)<input type="number" id="s3-hx-dur" min="1" max="60" value="10"></label>'
    +'<label class="s3-fl">Frame rate<select id="s3-hx-fps"><option>24</option><option selected>30</option></select></label></div>'
    +'<div class="s3-two"><label class="s3-fl">Ukuran sisi pendek (latar)<select id="s3-hx-res"><option value="480">480p</option><option value="720" selected>720p</option><option value="1080">1080p (berat)</option></select></label>'
    +'<label class="s3-fl">Warna dasar (isi area transparan)<input type="color" id="s3-hx-bgc" value="#000000"></label></div>'
    +'<p class="meta">Dirender frame per frame jadi MP4, jadi lamanya mengikuti durasi dan ukuran. Biarkan tab tetap terbuka. Kalau file tidak punya animasi CSS, otomatis dipasang sebagai gambar diam.</p></div>');
  const p=$('s3-dlg-html')&&$('s3-dlg-html').querySelector('p.meta');
  if(p)p.textContent='Pilih file HTML, SVG, atau gambar (PNG, JPG, WEBP, GIF). Hasilnya jadi layer 3D biasa: bisa digeser, diputar, diberi keyframe, dijadikan anak Grup, dan ikut Export. HTML harus mandiri (CSS di dalam file, gambar dan font lewat data: URI). Script tidak dijalankan. Animasi CSS (@keyframes) bisa digerakkan, JavaScript tidak.';
  $('s3-add-html').onclick=()=>{
    const s=sc();if(!s)return;
    $('s3-hx-file').value='';msg('');
    if($('s3-hx-dur'))$('s3-hx-dur').value=clamp(Math.round(s.dur)||10,1,60);
    vis();$('s3-dlg-html').showModal();
  };
  $('s3-hx-file').onchange=vis;
  $('s3-hx-mode').onchange=vis;
  $('s3-hx-go').onclick=go;
  $('s3-hx-cancel').onclick=()=>{if(busy){cancel=true;msg('Membatalkan…')}else $('s3-dlg-html').close()};
  vis();
}
try{init()}catch(e){console.error('Fitur latar/elemen dari file gagal dimuat',e)}
})();
