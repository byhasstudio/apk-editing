/* Latar / elemen dari file untuk Edit 3D (dimuat setelah js/s3tools.js; isi scene3d.js tidak diubah).
   File HTML atau SVG dirender jadi gambar PNG, lalu dipasang sebagai layer Foto biasa di scene 3D, jadi otomatis bisa digeser,
   diputar 3D, diberi keyframe, dijadikan anak dari Grup, dan ikut ke Export / Kirim ke editor.
   - Latar penuh layar: layer dipasang jauh di belakang dan diperbesar supaya memenuhi layar (ikut rasio scene).
   - Elemen biasa: ukuran bebas (lebar x tinggi), dipasang di kedalaman 0 pada detik playhead.
   Batas: HTML harus mandiri (CSS di dalam file, gambar dan font lewat data: URI). Script tidak dijalankan, animasi CSS
   tidak bergerak (diambil sebagai gambar diam). File gambar (PNG/JPG/WEBP/GIF) juga boleh, GIF diambil frame pertamanya. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const sc=()=>{try{return(APK.s3d&&APK.s3d.scene)||null}catch(_){return null}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const ASP={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:3':[4,3],'21:9':[21,9]};
function dims(aspect,short){
  const [a,b]=ASP[aspect]||ASP['16:9'];let w,h;
  if(a>=b){h=short;w=Math.round(short*a/b)}else{w=short;h=Math.round(short*b/a)}
  return[w+w%2,h+h%2];
}
const loadImg=url=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('file tidak bisa dirender, cek isi file'));i.src=url});
const dataUri=svg=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
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

/* HTML -> PNG lewat SVG foreignObject (tanpa script dan tanpa sumber luar) */
async function rasterHtml(text,w,h){
  const doc=new DOMParser().parseFromString(text,'text/html');
  doc.querySelectorAll('script,link,iframe,object,embed,base').forEach(n=>n.remove());
  doc.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)}));
  const css=[...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n')
    .replace(/(^|[\s,{}>+~])(?:html|body)(?=[\s,{.:#\[>+~]|$)/gi,'$1.apk-body');
  const b=doc.body,wrap=doc.createElement('div');
  wrap.className=(b.className?b.className+' ':'')+'apk-body';
  const st=b.getAttribute('style')||'';
  wrap.setAttribute('style',st+(st&&!/;\s*$/.test(st)?';':'')+'margin:0;box-sizing:border-box;position:relative;overflow:hidden;width:'+w+'px;height:'+h+'px');
  b.querySelectorAll('style').forEach(n=>n.remove());
  wrap.innerHTML=b.innerHTML;
  const sty=doc.createElement('style');sty.textContent=css;
  const ser=new XMLSerializer();
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><foreignObject x="0" y="0" width="'+w+'" height="'+h+'">'
    +ser.serializeToString(sty)+ser.serializeToString(wrap)+'</foreignObject></svg>';
  const img=await loadImg(dataUri(svg));
  const c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(img,0,0,w,h);
  return toPng(c);
}
/* ubah file pilihan jadi gambar. ar = lebar / tinggi hasilnya */
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

/* pakai pemilih file bawaan Edit 3D (js/scene3d.js) supaya media tersimpan seperti Foto biasa */
async function addBlob(blob,name){
  const input=$('s3-file'),before=sc().items.length;
  const f=new File([blob],name,{type:blob.type||'image/png'}),dt=new DataTransfer();dt.items.add(f);
  input.click=()=>{};   /* tombol Foto/Video mereset mode ganti-file; jangan buka dialog file */
  try{$('s3-add-media').click()}finally{delete input.click}
  input.files=dt.files;
  input.dispatchEvent(new Event('change'));
  for(let i=0;i<100&&sc()&&sc().items.length<=before;i++)await wait(50);
  const s=sc();
  return s&&s.items.length>before?s.items[s.items.length-1]:null;
}
let busy=false;
const msg=t=>{const e=$('s3-hx-msg');if(e)e.textContent=t||''};
function place(it,mode,ar,s){
  if(mode==='bg'){
    let fov=60;try{fov=APK.s3d.val(s.items[0],'fov',0)||60}catch(_){}
    const F=500/Math.tan(fov*Math.PI/360),sar=(ASP[s.aspect]||ASP['16:9']),sr=sar[0]/sar[1];
    const K=(1000/600)*Math.max(1,sr/ar)*1.12;   /* tinggi dasar layer Foto = 600 satuan, layar = 1000 satuan di kedalaman 0 */
    let Z=1500,k=K*(1+Z/F);
    if(k>6){Z=Math.max(0,Math.floor(F*(6/K-1)));k=Math.min(6,K*(1+Z/F))}
    it.props.x=0;it.props.y=0;it.props.z=Z;it.props.scale=Math.round(k*100)/100;
    it.start=0;it.dur=null;
  }
}
async function go(){
  if(busy)return;const s=sc();if(!s){msg('Buka project 3D dulu.');return}
  const f=$('s3-hx-file').files[0];if(!f){msg('Pilih file dulu.');return}
  const mode=$('s3-hx-mode').value;
  busy=true;$('s3-hx-go').disabled=true;msg('Memproses…');
  try{
    const out=await build(f,mode,s);
    const base=(f.name.replace(/\.[^.]+$/,'')||'file').slice(0,10),pre=mode==='bg'?'Latar ':'';
    const it=await addBlob(out.blob,pre+base+'.png');
    if(!it)throw new Error('layer gagal ditambahkan');
    it.name=(pre+base).slice(0,18);
    place(it,mode,out.ar,sc());
    APK.s3d.select(it.id);
    const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));   /* memicu simpan otomatis dan riwayat undo */
    $('s3-dlg-html').close();
    toast(mode==='bg'?'Latar dipasang di belakang semua layer':'Elemen ditambahkan');
  }catch(err){
    console.warn('Tambah file ke Edit 3D gagal',err);
    msg('Gagal: '+((err&&err.message)||err));
  }finally{busy=false;$('s3-hx-go').disabled=false}
}
function sizeVis(){const b=$('s3-hx-size');if(b)b.style.display=$('s3-hx-mode').value==='el'?'':'none'}
function init(){
  if(!$('s3-add-html'))return;
  $('s3-add-html').onclick=()=>{
    if(!sc())return;
    $('s3-hx-file').value='';msg('');sizeVis();$('s3-dlg-html').showModal();
  };
  $('s3-hx-mode').onchange=sizeVis;
  $('s3-hx-go').onclick=go;
  $('s3-hx-cancel').onclick=()=>{if(!busy)$('s3-dlg-html').close()};
  sizeVis();
}
try{init()}catch(e){console.error('Fitur latar/elemen dari file gagal dimuat',e)}
})();
