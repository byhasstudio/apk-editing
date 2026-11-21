/* Crop foto dan video di editor 2D (v1).
   Data per clip: clip.crop = {l,t,r,b} = persen yang dibuang dari kiri, atas, kanan, bawah media ASLI (format sama seperti sebelumnya, project lama tetap terbuka).
   - Foto DAN video bisa di-crop. js/preview.js (cropOf) memotong media: bagian yang tersisa jadi ukuran dasar clip, jadi Scale, posisi, rotasi, efek, mask, dan export
     bekerja pada hasil crop. Crop tidak bisa di-keyframe (nilainya tetap selama clip tampil).
   - Tombol "Atur crop di preview": media tampil UTUH, bingkai crop digambar di atas gizmo (hanya di layar, tidak ikut export).
     Seret sudut atau sisi bingkai untuk mengubah ukuran, seret di dalam bingkai untuk menggeser. Selesai = tombol yang sama, Esc, Enter, atau pilih clip lain / putar preview.
   - Pilihan bentuk: Bebas (kustom), rasio siap pakai (1:1, 4:5, 5:4, 3:4, 4:3, 2:3, 3:2, 9:16, 16:9, 21:9), Layar (rasio project), dan rasio kustom (isi lebar dan tinggi).
     Memilih rasio memotong sebesar mungkin dengan pusat bingkai yang sekarang, lalu bingkai TERKUNCI ke rasio itu saat diseret sampai memilih Bebas atau menggeser slider.
   - Slider "Buang dari ..." tetap ada untuk mengatur tiap sisi dengan presisi.
   Cara pasang (tanpa mengubah properties.js dan gizmo.js): panel Properti diamati (MutationObserver) lalu bagian Crop baru dipasang menggantikan bagian Crop lama (khusus foto)
   dan ditambahkan untuk video; overlay digambar lewat pembungkus APK.gizmo.draw; sentuhan di preview saat mode crop aktif ditangkap di #preview-wrap (fase capture)
   sebelum sampai ke gizmo biasa. Semua pemasangan dibungkus try/catch supaya kegagalan di sini tidak pernah merusak editor. */
window.APK=window.APK||{};
APK.crop=(function(){
  const $=id=>document.getElementById(id);
  const RATIOS=[['1:1',1,1],['4:5',4,5],['5:4',5,4],['3:4',3,4],['4:3',4,3],['2:3',2,3],['3:2',3,2],['9:16',9,16],['16:9',16,9],['21:9',21,9]];
  const MINP=5;   /* bingkai crop minimal 5% dari media */
  const CUR={tl:'nwse-resize',br:'nwse-resize',tr:'nesw-resize',bl:'nesw-resize',l:'ew-resize',r:'ew-resize',t:'ns-resize',b:'ns-resize',move:'move'};
  const coarse=!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),HR=coarse?13:7;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const rnd=v=>Math.round(v*100)/100;
  let editId=null,lock=0,lockKey='',lockClip=null,drag=null,sliding=false,customW=1,customH=1;

  const sel=()=>{try{return APK.timeline.selectedClip()}catch(_){return null}};
  /* clip foto atau video biasa (bukan teks, bentuk, efek, atau track audio) */
  const okClip=s=>!!(s&&s.c&&s.tr&&!s.c.text&&!s.c.shape&&!s.c.fx&&s.tr.kind!=='audio'&&s.m&&(s.m.type==='image'||s.m.type==='video')&&s.m.width>0&&s.m.height>0);
  const lk=c=>lockClip===c.id?lock:0;

  /* bingkai crop sebagai pecahan 0..1 dari media asli: x,y = sudut kiri atas, w,h = ukuran (aturan batas sama dengan cropOf di preview.js) */
  function region(c){
    const o=c.crop||{};
    let l=Math.max(0,+o.l||0),t=Math.max(0,+o.t||0),r=Math.max(0,+o.r||0),b=Math.max(0,+o.b||0);
    if(l+r>95){const k=95/(l+r);l*=k;r*=k}
    if(t+b>95){const k=95/(t+b);t*=k;b*=k}
    return{x:l/100,y:t/100,w:1-(l+r)/100,h:1-(t+b)/100};
  }
  function setRegion(c,x,y,w,h){
    x=clamp(x,0,1);y=clamp(y,0,1);w=clamp(w,0,1-x);h=clamp(h,0,1-y);
    const l=rnd(x*100),t=rnd(y*100),r=rnd(Math.max(0,(1-x-w)*100)),b=rnd(Math.max(0,(1-y-h)*100));
    if(!(l||t||r||b)){delete c.crop;return}
    c.crop={l,t,r,b};
  }
  /* bingkai di ruang layar (memperhitungkan balik horizontal/vertikal) <-> ruang media; fungsinya sama karena pembalikan bolak-balik */
  const toS=(R,c)=>({x:c.flipX?1-R.x-R.w:R.x,y:c.flipY?1-R.y-R.h:R.y,w:R.w,h:R.h});
  /* potong sebesar mungkin ke rasio tg (lebar/tinggi hasil dalam piksel), pusatnya di pusat bingkai sekarang */
  function applyRatio(c,m,tg){
    const am=m.width/m.height,rg=region(c),cx=rg.x+rg.w/2,cy=rg.y+rg.h/2;
    let w,h;
    if(am>tg){h=1;w=tg/am}else{w=1;h=am/tg}
    setRegion(c,clamp(cx-w/2,0,1-w),clamp(cy-h/2,0,1-h),w,h);
  }
  /* hitung bingkai baru saat sisi/sudut diseret. Semua dalam pecahan layar 0..1.
     mode: tl tr br bl (sudut) atau l r t b (sisi); r0 = bingkai awal; fx,fy = posisi tepi yang diseret; lk = rasio piksel terkunci (0 = bebas); am = lebar/tinggi media */
  function resize(mode,r0,fx,fy,lkr,am){
    const mn=MINP/100;
    let x0=r0.x,y0=r0.y,x1=r0.x+r0.w,y1=r0.y+r0.h;
    const L=mode.indexOf('l')>=0,R=mode.indexOf('r')>=0,T=mode.indexOf('t')>=0,B=mode.indexOf('b')>=0;
    if(L)x0=clamp(fx,0,x1-mn);
    if(R)x1=clamp(fx,x0+mn,1);
    if(T)y0=clamp(fy,0,y1-mn);
    if(B)y1=clamp(fy,y0+mn,1);
    if(lkr>0&&am>0){
      const rf=lkr/am,loW=mn*Math.max(1,rf),loH=mn*Math.max(1,1/rf);   /* rf = lebar/tinggi dalam pecahan media */
      let w=x1-x0,h=y1-y0;
      if((L||R)&&(T||B)){                    /* sudut: sudut seberang jadi jangkar */
        const ax=L?r0.x+r0.w:r0.x,ay=T?r0.y+r0.h:r0.y,maxW=Math.min(L?ax:1-ax,(T?ay:1-ay)*rf);
        w=clamp(Math.max(w,h*rf),loW,Math.max(loW,maxW));h=w/rf;
        x0=L?ax-w:ax;x1=L?ax:ax+w;y0=T?ay-h:ay;y1=T?ay:ay+h;
      }else if(L||R){                        /* sisi kiri / kanan: tinggi mengikuti, tetap di tengah */
        const cy=r0.y+r0.h/2,ax=L?r0.x+r0.w:r0.x,maxW=Math.min(L?ax:1-ax,2*Math.min(cy,1-cy)*rf);
        w=clamp(w,loW,Math.max(loW,maxW));h=w/rf;
        x0=L?ax-w:ax;x1=L?ax:ax+w;y0=cy-h/2;y1=cy+h/2;
      }else if(T||B){                        /* sisi atas / bawah: lebar mengikuti, tetap di tengah */
        const cx=r0.x+r0.w/2,ay=T?r0.y+r0.h:r0.y,maxH=Math.min(T?ay:1-ay,2*Math.min(cx,1-cx)/rf);
        h=clamp(h,loH,Math.max(loH,maxH));w=h*rf;
        y0=T?ay-h:ay;y1=T?ay:ay+h;x0=cx-w/2;x1=cx+w/2;
      }
    }
    return{x:x0,y:y0,w:x1-x0,h:y1-y0};
  }

  /* ===== geometri preview (sama seperti gizmo.js) ===== */
  function view(){
    const w=$('preview-wrap'),p=APK.project.current,cw=w.clientWidth,ch=w.clientHeight,pu=Math.min(cw/p.width,ch/p.height)||1;
    return{cw,ch,pu,ox:(cw-p.width*pu)/2,oy:(ch-p.height*pu)/2};
  }
  function loc(v,b,sx,sy){
    const dx=sx-(v.ox+b.cx*v.pu),dy=sy-(v.oy+b.cy*v.pu),a=-b.rot*Math.PI/180,ca=Math.cos(a),sa=Math.sin(a);
    return[dx*ca-dy*sa,dx*sa+dy*ca];
  }
  /* titik layar -> pecahan 0..1 di kotak media (ruang layar, belum dibalik) */
  function frac(v,b,sx,sy){
    const q=loc(v,b,sx,sy),hw=b.w*v.pu/2||1,hh=b.h*v.pu/2||1;
    return[(q[0]+hw)/(2*hw),(q[1]+hh)/(2*hh)];
  }
  function hit(v,b,c,sx,sy){
    const q=loc(v,b,sx,sy),hw=b.w*v.pu/2,hh=b.h*v.pu/2,R=toS(region(c),c),
      X0=-hw+2*hw*R.x,X1=X0+2*hw*R.w,Y0=-hh+2*hh*R.y,Y1=Y0+2*hh*R.h,mx=(X0+X1)/2,my=(Y0+Y1)/2,rad=HR+6;
    const pts=[['tl',X0,Y0],['tr',X1,Y0],['br',X1,Y1],['bl',X0,Y1],['l',X0,my],['r',X1,my],['t',mx,Y0],['b',mx,Y1]];
    let best=null,bd=rad;
    for(const p of pts){const d=Math.hypot(q[0]-p[1],q[1]-p[2]);if(d<=bd){bd=d;best=p[0]}}
    if(best)return best;
    return q[0]>=X0&&q[0]<=X1&&q[1]>=Y0&&q[1]<=Y1?'move':null;
  }

  /* ===== overlay bingkai crop (di canvas gizmo, tidak ikut export) ===== */
  function drawOverlay(g,v,b,s){
    const c=s.c,m=s.m,hw=b.w*v.pu/2,hh=b.h*v.pu/2,R=toS(region(c),c),
      X0=-hw+2*hw*R.x,X1=X0+2*hw*R.w,Y0=-hh+2*hh*R.y,Y1=Y0+2*hh*R.h,mx=(X0+X1)/2,my=(Y0+Y1)/2;
    g.save();
    g.translate(v.ox+b.cx*v.pu,v.oy+b.cy*v.pu);g.rotate(b.rot*Math.PI/180);
    g.fillStyle='rgba(0,0,0,.6)';
    g.beginPath();g.rect(-hw,-hh,hw*2,hh*2);g.rect(X0,Y0,X1-X0,Y1-Y0);g.fill('evenodd');   /* bagian yang dibuang digelapkan */
    g.lineWidth=1;g.strokeStyle='rgba(255,255,255,.4)';g.strokeRect(-hw,-hh,hw*2,hh*2);
    g.strokeStyle='rgba(255,255,255,.5)';g.beginPath();
    for(let i=1;i<3;i++){const x=X0+(X1-X0)*i/3,y=Y0+(Y1-Y0)*i/3;g.moveTo(x,Y0);g.lineTo(x,Y1);g.moveTo(X0,y);g.lineTo(X1,y)}
    g.stroke();
    g.lineWidth=2;g.strokeStyle='#ffd166';g.strokeRect(X0,Y0,X1-X0,Y1-Y0);
    g.lineWidth=1.5;g.strokeStyle='#7f8cff';g.fillStyle='#fff';
    for(const p of [[X0,Y0],[X1,Y0],[X1,Y1],[X0,Y1]]){g.beginPath();g.rect(p[0]-HR*0.7,p[1]-HR*0.7,HR*1.4,HR*1.4);g.fill();g.stroke()}
    g.fillStyle='#ffd166';
    for(const p of [[X0,my],[X1,my]]){g.beginPath();g.rect(p[0]-HR*0.4,p[1]-HR*0.9,HR*0.8,HR*1.8);g.fill();g.stroke()}
    for(const p of [[mx,Y0],[mx,Y1]]){g.beginPath();g.rect(p[0]-HR*0.9,p[1]-HR*0.4,HR*1.8,HR*0.8);g.fill();g.stroke()}
    const lab=Math.round(m.width*R.w)+' × '+Math.round(m.height*R.h)+' px';
    g.font='12px system-ui,sans-serif';g.textAlign='center';g.textBaseline='middle';
    const tw=g.measureText(lab).width+12;
    if(X1-X0>tw+24&&Y1-Y0>44){g.fillStyle='rgba(0,0,0,.65)';g.fillRect(mx-tw/2,my-10,tw,20);g.fillStyle='#fff';g.fillText(lab,mx,my)}
    g.restore();
  }
  /* true kalau overlay tergambar (kalau tidak, gizmo biasa yang menggambar) */
  function paintOverlay(){
    const cv=$('pv-gizmo'),w=$('preview-wrap'),p=APK.project&&APK.project.current,s=sel();
    if(!cv||!w||!p||!s||APK.preview.exporting)return false;
    const b=APK.preview.bounds(s.c.id);if(!b)return false;
    const cw=w.clientWidth,ch=w.clientHeight,dpr=window.devicePixelRatio||1,g=cv.getContext('2d');
    if(cv.width!==Math.round(cw*dpr)||cv.height!==Math.round(ch*dpr)){cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr)}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);
    drawOverlay(g,view(),b,s);
    return true;
  }

  /* ===== mode atur crop ===== */
  function setEdit(id){
    if(id===editId)return;
    editId=id||null;drag=null;
    const cv=$('pv-gizmo');if(cv&&!editId)cv.style.cursor='default';
    try{APK.preview.refresh()}catch(_){}
    syncUi(true);
  }
  function start(s){
    try{
      if(APK.preview.playing)APK.preview.pause();
    }catch(_){}
    setEdit(s.c.id);
    try{
      const t=APK.preview.time;
      if(t<s.c.start||t>=s.c.start+s.c.dur-1e-6)APK.preview.seek(s.c.start);   /* clip harus tampil di playhead supaya bisa dilihat */
    }catch(_){}
  }
  function exitSoft(){
    editId=null;drag=null;
    const cv=$('pv-gizmo');if(cv)cv.style.cursor='default';
    syncUi(true);
    setTimeout(()=>{try{APK.preview.refresh()}catch(_){}},0);   /* gambar ulang tanpa menumpuk di dalam draw yang sedang jalan */
  }

  /* ===== antarmuka di panel Properti ===== */
  function uiHtml(){
    const chip=(k,label,tip)=>`<button type="button" class="btn" data-crop-act="ratio" data-crop-r="${k}" title="${tip}">${label}</button>`;
    const sl=(k,label)=>`<label>${label}<input type="range" data-crop-s="${k}" min="0" max="90" step="0.5"></label>`;
    return `<div class="crop-ui" data-crop-ui="1"><h3 class="kf-title">Crop (potong foto / video)</h3>
      <div class="kf-bar"><button type="button" class="btn" data-crop-act="edit" title="Tampilkan media utuh dengan bingkai crop yang bisa diseret di preview">✂ Atur crop di preview</button><button type="button" class="btn" data-crop-act="reset" title="Kembalikan media utuh">Reset crop</button></div>
      <div class="kf-bar" data-crop-chips="1">${chip('free','Bebas','Bentuk bingkai bebas: seret sudut atau sisi sesukamu')}${RATIOS.map(r=>chip(r[0],r[0],'Potong ke rasio '+r[0]+' (bingkai terkunci ke rasio ini)')).join('')}${chip('screen','Layar','Potong ke rasio layar project')}</div>
      <div class="pr-row"><label title="Lebar rasio kustom">Rasio kustom: lebar<input type="number" data-crop-w="1" min="0.1" max="1000" step="0.1" value="${customW}"></label><label title="Tinggi rasio kustom">tinggi<input type="number" data-crop-h="1" min="0.1" max="1000" step="0.1" value="${customH}"></label></div>
      <div class="kf-bar"><button type="button" class="btn" data-crop-act="custom" title="Potong ke rasio lebar : tinggi yang kamu isi">Terapkan rasio kustom</button></div>
      ${sl('l','Buang dari kiri (%)')}${sl('t','Buang dari atas (%)')}${sl('r','Buang dari kanan (%)')}${sl('b','Buang dari bawah (%)')}
      <p class="kf-hint" data-crop-info="1"></p>
      <p class="kf-hint">Ketuk ✂ Atur crop di preview, lalu seret sudut atau sisi bingkai kuning; seret di dalam bingkai untuk menggesernya. Pilih rasio untuk mengunci bentuk bingkai, atau Bebas untuk bentuk sendiri. Crop berlaku untuk foto dan video, dan tidak bisa di-keyframe.</p></div>`;
  }
  /* sinkronkan tampilan kontrol dengan data clip; dilewati kalau tidak ada yang berubah sejak terakhir */
  function syncUi(force){
    const panel=$('panel-props'),ui=panel&&panel.querySelector('[data-crop-ui]');if(!ui)return;
    const s=sel();if(!okClip(s))return;
    const c=s.c,m=s.m,o=c.crop||{};
    if(lockClip!==c.id){lockClip=c.id;lock=0;lockKey=''}
    const sig=[o.l||0,o.t||0,o.r||0,o.b||0,lock,lockKey,editId===c.id?1:0,m.width,m.height].join('|');
    if(!force&&ui.dataset.sig===sig)return;
    ui.dataset.sig=sig;
    const act=lock>0?lockKey:(c.crop?'free':'');
    ui.querySelectorAll('[data-crop-s]').forEach(el=>{if(document.activeElement!==el)el.value=+o[el.dataset.cropS]||0});
    ui.querySelectorAll('[data-crop-act="ratio"]').forEach(b=>b.classList.toggle('on',b.dataset.cropR===act));
    const eb=ui.querySelector('[data-crop-act="edit"]'),editing=editId===c.id,txt=editing?'✔ Selesai atur crop':'✂ Atur crop di preview';
    if(eb){eb.classList.toggle('primary',editing);if(eb.textContent!==txt)eb.textContent=txt}
    const rg=region(c),pw=Math.round(m.width*rg.w),ph=Math.round(m.height*rg.h),info=ui.querySelector('[data-crop-info]');
    if(info){
      const t=c.crop?`Hasil: ${pw} × ${ph} px (rasio ${(pw/ph).toFixed(2)} : 1). Dibuang: kiri ${rnd(rg.x*100)}%, atas ${rnd(rg.y*100)}%, kanan ${rnd((1-rg.x-rg.w)*100)}%, bawah ${rnd((1-rg.y-rg.h)*100)}%.`:`Belum di-crop (${m.width} × ${m.height} px).`;
      if(info.textContent!==t)info.textContent=t;
    }
  }
  /* pasang bagian Crop baru ke panel Properti (dan buang bagian Crop lama khusus foto) */
  function mount(){
    const panel=$('panel-props');if(!panel)return;
    const old=panel.querySelector('[data-crop-ui]');
    if(old&&old.isConnected)return;
    const s=sel();if(!okClip(s))return;
    const fs=panel.querySelector('fieldset');if(!fs)return;
    const lama=[...fs.querySelectorAll('h3.kf-title')].find(h=>/^Crop \(potong foto\)/.test(h.textContent.trim())&&!h.closest('[data-crop-ui]'));
    if(lama&&lama.parentElement&&lama.parentElement!==fs&&lama.parentElement.parentElement===fs)lama.parentElement.remove();
    const box=document.createElement('div');box.innerHTML=uiHtml();
    const node=box.firstElementChild,after=[...fs.children].find(el=>el.tagName==='H3'&&/^Filter/.test(el.textContent.trim()));
    if(after)fs.insertBefore(node,after);else fs.appendChild(node);
    syncUi(true);
  }

  function init(){
    try{
      const panel=$('panel-props'),wrap=$('preview-wrap');
      /* pembungkus gizmo.draw: overlay crop saat mode aktif, dan sinkronisasi panel */
      const gz=APK.gizmo;
      if(gz&&!gz.__crop){
        const orig=gz.draw;gz.__crop=true;
        gz.draw=function(){
          try{
            if(editId){
              const s=sel();
              if(!s||s.c.id!==editId||!okClip(s)||APK.preview.playing)exitSoft();
              else if(paintOverlay()){syncUi();return}
            }
          }catch(_){}
          const r=orig.apply(this,arguments);
          try{syncUi()}catch(_){}
          return r;
        };
        if(window.ResizeObserver&&wrap)new ResizeObserver(()=>{try{if(editId)paintOverlay()}catch(_){}}).observe(wrap);
      }
      if(panel){
        if(window.MutationObserver)new MutationObserver(()=>{try{mount()}catch(_){}}).observe(panel,{childList:true,subtree:true});
        /* semua kontrol bagian ini ditangani di sini (fase capture) supaya properties.js tidak ikut mencatat undo atau mengubah data */
        panel.addEventListener('input',e=>{
          const el=e.target;if(!el||!el.closest||!el.closest('[data-crop-ui]'))return;
          e.stopPropagation();
          const k=el.dataset.cropS;if(!k)return;
          const s=sel();if(!okClip(s)||s.tr.locked)return;
          const v=parseFloat(el.value);if(!isFinite(v))return;
          if(!sliding){APK.history.record();sliding=true}
          const o=Object.assign({l:0,t:0,r:0,b:0},s.c.crop);
          o[k]=clamp(v,0,90);
          const hz=k==='l'||k==='r';                                   /* jumlah dua sisi berlawanan tidak boleh lebih dari 95% */
          const a=hz?'l':'t',z=hz?'r':'b';
          if(o[a]+o[z]>95)o[k==='l'||k==='t'?a:z]=95-o[k==='l'||k==='t'?z:a];
          if(!(o.l||o.t||o.r||o.b))delete s.c.crop;else s.c.crop={l:rnd(o.l),t:rnd(o.t),r:rnd(o.r),b:rnd(o.b)};
          lock=0;lockKey='';lockClip=s.c.id;
          APK.timeline.touch();syncUi();
        },true);
        panel.addEventListener('change',e=>{
          const el=e.target;if(!el||!el.closest||!el.closest('[data-crop-ui]'))return;
          e.stopPropagation();sliding=false;
          if(el.dataset.cropW!=null){const v=parseFloat(el.value);if(v>0)customW=v}
          if(el.dataset.cropH!=null){const v=parseFloat(el.value);if(v>0)customH=v}
          syncUi(true);
        },true);
        panel.addEventListener('click',e=>{
          const b=e.target&&e.target.closest?e.target.closest('[data-crop-act]'):null;if(!b||!panel.contains(b))return;
          e.stopPropagation();
          const s=sel();if(!okClip(s)||s.tr.locked)return;
          const c=s.c,m=s.m,act=b.dataset.cropAct;
          if(lockClip!==c.id){lockClip=c.id;lock=0;lockKey=''}
          if(act==='edit'){if(editId===c.id)setEdit(null);else start(s);return}
          if(act==='reset'){
            if(c.crop){APK.history.record();delete c.crop;APK.timeline.touch()}
            lock=0;lockKey='';syncUi(true);return;
          }
          if(act==='ratio'||act==='custom'){
            let tg=0,key=b.dataset.cropR;
            if(act==='custom'){
              const w=parseFloat(panel.querySelector('[data-crop-w]').value),h=parseFloat(panel.querySelector('[data-crop-h]').value);
              if(!(w>0&&h>0))return;
              customW=w;customH=h;tg=w/h;key='custom';
            }else if(key==='free'){lock=0;lockKey='free';syncUi(true);return}
            else if(key==='screen'){const p=APK.project.current;tg=p.width/p.height}
            else{const r=RATIOS.find(x=>x[0]===key);if(!r)return;tg=r[1]/r[2]}
            APK.history.record();applyRatio(c,m,tg);
            lock=tg;lockKey=key;
            APK.timeline.touch();syncUi(true);
          }
        },true);
      }
      /* seret bingkai crop di preview: ditangkap di fase capture supaya gizmo biasa tidak ikut bereaksi */
      if(wrap){
        const gcv=()=>$('pv-gizmo'),pos=e=>{const r=gcv().getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
        wrap.addEventListener('pointerdown',e=>{
          if(!editId||e.button!==0||!e.target||e.target.id!=='pv-gizmo')return;
          const s=sel();if(!s||s.c.id!==editId||!okClip(s))return;
          e.stopPropagation();e.preventDefault();
          if(s.tr.locked)return;
          const b=APK.preview.bounds(s.c.id);if(!b)return;
          const v=view(),p=pos(e),mode=hit(v,b,s.c,p[0],p[1]);if(!mode)return;
          const f=frac(v,b,p[0],p[1]),R0=toS(region(s.c),s.c),
            L=mode.indexOf('l')>=0,R=mode.indexOf('r')>=0,T=mode.indexOf('t')>=0,B=mode.indexOf('b')>=0;
          drag={id:s.c.id,mode,r0:R0,sx:p[0],sy:p[1],fx0:f[0],fy0:f[1],
            ox:L?f[0]-R0.x:R?f[0]-(R0.x+R0.w):0,oy:T?f[1]-R0.y:B?f[1]-(R0.y+R0.h):0,moved:false};
          try{gcv().setPointerCapture(e.pointerId)}catch(_){}
        },true);
        wrap.addEventListener('pointermove',e=>{
          if(!editId||!e.target||e.target.id!=='pv-gizmo')return;
          const s=sel();if(!s||s.c.id!==editId||!okClip(s))return;
          const b=APK.preview.bounds(s.c.id);if(!b)return;
          e.stopPropagation();
          const v=view(),p=pos(e);
          if(!drag){gcv().style.cursor=CUR[hit(v,b,s.c,p[0],p[1])]||'default';return}
          if(!drag.moved){
            if(Math.hypot(p[0]-drag.sx,p[1]-drag.sy)<3)return;
            APK.history.record();drag.moved=true;
          }
          const f=frac(v,b,p[0],p[1]);
          let R;
          if(drag.mode==='move'){
            const r0=drag.r0;
            R={x:clamp(r0.x+f[0]-drag.fx0,0,1-r0.w),y:clamp(r0.y+f[1]-drag.fy0,0,1-r0.h),w:r0.w,h:r0.h};
          }else R=resize(drag.mode,drag.r0,f[0]-drag.ox,f[1]-drag.oy,lk(s.c),s.m.width/s.m.height);
          const S=toS(R,s.c);
          setRegion(s.c,S.x,S.y,S.w,S.h);
          APK.timeline.touch();
        },true);
        const end=e=>{
          if(!drag)return;
          e.stopPropagation();
          const mv=drag.moved;drag=null;
          if(mv)APK.timeline.commit();
          syncUi(true);
        };
        wrap.addEventListener('pointerup',end,true);
        wrap.addEventListener('pointercancel',end,true);
      }
      document.addEventListener('keydown',e=>{
        if(!editId||(e.key!=='Escape'&&e.key!=='Enter'))return;
        if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target&&e.target.tagName)||''))return;
        e.preventDefault();setEdit(null);
      });
      mount();
    }catch(err){try{console.warn('crop: pemasangan gagal',err)}catch(_){}}
  }
  init();
  return{RATIOS,region,setRegion,applyRatio,resize,editing:id=>editId!=null&&editId===id,setEdit,get editId(){return editId}};
})();
