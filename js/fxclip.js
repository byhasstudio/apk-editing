/* Efek clip (ala CapCut): efek berdiri sendiri sebagai clip di timeline, terpisah dari media, jadi bisa digeser, dipotong,
   diperpanjang, dan diduplikat tanpa menyentuh media.
   Data clip: clip.fx = { type:'glitch'|'shake'|'wave'|'wave2'|'jj'|'mirror', p:{...} (hanya nilai yang diubah), targets?:[id clip] }
     tanpa targets : efek berlaku untuk SEMUA layer di bawah clip efek (track yang urutannya lebih belakang), selama durasi clip efek
     dengan targets: efek hanya berlaku untuk clip yang dipilih (video, gambar, teks, bentuk), selama durasi clip efek
   Efek dengan perLayer:true (Isi Cermin) tanpa targets tidak mengolah kanvas utama, tapi tiap clip media (video/gambar) yang sedang tampil di track bawahnya
   diolah sendiri-sendiri di lapisan transparan (lihat targets() dan layerEnd()), karena efek itu perlu tahu mana bagian yang kosong (transparan) dan kotak medianya.
   Preview menggambar efek lewat run(), targets(), layerBegin(), layerEnd(), jadi ikut ter-export.
   Panel Properti clip efek dibuat oleh panel() dan dipasang properties.js; add() dipanggil daftar efek (js/fxlib.js).
   Menambah efek baru: tambahkan satu objek di LIST: id, name, desc, params (daftar [kunci, label, min, max, bawaan]), apply, dan len (opsional, lama clip baru).
   apply(g, w, h, p, tm, opaque, rel, dur) mengubah isi kanvas g langsung. tm = waktu timeline, rel = detik sejak clip efek mulai, dur = lama clip efek. */
window.APK=window.APK||{};
APK.fxclip=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const DUR=3;   /* lama clip efek baru (detik), kecuali efek punya len sendiri */
  let curClip=null;   /* clip media yang sedang diolah layerEnd(): efek per-layer memakainya untuk tahu kotak medianya (APK.preview.bounds) */

  /* ===== kanvas bantu untuk efek (dipakai bergantian, tidak pernah bersarang) ===== */
  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
    return g;
  }
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};

  /* ===== efek 1: Glitch RGB =====
     Potongan horizontal bergeser (acak stabil per 1/14 detik) dan warna merah/hijau/biru terpisah. Kekuatan berdenyut supaya tidak monoton. */
  function glitch(g,w,h,p,tm){
    const amt=p.amt/100;if(amt<=0)return;
    const k=Math.max(0.2,p.spd/50),rnd=rng(Math.floor(tm*k*14)*7919+101);
    const pulse=0.5+0.5*Math.abs(Math.sin(tm*k*4.3)*Math.cos(tm*k*1.7));
    const S=ac('s',w,h),T=ac('t',w,h);
    S.drawImage(g.canvas,0,0);
    T.drawImage(S.canvas,0,0);
    const n=1+Math.round(amt*pulse*9);
    for(let i=0;i<n;i++){
      const y=Math.floor(rnd()*h),hh=Math.min(h-y,Math.max(2,Math.floor((0.01+rnd()*0.07)*h))),dx=Math.round((rnd()-0.5)*2*amt*pulse*w*0.16);
      if(hh<=0)continue;
      S.clearRect(0,y,w,hh);
      S.drawImage(T.canvas,0,y,w,hh,dx,y,w,hh);
      S.drawImage(T.canvas,0,y,w,hh,dx>0?dx-w:dx+w,y,w,hh);   /* membungkus ke sisi lain, tanpa celah */
    }
    const sh=Math.max(1,Math.round(w*0.016*amt*(0.4+0.6*pulse)));
    g.clearRect(0,0,w,h);
    g.globalCompositeOperation='lighter';
    for(const ch of [['#f00',-sh],['#0f0',0],['#00f',sh]]){
      T.globalCompositeOperation='source-over';T.clearRect(0,0,w,h);
      T.drawImage(S.canvas,0,0);
      T.globalCompositeOperation='multiply';T.fillStyle=ch[0];T.fillRect(0,0,w,h);          /* sisakan satu kanal warna */
      T.globalCompositeOperation='destination-in';T.drawImage(S.canvas,0,0);                /* kembalikan transparansi asli */
      g.drawImage(T.canvas,ch[1],0);
    }
  }

  /* ===== efek 2: Getar =====
     Gambar bergetar (geser, putar sedikit) dengan bayangan getaran, dan di-zoom tipis supaya tepi tidak bolong. Gerakan kontinu dari waktu timeline. */
  function shake(g,w,h,p,tm,opaque){
    const a=p.amt/100;if(a<=0)return;
    const k=Math.max(0.2,p.spd/50),u=tm*k*24;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const pos=v=>({
      x:(Math.sin(v)+0.6*Math.sin(v*2.31+1.2))*a*0.018*w,
      y:(Math.cos(v*1.37)+0.6*Math.sin(v*1.93+0.4))*a*0.018*h,
      r:Math.sin(v*0.87+2)*a*0.02
    });
    const z=1+a*0.09;
    const put=(q,al)=>{g.save();g.globalAlpha=al;g.translate(w/2+q.x,h/2+q.y);g.rotate(q.r);g.scale(z,z);g.translate(-w/2,-h/2);g.drawImage(S.canvas,0,0);g.restore()};
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    put(pos(u-0.8),1);
    put(pos(u),0.65);
  }

  /* ===== efek 3 dan 4: Gelombang dan Gelombang Balik =====
     Gambar dipotong jadi strip tipis, tiap strip digeser mengikuti gelombang sinus sehingga gambar meliuk seperti riak.
     ARAH simpangan diatur "Arah gelombang" (derajat): 0 = ke samping (strip horizontal digeser kiri kanan), 60 = miring naik ke kanan,
     90 = naik turun (strip vertikal digeser atas bawah). Nilai negatif = miringnya dibalik (naik ke kiri).
     Gelombang: merambat searah putaran fase positif. Gelombang Balik: merambat dan menyimpang berlawanan arah (dir = -1).
     Nilai bawaan dasar diukur dari video referensi (detik 3,5-5): simpangan puncak sekitar 4-7% lebar layar, sekitar 1 gelombang per tinggi layar,
     dan merambat sekitar 1,3 putaran per detik.
     Pola kekuatan sepanjang clip (supaya tidak kaget): DIAM sebentar di awal, lalu NAIK PELAN sampai puncak, lalu MEREDA sampai akhir clip.
     "Awal pelan" mengatur panjang bagian diam dan naik (0 = langsung kuat di awal clip; 100 = diam 15% dan naik 45% dari panjang clip).
     "Peredam" mengatur seberapa kuat gelombang mereda setelah puncak sampai akhir clip (0 = tetap kuat sampai akhir).
     Semuanya mengikuti PANJANG CLIP, jadi clip yang diperpanjang = gelombang lebih lama.
     Efek diterapkan APA ADANYA pada gambar yang sedang tampil: tepi yang kosong akibat strip bergeser ditutup dengan PEMBESARAN (gambar diperbesar dari tengah
     secukupnya, sebesar simpangan gelombang saat itu, jadi membesar pelan waktu gelombang menguat dan kembali waktu mereda). Tidak lagi disambung dari sisi seberang,
     jadi media yang sudah diperbesar tetap tampil besar dan tidak ada potongan yang "dikembalikan ke ukuran semula". */
  function waveFx(dir){
    return function(g,w,h,p,tm,opaque,rel,dur){
      let env=1;
      if(dur>0){
        const u=Math.min(1,rel/dur),a=p.atk/100,s0=a*0.15,rise=a*0.45,pk=s0+rise;
        if(u<s0)env=0;
        else if(u<pk){const x=(u-s0)/rise;env=x*x*(3-2*x)}
        if(p.dec>0&&u>pk)env*=Math.exp(-((u-pk)/Math.max(1e-6,1-pk))*p.dec/100*5);
      }
      const A=p.amt/100*0.08*w*env;
      if(A<0.3)return;
      const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
      const ph=dir*rel*1.3*(p.spd/50),deg=p.ang||0;
      const th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th);
      const ux=cs,uy=-sn;                                           /* arah simpangan di kanvas: naik ke kanan untuk sudut positif */
      /* gambar diperbesar dari tengah sebesar yang dibutuhkan supaya geseran terjauh (A searah ux, uy) tidak membuka tepi kosong */
      const z=1+2*A*Math.max(Math.abs(ux)/w,Math.abs(uy)/h);
      const Z=ac('z',w,h);
      Z.translate(w/2,h/2);Z.scale(z,z);Z.translate(-w/2,-h/2);Z.drawImage(S.canvas,0,0);
      const src=Z.canvas;
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      if(deg===0){
        /* ke samping: strip horizontal digeser kiri kanan */
        const st=Math.max(1,Math.round(h/320));
        for(let y=0;y<h;y+=st){
          const hh=Math.min(st,h-y),dx=dir*A*Math.sin(2*Math.PI*(p.cnt*(y+hh/2)/h-ph));
          g.drawImage(src,0,y,w,hh,dx,y,w,hh);
        }
        return;
      }
      /* miring atau naik turun: bidang diputar sebesar sudut, strip digeser sepanjang arah simpangan (u), fase berubah sepanjang arah tegak lurusnya (v) */
      const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h);
      const st=Math.max(3,Math.round(Ev/180));
      for(let v=-Ev/2;v<Ev/2;v+=st){
        const fr=(v+st/2+Ev/2)/Ev,dx=dir*A*Math.sin(2*Math.PI*(p.cnt*fr-ph));
        g.save();
        g.translate(w/2,h/2);g.rotate(-th);
        g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();                /* +1 supaya antar strip saling menimpa, tidak ada garis tipis */
        g.setTransform(1,0,0,1,0,0);
        g.drawImage(src,dx*ux,dx*uy);
        g.restore();
      }
    };
  }

  /* ===== efek 5: JJ Tipis (jedag-jedug tipis, versi bersih tanpa glitch) =====
     Kedut SATU KALI saja di awal clip efek, tidak berulang. Taruh clip tepat di ketukan yang mau dikedutkan; mau kedut lagi: duplikat clip efeknya.
     Satu sentakan = tiga gerak halus yang jalan bersamaan dari satu pola waktu: ZOOM sentak, GESER sedikit ke satu arah (arah tetap), dan PUTAR tipis.
     Pola waktunya: naik sangat cepat (sekitar 1/40 detik, dihaluskan supaya tidak ada satu frame yang loncat), lalu mereda mulus ke posisi diam, tanpa pantulan.
     Sengaja TIDAK ada hal yang terlihat seperti glitch: tanpa pecah warna RGB, tanpa bayangan ganda, tanpa pengulangan gambar dari sisi seberang.
     Tepi kosong akibat geser dan putar ditutup dengan zoom tambahan secukupnya (sebesar yang dibutuhkan saat itu, kembali ke 1 waktu gambar diam),
     jadi tepi frame selalu terisi gambar asli.
     Setelah sentakan selesai, clip efek tidak mengubah gambar lagi, jadi clip yang diperpanjang tidak membuat kedutnya berulang. */
  function jj(g,w,h,p,tm,opaque,rel){
    const t=Math.max(0,rel),AT=0.025,k=5+p.dec*0.1;
    let e;
    if(t<AT){const x=t/AT;e=x*x*(3-2*x)}else e=Math.exp(-(t-AT)*k);   /* naik cepat dan halus ke 1, lalu mereda mulus */
    if(t>AT&&e<0.004)return;
    const rd=rng(31),ang=rd()*Math.PI*2,sg=rd()<0.5?-1:1;
    const A=p.amt/100*0.03*Math.min(w,h)*e,r=sg*p.rot*Math.PI/180*e;
    const dx=Math.cos(ang)*A,dy=Math.sin(ang)*A;
    /* zoom sentak, dinaikkan kalau perlu supaya geser dan putar tidak membuka tepi kosong */
    const cover=1+2*Math.max((Math.abs(dx)+Math.abs(r)*h/2+1)/w,(Math.abs(dy)+Math.abs(r)*w/2+1)/h);
    const z=Math.max(1+p.zm/100*e,cover);
    if(e<=0)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.save();
    g.translate(w/2+dx,h/2+dy);g.rotate(r);g.scale(z,z);g.translate(-w/2,-h/2);
    g.drawImage(S.canvas,0,0);
    g.restore();
  }

  /* ===== efek 6: Isi Cermin =====
     Mengusir frame yang kosong: area di sekitar media yang tidak tertutup (sisa letterbox karena rasio beda, media yang dikecilkan, atau media yang digeser)
     diisi dengan CERMIN media itu sendiri. Media dipantulkan bolak-balik melewati tiap tepinya (seperti ubin cermin), jadi sambungan di tepi selalu mulus.
     Efek ini bekerja PER CLIP MEDIA (perLayer): tiap video/gambar di bawah clip efek diolah di lapisannya sendiri, memakai kotak medianya dari preview
     (APK.preview.bounds, sudah termasuk posisi, skala, dan rotasi), lalu hasilnya yang menutup layer di bawahnya. Teks dan bentuk tidak diisi (hanya kalau dipilih
     lewat "Pilih clip tertentu"). Kalau media sudah menutupi seluruh frame, tidak ada yang dikerjakan.
     "Blur isian" melembutkan bagian cermin saja (media aslinya tetap tajam), "Gelapkan isian" menggelapkannya supaya fokus ke media.
     Di kartu pratinjau (tanpa clip sungguhan) dipakai kotak 62% di tengah gambar contoh supaya efeknya kelihatan. */
  function mirrorFill(g,w,h,p){
    const pj=P();let b=null,demo=false;
    if(curClip){
      const q=pj&&pj.width&&APK.preview&&APK.preview.bounds?APK.preview.bounds(curClip.id):null;
      if(!q)return;
      const K=w/pj.width;
      b={cx:q.cx*K,cy:q.cy*K,w:q.w*K,h:q.h*K,rot:+q.rot||0};
    }else{demo=true;b={cx:w/2,cy:h/2,w:w*0.62,h:h*0.62,rot:0}}
    const tw=Math.round(b.w),th=Math.round(b.h);
    if(!(tw>=4&&th>=4))return;
    const rad=b.rot*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
    let Rmax=0,cover=true;
    for(const q of [[0,0],[w,0],[w,h],[0,h]]){
      const dx=q[0]-b.cx,dy=q[1]-b.cy,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;   /* sudut kanvas di ruang media (diputar balik) */
      Rmax=Math.max(Rmax,Math.hypot(dx,dy));
      if(Math.abs(lx)>b.w/2+0.5||Math.abs(ly)>b.h/2+0.5)cover=false;
    }
    if(cover&&!demo)return;   /* media sudah menutupi seluruh frame */
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    /* satu ubin = kotak media yang diluruskan (rotasi dibalik) */
    const T=ac('t',tw,th);
    T.translate(tw/2,th/2);T.rotate(-rad);T.translate(-b.cx,-b.cy);T.drawImage(S.canvas,0,0);
    const bl=p.blur/100*0.05*Math.min(w,h),F=ac('f',w,h);
    const blur=bl>=0.5&&'filter' in F;
    /* ubin dicermin bergantian (ubin ganjil dibalik), disusun di ruang media: pusat, sumbu, dan putar mengikuti media */
    F.translate(b.cx,b.cy);F.rotate(rad);
    const lim=Rmax+Math.hypot(tw,th)/2,nx=Math.min(6,Math.ceil(Rmax/tw)),ny=Math.min(6,Math.ceil(Rmax/th));
    for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++){
      if(Math.hypot(i*tw,j*th)>lim)continue;
      if(!i&&!j&&!blur)continue;   /* ubin tengah = media asli, nanti digambar tajam di atasnya (kecuali blur: perlu agar tepi blur tidak memudar) */
      F.save();
      F.translate(i*tw,j*th);F.scale(i&1?-1:1,j&1?-1:1);
      F.drawImage(T.canvas,-tw/2-0.5,-th/2-0.5,tw+1,th+1);   /* +1 supaya antar ubin saling menimpa, tidak ada garis tipis */
      F.restore();
    }
    F.setTransform(1,0,0,1,0,0);
    let FL=F;
    if(blur){
      /* blur sekali untuk seluruh isian (bukan per ubin, supaya tidak ada sambungan); diperbesar sedikit supaya tepi kanvas tidak memudar */
      const U=ac('u',w,h),m=Math.ceil(bl*2);
      U.filter='blur('+bl.toFixed(1)+'px)';
      U.drawImage(F.canvas,-m,-m,w+2*m,h+2*m);
      U.filter='none';
      FL=U;
    }
    if(p.dim>0){FL.globalCompositeOperation='source-atop';FL.fillStyle='rgba(0,0,0,'+(p.dim/100)+')';FL.fillRect(0,0,w,h);FL.globalCompositeOperation='source-over'}
    g.clearRect(0,0,w,h);
    g.drawImage(FL.canvas,0,0);
    if(demo){
      /* kartu pratinjau: hanya kotak tengah yang dianggap media, sisanya diganti cermin */
      g.save();
      g.translate(b.cx,b.cy);g.rotate(rad);g.beginPath();g.rect(-b.w/2,-b.h/2,b.w,b.h);g.clip();
      g.setTransform(1,0,0,1,0,0);g.drawImage(S.canvas,0,0);
      g.restore();
    }else g.drawImage(S.canvas,0,0);
  }

  const WP=[['amt','Kekuatan',0,100,60],['cnt','Jumlah gelombang',1,8,1],['spd','Kecepatan',10,100,50],['ang','Arah gelombang (0 = ke samping, 60 = miring naik, 90 = naik turun, minus = dibalik)',-90,90,60],['atk','Awal pelan (0 = langsung kuat, makin besar makin lama diam dan naik pelan)',0,100,60],['dec','Peredam (mereda sampai akhir clip, 0 = tetap kuat)',0,100,70]];
  const LIST=[
    {id:'glitch',name:'Glitch RGB',desc:'Layar pecah dan warnanya terpisah',
      params:[['amt','Kekuatan',0,100,60],['spd','Kecepatan',10,100,50]],apply:glitch},
    {id:'shake',name:'Getar',desc:'Layar bergetar dan sedikit ter-zoom',
      params:[['amt','Kekuatan',0,100,50],['spd','Kecepatan',10,100,50]],apply:shake},
    {id:'wave',name:'Gelombang',desc:'Gambar meliuk miring ke atas, arah bisa diatur',len:1.2,params:WP,apply:waveFx(1)},
    {id:'wave2',name:'Gelombang Balik',desc:'Gambar meliuk berlawanan arah, arah bisa diatur',len:1.2,params:WP,apply:waveFx(-1)},
    {id:'jj',name:'JJ Tipis',desc:'Sentak zoom, geser, dan putar tipis satu kali di awal clip, mulus tanpa glitch',len:0.6,
      params:[['amt','Kekuatan geser',0,100,50],['zm','Zoom sentak (%)',0,30,6],['rot','Putaran tipis (derajat, 0 = tanpa putar)',0,10,2],['dec','Kecepatan kembali (makin besar makin cepat)',0,100,60]],apply:jj},
    {id:'mirror',name:'Isi Cermin',desc:'Menutup frame kosong di sekitar media dengan cermin tepinya',len:5,perLayer:true,
      params:[['blur','Blur isian (0 = cermin tajam)',0,100,0],['dim','Gelapkan isian',0,80,0]],apply:mirrorFill}
  ];
  const DEF={};LIST.forEach(e=>DEF[e.id]=e);
  const label=fx=>(DEF[fx&&fx.type]||{name:'Efek'}).name;
  function params(fx){
    const d=DEF[fx&&fx.type],o={};
    if(!d)return o;
    for(const q of d.params){const v=fx.p&&fx.p[q[0]];o[q[0]]=clamp(v!=null&&isFinite(+v)?+v:q[4],q[2],q[3])}
    return o;
  }
  /* waktu sejak clip efek pemilik fx ini mulai, dan lama clipnya (fx dicari lewat referensi objek; di luar project, misalnya kartu pratinjau, dipakai waktu apa adanya) */
  function relOf(fx,tm){
    const p=P();
    if(p)for(const tr of p.tracks)for(const c of tr.clips)if(c.fx===fx)return{rel:Math.max(0,tm-c.start),dur:c.dur};
    return{rel:tm,dur:0};
  }
  /* terapkan efek fx ke SELURUH isi kanvas g (tm = waktu timeline dalam detik, opaque = latar kanvas tidak transparan, rel dan dur = detik sejak efek mulai dan lama efek, opsional) */
  function run(g,fx,tm,opaque,rel,dur){
    const d=fx&&DEF[fx.type];if(!d)return;
    const cv=g.canvas;if(!cv.width||!cv.height)return;
    /* efek per-layer hanya jalan lewat layerEnd() (curClip terisi) atau kartu pratinjau (memberi rel); dipanggil preview untuk kanvas utama = dilewati */
    if(d.perLayer&&rel==null&&!curClip)return;
    const o=rel==null?relOf(fx,tm):{rel,dur:dur||0};
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    try{d.apply(g,cv.width,cv.height,params(fx),tm,!!opaque,o.rel,o.dur)}catch(_){}
    g.restore();
  }

  /* ===== dipakai preview.js ===== */
  /* clip efek bertarget yang aktif di waktu t: Map id clip target -> daftar fx (null kalau tidak ada). Track tersembunyi dilewati.
     Efek perLayer tanpa target: targetnya semua clip media (video/gambar) yang sedang tampil di track di bawah clip efek. */
  function targets(p,t){
    let map=null;
    const add=(id,f)=>{map=map||new Map();const a=map.get(id);if(a)a.push(f);else map.set(id,[f])};
    p.tracks.forEach((tr,ti)=>{
      if(tr.hidden)return;
      for(const c of tr.clips){
        const f=c.fx;
        if(!f||t<c.start||t>=c.start+c.dur-1e-6)continue;
        if(Array.isArray(f.targets)){for(const id of f.targets)add(id,f);continue}
        const d=DEF[f.type];
        if(!d||!d.perLayer)continue;
        for(let k=ti+1;k<p.tracks.length;k++){
          const lt=p.tracks[k];
          if(lt.hidden||lt.kind==='audio')continue;
          for(const x of lt.clips){
            if(x.fx||!x.mediaId||t<x.start||t>=x.start+x.dur-1e-6)continue;
            const m=p.media.find(q=>q.id===x.mediaId);
            if(m&&(m.type==='image'||m.type==='video'))add(x.id,f);
          }
        }
      }
    });
    return map;
  }
  /* satu clip digambar dulu ke lapisan terpisah (transparan), lalu efek diterapkan ke lapisan itu saja, baru ditempel ke kanvas utama */
  let layer=null;
  function layerBegin(main,K){
    const cv=main.canvas;
    if(!layer)layer=document.createElement('canvas').getContext('2d');
    const lc=layer.canvas;
    if(lc.width!==cv.width||lc.height!==cv.height){lc.width=cv.width;lc.height=cv.height}
    layer.setTransform(1,0,0,1,0,0);layer.globalAlpha=1;layer.globalCompositeOperation='source-over';
    if('filter' in layer)layer.filter='none';
    layer.clearRect(0,0,lc.width,lc.height);
    layer.setTransform(K,0,0,K,0,0);
    return layer;
  }
  function layerEnd(main,c,list,t){
    curClip=c;
    try{for(const fx of list)run(layer,fx,t,false)}finally{curClip=null}
    main.save();main.setTransform(1,0,0,1,0,0);main.globalAlpha=1;main.globalCompositeOperation=c.blend||'source-over';
    if('filter' in main)main.filter='none';
    main.drawImage(layer.canvas,0,0);
    main.restore();
  }

  /* ===== menambah clip efek di playhead (selalu di layer paling atas, supaya mengolah semua yang ada di bawahnya) ===== */
  function add(type){
    const p=P(),d=DEF[type];if(!p||!d)return null;
    APK.history.record();
    const t=APK.preview.time,dur=d.len||DUR;
    let tr=p.tracks[0];
    const ok=x=>!!x&&x.kind==='video'&&!x.locked&&!x.clips.some(c=>t<c.start+c.dur-1e-6&&t+dur>c.start+1e-6);
    if(!ok(tr)){
      tr={id:uid('t_'),kind:'video',name:'Video '+(p.tracks.filter(x=>x.kind==='video').length+1),muted:false,clips:[]};
      p.tracks.unshift(tr);
    }
    const c={id:uid('c_'),mediaId:null,start:t,in:0,dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},fx:{type}};
    tr.clips.push(c);
    APK.timeline.select(c.id);APK.timeline.commit();
    return c;
  }

  /* ===== daftar clip yang bisa dijadikan target ===== */
  const overlap=(a,b)=>a.start<b.start+b.dur-1e-6&&a.start+a.dur>b.start+1e-6;
  function candidates(fxc){
    const p=P(),out=[];
    for(const tr of p.tracks){
      if(tr.kind==='audio')continue;
      for(const x of tr.clips){
        if(x.fx||x.id===fxc.id)continue;
        const m=x.mediaId?p.media.find(q=>q.id===x.mediaId):null;
        if(x.mediaId&&!m)continue;
        if(!m&&!x.text&&!(x.shape&&x.shape.type!=='group'))continue;   /* layer grup kosong tidak terlihat */
        out.push({c:x,tr,m});
      }
    }
    out.sort((a,b)=>a.c.start-b.c.start);
    return out;
  }
  function clipName(c,m){
    if(m)return m.name;
    if(c.shape)return '◆ '+(APK.shapes&&APK.shapes.label?APK.shapes.label(c.shape.type):'Bentuk');
    if(c.text)return (c.stk?'☺ ':'T ')+String(c.text.content).split('\n')[0].slice(0,28);
    return '(clip)';
  }
  const mmss=s=>{s=Math.max(0,s);return Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0')};
  function listHtml(fxc,locked){
    const L=candidates(fxc),s0=fxc.start,e0=fxc.start+fxc.dur;
    if(!L.length)return '<p class="kf-hint">Belum ada clip video, gambar, teks, atau bentuk di timeline.</p>';
    return '<div class="kf-bar"><button type="button" class="btn" data-fxall="1"'+(locked?' disabled':'')+'>Pilih semua</button><button type="button" class="btn" data-fxall="0"'+(locked?' disabled':'')+'>Kosongkan</button></div><div class="fx-tlist">'+
      L.slice(0,80).map(z=>{
        const x=z.c,inr=x.start<e0-1e-6&&x.start+x.dur>s0+1e-6;
        return `<label class="fx-tg${inr?'':' off'}"><input type="checkbox" data-fxt="${esc(x.id)}"${locked?' disabled':''}><span><b>${esc(clipName(x,z.m))}</b><small>${esc(z.tr.name)} · ${mmss(x.start)} sampai ${mmss(x.start+x.dur)}${inr?'':' · di luar waktu efek'}</small></span></label>`;
      }).join('')+'</div>';
  }
  /* baris slider + angka untuk parameter efek (berbeda tiap jenis efek, jadi dibuat ulang saat jenis efek diganti) */
  function rowsHtml(type,locked){
    const d=DEF[type],dis=locked?' disabled':'';
    return (d?d.params:[]).map(q=>`<div class="pr-f"><div class="pr-lab"><span>${esc(q[1])}</span></div><div class="pr-row"><input type="range" data-fxp="${q[0]}" min="${q[2]}" max="${q[3]}" step="1"${dis}><input type="number" data-fxp="${q[0]}" min="${q[2]}" max="${q[3]}" step="1"${dis}></div></div>`).join('');
  }

  /* ===== panel Properti untuk clip efek ===== */
  function panel(s,locked){
    const fx=s.c.fx,dis=locked?' disabled':'';
    const opts=LIST.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('');
    return `<h3>Properti</h3><div class="pr-name">✦ ${esc(label(fx))}</div>${locked?'<p class="lock-note">Layer ini terkunci. Klik ikon gembok di timeline untuk membuka kunci.</p>':''}
      <label>Waktu mulai (detik)<input type="number" data-t="start" min="0" step="0.01"${dis}></label>
      <label>Durasi (detik)<input type="number" data-t="dur" min="0.1" step="0.01"${dis}></label>
      <label>Waktu selesai (detik)<input type="number" data-end readonly></label>
      <h3 class="kf-title">Efek</h3>
      <label>Jenis efek<select data-fxp="type"${dis}>${opts}</select></label>
      <div id="fx-params" data-type=""></div>
      <h3 class="kf-title">Berlaku untuk</h3>
      <div class="tx-row"><label><input type="radio" name="fxm" data-fxm="all"${dis}>Semua layer di bawah</label><label><input type="radio" name="fxm" data-fxm="pick"${dis}>Pilih clip tertentu</label></div>
      <div id="fx-targets" class="fx-targets" hidden></div>
      <p class="kf-hint">Efek ini clip sendiri, terpisah dari media: geser, tarik tepinya, belah, atau duplikat di timeline. Efek hanya tampil selama durasi clip efek. "Semua layer di bawah" mengikuti urutan layer, jadi hanya track yang berada di bawah track clip efek yang terkena.</p>`;
  }
  const owns=el=>!!el&&!!el.dataset&&(el.dataset.fxp!=null||el.dataset.fxm!=null||el.dataset.fxt!=null);
  function fill(el,c){
    const fx=c.fx;if(!fx)return;
    const d=el.dataset;
    if(d.fxp!=null){
      if(d.fxp==='type')el.value=fx.type;
      else{const v=params(fx)[d.fxp];if(v!=null)el.value=v}
    }
    else if(d.fxm!=null)el.checked=(d.fxm==='pick')===Array.isArray(fx.targets);
    else if(d.fxt!=null)el.checked=Array.isArray(fx.targets)&&fx.targets.includes(d.fxt);
  }

  const pn=$('panel-props'),T=APK.timeline;
  const sel=()=>{const s=T.selectedClip();return s&&s.c.fx&&!s.tr.locked?s:null};
  let editing=false;

  /* parameter, daftar target, dan judul dibuat ulang tiap refresh (jenis efek dan isi timeline bisa berubah kapan saja) */
  function syncPanel(){
    const s=T.selectedClip(),box=$('fx-targets');
    if(!s||!s.c.fx||!box)return;
    const fx=s.c.fx,nm=pn.querySelector('.pr-name');
    if(nm){const t='✦ '+label(fx);if(nm.textContent!==t)nm.textContent=t}
    const pb=$('fx-params');
    if(pb){
      if(pb.dataset.type!==fx.type){pb.innerHTML=rowsHtml(fx.type,!!s.tr.locked);pb.dataset.type=fx.type}
      pb.querySelectorAll('[data-fxp]').forEach(el=>{if(document.activeElement!==el)fill(el,s.c)});
    }
    const pick=Array.isArray(fx.targets);
    box.hidden=!pick;
    if(!pick){box.dataset.sig='';box.innerHTML='';return}
    const html=listHtml(s.c,!!s.tr.locked);
    if(box.dataset.sig!==html){box.innerHTML=html;box.dataset.sig=html}
    box.querySelectorAll('[data-fxt]').forEach(el=>{el.checked=fx.targets.includes(el.dataset.fxt)});
  }
  /* nama dan warna clip efek di timeline (timeline.js tidak mengenal clip efek, jadi diberi tampilan setelah tiap render) */
  function decorate(){
    const p=P(),root=$('tl-content');if(!p||!root)return;
    const m=new Map();
    for(const tr of p.tracks)for(const c of tr.clips)if(c.fx)m.set(c.id,c);
    if(!m.size)return;
    root.querySelectorAll('.clip').forEach(el=>{
      const c=m.get(el.dataset.id);if(!c)return;
      el.classList.add('fx');
      const n='✦  '+label(c.fx)+(Array.isArray(c.fx.targets)?' · '+c.fx.targets.length+' clip':'');
      el.title=n;
      const sp=el.querySelector('span');if(sp)sp.textContent=n;
    });
  }

  /* slider dan angka parameter */
  pn.addEventListener('input',e=>{
    const el=e.target,d=el.dataset;if(d.fxp==null||el.tagName==='SELECT')return;
    const s=sel();if(!s)return;
    const def=DEF[s.c.fx.type],q=def&&def.params.find(x=>x[0]===d.fxp);if(!q)return;
    const v=parseFloat(el.value);if(!isFinite(v))return;
    if(!editing){APK.history.record();editing=true}
    s.c.fx.p=Object.assign({},s.c.fx.p,{[d.fxp]:clamp(v,q[2],q[3])});
    T.touch();APK.properties.refresh();
  });
  /* fase capture: harus jalan sebelum pendengar change milik properties.js, karena ia mengisi ulang semua kontrol dari data lama */
  pn.addEventListener('change',e=>{
    const el=e.target,d=el.dataset;
    if(d.fxp!=null){
      editing=false;
      if(el.tagName==='SELECT'){
        const s=sel();if(!s||!DEF[el.value])return;
        APK.history.record();s.c.fx.type=el.value;delete s.c.fx.p;T.commit();
      }
      return;
    }
    if(d.fxm!=null){
      const s=sel();if(!s)return;
      APK.history.record();
      const fx=s.c.fx;
      if(d.fxm==='all')delete fx.targets;
      else if(!Array.isArray(fx.targets))fx.targets=candidates(s.c).filter(z=>overlap(z.c,s.c)).map(z=>z.c.id);   /* mulai dari clip yang waktunya bersinggungan */
      T.commit();return;
    }
    if(d.fxt!=null){
      const s=sel();if(!s)return;
      APK.history.record();
      const fx=s.c.fx,cur=Array.isArray(fx.targets)?fx.targets:[];
      fx.targets=el.checked?cur.filter(x=>x!==d.fxt).concat(d.fxt):cur.filter(x=>x!==d.fxt);
      T.commit();
    }
  },true);
  pn.addEventListener('click',e=>{
    const b=e.target.closest('[data-fxall]');if(!b)return;
    const s=sel();if(!s)return;
    APK.history.record();
    s.c.fx.targets=b.dataset.fxall==='1'?candidates(s.c).map(z=>z.c.id):[];
    T.commit();
  });

  /* ===== pembungkus (pola yang sama dengan layers-ui.js, jadi timeline.js dan properties.js hanya perlu sedikit perubahan) ===== */
  const oldRefresh=APK.properties.refresh;
  APK.properties.refresh=function(f){oldRefresh(f);decorate();syncPanel()};
  /* duplikat dan split membuat salinan clip: data efek salinan harus terpisah dari aslinya */
  function find(id){for(const tr of P().tracks){const c=tr.clips.find(x=>x.id===id);if(c)return c}return null}
  function unshare(){for(const id of T.selectedIds()){const c=find(id);if(c&&c.fx)c.fx=clone(c.fx)}}
  for(const n of ['duplicate','split']){const o=T[n];T[n]=function(){o.apply(this,arguments);unshare()}}

  return{LIST,DEF,label,params,run,targets,layerBegin,layerEnd,add,panel,owns,fill};
})();
