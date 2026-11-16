/* Audio & lirik Edit 3D (dimuat dari js/home-ref.js, paling akhir). Tidak mengubah scene3d.js.
   1) BEAT OTOMATIS: menganalisis musik (♪ Musik) lalu menaruh marker ◆ di setiap hentakan (kick / ketukan). Pilihan jarang atau rapat.
   2) DENYUT DI TIAP MARKER: layer terpilih berdenyut (membesar sebentar) tepat di setiap marker, jadi gambar bergerak mengikuti musik.
   3) LIRIK → TEKS 3D: tempel lirik, setiap baris jadi layer teks yang muncul dan hilang bergantian (mengikuti marker atau selang waktu tetap).
   Tombolnya ada di menu "◆ Beat". */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const rid=()=>'i'+Math.random().toString(36).slice(2,8);
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const OK=k=>k==='text'||k==='image'||k==='video'||k==='model';
function save(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}))}
function touch(){save();try{A().select(selId())}catch(_){}}
function setDur(v){const el=$('s3-dur');if(!el)return;el.value=String(clamp(Math.ceil(v*10)/10,1,300));el.dispatchEvent(new Event('change'))}
const marks=S=>S.markers||(S.markers=[]);
function K(it,p,t,v,e,f){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.005);
  if(k){k.v=v;if(e)k.e=e;if(f)k[f]=1}
  else{const n={t:r3(Math.max(0,t)),v,e:e||'inout'};if(f)n[f]=1;a.push(n);a.sort((x,y)=>x.t-y.t)}
}

/* ===== 1) beat otomatis ===== */
function getRec(id){
  return new Promise((res,rej)=>{
    const r=indexedDB.open('apk-3d',1);   /* nama database otomatis dipetakan per akun oleh js/auth.js */
    r.onerror=()=>rej(r.error);
    r.onsuccess=()=>{
      const d=r.result;
      try{const q=d.transaction('media','readonly').objectStore('media').get(id);q.onsuccess=()=>{res(q.result);d.close()};q.onerror=()=>{rej(q.error);d.close()}}
      catch(e){d.close();rej(e)}
    };
  });
}
let busy=false;
async function detect(rapat){
  const S=scn();if(!S||busy)return;
  if(!S.music){toast('Pasang musik dulu (tombol ♪ Musik)');return}
  busy=true;toast('Menganalisis musik…');
  try{
    const rec=await getRec(S.music);
    if(!rec||!rec.blob)throw new Error('berkas musik tidak ditemukan');
    const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    const buf=await new OAC(1,1,44100).decodeAudioData(await rec.blob.arrayBuffer());
    const sr=buf.sampleRate,n=Math.min(buf.length,Math.floor(S.dur*sr)),c0=buf.getChannelData(0),c1=buf.numberOfChannels>1?buf.getChannelData(1):c0;
    const hop=Math.max(1,Math.floor(sr*.01)),a=1-Math.exp(-2*Math.PI*180/sr),nf=Math.floor(n/hop),e=new Float32Array(nf);
    let y=0;
    for(let f=0;f<nf;f++){   /* energi pita bass (kick) tiap 10 ms */
      let s=0;const o=f*hop;
      for(let i=0;i<hop;i++){const x=(c0[o+i]+c1[o+i])*.5;y+=a*(x-y);s+=y*y}
      e[f]=Math.sqrt(s/hop);
    }
    const on=new Float32Array(nf);let mx=0;
    for(let f=1;f<nf;f++){on[f]=Math.max(0,e[f]-e[f-1]);if(on[f]>mx)mx=on[f]}
    if(mx<=0)throw new Error('musik terlalu pelan / kosong');
    const W=43,mult=rapat?1.7:2.5,gap=rapat?.16:.26,found=[];let last=-9;
    for(let f=2;f<nf-2;f++){
      let m=0,c=0;for(let j=Math.max(0,f-W);j<Math.min(nf,f+W);j++){m+=on[j];c++}
      const thr=m/c*mult+mx*.06,tt=f*hop/sr;
      if(on[f]>thr&&on[f]>=on[f-1]&&on[f]>=on[f+1]&&tt-last>=gap){found.push(r2(tt));last=tt}
      if(found.length>=400)break;
    }
    if(!found.length)throw new Error('tidak ada hentakan terdeteksi, coba pilihan "rapat"');
    const cur=marks(S);
    found.forEach(t=>{if(!cur.some(x=>Math.abs(x-t)<.06))cur.push(t)});
    cur.sort((p,q)=>p-q);save();
    toast('◆ '+found.length+' beat terdeteksi (total marker '+cur.length+')');
  }catch(err){toast('Beat gagal: '+((err&&err.message)||err))}
  finally{busy=false}
}

/* ===== 2) denyut di tiap marker ===== */
function pulse(){
  const S=scn(),it=byId(selId());
  if(!S||!it||!OK(it.kind)||it.pano||!('scale' in it.props)){toast('Pilih layer teks / foto / video / model dulu');return}
  const a=marks(S);
  if(!a.length){toast('Tambah marker dulu (tombol ◆ atau Beat otomatis)');return}
  if(it.keys.scale){it.keys.scale=it.keys.scale.filter(k=>!k.q);if(!it.keys.scale.length)delete it.keys.scale}
  const st=it.start||0,en=it.dur==null?S.dur:st+it.dur,V=A().val;
  const ms=a.filter(m=>m>=st&&m<=en);
  if(!ms.length){toast('Tidak ada marker di rentang waktu layer ini');return}
  const base=ms.map(m=>V(it,'scale',m));   /* nilai asli dihitung dulu */
  ms.forEach((m,i)=>{
    K(it,'scale',m-.04,base[i],'linear','q');
    K(it,'scale',m,base[i]*1.14,'out','q');
    K(it,'scale',m+.3,base[i],'inout','q');
  });
  touch();toast('Denyut dipasang di '+ms.length+' marker');
}

/* ===== 3) lirik -> teks 3D ===== */
function wrap(s){
  if(s.length<=22||s.indexOf(' ')<0)return s;
  const mid=s.length/2;let best=-1,bd=1e9;
  for(let i=0;i<s.length;i++)if(s[i]===' '&&Math.abs(i-mid)<bd){bd=Math.abs(i-mid);best=i}
  return s.slice(0,best)+'\n'+s.slice(best+1);
}
function lyrics(){
  const S=scn();if(!S)return;
  const lines=($('s3l-txt').value||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,80);
  if(!lines.length){toast('Tulis liriknya dulu');return}
  const mode=$('s3l-mode').value,starts=[];let step=2.5;
  if(mode==='mk'){
    const a=marks(S);
    if(!a.length){toast('Belum ada marker. Pakai "Beat otomatis" atau tombol ◆, atau pilih selang waktu tetap.');return}
    const gap=a.length>1?(a[a.length-1]-a[0])/(a.length-1):2;
    lines.forEach((_,i)=>starts.push(i<a.length?a[i]:r2(a[a.length-1]+(i-a.length+1)*gap)));
    step=Math.max(1.2,gap);
  }else{
    step=parseFloat(mode)||2;const t0=curT();
    lines.forEach((_,i)=>starts.push(r2(t0+i*step)));
  }
  let maxEnd=0;
  lines.forEach((ln,i)=>{
    const st=starts[i],en=r2(i+1<lines.length?starts[i+1]:st+Math.max(step,2.5)),len=Math.max(.5,en-st),txt=wrap(ln);
    const size=ln.length>34?90:ln.length>22?120:150;
    const it={id:rid(),kind:'text',name:ln.slice(0,18),props:{x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:1,opacity:1},keys:{},start:st,dur:r2(len),parent:null,bill:false,vis:true,
      text:txt,size:size,color:'#ffffff',glow:true};
    const d=Math.min(.25,len/3);
    K(it,'opacity',st,0,'linear');K(it,'opacity',st+d,1,'linear');K(it,'opacity',st+len-d*.6,1,'linear');K(it,'opacity',st+len,0,'linear');
    K(it,'scale',st,.6,'back');K(it,'scale',st+d*1.6,1,'out');
    S.items.push(it);if(st+len>maxEnd)maxEnd=st+len;
  });
  if(maxEnd>S.dur)setDur(maxEnd);
  $('s3l-dlg').close();touch();toast(lines.length+' baris lirik jadi layer teks');
}
function dialog(){
  if($('s3l-dlg'))return;
  const d=document.createElement('dialog');d.id='s3l-dlg';
  d.innerHTML='<form method="dialog" onsubmit="return false"><h3>Lirik → teks 3D</h3>'
   +'<p class="meta" style="margin:0 0 12px">Tulis atau tempel lirik. Satu baris = satu layer teks yang muncul dan hilang bergantian. Setelah itu tiap teks bisa kamu beri gaya, animasi, atau kurva sendiri.</p>'
   +'<label>Lirik<textarea id="s3l-txt" rows="8" placeholder="Baris pertama&#10;Baris kedua&#10;Baris ketiga"></textarea></label>'
   +'<label>Waktu muncul<select id="s3l-mode"><option value="mk">Mengikuti marker ◆ (satu baris per marker)</option><option value="1.5">Tiap 1,5 detik dari garis waktu</option><option value="2">Tiap 2 detik dari garis waktu</option><option value="3">Tiap 3 detik dari garis waktu</option></select></label>'
   +'<div class="dlg-actions"><button class="btn" type="button" id="s3l-x">Batal</button><button class="btn primary" type="button" id="s3l-go">Buat teks</button></div></form>';
  document.body.appendChild(d);
  $('s3l-x').onclick=()=>d.close();$('s3l-go').onclick=lyrics;
}

function boot(){
  if($('s3a-done'))return;
  const mark=document.createElement('i');mark.id='s3a-done';mark.hidden=true;document.body.appendChild(mark);
  dialog();
  /* tombol masuk ke menu "Beat" (panel yang memuat tombol Tambah marker) */
  const pan=[...document.querySelectorAll('.hx-pan')].find(p=>/Tambah marker/.test(p.textContent));
  const host=pan||document.querySelector('#s3d .s3-tools');
  const mk=(txt,title,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=txt;b.title=title;b.onclick=fn;return b};
  [
    mk('🎵 Beat otomatis (jarang)','Deteksi hentakan musik dan taruh marker; hasil lebih sedikit dan tegas',()=>detect(false)),
    mk('🎵 Beat otomatis (rapat)','Deteksi lebih banyak ketukan',()=>detect(true)),
    mk('💓 Denyut layer di tiap marker','Layer terpilih membesar sebentar di setiap marker',pulse),
    mk('🎤 Lirik → teks 3D','Ubah lirik jadi layer teks yang muncul bergantian',()=>{dialog();$('s3l-dlg').showModal()})
  ].forEach(b=>host&&host.appendChild(b));
}
try{boot()}catch(e){console.error('Audio Edit 3D gagal dimuat',e)}
})();
