/* TIMELINE Edit 3D: pengeditan layer seperti editor 2D (klip di jalur waktu).
   - Tiap layer = satu baris dengan klip: geser untuk memindah, tarik tepi kiri/kanan untuk memotong (trim), ketuk untuk memilih.
   - Split di garis waktu, Duplikat, Salin / Tempel, Hapus, sembunyikan (mata), kunci (gembok), zoom, snap.
   - Ketuk penggaris waktu untuk memindah garis waktu. Tanda kuning kecil = keyframe.
   Dimuat dari js/home-ref.js setelah semua script lain. Tidak mengubah isi scene3d.js: hanya mengubah start / dur / trim / vis / lock
   pada data layer lalu memakai undo, simpan otomatis, dan render bawaan. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const A=()=>(window.APK&&APK.s3d)||null;
const scn=()=>{try{return A().scene}catch(_){return null}};
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const rid=()=>'i'+Math.random().toString(36).slice(2,8);
const ICON={camera:'🎥',fx:'✦',text:'T',image:'🖼',video:'🎞',group:'▣',sunburst:'✺',ribbon:'〰',dust:'✧',model:'🧊'};
const LAB=104;
let zoom=1,clipb=null,sig='',drag=null,host,scroller,inner,curP=40,lastSig=0,lastSel='',raf=0;
const isSys=it=>it.kind==='camera'||it.kind==='fx';
const byId=id=>{const s=scn();return s?s.items.find(i=>i.id===id)||null:null};
const selId=()=>{const c=document.querySelector('#s3-chips .on');return c&&c.dataset.sel||'cam'};
const curT=()=>parseFloat(($('s3-time')||{}).value)||0;
const endOf=(S,it)=>isSys(it)?S.dur:(it.dur==null?S.dur:(it.start||0)+it.dur);
const pausePlay=()=>{const p=$('s3-play');if(p&&p.textContent.trim()==='❚❚')p.click()};
function touch(){const nm=$('s3-name');if(nm)nm.dispatchEvent(new Event('input',{bubbles:true}));try{A().select(selId())}catch(_){}}
const label=it=>it.kind==='text'?(String(it.text||'').split('\n')[0].slice(0,16)||'Teks'):(it.name||it.kind).slice(0,16);
const pps=S=>Math.max(24,((scroller&&scroller.clientWidth)||320)-LAB-12)/S.dur*zoom;

function signature(S){
  return S.dur+'|'+zoom+'|'+((scroller&&scroller.clientWidth)||0)+'|'+S.items.map(i=>i.id+':'+i.kind+':'+(i.start||0)+':'+i.dur+':'+i.vis+':'+(i.lock?1:0)+':'+label(i)+':'+
    Object.keys(i.keys||{}).map(p=>(i.keys[p]||[]).map(k=>k.t).join(',')).join(';')).join('~');
}
function build(){
  const S=scn();if(!S||!inner)return;
  const p=curP=pps(S),W=LAB+S.dur*p+16,sid=selId();
  inner.style.width=W+'px';
  const steps=[.5,1,2,5,10,15,30,60,120],step=steps.find(s=>s*p>=46)||120;
  let h='<div class="s3x-ruler">';
  for(let s=0;s<=S.dur+1e-6;s+=step)h+='<span style="left:'+(LAB+s*p)+'px">'+(Math.round(s*10)/10)+'s</span>';
  h+='</div>';
  S.items.forEach(it=>{
    const sy=isSys(it),st=sy?0:(it.start||0),en=endOf(S,it),ks=new Set();
    Object.values(it.keys||{}).forEach(a=>a.forEach(k=>ks.add(Math.round(k.t*100)/100)));
    h+='<div class="s3x-row'+(it.id===sid?' on':'')+(it.vis===false?' hid':'')+'" data-id="'+it.id+'"><div class="s3x-lab"><span class="s3x-nm">'+(ICON[it.kind]||'')+' '+esc(label(it))+'</span>'
      +(sy?'':'<button type="button" data-x="vis" title="Tampilkan / sembunyikan layer">'+(it.vis===false?'🚫':'👁')+'</button><button type="button" data-x="lock" title="Kunci layer supaya tidak bergeser">'+(it.lock?'🔒':'🔓')+'</button>')
      +'</div><div class="s3x-trk" style="width:'+(S.dur*p)+'px"><div class="s3x-clip k-'+it.kind+(sy?' sys':'')+(it.lock?' lock':'')+'" style="left:'+(st*p)+'px;width:'+Math.max(8,(en-st)*p)+'px">'
      +(sy?'':'<i class="l"></i><i class="r"></i>')+'<span>'+esc(label(it))+'</span></div>'
      +[...ks].map(k=>'<u style="left:'+(k*p)+'px"></u>').join('')+'</div></div>';
  });
  h+='<div class="s3x-ph"></div>';
  inner.innerHTML=h;
  lastSel=sid;
}
function snapV(S,v,skip){
  const th=8/curP,c=[0,S.dur,curT()];
  S.items.forEach(o=>{if(o!==skip&&!isSys(o)){c.push(o.start||0,endOf(S,o))}});
  let b=v,bd=th;c.forEach(x=>{const d=Math.abs(x-v);if(d<bd){bd=d;b=x}});return b;
}
function seekAt(e,S){
  const r=inner.getBoundingClientRect();pausePlay();
  try{A()._setT(clamp((e.clientX-r.left-LAB)/curP,0,S.dur))}catch(_){}
}
function onDown(e){
  const S=scn();if(!S)return;
  const row=e.target.closest('.s3x-row'),btn=e.target.closest('[data-x]');
  if(btn&&row){
    const it=byId(row.dataset.id);if(!it)return;
    if(btn.dataset.x==='vis'){it.vis=it.vis===false;touch()}else{it.lock=!it.lock;touch()}
    sig='';return;
  }
  if(e.target.closest('.s3x-ruler')){drag={mode:'seek'};inner.setPointerCapture(e.pointerId);seekAt(e,S);return}
  if(!row)return;
  const it=byId(row.dataset.id);if(!it)return;
  const c=e.target.closest('.s3x-clip');
  if(!c){seekAt(e,S);return}
  if(it.id!==selId())A().select(it.id);
  if(isSys(it)||it.lock){if(it.lock)toast('Layer terkunci');return}
  const st=it.start||0,d0=endOf(S,it)-st;
  drag={mode:e.target.classList.contains('l')?'l':e.target.classList.contains('r')?'r':'m',it,x0:e.clientX,st,d0,nul:it.dur==null,tr:it.trim||0,el:c,moved:false};
  inner.setPointerCapture(e.pointerId);
}
function onMove(e){
  const S=scn();if(!S||!drag)return;
  if(drag.mode==='seek'){seekAt(e,S);return}
  const it=drag.it,dl=(e.clientX-drag.x0)/curP,{st,d0}=drag;drag.moved=true;
  if(drag.mode==='m'){
    let ns=clamp(st+dl,0,Math.max(0,S.dur-Math.min(d0,S.dur)));
    const a=snapV(S,ns,it),b=snapV(S,ns+d0,it)-d0;ns=Math.abs(a-ns)<=Math.abs(b-ns)?a:b;
    it.start=clamp(ns,0,Math.max(0,S.dur-.1));
    drag.el.style.left=(it.start*curP)+'px';
  }else if(drag.mode==='r'){
    const en=clamp(snapV(S,st+d0+dl,it),st+.1,S.dur);
    it.dur=Math.round((en-st)*1000)/1000;drag.el.style.width=Math.max(8,it.dur*curP)+'px';
  }else{
    const en=st+d0,lo=it.kind==='video'?Math.max(0,st-drag.tr):0;
    const ns=clamp(snapV(S,st+dl,it),lo,en-.1);
    it.start=Math.round(ns*1000)/1000;it.dur=Math.round((en-ns)*1000)/1000;
    if(it.kind==='video')it.trim=Math.max(0,Math.round((drag.tr+(ns-st))*1000)/1000);
    drag.el.style.left=(it.start*curP)+'px';drag.el.style.width=Math.max(8,it.dur*curP)+'px';
  }
  if(!raf)raf=requestAnimationFrame(()=>{raf=0;try{A().render()}catch(_){}});
}
function onUp(){
  const d=drag;drag=null;
  if(d&&d.it&&d.moved){touch();sig=''}
}

/* ----- perintah ----- */
function split(){
  const S=scn(),it=byId(selId()),tt=curT();
  if(!S||!it||isSys(it)){toast('Pilih layer (bukan Kamera / Efek) dulu');return}
  if(it.lock){toast('Layer terkunci');return}
  const st=it.start||0,en=endOf(S,it);
  if(tt<=st+.05||tt>=en-.05){toast('Taruh garis waktu di dalam klip layer ini dulu');return}
  pausePlay();
  const b=JSON.parse(JSON.stringify(it));b.id=rid();b.start=tt;b.dur=it.dur==null?null:Math.round((en-tt)*1000)/1000;
  if(it.kind==='video')b.trim=Math.round(((it.trim||0)+(tt-st))*1000)/1000;
  it.dur=Math.round((tt-st)*1000)/1000;
  S.items.splice(S.items.indexOf(it)+1,0,b);
  A().select(b.id);touch();sig='';toast('Layer dibelah di '+tt.toFixed(2)+' dtk');
}
function copy(){
  const it=byId(selId());
  if(!it||isSys(it)){toast('Pilih layer (bukan Kamera / Efek) untuk disalin');return}
  clipb=JSON.parse(JSON.stringify(it));toast('Disalin: '+label(it));
}
function paste(){
  const S=scn();if(!S)return;
  if(!clipb){toast('Belum ada yang disalin');return}
  const b=JSON.parse(JSON.stringify(clipb)),tt=curT(),d=tt-(b.start||0);
  b.id=rid();b.start=Math.round(tt*1000)/1000;b.parent=null;b.lock=false;
  Object.values(b.keys||{}).forEach(a=>a.forEach(k=>{k.t=Math.round((k.t+d)*1000)/1000}));   /* keyframe ikut bergeser */
  S.items.push(b);A().select(b.id);touch();sig='';toast('Ditempel di '+tt.toFixed(2)+' dtk');
}
function del(){
  const it=byId(selId());
  if(it&&it.lock){toast('Layer terkunci');return}
  const b=$('s3-del');if(b)b.click();
}
function setZoom(f){zoom=clamp(zoom*f,.5,12);sig=''}

/* ----- pasang ke antarmuka ----- */
const mq=window.matchMedia?matchMedia('(min-width:900px)'):null;
function place(){
  if(!host)return;
  const stage=document.querySelector('#s3d .s3-stage'),side=document.querySelector('#s3d .s3-side');
  if(mq&&mq.matches&&stage){if(host.parentNode!==stage)stage.appendChild(host)}
  else if(side){if(host.parentNode!==side)side.insertBefore(host,side.firstChild)}
}
function tick(){
  requestAnimationFrame(tick);
  const v=$('s3d'),S=scn();if(!v||v.hidden||!S||!host)return;
  if(!host.isConnected||!host.parentNode)place();
  const now=performance.now();
  if(!drag&&now-lastSig>180){lastSig=now;const sg=signature(S);if(sg!==sig){sig=sg;build()}}
  const ph=inner.querySelector('.s3x-ph');
  if(ph){
    const x=LAB+curT()*curP;ph.style.left=x+'px';
    if(!drag&&$('s3-play')&&$('s3-play').textContent.trim()==='❚❚'&&scroller){
      if(x>scroller.scrollLeft+scroller.clientWidth-24||x<scroller.scrollLeft+LAB)scroller.scrollLeft=Math.max(0,x-LAB-16);
    }
  }
  const sid=selId();
  if(sid!==lastSel){lastSel=sid;inner.querySelectorAll('.s3x-row').forEach(r=>r.classList.toggle('on',r.dataset.id===sid))}
}
function boot(){
  const sv=$('s3d');if(!sv||$('s3x-tl'))return;
  const st=document.createElement('style');
  st.textContent=
   '#s3x-tl{margin:10px 0 4px;border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden}'
  +'.s3x-bar{display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-bottom:1px solid var(--line)}'
  +'.s3x-bar .btn{padding:5px 10px;font-size:12.5px;min-height:32px}.s3x-bar .sp{flex:1}'
  +'.s3x-scroll{overflow:auto;max-height:240px;position:relative;overscroll-behavior:contain}'
  +'.s3x-inner{position:relative;min-width:100%;user-select:none;-webkit-user-select:none}'
  +'.s3x-ruler{position:sticky;top:0;z-index:4;height:22px;background:var(--panel2,var(--panel));border-bottom:1px solid var(--line);touch-action:none;cursor:pointer}'
  +'.s3x-ruler span{position:absolute;top:4px;font-size:10px;color:var(--dim);transform:translateX(-2px);border-left:1px solid var(--line);padding-left:3px;height:18px}'
  +'.s3x-row{display:flex;height:36px;border-bottom:1px solid var(--line)}'
  +'.s3x-row.on{background:color-mix(in srgb,var(--accent) 9%,transparent)}.s3x-row.hid .s3x-clip{opacity:.35}'
  +'.s3x-lab{position:sticky;left:0;z-index:3;flex:none;width:'+LAB+'px;display:flex;align-items:center;gap:2px;padding:0 4px;background:var(--panel);border-right:1px solid var(--line);font-size:11.5px}'
  +'.s3x-row.on .s3x-lab{background:color-mix(in srgb,var(--accent) 14%,var(--panel))}'
  +'.s3x-nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  +'.s3x-lab button{border:0;background:none;color:var(--text);font-size:12px;padding:2px;cursor:pointer;opacity:.8}'
  +'.s3x-trk{position:relative;flex:none;height:100%}'
  +'.s3x-clip{position:absolute;top:5px;height:26px;border-radius:7px;display:flex;align-items:center;overflow:hidden;cursor:grab;touch-action:none;background:#3b6fd6;border:1px solid rgba(255,255,255,.28)}'
  +'.s3x-clip span{padding:0 10px;font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}'
  +'.s3x-clip.k-text{background:#8a5cf6}.s3x-clip.k-image{background:#1fa37a}.s3x-clip.k-video{background:#d9822b}.s3x-clip.k-group{background:#6b7280}.s3x-clip.k-model{background:#c2415d}'
  +'.s3x-clip.k-sunburst,.s3x-clip.k-ribbon,.s3x-clip.k-dust{background:#0e8fa8}.s3x-clip.sys{background:#2b3140;cursor:default;opacity:.85}.s3x-clip.lock{cursor:not-allowed;filter:saturate(.5)}'
  +'.s3x-clip i{position:absolute;top:0;bottom:0;width:9px;cursor:ew-resize;background:rgba(255,255,255,.3);touch-action:none}.s3x-clip i.l{left:0}.s3x-clip i.r{right:0}'
  +'.s3x-trk u{position:absolute;bottom:3px;width:7px;height:7px;margin-left:-3px;background:#ffd166;transform:rotate(45deg);pointer-events:none;border-radius:1px}'
  +'.s3x-ph{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:#ff4d6d;z-index:5;pointer-events:none}'
  +'@media (min-width:900px){.s3x-scroll{max-height:300px}}';
  document.head.appendChild(st);
  host=document.createElement('div');host.id='s3x-tl';
  host.innerHTML='<div class="s3x-bar"><button class="btn" data-c="split" title="Belah layer terpilih di garis waktu (tombol S)">✂ Split</button><button class="btn" data-c="dup" title="Duplikat layer (Ctrl+D)">⧉ Duplikat</button><button class="btn" data-c="copy" title="Salin (Ctrl+C)">Salin</button><button class="btn" data-c="paste" title="Tempel di garis waktu (Ctrl+V)">Tempel</button><button class="btn danger" data-c="del" title="Hapus layer">Hapus</button><span class="sp"></span><button class="btn" data-c="zo" aria-label="Perkecil">−</button><button class="btn" data-c="zi" aria-label="Perbesar">+</button></div><div class="s3x-scroll"><div class="s3x-inner"></div></div>';
  scroller=host.querySelector('.s3x-scroll');inner=host.querySelector('.s3x-inner');
  host.querySelector('.s3x-bar').onclick=e=>{
    const b=e.target.closest('[data-c]');if(!b)return;
    ({split,copy,paste,del,zo:()=>setZoom(1/1.4),zi:()=>setZoom(1.4),dup:()=>{const d=$('s3-dup');if(d)d.click()}})[b.dataset.c]();
  };
  inner.addEventListener('pointerdown',onDown);inner.addEventListener('pointermove',onMove);
  inner.addEventListener('pointerup',onUp);inner.addEventListener('pointercancel',onUp);
  place();if(mq&&mq.addEventListener)mq.addEventListener('change',place);
  addEventListener('keydown',e=>{
    const v=$('s3d');if(!v||v.hidden||!scn()||document.querySelector('dialog[open]'))return;
    const ae=document.activeElement,tg=ae?ae.tagName:'';if(/INPUT|TEXTAREA|SELECT/.test(tg))return;
    const k=(e.key||'').toLowerCase(),m=e.ctrlKey||e.metaKey;
    if(!m&&!e.altKey&&k==='s'){e.preventDefault();split()}
    else if(m&&k==='c'){e.preventDefault();copy()}
    else if(m&&k==='v'){e.preventDefault();paste()}
    else if(m&&k==='d'){e.preventDefault();const d=$('s3-dup');if(d)d.click()}
  });
  tick();
}
try{boot()}catch(e){console.error('Timeline Edit 3D gagal dimuat',e)}
})();
