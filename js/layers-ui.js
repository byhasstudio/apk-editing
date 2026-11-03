/* UI parent (induk), layer grup, dan motion path. Ditempel ke panel properti dan toolbar timeline lewat pembungkus,
   jadi modul properties.js dan timeline.js tidak perlu diubah. */
(function(){
  const $=id=>document.getElementById(id),T=APK.timeline,L=APK.layers,K=APK.kf,panel=$('panel-props');
  const P=()=>APK.project.current;
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2600)}
  const find=id=>{for(const tr of P().tracks){const c=tr.clips.find(x=>x.id===id);if(c)return{tr,c}}return null};

  /* nama untuk bentuk 'group' */
  const oldLabel=APK.shapes.label;
  APK.shapes.label=t=>t==='group'?'Grup (layer kosong)':oldLabel(t);
  const label=x=>{
    const m=P().media.find(m=>m.id===x.mediaId);
    const n=m?m.name:x.shape?(x.shape.type==='group'?'▣ Grup':'◆ '+APK.shapes.label(x.shape.type)):x.text?(x.stk?'☺ ':'T ')+String(x.text.content).split('\n')[0].slice(0,24):'(clip)';
    return n+' · '+x.start.toFixed(1)+'s';
  };

  /* tombol Grup: layer kosong yang dipakai sebagai induk untuk menggerakkan banyak layer sekaligus */
  $('tl-group').onclick=()=>{
    if(!P())return;
    T.addShape('group');
    const s=T.selectedClip();
    if(s&&s.c.shape){Object.assign(s.c.shape,{fillOn:false,strokeW:0,shadowOn:false,w:400,h:400});T.commit()}
    toast('Layer grup dibuat. Pilih clip lain, lalu atur "Induk" ke grup ini');
  };

  /* duplikat dan split membuat salinan clip: jalur gerak salinan harus terpisah dari aslinya */
  function unshare(){
    for(const id of T.selectedIds()){
      const f=find(id);
      if(f&&f.c.mp)f.c.mp=Object.assign({},f.c.mp,{pts:f.c.mp.pts.map(p=>p.slice())});
    }
  }
  for(const n of ['duplicate','split']){const o=T[n];T[n]=function(){o.apply(this,arguments);unshare()}}
  $('tl-split').onclick=()=>T.split();
  $('tl-dup').onclick=()=>T.duplicate();

  const HTML=`<h3 class="kf-title">Induk (parent)</h3>
    <label title="Clip ini ikut bergerak, membesar, dan berputar bersama induknya">Ikuti layer induk<select id="ex-parent"></select></label>
    <p class="kf-hint">Buat layer kosong lewat tombol Grup, lalu jadikan induk beberapa clip untuk menggerakkan semuanya sekaligus.</p>
    <div class="adv"><h3 class="kf-title">Jalur gerak (motion path)</h3>
    <div class="tx-row"><label title="Objek bergerak mengikuti jalur selama durasi clip"><input type="checkbox" id="mp-on">Aktifkan jalur gerak</label></div>
    <div id="mp-opts">
      <label>Kecepatan gerak<select id="mp-ease"></select></label>
      <div class="tx-row"><label><input type="checkbox" id="mp-smooth">Jalur melengkung</label><label><input type="checkbox" id="mp-orient">Hadap arah gerak</label></div>
      <div class="kf-bar"><button type="button" class="btn" id="mp-add" title="Tambah titik di ujung jalur">+ Titik</button><button type="button" class="btn" id="mp-del" title="Hapus titik terakhir">− Titik</button></div>
      <p class="kf-hint">Seret titik hijau (awal), putih, dan merah (akhir) di preview untuk membentuk jalur. Posisi X/Y clip tetap dipakai sebagai geseran jalur.</p>
    </div></div>`;

  function parentOptions(c,cur){
    L.begin();
    const out=['<option value="">(tidak ada)</option>'];
    for(const tr of P().tracks){
      if(tr.kind==='audio')continue;
      for(const x of tr.clips){
        if(x.id===c.id||L.isDescendant(x,c.id))continue;
        out.push(`<option value="${x.id}"${x.id===cur?' selected':''}>${esc(label(x))}</option>`);
      }
    }
    return out.join('');
  }
  function ext(){
    const s=T.selectedClip(),old=$('ext-props');
    if(!s||s.tr.kind==='audio'){if(old)old.remove();return}
    const fs=panel.querySelector('fieldset');if(!fs)return;
    let box=old;
    if(!box||box.dataset.cid!==s.c.id||!fs.contains(box)){
      if(old)old.remove();
      box=document.createElement('div');box.id='ext-props';box.dataset.cid=s.c.id;box.innerHTML=HTML;fs.appendChild(box);
      $('mp-ease').innerHTML=Object.keys(K.EASE).map(k=>`<option value="${k}">${K.EASE[k].l}</option>`).join('');
    }
    const c=s.c,mp=c.mp||{},par=$('ex-parent');
    if(document.activeElement!==par){
      const html=parentOptions(c,c.parent||'');
      if(par.dataset.sig!==html){par.innerHTML=html;par.dataset.sig=html}
      par.value=c.parent&&par.querySelector(`option[value="${c.parent}"]`)?c.parent:'';
    }
    $('mp-on').checked=!!mp.on;$('mp-opts').hidden=!mp.on;
    if(document.activeElement!==$('mp-ease'))$('mp-ease').value=mp.ease||'inout';
    $('mp-smooth').checked=mp.smooth!==false;$('mp-orient').checked=!!mp.orient;
  }
  const oldRefresh=APK.properties.refresh;
  APK.properties.refresh=function(f){oldRefresh(f);ext()};

  /* ganti induk tanpa membuat clip melompat: posisi, scale, dan rotasi lokal dihitung ulang (hanya jika tidak beranimasi) */
  function setParent(c,newId){
    const t=APK.preview.time,anim=['x','y','scale','rotation'].some(p=>K.animated(c,p)),mpOn=!!(c.mp&&c.mp.on);
    L.begin();
    const W=!anim&&!mpOn?L.props(c,t):null;
    if(newId)c.parent=newId;else delete c.parent;
    if(W){
      const pp=newId?L.frame(c,t):null;
      c.props=Object.assign({},DEF,c.props);
      if(pp){
        const s=Math.abs(pp.scale)<1e-3?1e-3:pp.scale,a=-pp.rotation*Math.PI/180,dx=W.x-pp.x,dy=W.y-pp.y;
        c.props.x=Math.round((dx*Math.cos(a)-dy*Math.sin(a))/s*10)/10;
        c.props.y=Math.round((dx*Math.sin(a)+dy*Math.cos(a))/s*10)/10;
        c.props.scale=W.scale/s;c.props.rotation=W.rotation-pp.rotation;
      }else{
        c.props.x=Math.round(W.x*10)/10;c.props.y=Math.round(W.y*10)/10;c.props.scale=W.scale;c.props.rotation=W.rotation;
      }
    }else toast('Clip ini beranimasi atau memakai jalur gerak, jadi posisinya bisa bergeser. Atur ulang bila perlu');
  }

  const editable=()=>{const s=T.selectedClip();return s&&!s.tr.locked&&s.tr.kind!=='audio'?s:null};
  panel.addEventListener('change',e=>{
    const id=e.target.id;
    if(!/^(ex-parent|mp-)/.test(id))return;
    const s=editable();if(!s)return;
    const c=s.c;
    APK.history.record();
    if(id==='ex-parent')setParent(c,e.target.value);
    else if(id==='mp-on'){
      if(e.target.checked){
        if(!c.mp)c.mp={pts:[[0,0],[200,-120],[400,0]],smooth:true,ease:'inout',orient:false};
        c.mp.on=true;
      }else if(c.mp)c.mp.on=false;
    }else if(c.mp){
      if(id==='mp-ease')c.mp.ease=e.target.value;
      else if(id==='mp-smooth')c.mp.smooth=e.target.checked;
      else if(id==='mp-orient')c.mp.orient=e.target.checked;
    }
    T.commit();
  });
  panel.addEventListener('click',e=>{
    const b=e.target.closest('#mp-add,#mp-del');if(!b)return;
    const s=editable();if(!s||!s.c.mp||!s.c.mp.pts)return;
    const pts=s.c.mp.pts;
    if(b.id==='mp-add'){
      APK.history.record();
      const l=pts[pts.length-1];pts.push([l[0]+150,l[1]+(pts.length%2?-90:90)]);
    }else{
      if(pts.length<=2){toast('Jalur minimal punya 2 titik');return}
      APK.history.record();pts.pop();
    }
    T.commit();
  });
})();
