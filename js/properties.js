/* Panel properti clip: perubahan langsung terlihat di preview; mendukung keyframe animasi */
window.APK=window.APK||{};
APK.properties=(function(){
  const $=id=>document.getElementById(id),panel=$('panel-props');
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  /* key, label, min, max, pengali tampilan, berlaku untuk */
  const F=[['volume','Volume (%)',0,100,100,'audio video'],['x','Posisi X (px)',-5000,5000,1,'video image'],['y','Posisi Y (px)',-5000,5000,1,'video image'],
    ['scale','Scale (%)',1,500,100,'video image'],['opacity','Opacity (%)',0,100,100,'video image'],['rotation','Rotasi (°)',-360,360,1,'video image']];
  let shown=null,editing=false;
  const rnd=v=>Math.round(v*100)/100;
  /* waktu relatif terhadap awal clip, dijepit ke dalam clip */
  const rel=s=>Math.min(Math.max(APK.preview.time-s.c.start,0),s.c.dur);

  function build(s){
    const type=s.m?s.m.type:'video',K=APK.kf;
    const rows=F.filter(f=>f[5].includes(type)).map(f=>`<div class="pr-f"><div class="pr-lab"><span>${f[1]}</span><span class="kf-ctl"><button type="button" data-kfgo="-1" data-kp="${f[0]}" title="Keyframe sebelumnya">◀</button><button type="button" class="kf-d" data-kf="${f[0]}" title="Tambah/hapus keyframe di playhead">◇</button><button type="button" data-kfgo="1" data-kp="${f[0]}" title="Keyframe berikutnya">▶</button></span></div><div class="pr-row"><input type="range" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"><input type="number" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"></div></div>`).join('');
    const opts=Object.keys(K.EASE).map(k=>`<option value="${k}">${K.EASE[k].l}</option>`).join('');
    panel.innerHTML=`<h3>Properti</h3><div class="pr-name" title="${esc(s.m?s.m.name:'')}">${esc(s.m?s.m.name:'(media hilang)')}</div>
      <label>Waktu mulai (detik)<input type="number" data-t="start" min="0" step="0.01"></label>
      <label>Durasi (detik)<input type="number" data-t="dur" min="0.1" step="0.01"></label>
      <label>Waktu selesai (detik)<input type="number" data-end readonly></label>
      <h3 class="kf-title">Keyframe animasi</h3>
      <div class="kf-bar"><button type="button" class="btn" data-kfall="add" title="Keyframe semua properti di playhead (K)">◆ Semua</button><button type="button" class="btn" data-kfall="del" title="Hapus keyframe di playhead">Hapus di playhead</button><button type="button" class="btn" data-kfall="clear" title="Hapus semua animasi clip ini">Reset</button></div>
      <label>Kurva animasi (keyframe di playhead)<select id="kf-ease" disabled>${opts}</select></label>
      <p class="kf-hint">Klik ◇ di samping properti untuk membuat keyframe di posisi playhead. Setelah properti beranimasi, mengubah nilainya otomatis membuat keyframe. Geser penanda kuning di clip untuk memindah waktunya. Pintasan: K (keyframe semua), [ dan ] (loncat keyframe).</p>${rows}`;
  }
  function fill(s,force){
    const c=s.c,K=APK.kf,r=rel(s),pr=K.props(c,r);
    panel.querySelectorAll('input').forEach(el=>{
      if(!force&&document.activeElement===el)return;
      if(el.dataset.p){const f=F.find(f=>f[0]===el.dataset.p);el.value=rnd(pr[f[0]]*f[4])}
      else if(el.dataset.t)el.value=rnd(el.dataset.t==='start'?c.start:c.dur);
      else if('end' in el.dataset)el.value=rnd(c.start+c.dur);
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
    if(!s){if(shown!==null){panel.innerHTML='<h3>Properti</h3><p class="empty">Pilih clip di timeline untuk melihat properti.</p>';shown=null}return}
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
    const K=APK.kf,r=rel(s),list=s.m&&s.m.type==='audio'?['volume']:K.VISUAL;
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
    const el=e.target,s=APK.timeline.selectedClip();if(!s)return;
    const v=parseFloat(el.value);if(!isFinite(v))return;
    if(!editing){APK.history.record();editing=true}
    if(el.dataset.p){
      const f=F.find(f=>f[0]===el.dataset.p),K=APK.kf,val=Math.min(f[3],Math.max(f[2],v))/f[4];
      s.c.props=Object.assign({},DEF,s.c.props);
      if(K.animated(s.c,f[0])){
        if(K.setKey(s.c,f[0],rel(s),val))APK.timeline.render();
      }else s.c.props[f[0]]=val;
      fill(s,false);APK.timeline.touch();
    }else if(el.dataset.t){APK.timeline.setTiming(el.dataset.t,v)}
  });
  panel.addEventListener('change',e=>{
    if(e.target.id==='kf-ease'){
      const s=APK.timeline.selectedClip();
      if(s){APK.history.record();APK.kf.setEase(s.c,rel(s),e.target.value);APK.timeline.commit()}
      return;
    }
    editing=false;refresh(true);
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
  });
  return{refresh,tick,addAll,jump};
})();
