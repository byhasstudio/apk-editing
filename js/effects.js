/* Filter, efek, dan transisi per clip (tanpa keyframe; nilainya tetap selama clip tampil).
   Data di clip:
     clip.flt  = { blur, bright, contrast, sat, hue, gray, sepia, invert, vig, rgb, glitch }   (hanya nilai yang berbeda dari bawaan yang disimpan)
     clip.tin  = { type, d }   transisi masuk di awal clip     clip.tout = { type, d }   transisi keluar di akhir clip
   Filter CSS (blur, kecerahan, kontras, saturasi, rona, hitam putih, sepia, negatif) berlaku untuk semua jenis layer lewat ctx.filter.
   Vignette, pemisah RGB, dan glitch memakai piksel dan hanya untuk video dan gambar (dikerjakan di APK.fx.process).
   Transisi memodifikasi posisi, skala, rotasi, opacity, blur, atau area tampil (wipe, iris) selama d detik pertama/terakhir clip.
   Semuanya digambar lewat begin()/end() di preview, jadi ikut ter-export. */
window.APK=window.APK||{};
APK.effects=(function(){
  const $=id=>document.getElementById(id);
  const FLT=[ /* kunci, label, min, max, bawaan, hanya media */
    ['blur','Blur (px)',0,60,0,false],['bright','Kecerahan (%)',0,250,100,false],['contrast','Kontras (%)',0,250,100,false],
    ['sat','Saturasi (%)',0,300,100,false],['hue','Rona warna (°)',0,360,0,false],['gray','Hitam putih (%)',0,100,0,false],
    ['sepia','Sepia (%)',0,100,0,false],['invert','Negatif (%)',0,100,0,false],
    ['vig','Vignette (%)',0,100,0,true],['rgb','Pemisah RGB (px)',0,40,0,true],['glitch','Glitch (%)',0,100,0,true]
  ];
  const DEFF={};FLT.forEach(f=>DEFF[f[0]]=f[4]);
  const PRESETS={
    bw:['Hitam putih',{gray:100,contrast:110}],
    vintage:['Vintage',{sepia:55,contrast:110,sat:85,vig:35}],
    cine:['Sinematik',{contrast:125,sat:90,bright:95,vig:45}],
    bright:['Cerah ceria',{bright:112,contrast:108,sat:125}],
    drama:['Dramatis',{contrast:150,sat:70,bright:90,vig:30}],
    dream:['Mimpi (lembut)',{blur:2,bright:112,sat:115,vig:15}],
    glitch:['Glitch',{rgb:6,glitch:35}],
    neg:['Negatif',{invert:100}]
  };
  const TRANS=[
    ['fade','Memudar'],['slideL','Geser dari/ke kiri'],['slideR','Geser dari/ke kanan'],['slideU','Geser dari/ke atas'],['slideD','Geser dari/ke bawah'],
    ['zoomin','Zoom dari kecil'],['zoomout','Zoom dari besar'],['spin','Putar'],['blur','Blur'],
    ['wipeR','Wipe dari kiri'],['wipeL','Wipe dari kanan'],['wipeD','Wipe dari atas'],['wipeU','Wipe dari bawah'],['iris','Buka lingkaran (iris)']
  ];
  const DEFT=0.5;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const flt=c=>c&&c.flt?Object.assign({},DEFF,c.flt):null;

  /* string ctx.filter untuk clip c. K = skala kanvas terhadap project, extra = blur tambahan dari transisi (px project) */
  function css(c,K,extra){
    const f=flt(c),p=[],bl=(f?f.blur:0)+(extra||0);
    if(bl>0.05)p.push('blur('+(bl*(K||1)).toFixed(2)+'px)');
    if(f){
      if(f.bright!==100)p.push('brightness('+f.bright+'%)');
      if(f.contrast!==100)p.push('contrast('+f.contrast+'%)');
      if(f.sat!==100)p.push('saturate('+f.sat+'%)');
      if(f.hue)p.push('hue-rotate('+f.hue+'deg)');
      if(f.gray)p.push('grayscale('+f.gray+'%)');
      if(f.sepia)p.push('sepia('+f.sepia+'%)');
      if(f.invert)p.push('invert('+f.invert+'%)');
    }
    return p.join(' ');
  }

  /* modifikasi transisi untuk satu sisi. u = kemajuan 0..1 (1 = tampil penuh). Mengubah q dan menambah ke out.clips / out.blur */
  function side(spec,u,q,W,H,out){
    const e=u*u*(3-2*u),r=1-e;
    switch(spec.type){
      case 'fade':q.opacity*=e;break;
      case 'slideL':q.x-=r*W;break;
      case 'slideR':q.x+=r*W;break;
      case 'slideU':q.y-=r*H;break;
      case 'slideD':q.y+=r*H;break;
      case 'zoomin':q.scale*=0.2+0.8*e;q.opacity*=e;break;
      case 'zoomout':q.scale*=1+r*1.5;q.opacity*=e;break;
      case 'spin':q.rotation-=r*120;q.scale*=e;q.opacity*=Math.min(1,e*2);break;
      case 'blur':out.blur+=r*30;q.opacity*=0.4+0.6*e;break;
      case 'wipeR':out.clips.push({r:[0,0,W*e,H]});break;
      case 'wipeL':out.clips.push({r:[W*(1-e),0,W*e,H]});break;
      case 'wipeD':out.clips.push({r:[0,0,W,H*e]});break;
      case 'wipeU':out.clips.push({r:[0,H*(1-e),W,H*e]});break;
      case 'iris':out.clips.push({c:e*Math.hypot(W,H)/2});break;
    }
  }
  function trans(c,t,pr,W,H){
    const out={q:pr,clips:[],blur:0};
    const a=c.tin&&c.tin.type?c.tin:null,b=c.tout&&c.tout.type?c.tout:null;
    if(!a&&!b)return out;
    const q=Object.assign({},pr);out.q=q;
    if(a){const d=clamp(+a.d||DEFT,0.1,Math.max(0.1,c.dur/2)),u=(t-c.start)/d;if(u<1)side(a,clamp(u,0,1),q,W,H,out)}
    if(b){const d=clamp(+b.d||DEFT,0.1,Math.max(0.1,c.dur/2)),u=(c.start+c.dur-t)/d;if(u<1)side(b,clamp(u,0,1),q,W,H,out)}
    return out;
  }

  /* dipanggil preview sebelum menggambar sebuah layer: menyimpan state kanvas, memasang filter dan area tampil,
     lalu mengembalikan properti yang sudah dimodifikasi transisi. WAJIB dipasangkan dengan end(ctx). */
  function begin(ctx,c,t,pr,W,H,K){
    ctx.save();
    const tr=trans(c,t,pr,W,H),f=css(c,K,tr.blur);
    if('filter' in ctx)ctx.filter=f||'none';
    for(const k of tr.clips){
      ctx.beginPath();
      if(k.r)ctx.rect(k.r[0],k.r[1],Math.max(0,k.r[2]),Math.max(0,k.r[3]));else ctx.arc(W/2,H/2,Math.max(0,k.c),0,Math.PI*2);
      ctx.clip();
    }
    return tr.q;
  }
  const end=ctx=>ctx.restore();

  /* ===== antarmuka (dipasang di panel Properti oleh properties.js) ===== */
  const tOpts='<option value="">— tidak ada —</option>'+TRANS.map(t=>`<option value="${t[0]}">${t[1]}</option>`).join('');
  function html(type){
    const media=type==='video'||type==='image';
    const rows=FLT.filter(f=>media||!f[5]).map(f=>`<label>${f[1]}<input type="range" data-flt="${f[0]}" min="${f[2]}" max="${f[3]}" step="1"></label>`).join('');
    const pre='<option value="">Pilih preset filter…</option>'+Object.keys(PRESETS).map(k=>`<option value="${k}">${PRESETS[k][0]}</option>`).join('')+'<option value="none">Hapus semua filter</option>';
    return `<h3 class="kf-title">Filter &amp; efek</h3>
      <label>Preset filter<select data-flt="preset">${pre}</select></label>${rows}
      ${media?'':'<p class="kf-hint">Vignette, pemisah RGB, dan glitch hanya untuk video dan gambar.</p>'}
      <h3 class="kf-title">Transisi (di awal dan akhir clip)</h3>
      <label>Transisi masuk<select data-trn="in">${tOpts}</select></label>
      <label>Lama transisi masuk (detik)<input type="number" data-trnd="in" min="0.1" max="5" step="0.1"></label>
      <label>Transisi keluar<select data-trn="out">${tOpts}</select></label>
      <label>Lama transisi keluar (detik)<input type="number" data-trnd="out" min="0.1" max="5" step="0.1"></label>
      <p class="kf-hint">Untuk transisi antar dua clip: beri clip pertama transisi keluar dan clip kedua transisi masuk, lalu letakkan berimpit atau bertumpuk di layer berbeda.</p>`;
  }
  const owns=el=>!!el&&!!el.dataset&&(el.dataset.flt!=null||el.dataset.trn!=null||el.dataset.trnd!=null||(APK.anim&&APK.anim.owns(el)));
  function fill(el,c){
    const d=el.dataset;
    if(APK.anim&&APK.anim.owns(el)){APK.anim.fill(el,c);return}
    if(d.flt!=null){
      if(d.flt==='preset'){el.value='';return}
      const v=c.flt&&c.flt[d.flt]!=null?c.flt[d.flt]:DEFF[d.flt];el.value=v;
    }else if(d.trn!=null){const x=d.trn==='in'?c.tin:c.tout;el.value=x&&x.type||''}
    else if(d.trnd!=null){const x=d.trnd==='in'?c.tin:c.tout;el.value=(x&&+x.d)||DEFT}
  }
  const sel=()=>{const s=APK.timeline.selectedClip();return s&&!s.tr.locked?s:null};
  let editing=false;
  const panel=$('panel-props');
  if(panel){
    panel.addEventListener('input',e=>{
      const el=e.target,d=el.dataset;if(!d||d.flt==null||d.flt==='preset')return;
      const s=sel();if(!s)return;
      const v=parseFloat(el.value);if(!isFinite(v))return;
      if(!editing){APK.history.record();editing=true}
      const f=FLT.find(x=>x[0]===d.flt),c=s.c;
      c.flt=c.flt||{};
      const nv=clamp(v,f[2],f[3]);
      if(nv===f[4]){delete c.flt[d.flt];if(!Object.keys(c.flt).length)delete c.flt}else c.flt[d.flt]=nv;
      APK.timeline.touch();
    });
    panel.addEventListener('change',e=>{
      const el=e.target,d=el.dataset;if(!d)return;
      editing=false;
      if(d.flt==='preset'){
        const s=sel();if(!s||!el.value)return;
        APK.history.record();
        const c=s.c;
        if(el.value==='none')delete c.flt;
        else{
          const media=!(c.text||c.shape);
          c.flt={};
          for(const k in PRESETS[el.value][1]){
            const spec=FLT.find(x=>x[0]===k);
            if(spec&&spec[5]&&!media)continue;
            c.flt[k]=PRESETS[el.value][1][k];
          }
          if(!Object.keys(c.flt).length)delete c.flt;
        }
        el.value='';APK.timeline.commit();return;
      }
      if(d.trn!=null){
        const s=sel();if(!s)return;
        APK.history.record();
        const key=d.trn==='in'?'tin':'tout',c=s.c;
        if(!el.value)delete c[key];else c[key]={type:el.value,d:(c[key]&&c[key].d)||DEFT};
        APK.timeline.commit();return;
      }
      if(d.trnd!=null){
        const s=sel();if(!s)return;
        const key=d.trnd==='in'?'tin':'tout',c=s.c,v=parseFloat(el.value);
        if(!c[key]||!isFinite(v))return;
        APK.history.record();
        c[key]={type:c[key].type,d:clamp(v,0.1,5)};
        APK.timeline.commit();
      }
    });
  }
  return{FLT,PRESETS,TRANS,css,trans,begin,end,html,fill,owns};
})();
