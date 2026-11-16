/* Fitur pro Edit 3D (dimuat dari js/home-ref.js, setelah menu). Tidak mengubah scene3d.js: hanya memakai data layer + render/undo bawaan.
   1) GERAK HIDUP: melayang, berdenyut, bergoyang, mengambang 3D, berputar pelan (berulang sepanjang layer, bisa dihapus lagi).
   2) GAYA TEKS cepat: Putih, Neon pink, Neon cyan, Emas, Merah, Hijau neon.
   3) SALIN / TEMPEL ANIMASI antar layer (keyframe ikut menyesuaikan waktu mulai layer tujuan).
   4) SUSUN LAYER otomatis: muncul bertahap atau tampil bergantian (cocok untuk slideshow / lirik).
   5) PAS-KAN DURASI project dengan isi layer.
   6) SIMPAN FRAME jadi gambar PNG.
   Tombol 3 sampai 6 ditaruh di menu "Layer"; 1 dan 2 di kartu "Gerak & gaya" pada panel properti. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r3=v=>Math.round(v*1000)/1000;
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const OK=k=>k==='text'||k==='image'||k==='video'||k==='model';
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
function K(it,p,t,v,e,flag){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.02);
  if(k){k.v=v;if(e)k.e=e;if(flag)k.i=1}
  else{const n={t:r3(Math.max(0,t)),v,e:e||'inout'};if(flag)n.i=1;a.push(n);a.sort((x,y)=>x.t-y.t)}
}
function dropIdle(it,p){
  if(!it.keys[p])return;
  it.keys[p]=it.keys[p].filter(k=>!k.i);
  if(!it.keys[p].length)delete it.keys[p];
}

/* ===== 1) gerak hidup ===== */
const IDLE={
  float:{n:'Melayang naik-turun',c:[['y',14,1.2,'add']]},
  pulse:{n:'Berdenyut (ukuran)',c:[['scale',.07,.6,'mul']]},
  sway:{n:'Bergoyang pelan',c:[['rz',3,1.4,'add']]},
  tilt:{n:'Mengambang 3D',c:[['ry',12,1.5,'add'],['rx',4,1.85,'add']]},
  spin:{n:'Berputar pelan',spin:true}
};
function idle(kind){
  const S=scn(),it=byId(selId());
  if(!S||!it||!OK(it.kind)||it.pano){toast('Pilih layer teks / foto / video / model dulu');return}
  if(kind==='off'){['x','y','rx','ry','rz','scale'].forEach(p=>dropIdle(it,p));touch();toast('Gerak hidup dihapus');return}
  const def=IDLE[kind];if(!def)return;
  const st=it.start||0,en=it.dur==null?S.dur:st+it.dur,len=en-st;
  if(len<.6){toast('Layer terlalu pendek untuk gerak berulang');return}
  const V=A().val;
  if(def.spin){
    if(!('ry' in it.props))return;
    dropIdle(it,'ry');const v0=V(it,'ry',st);
    K(it,'ry',st,v0,'linear',1);K(it,'ry',en,v0+45*len,'linear',1);
  }else def.c.forEach(([p,amp,half,mode])=>{
    if(!(p in it.props))return;
    dropIdle(it,p);
    const n=Math.min(80,Math.floor(len/half)),times=[st];
    for(let k=1;k<=n;k++)times.push(st+k*half);
    if(times[times.length-1]<en-.05)times.push(en);
    const base=times.map(tt=>V(it,p,tt));   /* nilai asli dihitung dulu supaya animasi lama tidak rusak */
    times.forEach((tt,k)=>{
      const sg=k===0?0:(k%2?1:-1);
      K(it,p,tt,mode==='add'?base[k]+amp*sg:base[k]*(1+(sg>0?amp:0)),'inout',1);
    });
  });
  touch();toast(def.n+' dipasang sepanjang layer');
}

/* ===== 2) gaya teks ===== */
const STY=[['Putih','#ffffff',false],['Neon pink','#ff3df2',true],['Neon cyan','#37f0ff',true],['Emas','#ffd24a',true],['Merah','#ff3b3b',true],['Hijau neon','#5dff7a',true]];
function textStyle(i){
  const it=byId(selId());if(!it||it.kind!=='text')return;
  it.color=STY[i][1];it.glow=STY[i][2];touch();
}

/* ===== kartu di panel properti ===== */
function card(){
  const P=$('s3-props');if(!P||P.querySelector('#s3p-card'))return;
  const it=byId(selId());if(!it||!OK(it.kind)||it.pano)return;
  const d=document.createElement('div');d.id='s3p-card';
  d.innerHTML='<b>🎬 Gerak &amp; gaya</b>'
   +'<label class="s3-fl">Gerak hidup (berulang sepanjang layer)<select data-pidle><option value="">Pilih…</option>'
   +Object.keys(IDLE).map(k=>'<option value="'+k+'">'+IDLE[k].n+'</option>').join('')+'<option value="off">Hapus gerak hidup</option></select></label>'
   +(it.kind==='text'?'<div class="s3p-lab">Gaya teks</div><div class="s3p-sw">'+STY.map((s,i)=>'<button type="button" data-psty="'+i+'" title="'+s[0]+'" style="--c:'+s[1]+'"><i></i>'+s[0]+'</button>').join('')+'</div>':'');
  const a=P.querySelector('#s3x-anim'),h=P.querySelector('.s3-hint');
  if(a)a.insertAdjacentElement('afterend',d);else if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
document.addEventListener('change',e=>{
  const el=e.target;if(!el.closest||!el.closest('#s3p-card'))return;
  if(el.dataset.pidle!==undefined&&el.value){idle(el.value);el.value=''}
});
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('#s3p-card [data-psty]');
  if(b)textStyle(+b.dataset.psty);
});

/* ===== 3) salin / tempel animasi ===== */
let animClip=null;
function copyAnim(){
  const it=byId(selId());
  if(!it||it.kind==='camera'||it.kind==='fx'){toast('Pilih layer dulu');return}
  const ks=Object.keys(it.keys||{});
  if(!ks.length){toast('Layer ini belum punya keyframe');return}
  const st=it.start||0,o={};
  ks.forEach(p=>{o[p]=it.keys[p].map(k=>Object.assign({},k,{t:r3(k.t-st)}))});
  animClip=o;toast('Animasi disalin ('+ks.length+' properti)');
}
function pasteAnim(){
  const it=byId(selId());
  if(!it||it.kind==='camera'||it.kind==='fx'){toast('Pilih layer tujuan dulu');return}
  if(!animClip){toast('Belum ada animasi yang disalin');return}
  const st=it.start||0;let n=0;
  Object.keys(animClip).forEach(p=>{
    if(!(p in it.props))return;
    it.keys[p]=animClip[p].map(k=>Object.assign({},k,{t:r3(Math.max(0,k.t+st))}));n++;
  });
  touch();toast(n?'Animasi ditempel ke '+(it.name||'layer'):'Properti tidak cocok dengan layer ini');
}

/* ===== 4) susun layer ===== */
function shift(it,d){
  it.start=Math.max(0,r3((it.start||0)+d));
  Object.values(it.keys||{}).forEach(a=>a.forEach(k=>{k.t=Math.max(0,r3(k.t+d))}));
}
function setDur(v){const el=$('s3-dur');if(!el)return;el.value=String(clamp(Math.ceil(v*10)/10,1,300));el.dispatchEvent(new Event('change'))}
function stagger(v){
  const S=scn();if(!S||!v)return;
  const L=S.items.slice(2).filter(i=>OK(i.kind)&&!i.pano&&!i.lock);
  if(!L.length){toast('Belum ada layer untuk disusun');return}
  const alt=v[0]==='a',step=parseFloat(v.slice(1))||1;
  L.forEach((it,i)=>{
    shift(it,r3(i*step)-(it.start||0));
    if(alt&&it.kind!=='video')it.dur=step;
  });
  const last=(L.length-1)*step+(alt?step:2);
  if(last>S.dur)setDur(last);
  touch();toast(L.length+' layer disusun '+(alt?'bergantian':'bertahap'));
}

/* ===== 5) pas-kan durasi ===== */
function fitDur(){
  const S=scn();if(!S)return;
  let m=0;
  S.items.slice(2).forEach(i=>{
    if(i.vis===false||i.pano)return;
    const st=i.start||0;let e=i.dur==null?st+2:st+i.dur;
    Object.values(i.keys||{}).forEach(a=>a.forEach(k=>{if(k.t>e)e=k.t}));
    if(e>m)m=e;
  });
  if(m<=0){toast('Belum ada layer');return}
  setDur(m);toast('Durasi project dipas-kan ke '+(Math.ceil(m*10)/10)+' dtk');
}

/* ===== 6) simpan frame ===== */
function snap(){
  const cv=$('s3-cv'),S=scn();if(!cv||!S)return;
  try{A().render()}catch(_){}
  cv.toBlob(b=>{
    if(!b){toast('Gagal menyimpan frame');return}
    const a=document.createElement('a');a.href=URL.createObjectURL(b);
    a.download=(S.name||'edit3d')+'-'+curT().toFixed(2)+'s.png';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Frame disimpan sebagai PNG');
  },'image/png');
}

function boot(){
  const P=$('s3-props');if(!P||$('s3p-st'))return;
  const st=document.createElement('style');st.id='s3p-st';
  st.textContent='#s3p-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--panel)}#s3p-card>b{display:block;margin-bottom:8px}'
   +'.s3p-lab{font-size:12.5px;font-weight:500;margin:4px 0 6px}.s3p-sw{display:flex;flex-wrap:wrap;gap:6px}'
   +'.s3p-sw button{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--text);font:12.5px inherit;font-family:inherit;cursor:pointer}'
   +'.s3p-sw button:hover{border-color:var(--accent)}.s3p-sw i{width:12px;height:12px;border-radius:50%;background:var(--c);box-shadow:0 0 6px var(--c)}';
  document.head.appendChild(st);
  new MutationObserver(card).observe(P,{childList:true});card();

  /* tombol / pilihan baru masuk ke menu "Layer" (kalau menu belum ada, ke bilah alat) */
  const mk=(txt,title,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=txt;b.title=title;b.onclick=fn;return b};
  const sg=document.createElement('select');sg.title='Atur ulang waktu muncul semua layer';
  sg.innerHTML='<option value="">⇉ Susun layer…</option><option value="b0.3">Muncul bertahap 0,3 dtk</option><option value="b0.6">Muncul bertahap 0,6 dtk</option><option value="b1">Muncul bertahap 1 dtk</option><option value="a1">Tampil bergantian 1 dtk</option><option value="a2">Tampil bergantian 2 dtk</option>';
  sg.onchange=()=>{const v=sg.value;sg.value='';stagger(v)};
  const items=[
    mk('⧉ Salin animasi','Salin semua keyframe layer terpilih',copyAnim),
    mk('⎙ Tempel animasi','Tempel keyframe ke layer terpilih (menyesuaikan waktu mulainya)',pasteAnim),
    sg,
    mk('⇥ Pas-kan durasi','Samakan durasi project dengan isi layer',fitDur),
    mk('📷 Simpan frame (PNG)','Simpan tampilan di garis waktu sekarang jadi gambar',snap)
  ];
  const dup=$('s3-dup'),pan=dup&&dup.closest('.hx-pan'),host=pan||document.querySelector('#s3d .s3-tools');
  if(host)items.forEach(e=>host.appendChild(e));
}
try{boot()}catch(e){console.error('Fitur pro Edit 3D gagal dimuat',e)}
})();
