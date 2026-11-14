/* QR preset: bagikan dan buka preset lewat kode QR, di editor video (2D) dan Edit 3D.
   Dimuat setelah js/qrcode.js, js/presets.js dan js/s3preset.js (isi file-file itu tidak diubah).

   CARA KERJA
   1) BUAT QR: file preset yang SAMA PERSIS dengan hasil tombol "⬇ Preset" (2D: .apkpreset / .json, 3D: .preset) diambil sebagai byte,
      dikompres gzip HANYA kalau memang lebih kecil (lossless: setelah dibuka kembali byte-nya identik, audio/foto/video tidak diubah),
      dipotong jadi beberapa bagian, dan tiap bagian jadi satu QR (mode alfanumerik, koreksi kesalahan M).
      QR diputar otomatis berurutan, kecepatannya bisa diatur. Bisa juga disimpan sebagai PNG (satu file) atau ZIP berisi semua PNG.
   2) SCAN QR: kamera di dalam editor, atau unggah gambar QR / ZIP dari galeri. Bagian boleh datang acak dan berulang.
      Setelah lengkap, byte disusun lagi, dicek panjang + CRC32 (+ SHA-256 bila tersedia), baru ditampilkan PRATINJAU
      dengan tombol Buka / Simpan file / Batal. Kalau ada satu saja yang tidak cocok, preset ditolak, tidak pernah dibuka setengah-setengah.
   FORMAT QR (teks, huruf besar saja):  APKQR1:<ID>:<NOMOR>:<TOTAL>:<ISI base45>
      nomor 0 = metadata (nama, nama file, jenis 2D/3D, gzip, ukuran, CRC32, SHA-256); nomor 1..TOTAL-1 = potongan data. */
(function(){
'use strict';
window.APK=window.APK||{};
const AL=APK.qr.ALNUM;
const REV={};for(let i=0;i<AL.length;i++)REV[AL[i]]=i;
const TE=new TextEncoder(),TD=new TextDecoder();
const $=id=>document.getElementById(id);
function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3800)}

/* ===== base45 (alfabet sama persis dengan mode alfanumerik QR: 2 byte jadi 3 karakter) ===== */
function b45enc(u){
  let s='';
  for(let i=0;i<u.length;i+=2){
    if(i+1<u.length){const n=u[i]*256+u[i+1];s+=AL[n%45]+AL[Math.floor(n/45)%45]+AL[Math.floor(n/2025)]}
    else{const n=u[i];s+=AL[n%45]+AL[Math.floor(n/45)]}
  }
  return s;
}
function b45dec(s){
  const out=[];let i=0;
  for(;i+3<=s.length;i+=3){
    const a=REV[s[i]],b=REV[s[i+1]],c=REV[s[i+2]];
    if(a===undefined||b===undefined||c===undefined)throw new Error('data QR rusak');
    const n=a+b*45+c*2025;if(n>65535)throw new Error('data QR rusak');
    out.push(n>>8,n&255);
  }
  const r=s.length-i;
  if(r===2){const a=REV[s[i]],b=REV[s[i+1]];if(a===undefined||b===undefined)throw new Error('data QR rusak');const n=a+b*45;if(n>255)throw new Error('data QR rusak');out.push(n)}
  else if(r!==0)throw new Error('data QR rusak');
  return Uint8Array.from(out);
}

/* ===== CRC32, SHA-256, gzip, inflate ===== */
const CT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CT[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
async function sha256hex(u){
  try{if(typeof crypto!=='undefined'&&crypto.subtle){const d=await crypto.subtle.digest('SHA-256',u);return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}}catch(_){}
  return '';
}
async function pipe(u,stream){
  const w=stream.writable.getWriter();w.write(u);w.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
const gzip=u=>pipe(u,new CompressionStream('gzip'));
const gunzip=u=>{if(typeof DecompressionStream!=='function')throw new Error('browser ini tidak bisa membuka data terkompresi (gzip)');return pipe(u,new DecompressionStream('gzip'))};
const inflateRaw=u=>{if(typeof DecompressionStream!=='function')throw new Error('browser tidak bisa membuka ZIP terkompresi');return pipe(u,new DecompressionStream('deflate-raw'))};

/* ===== bingkai QR ===== */
const DENS={10:'Besar (paling mudah di-scan)',15:'Sedang',22:'Padat (QR lebih sedikit)'};
const EC='M';
const perFrame=v=>Math.floor((APK.qr.capacity(EC,v)-28)/3)*2;   /* byte data per QR (sisakan 28 karakter untuk kepala bingkai) */
const rid=()=>{let s='';for(let i=0;i<6;i++)s+='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*36)];return s};
const head=(id,i,t)=>'APKQR1:'+id+':'+i+':'+t+':';
const FRAME=/^APKQR1:([0-9A-Z]{4,12}):(\d{1,6}):(\d{1,6}):([\s\S]*)$/;
const asciiName=(s,n)=>String(s||'').normalize('NFKD').replace(/[^\w .\-]+/g,'').trim().slice(0,n)||'preset';

async function encode(bytes,info,density){
  let data=bytes,z=0;
  if(typeof CompressionStream==='function'){
    try{const g=await gzip(bytes);if(g.length<bytes.length){data=g;z=1}}catch(_){}
  }
  const per=perFrame(density),nd=Math.max(1,Math.ceil(data.length/per)),tot=nd+1,id=rid();
  const meta={n:asciiName(info.name,20),f:asciiName(info.fname,30),k:info.kind,z,s:data.length,r:bytes.length,h:await sha256hex(bytes),c:crc32(bytes).toString(16)};
  const frames=[head(id,0,tot)+b45enc(TE.encode(JSON.stringify(meta)))];
  for(let i=0;i<nd;i++)frames.push(head(id,i+1,tot)+b45enc(data.subarray(i*per,(i+1)*per)));
  return{frames,meta,id,density,gz:!!z,packed:data.length};
}

/* penampung bagian-bagian QR yang masuk (urutan acak dan duplikat tidak masalah) */
function Collector(){this.reset()}
Collector.prototype.reset=function(){this.id=null;this.tot=0;this.parts=new Map()};
Collector.prototype.add=function(text){
  const m=FRAME.exec(String(text||''));
  if(!m)return'ignored';
  const id=m[1],i=+m[2],t=+m[3];
  if(t<2||i>=t)return'ignored';
  if(this.id===null){this.id=id;this.tot=t}
  else if(this.id!==id||this.tot!==t)return'other';
  if(this.parts.has(i))return'dup';
  this.parts.set(i,m[4]);
  return this.parts.size===this.tot?'complete':'new';
};
Collector.prototype.missing=function(){const r=[];for(let i=0;i<this.tot;i++)if(!this.parts.has(i))r.push(i);return r};
async function assemble(col){
  const meta=JSON.parse(TD.decode(b45dec(col.parts.get(0))));
  const chunks=[];let len=0;
  for(let i=1;i<col.tot;i++){const c=b45dec(col.parts.get(i));chunks.push(c);len+=c.length}
  if(len!==meta.s)throw new Error('ukuran data tidak cocok (ada bagian yang rusak)');
  let data=new Uint8Array(len),o=0;for(const c of chunks){data.set(c,o);o+=c.length}
  if(meta.z)data=await gunzip(data);
  if(data.length!==meta.r)throw new Error('ukuran setelah dibuka tidak cocok');
  if(crc32(data).toString(16)!==meta.c)throw new Error('CRC32 tidak cocok: data rusak');
  if(meta.h){const h=await sha256hex(data);if(h&&h!==meta.h)throw new Error('SHA-256 tidak cocok: data rusak')}
  return{bytes:data,meta};
}

/* ===== ZIP (hanya untuk menyimpan / membuka kumpulan PNG QR) ===== */
function zipStore(files){
  const parts=[],cen=[];let off=0;
  for(const f of files){
    const nm=TE.encode(f.name),crc=crc32(f.data),len=f.data.length;
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(12,0x21,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,len,true);lh.setUint32(22,len,true);lh.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(lh.buffer),nm,f.data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,len,true);ch.setUint32(24,len,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,off,true);
    cen.push(new Uint8Array(ch.buffer),nm);
    off+=30+nm.length+len;
  }
  const cs=cen.reduce((a,b)=>a+b.length,0),eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);eo.setUint16(8,files.length,true);eo.setUint16(10,files.length,true);eo.setUint32(12,cs,true);eo.setUint32(16,off,true);
  return new Blob([...parts,...cen,new Uint8Array(eo.buffer)],{type:'application/zip'});
}
async function zipRead(file){
  const buf=new Uint8Array(await file.arrayBuffer()),dv=new DataView(buf.buffer);
  let e=-1;
  for(let i=buf.length-22;i>=Math.max(0,buf.length-65557);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('file ZIP tidak valid');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const out=[];
  for(let i=0;i<n;i++){
    if(p+46>buf.length||dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    const name=TD.decode(buf.subarray(p+46,p+46+nl));
    p+=46+nl+el+cl;
    const ds=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);
    let data=buf.subarray(ds,ds+cs);
    if(method===8)data=await inflateRaw(data);else if(method!==0)continue;
    out.push({name,data});
  }
  return out;
}

/* ===== sumber preset: sama persis dengan tombol "⬇ Preset" (2D) dan "Simpan preset" (3D) ===== */
const inS3d=()=>{const v=$('s3d');return!!v&&!v.hidden};
const safe=s=>(String(s||'').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'preset');
function idb(store,id){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('apk-3d');
    r.onerror=()=>rej(r.error);
    r.onsuccess=()=>{
      const d=r.result;
      try{const q=d.transaction(store,'readonly').objectStore(store).get(id);q.onsuccess=()=>{d.close();res(q.result)};q.onerror=()=>{d.close();rej(q.error)}}
      catch(e){d.close();rej(e)}
    };
  });
}
const readURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
function defaultName(){
  if(inS3d()){const s=APK.s3d&&APK.s3d.scene;return(s&&s.name)||'Preset 3D'}
  const p=APK.project&&APK.project.current;return(p&&p.name)||'Preset';
}
async function source2d(name,withMedia){
  const p=APK.project&&APK.project.current;
  if(!p||!APK.presets||!APK.timeline)throw new Error('Buka project dulu');
  const sel=APK.timeline.selectedIds(),all=sel.length<2,ids=all?p.tracks.flatMap(t=>t.clips.map(c=>c.id)):sel;
  if(!ids.length)throw new Error('Belum ada layer di project ini');
  const r=APK.presets.pack(p,ids,name);
  if(!r.o)throw new Error('Tidak ada layer yang bisa disimpan');
  if(!withMedia)r.media=0;
  const b=await APK.presets.build(p,r,safe(name));
  return{blob:b.blob,fname:b.fname,kind:'2'};
}
async function source3d(name,withMedia){
  const s=APK.s3d&&APK.s3d.scene;
  if(!s)throw new Error('Buka project 3D dulu');
  const scene=JSON.parse(JSON.stringify({name,aspect:s.aspect,dur:s.dur,music:s.music||null,cuts:s.cuts||[],items:s.items}));
  const pkg={format:'apk-preset',kind:'edit3d',version:1,name,created:Date.now(),scene};
  if(withMedia){
    const ids=new Set();
    s.items.forEach(i=>{if((i.kind==='image'||i.kind==='video')&&i.mediaId&&!/^ph\d+$/.test(i.mediaId))ids.add(i.mediaId)});
    if(s.music)ids.add(s.music);
    pkg.media={};
    for(const id of ids){const r=await idb('media',id);if(r&&r.blob)pkg.media[id]={name:r.name||'media',type:r.type||r.blob.type||'',data:await readURL(r.blob)}}
  }
  return{blob:new Blob([JSON.stringify(pkg)],{type:'application/octet-stream'}),fname:safe(name)+'.preset',kind:'3'};
}

/* ===== membaca preset yang diterima (untuk pratinjau) ===== */
async function describe(bytes,meta){
  const fname=meta.f||'preset',file=new File([bytes],fname,{type:'application/octet-stream'});
  const head=TD.decode(bytes.subarray(0,10));
  if(head==='APKPRESET3'||meta.k==='2'){
    const o=await APK.presets.readFile(file);
    const n=Array.isArray(o.items)?o.items.length:0;
    if(!n)throw new Error('isi preset tidak dikenal');
    const mm=Array.isArray(o.media)?o.media.length:0;
    return{file,kind:'2',title:String(o.name||meta.n||'Preset'),lines:['Editor video (2D)',n+' layer',mm?mm+' media di dalam preset':'tanpa media']};
  }
  let root;try{root=JSON.parse(TD.decode(bytes))}catch(_){throw new Error('isi preset tidak dikenal')}
  const sc=root&&(root.scene&&typeof root.scene==='object'?root.scene:root);
  if(!sc||!Array.isArray(sc.items))throw new Error('isi preset tidak dikenal');
  const mm=root.media&&typeof root.media==='object'?Object.keys(root.media).length:0;
  return{file,kind:'3',title:String(root.name||sc.name||meta.n||'Preset 3D'),lines:['Edit 3D',sc.items.length+' layer'+(sc.aspect?' · '+sc.aspect:'')+(sc.dur?' · '+sc.dur+' dtk':''),mm?mm+' media di dalam preset':'tanpa media']};
}

/* ===== pemindai: BarcodeDetector bila ada, kalau tidak jsQR (dimuat sekali dari cdnjs) ===== */
let bd=null,jsqrP=null;
async function detector(){
  if(bd!==null)return bd;
  try{if('BarcodeDetector' in window){const f=await BarcodeDetector.getSupportedFormats();if(f.includes('qr_code')){bd=new BarcodeDetector({formats:['qr_code']});return bd}}}catch(_){}
  return bd=false;
}
function loadJsQR(){
  if(window.jsQR)return Promise.resolve(window.jsQR);
  return jsqrP||(jsqrP=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    s.onload=()=>window.jsQR?res(window.jsQR):rej(new Error('pustaka jsQR gagal dimuat'));
    s.onerror=()=>{jsqrP=null;rej(new Error('pemindai QR di browser ini butuh internet sekali untuk memuat pustaka jsQR'))};
    document.head.appendChild(s);
  }));
}
async function scanCanvas(cv,fallback,invert){
  const d=await detector();
  if(d){
    try{const r=await d.detect(cv);if(r.length)return r.map(x=>x.rawValue)}catch(_){}
    if(!fallback)return[];
  }
  const q=await loadJsQR(),w=cv.width,h=cv.height,im=cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h);
  const r=q(im.data,w,h,{inversionAttempts:invert?'attemptBoth':'dontInvert'});
  return r&&typeof r.data==='string'?[r.data]:[];
}

/* ===== antarmuka ===== */
const CSS=`#qrp-dlg{max-width:min(94vw,520px);width:100%}
#qrp-dlg .qrp-tabs{display:flex;gap:8px;margin:0 0 12px}
#qrp-dlg .qrp-tabs .btn{flex:1}
#qrp-dlg section[hidden],#qrp-dlg [hidden]{display:none}
#qrp-dlg canvas.qrp-cv{display:block;width:min(88vw,420px);height:auto;margin:10px auto;background:#fff;image-rendering:pixelated;border-radius:6px}
#qrp-dlg video.qrp-vid{display:block;width:100%;max-height:46vh;background:#000;border-radius:6px;margin:8px 0}
#qrp-dlg .qrp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin:6px 0}
#qrp-dlg .qrp-bar{height:8px;background:#2a2f3a;border-radius:4px;overflow:hidden;margin:8px 0}
#qrp-dlg .qrp-bar i{display:block;height:100%;width:0;background:#4b8bff;transition:width .15s}
#qrp-dlg .qrp-ck{display:flex;gap:8px;align-items:center}
#qrp-dlg .qrp-warn{color:#ffcf6b}
#qrp-dlg .qrp-pv{border:1px solid #4b5bd6;border-radius:8px;padding:10px;margin:10px 0}`;
const S={tab:'mk',frames:null,enc:null,idx:0,timer:0,playing:false,cache:new Map(),src:null,
  col:new Collector(),cam:null,camOn:false,busy:false,pv:null};

function build(){
  if($('qrp-dlg'))return;
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const d=document.createElement('dialog');d.id='qrp-dlg';
  d.innerHTML='<form method="dialog" onsubmit="return false"><h3>QR preset</h3>'
  +'<div class="qrp-tabs"><button type="button" class="btn on" data-t="mk">Buat QR</button><button type="button" class="btn" data-t="sc">Scan QR</button></div>'
  +'<section id="qrp-mk">'
    +'<p class="meta" id="qrp-src"></p>'
    +'<label>Nama preset<input id="qrp-name" maxlength="40"></label>'
    +'<label class="qrp-ck"><input type="checkbox" id="qrp-media" checked> Sertakan foto, video, dan musik (isi 100% sama)</label>'
    +'<label>Kepadatan QR<select id="qrp-dens"><option value="10">'+DENS[10]+'</option><option value="15" selected>'+DENS[15]+'</option><option value="22">'+DENS[22]+'</option></select></label>'
    +'<label>Kecepatan ganti QR: <b id="qrp-spd-v"></b><input type="range" id="qrp-spd" min="1" max="8" step="1" value="2" style="width:100%"></label>'
    +'<div class="dlg-actions"><button class="btn primary" type="button" id="qrp-go">Buat QR</button></div>'
    +'<div id="qrp-out" hidden>'
      +'<canvas class="qrp-cv" id="qrp-cv" aria-label="Kode QR preset"></canvas>'
      +'<p class="meta" id="qrp-cnt" style="text-align:center"></p>'
      +'<div class="qrp-row"><button class="btn" type="button" id="qrp-prev" aria-label="QR sebelumnya">◀</button><button class="btn" type="button" id="qrp-play">⏸ Jeda</button><button class="btn" type="button" id="qrp-next" aria-label="QR berikutnya">▶</button></div>'
      +'<p class="meta" id="qrp-info"></p>'
      +'<div class="qrp-row"><button class="btn" type="button" id="qrp-savef">⬇ File preset</button><button class="btn" type="button" id="qrp-savep">⬇ Simpan QR (PNG / ZIP)</button></div>'
      +'<p class="meta" id="qrp-save-st"></p>'
    +'</div>'
  +'</section>'
  +'<section id="qrp-sc" hidden>'
    +'<p class="meta">Arahkan kamera ke QR yang berputar di layar lain (bagian boleh terlewat, nanti terulang), atau unggah gambar QR / ZIP dari galeri.</p>'
    +'<div class="qrp-row"><button class="btn primary" type="button" id="qrp-cam">📷 Buka kamera</button><button class="btn" type="button" id="qrp-up">🖼 Unggah gambar / ZIP</button></div>'
    +'<video class="qrp-vid" id="qrp-vid" playsinline muted hidden></video><canvas id="qrp-wk" hidden></canvas>'
    +'<div class="qrp-bar"><i id="qrp-fill"></i></div><p class="meta" id="qrp-prog">Belum ada QR terbaca.</p>'
    +'<div class="qrp-pv" id="qrp-pv" hidden><b id="qrp-pv-t"></b><p class="meta" id="qrp-pv-l"></p>'
      +'<div class="qrp-row"><button class="btn primary" type="button" id="qrp-pv-open">Buka</button><button class="btn" type="button" id="qrp-pv-save">⬇ Simpan file</button><button class="btn" type="button" id="qrp-pv-no">Batal</button></div></div>'
    +'<div class="qrp-row"><button class="btn" type="button" id="qrp-reset">Mulai ulang scan</button></div>'
    +'<input type="file" id="qrp-file" accept="image/*,.zip,application/zip" multiple hidden>'
  +'</section>'
  +'<div class="dlg-actions"><button class="btn" type="button" id="qrp-close">Tutup</button></div></form>';
  document.body.appendChild(d);
  d.querySelectorAll('.qrp-tabs .btn').forEach(b=>b.onclick=()=>tab(b.dataset.t));
  $('qrp-go').onclick=generate;
  $('qrp-spd').oninput=speedChanged;
  $('qrp-prev').onclick=()=>{S.playing=false;showFrame(S.idx-1);syncPlay()};
  $('qrp-next').onclick=()=>{S.playing=false;showFrame(S.idx+1);syncPlay()};
  $('qrp-play').onclick=()=>{S.playing=!S.playing;syncPlay();if(S.playing)schedule()};
  $('qrp-savef').onclick=()=>{if(S.src)download(S.src.blob,S.src.fname)};
  $('qrp-savep').onclick=savePng;
  $('qrp-cam').onclick=()=>S.camOn?stopCam():startCam();
  $('qrp-up').onclick=()=>$('qrp-file').click();
  $('qrp-file').onchange=async e=>{const fl=[...e.target.files];e.target.value='';if(fl.length)await scanFiles(fl)};
  $('qrp-reset').onclick=resetScan;
  $('qrp-pv-open').onclick=openPreview;
  $('qrp-pv-save').onclick=()=>{if(S.pv)download(S.pv.file,S.pv.file.name)};
  $('qrp-pv-no').onclick=resetScan;
  $('qrp-close').onclick=()=>d.close();
  d.addEventListener('close',()=>{stopCam();stopPlay()});
  speedChanged();
}
const fps=()=>+$('qrp-spd').value;
function speedChanged(){
  $('qrp-spd-v').textContent=fps()+' QR/detik';
  if(S.enc)updateInfo();
}
function tab(t){
  S.tab=t;
  document.querySelectorAll('#qrp-dlg .qrp-tabs .btn').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  $('qrp-mk').hidden=t!=='mk';$('qrp-sc').hidden=t!=='sc';
  if(t!=='sc')stopCam();
  if(t==='mk'){syncPlay();if(S.playing)schedule()}else stopPlay(true);
}
function open(t){
  build();
  const d=$('qrp-dlg');
  if(!d.open)d.showModal();
  if(t==='mk'){
    const s3=inS3d();
    $('qrp-src').textContent=s3?'Sumber: scene Edit 3D yang sedang dibuka.':'Sumber: semua layer project (atau hanya yang dipilih bila memilih 2 clip atau lebih).';
    $('qrp-name').value=defaultName().slice(0,40);
    S.enc=null;S.src=null;stopPlay();$('qrp-out').hidden=true;$('qrp-save-st').textContent='';
  }
  tab(t);
}

/* --- membuat QR --- */
async function generate(){
  if(S.busy)return;
  S.busy=true;const go=$('qrp-go');go.disabled=true;
  try{
    stopPlay();$('qrp-out').hidden=true;
    const name=($('qrp-name').value||'').trim().slice(0,40)||defaultName(),media=$('qrp-media').checked;
    go.textContent='Menyiapkan preset…';
    const src=inS3d()?await source3d(name,media):await source2d(name,media);
    const bytes=new Uint8Array(await src.blob.arrayBuffer());
    go.textContent='Membuat QR…';
    const enc=await encode(bytes,{name,fname:src.fname,kind:src.kind},+$('qrp-dens').value);
    S.src=src;S.enc=enc;S.cache.clear();S.idx=0;S.playing=true;
    $('qrp-out').hidden=false;$('qrp-save-st').textContent='';
    updateInfo();showFrame(0);syncPlay();schedule();
  }catch(e){
    console.warn('Buat QR gagal',e);toast('Gagal membuat QR: '+((e&&e.message)||e));
  }finally{S.busy=false;go.disabled=false;go.textContent='Buat QR'}
}
function mb(b){return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB'}
function updateInfo(){
  const e=S.enc,n=e.frames.length,sec=Math.ceil(n/fps()),t=sec>=120?Math.round(sec/60)+' menit':sec+' detik';
  let h='Ukuran file '+mb(S.src.blob.size)+(e.gz?', dikompres gzip (lossless) jadi '+mb(e.packed):', tanpa kompresi (tidak jadi lebih kecil)')+'. Total '+n+' QR, satu putaran ± '+t+'.';
  if(n>400)h+=' PERHATIAN: preset ini besar. Scan jadi lama dan sebaiknya lewat PNG/ZIP; kalau mau lebih cepat, matikan "Sertakan foto, video, dan musik".';
  $('qrp-info').textContent=h;$('qrp-info').classList.toggle('qrp-warn',n>400);
}
function frameQR(i){
  let q=S.cache.get(i);
  if(!q){q=APK.qr.make(S.enc.frames[i],{ec:EC,minVersion:S.enc.density});S.cache.set(i,q);if(S.cache.size>60)S.cache.delete(S.cache.keys().next().value)}
  return q;
}
function drawQR(cv,q,px,quiet){
  const n=(q.size+2*quiet)*px;cv.width=cv.height=n;
  const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,n,n);g.fillStyle='#000';
  for(let y=0;y<q.size;y++)for(let x=0;x<q.size;x++)if(q.get(x,y))g.fillRect((x+quiet)*px,(y+quiet)*px,px,px);
}
function showFrame(i){
  const n=S.enc.frames.length;S.idx=((i%n)+n)%n;
  drawQR($('qrp-cv'),frameQR(S.idx),8,4);
  $('qrp-cnt').textContent='QR '+(S.idx+1)+' / '+n+(S.idx===0?' (data awal)':'');
  setTimeout(()=>{if(S.enc&&S.enc.frames.length>1)try{frameQR((S.idx+1)%S.enc.frames.length)}catch(_){}},0);
}
function schedule(){
  clearTimeout(S.timer);
  if(!S.playing||!S.enc)return;
  S.timer=setTimeout(()=>{if(!S.playing||!S.enc)return;showFrame(S.idx+1);schedule()},1000/fps());
}
function stopPlay(keepFlag){clearTimeout(S.timer);if(!keepFlag)S.playing=false}
function syncPlay(){const b=$('qrp-play');if(b)b.textContent=S.playing?'⏸ Jeda':'▶ Putar'}
function download(blob,fname){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=fname;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
const toBlob=cv=>new Promise(r=>cv.toBlob(r,'image/png'));
async function savePng(){
  if(!S.enc||S.busy)return;
  S.busy=true;const st=$('qrp-save-st'),n=S.enc.frames.length,base=safe(S.enc.meta.n);
  try{
    const cv=document.createElement('canvas');
    if(n===1){
      drawQR(cv,APK.qr.make(S.enc.frames[0],{ec:EC,minVersion:S.enc.density}),10,4);
      download(await toBlob(cv),base+'-qr.png');st.textContent='Tersimpan: '+base+'-qr.png';return;
    }
    const files=[],pad=String(n).length<4?4:String(n).length;
    for(let i=0;i<n;i++){
      drawQR(cv,APK.qr.make(S.enc.frames[i],{ec:EC,minVersion:S.enc.density}),10,4);
      files.push({name:base+'-qr-'+String(i+1).padStart(pad,'0')+'.png',data:new Uint8Array(await (await toBlob(cv)).arrayBuffer())});
      if(i%5===0||i===n-1){st.textContent='Membuat PNG '+(i+1)+' / '+n+'…';await new Promise(r=>setTimeout(r,0))}
    }
    download(zipStore(files),base+'-qr.zip');
    st.textContent='Tersimpan: '+base+'-qr.zip ('+n+' gambar). Buka lewat tab Scan QR > Unggah gambar / ZIP.';
  }catch(e){console.warn(e);st.textContent='Gagal menyimpan QR: '+((e&&e.message)||e)}
  finally{S.busy=false}
}

/* --- scan --- */
function progress(){
  const c=S.col,fill=$('qrp-fill'),p=$('qrp-prog');
  if(c.id===null){fill.style.width='0';p.textContent='Belum ada QR terbaca.';return}
  const got=c.parts.size;fill.style.width=Math.round(got*100/c.tot)+'%';
  const miss=c.missing();
  p.textContent='Terbaca '+got+' dari '+c.tot+' QR'+(miss.length&&miss.length<=12?'. Belum: '+miss.map(x=>x+1).join(', '):'')+'.';
}
function resetScan(){
  S.col.reset();S.pv=null;$('qrp-pv').hidden=true;progress();
}
async function feed(texts){
  let note=0;
  for(const t of texts){
    const r=S.col.add(t);
    if(r==='other')note=1;
    if(r==='complete'){progress();await finish();return true}
  }
  progress();
  if(note)toast('Ada QR dari preset lain, diabaikan. Tekan "Mulai ulang scan" untuk ganti preset.');
  return false;
}
async function finish(){
  stopCam();
  try{
    const a=await assemble(S.col),d=await describe(a.bytes,a.meta);
    S.pv=d;
    $('qrp-pv-t').textContent=d.title;$('qrp-pv-l').textContent=d.lines.join(' · ')+' · '+mb(a.bytes.length)+'. Data lengkap dan sudah diperiksa (CRC'+(a.meta.h?' + SHA-256':'')+' cocok).';
    $('qrp-pv').hidden=false;
  }catch(e){
    console.warn('Preset QR ditolak',e);
    S.col.reset();progress();toast('Preset dari QR ditolak: '+((e&&e.message)||e));
  }
}
async function openPreview(){
  const d=S.pv;if(!d)return;
  try{
    if(d.kind==='3'){
      if(!(APK.s3preset&&APK.s3preset.importFile))throw new Error('Edit 3D belum siap');
      $('qrp-dlg').close();await APK.s3preset.importFile(d.file);
    }else{
      if(!(APK.project&&APK.project.current&&APK.presets))throw new Error('Buka project editor video dulu, lalu scan lagi dari sana');
      $('qrp-dlg').close();await APK.presets.load(d.file);
    }
    S.col.reset();S.pv=null;
  }catch(e){toast('Gagal membuka preset: '+((e&&e.message)||e))}
}
async function startCam(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('Kamera tidak tersedia di sini (butuh HTTPS). Pakai "Unggah gambar / ZIP".');return}
  try{
    S.cam=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
  }catch(e){toast('Kamera tidak bisa dibuka: '+((e&&e.message)||e)+'. Izinkan akses kamera atau pakai "Unggah gambar / ZIP".');return}
  const v=$('qrp-vid');v.srcObject=S.cam;v.hidden=false;
  try{await v.play()}catch(_){}
  S.camOn=true;$('qrp-cam').textContent='⏹ Tutup kamera';
  try{if(!(await detector()))await loadJsQR()}catch(e){toast(e.message);stopCam();return}
  loop();
}
function stopCam(){
  S.camOn=false;
  if(S.cam){S.cam.getTracks().forEach(t=>t.stop());S.cam=null}
  const v=$('qrp-vid'),b=$('qrp-cam');
  if(v){v.srcObject=null;v.hidden=true}
  if(b)b.textContent='📷 Buka kamera';
}
async function loop(){
  if(!S.camOn)return;
  const v=$('qrp-vid'),cv=$('qrp-wk');
  if(v.readyState>=2&&v.videoWidth){
    const sc=Math.min(1,1280/v.videoWidth);cv.width=Math.round(v.videoWidth*sc);cv.height=Math.round(v.videoHeight*sc);
    cv.getContext('2d',{willReadFrequently:true}).drawImage(v,0,0,cv.width,cv.height);
    try{if(await feed(await scanCanvas(cv,false,false)))return}catch(e){toast(e.message);stopCam();return}
  }
  setTimeout(loop,70);
}
async function scanFiles(files){
  if(S.busy)return;S.busy=true;
  const p=$('qrp-prog');
  try{
    const list=[];
    for(const f of files){
      if(/\.zip$/i.test(f.name)||f.type==='application/zip'){
        const z=await zipRead(f);
        z.filter(x=>/\.(png|jpe?g|webp|gif|bmp)$/i.test(x.name)).sort((a,b)=>a.name<b.name?-1:1)
          .forEach(x=>list.push(new Blob([x.data],{type:/\.png$/i.test(x.name)?'image/png':/\.webp$/i.test(x.name)?'image/webp':'image/jpeg'})));
      }else list.push(f);
    }
    if(!list.length){toast('Tidak ada gambar QR di file itu');return}
    const cv=$('qrp-wk');let read=0,fail=0;
    for(let i=0;i<list.length;i++){
      p.textContent='Membaca gambar '+(i+1)+' / '+list.length+'…';
      let bmp;try{bmp=await createImageBitmap(list[i])}catch(_){fail++;continue}
      const sc=Math.min(1,2000/Math.max(bmp.width,bmp.height));
      cv.width=Math.round(bmp.width*sc);cv.height=Math.round(bmp.height*sc);
      cv.getContext('2d',{willReadFrequently:true}).drawImage(bmp,0,0,cv.width,cv.height);
      if(bmp.close)bmp.close();
      let texts=[];
      try{texts=await scanCanvas(cv,true,true)}catch(e){toast(e.message);return}
      if(!texts.length){fail++;continue}
      read++;
      if(await feed(texts))return;
      if(i%10===9)await new Promise(r=>setTimeout(r,0));
    }
    progress();
    if(fail)toast(fail+' gambar tidak berisi QR yang terbaca');
    if(S.col.id!==null&&S.col.parts.size<S.col.tot)toast('Belum lengkap. Unggah gambar QR yang masih kurang, atau lanjutkan dengan kamera.');
  }catch(e){toast('Gagal membaca gambar: '+((e&&e.message)||e))}
  finally{S.busy=false}
}

/* ===== tombol ===== */
function init(){
  if(typeof document==='undefined')return;
  const mk=(id,txt,tip,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.id=id;b.textContent=txt;b.title=tip;b.onclick=fn;return b};
  const anchor=$('btn-mode');
  if(anchor&&APK.presets)anchor.before(mk('btn-qr','▣ QR','Bagikan atau buka preset lewat kode QR (buat QR, scan kamera, unggah gambar QR)',()=>open('mk')));
  const tools=document.querySelector('#s3d .s3-tools');
  if(tools&&APK.s3preset)tools.appendChild(mk('s3-qr','▣ QR','Bagikan atau buka preset lewat kode QR',()=>open('mk')));
  const dn=$('s3-dlg-new'),acts=dn&&dn.querySelector('.dlg-actions');
  if(dn&&acts&&APK.s3preset){
    const b=document.createElement('button');b.type='button';b.className='s3-tpl';b.id='qrp-home';
    b.innerHTML='<b>▣ Scan QR preset</b><small>Buka preset 3D dari kode QR (kamera atau gambar). Tampil pratinjau dulu, baru Buka.</small>';
    b.onclick=()=>open('sc');acts.insertAdjacentElement('beforebegin',b);
  }
}
APK.qrpreset={open,encode,assemble,Collector,b45enc,b45dec,zipStore,zipRead,crc32,perFrame};
try{init()}catch(e){console.error('QR preset gagal dimuat',e)}
})();
