/* ANIMASI LANJUTAN Edit 3D (add-on, dimuat lewat js/waveform.js setelah js/s3layerpro.js; isi scene3d.js tidak diubah).
   Menambah panel "🎬 Animasi Lanjutan" di properti layer (teks / foto / video / grup) dan di properti Efek:
   1) Animasi tambahan yang belum ada di "Animasi Layer": Bounce jatuh, Elastic pop, Slide dari bawah / atas, Glitch, Getar hentakan,
      Putar terus (datar) dan Putar 3D terus. Kurva bounce / elastic "dipanggang" jadi banyak keyframe lurus, jadi jalan di mesin keyframe lama.
   2) Pecah teks: satu layer teks dipecah jadi satu layer per KATA atau per HURUF, muncul bergiliran dengan animasi pilihan
      (cocok untuk video lirik kinetik). Posisi tiap potongan dihitung dari lebar huruf sebenarnya.
   3) Sinkron beat: musik (♪) dianalisis di perangkat (fokus ke bass / kick), lalu beat-nya bisa dipasang sebagai kilat putih, getar kamera,
      atau denyut ukuran layer terpilih. Semuanya jadi keyframe biasa, bisa diedit dan di-undo (↶).
   Semua perubahan lewat penyimpanan dan riwayat undo yang sama dengan fitur lain (memicu input pada nama project). */
(function(){
'use strict';
window.APK=window.APK||{};
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat((($('s3-time'))||{}).value)||0;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r3=v=>Math.round(v*1000)/1000;
const rid=()=>Math.random().toString(36).slice(2,8);
const is3=it=>!!it&&/^(text|image|video|group)$/.test(it.kind);
const DEF={x:0,y:0,z:0,rx:0,ry:0,rz:0,scale:1,opacity:1};
const V={sd:4,sp:3,smode:'word',sanim:'elastic',gap:.25,one:false,sens:'mid',inten:.6};
const OPEN={anim:true,split:false,beat:false};
const BT={id:null,sens:null,beats:[],bpm:0,busy:false,msg:''};
const num=(k,d)=>{const v=parseFloat(V[k]);return isFinite(v)?v:d};

/* simpan perubahan: memicu simpan otomatis + riwayat undo, lalu bangun ulang panel dan render */
function commit(id){
  const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));
  try{A().select(id||selId())}catch(_){}
}

/* ===== kurva easing (dipanggang jadi keyframe lurus) ===== */
const EZ={
  out:u=>1-Math.pow(1-u,3),
  bounce:u=>{const n=7.5625,d=2.75;if(u<1/d)return n*u*u;if(u<2/d){u-=1.5/d;return n*u*u+.75}if(u<2.5/d){u-=2.25/d;return n*u*u+.9375}u-=2.625/d;return n*u*u+.984375},
  elastic:u=>u<=0?0:u>=1?1:Math.pow(2,-10*u)*Math.sin((u*10-.75)*(2*Math.PI/3))+1
};
function bake(from,to,t0,d,fn,n){
  const o=[];n=n||12;
  for(let i=0;i<=n;i++){const u=i/n;o.push([t0+d*u,from+(to-from)*fn(u),'linear'])}
  return o;
}

/* ===== menulis keyframe ===== */
function K(it,p,t,v,e){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.0005);
  if(k){k.v=r3(v);k.e=e||k.e}else{a.push({t:r3(t),v:r3(v),e:e||'inout'});a.sort((x,y)=>x.t-y.t)}
}
function clr(it,p,a,b){
  const l=it.keys[p];if(!l)return;
  it.keys[p]=l.filter(k=>k.t<a-.0005||k.t>b+.0005);
  if(!it.keys[p].length)delete it.keys[p];
}
/* pasang rangkaian [[waktu, nilai, kurva], ...]; keyframe lama di rentang itu diganti */
function seq(it,p,arr){clr(it,p,arr[0][0],arr[arr.length-1][0]);arr.forEach(([t,v,e])=>K(it,p,t,v,e))}
/* nilai dasar: kalau properti sudah beranimasi, pakai nilainya sesudah animasi selesai supaya pemasangan ulang tidak bergeser */
function base(it,p,a,D){
  let v;
  if(it.keys&&it.keys[p]&&it.keys[p].length){try{v=A().val(it,p,a+D+.001)}catch(_){v=null}}
  else v=it.props[p];
  return v==null?DEF[p]:v;
}
function fadeIn(it,a,d,D){
  if(it.kind==='group')return;
  const o=base(it,'opacity',a,D);
  seq(it,'opacity',[[a,0,'linear'],[a+d,o,'linear']]);
}

/* ===== daftar animasi ===== */
const PRE={
  bounce:{n:'Bounce jatuh',f(it,a){const y=base(it,'y',a,.9);seq(it,'y',bake(y-520,y,a,.9,EZ.bounce,18));fadeIn(it,a,.1,.9)}},
  elastic:{n:'Elastic pop',f(it,a){const s=base(it,'scale',a,.9);seq(it,'scale',bake(Math.max(.05,s*.05),s,a,.9,EZ.elastic,18));fadeIn(it,a,.08,.9)}},
  up:{n:'Slide dari bawah',f(it,a){const y=base(it,'y',a,.6);seq(it,'y',bake(y+700,y,a,.6,EZ.out,6));fadeIn(it,a,.25,.6)}},
  down:{n:'Slide dari atas',f(it,a){const y=base(it,'y',a,.6);seq(it,'y',bake(y-700,y,a,.6,EZ.out,6));fadeIn(it,a,.25,.6)}},
  glitch:{n:'Glitch',f(it,a){
    const x=base(it,'x',a,.4),J=[-46,38,-28,22,-12,0];
    seq(it,'x',J.map((j,i)=>[a+i*.06,x+j,'linear']));
    if(it.kind!=='group'){const o=base(it,'opacity',a,.4);seq(it,'opacity',[[a,0,'linear'],[a+.03,o,'linear'],[a+.09,o*.15,'linear'],[a+.13,o,'linear'],[a+.2,o*.3,'linear'],[a+.24,o,'linear']])}
  }},
  shake:{n:'Getar hentakan',f(it,a){
    const x=base(it,'x',a,.5),arr=[];
    for(let i=0;i<=8;i++)arr.push([a+i*.055,i===8?x:x+(i%2?-1:1)*30*(1-i/8),'linear']);
    seq(it,'x',arr);
  }},
  spin:{n:'Putar terus (datar)',f(it,a,o){
    const d=clamp(o.dur,.5,120),r=base(it,'rz',a,d),tot=clamp(360*d/clamp(o.period,.3,60),-3500,3500);
    seq(it,'rz',[[a,r,'linear'],[a+d,r+tot,'linear']]);
  }},
  spiny:{n:'Putar 3D terus',f(it,a,o){
    const d=clamp(o.dur,.5,120),r=base(it,'ry',a,d),tot=clamp(360*d/clamp(o.period,.3,60),-3500,3500);
    seq(it,'ry',[[a,r,'linear'],[a+d,r+tot,'linear']]);
  }}
};
const SPLIT_ANIMS=['elastic','bounce','up','down','glitch','shake'];

function applyPreset(k){
  const s=scn(),it=byId(selId()),p=PRE[k];
  if(!s||!p)return;
  if(!is3(it)){toast('Pilih layer teks, foto, video, atau grup dulu');return}
  const t=curT();
  if(s.dur-t<.3){toast('Sisa waktu terlalu pendek. Geser playhead lebih awal.');return}
  p.f(it,t,{dur:num('sd',4),period:num('sp',3)});
  it.start=Math.min(it.start||0,t);
  commit(it.id);
  toast(p.n+' dipasang di '+t.toFixed(2)+' dtk. Tekan ↶ untuk membatalkan.');
}

/* ===== pecah teks jadi kata / huruf ===== */
/* mw(str) = lebar teks. Hasil: potongan dengan posisi tengah (x, y) relatif ke pusat teks, dalam satuan huruf (belum dikali ukuran layer) */
function plan(text,mode,mw,size){
  const lines=String(text).split('\n'),L=lines.length,lh=size*1.12,out=[];
  lines.forEach((ln,li)=>{
    const toks=[];
    if(mode==='char'){for(const ch of Array.from(ln))toks.push({t:ch,w:mw(ch),sp:/\s/.test(ch)})}
    else ln.split(/(\s+)/).forEach(p=>{if(!p)return;const sp=/\s/.test(p);toks.push({t:p,w:sp?mw(' ')*p.length:mw(p),sp})});
    const tot=toks.reduce((a,k)=>a+k.w,0);let x=-tot/2;
    toks.forEach(k=>{if(!k.sp)out.push({t:k.t,x:x+k.w/2,y:(li-(L-1)/2)*lh});x+=k.w});
  });
  return out;
}
function splitText(){
  const s=scn(),it=byId(selId());
  if(!s||!it||it.kind!=='text'){toast('Pilih layer TEKS dulu');return}
  const text=String(it.text||'').replace(/\s+$/,'');
  if(!text.trim()){toast('Teks masih kosong');return}
  if(Object.keys(it.keys||{}).length){toast('Teks ini sudah punya keyframe. Duplikat teksnya atau hapus keyframenya dulu, lalu pecah.');return}
  if(s.items.some(o=>o.parent===it.id)||s.items.some(o=>o.kind==='camera'&&o.target===it.id)){toast('Teks ini dipakai sebagai induk atau target kamera. Lepas dulu supaya tidak rusak.');return}
  const size=it.size||170;
  const g=document.createElement('canvas').getContext('2d');
  let f=null;try{f=APK.s3fonts&&APK.s3fonts.css?APK.s3fonts.css(it,size):null}catch(_){}
  g.font=f||('900 '+size+'px "Arial Black","Helvetica Neue",Arial,sans-serif');
  const parts=plan(text,V.smode==='char'?'char':'word',x=>g.measureText(x).width,size);
  if(parts.length<2){toast('Tidak ada yang perlu dipecah (cuma 1 potongan)');return}
  if(parts.length>60){toast('Terlalu banyak potongan ('+parts.length+'). Maksimal 60, coba pecah per kata.');return}
  const sc=it.props.scale==null?1:it.props.scale,rz=(it.props.rz||0)*Math.PI/180,cs=Math.cos(rz),sn=Math.sin(rz);
  let gap=clamp(num('gap',.25),.02,3);
  const room=s.dur-.3-(it.start||0);
  if(parts.length>1&&(parts.length-1)*gap>room)gap=Math.max(.02,room/(parts.length-1));
  const anim=PRE[V.sanim]&&SPLIT_ANIMS.includes(V.sanim)?V.sanim:null;
  const items=parts.map((p,i)=>{
    const dx=p.x*sc,dy=p.y*sc,a=(it.start||0)+i*gap;
    const n={id:'i'+rid(),kind:'text',name:p.t.slice(0,14),
      props:{x:Math.round(((it.props.x||0)+dx*cs-dy*sn)*10)/10,y:Math.round(((it.props.y||0)+dx*sn+dy*cs)*10)/10,z:it.props.z||0,
        rx:it.props.rx||0,ry:it.props.ry||0,rz:it.props.rz||0,scale:sc,opacity:it.props.opacity==null?1:it.props.opacity},
      keys:{},start:r3(a),dur:null,parent:it.parent||null,bill:!!it.bill,vis:true,
      text:p.t,size,color:it.color||'#ffffff',glow:!!it.glow};
    if(it.font)n.font=it.font;
    if(it.shadow!==undefined)n.shadow=it.shadow;
    if(it.dur!=null)n.dur=r3(Math.max(.05,it.dur-i*gap));
    if(V.one&&i<parts.length-1)n.dur=r3(Math.max(.1,gap));
    if(anim)PRE[anim].f(n,a,{});
    return n;
  });
  const at=s.items.indexOf(it);
  s.items.splice(at,1,...items);
  commit(items[0].id);
  toast('Teks dipecah jadi '+items.length+' layer'+(gap!==num('gap',.25)?' (jeda dipersingkat supaya muat di durasi)':'')+'. Tekan ↶ untuk membatalkan.');
}

/* ===== sinkron beat ===== */
function detectBeats(data,sr,sens){
  const k={low:1.9,mid:1.5,high:1.25}[sens]||1.5;
  const hop=Math.max(1,Math.round(sr*.01)),n=Math.floor(data.length/hop);
  if(n<30)return[];
  const a=1-Math.exp(-2*Math.PI*160/sr),env=new Float32Array(n);
  let y=0,mx=0;
  for(let i=0;i<n;i++){
    const s0=i*hop;let e=0;
    for(let j=0;j<hop;j++){y+=a*(data[s0+j]-y);e+=y*y}
    const v=Math.sqrt(e/hop);env[i]=v;if(v>mx)mx=v;
  }
  if(mx<1e-4)return[];
  const ps=new Float64Array(n+1);
  for(let i=0;i<n;i++)ps[i+1]=ps[i]+env[i];
  const W=60,R=5,gap=25,out=[];
  for(let i=R;i<n-R;i++){
    const lo=Math.max(0,i-W),avg=(ps[i]-ps[lo])/Math.max(1,i-lo),v=env[i];
    if(v<avg*k+mx*.05)continue;
    let pk=true;
    for(let j=i-R;j<=i+R;j++)if(env[j]>v){pk=false;break}
    if(!pk)continue;
    const b={t:Math.round(i*hop/sr*1000)/1000,s:v/mx,i},l=out[out.length-1];
    if(l&&i-l.i<gap){if(b.s>l.s)out[out.length-1]=b}else out.push(b);
  }
  return out.map(b=>({t:b.t,s:b.s}));
}
function estBpm(b){
  if(b.length<4)return 0;
  const d=[];for(let i=1;i<b.length;i++)d.push(b[i].t-b[i-1].t);
  d.sort((x,y)=>x-y);
  const m=d[d.length>>1];if(!(m>0))return 0;
  let bpm=60/m;while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;
  return Math.round(bpm);
}
/* rangkaian keyframe denyut: naik cepat di beat, turun pelan, nilai dasar di antara beat */
function pulseKeys(beats,baseV,peakOf,rel){
  const out=[];let last=-1;
  const push=(t,v,e)=>{if(t>last+.0005){out.push([r3(t),r3(v),e]);last=t}};
  push(0,baseV,'linear');
  beats.forEach(b=>{push(Math.max(0,b.t-.02),baseV,'linear');push(b.t,peakOf(b),'out');push(b.t+rel,baseV,'linear')});
  return out;
}
const MAXB=190;   /* 3 keyframe per beat, supaya tidak melewati batas 600 keyframe per properti saat preset diimpor */
async function idb(id){
  return new Promise(res=>{try{
    const rq=indexedDB.open('apk-3d');
    rq.onupgradeneeded=e=>{try{e.target.transaction.abort()}catch(_){}};
    rq.onerror=()=>res(null);
    rq.onsuccess=()=>{try{const r=rq.result.transaction('media','readonly').objectStore('media').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null)}catch(_){res(null)}};
  }catch(_){res(null)}});
}
function setMsg(m){BT.msg=m;const e=$('s3a-bmsg');if(e)e.textContent=m}
async function ensureBeats(force){
  const s=scn();if(!s)return null;
  if(!s.music){toast('Pasang musik dulu lewat tombol ♪ Musik');return null}
  if(!force&&BT.id===s.music&&BT.sens===V.sens&&BT.beats.length)return BT.beats;
  if(BT.busy)return null;
  BT.busy=true;setMsg('Menganalisis musik…');
  try{
    const rec=await idb(s.music);
    if(!rec||!rec.blob)throw new Error('file musik tidak ditemukan');
    const OAC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!OAC)throw new Error('browser belum mendukung analisis audio');
    const buf=await new OAC(1,1,44100).decodeAudioData(await rec.blob.arrayBuffer());
    const sr=buf.sampleRate,len=Math.min(buf.length,Math.floor(s.dur*sr));
    let mono=buf.getChannelData(0).subarray(0,len);
    if(buf.numberOfChannels>1){const c1=buf.getChannelData(1),m=new Float32Array(len),c0=buf.getChannelData(0);for(let i=0;i<len;i++)m[i]=(c0[i]+c1[i])*.5;mono=m}
    const beats=detectBeats(mono,sr,V.sens);
    BT.id=s.music;BT.sens=V.sens;BT.beats=beats;BT.bpm=estBpm(beats);
    if(!beats.length){setMsg('Beat tidak terdeteksi. Coba sensitivitas Tinggi, atau musik dengan bass / kick yang lebih jelas.');return null}
    setMsg('Terdeteksi '+beats.length+' beat'+(BT.bpm?' (perkiraan '+BT.bpm+' BPM)':'')+(beats.length>MAXB?'. Hanya '+MAXB+' beat pertama yang dipasang.':'')+'.');
    return beats;
  }catch(err){
    console.warn('Analisis beat gagal',err);
    setMsg('Gagal menganalisis musik: '+((err&&err.message)||err));
    return null;
  }finally{BT.busy=false}
}
async function beatAct(kind){
  const s=scn();if(!s)return;
  if(kind==='clear'){
    const fx=s.items[1];let n=0;
    ['flash','shake'].forEach(p=>{if(fx.keys[p]){delete fx.keys[p];fx.props[p]=0;n++}});
    if(!n){toast('Belum ada keyframe kilat atau getar di Efek');return}
    commit();toast('Keyframe kilat dan getar dihapus. Tekan ↶ untuk membatalkan.');return;
  }
  const sel=byId(selId());
  if(kind==='pulse'&&!is3(sel)){toast('Pilih dulu layer yang mau berdenyut (teks, foto, video, atau grup)');return}
  const beats=await ensureBeats(kind==='detect');
  if(kind==='detect'||!beats||!beats.length)return;
  const B=beats.slice(0,MAXB),k=clamp(num('inten',.6),.2,1);
  if(kind==='flash'||kind==='shake'){
    const fx=s.items[1];
    const arr=pulseKeys(B,0,b=>clamp(kind==='flash'?k*(.55+.45*b.s):k*(.5+.5*b.s)*.8,0,1),kind==='flash'?.2:.22);
    fx.keys[kind]=arr.map(([t,v,e])=>({t,v,e}));
    commit(selId());
    toast((kind==='flash'?'Kilat':'Getar')+' dipasang di '+B.length+' beat. Tekan ↶ untuk membatalkan.');
  }else if(kind==='pulse'){
    const t=curT(),b0=A().val(sel,'scale',t),bs=b0==null?1:b0;
    const arr=pulseKeys(B,bs,b=>bs*(1+.05+.2*k*(.4+.6*b.s)),.2);
    sel.keys.scale=arr.map(([t2,v,e])=>({t:t2,v,e}));
    commit(sel.id);
    toast('Denyut ukuran dipasang di '+B.length+' beat. Tekan ↶ untuk membatalkan.');
  }
}

/* ===== antarmuka ===== */
const CSS='#s3a-anim details{border:1px solid var(--line);border-radius:8px;padding:6px 8px;margin:6px 0}'
  +'#s3a-anim summary{cursor:pointer;font-weight:700;padding:2px 0}'
  +'#s3a-anim .s3a-row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}'
  +'#s3a-anim .btn{padding:6px 10px;font-size:13px}';
function opts(list,cur){return list.map(([v,l])=>'<option value="'+v+'"'+(String(cur)===v?' selected':'')+'>'+l+'</option>').join('')}
function inject(){
  const P=$('s3-props'),it=byId(selId());
  if(!P||!it||P.querySelector('#s3a-anim'))return;
  const fxSel=it.kind==='fx';
  if(!is3(it)&&!fxSel)return;
  let h='<b>🎬 Animasi Lanjutan</b>';
  if(is3(it)){
    h+='<details data-sec="anim"'+(OPEN.anim?' open':'')+'><summary>Animasi tambahan</summary><div class="s3a-row">'
      +Object.keys(PRE).map(k=>'<button class="btn" type="button" data-ax="'+k+'">'+PRE[k].n+'</button>').join('')+'</div>'
      +'<div class="s3-two"><label class="s3-fl">Lama putar terus (dtk)<input type="number" data-v="sd" min="0.5" max="120" step="0.5" value="'+V.sd+'"></label>'
      +'<label class="s3-fl">Detik per putaran<input type="number" data-v="sp" min="0.3" max="60" step="0.1" value="'+V.sp+'"></label></div>'
      +'<p class="s3-hint">Dipasang di waktu sekarang (playhead). Dua tombol "Putar" memakai dua isian di atas.</p></details>';
  }
  if(it.kind==='text'){
    h+='<details data-sec="split"'+(OPEN.split?' open':'')+'><summary>Pecah teks (kata / huruf)</summary>'
      +'<div class="s3-two"><label class="s3-fl">Pecah per<select data-v="smode">'+opts([['word','Kata'],['char','Huruf']],V.smode)+'</select></label>'
      +'<label class="s3-fl">Animasi tiap potongan<select data-v="sanim">'+opts(SPLIT_ANIMS.map(k=>[k,PRE[k].n]).concat([['none','Tanpa animasi']]),V.sanim)+'</select></label></div>'
      +'<div class="s3-two"><label class="s3-fl">Jeda antar potongan (dtk)<input type="number" data-v="gap" min="0.02" max="3" step="0.01" value="'+V.gap+'"></label>'
      +'<label class="s3-ck"><input type="checkbox" data-v="one"'+(V.one?' checked':'')+'> Satu-satu (hilang setelah gilirannya)</label></div>'
      +'<div class="s3a-row"><button class="btn primary" type="button" data-asplit="1">Pecah teks ini</button></div>'
      +'<p class="s3-hint">Teks diganti jadi banyak layer yang muncul bergiliran mulai dari waktu "Muncul di detik" teks ini. Per huruf biasanya jeda 0,05 sampai 0,1 dtk. Batal dengan ↶.</p></details>';
  }
  h+='<details data-sec="beat"'+(OPEN.beat?' open':'')+'><summary>Sinkron beat musik</summary>'
    +'<div class="s3-two"><label class="s3-fl">Sensitivitas<select data-v="sens">'+opts([['low','Rendah'],['mid','Sedang'],['high','Tinggi']],V.sens)+'</select></label>'
    +'<label class="s3-fl">Kekuatan efek (0,2 sampai 1)<input type="number" data-v="inten" min="0.2" max="1" step="0.1" value="'+V.inten+'"></label></div>'
    +'<div class="s3a-row"><button class="btn" type="button" data-abeat="detect">🎵 Deteksi beat</button>'
    +'<button class="btn" type="button" data-abeat="flash">Kilat di tiap beat</button>'
    +'<button class="btn" type="button" data-abeat="shake">Getar di tiap beat</button>'
    +'<button class="btn" type="button" data-abeat="pulse">Denyut ukuran layer ini</button>'
    +'<button class="btn" type="button" data-abeat="clear">Hapus kilat &amp; getar</button></div>'
    +'<p class="s3-hint" id="s3a-bmsg">'+(BT.msg||'Pasang musik lewat ♪ Musik, lalu tekan Deteksi beat. Paling cocok untuk musik dengan bass / kick jelas.')+'</p></details>';
  const d=document.createElement('div');d.id='s3a-anim';d.className='s3c';d.innerHTML=h;
  const hint=P.querySelector('.s3-hint');
  if(hint)hint.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
function boot(){
  if(!$('s3d'))return;
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  const P=$('s3-props');if(P)new MutationObserver(inject).observe(P,{childList:true});
  document.addEventListener('click',e=>{
    const b=e.target.closest&&e.target.closest('[data-ax],[data-asplit],[data-abeat]'),r=$('s3d');
    if(!b||!r||!r.contains(b))return;
    if(b.dataset.ax)applyPreset(b.dataset.ax);
    else if(b.dataset.asplit!==undefined)splitText();
    else if(b.dataset.abeat)beatAct(b.dataset.abeat);
  });
  const keep=e=>{
    const el=e.target;
    if(!el||!el.dataset||!el.dataset.v||!el.closest||!el.closest('#s3a-anim'))return;
    V[el.dataset.v]=el.type==='checkbox'?el.checked:el.value;
  };
  document.addEventListener('input',keep);document.addEventListener('change',keep);
  document.addEventListener('toggle',e=>{const d=e.target;if(d&&d.dataset&&d.dataset.sec&&d.closest&&d.closest('#s3a-anim'))OPEN[d.dataset.sec]=d.open},true);
  inject();
}
APK.s3anim={PRE,EZ,bake,plan,detectBeats,estBpm,pulseKeys};
try{boot()}catch(e){console.error('Animasi lanjutan Edit 3D gagal dimuat',e)}
})();
