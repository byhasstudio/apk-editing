/* Efek clip tambahan: Cermin Bayangan
   Mirip Isi Cermin (js/fxclip.js), tapi frame kosong di sekitar media diisi BAYANGAN dari media itu sendiri, bukan cermin tajam:
   – Mode 1: salinan media diperbesar sampai menutup seluruh frame, lalu diburamkan (gaya blur background CapCut / Instagram)
   – Mode 2: cermin tepi media (dipantulkan bolak-balik seperti ubin cermin), lalu diburamkan
   – Mode 3: gabungan keduanya (salinan diperbesar sebagai dasar, cermin tepi di atasnya supaya sambungan di tepi media tetap mulus)
   – Mode 4 (bawaan): BAYANGAN TEPI. Cermin tepi yang masih kelihatan jelas bentuknya, tipis buramnya di dekat media dan makin buram
     serta makin gelap ke arah pinggir frame. Tepi media sendiri dipudarkan (feather) ke dalam bayangan, jadi tidak ada garis tepi keras:
     gambar tajam, lalu berangsur jadi bayangan cermin yang kabur dan gelap.
   Kalau clip tertentu dipilih lewat "Pilih clip tertentu", efek bekerja PER CLIP MEDIA seperti Isi Cermin lama: tiap video/gambar yang dipilih diolah di lapisannya sendiri
   dengan kotak medianya dari preview (APK.preview.bounds, sudah termasuk posisi, skala, dan rotasi). Jadi media bisa digeser, di-scale,
   dan diputar seperti clip biasa, dan bayangannya ikut menyesuaikan sehingga frame tidak pernah kosong. Media yang sudah menutupi seluruh frame tidak diubah.
   Bayangan statis (tidak ada gerak sendiri); pusat salinan hanya mengikuti media sedikit (30%) supaya terasa menyatu tanpa membuka celah.
   Pengaturan: Mode, Blur, Zoom bayangan, Kecerahan, Saturasi, Opasitas, Tint (kekuatan dan rona), Bayangan tepi media utama,
   dan khusus mode 4: Lebar pudar tepi, Blur dekat tepi.
   Bisa dipakai bersamaan dengan efek clip lain (dipasang di clip efek sendiri).
   Di kartu pratinjau (tanpa clip sungguhan) dipakai kotak 62% di tengah gambar contoh supaya efeknya kelihatan.
   MODE KANVAS UTAMA (v2): kalau clip efek ini TIDAK memilih clip tertentu ("Semua layer di bawah"), efek berjalan di kanvas utama dan mengisi frame
   kosong dari GABUNGAN semua layer yang tampil saat itu di track di bawah clip efek (video, gambar, teks, bentuk, dan hasil efek lain yang urutannya
   lebih bawah). Kotak isian = kotak satu-satunya media yang tampil, atau gabungan kotak beberapa media
   (tanpa putaran). Media berganti di tengah clip efek: isiannya langsung ikut karena dihitung ulang tiap frame.
   Isi Cermin (js/fxclip.js) juga dialihkan ke jalur ini lewat bagian bawah file ini. preview.js membiarkan kanvas dasar transparan selama ada clip efek
   berjenis ini yang aktif (entry.alpha), lalu menambahkan latar hitam di akhir frame.
   ISI SEMUA FRAME KOSONG (v3): efek clip lain (Split Mirror, Irisan Pulsa, Gelombang, JJ Tipis, dan seterusnya) bisa membuat bagian frame jadi kosong
   (transparan) di DALAM kotak media, bukan hanya di luarnya. Karena itu preview.js sekarang menjalankan Isi Cermin dan Cermin Bayangan (kanvas utama) PALING AKHIR,
   setelah semua efek clip lain selesai, apa pun urutan track-nya, dan menyerahkan salinan media TANPA efek lewat APK.fxclip.fillSrc (kanvas, atau null kalau
   tidak ada efek clip lain yang aktif). Ubin cermin, salinan diperbesar, dan bayangan tepi diambil dari salinan bersih itu (dengan hasil akhir sebagai cadangan
   untuk area yang tidak ada di salinan bersih), lalu digambar DI BAWAH hasil akhir, jadi setiap area transparan, di dalam maupun di luar media, terisi media saat itu.
   Pengaturan "Isi area kosong akibat efek clip lain" (hole) mematikan perilaku ini (0) atau menyalakannya (1, bawaan). Proyek lama tanpa nilai ini memakai 1.
   Dimuat setelah fxsplitmirror.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const nz=(v,d)=>(v==null||isNaN(v))?d:+v;   /* parameter lama (proyek tersimpan sebelum mode 4) belum punya nilai ini: pakai bawaan */
  const P=()=>APK.project&&APK.project.current;

  /* salinan kanvas utama TANPA efek clip (diisi preview.js sebelum menjalankan efek isi, null kalau tidak ada efek clip lain yang aktif) */
  F.fillSrc=null;

  /* clip media yang sedang diolah: fxclip.js menyimpannya di variabel privat, jadi dicatat lagi di sini lewat pembungkus layerEnd */
  let cur=null;
  const oldEnd=F.layerEnd;
  if(typeof oldEnd==='function'){
    F.layerEnd=function(main,c){
      cur=c;
      try{return oldEnd.apply(this,arguments)}finally{cur=null}
    };
  }

  /* clip efek pemilik fx yang sedang dijalankan di KANVAS UTAMA (bukan lewat layerEnd per layer): dicatat lewat pembungkus run.
     Kartu pratinjau memberi rel sendiri, jadi tidak dihitung sebagai kanvas utama. */
  let owner=null;
  function ownerOf(fx){
    const pj=P();if(!pj)return null;
    for(let i=0;i<pj.tracks.length;i++)for(const c of pj.tracks[i].clips)if(c.fx===fx)return{c:c,ti:i};
    return null;
  }
  const oldRun=F.run;
  if(typeof oldRun==='function'){
    F.run=function(g,fx,tm,opaque,rel){
      const prev=owner;
      owner=(rel==null&&!cur)?ownerOf(fx):null;
      try{return oldRun.apply(this,arguments)}finally{owner=prev}
    };
  }
  /* kotak isian di koordinat project: media (video/gambar) yang tampil saat ini di track di bawah clip efek. Satu media = kotaknya sendiri (dengan putaran);
     beberapa media = kotak pembungkus gabungannya tanpa putaran. Kotak diambil dari preview (APK.preview.bounds), yang sudah terisi oleh layer di bawah. */
  function boxBelow(){
    const pj=P();
    if(!owner||!pj||!APK.preview||!APK.preview.bounds)return null;
    const t=APK.preview.time,boxes=[];
    for(let k=owner.ti+1;k<pj.tracks.length;k++){
      const tr=pj.tracks[k];
      if(tr.hidden||tr.kind==='audio')continue;
      for(const x of tr.clips){
        if(x.fx||!x.mediaId||t<x.start||t>=x.start+x.dur-1e-6)continue;
        const m=pj.media.find(q=>q.id===x.mediaId);
        if(!m||(m.type!=='image'&&m.type!=='video'))continue;
        const bb=APK.preview.bounds(x.id);
        if(bb&&bb.w>0&&bb.h>0)boxes.push(bb);
      }
    }
    if(!boxes.length)return null;
    if(boxes.length===1){const b1=boxes[0];return{cx:b1.cx,cy:b1.cy,w:b1.w,h:b1.h,rot:+b1.rot||0}}
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const bb of boxes){
      const a=(+bb.rot||0)*Math.PI/180,ca=Math.abs(Math.cos(a)),sa=Math.abs(Math.sin(a)),hw=(bb.w*ca+bb.h*sa)/2,hh=(bb.w*sa+bb.h*ca)/2;
      x0=Math.min(x0,bb.cx-hw);x1=Math.max(x1,bb.cx+hw);y0=Math.min(y0,bb.cy-hh);y1=Math.max(y1,bb.cy+hh);
    }
    return{cx:(x0+x1)/2,cy:(y0+y1)/2,w:x1-x0,h:y1-y0,rot:0};
  }

  /* kanvas bantu */
  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.shadowBlur=0;g.shadowColor='rgba(0,0,0,0)';g.shadowOffsetX=0;g.shadowOffsetY=0;
    g.clearRect(0,0,w,h);
    return g;
  }

  /* hanya BAYANGAN kotak media yang tergambar (kotak sendiri jauh di luar kanvas, bayangannya digeser balik), jadi hasilnya
     tanjakan alfa halus: 1 di dalam kotak, 0 di luar, lebar peralihan sekitar 2 x sb. grow > 0 membesarkan kotak, grow < 0 mengecilkan.
     Semua ukuran (grow, sb, off) dalam piksel kanvas isian (sudah dikali q); kotak b dalam piksel kanvas penuh. */
  function rectShadow(G,b,cs,sn,q,grow,sb,off){
    G.save();
    G.setTransform(q*cs,q*sn,-q*sn,q*cs,b.cx*q-off,b.cy*q);
    G.shadowColor='#000';G.shadowBlur=sb;G.shadowOffsetX=off;G.shadowOffsetY=0;
    G.fillStyle='#000';
    const gq=grow/q;
    G.fillRect(-b.w/2-gq,-b.h/2-gq,b.w+2*gq,b.h+2*gq);
    G.restore();
  }

  function mirrorShadow(g,w,h,p){
    /* kotak media (posisi, ukuran, putaran) dalam piksel kanvas */
    const pj=P();let b=null,demo=false;
    if(cur){
      const q=pj&&pj.width&&APK.preview&&APK.preview.bounds?APK.preview.bounds(cur.id):null;
      if(!q)return;
      const K=w/pj.width;
      b={cx:q.cx*K,cy:q.cy*K,w:q.w*K,h:q.h*K,rot:+q.rot||0};
    }else if(owner){
      /* kanvas utama: kotak dari media yang tampil di bawah clip efek; tidak ada media = tidak ada yang diisi */
      const mb=boxBelow();
      if(!mb||!pj||!pj.width)return;
      const K=w/pj.width;
      b={cx:mb.cx*K,cy:mb.cy*K,w:mb.w*K,h:mb.h*K,rot:+mb.rot||0};
    }else{demo=true;b={cx:w/2,cy:h/2,w:w*0.62,h:h*0.62,rot:0}}
    const tw=Math.round(b.w),th=Math.round(b.h);
    if(!(tw>=4&&th>=4))return;
    const rad=b.rot*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
    const corners=[[0,0],[w,0],[w,h],[0,h]];
    let cover=true,Rmax=0;
    for(const pt of corners){
      const dx=pt[0]-b.cx,dy=pt[1]-b.cy,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;   /* sudut kanvas di ruang media (diputar balik) */
      Rmax=Math.max(Rmax,Math.hypot(dx,dy));
      if(Math.abs(lx)>b.w/2+0.5||Math.abs(ly)>b.h/2+0.5)cover=false;
    }
    /* v3: ada efek clip lain yang aktif (salinan bersih tersedia) = ada kemungkinan bolong di dalam kotak media, jadi tetap diisi walau kotak menutupi frame */
    const fs=F.fillSrc,hole=!!(owner&&!cur&&fs&&fs.width===w&&fs.height===h&&nz(p.hole,1)>=0.5);
    if(cover&&!demo&&!hole)return;   /* media sudah menutupi seluruh frame */

    const mode=Math.round(p.mode);
    const bl=p.blur/100*0.08*Math.min(w,h);   /* radius blur dalam piksel kanvas */
    const hasF='filter' in g;
    /* isian digambar di resolusi lebih kecil kalau diburamkan kuat: jauh lebih ringan dan hasilnya sama karena toh buram */
    const q=hasF?(bl>=10?0.25:bl>=4?0.5:1):(bl>2?clamp(3/bl,0.04,1):1);
    const lw=Math.max(1,Math.ceil(w*q)),lh=Math.max(1,Math.ceil(h*q));

    /* salin frame asli (media di lapisan transparan, sudah kena efek clip lain di bawahnya) */
    const S=ac('ms_s',w,h);S.drawImage(g.canvas,0,0);
    /* sumber ubin: salinan bersih media (tanpa efek) kalau ada, dengan hasil akhir S sebagai cadangan di area yang tidak ada di salinan bersih */
    let SRC=S;
    if(hole){
      const KS=ac('ms_k',w,h);
      KS.drawImage(fs,0,0,w,h);
      KS.globalCompositeOperation='destination-over';
      KS.drawImage(S.canvas,0,0);
      KS.globalCompositeOperation='source-over';
      SRC=KS;
    }
    /* ubin = kotak media yang diluruskan (rotasi dibalik), diambil di resolusi isian */
    const tcw=Math.max(1,Math.round(tw*q)),tch=Math.max(1,Math.round(th*q));
    const T=ac('ms_t',tcw,tch);
    T.scale(tcw/tw,tch/th);
    T.translate(tw/2,th/2);T.rotate(-rad);T.translate(-b.cx,-b.cy);T.drawImage(SRC.canvas,0,0);

    /* isian mentah (belum buram), koordinatnya tetap koordinat kanvas lewat A.scale(q,q) */
    const A=ac('ms_a',lw,lh);
    A.scale(q,q);
    if(mode===1||mode===3){
      /* salinan diperbesar. Pusat mengikuti media 30%; skala dihitung supaya seluruh frame pasti tertutup (plus cadangan untuk tepi blur) */
      const c0x=w/2+(b.cx-w/2)*0.3,c0y=h/2+(b.cy-h/2)*0.3,mg=bl*2;
      let k=1;
      for(const pt of corners){
        const dx=pt[0]-c0x,dy=pt[1]-c0y,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
        k=Math.max(k,(Math.abs(lx)+mg)*2/tw,(Math.abs(ly)+mg)*2/th);
      }
      k*=Math.max(1,p.zm/100);
      A.save();
      A.translate(c0x,c0y);A.rotate(rad);A.scale(k,k);
      A.drawImage(T.canvas,-tw/2,-th/2,tw,th);
      A.restore();
    }
    if(mode===2||mode===3||mode===4){
      /* cermin tepi: ubin dicermin bergantian (ubin ganjil dibalik), disusun di ruang media: pusat, sumbu, dan putar mengikuti media */
      A.save();
      A.globalAlpha=mode===3?0.6:1;
      A.translate(b.cx,b.cy);A.rotate(rad);
      const lim=Rmax+Math.hypot(tw,th)/2,nx=Math.min(6,Math.ceil(Rmax/tw)),ny=Math.min(6,Math.ceil(Rmax/th));
      for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++){
        if(Math.hypot(i*tw,j*th)>lim)continue;
        A.save();
        A.translate(i*tw,j*th);A.scale(i&1?-1:1,j&1?-1:1);
        A.drawImage(T.canvas,-tw/2-0.5,-th/2-0.5,tw+1,th+1);   /* +1 supaya antar ubin saling menimpa, tidak ada garis tipis */
        A.restore();
      }
      A.restore();
    }

    /* blur sekali untuk seluruh isian (bukan per ubin, supaya tidak ada sambungan); diperbesar sedikit supaya tepi kanvas tidak memudar */
    let FL=A;
    if(hasF&&bl*q>=0.5){
      const B=ac('ms_b',lw,lh),m=Math.ceil(bl*q*2);
      B.filter='blur('+(bl*q).toFixed(1)+'px)';
      B.drawImage(A.canvas,-m,-m,lw+2*m,lh+2*m);
      B.filter='none';
      FL=B;
    }

    /* mode 4: bayangan tepi. Tiga lapis disusun dengan topeng jarak dari tepi media:
       (1) cermin dengan blur tipis (dekat media), (2) cermin dengan blur penuh yang makin kelihatan ke arah luar, (3) gelap yang makin pekat ke luar.
       Tepi media sendiri dipudarkan ke dalam (topeng Mi) supaya peralihan dari gambar tajam ke bayangan tidak punya garis tepi. */
    let Mi=null,fd=0;
    if(mode===4){
      const mn=Math.min(w,h);
      fd=clamp(nz(p.fd,40),0,100)/100*0.12*mn*q;                 /* separuh lebar peralihan, dalam piksel kanvas isian */
      const off=(w*4+tw*2)*q;
      /* lapis dekat: blur tipis */
      let FN=A;
      const bn=clamp(nz(p.nb,15),0,100)/100*0.04*mn;
      if(hasF&&bn*q>=0.5){
        const N=ac('ms_n',lw,lh),m=Math.ceil(bn*q*2);
        N.filter='blur('+(bn*q).toFixed(1)+'px)';
        N.drawImage(A.canvas,-m,-m,lw+2*m,lh+2*m);
        N.filter='none';
        FN=N;
      }
      /* topeng luar Mo: alfa 0 tepat di tepi media, naik ke 1 sejauh dua kali fd ke luar */
      const Mo=ac('ms_mo',lw,lh);
      Mo.fillStyle='#000';Mo.fillRect(0,0,lw,lh);
      if(fd>=1){
        Mo.globalCompositeOperation='destination-out';
        rectShadow(Mo,b,cs,sn,q,fd,fd,off);
        Mo.globalCompositeOperation='source-over';
        /* topeng dalam Mi: alfa 1 jauh di dalam media, 0 tepat di tepinya */
        Mi=ac('ms_mi',lw,lh);
        rectShadow(Mi,b,cs,sn,q,-fd,fd,off);
      }
      const F4=ac('ms_f',lw,lh);
      F4.drawImage(FN.canvas,0,0);
      const C=ac('ms_c',lw,lh);
      C.drawImage(FL.canvas,0,0);
      C.globalCompositeOperation='destination-in';
      C.drawImage(Mo.canvas,0,0);
      C.globalCompositeOperation='source-over';
      F4.drawImage(C.canvas,0,0);
      /* gelap bertahap ke arah pinggir: pakai parameter "Bayangan tepi" sebagai kekuatannya */
      const dk=clamp(nz(p.edge,35)/100,0,1)*0.8;
      if(dk>0){
        const D=ac('ms_d',lw,lh);
        D.fillStyle='#000';D.fillRect(0,0,lw,lh);
        D.globalCompositeOperation='destination-in';
        D.drawImage(Mo.canvas,0,0);
        D.globalCompositeOperation='source-over';
        F4.globalAlpha=dk;F4.drawImage(D.canvas,0,0);F4.globalAlpha=1;
      }
      FL=F4;
    }
    FL.setTransform(1,0,0,1,0,0);
    /* tint warna (hanya di area isian yang terisi) */
    if(p.tint>0){
      FL.globalCompositeOperation='source-atop';
      FL.fillStyle='hsla('+Math.round(p.hue)+',80%,50%,'+(p.tint/100*0.7).toFixed(2)+')';
      FL.fillRect(0,0,lw,lh);
      FL.globalCompositeOperation='source-over';
    }
    /* kecerahan dan saturasi: 50 = asli */
    const br=0.3+1.4*p.bri/100,sa=p.sat/50;
    if(!hasF&&Math.abs(br-1)>0.01){
      FL.globalCompositeOperation='source-atop';
      FL.fillStyle=br<1?'rgba(0,0,0,'+(1-br).toFixed(2)+')':'rgba(255,255,255,'+((br-1)*0.6).toFixed(2)+')';
      FL.fillRect(0,0,lw,lh);
      FL.globalCompositeOperation='source-over';
    }

    /* susun hasil: bayangan paling bawah, lalu bayangan tepi media, lalu media asli yang tajam di atasnya */
    g.clearRect(0,0,w,h);
    g.save();
    g.globalAlpha=clamp(p.op/100,0,1);
    g.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in g)g.imageSmoothingQuality='high';
    if(hasF&&(Math.abs(br-1)>0.01||Math.abs(sa-1)>0.01))g.filter='brightness('+br.toFixed(2)+') saturate('+sa.toFixed(2)+')';
    g.drawImage(FL.canvas,0,0,lw,lh,0,0,w,h);
    g.restore();

    /* bayangan lembut di tepi media utama (hanya bayangannya yang tergambar: kotak digambar jauh di luar layar lalu bayangannya digeser balik).
       Mode 4 tidak memakainya: gelap tepinya sudah ikut di dalam bayangan bertahap di atas. */
    if(p.edge>0&&mode!==4){
      const sz=p.edge/100*0.06*Math.min(w,h),OFF=w*4+tw*2;
      g.save();
      g.setTransform(cs,sn,-sn,cs,b.cx-OFF,b.cy);
      g.shadowColor='rgba(0,0,0,'+(0.35+0.4*p.edge/100).toFixed(2)+')';
      g.shadowBlur=sz;g.shadowOffsetX=OFF;g.shadowOffsetY=0;
      g.fillStyle='#000';
      g.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      g.restore();
    }

    /* media asli di atas. Mode 4: tepinya dipudarkan ke dalam bayangan lewat topeng Mi */
    let MED=S;
    if(Mi){
      /* cincin pudar: alfa (1 - Mi) hanya DI DALAM kotak media, 0 di luarnya. Dengan begitu hanya tepi media yang memudar;
         isi lain di luar kotak (teks, bentuk) tetap utuh. */
      const R=ac('ms_r',lw,lh);
      R.setTransform(q*cs,q*sn,-q*sn,q*cs,b.cx*q,b.cy*q);
      R.fillStyle='#000';R.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      R.setTransform(1,0,0,1,0,0);
      R.globalCompositeOperation='destination-out';
      R.drawImage(Mi.canvas,0,0);
      R.globalCompositeOperation='source-over';
      MED=ac('ms_m',w,h);
      MED.drawImage(S.canvas,0,0);
      MED.globalCompositeOperation='destination-out';
      MED.drawImage(R.canvas,0,0,lw,lh,0,0,w,h);
      MED.globalCompositeOperation='source-over';
    }
    if(demo){
      /* kartu pratinjau: hanya kotak tengah yang dianggap media */
      g.save();
      g.translate(b.cx,b.cy);g.rotate(rad);g.beginPath();
      g.rect(-b.w/2,-b.h/2,b.w,b.h);g.clip();
      g.setTransform(1,0,0,1,0,0);g.drawImage(MED.canvas,0,0);
      g.restore();
    }else g.drawImage(MED.canvas,0,0);
  }

  /* ===== definisi efek ===== */
  const HOLE=['hole','Isi juga area kosong akibat efek clip lain (0 = tidak, 1 = ya; berlaku saat "Semua layer di bawah")',0,1,1];
  const entry={
    id:'mirrorshadow',
    name:'Cermin Bayangan',
    desc:'Mengisi frame kosong dengan bayangan dari media itu sendiri: salinan diperbesar, cermin tepi, gabungan, atau bayangan tepi yang memudar',
    len:5,
    alpha:true,   /* preview.js: biarkan kanvas dasar transparan sampai efek ini jalan, supaya area kosong bisa dikenali */
    params:[
      ['mode','Mode (1 = salinan diperbesar + blur, 2 = cermin tepi + blur, 3 = gabungan, 4 = bayangan tepi memudar)',1,4,4],
      ['blur','Blur bayangan (0 = tajam; mode 4: blur di bagian paling luar)',0,100,35],
      ['zm','Zoom bayangan (%, 100 = pas menutup frame; hanya mode 1 dan 3)',100,300,110],
      ['bri','Kecerahan bayangan (50 = asli, makin kecil makin gelap)',0,100,40],
      ['sat','Saturasi bayangan (50 = asli, 0 = hitam putih)',0,100,60],
      ['op','Opasitas bayangan (100 = penuh, makin kecil makin transparan)',0,100,100],
      ['tint','Kekuatan warna tint (0 = tanpa tint)',0,100,0],
      ['hue','Rona warna tint (0 sampai 360 derajat)',0,360,210],
      ['edge','Bayangan tepi media utama (0 = tanpa; mode 4: kegelapan yang makin pekat ke pinggir)',0,100,35],
      ['fd','Lebar pudar tepi media (mode 4; 0 = tepi tajam)',0,100,40],
      ['nb','Blur dekat tepi media (mode 4; 0 = cermin tajam)',0,100,15],
      HOLE
    ],
    apply:mirrorShadow
  };
  /* Isi Cermin (fxclip.js) ikut berjalan di kanvas utama: tanpa clip yang dipilih, frame kosong diisi gabungan semua layer di bawahnya.
     Jalur per layer (clip bertarget, atau isi otomatis layer dasar di preview.js) tetap memakai kode aslinya. */
  const DM=F.DEF.mirror;
  if(DM&&typeof DM.apply==='function'){
    const origApply=DM.apply;
    DM.perLayer=false;DM.alpha=true;
    DM.desc='Menutup frame kosong dengan cermin dari gabungan semua layer yang tampil di bawah clip efek ini, termasuk area kosong akibat efek clip lain';
    if(Array.isArray(DM.params)&&!DM.params.some(q=>q[0]==='hole'))DM.params.push(HOLE.slice());
    DM.apply=function(g,w,h,p){
      if(cur||!owner)return origApply.apply(this,arguments);
      const br=1-clamp(nz(p.dim,0),0,100)/100;
      mirrorShadow(g,w,h,{mode:2,blur:nz(p.blur,0)*0.625,zm:100,bri:clamp((br-0.3)/1.4*100,0,100),sat:50,op:100,tint:0,hue:0,edge:0,fd:0,nb:0,hole:nz(p.hole,1)});
    };
  }
  F.DEF[entry.id]=entry;
  const at=F.LIST.findIndex(e=>e.id==='mirror');
  if(at>=0)F.LIST.splice(at+1,0,entry);else F.LIST.push(entry);
})();
