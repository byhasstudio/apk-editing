/* Efek clip tambahan: Cermin Bayangan
   Mirip Isi Cermin (js/fxclip.js), tapi frame kosong di sekitar media diisi BAYANGAN dari media itu sendiri, bukan cermin tajam:
   – Mode 1: salinan media diperbesar sampai menutup seluruh frame, lalu diburamkan (gaya blur background CapCut / Instagram)
   – Mode 2: cermin tepi media (dipantulkan bolak-balik seperti ubin cermin), lalu diburamkan
   – Mode 3: gabungan keduanya (salinan diperbesar sebagai dasar, cermin tepi di atasnya supaya sambungan di tepi media tetap mulus)
   Efek ini bekerja PER CLIP MEDIA (perLayer), sama seperti Isi Cermin: tiap video/gambar di bawah clip efek diolah di lapisannya sendiri
   dengan kotak medianya dari preview (APK.preview.bounds, sudah termasuk posisi, skala, dan rotasi). Jadi media bisa digeser, di-scale,
   dan diputar seperti clip biasa, dan bayangannya ikut menyesuaikan sehingga frame tidak pernah kosong. Media yang sudah menutupi seluruh frame tidak diubah.
   Bayangan statis (tidak ada gerak sendiri); pusat salinan hanya mengikuti media sedikit (30%) supaya terasa menyatu tanpa membuka celah.
   Pengaturan: Mode, Blur, Zoom bayangan, Kecerahan, Saturasi, Opasitas, Tint (kekuatan dan rona), dan Bayangan tepi media utama.
   Bisa dipakai bersamaan dengan efek clip lain (dipasang di clip efek sendiri; urutan layer menentukan mana yang diolah lebih dulu).
   Di kartu pratinjau (tanpa clip sungguhan) dipakai kotak 62% di tengah gambar contoh supaya efeknya kelihatan.
   Dimuat setelah fxsplitmirror.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const P=()=>APK.project&&APK.project.current;

  /* clip media yang sedang diolah: fxclip.js menyimpannya di variabel privat, jadi dicatat lagi di sini lewat pembungkus layerEnd */
  let cur=null;
  const oldEnd=F.layerEnd;
  if(typeof oldEnd==='function'){
    F.layerEnd=function(main,c){
      cur=c;
      try{return oldEnd.apply(this,arguments)}finally{cur=null}
    };
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

  function mirrorShadow(g,w,h,p){
    /* kotak media (posisi, ukuran, putaran) dalam piksel kanvas */
    const pj=P();let b=null,demo=false;
    if(cur){
      const q=pj&&pj.width&&APK.preview&&APK.preview.bounds?APK.preview.bounds(cur.id):null;
      if(!q)return;
      const K=w/pj.width;
      b={cx:q.cx*K,cy:q.cy*K,w:q.w*K,h:q.h*K,rot:+q.rot||0};
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
    if(cover&&!demo)return;   /* media sudah menutupi seluruh frame */

    const mode=Math.round(p.mode);
    const bl=p.blur/100*0.08*Math.min(w,h);   /* radius blur dalam piksel kanvas */
    const hasF='filter' in g;
    /* isian digambar di resolusi lebih kecil kalau diburamkan kuat: jauh lebih ringan dan hasilnya sama karena toh buram */
    const q=hasF?(bl>=10?0.25:bl>=4?0.5:1):(bl>2?clamp(3/bl,0.04,1):1);
    const lw=Math.max(1,Math.ceil(w*q)),lh=Math.max(1,Math.ceil(h*q));

    /* salin frame asli (media di lapisan transparan) */
    const S=ac('ms_s',w,h);S.drawImage(g.canvas,0,0);
    /* ubin = kotak media yang diluruskan (rotasi dibalik), diambil di resolusi isian */
    const tcw=Math.max(1,Math.round(tw*q)),tch=Math.max(1,Math.round(th*q));
    const T=ac('ms_t',tcw,tch);
    T.scale(tcw/tw,tch/th);
    T.translate(tw/2,th/2);T.rotate(-rad);T.translate(-b.cx,-b.cy);T.drawImage(S.canvas,0,0);

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
    if(mode===2||mode===3){
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

    /* bayangan lembut di tepi media utama (hanya bayangannya yang tergambar: kotak digambar jauh di luar layar lalu bayangannya digeser balik) */
    if(p.edge>0){
      const sz=p.edge/100*0.06*Math.min(w,h),OFF=w*4+tw*2;
      g.save();
      g.setTransform(cs,sn,-sn,cs,b.cx-OFF,b.cy);
      g.shadowColor='rgba(0,0,0,'+(0.35+0.4*p.edge/100).toFixed(2)+')';
      g.shadowBlur=sz;g.shadowOffsetX=OFF;g.shadowOffsetY=0;
      g.fillStyle='#000';
      g.fillRect(-b.w/2,-b.h/2,b.w,b.h);
      g.restore();
    }

    if(demo){
      /* kartu pratinjau: hanya kotak tengah yang dianggap media */
      g.save();
      g.translate(b.cx,b.cy);g.rotate(rad);g.beginPath();g.rect(-b.w/2,-b.h/2,b.w,b.h);g.clip();
      g.setTransform(1,0,0,1,0,0);g.drawImage(S.canvas,0,0);
      g.restore();
    }else g.drawImage(S.canvas,0,0);
  }

  /* ===== definisi efek ===== */
  const entry={
    id:'mirrorshadow',
    name:'Cermin Bayangan',
    desc:'Mengisi frame kosong dengan bayangan blur dari media itu sendiri: salinan diperbesar, cermin tepi, atau gabungan',
    len:5,
    perLayer:true,
    params:[
      ['mode','Mode (1 = salinan diperbesar + blur, 2 = cermin tepi + blur, 3 = gabungan keduanya)',1,3,1],
      ['blur','Blur bayangan (0 = tajam)',0,100,60],
      ['zm','Zoom bayangan (%, 100 = pas menutup frame; hanya mode 1 dan 3)',100,300,110],
      ['bri','Kecerahan bayangan (50 = asli, makin kecil makin gelap)',0,100,40],
      ['sat','Saturasi bayangan (50 = asli, 0 = hitam putih)',0,100,60],
      ['op','Opasitas bayangan (100 = penuh, makin kecil makin transparan)',0,100,100],
      ['tint','Kekuatan warna tint (0 = tanpa tint)',0,100,0],
      ['hue','Rona warna tint (0 sampai 360 derajat)',0,360,210],
      ['edge','Bayangan tepi media utama (0 = tanpa)',0,100,35]
    ],
    apply:mirrorShadow
  };
  F.DEF[entry.id]=entry;
  const at=F.LIST.findIndex(e=>e.id==='mirror');
  if(at>=0)F.LIST.splice(at+1,0,entry);else F.LIST.push(entry);
})();
