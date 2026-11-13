/* Latar / elemen dari file untuk Edit 3D (dimuat setelah js/s3tools.js; isi scene3d.js tidak diubah).
   File HTML, SVG, atau gambar dipasang sebagai layer 3D biasa, jadi otomatis bisa digeser, diputar 3D, diberi keyframe,
   dijadikan anak dari Grup, dan ikut ke Export / Kirim ke editor.
   - Latar penuh layar: layer dipasang jauh di belakang dan diperbesar supaya memenuhi layar (ikut rasio scene).
   - Elemen biasa: ukuran bebas (lebar x tinggi), dipasang di kedalaman 0 pada detik playhead.
   GERAK (dua cara, hasilnya selalu video MP4 lewat WebCodecs + mp4-muxer dari export.js, dipasang sebagai layer Video):
   1) Animasi CSS (@keyframes) di HTML / SVG: tiap frame dirender pada waktu t dengan animation-delay negatif + pause.
   2) Animasi JavaScript di HTML (opsional, dicentang sendiri): file dijalankan di iframe terisolasi (sandbox allow-scripts tanpa
      allow-same-origin, jaringan diblokir lewat CSP). requestAnimationFrame, setTimeout, setInterval, performance.now, dan Date
      diganti waktu virtual yang maju tepat 1/fps per frame, lalu isi semua elemen <canvas> direkam. Hanya <canvas> yang direkam
      (Canvas 2D dan WebGL); elemen HTML biasa yang digerakkan script tidak ikut.
   Kalau tidak ada animasi, atau browser tidak punya WebCodecs, dipasang sebagai gambar diam (PNG).
   Batas: HTML harus mandiri (CSS dan script di dalam file, gambar dan font lewat data: URI). Video MP4 tidak punya
   transparansi: area transparan diisi warna dasar. GIF diambil frame pertamanya. */
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

/* ===== gerak 1: animasi CSS, tiap frame dirender pada waktu t dengan animation-delay negatif + pause =====
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

/* ===== gerak 2: animasi JavaScript, waktu virtual di iframe terisolasi, isi <canvas> direkam =====
   BRIDGE dipasang paling awal di <head>, sebelum script milik file, jadi semua pemanggilan waktu memakai jam virtual. */
const BRIDGE=`(function(){
var T0=Date.now(),now=0,id=0,tid=0,raf=[],tm=[],OD=Date;
function D(){return arguments.length?Reflect.construct(OD,arguments):new OD(T0+now)}
D.prototype=OD.prototype;D.now=function(){return T0+now};D.parse=OD.parse;D.UTC=OD.UTC;window.Date=D;
try{performance.now=function(){return now}}catch(e){}
window.requestAnimationFrame=function(cb){raf.push({i:++id,cb:cb});return id};
window.cancelAnimationFrame=function(i){raf=raf.filter(function(x){return x.i!==i})};
window.setTimeout=function(f,ms){var a=[].slice.call(arguments,2);tm.push({i:++tid,t:now+(+ms||0),f:f,a:a,r:0});return tid};
window.setInterval=function(f,ms){var a=[].slice.call(arguments,2),r=Math.max(1,+ms||0);tm.push({i:++tid,t:now+r,f:f,a:a,r:r});return tid};
window.clearTimeout=window.clearInterval=function(i){tm=tm.filter(function(x){return x.i!==i})};
function step(dt){
  now+=dt;
  for(var g=0;g<5000;g++){
    var due=null;
    for(var k=0;k<tm.length;k++){if(tm[k].t<=now&&(!due||tm[k].t<due.t))due=tm[k]}
    if(!due)break;
    if(due.r)due.t+=due.r;else tm=tm.filter(function(x){return x!==due});
    try{if(typeof due.f==='function')due.f.apply(window,due.a)}catch(e){}
  }
  var list=raf;raf=[];
  list.forEach(function(x){try{x.cb(now)}catch(e){}});
  if(document.getAnimations)document.getAnimations().forEach(function(a){try{a.pause();a.currentTime=now}catch(e){}});
}
async function cap(){
  var items=[],cs=document.querySelectorAll('canvas');
  for(var i=0;i<cs.length;i++){
    var c=cs[i],r=c.getBoundingClientRect(),st=getComputedStyle(c);
    if(st.display==='none'||st.visibility==='hidden'||r.width<1||r.height<1||!c.width||!c.height)continue;
    try{items.push({b:await createImageBitmap(c),x:r.left,y:r.top,w:r.width,h:r.height,o:parseFloat(st.opacity)})}catch(e){}
  }
  var bg='',els=[document.body,document.documentElement];
  for(var j=0;j<els.length;j++){
    if(!els[j])continue;var v=getComputedStyle(els[j]).backgroundColor;
    if(v&&v!=='rgba(0, 0, 0, 0)'&&v!=='transparent'){bg=v;break}
  }
  return{items:items,bg:bg};
}
window.addEventListener('message',async function(e){
  var d=e.data;if(!d||d.apk!=='step')return;
  try{step(d.dt);var r=await cap();parent.postMessage({apk:'frame',seq:d.seq,bg:r.bg,items:r.items},'*',r.items.map(function(x){return x.b}))}
  catch(err){parent.postMessage({apk:'frame',seq:d.seq,err:String(err),items:[]},'*')}
});
window.addEventListener('load',function(){parent.postMessage({apk:'ready'},'*')});
})();`;
const CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:";
async function openJS(text,w,h){
  const ifr=document.createElement('iframe');
  ifr.setAttribute('sandbox','allow-scripts');
  ifr.setAttribute('csp',CSP);
  ifr.style.cssText='position:fixed;left:-99999px;top:0;border:0;width:'+w+'px;height:'+h+'px';
  const ready=new Promise(res=>{
    const hd=e=>{if(e.source===ifr.contentWindow&&e.data&&e.data.apk==='ready'){window.removeEventListener('message',hd);res()}};
    window.addEventListener('message',hd);
    setTimeout(()=>{window.removeEventListener('message',hd);res()},6000);
  });
  ifr.srcdoc='<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+CSP+'"><script>'+BRIDGE+'</scr'+'ipt></head>'
    +text.replace(/^\s*<!DOCTYPE[^>]*>/i,'');
  document.body.appendChild(ifr);
  await ready;await wait(300);   /* beri waktu gambar / inisialisasi script */
  let seq=0;
  const step=dt=>new Promise((res,rej)=>{
    const s=++seq;
    const to=setTimeout(()=>{window.removeEventListener('message',hd);rej(new Error('animasi script tidak merespons'))},8000);
    function hd(e){
      if(e.source!==ifr.contentWindow)return;const d=e.data;
      if(!d||d.apk!=='frame'||d.seq!==s)return;
      clearTimeout(to);window.removeEventListener('message',hd);
      if(d.err)rej(new Error(d.err));else res(d);
    }
    window.addEventListener('message',hd);
    ifr.contentWindow.postMessage({apk:'step',dt,seq:s},'*');
  });
  return{step,cleanup:()=>{try{ifr.remove()}catch(_){}}};
}

let cancel=false;
const msg=t=>{const e=$('s3-hx-msg');if(e)e.textContent=t||''};
/* frame(i, g) menggambar frame ke-i ke konteks g; hasilnya dikodekan jadi MP4 */
async function renderVideo(frame,w,h,fps,dur,q){
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
      g.globalCompositeOperation='source-over';g.globalAlpha=1;
      await frame(i,g);
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
  const useJS=mv&&/^html?$/.test(ext)&&$('s3-hx-js')&&$('s3-hx-js').checked;
  busy=true;cancel=false;$('s3-hx-go').disabled=true;msg('Memproses…');
  let prep=null,sess=null;
  try{
    let out=null,vid=false,note='';
    if(mv&&!canVideo())note='Browser ini belum mendukung render animasi (pakai Chrome/Edge terbaru), jadi dipasang sebagai gambar diam';
    else if(mv){
      const res=+$('s3-hx-res').value||720,fps=+$('s3-hx-fps').value||30,dur=clamp(+$('s3-hx-dur').value||s.dur,1,60),bgc=$('s3-hx-bgc').value||'#000000';
      let w,h;
      if(mode==='bg')[w,h]=dims(s.aspect,res);
      else{w=clamp(Math.round(+$('s3-hx-w').value)||1080,64,1920);h=clamp(Math.round(+$('s3-hx-h').value)||1080,64,1920);w-=w%2;h-=h%2}
      if(useJS){
        msg('Menjalankan animasi script…');
        sess=await openJS(await f.text(),w,h);
        let seen=false;
        const blob=await renderVideo(async(i,g)=>{
          const d=await sess.step(i?1000/fps:0);
          if(d.items.length)seen=true;
          else if(i>=8&&!seen)throw new Error('tidak ada <canvas> yang bisa direkam (mode JavaScript hanya merekam elemen canvas)');
          g.fillStyle=d.bg||bgc;g.fillRect(0,0,w,h);
          d.items.forEach(it=>{
            try{g.globalAlpha=isFinite(it.o)?it.o:1;g.drawImage(it.b,it.x,it.y,it.w,it.h)}catch(_){}
            try{it.b.close()}catch(_){}
          });
          g.globalAlpha=1;
        },w,h,fps,dur,.15);
        out={blob,ar:w/h};vid=true;
      }else{
        msg('Menyiapkan…');
        prep=await prepAnim(await f.text(),w,h,ext==='svg',mode);
        if(prep.hasAnim){
          const blob=await renderVideo(async(i,g)=>{
            const img=await loadImg(dataUri(prep.frameSvg(i/fps)));
            g.fillStyle=bgc;g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
          },w,h,fps,dur,.15);
          out={blob,ar:w/h};vid=true;
        }else note='Tidak ada animasi CSS (@keyframes) di file ini, jadi dipasang sebagai gambar diam'+(ext!=='svg'?'. Kalau animasinya dari JavaScript, centang opsi JavaScript':'');
      }
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
  }finally{
    if(prep&&prep.cleanup)prep.cleanup();
    if(sess)sess.cleanup();
    busy=false;$('s3-hx-go').disabled=false;
  }
}
function isMarkup(){const f=$('s3-hx-file').files[0];return !!f&&/\.(html?|svg)$/i.test(f.name)}
function isHtml(){const f=$('s3-hx-file').files[0];return !!f&&/\.html?$/i.test(f.name)}
function vis(){
  const b=$('s3-hx-size');if(b)b.style.display=$('s3-hx-mode').value==='el'?'':'none';
  const a=$('s3-hx-anim');if(a)a.style.display=isMarkup()?'':'none';
  const j=$('s3-hx-jsl');if(j)j.style.display=isHtml()?'':'none';
}
function init(){
  if(!$('s3-add-html'))return;
  /* panel pengaturan animasi disisipkan lewat JS (index.html tidak perlu diubah) */
  const m=$('s3-hx-msg');
  if(m&&!$('s3-hx-anim'))m.insertAdjacentHTML('beforebegin',
    '<div id="s3-hx-anim" style="display:none">'
    +'<label class="s3-ck"><input type="checkbox" id="s3-hx-mv" checked> Gerakkan: animasi dirender jadi video</label>'
    +'<label class="s3-ck" id="s3-hx-jsl" style="display:none"><input type="checkbox" id="s3-hx-js"> Animasi dari JavaScript (rekam elemen &lt;canvas&gt;). Script dijalankan di kotak pasir terisolasi tanpa jaringan, tetap hanya pakai file yang kamu percaya</label>'
    +'<div class="s3-two"><label class="s3-fl">Durasi video (dtk)<input type="number" id="s3-hx-dur" min="1" max="60" value="10"></label>'
    +'<label class="s3-fl">Frame rate<select id="s3-hx-fps"><option>24</option><option selected>30</option></select></label></div>'
    +'<div class="s3-two"><label class="s3-fl">Ukuran sisi pendek (latar)<select id="s3-hx-res"><option value="480">480p</option><option value="720" selected>720p</option><option value="1080">1080p (berat)</option></select></label>'
    +'<label class="s3-fl">Warna dasar (isi area transparan)<input type="color" id="s3-hx-bgc" value="#000000"></label></div>'
    +'<p class="meta">Dirender frame per frame jadi MP4, jadi lamanya mengikuti durasi dan ukuran. Biarkan tab tetap terbuka. Kalau file tidak punya animasi, otomatis dipasang sebagai gambar diam.</p></div>');
  const p=$('s3-dlg-html')&&$('s3-dlg-html').querySelector('p.meta');
  if(p)p.textContent='Pilih file HTML, SVG, atau gambar (PNG, JPG, WEBP, GIF). Hasilnya jadi layer 3D biasa: bisa digeser, diputar, diberi keyframe, dijadikan anak Grup, dan ikut Export. HTML harus mandiri (CSS dan script di dalam file, gambar dan font lewat data: URI). Animasi CSS (@keyframes) bisa digerakkan; animasi JavaScript bisa dengan mencentang opsinya (hanya elemen canvas yang direkam).';
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
