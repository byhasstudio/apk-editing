/* Preset FILE untuk Edit 3D (dimuat setelah js/s3fonts.js; isi scene3d.js tidak diubah).
   Selain contoh bawaan di daftar "Edit 3D: pilih contoh", scene 3D sekarang bisa dipakai lewat file preset:
   1) FORMAT: .preset (paket aplikasi, ringkas) dan .json (rapi, bisa dibaca dan diedit). Keduanya isinya sama dan bisa diimpor.
      Isi: semua layer (teks, foto, video, grup, latar kipas / pita / debu), posisi + rotasi + ukuran, keyframe beserta kurva easing,
      kamera + potongan kamera + objek yang ditangkap, model kamera 3D (kerucut pandang, arahkan ke objek, jalur halus), efek layar (chromatic aberration, glow, getar, kilat), warna / font / cahaya / bayangan teks,
      rasio, durasi, musik. Foto / video / musik OPSIONAL ikut tersimpan di dalam file (base64); kalau tidak ikut, diganti kotak placeholder.
   2) IMPOR: tombol "Impor preset" di daftar contoh (beranda) dan tombol "Preset" di panel Edit 3D, atau seret file ke area preview
      (atau ke dialog contoh). File diperiksa dan dibersihkan dulu (id, rentang angka, tipe, jumlah layer / keyframe dibatasi).
   3) PRATINJAU lalu KONFIRMASI: preset dibuka sebagai project 3D baru dengan bilah "Pratinjau preset". Putar dan lihat dulu,
      lalu Terapkan (project baru tetap tersimpan) atau Batal (dihapus, kembali ke project sebelumnya kalau ada).
   4) EKSPOR: tombol "Simpan preset" menanyakan nama, format (.preset / .json), dan apakah media ikut disertakan.
   Font sendiri (.ttf dll) tidak ikut di dalam preset: kalau fontnya tidak ada di perangkat tujuan, teks memakai font bawaan. */
(function(){
'use strict';
window.APK=window.APK||{};
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const sc=()=>{try{return(APK.s3d&&APK.s3d.scene)||null}catch(_){return null}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const num=(v,d)=>{v=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?parseFloat(v):NaN);return isFinite(v)?v:d};
const rid=()=>Math.random().toString(36).slice(2,8);
const str=(v,n)=>(typeof v==='string'?v:'').slice(0,n);
const dlgOpen=()=>!!document.querySelector('dialog[open]');

/* ===== penyimpanan: IndexedDB yang sama dengan scene3d.js ('apk-3d': scenes, media) ===== */
let dbp;
function odb(){return dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('apk-3d',1);
  r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('scenes'))d.createObjectStore('scenes',{keyPath:'id'});if(!d.objectStoreNames.contains('media'))d.createObjectStore('media',{keyPath:'id'})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))}
async function tx(st,mode,fn){const d=await odb();return new Promise((res,rej)=>{const t=d.transaction(st,mode),o=fn(t.objectStore(st));
  t.oncomplete=()=>res(o.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
const DB={put:(s,v)=>tx(s,'readwrite',x=>x.put(v)),get:(s,id)=>tx(s,'readonly',x=>x.get(id)),del:(s,id)=>tx(s,'readwrite',x=>x.delete(id))};

/* ===== tabel skema (sama dengan scene3d.js) ===== */
const ASPECTS=['16:9','9:16','1:1','4:3','21:9'];
const EASES={linear:1,inout:1,out:1,in:1,back:1};
const M3=['x','y','z','rx','ry','rz','scale','opacity'];
const KP={camera:['x','y','z','rx','ry','rz','fov','focus','fd','dist','az','el','frx','fry','follow'],fx:['ca','glow','shake','flash'],
  text:M3,image:M3,video:M3,group:['x','y','z','rx','ry','rz','scale'],sunburst:['opacity','rz','scale','speed'],ribbon:['opacity','scale','speed'],dust:['opacity','speed']};
const NAMES={camera:'Kamera',fx:'Efek',text:'Teks',image:'Foto',video:'Video',group:'Grup',sunburst:'Latar kipas',ribbon:'Pita cahaya',dust:'Debu bintang'};
const LBL={text:'teks',image:'foto',video:'video',group:'grup',sunburst:'latar kipas',ribbon:'pita',dust:'debu',camera:'kamera'};
const DEF={x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:1,opacity:1,fov:60,ca:0,glow:0,shake:0,flash:0,speed:30,dist:900,az:0,el:0,frx:0,fry:0,follow:.6,focus:0,fd:900};
const DEFK={sunburst:{speed:25},ribbon:{speed:1.2},dust:{speed:600}};
const RNG={x:[-1e5,1e5],y:[-1e5,1e5],z:[-1e5,1e5],rx:[-3600,3600],ry:[-3600,3600],rz:[-7200,7200],scale:[.05,6],opacity:[0,1],fov:[20,120],
  ca:[0,30],glow:[0,1],shake:[0,1],flash:[0,1],speed:[-3600,3600],dist:[100,4000],az:[-720,720],el:[-80,80],frx:[-.45,.45],fry:[-.45,.45],
  follow:[0,1],focus:[0,1],fd:[100,5000]};
const is3=k=>k==='text'||k==='image'||k==='video'||k==='group';

/* ===== pembersihan data dari file (file bisa saja rusak atau tidak dipercaya) ===== */
function cleanItem(r,id,kind0,mid,W,S){
  let kind=kind0;
  const it={id,kind,name:str(r.name,40)||NAMES[kind],props:{},keys:{},start:clamp(num(r.start,0),0,300),dur:null,parent:null,bill:!!r.bill,vis:r.vis!==false};
  const d=num(r.dur,0);if(d>0)it.dur=clamp(d,.05,300);
  if(kind==='image'||kind==='video'){
    let m=mid(r.mediaId);
    if(!m){W.missing++;m='ph'+((W.missing-1)%6+1);if(kind==='video'){kind='image';it.kind='image'}}
    it.mediaId=m;
    if(kind==='video')it.trim=clamp(num(r.trim,0),0,3600);
  }
  KP[kind].forEach(p=>{
    const def=(DEFK[kind]&&DEFK[kind][p]!==undefined)?DEFK[kind][p]:DEF[p],rg=RNG[p];
    it.props[p]=clamp(num(r.props&&r.props[p],def),rg[0],rg[1]);
    const a=r.keys&&r.keys[p];
    if(!Array.isArray(a))return;
    const out=[];
    for(const k of a.slice(0,600)){
      if(!k||typeof k!=='object')continue;
      const t=num(k.t,NaN),v=num(k.v,NaN);if(!isFinite(t)||!isFinite(v))continue;
      const tt=clamp(Math.round(t*1000)/1000,0,300);S.keys++;
      out.push({t:tt,v:clamp(v,rg[0],rg[1]),e:EASES[k.e]?k.e:'inout'});
    }
    out.sort((x,y)=>x.t-y.t);
    const ded=[];out.forEach(k=>{if(ded.length&&Math.abs(ded[ded.length-1].t-k.t)<.001)ded[ded.length-1]=k;else ded.push(k)});   /* dua keyframe di waktu sama bikin pembagian nol */
    if(ded.length)it.keys[p]=ded;
  });
  if(kind==='camera'){it.target=null;it.aim=null;it.rig=r.rig===true;it.cone=r.cone!==false;it.msize=clamp(num(r.msize,1),.2,6);it.path=r.path===true}
  if(kind==='text'){
    it.text=(r.text==null?'TEKS':String(r.text)).slice(0,500);
    it.size=clamp(num(r.size,170),20,600);
    it.color=/^#[0-9a-fA-F]{6}$/.test(r.color)?r.color:'#ffffff';
    it.glow=r.glow!==false;
    it.shadow=r.shadow!==false;
    const f=str(r.font,40);if(/^[A-Za-z0-9 _.&-]+$/.test(f)){it.font=f;S.fonts.add(f)}
  }
  if(kind==='sunburst'){it.beams=Math.round(clamp(num(r.beams,8),2,24));it.twist=clamp(num(r.twist,.7),-4,4)}
  if(kind==='dust')it.count=Math.round(clamp(num(r.count,220),10,600));
  return it;
}
function clean(raw,media,used){
  if(!raw||typeof raw!=='object'||!Array.isArray(raw.items))throw new Error('Bukan preset Edit 3D (daftar layer tidak ditemukan)');
  const W={missing:0,skipped:0},S={keys:0,fonts:new Set(),kinds:{}};
  const src=raw.items.filter(r=>r&&typeof r==='object'&&KP[r.kind]).slice(0,400);
  W.skipped=raw.items.length-src.length;
  const camR=src.find(r=>r.kind==='camera'),fxR=src.find(r=>r.kind==='fx'),rest=src.filter(r=>r!==camR&&r!==fxR);
  const order=[camR||{kind:'camera'},fxR||{kind:'fx'},...rest];
  const idMap=new Map(),taken=new Set(['cam','fx']);
  if(camR&&typeof camR.id==='string')idMap.set(camR.id,'cam');
  if(fxR&&typeof fxR.id==='string')idMap.set(fxR.id,'fx');
  const newId=r=>{
    let id=(typeof r.id==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(r.id)&&!taken.has(r.id))?r.id:'i'+rid();
    while(taken.has(id))id='i'+rid();taken.add(id);
    if(typeof r.id==='string'&&!idMap.has(r.id))idMap.set(r.id,id);
    return id;
  };
  const mid=old=>{
    if(typeof old!=='string')return null;
    if(/^ph\d{1,2}$/.test(old))return old;
    const e=media.get(old);if(!e)return null;
    if(!used.has(old))used.set(old,'m'+Date.now().toString(36)+rid());
    return used.get(old);
  };
  const items=order.map((r,i)=>cleanItem(r,i===0?'cam':i===1?'fx':newId(r),r.kind,mid,W,S));
  const byId=new Map(items.map(i=>[i.id,i]));
  order.forEach((r,i)=>{
    const it=items[i];
    if(typeof r.parent==='string'){const pid=idMap.get(r.parent),p=pid&&byId.get(pid);if(p&&p!==it&&is3(p.kind)&&is3(it.kind))it.parent=pid}
    if(it.kind==='camera'&&typeof r.target==='string'){const tid=idMap.get(r.target),tg=tid&&byId.get(tid);if(tg&&is3(tg.kind)&&tg.kind!=='group')it.target=tid}
    if(it.kind==='camera'&&typeof r.aim==='string'){const tid=idMap.get(r.aim),tg=tid&&byId.get(tid);if(tg&&is3(tg.kind)&&tg.kind!=='group')it.aim=tid}
    if(i>1)S.kinds[it.kind]=(S.kinds[it.kind]||0)+1;
  });
  const cuts=[];
  (Array.isArray(raw.cuts)?raw.cuts:[]).slice(0,200).forEach(k=>{
    if(!k||typeof k!=='object')return;
    const cid=idMap.get(k.cam),c=cid&&byId.get(cid),t=num(k.t,NaN);
    if(c&&c.kind==='camera'&&isFinite(t))cuts.push({t:clamp(Math.round(t*100)/100,0,300),cam:cid});
  });
  cuts.sort((a,b)=>a.t-b.t);
  let music=null;
  if(typeof raw.music==='string'){const e=media.get(raw.music);if(e&&/^audio\//.test(e.type))music=mid(raw.music)}
  const scene={name:str(raw.name,60)||'Preset 3D',aspect:ASPECTS.includes(raw.aspect)?raw.aspect:'16:9',dur:clamp(num(raw.dur,10),1,300),music,cuts,items};
  return{scene,warn:W,stats:S};
}
function mediaEntries(pkg){
  const map=new Map(),m=pkg&&pkg.media;
  if(m&&typeof m==='object'){
    Object.keys(m).slice(0,150).forEach(k=>{
      const e=m[k];if(!e||typeof e.data!=='string'||e.data.slice(0,5)!=='data:')return;
      const hd=/^data:([^;,]*)/.exec(e.data),type=str(e.type,60)||(hd?hd[1]:'');
      if(!/^(image|video|audio)\//.test(type))return;
      map.set(k,{name:str(e.name,60)||'media',type,data:e.data});
    });
  }
  return map;
}
async function storeMedia(media,used){
  const ids=[];let bad=0;
  for(const [old,nid] of used){
    const e=media.get(old);
    try{
      let blob=await (await fetch(e.data)).blob();
      if(!blob.type)blob=new Blob([blob],{type:e.type});
      await DB.put('media',{id:nid,name:e.name,type:e.type,blob});ids.push(nid);
    }catch(_){bad++}
  }
  return{ids,bad};
}

/* ===== IMPOR + PRATINJAU + KONFIRMASI ===== */
let busy=false,pending=null;
function summary(scene,S){
  const k=Object.keys(S.kinds).map(x=>S.kinds[x]+' '+(LBL[x]||x)).join(', ');
  return scene.aspect+' · '+scene.dur+' dtk'+(k?' · '+k:'')+' · '+S.keys+' keyframe'+(scene.cuts.length?' · '+scene.cuts.length+' potongan kamera':'')+(scene.music?' · musik':'');
}
function bar(){
  let b=$('s3p-bar');if(b)return b;
  const top=document.querySelector('#s3d .s3-top');if(!top)return null;
  b=document.createElement('div');b.id='s3p-bar';b.hidden=true;
  b.innerHTML='<div class="s3p-t"></div><div class="s3p-b"><button class="btn primary" type="button" id="s3p-ok">Terapkan</button><button class="btn" type="button" id="s3p-no">Batal</button></div>';
  top.insertAdjacentElement('afterend',b);
  $('s3p-ok').onclick=applyPreview;$('s3p-no').onclick=cancelPreview;
  return b;
}
function showBar(scene,S){
  const b=bar();if(!b)return;
  b.querySelector('.s3p-t').textContent='Pratinjau preset "'+scene.name+'" ('+summary(scene,S)+'). Putar dulu, lalu Terapkan atau Batal.';
  b.hidden=false;
}
function hideBar(){const b=$('s3p-bar');if(b)b.hidden=true}
function applyPreview(){
  if(!pending)return;pending=null;hideBar();
  toast('Preset diterapkan: tersimpan sebagai project 3D baru');
}
async function cancelPreview(){
  const p=pending;if(!p)return;pending=null;hideBar();
  const s=sc();
  if(s&&s.id===p.sceneId){$('s3-back').click();for(let i=0;i<100&&sc();i++)await wait(50)}   /* tombol Beranda menyimpan lalu menutup scene */
  await wait(150);
  try{await DB.del('scenes',p.sceneId)}catch(_){}
  for(const m of p.mediaIds){try{await DB.del('media',m)}catch(_){}}
  const card=document.querySelector('#s3d-list [data-s3="'+p.sceneId+'"]');if(card)card.remove();
  const lst=$('s3d-list'),h=$('s3d-h');if(lst&&!lst.children.length){lst.hidden=true;if(h)h.hidden=true}
  if(p.prevId&&APK.s3d&&APK.s3d.openScene){
    try{const prev=await DB.get('scenes',p.prevId);if(prev){await APK.s3d.openScene(prev);toast('Pratinjau dibatalkan, kembali ke project sebelumnya');return}}catch(_){}
  }
  toast('Pratinjau dibatalkan');
}
async function importFile(file){
  if(busy||!file)return;
  if(!(APK.s3d&&APK.s3d.openScene)){toast('Edit 3D belum siap. Muat ulang halaman.');return}
  if(pending){toast('Selesaikan dulu pratinjau yang sedang terbuka (Terapkan atau Batal)');return}
  busy=true;
  try{
    if(file.size>260e6)throw new Error('file terlalu besar (maks 250 MB)');
    let text;try{text=await file.text()}catch(_){throw new Error('file tidak bisa dibaca')}
    let root;try{root=JSON.parse(text)}catch(_){throw new Error('isi file bukan JSON yang valid')}
    text=null;
    if(!root||typeof root!=='object'||Array.isArray(root))throw new Error('isi file tidak dikenal');
    if(root.format&&root.format!=='apk-preset')throw new Error('format preset tidak dikenal');
    const raw=(root.scene&&typeof root.scene==='object')?root.scene:root;
    if(Array.isArray(root.tracks)&&!Array.isArray(raw.items))throw new Error('ini file project editor video, bukan preset Edit 3D');
    const media=mediaEntries(root),used=new Map(),res=clean(raw,media,used),scene=res.scene;
    scene.name=str(root.name,60)||str(raw.name,60)||str(file.name.replace(/\.[^.]+$/,''),60)||'Preset 3D';
    const prev=sc();let prevId=null;
    if(prev){prevId=prev.id;const sb=$('s3-savebtn');if(sb)sb.click();await wait(450)}   /* simpan project yang sedang dibuka sebelum pindah */
    const dn=$('s3-dlg-new');if(dn&&dn.open)dn.close();
    const st=await storeMedia(media,used);
    scene.id='s3_'+Date.now().toString(36)+rid();scene.updated=Date.now();
    await DB.put('scenes',JSON.parse(JSON.stringify(scene)));
    await APK.s3d.openScene(scene);
    pending={sceneId:scene.id,prevId,mediaIds:st.ids};
    showBar(scene,res.stats);
    const w=[];
    if(res.warn.missing||st.bad)w.push((res.warn.missing+st.bad)+' foto/video tidak ikut di file, diganti placeholder');
    if(res.warn.skipped)w.push(res.warn.skipped+' layer tidak dikenal dilewati');
    if(res.stats.fonts.size)w.push('font tidak ditemukan akan memakai font bawaan');
    toast('Preset dibuka sebagai pratinjau'+(w.length?'. '+w.join('; '):''));
  }catch(err){
    console.warn('Impor preset gagal',err);
    toast('Gagal mengimpor preset: '+((err&&err.message)||err));
  }finally{busy=false}
}

/* ===== EKSPOR (pengguna ditanya: nama, format, ikut media atau tidak) ===== */
function mediaIdsOf(s){
  const set=new Set();
  s.items.forEach(i=>{if((i.kind==='image'||i.kind==='video')&&i.mediaId&&!/^ph\d+$/.test(i.mediaId))set.add(i.mediaId)});
  if(s.music)set.add(s.music);
  return[...set];
}
const readURL=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b)});
let exTotal=0;
function buildEx(){
  if($('s3p-dlg-ex'))return;
  const d=document.createElement('dialog');d.id='s3p-dlg-ex';
  d.innerHTML='<form method="dialog" onsubmit="return false"><h3>Simpan sebagai preset</h3>'
    +'<p class="meta" style="margin:0 0 12px">Preset berisi semua layer, keyframe dan kurva, kamera dan potongan kamera, model kamera 3D, efek layar, warna / font / cahaya / bayangan teks, rasio, durasi, dan musik. File bisa diimpor lagi lewat tombol Impor preset atau diseret ke preview.</p>'
    +'<label>Nama preset<input id="s3p-name" maxlength="60"></label>'
    +'<label>Format file<select id="s3p-fmt"><option value="preset">.preset (paket aplikasi, ringkas)</option><option value="json">.json (rapi, bisa dibaca dan diedit)</option></select></label>'
    +'<label class="s3-ck"><input type="checkbox" id="s3p-media"> Sertakan foto, video, dan musik di dalam file</label>'
    +'<p class="meta" id="s3p-ex-note"></p>'
    +'<div class="dlg-actions"><button class="btn" type="button" id="s3p-ex-cancel">Batal</button><button class="btn primary" type="button" id="s3p-ex-go">Simpan file</button></div></form>';
  document.body.appendChild(d);
  $('s3p-ex-cancel').onclick=()=>d.close();
  $('s3p-ex-go').onclick=doExport;
}
async function openExport(){
  const s=sc();if(!s){toast('Buka project 3D dulu');return}
  if(pending){toast('Terapkan atau Batal pratinjau preset dulu');return}
  buildEx();
  $('s3p-name').value=s.name||'Preset 3D';$('s3p-fmt').value='preset';$('s3p-media').checked=false;
  let n=0;exTotal=0;
  for(const id of mediaIdsOf(s)){try{const r=await DB.get('media',id);if(r&&r.blob){n++;exTotal+=r.blob.size}}catch(_){}}
  $('s3p-media').disabled=!n;
  $('s3p-ex-note').textContent=n
    ?'Scene ini memakai '+n+' file media ('+(exTotal/1048576).toFixed(1)+' MB). Kalau tidak dicentang, file kecil tapi foto / video diganti kotak placeholder saat dimuat.'
    :'Scene ini tidak memakai file foto, video, atau musik sendiri, jadi tidak ada media yang perlu disertakan.';
  $('s3p-ex-go').disabled=false;
  $('s3p-dlg-ex').showModal();
}
async function doExport(){
  const s=sc();if(!s)return;
  const go=$('s3p-ex-go'),name=($('s3p-name').value||'').trim().slice(0,60)||'Preset 3D',fmt=$('s3p-fmt').value==='json'?'json':'preset',withMedia=$('s3p-media').checked&&!$('s3p-media').disabled;
  if(withMedia&&exTotal>120e6){toast('Media terlalu besar (lebih dari 120 MB) untuk dimasukkan ke dalam preset');return}
  go.disabled=true;
  try{
    const scene=JSON.parse(JSON.stringify({name,aspect:s.aspect,dur:s.dur,music:s.music||null,cuts:s.cuts||[],items:s.items}));
    const pkg={format:'apk-preset',kind:'edit3d',version:1,name,created:Date.now(),scene};
    if(withMedia){
      pkg.media={};
      for(const id of mediaIdsOf(s)){
        const r=await DB.get('media',id);
        if(r&&r.blob)pkg.media[id]={name:r.name||'media',type:r.type||r.blob.type||'',data:await readURL(r.blob)};
      }
    }
    const out=JSON.stringify(pkg,null,fmt==='json'?2:0);
    const fn=(name.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'preset-3d')+'.'+fmt;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out],{type:fmt==='json'?'application/json':'application/octet-stream'}));a.download=fn;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    $('s3p-dlg-ex').close();toast('Preset disimpan: '+fn);
  }catch(err){
    console.warn('Ekspor preset gagal',err);toast('Gagal menyimpan preset: '+((err&&err.message)||err));
  }finally{go.disabled=false}
}

/* ===== antarmuka ===== */
const CSS=`#s3p-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:#1d2a55;color:#fff;border-bottom:1px solid #4b5bd6;font-size:13px}
#s3p-bar[hidden]{display:none}
#s3p-bar .s3p-t{flex:1 1 240px;min-width:0;line-height:1.35}
#s3p-bar .s3p-b{display:flex;gap:8px;flex:none}
.s3-view.s3p-over,#s3-dlg-new.s3p-over{outline:3px dashed #7aa2ff;outline-offset:-6px}`;
function pickFile(){const f=$('s3p-file');if(f)f.click()}
function isPreset(f){return !!f&&/\.(preset|json)$/i.test(f.name||'')}
function init(){
  if(!$('s3d'))return;
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const fi=document.createElement('input');fi.type='file';fi.id='s3p-file';fi.hidden=true;fi.accept='.preset,.json,application/json,application/octet-stream';
  fi.onchange=()=>{const f=fi.files[0];fi.value='';if(f)importFile(f)};
  document.body.appendChild(fi);
  /* beranda: tombol di dialog "pilih contoh" */
  const dn=$('s3-dlg-new'),acts=dn&&dn.querySelector('.dlg-actions');
  if(dn&&acts){
    const b=document.createElement('button');b.type='button';b.className='s3-tpl';b.id='s3p-home';
    b.innerHTML='<b>⬆ Impor preset dari file</b><small>Pilih file .preset atau .json, atau seret filenya ke dialog ini. Tampil pratinjau dulu, lalu konfirmasi Terapkan.</small>';
    b.onclick=pickFile;acts.insertAdjacentElement('beforebegin',b);
  }
  /* editor: tombol Impor dan Simpan preset di bilah alat */
  const tools=document.querySelector('#s3d .s3-tools');
  if(tools){
    const mk=(id,txt,tip,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.id=id;b.textContent=txt;b.title=tip;b.onclick=fn;tools.appendChild(b)};
    mk('s3p-imp','⬆ Preset','Impor preset dari file .preset / .json (atau seret file ke preview). Dibuka sebagai project 3D baru dengan pratinjau.',pickFile);
    mk('s3p-exp','⬇ Preset','Simpan scene ini sebagai file preset (.preset / .json)',openExport);
  }
  /* seret dan lepas: ke preview editor atau ke dialog contoh */
  let over=null,overT=0;
  const targetEl=()=>{
    const d=$('s3-dlg-new');if(d&&d.open)return d;
    const v=$('s3d');if(v&&!v.hidden&&!dlgOpen())return document.querySelector('#s3d .s3-view');
    return null;
  };
  const hasFiles=e=>!!(e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files'));
  const clear=()=>{if(over){over.classList.remove('s3p-over');over=null}};
  document.addEventListener('dragover',e=>{
    if(!hasFiles(e))return;const t=targetEl();if(!t)return;
    e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';
    if(over!==t){clear();over=t;t.classList.add('s3p-over')}
    clearTimeout(overT);overT=setTimeout(clear,200);
  },true);
  document.addEventListener('drop',e=>{
    if(!hasFiles(e))return;const t=targetEl();if(!t)return;
    e.preventDefault();e.stopPropagation();clearTimeout(overT);clear();
    const f=[...e.dataTransfer.files].find(isPreset);
    if(!f){toast('Seret file preset (.preset atau .json)');return}
    importFile(f);
  },true);
  /* kalau scene yang dipratinjau ditutup / diganti (misal lewat Beranda), anggap diterapkan dan sembunyikan bilah */
  setInterval(()=>{
    if(!pending)return;
    const s=sc();if(!s||s.id!==pending.sceneId){pending=null;hideBar()}
  },500);
  APK.s3preset={importFile,openExport,clean};
}
try{init()}catch(e){console.error('Preset file Edit 3D gagal dimuat',e)}
})();
