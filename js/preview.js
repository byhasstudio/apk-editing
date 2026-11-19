/* Preview: render komposisi timeline ke canvas, playback, sinkron dengan playhead.
   Performa (v23):
   - clip yang akan tampil dalam 1,5 detik disiapkan lebih dulu (dimuat dan diposisikan), jadi audio dan video tidak telat mulai
   - audio disinkronkan lembut (kecepatan putar disesuaikan sedikit) dan jeda start play() dipelajari otomatis, jadi tidak ada delay audio
   - kualitas preview menyesuaikan diri: kalau perangkat tidak kuat, fps dan resolusi preview turun sendiri (hasil export tidak terpengaruh)
   - pembaruan antarmuka (waktu, playhead, gizmo) dibatasi saat memutar
   - export presisi: prepare() dan exportFrame() merender frame demi frame tanpa bergantung pada kecepatan perangkat
   Perbaikan frame hitam (v23):
   - FOTO DIPAKAI BERSAMA: satu elemen Image per media (bukan satu per clip). Preset dengan puluhan potongan clip dari foto yang sama
     dulu memuat ulang gambar di setiap pergantian clip, sekarang gambar sudah siap sehingga tidak ada jeda dan tidak ada frame kosong.
   - ISI CERMIN OTOMATIS: clip media yang menjadi layer paling dasar (tidak ada layer lain di bawahnya) dan hampir selebar layar,
     tapi pada saat itu tidak menutupi seluruh frame (diperkecil, diputar, atau digeser sampai tepinya terbuka), otomatis diisi cermin tepinya
     (efek Isi Cermin, js/fxclip.js) sehingga sudut dan tepi tidak pernah hitam. Clip yang sengaja kecil (di bawah skala 0,5), transparan,
     bertransisi, bermask, atau ber-chroma tidak disentuh. Clip yang sudah punya efek Isi Cermin sendiri memakai efeknya sendiri.
   v25: clip yang miring (skew) ikut dicek dengan perhitungan yang tepat (bukan dilewati), dan flip/regang negatif tidak lagi merusak pengecekan,
     jadi sudut hitam saat foto diputar, digeser, di-whip, atau dimiringkan juga terisi.
   v26: tombol 🔁 Ulangi (loop) di samping tombol stop: kalau menyala, preview kembali ke awal otomatis setelah selesai dan terus berputar.
     Pilihan disimpan di perangkat. Tidak berlaku saat export (export tetap berhenti di akhir timeline).
   v28: efek isi-cermin (Isi Cermin dan Cermin Bayangan, penanda alpha di js/fxclip.js dan js/fxmirrorshadow.js) tanpa clip yang dipilih berjalan di kanvas utama:
     selama ada clip efek berjenis itu yang aktif, kanvas dasar dibiarkan TRANSPARAN (bukan hitam) sampai efeknya jalan, supaya area kosong di sekitar GABUNGAN
     semua layer di bawahnya terisi. Latar hitam ditambahkan di akhir frame. Isi cermin otomatis layer dasar dimatikan saat itu supaya tidak menutupi efeknya.
   v29: JARING PENGAMAN FRAME HITAM untuk kombinasi efek isi-cermin dengan efek lain (Gelombang, Gelombang Baru, Getar, JJ, Glitch, Split Mirror, dan lain-lain).
     Efek isi-cermin menghitung area kosong dari KOTAK media aslinya, padahal efek lain menggeser, memutar, atau menyempitkan gambar sehingga muncul celah yang
     bentuknya tidak persegi (sudut miring, strip bergeser, tepi gelombang). Celah itu dulu lolos dan jadi hitam. Sekarang di akhir frame, SEBELUM latar hitam
     ditambahkan, semua area transparan yang masih tersisa diisi bayangan kabur dari isi frame itu sendiri (lihat safeFill di bawah), dihitung dari alfa piksel
     yang sebenarnya, jadi bentuk celah apa pun dan urutan efek apa pun (di atas atau di bawah clip isi-cermin) tetap tidak ada frame hitam.
     Kanvas dasar transparan dan jaring ini juga berlaku kalau clip isi-cermin hanya memilih clip tertentu (bertarget). */
window.APK=window.APK||{};
APK.preview=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  let canvas,ctx,t=0,playing=false,base=0,t0=0,raf=0,vol=1,K=1,hook=null,onEnd=null,exporting=false,off=false,offFps=30,looping=false;
  const els=new Map(),bmap=new Map(),imgs=new Map();
  const LOOK=1.5;                                                   /* detik: clip yang mulai dalam waktu ini disiapkan lebih awal */
  const LV=[[60,1],[30,1],[30,0.75],[24,0.6],[24,0.45]];            /* tingkat kualitas preview: [fps maksimum, skala resolusi] */
  const AUTO=[{type:'mirror',p:{blur:14}}];                         /* efek isi cermin otomatis (blur isian tipis supaya terasa seperti latar) */
  let lat=0.1,lv=0,Q=1,ema=0,dema=0,slow=0,fast=0,nextDraw=0,lastUi=0,gcN=0,needResize=false;
  const clampN=(v,a,b)=>Math.min(b,Math.max(a,v));
  const mediaOf=id=>P().media.find(m=>m.id===id);
  const capFps=()=>{const p=P();return Math.max(10,Math.min(LV[lv][0],(p&&p.fps)||30))};
  /* kotak objek di koordinat project (dipakai gizmo untuk memilih dan memindah objek) */
  /* w dan h = ukuran dasar (sudah dikali scale); regang (sx, sy) dan titik pusat ikut dihitung di sini */
  const mark=(c,pr,W,H,w,h)=>{const q=APK.layers.center(c,pr);bmap.set(c.id,{cx:W/2+q.x,cy:H/2+q.y,w:w*(pr.sx==null?1:pr.sx),h:h*(pr.sy==null?1:pr.sy),rot:pr.rotation})};
  function fmt(s,short){s=Math.max(0,s);const m=Math.floor(s/60);
    return short?m+':'+String(Math.floor(s%60)).padStart(2,'0'):String(m).padStart(2,'0')+':'+(s%60).toFixed(2).padStart(5,'0')}
  function duration(){let d=0;if(!P())return 0;for(const tr of P().tracks)for(const c of tr.clips)d=Math.max(d,c.start+c.dur);return d}

  function getEl(clip){
    let e=els.get(clip.id);if(e)return e;
    const m=mediaOf(clip.mediaId);if(!m)return null;
    /* foto yang sama dipakai bersama oleh semua clip-nya (dihitung referensinya, dilepas saat clip terakhir dilepas) */
    if(m.type==='image'){
      const sh=imgs.get(m.id);
      if(sh&&!sh.gone){sh.refs++;els.set(clip.id,sh);return sh}
    }
    const el=m.type==='image'?new Image():document.createElement(m.type);
    e={el,type:m.type,ready:false,gone:false,failed:false,pre:false,playAt:0,seekAt:0,rev:false,refs:1,mid:m.id};
    e.readyP=new Promise(r=>{e.res=r});
    els.set(clip.id,e);
    if(m.type==='image')imgs.set(m.id,e);
    const done=()=>{if(e.gone)return;e.ready=true;e.res();if(!off&&!playing)draw()};
    if(m.type==='image')el.onload=done;
    else{
      el.preload='auto';el.playsInline=true;
      el.onloadeddata=done;
      el.onseeked=()=>{if(!off&&(!playing||e.rev))draw()};
      /* jeda antara play() dipanggil dan suara benar-benar jalan; dipakai untuk memajukan titik mulai media */
      el.onplaying=()=>{if(e.playAt){const d=(performance.now()-e.playAt)/1000;e.playAt=0;if(d>=0&&d<0.6)lat=clampN(lat*0.6+d*0.4,0.02,0.3)}};
    }
    el.onerror=()=>{if(e.gone)return;e.failed=true;e.res()};
    if(hook&&m.type!=='image')hook(el);
    APK.media.getUrl(m.id).then(u=>{if(e.gone)return;if(u)el.src=u;else{e.failed=true;e.res()}});
    return e;
  }
  function release(id){
    const e=els.get(id);if(!e)return;
    els.delete(id);
    if(e.type==='image'){
      if(--e.refs>0)return;                       /* masih dipakai clip lain */
      if(imgs.get(e.mid)===e)imgs.delete(e.mid);
    }
    e.gone=true;e.res();
    if(e.type!=='image'){e.el.pause();e.el.removeAttribute('src');e.el.load()}else e.el.removeAttribute('src');
  }
  /* siapkan clip yang akan mulai sebentar lagi: muat media dan taruh di titik mulainya, supaya play() nanti langsung jalan */
  function pre(c,tr){
    const m=mediaOf(c.mediaId);if(!m)return;
    const e=getEl(c);if(!e||e.type==='image'||e.failed)return;
    if(!e.ready||e.pre||!e.el.paused)return;
    const sp=Math.min(16,Math.max(0.0625,c.speed||1)),rev=!!c.reverse&&e.type==='video'&&tr.kind!=='audio',
      x=rev?c.in+c.dur*sp:c.in+lat*sp;
    if(Math.abs(e.el.currentTime-x)>0.04)e.el.currentTime=x;
    e.pre=true;
  }
  /* true kalau clip media c pada waktu tt tidak menutupi seluruh frame dan layak diisi cermin otomatis.
     Urutan transformasi sama seperti APK.layers.xf: skala/regang -> miring -> putar -> geser. Jadi sudut frame dikembalikan ke ruang media
     dengan urutan terbalik (putar balik, lalu batalkan miring) lalu dibandingkan dengan setengah ukuran media yang sudah diskala. */
  function autoFill(c,tt,W,H){
    if((c.mask&&c.mask.on)||(c.chroma&&c.chroma.on)||(c.tin&&c.tin.type)||(c.tout&&c.tout.type))return false;
    const m=mediaOf(c.mediaId);
    if(!m||(m.type!=='image'&&m.type!=='video')||!(m.width>0)||!(m.height>0))return false;
    const pr=APK.layers.props(c,tt);
    if(pr.opacity<0.98||pr.scale<0.5)return false;   /* sengaja transparan atau kecil: biarkan */
    const q=APK.layers.center(c,pr),s=Math.min(W/m.width,H/m.height)*Math.max(0,pr.scale),
      hw=m.width*s*Math.abs(pr.sx==null?1:pr.sx)/2,hh=m.height*s*Math.abs(pr.sy==null?1:pr.sy)/2,
      a=pr.rotation*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a),cx=W/2+q.x,cy=H/2+q.y,
      tn=d=>Math.tan(clampN(d||0,-80,80)*Math.PI/180),tx=tn(pr.skx),ty=tn(pr.sky),det=1-tx*ty;
    if(Math.abs(det)<0.05)return true;
    for(const k of [[0,0],[W,0],[W,H],[0,H]]){
      const dx=k[0]-cx,dy=k[1]-cy,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs,   /* sudut frame setelah diputar balik */
        ux=(lx-tx*ly)/det,uy=(ly-ty*lx)/det;                         /* lalu miringnya dibatalkan */
      if(Math.abs(ux)>hw+0.5||Math.abs(uy)>hh+0.5)return true;
    }
    return false;
  }

  /* ===== JARING PENGAMAN FRAME HITAM (v29) =====
     Dipanggil di akhir frame() kalau ada clip efek isi-cermin yang aktif (kanvas dasar sedang transparan), tepat SEBELUM latar hitam ditambahkan.
     Semua piksel yang masih transparan (celah akibat efek yang menggeser, memutar, menggetarkan, atau menyempitkan gambar, atau area di luar media)
     diisi warna tetangganya yang dikaburkan, jadi tidak ada lagi yang jatuh ke hitam, apa pun bentuk celahnya dan apa pun urutan efeknya.
     Cara kerja (push-pull, hanya memakai kanvas kecil, jadi ringan):
       1) frame diperkecil bertahap separuh demi separuh sampai 1 piksel (warna dirata-rata dengan bobot alfa, celah makin menyempit)
       2) lapis paling kasar dijenuhkan (alfa jadi penuh tanpa mengubah warna), lalu dibesarkan bertahap; di tiap tingkat lapis yang lebih halus
          ditumpuk di atas lapis kasar, jadi bagian transparan terisi dari lapis kasar dan bagian berisi tetap dari lapis halus
       3) hasilnya (seperempat ukuran) dikaburkan sedikit, diatur kecerahan, saturasi, tint, dan opasitasnya seperti pengaturan clip efek isi-cermin teratas
          yang aktif, lalu digambar DI BAWAH frame (destination-over). Frame asli tidak berubah sama sekali di bagian yang sudah terisi. */
  const sfc=[];
  function sfCanvas(i,w,h){
    let g=sfc[i];
    if(!g)g=sfc[i]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.shadowBlur=0;g.shadowColor='rgba(0,0,0,0)';
    g.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in g)g.imageSmoothingQuality='high';
    g.clearRect(0,0,w,h);
    return g;
  }
  function safeFill(g,tm){
    const p=P(),FX=APK.fxclip;
    if(!p||!FX||!FX.DEF||!FX.params)return;
    /* pengaturan diambil dari clip efek isi-cermin teratas yang aktif (track paling atas = indeks terkecil) */
    let fx=null;
    for(let i=0;i<p.tracks.length&&!fx;i++){
      const tr=p.tracks[i];
      if(tr.hidden)continue;
      for(const c of tr.clips){
        if(!c.fx||tm<c.start||tm>=c.start+c.dur-1e-6)continue;
        const d=FX.DEF[c.fx.type];
        if(d&&d.alpha){fx=c.fx;break}
      }
    }
    if(!fx)return;
    const q=FX.params(fx);
    let br=0.7,sa=1,op=1,tint=0,hue=210;
    if(fx.type==='mirrorshadow'){br=0.3+1.4*q.bri/100;sa=q.sat/50;op=clampN(q.op/100,0,1);tint=q.tint||0;hue=q.hue||0}
    else if(q.dim!=null)br=1-clampN(+q.dim||0,0,100)/100;
    const cv=g.canvas,w=cv.width,h=cv.height;
    if(!(w>=4&&h>=4))return;
    /* ukuran tiap tingkat: separuh dari tingkat sebelumnya sampai sisi terpanjang 2 piksel atau kurang */
    const sz=[[w,h]];
    while(sz.length<12&&Math.max(sz[sz.length-1][0],sz[sz.length-1][1])>2){
      const l=sz[sz.length-1];
      sz.push([Math.max(1,Math.ceil(l[0]/2)),Math.max(1,Math.ceil(l[1]/2))]);
    }
    const n=sz.length-1;
    if(n<2)return;
    /* 1) pull: perkecil bertahap */
    const lv=[cv];
    for(let i=1;i<=n;i++){
      const L=sfCanvas(i,sz[i][0],sz[i][1]);
      L.drawImage(lv[i-1],0,0,sz[i-1][0],sz[i-1][1],0,0,sz[i][0],sz[i][1]);
      lv[i]=L.canvas;
    }
    /* 2) jenuhkan lapis paling kasar: menumpuk dirinya sendiri membuat alfa naik ke penuh sementara warnanya tetap (bolak-balik dua kanvas) */
    const tw=sz[n][0],th=sz[n][1];
    let ca=sfCanvas(40,tw,th),cb=sfCanvas(41,tw,th);
    ca.drawImage(lv[n],0,0);
    for(let k=0;k<5;k++){
      cb.clearRect(0,0,tw,th);
      cb.drawImage(ca.canvas,0,0);
      cb.drawImage(ca.canvas,0,0);
      const sw0=ca;ca=cb;cb=sw0;
    }
    let acc=ca.canvas;
    /* push: besarkan bertahap sampai seperempat ukuran frame, tiap tingkat menumpuk lapis yang lebih halus di atas lapis kasar */
    for(let i=n-1;i>=2;i--){
      const A=sfCanvas(20+i,sz[i][0],sz[i][1]);
      A.drawImage(acc,0,0,sz[i+1][0],sz[i+1][1],0,0,sz[i][0],sz[i][1]);
      A.drawImage(lv[i],0,0);
      acc=A.canvas;
    }
    /* 3) kaburkan sedikit (digambar sedikit lebih besar supaya tepi tidak memudar), atur kecerahan, saturasi, dan tint */
    const sw=sz[2][0],sh=sz[2][1],E=sfCanvas(42,sw,sh),hasF='filter' in E;
    const bl=Math.max(1.2,Math.min(sw,sh)*0.04),m=Math.ceil(bl*2);
    if(hasF){
      let fs='blur('+bl.toFixed(1)+'px)';
      if(Math.abs(br-1)>0.01)fs+=' brightness('+br.toFixed(2)+')';
      if(Math.abs(sa-1)>0.01)fs+=' saturate('+sa.toFixed(2)+')';
      E.filter=fs;
    }
    E.drawImage(acc,0,0,sw,sh,-m,-m,sw+2*m,sh+2*m);
    if(hasF)E.filter='none';
    else if(br<0.99){
      E.globalCompositeOperation='source-atop';
      E.fillStyle='rgba(0,0,0,'+(1-br).toFixed(2)+')';
      E.fillRect(0,0,sw,sh);
      E.globalCompositeOperation='source-over';
    }
    if(tint>0){
      E.globalCompositeOperation='source-atop';
      E.fillStyle='hsla('+Math.round(hue)+',80%,50%,'+(tint/100*0.7).toFixed(2)+')';
      E.fillRect(0,0,sw,sh);
      E.globalCompositeOperation='source-over';
    }
    /* digambar di bawah frame: hanya piksel yang masih transparan yang memperlihatkannya */
    g.save();
    g.setTransform(1,0,0,1,0,0);
    g.globalAlpha=op;
    g.globalCompositeOperation='destination-over';
    if('filter' in g)g.filter='none';
    g.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in g)g.imageSmoothingQuality='high';
    g.drawImage(E.canvas,0,0,sw,sh,0,0,w,h);
    g.restore();
  }

  function frame(){
    const p=P(),W=p.width,H=p.height,FX=APK.fxclip,ft=FX?FX.targets(p,t):null;
    bmap.clear();
    APK.layers.begin();
    /* ada clip efek isi-cermin (entry.alpha) yang aktif sekarang: kanvas dasar dibiarkan transparan sampai efeknya jalan.
       trA = ada clip efek isi-cermin aktif (bertarget atau tidak): kanvas dasar transparan, efek lain tidak mengisi hitam, dan jaring pengaman jalan di akhir frame.
       tr0 = yang aktif itu tanpa clip yang dipilih (berjalan di kanvas utama): isi cermin otomatis layer dasar dimatikan karena efek itu yang mengisi. */
    let tr0=false,trA=false;
    if(FX&&FX.DEF){
      for(const tr of p.tracks){
        if(tr.hidden)continue;
        for(const c of tr.clips){
          if(!c.fx||t<c.start||t>=c.start+c.dur-1e-6)continue;
          const d=FX.DEF[c.fx.type];
          if(d&&d.alpha){trA=true;if(!Array.isArray(c.fx.targets))tr0=true}
        }
      }
    }
    ctx.setTransform(K,0,0,K,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
    if(trA)ctx.clearRect(0,0,W,H);
    else{ctx.fillStyle='#000';ctx.fillRect(0,0,W,H)}
    /* membuang elemen clip yang sudah dihapus: cukup sesekali saat memutar */
    if(!playing||++gcN%20===0){
      const live=new Set();
      for(const tr of p.tracks)for(const c of tr.clips)live.add(c.id);
      for(const id of [...els.keys()])if(!live.has(id))release(id);
    }
    let below=false;   /* sudah ada layer yang tergambar di track yang lebih bawah */
    for(let i=p.tracks.length-1;i>=0;i--){
      const tr=p.tracks[i];
      if(tr.hidden){
        for(const c of tr.clips){const e=els.get(c.id);if(e&&e.type!=='image'&&!e.el.paused)e.el.pause()}
        continue;
      }
      let trDrew=false;
      for(const c of tr.clips){
        const active=t>=c.start&&t<c.start+c.dur-1e-6;
        if(!active){
          const e=els.get(c.id);
          if(e){
            if(e.type!=='image'&&!e.el.paused)e.el.pause();
            if(off?(t>c.start+c.dur+0.25||t<c.start-1):(t<c.start-5||t>c.start+c.dur+5))release(c.id);
          }
          if(playing&&c.mediaId&&c.start>t&&c.start-t<LOOK)pre(c,tr);
          continue;
        }
        /* clip efek (js/fxclip.js): tanpa target = mengolah semua yang sudah tergambar di bawahnya; yang bertarget diterapkan per clip di bawah */
        if(c.fx){if(FX&&!Array.isArray(c.fx.targets))FX.run(ctx,c.fx,t,!trA);continue}
        const E=APK.effects,main=ctx;
        let fl=ft&&ft.get(c.id)||null,drew=false;
        /* layer dasar yang tidak menutupi frame: isi otomatis dengan cermin tepinya supaya tidak ada area hitam.
           Dilewati kalau ada clip efek isi-cermin aktif (tr0): efek itu yang mengisi, dengan pengaturannya sendiri. */
        if(!fl&&FX&&!below&&!tr0&&tr.kind!=='audio'&&c.mediaId&&autoFill(c,t,W,H))fl=AUTO;
        /* clip yang dituju efek digambar dulu ke lapisan terpisah, efek diterapkan ke lapisan itu, lalu ditempel ke kanvas utama */
        if(fl)ctx=FX.layerBegin(main,K);
        try{
          if(c.text){
            const pr=APK.layers.props(c,t),sc=Math.max(0,pr.scale),q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
            drew=true;
            const b=APK.text.draw(ctx,c,q,W,H);
            if(E)E.end(ctx);
            mark(c,pr,W,H,b.w*sc,b.h*sc);continue;
          }
          if(c.shape){
            const pr=APK.layers.props(c,t),sc=Math.max(0,pr.scale),q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
            drew=true;
            const b=APK.shapes.draw(ctx,c,q,W,H);
            if(E)E.end(ctx);
            mark(c,pr,W,H,b.w*sc,b.h*sc);continue;
          }
          /* export presisi: audio dicampur terpisah, jadi clip audio tidak perlu elemennya */
          if(off){const mo=mediaOf(c.mediaId);if(tr.kind==='audio'||!mo||mo.type==='audio')continue}
          const e=getEl(c);if(!e||!e.ready)continue;
          const pr=APK.layers.props(c,t),sp=Math.min(16,Math.max(0.0625,c.speed||1)),
            rev=!!c.reverse&&e.type==='video'&&tr.kind!=='audio',
            src=rev?c.in+c.dur*sp-(t-c.start)*sp:c.in+(t-c.start)*sp;
          e.rev=rev;
          if(e.type!=='image'){
            const el=e.el,rl=t-c.start,fi=c.fadeIn||0,fo=c.fadeOut||0;
            let fg=1;
            if(fi>0)fg=Math.min(fg,rl/fi);
            if(fo>0)fg=Math.min(fg,(c.dur-rl)/fo);
            fg=Math.min(1,Math.max(0,fg));
            el.volume=Math.min(1,Math.max(0,pr.volume*vol*fg));
            el.muted=!!tr.muted||!!c.mute||rev||off;
            if(!off){
              const now=performance.now();
              if(rev){
                if(el.playbackRate!==sp)el.playbackRate=sp;
                if(!el.paused)el.pause();
                if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
              }else if(playing){
                const want=src+lat*sp;
                if(el.paused){
                  /* mulai: majukan titik mulai sebesar jeda play() supaya suara tepat waktu */
                  e.pre=false;e.playAt=now;e.seekAt=now;
                  if(el.playbackRate!==sp)el.playbackRate=sp;
                  if(Math.abs(el.currentTime-want)>0.03)el.currentTime=want;
                  el.play().catch(()=>{});
                }else if(!el.seeking&&el.readyState>=2){
                  /* sedang jalan: selisih kecil dikoreksi lewat kecepatan putar (tanpa lompatan), selisih besar baru loncat */
                  const dr=el.currentTime-src,ad=Math.abs(dr);
                  let rate=sp;
                  if(ad>0.3){if(now-e.seekAt>600){e.seekAt=now;el.currentTime=want}}
                  else if(ad>0.04)rate=sp*(1-clampN(dr*0.6,-0.1,0.1));
                  if(Math.abs(el.playbackRate-rate)>0.004)el.playbackRate=rate;
                }
              }else{
                if(!el.paused)el.pause();
                if(el.playbackRate!==sp)el.playbackRate=sp;
                if(Math.abs(el.currentTime-src)>0.03)el.currentTime=src;
              }
            }
          }
          if(tr.kind==='audio')continue;
          const w=e.type==='image'?e.el.naturalWidth:e.el.videoWidth,h=e.type==='image'?e.el.naturalHeight:e.el.videoHeight;
          if(!w||!h)continue;
          const fit=Math.min(W/w,H/h),s=fit*Math.max(0,pr.scale),
            fxc=APK.fx.process(e.el,w,h,c,Math.ceil(Math.max(W,H)*K*clampN(pr.scale,1,2)));
          mark(c,pr,W,H,w*s,h*s);
          const q=E?E.begin(ctx,c,t,pr,W,H,K):pr;
          drew=true;
          ctx.save();
          ctx.globalAlpha=Math.min(1,Math.max(0,q.opacity));
          ctx.globalCompositeOperation=c.blend||'source-over';
          APK.layers.xf(ctx,c,q,W,H,Math.max(0,q.scale));
          ctx.drawImage(fxc||e.el,-w*fit/2,-h*fit/2,w*fit,h*fit);
          ctx.restore();
          if(E)E.end(ctx);
        }finally{
          if(fl){ctx=main;if(drew)FX.layerEnd(main,c,fl,t)}
          /* Strip geser: iris SELURUH layar (termasuk isi cermin tepi dan area di luar foto) setelah clip dan efek-efeknya selesai tergambar */
          if(drew&&!c.text&&!c.shape&&c.flt&&c.flt.slice>0&&APK.fx.slice)APK.fx.slice(ctx,c.flt,t,c);
          if(drew)trDrew=true;
        }
      }
      if(trDrew)below=true;
    }
    /* kanvas dasar tadi dibiarkan transparan: sisa celah yang belum terisi efek apa pun (akibat efek lain yang menggeser atau memutar gambar) diisi bayangan kabur
       dari isi frame sendiri (jaring pengaman v29), baru sisa terakhir yang benar-benar kosong (tidak ada media sama sekali) diberi latar hitam seperti biasa */
    if(trA){
      try{safeFill(ctx,t)}catch(_){}
      ctx.save();
      ctx.setTransform(K,0,0,K,0,0);ctx.globalAlpha=1;
      ctx.globalCompositeOperation='destination-over';
      ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);
      ctx.restore();
    }
  }
  /* live = dipanggil dari loop playback: antarmuka (waktu, playhead, gizmo) tidak perlu diperbarui di setiap frame */
  function draw(live){
    if(!P()||!ctx)return;
    frame();
    if(live){
      const n=performance.now();
      if(n-lastUi<(exporting?250:50))return;
      lastUi=n;
    }
    $('pv-time').textContent=fmt(t)+' / '+fmt(duration());
    APK.timeline.setPlayhead(t);
    if(APK.properties&&APK.properties.tick)APK.properties.tick();
    if(APK.gizmo)APK.gizmo.draw();
  }
  /* kualitas adaptif: ms = lama menggambar satu frame, di = jarak antar frame yang tergambar */
  function adapt(ms,di){
    ema=ema?ema*0.85+ms*0.15:ms;
    if(di<250)dema=dema?dema*0.85+di*0.15:di;
    const bud=1000/capFps();
    if(lv<LV.length-1&&(ema>bud*0.85||dema>bud*1.3)){
      if(++slow>=15){lv++;slow=0;fast=0;ema=0;dema=0;needResize=true}
    }else slow=0;
    if(lv>0&&ema<bud*0.3&&dema<bud*1.15){
      if(++fast>=150){lv--;fast=0;slow=0;ema=0;dema=0;needResize=true}
    }else fast=0;
  }
  function loop(){
    if(!playing)return;
    const n=performance.now();
    t=base+(n-t0)/1000;
    const d=duration();
    if(t>=d){
      if(looping&&!exporting&&d>0){
        /* ulangi: semua video/audio dihentikan lalu dimulai lagi dari awal lewat jalur "mulai" biasa supaya sinkron */
        els.forEach(e=>{if(e.type!=='image'){e.el.pause();e.pre=false;e.seekAt=0}});
        t=0;base=0;t0=n;nextDraw=0;
      }else{t=d;pause();if(onEnd)onEnd();return}
    }
    if(exporting||n>=nextDraw-2){
      const iv=1000/capFps();
      const di=nextDraw?n-(nextDraw-iv):iv;
      nextDraw+=iv;if(nextDraw<n)nextDraw=n+iv*0.1;
      if(needResize&&!exporting){needResize=false;Q=LV[lv][1];resize()}
      draw(true);
      if(!exporting)adapt(performance.now()-n,di);
    }
    raf=requestAnimationFrame(loop);
  }
  function play(){
    if(!P()||!duration())return;
    if(t>=duration()-0.01)t=0;
    playing=true;
    if(!exporting&&Q!==LV[lv][1]){Q=LV[lv][1];resize()}
    base=t;t0=performance.now();nextDraw=0;ema=0;dema=0;slow=0;fast=0;
    $('pv-play').textContent='❚❚';loop();
  }
  function pause(){
    playing=false;cancelAnimationFrame(raf);
    els.forEach(e=>{if(e.type!=='image')e.el.pause()});
    $('pv-play').textContent='▶';
    if(Q!==1&&!exporting){Q=1;resize()}   /* saat berhenti, tampil dengan kualitas penuh */
    draw();
  }
  const toggle=()=>playing?pause():play();
  function stop(){pause();seek(0)}
  function seek(x){
    t=Math.max(0,Math.min(x,Math.max(duration(),0)));
    if(playing){base=t;t0=performance.now()}
    draw();
  }
  function resize(){
    const p=P();if(!p||!canvas)return;
    K=Math.min(1,1280/Math.max(p.width,p.height))*(exporting?1:Q);
    canvas.width=Math.max(1,Math.round(p.width*K));canvas.height=Math.max(1,Math.round(p.height*K));
    $('project-meta').textContent=`${p.width}×${p.height} · ${p.fps} fps · ${p.aspect}`;
  }
  /* export real-time (mode cepat) */
  function beginExport(w,h,hk,cb){exporting=true;off=false;unload();hook=hk;onEnd=cb;K=w/P().width;canvas.width=w;canvas.height=h;draw()}
  /* export presisi: tidak ada pemutaran; tiap frame disiapkan lewat prepare() lalu digambar lewat exportFrame() */
  function beginOffline(w,h,fps){exporting=true;off=true;offFps=fps||30;unload();hook=null;onEnd=null;K=w/P().width;canvas.width=w;canvas.height=h}
  function endExport(){exporting=false;off=false;unload();hook=null;onEnd=null;Q=1;resize();draw()}
  const sleepP=ms=>new Promise(r=>setTimeout(r,ms));
  function seekEl(el,x){
    return new Promise(res=>{
      let done=false,tm=0;
      const f=()=>{if(done)return;done=true;clearTimeout(tm);el.removeEventListener('seeked',f);res()};
      tm=setTimeout(f,3000);
      el.addEventListener('seeked',f);
      el.currentTime=x;
    });
  }
  async function prepOne(e,c,tt,tol){
    if(!e.ready){
      await Promise.race([e.readyP,sleepP(20000)]);
      if(!e.ready){e.failed=true;return}
    }
    if(e.type==='image')return;
    const sp=Math.min(16,Math.max(0.0625,c.speed||1)),el=e.el,
      rev=!!c.reverse&&e.type==='video',
      src=rev?c.in+c.dur*sp-(tt-c.start)*sp:c.in+(tt-c.start)*sp,
      x=Math.max(0,Math.min(src,(isFinite(el.duration)&&el.duration>0?el.duration:1e9)-0.001));
    if(Math.abs(el.currentTime-x)>tol)await seekEl(el,x);
  }
  /* muat semua media yang tampil di waktu tt dan taruh tepat di frame yang benar (full = termasuk clip audio, untuk export real-time) */
  async function prepare(tt,full){
    const p=P(),jobs=[];
    t=tt;
    for(const tr of p.tracks){
      if(tr.hidden)continue;
      if(tr.kind==='audio'&&!full)continue;
      for(const c of tr.clips){
        if(c.fx||c.text||c.shape||!c.mediaId)continue;
        if(!(tt>=c.start&&tt<c.start+c.dur-1e-6))continue;
        const m=mediaOf(c.mediaId);if(!m||(m.type==='audio'&&!full))continue;
        const e=getEl(c);if(!e||e.failed)continue;
        jobs.push(prepOne(e,c,tt,full?0.03:0.5/offFps));
      }
    }
    await Promise.all(jobs);
  }
  function exportFrame(tt){t=tt;frame()}
  /* tombol Ulangi (loop) putar: dibuat di samping tombol stop; pilihan disimpan di perangkat */
  function setLoop(v){
    looping=!!v;
    try{localStorage.setItem('apk-pv-loop',looping?'1':'0')}catch(_){}
    const b=$('pv-loop');
    if(b){
      b.classList.toggle('on',looping);
      b.setAttribute('aria-pressed',looping?'true':'false');
      b.style.opacity=looping?'1':'.55';
      b.style.outline=looping?'2px solid #2fd37a':'';
      b.style.outlineOffset=looping?'-2px':'';
    }
  }
  function initLoopBtn(){
    const st=$('pv-stop');if(!st||$('pv-loop'))return;
    const b=document.createElement('button');
    b.id='pv-loop';b.type='button';b.className=st.className;b.textContent='🔁';
    b.title='Ulangi (loop) putar: kembali ke awal setelah selesai';
    b.setAttribute('aria-label','Ulangi putar');
    b.onclick=()=>setLoop(!looping);
    st.insertAdjacentElement('afterend',b);
    let saved=false;try{saved=localStorage.getItem('apk-pv-loop')==='1'}catch(_){}
    setLoop(saved);
  }
  function init(){
    canvas=$('pv-canvas');ctx=canvas.getContext('2d');
    $('pv-play').onclick=toggle;$('pv-stop').onclick=stop;
    initLoopBtn();
    $('pv-vol').oninput=e=>{vol=+e.target.value;draw()};
    $('pv-full').onclick=()=>{if(APK.fsctl){APK.fsctl.toggle();return}const w=$('preview-wrap');document.fullscreenElement?document.exitFullscreen():w.requestFullscreen&&w.requestFullscreen()};
    $('pv-aspect').onchange=e=>{APK.project.setAspect(e.target.value);resize();draw()};
  }
  function load(){t=0;playing=false;Q=1;lv=0;needResize=false;$('pv-aspect').value=P().aspect;$('pv-play').textContent='▶';resize();draw()}
  function unload(){playing=false;cancelAnimationFrame(raf);for(const id of [...els.keys()])release(id);imgs.clear()}
  return{init,load,unload,beginExport,beginOffline,endExport,prepare,exportFrame,refresh:()=>draw(),seek,play,pause,toggle,stop,fmt,bounds:id=>bmap.get(id),setLoop,
    get looping(){return looping},
    get exporting(){return exporting},get time(){return t},get playing(){return playing},get duration(){return duration()}};
})();
