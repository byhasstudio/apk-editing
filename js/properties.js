/* Panel properti clip: keyframe animasi + grafik kurva bezier, kecepatan, putar mundur, blend, flip, teks, bentuk,
   gradien dan bayangan, chroma key, mask, dan fade audio */
window.APK=window.APK||{};
APK.properties=(function(){
  const $=id=>document.getElementById(id),panel=$('panel-props'),dock=$('curve-dock');
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  /* key, label, min, max, pengali tampilan, berlaku untuk */
  const F=[['volume','Volume (%)',0,100,100,'audio video'],['x','Posisi X (px)',-5000,5000,1,'video image text shape'],['y','Posisi Y (px)',-5000,5000,1,'video image text shape'],
    ['scale','Scale (%)',1,500,100,'video image text shape'],['opacity','Opacity (%)',0,100,100,'video image text shape'],['rotation','Rotasi (°)',-360,360,1,'video image text shape']];
  const BLEND=[['source-over','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],['color-dodge','Color Dodge'],['color-burn','Color Burn'],['hard-light','Hard Light'],['soft-light','Soft Light'],['difference','Difference'],['exclusion','Exclusion'],['lighter','Tambah (Add)']];
  /* atribut data-xx pada kontrol -> properti objek di clip, dan nilai bawaannya */
  const GROUP={tx:'text',sh:'shape',ck:'chroma',mk:'mask'},GK=Object.keys(GROUP);
  const DG={tx:()=>APK.text.DEF,sh:()=>APK.shapes.DEF,ck:()=>APK.fx.DEF.chroma,mk:()=>APK.fx.DEF.mask};
  const GPAD=14;
  let shown=null,editing=false,spanRef=0,gd=null;
  const rnd=v=>Math.round(v*100)/100;
  const rel=s=>Math.min(Math.max(APK.preview.time-s.c.start,0),s.c.dur);
  const typeOf=s=>s.c.text?'text':s.c.shape?'shape':(s.tr&&s.tr.kind==='audio'?'audio':(s.m?s.m.type:'video'));
  const keyOf=s=>s.c.id+(s.tr&&s.tr.locked?':L':'');
  const shapeOpts=()=>APK.shapes.TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
  /* bagian gradien + bayangan, dipakai untuk teks (g=tx) dan bentuk (g=sh) */
  const gs=(g,c2)=>`<div class="adv"><h3 class="kf-title">Gradien &amp; bayangan</h3>
    <div class="tx-row"><label title="Warnai objek dengan dua warna yang memudar"><input type="checkbox" data-${g}="gradOn">Gradien warna</label></div>
    <label>Warna kedua<input type="color" data-${g}="${c2}"></label>
    <label>Arah gradien (°)<input type="range" data-${g}="gradAngle" min="0" max="360" step="1"></label>
    <div class="tx-row"><label title="Tambah bayangan di belakang objek"><input type="checkbox" data-${g}="shadowOn">Bayangan</label></div>
    <label>Warna bayangan<input type="color" data-${g}="shadowColor"></label>
    <label>Blur bayangan<input type="range" data-${g}="shadowBlur" min="0" max="100" step="1"></label>
    <label>Geser bayangan X<input type="range" data-${g}="shadowX" min="-100" max="100" step="1"></label>
    <label>Geser bayangan Y<input type="range" data-${g}="shadowY" min="-100" max="100" step="1"></label></div>`;

  function build(s){
    const type=typeOf(s),K=APK.kf,T=APK.text,locked=!!(s.tr&&s.tr.locked);
    const rows=F.filter(f=>f[5].includes(type)).map(f=>`<div class="pr-f"><div class="pr-lab"><span>${f[1]}</span><span class="kf-ctl"><button type="button" data-kfgo="-1" data-kp="${f[0]}" title="Loncat ke keyframe sebelumnya">◀</button><button type="button" class="kf-d" data-kf="${f[0]}" title="Tambah / hapus keyframe di posisi playhead">◇</button><button type="button" data-kfgo="1" data-kp="${f[0]}" title="Loncat ke keyframe berikutnya">▶</button></span></div><div class="pr-row"><input type="range" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"><input type="number" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"></div></div>`).join('');
    const speed=type==='video'||type==='audio'?`<label title="100% = normal, 200% = 2x lebih cepat">Kecepatan (%)<input type="number" data-sp="1" min="10" max="800" step="5"></label>`:'';
    const rev=type==='video'?`<div class="tx-row"><label><input type="checkbox" data-cp="reverse">Putar mundur (audio dibisukan)</label></div>`:'';
    const aud=type==='video'||type==='audio'?`<h3 class="kf-title">Audio</h3>
      <label title="Suara naik pelan di awal clip">Fade in (detik)<input type="number" data-cp="fadeIn" min="0" step="0.1"></label>
      <label title="Suara turun pelan di akhir clip">Fade out (detik)<input type="number" data-cp="fadeOut" min="0" step="0.1"></label>
      <div class="tx-row"><label><input type="checkbox" data-cp="mute">Bisukan clip ini</label></div>`:'';
    const vis=type!=='audio'?`<div class="adv"><h3 class="kf-title">Tampilan</h3>
      <label>Mode blend<select data-cp="blend">${BLEND.map(b=>`<option value="${b[0]}">${b[1]}</option>`).join('')}</select></label>
      <div class="tx-row"><label><input type="checkbox" data-cp="flipX">Balik horizontal</label><label><input type="checkbox" data-cp="flipY">Balik vertikal</label></div></div>`:'';
    const media=type==='video'||type==='image';
    const chroma=media?`<div class="adv"><h3 class="kf-title">Chroma key (hapus warna latar)</h3>
      <div class="tx-row"><label><input type="checkbox" data-ck="on">Aktifkan</label></div>
      <label>Warna latar<input type="color" data-ck="color"></label>
      ${window.EyeDropper?'<button type="button" class="btn" data-pick="1" style="margin-top:8px">Ambil warna dari preview</button>':''}
      <label title="Makin besar, makin banyak warna yang mirip ikut dihapus">Toleransi (%)<input type="range" data-ck="sim" min="0" max="100" step="1"></label>
      <label>Kehalusan tepi (%)<input type="range" data-ck="smooth" min="0" max="100" step="1"></label></div>`:'';
    const mask=media?`<div class="adv"><h3 class="kf-title">Mask (potong bentuk)</h3>
      <div class="tx-row"><label><input type="checkbox" data-mk="on">Aktifkan</label><label><input type="checkbox" data-mk="invert">Balik mask</label></div>
      <label>Bentuk mask<select data-mk="type">${shapeOpts()}</select></label>
      <label>Posisi X (%)<input type="range" data-mk="x" min="-100" max="100" step="1"></label>
      <label>Posisi Y (%)<input type="range" data-mk="y" min="-100" max="100" step="1"></label>
      <label>Lebar (%)<input type="range" data-mk="w" min="1" max="200" step="1"></label>
      <label>Tinggi (%)<input type="range" data-mk="h" min="1" max="200" step="1"></label>
      <label>Tepi lembut (%)<input type="range" data-mk="feather" min="0" max="100" step="1"></label></div>`:'';
    const txt=type==='text'?`<h3 class="kf-title">Teks</h3>
      <label>Isi teks<textarea data-tx="content" rows="3"></textarea></label>
      <label>Font<select data-tx="font">${T.FONTS.map(f=>`<option value="${esc(f[1])}">${f[0]}</option>`).join('')}</select></label>
      <label>Ukuran (px)<input type="number" data-tx="size" min="8" max="1000" step="1"></label>
      <div class="tx-row"><label><input type="checkbox" data-tx="bold">Tebal</label><label><input type="checkbox" data-tx="italic">Miring</label></div>
      <label>Rata teks<select data-tx="align"><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>
      <label>Warna teks<input type="color" data-tx="color"></label>
      <label>Warna outline<input type="color" data-tx="stroke"></label>
      <label>Tebal outline (px)<input type="number" data-tx="strokeW" min="0" max="100" step="1"></label>
      <div class="tx-row"><label><input type="checkbox" data-tx="bgOn">Latar belakang</label></div>
      <label>Warna latar<input type="color" data-tx="bg"></label>${gs('tx','color2')}`:'';
    const shp=type==='shape'?`<h3 class="kf-title">Bentuk</h3>
      <label>Jenis bentuk<select data-sh="type">${shapeOpts()}</select></label>
      <label>Lebar (px)<input type="number" data-sh="w" min="1" max="5000" step="1"></label>
      <label>Tinggi (px)<input type="number" data-sh="h" min="1" max="5000" step="1"></label>
      <label>Sudut membulat (px)<input type="number" data-sh="radius" min="0" max="2500" step="1"></label>
      <div class="tx-row"><label><input type="checkbox" data-sh="fillOn">Isi warna</label></div>
      <label>Warna isi<input type="color" data-sh="fill"></label>
      <label>Warna garis<input type="color" data-sh="stroke"></label>
      <label>Tebal garis (px)<input type="number" data-sh="strokeW" min="0" max="200" step="1"></label>${gs('sh','fill2')}`:'';
    const name=type==='text'?(s.c.stk?'Stiker':'Klip teks'):type==='shape'?'Klip bentuk':(s.m?s.m.name:'(media hilang)');
    panel.innerHTML=`<h3>Properti</h3><div class="pr-name" title="${esc(name)}">${esc(name)}</div>${locked?'<p class="lock-note">Layer ini terkunci. Klik ikon gembok di timeline untuk membuka kunci.</p>':''}
      <fieldset${locked?' disabled':''}>
      <label>Waktu mulai (detik)<input type="number" data-t="start" min="0" step="0.01"></label>
      <label>Durasi (detik)<input type="number" data-t="dur" min="0.1" step="0.01"></label>
      <label>Waktu selesai (detik)<input type="number" data-end readonly></label>${speed}${rev}${aud}${txt}${shp}${vis}${chroma}${mask}
      <h3 class="kf-title">Keyframe animasi</h3>
      <div class="kf-bar"><button type="button" class="btn" data-kfall="add" title="Keyframe semua properti di playhead (K)">◆ Semua</button><button type="button" class="btn" data-kfall="del" title="Hapus keyframe di playhead">Hapus di playhead</button><button type="button" class="btn" data-kfall="clear" title="Hapus semua animasi clip ini">Reset</button></div>
      <p class="kf-hint adv">Grafik kurva kecepatan ada di tab Media, di bawah daftar media.</p>
      <p class="kf-hint">Klik ◇ di samping properti untuk membuat keyframe di posisi playhead. Setelah properti beranimasi, mengubah nilainya otomatis membuat keyframe. Geser penanda kuning di clip untuk memindah waktunya. Pintasan: K (keyframe semua), [ dan ] (loncat keyframe).</p>${rows}</fieldset>`;
  }
  const gx=(cv,x)=>GPAD+x*(cv.width-GPAD*2),gy=(cv,y)=>GPAD+(1-(y+0.5)/2)*(cv.height-GPAD*2);
  const gix=(cv,px)=>(px-GPAD)/(cv.width-GPAD*2),giy=(cv,py)=>(1-(py-GPAD)/(cv.height-GPAD*2))*2-0.5;
  function drawGraph(s){
    const cv=$('kf-graph');if(!cv)return;
    const g=cv.getContext('2d'),K=APK.kf,ez=s&&K.easeAt(s.c,rel(s)),w=cv.width,h=cv.height;
    g.clearRect(0,0,w,h);
    g.strokeStyle='#2c313c';g.lineWidth=1;
    g.strokeRect(gx(cv,0),gy(cv,1),gx(cv,1)-gx(cv,0),gy(cv,0)-gy(cv,1));
    if(!ez){g.fillStyle='#8b93a3';g.font='12px system-ui,sans-serif';g.textAlign='center';g.fillText(s?'Taruh playhead tepat di keyframe':'Pilih clip di timeline',w/2,h/2);return}
    const f=K.easeFn(ez);
    g.strokeStyle='#7f8cff';g.lineWidth=2;g.beginPath();
    for(let i=0;i<=60;i++){const x=i/60,y=f(x);i?g.lineTo(gx(cv,x),gy(cv,y)):g.moveTo(gx(cv,x),gy(cv,y))}
    g.stroke();
    const bz=K.bezOf(ez);
    if(bz){
      g.strokeStyle='#8b93a3';g.lineWidth=1;g.beginPath();
      g.moveTo(gx(cv,0),gy(cv,0));g.lineTo(gx(cv,bz[0]),gy(cv,bz[1]));
      g.moveTo(gx(cv,1),gy(cv,1));g.lineTo(gx(cv,bz[2]),gy(cv,bz[3]));g.stroke();
      g.fillStyle='#fff';
      for(const[x,y] of [[bz[0],bz[1]],[bz[2],bz[3]]]){g.beginPath();g.arc(gx(cv,x),gy(cv,y),6,0,Math.PI*2);g.fill()}
    }
  }
  function fill(s,force){
    const c=s.c,K=APK.kf,r=rel(s),pr=K.props(c,r);
    panel.querySelectorAll('input,textarea,select').forEach(el=>{
      if(!force&&document.activeElement===el)return;
      const d=el.dataset;
      if(d.p){const f=F.find(f=>f[0]===d.p);el.value=rnd(pr[f[0]]*f[4])}
      else if(d.t)el.value=rnd(d.t==='start'?c.start:c.dur);
      else if('end' in d)el.value=rnd(c.start+c.dur);
      else if(d.sp)el.value=rnd((c.speed||1)*100);
      else if(d.cp){
        const v=c[d.cp];
        if(el.type==='checkbox')el.checked=!!v;
        else if(el.type==='number')el.value=rnd(v||0);
        else el.value=v||'source-over';
      }else{
        const g=GK.find(k=>k in d);
        if(g){
          const v=Object.assign({},DG[g](),c[GROUP[g]]||{})[d[g]];
          if(el.type==='checkbox')el.checked=!!v;else el.value=v;
        }
      }
    });
    panel.querySelectorAll('.kf-d').forEach(b=>{
      const p=b.dataset.kf,on=K.hasKey(c,p,r);
      b.textContent=on?'◆':'◇';b.classList.toggle('on',on);b.classList.toggle('anim',K.animated(c,p));
    });
    const se=$('kf-ease');
    if(se&&document.activeElement!==se){const ez=K.easeAt(c,r);se.disabled=!ez;se.value=ez?(String(ez).indexOf('bz:')===0?'custom':ez):'inout'}
    drawGraph(s);
  }
  function refresh(force){
    const s=APK.timeline.selectedClip();
    if(!s){
      if(shown!==null){panel.innerHTML='<h3>Properti</h3><p class="empty">Pilih clip di timeline untuk melihat properti dan keyframe animasi.</p>';shown=null}
      const se=$('kf-ease');if(se)se.disabled=true;
      drawGraph(null);return;
    }
    const k=keyOf(s);
    if(shown!==k){build(s);shown=k}
    fill(s,force);
  }
  /* dipanggil tiap frame preview: nilai properti beranimasi ikut playhead */
  function tick(){
    if(shown===null)return;
    const s=APK.timeline.selectedClip();
    if(!s||keyOf(s)!==shown||!APK.kf.animated(s.c))return;
    fill(s,false);
  }
  function addAll(){
    const s=APK.timeline.selectedClip();if(!s||s.tr.locked)return;
    const K=APK.kf,r=rel(s),list=typeOf(s)==='audio'?['volume']:K.VISUAL;
    APK.history.record();
    list.forEach(p=>K.setKey(s.c,p,r,K.value(s.c,p,r)));
    APK.timeline.commit();
  }
  function jump(dir,p){
    const s=APK.timeline.selectedClip();if(!s)return;
    const t=APK.kf.step(s.c,rel(s),dir,p);
    if(t!=null)APK.preview.seek(s.c.start+t);
  }

  panel.addEventListener('input',e=>{
    const el=e.target,s=APK.timeline.selectedClip(),d=el.dataset;if(!s||s.tr.locked)return;
    const g=GK.find(k=>k in d);
    if(g||d.cp){
      const num=el.type==='number'||el.type==='range';
      let v=el.type==='checkbox'?el.checked:num?parseFloat(el.value):el.value;
      if(num){
        if(!isFinite(v))return;
        const lo=el.min!==''?+el.min:-Infinity,hi=el.max!==''?+el.max:Infinity;
        v=Math.min(hi,Math.max(lo,v));
      }
      if(g==='tx'&&!s.c.text)return;
      if(g==='sh'&&!s.c.shape)return;
      if(!editing){APK.history.record();editing=true}
      if(g){
        const key=GROUP[g];
        if(!s.c[key])s.c[key]=Object.assign({},DG[g]());
        s.c[key][d[g]]=v;
      }else s.c[d.cp]=v;
      APK.timeline.touch();return;
    }
    const v=parseFloat(el.value);if(!isFinite(v))return;
    if(!editing){APK.history.record();editing=true}
    if(d.sp){
      if(!spanRef)spanRef=s.c.dur*(s.c.speed||1);
      APK.timeline.setSpeed(v/100,spanRef);fill(s,false);return;
    }
    if(d.p){
      const f=F.find(f=>f[0]===d.p),K=APK.kf,val=Math.min(f[3],Math.max(f[2],v))/f[4];
      s.c.props=Object.assign({},DEF,s.c.props);
      const A=APK.autokey;
      if(A&&A.recording&&K.VISUAL.includes(f[0])){
        /* mode kurva otomatis merekam: mengubah slider langsung membuat keyframe di playhead */
        if(A.key(s.c,f[0],rel(s),val))APK.timeline.render();
      }else if(K.animated(s.c,f[0])){
        if(K.setKey(s.c,f[0],rel(s),val))APK.timeline.render();
      }else s.c.props[f[0]]=val;
      fill(s,false);APK.timeline.touch();
    }else if(d.t){APK.timeline.setTiming(d.t,v)}
  });
  panel.addEventListener('change',e=>{
    editing=false;spanRef=0;
    const d=e.target.dataset;
    if(d.tx==='content'||d.sh==='type')APK.timeline.render();
    refresh(true);
  });
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button'),s=APK.timeline.selectedClip();
    if(!b||!s||s.tr.locked)return;
    const K=APK.kf,c=s.c,r=rel(s);
    if(b.dataset.kf){
      const p=b.dataset.kf;APK.history.record();
      if(K.hasKey(c,p,r))K.delKey(c,p,r);else K.setKey(c,p,r,K.value(c,p,r));
      APK.timeline.commit();
    }else if(b.dataset.kfgo){jump(+b.dataset.kfgo,b.dataset.kp)}
    else if(b.dataset.kfall==='add')addAll();
    else if(b.dataset.kfall==='del'){APK.history.record();K.delAt(c,r);APK.timeline.commit()}
    else if(b.dataset.kfall==='clear'){if(!K.animated(c))return;APK.history.record();K.clear(c,r);APK.timeline.commit()}
    else if(b.dataset.pick&&window.EyeDropper){
      new EyeDropper().open().then(res=>{
        const sc=APK.timeline.selectedClip();if(!sc)return;
        APK.history.record();
        sc.c.chroma=Object.assign({},APK.fx.DEF.chroma,sc.c.chroma,{color:res.sRGBHex,on:true});
        APK.timeline.touch();refresh(true);
      }).catch(()=>{});
    }
  });
  /* ===== dock kurva (di bawah daftar Media): pilihan jenis kurva + editor grafik bezier ===== */
  const dockSel=$('kf-ease');
  if(dockSel)dockSel.innerHTML=Object.keys(APK.kf.EASE).map(k=>`<option value="${k}">${APK.kf.EASE[k].l}</option>`).join('')+'<option value="custom">Kustom (grafik bezier)</option>';
  dock.addEventListener('change',e=>{
    if(e.target.id!=='kf-ease')return;
    const s=APK.timeline.selectedClip();
    if(s&&!s.tr.locked){
      const K=APK.kf,r=rel(s);let v=e.target.value;
      APK.history.record();
      if(v==='custom')v=K.fmtBz(K.bezOf(K.easeAt(s.c,r))||[.45,0,.55,1]);
      K.setEase(s.c,r,v);APK.timeline.commit();
    }
  });
  /* editor grafik kurva bezier */
  dock.addEventListener('pointerdown',e=>{
    if(e.target.id!=='kf-graph')return;
    const s=APK.timeline.selectedClip();if(!s||s.tr.locked)return;
    const K=APK.kf,ez=K.easeAt(s.c,rel(s)),bz=ez&&K.bezOf(ez);if(!bz)return;
    const cv=e.target,r=cv.getBoundingClientRect(),k=cv.width/r.width,px=(e.clientX-r.left)*k,py=(e.clientY-r.top)*k;
    let bi=-1,bd=18;
    [[bz[0],bz[1]],[bz[2],bz[3]]].forEach((p,i)=>{const dd=Math.hypot(gx(cv,p[0])-px,gy(cv,p[1])-py);if(dd<bd){bd=dd;bi=i}});
    if(bi<0)return;
    gd={i:bi,bz:bz.slice(),moved:false};
    cv.setPointerCapture(e.pointerId);e.preventDefault();
  });
  dock.addEventListener('pointermove',e=>{
    if(!gd)return;
    const s=APK.timeline.selectedClip(),cv=$('kf-graph');if(!s||!cv){gd=null;return}
    const r=cv.getBoundingClientRect(),k=cv.width/r.width,px=(e.clientX-r.left)*k,py=(e.clientY-r.top)*k;
    gd.bz[gd.i*2]=Math.min(1,Math.max(0,gix(cv,px)));
    gd.bz[gd.i*2+1]=Math.min(1.5,Math.max(-0.5,giy(cv,py)));
    if(!gd.moved){APK.history.record();gd.moved=true}
    APK.kf.setEase(s.c,rel(s),APK.kf.fmtBz(gd.bz));
    APK.timeline.touch();drawGraph(s);
  });
  const gend=()=>{if(!gd)return;gd=null;refresh(true)};
  dock.addEventListener('pointerup',gend);dock.addEventListener('pointercancel',gend);
  return{refresh,tick,addAll,jump};
})();
