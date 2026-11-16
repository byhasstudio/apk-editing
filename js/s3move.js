/* Gerak pro Edit 3D (dimuat dari js/home-ref.js, paling akhir). Tidak mengubah scene3d.js: hanya menyusun keyframe lewat data layer.
   1) KURVA PRO: memantul (bounce), karet (elastic), melenting (overshoot), expo, sine, hentak tajam. Dihitung jadi keyframe tambahan di antara keyframe aslimu
      (bisa dikembalikan ke kurva asli kapan saja).
   2) JALUR GERAK layer: mengorbit, angka 8, gelombang, spiral masuk.
   3) HALUSKAN GERAK: merapikan keyframe yang bergetar (misal hasil tracking).
   4) PECAH TEKS PER KATA: tiap kata jadi layer sendiri dengan animasi muncul bergantian (kinetic typography).
   5) GERAK KAMERA PRO: dolly zoom (vertigo), geser parallax, crane naik / turun, kamera genggam (handheld) 3 tingkat.
   Semua tercatat di undo dan tersimpan otomatis. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const r3=v=>Math.round(v*1000)/1000;
const rid=()=>'i'+Math.random().toString(36).slice(2,8);
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const OK=k=>k==='text'||k==='image'||k==='video'||k==='model';
const V=(it,p,t)=>A().val(it,p,t);
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
/* K: tambah / ubah keyframe. f = penanda jenis ('g' kurva pro, 'p' jalur, 'h' handheld) supaya hasil otomatis bisa dihapus tanpa menyentuh keyframe buatanmu */
function K(it,p,t,v,e,f){
  const a=it.keys[p]||(it.keys[p]=[]),k=a.find(k=>Math.abs(k.t-t)<.005);
  if(k){k.v=v;if(e)k.e=e;if(f)k[f]=1}
  else{const n={t:r3(Math.max(0,t)),v,e:e||'inout'};if(f)n[f]=1;a.push(n);a.sort((x,y)=>x.t-y.t)}
}
function rm(it,p,f){
  if(!it.keys[p])return;
  it.keys[p]=it.keys[p].filter(k=>!k[f]);
  if(!it.keys[p].length)delete it.keys[p];
}
function offset(it,p,d){
  if(!d||!(p in it.props))return;
  it.props[p]=(it.props[p]||0)+d;
  if(it.keys[p])it.keys[p].forEach(k=>{k.v+=d});
}
const orig=k=>!(k.g||k.p||k.h||k.i||k.b);   /* keyframe asli: bukan hasil otomatis */

/* ===== 1) kurva pro ===== */
const E={
  bounce:u=>{const n=7.5625,d=2.75;if(u<1/d)return n*u*u;if(u<2/d){u-=1.5/d;return n*u*u+.75}if(u<2.5/d){u-=2.25/d;return n*u*u+.9375}u-=2.625/d;return n*u*u+.984375},
  elastic:u=>u<=0?0:u>=1?1:Math.pow(2,-10*u)*Math.sin((u*10-.75)*(2*Math.PI/3))+1,
  back:u=>{const c=2.2;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)},
  expo:u=>u>=1?1:1-Math.pow(2,-10*u),
  sine:u=>-(Math.cos(Math.PI*u)-1)/2,
  snap:u=>1-Math.pow(1-u,5)
};
const NAME={bounce:'Memantul',elastic:'Karet',back:'Melenting',expo:'Expo',sine:'Sine halus',snap:'Hentak tajam'};
function unbake(it){
  Object.keys(it.keys).forEach(p=>{
    rm(it,p,'g');
    (it.keys[p]||[]).forEach(k=>{if(k.e0!==undefined){k.e=k.e0;delete k.e0}});
  });
}
function bake(kind){
  const it=byId(selId());
  if(!it||it.kind==='fx'){toast('Pilih layer atau kamera dulu');return}
  unbake(it);
  if(kind==='off'){touch();toast('Kurva dikembalikan ke asli');return}
  const f=E[kind];if(!f)return;
  let segs=0;
  Object.keys(it.keys).forEach(p=>{
    const a=it.keys[p],idx=[];a.forEach((k,i)=>{if(orig(k))idx.push(i)});
    const add=[];
    for(let j=0;j<idx.length-1;j++){
      const i0=idx[j],i1=idx[j+1];if(i1!==i0+1)continue;   /* ada keyframe otomatis lain di antaranya: lewati */
      const k0=a[i0],k1=a[i1];if(Math.abs(k1.v-k0.v)<1e-6||k1.t-k0.t<.1)continue;
      const n=clamp(Math.round((k1.t-k0.t)*14),5,18);
      if(k0.e0===undefined)k0.e0=k0.e;k0.e='linear';
      for(let i=1;i<n;i++){const u=i/n;add.push({t:r3(k0.t+(k1.t-k0.t)*u),v:k0.v+(k1.v-k0.v)*f(u),e:'linear',g:1})}
      segs++;
    }
    if(add.length){it.keys[p]=a.concat(add).sort((x,y)=>x.t-y.t)}
  });
  if(!segs){toast('Butuh minimal 2 keyframe pada satu properti (ketuk ◆ di dua waktu berbeda)');return}
  touch();toast('Kurva '+NAME[kind]+' dipasang di '+segs+' segmen gerak');
}

/* ===== 2) jalur gerak ===== */
function path(kind){
  const S=scn(),it=byId(selId());
  if(!S||!it||!OK(it.kind)||it.pano){toast('Pilih layer teks / foto / video / model dulu');return}
  ['x','y','z'].forEach(p=>rm(it,p,'p'));
  if(kind==='off'){touch();toast('Jalur gerak dihapus');return}
  const st=it.start||0,en=it.dur==null?S.dur:st+it.dur,len=en-st;
  if(len<.6){toast('Layer terlalu pendek untuk jalur gerak');return}
  const sc=Math.max(.5,it.props.scale||1),R=480*sc,TP=Math.PI*2,n=clamp(Math.round(len*10),12,80);
  const F={
    circle:u=>[R*Math.sin(TP*u),0,R*(1-Math.cos(TP*u))],
    eight:u=>[R*Math.sin(TP*u),R*.5*Math.sin(2*TP*u),0],
    wave:u=>[0,70*Math.sin(2*TP*u),0],
    spiral:u=>{const r=(1-u)*380*sc,a=2*TP*u;return[r*Math.cos(a),r*Math.sin(a),(1-u)*1300]}
  }[kind];
  if(!F)return;
  const ts=[],off=[];for(let i=0;i<=n;i++){ts.push(st+len*i/n);off.push(F(i/n))}
  ['x','y','z'].forEach((p,j)=>{
    if(!(p in it.props)||!off.some(o=>Math.abs(o[j])>.01))return;
    const base=ts.map(tt=>V(it,p,tt));   /* nilai asli dihitung dulu supaya animasi lama tidak rusak */
    ts.forEach((tt,i)=>K(it,p,tt,base[i]+off[i][j],'linear','p'));
  });
  touch();toast('Jalur gerak dipasang sepanjang layer');
}

/* ===== 3) haluskan ===== */
function smooth(level){
  const it=byId(selId());if(!it||it.kind==='fx')return;
  const w=level>1?[1,2,3,2,1]:[1,2,1],h=(w.length-1)/2;let n=0;
  Object.keys(it.keys).forEach(p=>{
    if(p==='opacity')return;
    const a=it.keys[p];if(a.length<w.length)return;
    const v=a.map(k=>k.v);
    a.forEach((k,i)=>{
      if(i<h||i>=a.length-h)return;
      let s=0,ws=0;w.forEach((wt,j)=>{s+=v[i-h+j]*wt;ws+=wt});k.v=s/ws;
    });
    n++;
  });
  if(!n){toast('Butuh minimal '+w.length+' keyframe pada satu properti');return}
  touch();toast('Gerak dihaluskan ('+n+' properti)');
}

/* ===== 4) pecah teks per kata ===== */
function splitWords(){
  const S=scn(),it=byId(selId());
  if(!S||!it||it.kind!=='text'){toast('Pilih layer teks dulu');return}
  const lines=String(it.text||'').split('\n').map(l=>l.trim().split(/\s+/).filter(Boolean)).filter(l=>l.length);
  const total=lines.reduce((s,l)=>s+l.length,0);
  if(total<2){toast('Teks perlu minimal 2 kata');return}
  const sc=it.props.scale||1,size=it.size||170,cx=document.createElement('canvas').getContext('2d');
  cx.font='900 '+size+'px "Arial Black","Helvetica Neue",Arial,sans-serif';
  const gap=size*.3*sc,lh=size*1.12*sc,pos=S.items.indexOf(it),made=[];let idx=0;
  lines.forEach((ws,li)=>{
    const wd=ws.map(w=>cx.measureText(w).width*sc),tot=wd.reduce((s,v)=>s+v,0)+gap*(ws.length-1);let cum=0;
    ws.forEach((w,wi)=>{
      const c=JSON.parse(JSON.stringify(it));c.id=rid();c.text=w;c.name=w.slice(0,18);c.parent=it.parent||null;c.lock=false;
      offset(c,'x',cum+wd[wi]/2-tot/2);offset(c,'y',(li-(lines.length-1)/2)*lh);
      cum+=wd[wi]+gap;
      const sh=idx*.14;c.start=r3((it.start||0)+sh);Object.values(c.keys).forEach(a=>a.forEach(k=>{k.t=r3(k.t+sh)}));
      if(!c.keys.opacity&&'opacity' in c.props){K(c,'opacity',c.start,0,'linear');K(c,'opacity',c.start+.22,c.props.opacity,'linear')}
      if(!c.keys.scale&&'scale' in c.props){K(c,'scale',c.start,c.props.scale*.55,'back');K(c,'scale',c.start+.4,c.props.scale,'out')}
      made.push(c);idx++;
    });
  });
  S.items.splice(pos,1,...made);
  S.items.forEach(i=>{if(i.parent===it.id)i.parent=null});
  S.cuts=(S.cuts||[]);
  try{A().select(made[0].id)}catch(_){}
  touch();toast('Teks dipecah jadi '+made.length+' kata, muncul bergantian');
}

/* ===== 5) gerak kamera pro ===== */
function camPro(kind){
  const S=scn(),c=byId(selId());
  if(!S||!c||c.kind!=='camera'){toast('Pilih kamera dulu');return}
  const a=curT(),L=4,cur=p=>V(c,p,a);
  const key=(p,d,e)=>{K(c,p,a,cur(p),e||'inout');K(c,p,a+L,cur(p)+d,e||'inout')};
  if(kind==='parallax'){key('x',160);key('ry',-4)}
  else if(kind==='craneup'){key('y',-200)}
  else if(kind==='cranedown'){key('y',200)}
  else if(kind==='dolly'){
    if(c.target){toast('Dolly zoom butuh kamera manual: ubah "Objek yang ditangkap kamera" ke Manual');return}
    const sub=S.items.slice(2).find(i=>OK(i.kind)&&!i.pano&&i.vis!==false&&(i.start||0)<=a+.01),lz=sub?V(sub,'z',a):0;
    const F=f=>500/Math.tan(f*Math.PI/360),fov0=cur('fov'),fov1=clamp(fov0+(fov0<75?35:-30),20,120),cz0=cur('z'),F0=F(fov0),D0=lz-cz0+F0;
    if(D0<150){toast('Objek terlalu dekat dengan kamera untuk dolly zoom');return}
    const n=12;
    for(let i=0;i<=n;i++){const u=i/n,fv=fov0+(fov1-fov0)*E.sine(u),Fv=F(fv);K(c,'fov',a+L*u,fv,'linear');K(c,'z',a+L*u,lz+Fv-D0*Fv/F0,'linear')}
  }
  else if(/^hand[123]$/.test(kind)){
    ['x','y','rx','ry','rz'].forEach(p=>rm(c,p,'h'));
    const lv={hand1:[4,.25,.35],hand2:[9,.5,.7],hand3:[17,1,1.4]}[kind],len=S.dur-a;
    if(len<.8){toast('Geser garis waktu ke awal bagian yang mau diberi handheld');return}
    const step=len>58?len/130:.45,ts=[];for(let t=a;t<S.dur;t+=step)ts.push(t);ts.push(S.dur);
    let seed=0;for(const ch of c.id)seed=(seed*31+ch.charCodeAt(0))>>>0;
    const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1};
    const amp={x:lv[0],y:lv[0],rz:lv[1],rx:lv[2],ry:lv[2]};
    Object.keys(amp).forEach(p=>{
      if(!(p in c.props))return;
      const base=ts.map(tt=>V(c,p,tt));
      ts.forEach((tt,i)=>K(c,p,tt,base[i]+(i===0?0:rnd()*amp[p]),'inout','h'));
    });
    touch();toast('Kamera genggam dipasang dari '+a.toFixed(1)+' dtk sampai akhir');return;
  }
  else if(kind==='handoff'){['x','y','rx','ry','rz'].forEach(p=>rm(c,p,'h'));touch();toast('Handheld dihapus');return}
  else return;
  touch();toast('Gerak kamera dipasang di '+a.toFixed(2)+' dtk');
}

/* ===== kartu di panel properti ===== */
const opt=a=>a.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('');
const BAKE=[['bounce','Memantul (bounce)'],['elastic','Karet (elastic)'],['back','Melenting (overshoot)'],['expo','Cepat lalu mengerem (expo)'],['sine','Sangat halus (sine)'],['snap','Hentak tajam'],['off','Kembalikan kurva asli']];
const SMO=[['1','Sedikit'],['2','Banyak']];
function card(){
  const P=$('s3-props');if(!P||P.querySelector('#s3m-card'))return;
  const it=byId(selId());if(!it)return;
  let h='';
  if(it.kind==='camera'){
    h='<b>🎥 Gerak kamera pro</b>'
     +'<label class="s3-fl">Gerak sinematik (dipasang di waktu sekarang)<select data-mcam><option value="">Pilih gerak…</option>'+opt([['dolly','Dolly zoom (vertigo)'],['parallax','Geser parallax'],['craneup','Crane naik'],['cranedown','Crane turun'],['hand1','Kamera genggam: lembut'],['hand2','Kamera genggam: sedang'],['hand3','Kamera genggam: kuat'],['handoff','Hapus kamera genggam']])+'</select></label>';
  }else if(OK(it.kind)&&!it.pano){
    h='<b>🎞 Gerak pro</b>'
     +'<label class="s3-fl">Jalur gerak layer (sepanjang layer)<select data-mpath><option value="">Pilih jalur…</option>'+opt([['circle','Mengorbit'],['eight','Angka 8'],['wave','Gelombang'],['spiral','Spiral masuk'],['off','Hapus jalur']])+'</select></label>';
    if(it.kind==='text')h+='<button type="button" class="btn" data-msplit>✂ Pecah per kata (muncul bergantian)</button>';
  }else return;
  h+='<label class="s3-fl">Kurva pro antar keyframe<select data-mbake><option value="">Pilih kurva…</option>'+opt(BAKE)+'</select></label>'
    +'<label class="s3-fl">Haluskan gerak (merapikan keyframe bergetar)<select data-msmooth><option value="">Pilih…</option>'+opt(SMO)+'</select></label>';
  const d=document.createElement('div');d.id='s3m-card';d.innerHTML=h;
  const a=P.querySelector('#s3b-card')||P.querySelector('#s3p-card')||P.querySelector('#s3x-anim'),hint=P.querySelector('.s3-hint');
  if(a)a.insertAdjacentElement('afterend',d);else if(hint)hint.insertAdjacentElement('afterend',d);else P.insertBefore(d,P.firstChild);
}
document.addEventListener('change',e=>{
  const el=e.target;if(!el.closest||!el.closest('#s3m-card'))return;
  const v=el.value;if(!v)return;el.value='';
  if(el.dataset.mbake!==undefined)bake(v);
  else if(el.dataset.mpath!==undefined)path(v);
  else if(el.dataset.msmooth!==undefined)smooth(+v);
  else if(el.dataset.mcam!==undefined)camPro(v);
});
document.addEventListener('click',e=>{
  const b=e.target.closest&&e.target.closest('#s3m-card [data-msplit]');if(b)splitWords();
});

function boot(){
  const P=$('s3-props');if(!P||$('s3m-st'))return;
  const st=document.createElement('style');st.id='s3m-st';
  st.textContent='#s3m-card{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0;background:var(--panel)}#s3m-card>b{display:block;margin-bottom:8px}#s3m-card .btn{margin:2px 0 10px}';
  document.head.appendChild(st);
  new MutationObserver(card).observe(P,{childList:true});card();
}
try{boot()}catch(e){console.error('Gerak pro Edit 3D gagal dimuat',e)}
})();
