/* Alat tambahan Edit 3D (dimuat setelah js/scene3d.js, isi scene3d.js tidak diubah).
   1) UNDO / REDO untuk seluruh isi scene 3D: layer, keyframe, kamera, potongan kamera, hasil tracking, rasio, durasi, musik.
      Perubahan dicatat otomatis dan digabung per ±0,5 detik, jadi satu seretan objek atau slider = 1 langkah undo.
      Tombol ↶ ↷ di bilah atas, atau Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z).
   2) KIRIM KE EDITOR VIDEO: scene dirender lewat export bawaan Edit 3D (frame per frame kalau didukung), lalu hasilnya
      dipasang sebagai klip video di project editor APK EDITING yang biasa (project baru atau project yang sudah ada),
      dan editor langsung terbuka. Kalau pengiriman gagal, hasil render diunduh sebagai file supaya tidak sia-sia.
   3) HAPUS: kotak "Hapus" di properti (layer, keyframe di waktu ini, semua keyframe, musik), tombol ✕ per properti,
      ketuk 2x tanda ◆ di bawah slider waktu, dan tombol Delete / Backspace. Semuanya bisa di-undo.
   4) 2 TAMPILAN: tombol "◫ 2 Tampilan" menampilkan hasil kamera (kiri) dan ruang 3D (kanan) sekaligus. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sc=()=>{try{return(APK.s3d&&APK.s3d.scene)||null}catch(_){return null}};
const dlgOpen=()=>!!document.querySelector('dialog[open]');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* ===================== UNDO / REDO ===================== */
const H={ref:null,last:null,u:[],r:[],timer:0,size:0};
const MAXN=80,MAXB=30e6;
const snap=s=>JSON.stringify({name:s.name,aspect:s.aspect,dur:s.dur,music:s.music||null,cuts:s.cuts||[],items:s.items});
function ui(){
  const u=$('s3-undo'),r=$('s3-redo');
  if(u)u.disabled=!(H.u.length||(H.timer&&sc()===H.ref));
  if(r)r.disabled=!H.r.length;
}
function reset(s){clearTimeout(H.timer);H.timer=0;H.ref=s;H.u=[];H.r=[];H.size=0;H.last=s?snap(s):null;ui()}
/* catat keadaan sekarang sebagai satu langkah kalau berbeda dari catatan terakhir */
function commit(){
  clearTimeout(H.timer);H.timer=0;
  const s=sc();
  if(s!==H.ref){reset(s);return}   /* scene baru dibuka: keadaan awalnya jadi dasar riwayat */
  if(s){
    const n=snap(s);
    if(n!==H.last){
      H.u.push(H.last);H.size+=H.last.length;H.last=n;H.r=[];
      while(H.u.length>MAXN||(H.size>MAXB&&H.u.length>1))H.size-=H.u.shift().length;
    }
  }
  ui();
}
function later(){
  if(!sc())return;
  clearTimeout(H.timer);H.timer=setTimeout(commit,450);ui();
}
/* pasang keadaan dari catatan ke scene yang sedang terbuka, lalu segarkan panel */
function apply(str){
  const s=sc(),api=APK.s3d,o=JSON.parse(str);
  const play=$('s3-play');if(play&&play.textContent.trim()==='❚❚')play.click();
  const chip=document.querySelector('#s3-chips .on'),sid=chip&&chip.dataset.sel;
  const t0=parseFloat(($('s3-time')||{}).value)||0;
  s.name=o.name;s.aspect=o.aspect;s.dur=o.dur;s.music=o.music;s.cuts=o.cuts;s.items=o.items;
  s.items.forEach(i=>{i.keys=i.keys||{};i.props=i.props||{}});
  const nm=$('s3-name');if(nm){nm.value=s.name||'';nm.dispatchEvent(new Event('input',{bubbles:true}))}   /* sekalian memicu simpan otomatis */
  $('s3-music').textContent=s.music?'♪ musik':'♪ Musik';
  $('s3-dur').value=s.dur;$('s3-time').max=s.dur;
  const as=$('s3-aspect');if(as&&as.value!==s.aspect){as.value=s.aspect;as.dispatchEvent(new Event('change'))}   /* ukuran kanvas ikut menyesuaikan */
  api._setT(Math.min(t0,s.dur));
  api.select(s.items.some(i=>i.id===sid)?sid:'cam');
}
function undo(){
  if(!sc()||dlgOpen())return;
  commit();
  if(!H.u.length){toast('Tidak ada yang bisa di-undo');return}
  const prev=H.u.pop();H.size-=prev.length;H.r.push(H.last);H.last=prev;
  apply(prev);ui();toast('Undo');
}
function redo(){
  if(!sc()||dlgOpen())return;
  commit();
  if(!H.r.length){toast('Tidak ada yang bisa di-redo');return}
  const nx=H.r.pop();H.u.push(H.last);H.size+=H.last.length;H.last=nx;
  apply(nx);ui();toast('Redo');
}

/* ===================== KIRIM KE EDITOR VIDEO ===================== */
const ASP={'16:9':[16,9],'9:16':[9,16],'1:1':[1,1],'4:3':[4,3],'21:9':[21,9]};
function dims(aspect,short){
  const [a,b]=ASP[aspect]||ASP['16:9'];let w,h;
  if(a>=b){h=short;w=Math.round(short*a/b)}else{w=short;h=Math.round(short*b/a)}
  return[w+w%2,h+h%2];
}
const hasPre=s=>!!(window.VideoEncoder&&window.VideoFrame&&window.Mp4Muxer)
  &&(!(s&&s.music)||!!(window.AudioEncoder&&window.AudioData&&(window.OfflineAudioContext||window.webkitOfflineAudioContext)));
let send=null,own=false;
const realClick=HTMLAnchorElement.prototype.click;
function saveBlob(b,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;
  realClick.call(a);setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
/* Selama pengiriman, "unduh file" milik export Edit 3D dialihkan: hasilnya dikirim ke editor, bukan diunduh */
HTMLAnchorElement.prototype.click=function(){
  if(send&&this.download&&/^blob:/.test(this.href)){
    const job=send,name=this.download,url=this.href;send=null;
    fetch(url).then(r=>r.blob()).then(b=>deliver(b,name,job)).catch(err=>{
      console.warn('Kirim ke editor gagal',err);try{$('s3-dlg-ex').close()}catch(_){}
      toast('Hasil render tidak terbaca, coba lagi atau pakai tombol Export');
    });
    return;
  }
  return realClick.apply(this,arguments);
};
/* baca durasi, ukuran, dan frame cuplikan dari video hasil render */
function probe(blob,want){
  return new Promise(res=>{
    const u=URL.createObjectURL(blob),v=document.createElement('video'),info={duration:0,width:0,height:0,thumb:null};
    let done=false,to=0;
    const fin=()=>{if(done)return;done=true;clearTimeout(to);try{v.removeAttribute('src');v.load()}catch(_){}URL.revokeObjectURL(u);res(info)};
    to=setTimeout(fin,6000);
    v.preload='auto';v.muted=true;v.playsInline=true;v.onerror=fin;
    v.onloadedmetadata=()=>{
      info.width=v.videoWidth||0;info.height=v.videoHeight||0;
      info.duration=isFinite(v.duration)&&v.duration>0?v.duration:0;
      const len=info.duration||want||1;
      v.onseeked=()=>{
        try{
          if(v.videoWidth){
            const k=160/Math.max(v.videoWidth,v.videoHeight),c=document.createElement('canvas');
            c.width=Math.max(1,Math.round(v.videoWidth*k));c.height=Math.max(1,Math.round(v.videoHeight*k));
            c.getContext('2d').drawImage(v,0,0,c.width,c.height);info.thumb=c.toDataURL('image/jpeg',.7);
          }
        }catch(_){}
        fin();
      };
      try{v.currentTime=Math.min(Math.max(.1,len*.35),Math.max(0,len-.05))}catch(_){fin()}
    };
    v.src=u;
  });
}
async function deliver(blob,fname,job){
  const dlg=$('s3-dlg-ex'),s=sc();
  setTimeout(()=>{const st=$('s3-ex-status');if(st)st.textContent='Mengirim ke editor video…'},0);
  if(!s){try{dlg.close()}catch(_){}saveBlob(blob,fname);toast('Scene sudah ditutup, hasil render diunduh sebagai file');return}
  const ext=(fname.split('.').pop()||'mp4').toLowerCase(),uid=x=>x+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  let mid=null;
  try{
    const info=await probe(blob,s.dur),dur=info.duration||s.dur,fb=dims(s.aspect,job.short),P=APK.project,isNew=job.target==='new';
    let p;
    if(isNew)p=P.create({name:s.name||'Project 3D',aspect:s.aspect,quality:job.short,fps:job.fps});
    else{p=await APK.db.get(job.target);if(!p)throw new Error('project tujuan tidak ditemukan')}
    if(!Array.isArray(p.media))p.media=[];
    if(!Array.isArray(p.tracks))p.tracks=[];
    mid=uid('m_');
    await APK.db.putMedia({id:mid,projectId:p.id,blob});
    p.media.push({id:mid,name:(s.name||'Edit 3D').slice(0,50)+' (3D).'+ext,type:'video',size:blob.size,mime:blob.type||('video/'+ext),
      width:info.width||fb[0],height:info.height||fb[1],duration:dur,thumb:info.thumb});
    const mk=(kind,n)=>({id:uid('t_'),kind,name:(kind==='audio'?'Audio ':'Video ')+n,muted:false,clips:[]});
    if(!p.tracks.length)p.tracks=[mk('video',1),mk('audio',1)];
    let tr=p.tracks.find(t=>t.kind==='video'&&!t.locked);
    if(!tr){tr=mk('video',p.tracks.filter(t=>t.kind==='video').length+1);p.tracks.unshift(tr)}
    const start=tr.clips.reduce((a,c)=>Math.max(a,c.start+c.dur),0);   /* menyusul di ujung track video, seperti tombol + di panel Media */
    tr.clips.push({id:uid('c_'),mediaId:mid,start,in:0,dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1}});
    p.updated=Date.now();
    await APK.db.put(p);
    mid=null;   /* project sudah menyimpan media ini, jangan dihapus lagi kalau langkah berikutnya gagal */
    try{dlg.close()}catch(_){}
    $('s3-back').click();   /* menyimpan scene 3D lalu kembali ke beranda */
    for(let i=0;i<100&&sc();i++)await wait(50);
    if(sc()){toast('Klip sudah ditambahkan ke project "'+p.name+'". Buka lewat Project terakhir.');return}
    await APK.app.openProject(p);
    toast('Hasil Edit 3D dipasang sebagai klip di "'+p.name+'"');
  }catch(err){
    console.warn('Kirim ke editor gagal',err);
    if(mid){try{await APK.db.delMedia(mid)}catch(_){}}
    try{dlg.close()}catch(_){}
    saveBlob(blob,fname);
    toast('Gagal mengirim ke editor ('+((err&&err.message)||err)+'). Hasil render diunduh sebagai file.');
  }
}
async function openSend(){
  const s=sc();if(!s)return;
  if(!(window.APK&&APK.db&&APK.project&&APK.app&&APK.app.openProject)){toast('Editor video belum siap. Muat ulang halaman.');return}
  const play=$('s3-play');if(play&&play.textContent.trim()==='❚❚')play.click();
  let list=[];try{list=await APK.db.all()}catch(_){}
  $('s3-sd-target').innerHTML='<option value="new">Project baru (rasio '+esc(s.aspect)+')</option>'
    +list.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · '+esc(p.aspect)+'</option>').join('');
  $('s3-sd-note').textContent=hasPre(s)
    ?'Dirender frame per frame jadi MP4 (cepat dan mulus), lalu otomatis dipasang sebagai klip. Klip masuk di ujung track video kalau memilih project yang sudah ada. Biarkan tab tetap terbuka.'
    :'Browser ini hanya mendukung rekam real-time: prosesnya selama '+s.dur+' detik dan hasilnya WebM. Biarkan tab tetap terbuka dan terlihat.';
  $('s3-dlg-send').showModal();
}
function goSend(){
  if(!sc())return;
  const target=$('s3-sd-target').value||'new',short=$('s3-sd-res').value,fps=$('s3-sd-fps').value;
  $('s3-dlg-send').close();
  /* memakai export bawaan: atur pilihannya, buka dialognya, lalu mulai */
  $('s3-ex-res').value=short;$('s3-ex-fps').value=fps;if($('s3-ex-q'))$('s3-ex-q').value='0.15';
  send={target,short:+short,fps:+fps};
  own=true;
  try{
    $('s3-export').click();
    const m=$('s3-ex-mode');
    if(!m||!m.options.length){send=null;try{$('s3-dlg-ex').close()}catch(_){}toast('Browser ini belum mendukung export video');return}
    m.value=[...m.options].some(o=>o.value==='pre')?'pre':'rt';
    $('s3-ex-start').click();
  }finally{own=false}
}

/* ===================== pasang ke antarmuka ===================== */
function init(){
  if(!$('s3d'))return;
  const bu=$('s3-undo'),br=$('s3-redo'),bs=$('s3-send');
  if(bu)bu.onclick=undo;if(br)br.onclick=redo;if(bs)bs.onclick=openSend;
  if($('s3-sd-go'))$('s3-sd-go').onclick=goSend;
  if($('s3-sd-cancel'))$('s3-sd-cancel').onclick=()=>$('s3-dlg-send').close();
  /* setiap perubahan scene memanggil dirty(), yang menulis "Belum disimpan" di #s3-save: itu pemicu pencatatan riwayat */
  const sv=$('s3-save');
  if(sv)new MutationObserver(()=>{if(/Belum/.test(sv.textContent))later()}).observe(sv,{childList:true,characterData:true,subtree:true});
  /* membuka Export / Mulai Export sendiri (bukan dari Kirim ke editor) membatalkan pengalihan */
  [$('s3-export'),$('s3-ex-start')].forEach(b=>{if(b)b.addEventListener('click',()=>{if(!own)send=null},true)});
  const ex=$('s3-dlg-ex');if(ex)ex.addEventListener('close',()=>{send=null});
  addEventListener('keydown',e=>{
    const v=$('s3d');if(!v||v.hidden||!sc())return;
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=(e.key||'').toLowerCase();if(k!=='z'&&k!=='y')return;
    const ae=document.activeElement,tg=ae?ae.tagName:'';
    /* di kolom teks / angka biarkan Ctrl+Z bawaan browser mengurus ketikan */
    if(tg==='TEXTAREA'||(tg==='INPUT'&&/^(text|number|search|email|url|tel|password)$/i.test(ae.type||'text')))return;
    if(dlgOpen())return;
    e.preventDefault();
    if(k==='y'||e.shiftKey)redo();else undo();
  });
  ui();
}
try{init()}catch(e){console.error('Alat tambahan Edit 3D gagal dimuat',e)}
})();

/* ===================== HAPUS + 2 TAMPILAN (Edit 3D) =====================
   Dijalankan setelah semua script dimuat (DOMContentLoaded), karena tombol "▦ Ruang 3D" dibuat oleh js/s3cam.js.
   Mode 2 tampilan memakai mode Ruang 3D milik s3cam.js (kamera fisik, seret kamera, orbit) dan hanya menampilkan
   kanvas hasil di sebelah kirinya, jadi semua kontrol Ruang 3D tetap bekerja. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const root=()=>$('s3d');
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const dlgOpen=()=>!!document.querySelector('dialog[open]');
const pausePlay=()=>{const p=$('s3-play');if(p&&p.textContent.trim()==='❚❚')p.click()};
const sysItem=it=>it.id==='cam'||it.id==='fx';
/* memicu simpan otomatis + riwayat undo (lewat input nama), lalu bangun ulang panel dan render */
function touch(){
  const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));
  try{A().select(selId())}catch(_){}
}

/* ----- hapus ----- */
function delLayer(it){
  if(sysItem(it)){toast('Kamera utama dan Efek tidak bisa dihapus. Pakai "Hapus semua keyframe" untuk mengosongkan animasinya.');return}
  const nm=it.name||it.kind;
  pausePlay();A().select(it.id);$('s3-del').click();   /* memakai penghapusan bawaan (induk, potongan kamera, dll ikut dibereskan) */
  toast('Dihapus: '+nm+'. Tekan ↶ untuk membatalkan.');
}
function clearKeys(it,p){
  const a=it.keys[p];if(!a||!a.length)return false;
  it.props[p]=A().val(it,p,curT());delete it.keys[p];return true;   /* nilai di waktu sekarang dipertahankan */
}
function delKeysAt(it,tt){
  let n=0;
  Object.keys(it.keys).forEach(p=>{
    const a=it.keys[p],i=a.findIndex(k=>Math.abs(k.t-tt)<.02);if(i<0)return;
    if(a.length===1)it.props[p]=a[0].v;
    a.splice(i,1);if(!a.length)delete it.keys[p];n++;
  });
  return n;
}
function delMusic(){
  const s=scn();if(!s||!s.music){toast('Belum ada musik');return}
  pausePlay();s.music=null;$('s3-music').textContent='♪ Musik';touch();toast('Musik dihapus');
}
function injectDel(){
  const P=$('s3-props'),it=byId(selId());if(!P||!it)return;
  /* tombol ✕ per properti */
  P.querySelectorAll('.s3-kf').forEach(k=>{
    const kb=k.querySelector('[data-kf]');if(!kb||k.querySelector('[data-sxc]'))return;
    const b=document.createElement('button');b.type='button';b.dataset.sxc=kb.dataset.kf;b.textContent='✕';
    b.title='Hapus semua keyframe properti ini (nilai sekarang dipertahankan)';k.appendChild(b);
  });
  if(P.querySelector('#s3x-del'))return;
  const d=document.createElement('div');d.id='s3x-del';d.className='s3c';
  d.innerHTML='<b>🗑 Hapus</b><div class="s3x-row">'
    +(sysItem(it)?'':'<button class="btn danger" type="button" data-sxd="layer">Hapus layer ini</button>')
    +'<button class="btn" type="button" data-sxd="at">Hapus keyframe di waktu ini</button>'
    +'<button class="btn" type="button" data-sxd="all">Hapus semua keyframe</button>'
    +(scn()&&scn().music?'<button class="btn" type="button" data-sxd="music">Hapus musik</button>':'')
    +'</div><p class="s3-hint">Ketuk 2x tanda ◆ kuning di bawah slider waktu untuk menghapus keyframe di titik itu. Tombol Delete di keyboard menghapus layer terpilih. Semua bisa dibatalkan dengan ↶.</p>';
  const h=P.querySelector('.s3-hint');
  if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
function onClick(e){
  const r=root(),b=e.target.closest&&e.target.closest('[data-sxd],[data-sxc]');
  if(!b||!r||!r.contains(b))return;
  const it=byId(selId());if(!it)return;
  if(b.dataset.sxc){
    if(clearKeys(it,b.dataset.sxc)){touch();toast('Keyframe properti dihapus')}else toast('Properti ini belum punya keyframe');
    return;
  }
  const x=b.dataset.sxd;
  if(x==='layer')delLayer(it);
  else if(x==='at'){const n=delKeysAt(it,curT());if(n){touch();toast(n+' keyframe dihapus')}else toast('Tidak ada keyframe di waktu ini')}
  else if(x==='all'){let n=0;Object.keys(it.keys).forEach(p=>{if(clearKeys(it,p))n++});if(n){touch();toast('Semua keyframe dihapus ('+n+' properti)')}else toast('Layer ini belum punya keyframe')}
  else if(x==='music')delMusic();
}
function onKey(e){
  const v=root();if(!v||v.hidden||!scn()||dlgOpen())return;
  if(e.key!=='Delete'&&e.key!=='Backspace')return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  const ae=document.activeElement,tg=ae?ae.tagName:'';if(/INPUT|TEXTAREA|SELECT/.test(tg))return;
  const it=byId(selId());if(!it)return;
  e.preventDefault();delLayer(it);
}

/* ----- 2 tampilan: kiri hasil kamera, kanan ruang 3D ----- */
let wantDual=false;
function setDual(on){
  const r=root();if(!r||!scn()||!$('s3-v3d'))return;
  if(on){if(!r.classList.contains('s3-v3d'))$('s3-v3d').click();r.classList.add('s3-vdual')}
  else r.classList.remove('s3-vdual');
  syncDual();
  try{A().render()}catch(_){}
}
function syncDual(){
  const r=root(),b=$('s3-vdual');if(!r||!b)return;
  if(!r.classList.contains('s3-v3d')&&r.classList.contains('s3-vdual'))r.classList.remove('s3-vdual');   /* keluar dari Ruang 3D = keluar dari 2 tampilan */
  const d=r.classList.contains('s3-vdual');
  b.classList.toggle('on',d);if(d)$('s3-v3d').classList.remove('on');
}
function initDual(){
  const r=root(),w=document.querySelector('#s3d .s3v'),view=document.querySelector('#s3d .s3-view');
  if(!r||!w||!view||!$('s3-v3d')||$('s3-vdual'))return false;
  const b=document.createElement('button');b.type='button';b.className='btn';b.id='s3-vdual';b.textContent='◫ 2 Tampilan';
  b.title='Dua tampilan sekaligus: kiri hasil kamera, kanan ruang 3D';
  w.insertBefore(b,$('s3-vfit')||null);
  b.onclick=()=>setDual(!r.classList.contains('s3-vdual'));
  $('s3-v3d').addEventListener('click',()=>{r.classList.remove('s3-vdual');syncDual()});   /* "Ruang 3D" = tampilan penuh */
  new MutationObserver(syncDual).observe(r,{attributes:true,attributeFilter:['class']});
  [['HASIL KAMERA','left:6px'],['RUANG 3D','left:calc(50% + 6px)']].forEach(([t,pos])=>{
    const c=document.createElement('span');c.className='s3x-cap';c.style.cssText=pos;c.textContent=t;view.appendChild(c);
  });
  /* export / kirim ke editor memaksa kembali ke tampilan kamera (s3cam.js): ingat 2 tampilan lalu pulihkan setelah dialog export ditutup */
  document.addEventListener('click',e=>{
    if(e.target.closest&&e.target.closest('#s3-export,#s3-send')&&r.classList.contains('s3-vdual'))wantDual=true;
  },true);
  const ex=$('s3-dlg-ex');
  if(ex)ex.addEventListener('close',()=>{if(wantDual){wantDual=false;setTimeout(()=>setDual(true),80)}});
  const st=document.createElement('style');
  st.textContent=
    '#s3d.s3-v3d.s3-vdual .s3-view{position:relative;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px}'
   +'#s3d.s3-v3d.s3-vdual #s3-cv{display:block}'
   +'#s3d.s3-vdual #s3-cv,#s3d.s3-vdual #s3-lv{max-width:100%;max-height:40vh}'
   +'.s3x-cap{display:none;position:absolute;top:4px;z-index:2;pointer-events:none;font:700 10px system-ui,sans-serif;letter-spacing:.04em;color:#fff;background:#0009;padding:2px 6px;border-radius:4px}'
   +'#s3d.s3-v3d.s3-vdual .s3x-cap{display:block}'
   +'@media (min-width:900px){#s3d.s3-v3d.s3-vdual .s3-body{grid-template-columns:minmax(0,2.2fr) minmax(320px,1fr)}#s3d.s3-vdual #s3-cv,#s3d.s3-vdual #s3-lv{max-height:56vh}}'
   +'#s3x-del .s3x-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}#s3x-del .btn{padding:6px 10px;font-size:13px}'
   +'.s3-kf button[data-sxc]{color:#ff6b6b}';
  document.head.appendChild(st);
  syncDual();
  return true;
}

function boot(){
  if(!$('s3d'))return;
  const P=$('s3-props');
  if(P)new MutationObserver(injectDel).observe(P,{childList:true});
  document.addEventListener('click',onClick);
  addEventListener('keydown',onKey);
  const tk=$('s3-ticks');
  if(tk)tk.addEventListener('dblclick',e=>{
    const b=e.target.closest('[data-tt]'),it=byId(selId());if(!b||!it)return;
    const n=delKeysAt(it,+b.dataset.tt);if(n){touch();toast(n+' keyframe dihapus')}
  });
  if(!initDual())setTimeout(initDual,400);
  injectDel();
}
try{
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
}catch(e){console.error('Fitur hapus / 2 tampilan Edit 3D gagal dimuat',e)}
})();
