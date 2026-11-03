/* Panel properti clip: perubahan langsung terlihat di preview */
window.APK=window.APK||{};
APK.properties=(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  /* key, label, min, max, pengali tampilan, berlaku untuk */
  const F=[['volume','Volume (%)',0,100,100,'audio video'],['x','Posisi X (px)',-5000,5000,1,'video image'],['y','Posisi Y (px)',-5000,5000,1,'video image'],
    ['scale','Scale (%)',1,500,100,'video image'],['opacity','Opacity (%)',0,100,100,'video image'],['rotation','Rotasi (°)',-360,360,1,'video image']];
  let shown=null,editing=false;
  const rnd=v=>Math.round(v*100)/100;

  function build(s){
    const type=s.m?s.m.type:'video';
    const rows=F.filter(f=>f[5].includes(type)).map(f=>`<label>${f[1]}<div class="pr-row"><input type="range" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"><input type="number" data-p="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"></div></label>`).join('');
    $('panel-props').innerHTML=`<h3>Properti</h3><div class="pr-name" title="${esc(s.m?s.m.name:'')}">${esc(s.m?s.m.name:'(media hilang)')}</div>
      <label>Waktu mulai (detik)<input type="number" data-t="start" min="0" step="0.01"></label>
      <label>Durasi (detik)<input type="number" data-t="dur" min="0.1" step="0.01"></label>
      <label>Waktu selesai (detik)<input type="number" data-end readonly></label>${rows}`;
  }
  function fill(s,force){
    const c=s.c,pr=Object.assign({},DEF,c.props);
    $('panel-props').querySelectorAll('input').forEach(el=>{
      if(!force&&document.activeElement===el)return;
      if(el.dataset.p){const f=F.find(f=>f[0]===el.dataset.p);el.value=rnd(pr[f[0]]*f[4])}
      else if(el.dataset.t)el.value=rnd(el.dataset.t==='start'?c.start:c.dur);
      else if('end' in el.dataset)el.value=rnd(c.start+c.dur);
    });
  }
  function refresh(force){
    const panel=$('panel-props'),s=APK.timeline.selectedClip();
    if(!s){if(shown!==null){panel.innerHTML='<h3>Properti</h3><p class="empty">Pilih clip di timeline untuk melihat properti.</p>';shown=null}return}
    if(shown!==s.c.id){build(s);shown=s.c.id}
    fill(s,force);
  }
  const panel=$('panel-props');
  panel.addEventListener('input',e=>{
    const el=e.target,s=APK.timeline.selectedClip();if(!s)return;
    const v=parseFloat(el.value);if(!isFinite(v))return;
    if(!editing){APK.history.record();editing=true}
    if(el.dataset.p){
      const f=F.find(f=>f[0]===el.dataset.p);
      s.c.props=Object.assign({},DEF,s.c.props);
      s.c.props[f[0]]=Math.min(f[3],Math.max(f[2],v))/f[4];
      fill(s,false);APK.timeline.touch();
    }else if(el.dataset.t){APK.timeline.setTiming(el.dataset.t,v)}
  });
  panel.addEventListener('change',()=>{editing=false;refresh(true)});
  return{refresh};
})();
