/* Panel properti clip: keyframe animasi, kecepatan, putar mundur, blend, flip, teks, bentuk, chroma key, mask, dan fade audio */
window.APK=window.APK||{};
APK.properties=(function(){
  const $=id=>document.getElementById(id),panel=$('panel-props');
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  /* key, label, min, max, pengali tampilan, berlaku untuk */
  const F=[['volume','Volume (%)',0,100,100,'audio video'],['x','Posisi X (px)',-5000,5000,1,'video image text shape'],['y','Posisi Y (px)',-5000,5000,1,'video image text shape'],
    ['scale','Scale (%)',1,500,100,'video image text shape'],['opacity','Opacity (%)',0,100,100,'video image text shape'],['rotation','Rotasi (°)',-360,360,1,'video image text shape']];
  const BLEND=[['source-over','Normal'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],['color-dodge','Color Dodge'],['color-burn','Color Burn'],['hard-light','Hard Light'],['soft-light','Soft Light'],['difference','Difference'],['exclusion','Exclusion'],['lighter','Tambah (Add)']];
  /* atribut data-xx pada kontrol -> properti objek di clip, dan nilai bawaannya */
  const GROUP={tx:'text',sh:'shape',ck:'chroma',mk:'mask'},GK=Object.keys(GROUP);
  const DG={tx:()=>APK.text.DEF,sh:()=>APK.shapes.DEF,ck:()=>APK.fx.DEF.chroma,mk:()=>APK.fx.DEF.mask};
  let shown=null,editing=false,spanRef=0;
  const rnd=v=>Math.round(v*100)/100;
  const rel=s=>Math.min(Math.max(APK.preview.time-s.c.start,0),s.c.dur);
  const typeOf=s=>s.c.text?'text':s.c.shape?'shape':(s.tr&&s.tr.kind==='audio'?'audio':(s.m?s.m.type:'video'));
  const shapeOpts=()=>APK.shapes.TYPES.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');

  function build(s){
    const type=typeOf(s),K=APK.kf,T=APK.text;
    const rows=F.filter(f=>f[5].includes(type)).map(f=>`<div class="pr-f"><div class="pr-lab"><span>${f[1]}</span><span class="kf-ctl"><button type="button" data-kfgo="-1" data-kp="${f[0]}" title="Keyframe sebelumnya">◀</button><button type="button" class="kf-d" data-kf="${f[0]}" title="Tambah/hapus keyframe di playhead">◇</button><button type="button" data-kfgo="1" data-kp="${f[0]}" title="Keyframe berikutnya">▶</button></span></div><div class="pr-row"><input type="range" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"><input type="number" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"></div></div>`).join('');
    const opts=Object.keys(K.EASE).map(k=>`<option value="${k}">${K.EASE[k].l}</option>`).join('');
    const speed=type==='video'||type==='audio'?`<label>Kecepatan (%)<input type="number" data-sp="1" min="10" max="800" step="5"></label>`:'';
    const rev=type==='video'?`<div class="tx-row"><label><input type="checkbox" data-cp="reverse">Putar mundur (audio dibisukan)</label></div>`:'';
    const aud=type==='video'||type==='audio'?`<h3 class="kf-title">Audio</h3>
      <label>Fade in (detik)<input type="number" data-cp="fadeIn" min="0" step="0.1"></label>
      <label>Fade out (detik)<input type="number" data-cp="fadeOut" min="0" step="0.1"></label>
      <div class="tx-row"><label><input type="checkbox" data-cp="mute">Bisukan clip ini</label></div>`:'';
    const vis=type!=='audio'?`<h3 class="kf-title">Tampilan</h3>
      <label>Mode blend<select data-cp="blend">${BLEND.map(b=>`<option value="${b[0]}">${b[1]}</option>`).join('')}</select></label>
      <div class="tx-row"><label><input type="checkbox" data-cp="flipX">Balik horizontal</label><label><input type="checkbox" data-cp="flipY">Balik vertikal</label></div>`:'';
    const media=type==='video'||type==='image';
    const chroma=media?`<h3 class="kf-title">Chroma key (hapus warna latar)</h3>
      <div class="tx-row"><label><input type="checkbox" data-ck="on">Aktifkan</label></div>
      <label>Warna latar<input type="color" data-ck="color"></label>
      ${window.EyeDropper?'<button type="button" class="btn" data-pick="1" style="margin-top:8px">Ambil warna dari preview</button>':''}
      <label>Toleransi (%)<input type="range" data-ck="sim" min="0" max="100" step="1"></label>
      <label>Kehalusan tepi (%)<input type="range" data-ck="smooth" min="0" max="100" step="1"></label>`:'';
    const mask=media?`<h3 class="kf-title">Mask (potong bentuk)</h3>
      <div class="tx-row"><label><input type="checkbox" data-mk="on">Aktifkan</label><label><input type="checkbox" data-mk="invert">Balik mask</label></div>
      <label>Bentuk mask<select data-mk="type">${shapeOpts()}</select></label>
      <label>Posisi X (%)<input type="range" data-mk="x" min="-100" max="100" step="1"></label>
      <label>Posisi Y (%)<input type="range" data-mk="y" min="-100" max="100" step="1"></label>
      <label>Lebar (%)<input type="range" data-mk="w" min="1" max="200" step="1"></label>
      <label>Tinggi (%)<input type="range" data-mk="h" min="1" max="200" step="1"></label>
      <label>Tepi lembut (%)<input type="range" data-mk="feather" min="0" max="100" step="1"></label>`:'';
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
      <label>Warna latar<input type="color" data-tx="bg"></label>`:'';
    const shp=type==='shape'?`<h3 class="kf-title">Bentuk</h3>
      <label>Jenis bentuk<select data-sh="type">${shapeOpts()}</select></label>
      <label>Lebar (px)<input type="number" data-sh="w" min="1" max="5000" step="1"></label>
      <label>Tinggi (px)<input type="number" data-sh="h" min="1" max="5000" step="1"></label>
      <label>Sudut membulat (px)<input type="number" data-sh="radius" min="0" max="2500" step="1"></label>
      <div class="tx-row"><label><input type="checkbox" data-sh="fillOn">Isi warna</label></div>
      <label>Warna isi<input type="color" data-sh="fill"></label>
      <label>Warna garis<input type="color" data-sh="stroke"></label>
      <label>Tebal garis (px)<input type="number" data-sh="strokeW" min="0" max="200" step="1"></label>`:'';
    const name=type==='text'?(s.c.stk?'Stiker':'Klip teks'):type==='shape'?'Klip bentuk':(s.m?s.m.name:'(media hilang)');
    panel.innerHTML=`<h3>Properti</h3><div class="pr-name" title="${esc(name)}">${esc(name)}</div>
      <label>Waktu mulai (detik)<input type="number" data-t="start" min="0" step="0.01"></label>
      <label>Durasi (detik)<input type="number" data-t="dur" min="0.1" step="0.01"></label>
      <label>Waktu selesai (detik)<input type="number" data-end readonly></label>${speed}${rev}${aud}${txt}${shp}${vis}${chroma}${mask}
      <h3 class="kf-title">Keyframe animasi</h3>
      <div class="kf-bar"><button type="button" class="btn" data-kfall="add" title="Keyframe semua properti di playhead (K)">◆ Semua</button><button type="button" class="btn" data-kfall="del" title="Hapus keyframe di playhead">Hapus di playhead</button><button type="button" class="btn" data-kfall="clear" title="Hapus semua animasi clip ini">Reset</button></div>
      <label>Kurva animasi (keyframe di playhead)<select id="kf-ease" disabled>${opts}</select></label>
      <p class="kf-hint">Klik ◇ di samping properti untuk membuat keyframe di posisi playhead. Setelah properti beranimasi, mengubah nilainya otomatis membuat keyframe. Geser penanda kuning di clip untuk memindah waktunya. Pintasan: K (keyframe semua), [ dan ] (loncat keyframe).</p>${rows}`;
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
    if(se&&document.activeElement!==se){const ez=K.easeAt(c,r);se.disabled=!ez;se.value=ez||'inout'}
  }
  function refresh(force){
    const s=APK.timeline.selectedClip();
    if(!s){if(shown!==null){panel.innerHTML='<h3>Properti</h3><p class="empty">Pilih clip di timeline untuk melihat properti dan keyframe animasi.</p>';shown=null}return}
    if(shown!==s.c.id){build(s);shown=s.c.id}
    fill(s,force);
  }
  /* dipanggil tiap frame preview: nilai properti beranimasi ikut playhead */
  function tick(){
    if(shown===null)return;
    const s=APK.timeline.selectedClip();
    if(!s||s.c.id!==shown||!APK.kf.animated(s.c))return;
    fill(s,false);
  }
  function addAll(){
    const s=APK.timeline.selectedClip();if(!s)return;
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
    const el=e.target,s=APK.timeline.selectedClip(),d=el.dataset;if(!s)return;
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
      if(K.animated(s.c,f[0])){
        if(K.setKey(s.c,f[0],rel(s),val))APK.timeline.render();
      }else s.c.props[f[0]]=val;
      fill(s,false);APK.timeline.touch();
    }else if(d.t){APK.timeline.setTiming(d.t,v)}
  });
  panel.addEventListener('change',e=>{
    if(e.target.id==='kf-ease'){
      const s=APK.timeline.selectedClip();
      if(s){APK.history.record();APK.kf.setEase(s.c,rel(s),e.target.value);APK.timeline.commit()}
      return;
    }
    editing=false;spanRef=0;
    const d=e.target.dataset;
    if(d.tx==='content'||d.sh==='type')APK.timeline.render();
    refresh(true);
  });
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button'),s=APK.timeline.selectedClip();
    if(!b||!s)return;
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
  return{refresh,tick,addAll,jump};
})();
