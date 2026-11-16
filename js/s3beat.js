/* Beat & perbanyak Edit 3D (dimuat dari js/home-ref.js, paling akhir). Tidak mengubah scene3d.js.
   1) MARKER BEAT: tambah marker di garis waktu (tombol ◆ di bawah preview atau tombol M, bisa sambil musik diputar = tap beat),
      terlihat sebagai garis kuning di timeline, loncat ke marker sebelumnya / berikutnya, hapus, simpan bersama project.
   2) SUSUN LAYER KE MARKER: layer pertama muncul di marker 1, layer kedua di marker 2, dst (cocok untuk edit mengikuti beat / lirik).
   3) FLASH & GETAR DI MARKER: keyframe efek otomatis di setiap marker.
   4) ULANGI PUTAR (loop): tombol ⟲ di bawah preview.
   5) PERBANYAK LAYER: baris, lingkaran, tangga 3D, atau grid dari satu layer. */
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
const LAB=104;
function save(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}))}
function touch(){save();try{A().select(selId())}catch(_){}}
const pausePlay=()=>{const p=$('s3-play');if(p&&p.textContent.trim()==='❚❚')p.click()};
function K(it,p,t,v,e,flag){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.01);
  if(k){k.v=v;if(e)k.e=e;if(flag)k.b=1}
  else{const n={t:r3(Math.max(0,t)),v,e:e||'inout'};if(flag)n.b=1;a.push(n);a.sort((x,y)=>x.t-y.t)}
}
function shift(it,d){
  it.start=Math.max(0,r3((it.start||0)+d));
  Object.values(it.keys||{}).forEach(a=>a.forEach(k=>{k.t=Math.max(0,r3(k.t+d))}));
}

/* ===== marker ===== */
const marks=S=>S.markers||(S.markers=[]);
function addMarker(tt){
  const S=scn();if(!S)return;
  const a=marks(S),t=r2(clamp(tt==null?curT():tt,0,S.dur));
  if(a.some(x=>Math.abs(x-t)<.03)){toast('Sudah ada marker di sini');return}
  a.push(t);a.sort((x,y)=>x-y);save();draw(true);toast('◆ Marker '+t.toFixed(2)+' dtk ('+a.length+')');
}
function goMarker(dir){
  const S=scn();if(!S)return;const a=marks(S),t=curT();
  const m=dir>0?a.find(x=>x>t+.03):[...a].reverse().find(x=>x<t-.03);
  if(m==null){toast(dir>0?'Tidak ada marker berikutnya':'Tidak ada marker sebelumnya');return}
  pausePlay();try{A()._setT(m)}catch(_){}
}
function delHere(){
  const S=scn();if(!S)return;const a=marks(S),t=curT();
  let bi=-1,bd=.2;a.forEach((x,i)=>{const d=Math.abs(x-t);if(d<bd){bd=d;bi=i}});
  if(bi<0){toast('Tidak ada marker di dekat garis waktu');return}
  a.splice(bi,1);save();draw(true);toast('Marker dihapus');
}
function delAll(){
  const S=scn();if(!S)return;
  if(!marks(S).length){toast('Belum ada marker');return}
  S.markers=[];save();draw(true);toast('Semua marker dihapus');
}
function toMarkers(){
  const S=scn();if(!S)return;const a=marks(S);
  if(!a.length){toast('Tambah marker dulu (tombol ◆)');return}
  const L=S.items.slice(2).filter(i=>OK(i.kind)&&!i.pano&&!i.lock);
  if(!L.length){toast('Belum ada layer');return}
  const n=Math.min(L.length,a.length);
  for(let i=0;i<n;i++)shift(L[i],a[i]-(L[i].start||0));
  touch();toast(n+' layer disusun ke marker'+(L.length>a.length?' ('+(L.length-n)+' layer lain tidak diubah)':''));
}
function beatFx(prop,peak,len,name){
  const S=scn();if(!S)return;const a=marks(S);
  if(!a.length){toast('Tambah marker dulu (tombol ◆)');return}
  const fx=S.items[1];
  if(fx.keys[prop]){fx.keys[prop]=fx.keys[prop].filter(k=>!k.b);if(!fx.keys[prop].length)delete fx.keys[prop]}   /* hapus hasil beat sebelumnya, keyframe buatanmu aman */
  a.forEach(m=>{K(fx,prop,m-.03,0,'linear',1);K(fx,prop,m,peak,'out',1);K(fx,prop,m+len,0,'inout',1)});
  touch();toast(name+' dipasang di '+a.length+' marker');
}

/* ===== tampilan marker di timeline ===== */
let mkSig='';
function draw(force){
  const S=scn(),host=$('s3x-tl'),inner=host&&host.querySelector('.s3x-inner');
  if(!S||!inner)return;
  const a=S.markers||[],sg=S.id+'|'+a.join(',')+'|'+inner.style.width;
  const have=inner.querySelectorAll('.s3x-mk').length;
  if(!force&&sg===mkSig&&have===a.length)return;
  mkSig=sg;
  inner.querySelectorAll('.s3x-mk').forEach(e=>e.remove());
  const w=parseFloat(inner.style.width);if(!(w>LAB))return;
  const p=(w-LAB-16)/S.dur;
  a.forEach(m=>{const d=document.createElement('div');d.className='s3x-mk';d.style.left=(LAB+m*p)+'px';d.title=m.toFixed(2)+' dtk';inner.appendChild(d)});
}

/* ===== loop ===== */
let loop=false,was=false;
function tick(){
  requestAnimationFrame(tick);
  const v=$('s3d');if(!v||v.hidden){was=false;return}
  const pb=$('s3-play'),pl=!!pb&&pb.textContent.trim()==='❚❚',S=scn();
  if(S&&loop&&was&&!pl&&curT()>=S.dur-.05&&!document.querySelector('#s3-dlg-ex[open]'))pb.click();
  was=pl;
  const now=performance.now();if(now-(tick.l||0)>250){tick.l=now;draw(false)}
}

/* ===== perbanyak layer ===== */
function offset(it,p,d){
  if(!d||!(p in it.props))return;
  it.props[p]=(it.props[p]||0)+d;
  if(it.keys[p])it.keys[p].forEach(k=>{k.v+=d});
}
function multiply(mode){
  const S=scn(),it=byId(selId());
  if(!S||!it||!OK(it.kind)||it.pano){toast('Pilih layer teks / foto / video / model dulu');return}
  const sc=Math.max(.4,it.props.scale||1),pos=S.items.indexOf(it);
  const N={row:5,circle:6,stair:5,grid:9}[mode];if(!N)return;
  const R=Math.max(320,600*sc),stepX=Math.max(260,380*sc);
  const made=[];
  for(let i=1;i<N;i++){
    const c=JSON.parse(JSON.stringify(it));c.id=rid();c.name=(it.name||'Layer')+' '+(i+1);c.parent=it.parent||null;c.lock=false;
    if(mode==='row'){offset(c,'x',i*stepX)}
    else if(mode==='circle'){
      const a=i*360/N,rad=a*Math.PI/180;
      offset(c,'x',R*Math.sin(rad));offset(c,'z',R*(1-Math.cos(rad)));offset(c,'ry',a);
    }
    else if(mode==='stair'){offset(c,'x',i*90);offset(c,'y',-i*40);offset(c,'z',i*320)}
    else if(mode==='grid'){offset(c,'x',(i%3)*stepX);offset(c,'y',Math.floor(i/3)*stepX)}
    shift(c,i*.12);   /* muncul bergantian tipis supaya hidup */
    made.push(c);
  }
  S.items.splice(pos+1,0,...made);
  touch();toast(made.length+' salinan dibuat ('+({row:'baris',circle:'lingkaran',stair:'tangga 3D',grid:'grid 3×3'}[mode])+')');
}
function card(){
  const P=$('s3-props');if(!P||P.querySelector('#s3b-card'))return;
  const it=byId(selId());if(!it||!OK(it.kind)||it.pano)return;
  const d=document.createElement('div');d.id='s3b-card';
  d.innerHTML='<b>⧉ Perbanyak layer</b><label class="s3-fl">Buat salinan tersusun dari layer ini<select data-parr><option value="">Pilih susunan…</option><option value="row">Baris 5</option><option value="circle">Lingkaran 6 (3D)</option><option value="stair">Tangga 3D 5</option><option value="grid">Grid 3×3</option></select></label>';
  const a=P.querySelector('#s3p-card')||P.querySelector('#s3x-anim'),h=P.querySelector('.s3-hint');
  if(a)a.insertAdjacentElement('afterend',d);else if(h)h.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
document.addEventListener('change',e=>{
  const el=e.target;if(!el.closest||!el.closest('#s3b-card'))return;
  if(el.dataset.parr!==undefined&&el.value){const v=el.value;el.value='';multiply(v)}
});

/* ===== menu Beat ===== */
function menu(){
  const tools=document.querySelector('#s3d .s3-tools');if(!tools||$('s3b-btn'))return;
  const mkb=(txt,title,fn)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=txt;b.title=title;b.dataset.fn='1';b.onclick=fn;return b};
  const btn=document.createElement('button');btn.type='button';btn.id='s3b-btn';btn.className='btn hx-btn';btn.setAttribute('aria-haspopup','true');btn.innerHTML='◆ Beat <small>▾</small>';
  const pan=document.createElement('div');pan.className='hx-pan';pan.hidden=true;
  [
    mkb('◆ Tambah marker (M)','Taruh marker di garis waktu; saat musik diputar ini jadi tap beat',()=>addMarker()),
    mkb('⏮ Marker sebelumnya','',()=>goMarker(-1)),
    mkb('⏭ Marker berikutnya','',()=>goMarker(1)),
    mkb('✕ Hapus marker di sini','',delHere),
    mkb('✕ Hapus semua marker','',delAll),
    mkb('⇉ Susun layer ke marker','Layer ke-1 muncul di marker 1, layer ke-2 di marker 2, dst',toMarkers),
    mkb('⚡ Flash putih di tiap marker','Keyframe kilat putih pada Efek di setiap marker',()=>beatFx('flash',.55,.28,'Flash')),
    mkb('📳 Getar kamera di tiap marker','Keyframe getar kamera pada Efek di setiap marker',()=>beatFx('shake',.7,.4,'Getar'))
  ].forEach(b=>pan.appendChild(b));
  tools.appendChild(btn);document.body.appendChild(pan);
  const bg=document.querySelector('.hx-bg'),mob=()=>matchMedia('(max-width:700px)').matches;
  const close=()=>{if(pan.hidden)return;pan.hidden=true;btn.classList.remove('open');btn.setAttribute('aria-expanded','false');if(bg)bg.classList.remove('show')};
  const open=()=>{
    pan.hidden=false;btn.classList.add('open');btn.setAttribute('aria-expanded','true');
    if(mob()){if(bg)bg.classList.add('show')}
    else{
      const r=btn.getBoundingClientRect(),w=pan.offsetWidth,h=pan.offsetHeight;
      pan.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';
      let top=r.bottom+6;if(top+h>innerHeight-8)top=Math.max(8,r.top-h-6);pan.style.top=top+'px';
    }
  };
  btn.onclick=e=>{e.stopPropagation();pan.hidden?open():close()};
  pan.addEventListener('click',e=>{if(e.target.closest('button'))setTimeout(close,0)});
  document.addEventListener('click',e=>{if(!pan.hidden&&!pan.contains(e.target)&&!btn.contains(e.target))close()});
  if(bg)bg.addEventListener('click',close);
  addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  addEventListener('resize',close);
}

function boot(){
  const P=$('s3-props');if(!P||$('s3b-st'))return;
  const st=document.createElement('style');st.id='s3b-st';
  st.textContent='#s3b-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--panel)}#s3b-card>b{display:block;margin-bottom:8px}'
   +'.s3x-mk{position:absolute;top:0;bottom:0;width:0;border-left:1px dashed #ffd166;z-index:1;pointer-events:none}'
   +'.s3x-mk::before{content:"";position:absolute;top:0;left:-5px;border:5px solid transparent;border-top-color:#ffd166}'
   +'#s3b-mk.on,#s3b-loop.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 16%,var(--panel))}';
  document.head.appendChild(st);
  new MutationObserver(card).observe(P,{childList:true});card();
  menu();
  const ctl=document.querySelector('#s3d .s3-ctl');
  if(ctl){
    const m=document.createElement('button');m.type='button';m.id='s3b-mk';m.className='btn';m.textContent='◆';m.title='Marker di garis waktu (tombol M). Saat musik diputar = tap beat';
    m.onclick=()=>addMarker();
    const l=document.createElement('button');l.type='button';l.id='s3b-loop';l.className='btn';l.textContent='⟲';l.title='Ulangi putar terus-menerus';
    l.onclick=()=>{loop=!loop;l.classList.toggle('on',loop);toast(loop?'Ulangi putar: hidup':'Ulangi putar: mati')};
    ctl.appendChild(m);ctl.appendChild(l);
  }
  addEventListener('keydown',e=>{
    const v=$('s3d');if(!v||v.hidden||!scn()||document.querySelector('dialog[open]'))return;
    if(e.ctrlKey||e.metaKey||e.altKey||(e.key||'').toLowerCase()!=='m')return;
    const ae=document.activeElement,tg=ae?ae.tagName:'';if(/INPUT|TEXTAREA|SELECT/.test(tg))return;
    e.preventDefault();addMarker();
  });
  tick();
}
try{boot()}catch(e){console.error('Beat Edit 3D gagal dimuat',e)}
})();
