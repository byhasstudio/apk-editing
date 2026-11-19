/* Efek clip tambahan: Isi Bayangan (js/fxbayangan.js)
   Seperti Isi Cermin, tapi frame kosong di sekitar media diisi BAYANGAN dari media itu sendiri: salinan media diperbesar sampai menutup seluruh frame,
   lalu diburamkan (gaya latar blur). Media aslinya tetap tajam di atas bayangan.
   Efek ini bekerja PER CLIP MEDIA (perLayer), sama seperti Isi Cermin: kotak media (posisi, skala, putaran) diambil dari preview (APK.preview.bounds),
   jadi bayangannya ikut bergerak, membesar, dan berputar bersama media. Kalau media sudah menutupi seluruh frame, tidak ada yang dikerjakan.
   Bayangan digambar di kanvas kecil lalu dibesarkan supaya ringan; tingkat blur diatur lewat parameter Blur.
   Parameter: Blur, Gelap/terang, Ukuran bayangan, Geser X, Geser Y, Warna tint (jumlah dan hue), Transparansi.
   Untuk tahu clip media mana yang sedang diolah, file ini membungkus layerEnd() milik fxclip.js (pola yang sama dengan file efek lain).
   Dimuat setelah fxwavebaru.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;

  let cur=null;   /* clip media yang sedang diolah layerEnd() */
  const oldEnd=F.layerEnd;
  if(typeof oldEnd==='function'){
    F.layerEnd=function(main,c){cur=c;try{return oldEnd.apply(this,arguments)}finally{cur=null}};
  }

  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    return g;
  }

  function shadowFill(g,w,h,p){
    const pj=APK.project&&APK.project.current;
    let b=null,demo=false;
    if(cur){
      const q=pj&&pj.width&&APK.preview&&APK.preview.bounds?APK.preview.bounds(cur.id):null;
      if(!q)return;
      const K=w/pj.width;
      b={cx:q.cx*K,cy:q.cy*K,w:q.w*K,h:q.h*K,rot:+q.rot||0};
    }else{demo=true;b={cx:w/2,cy:h/2,w:w*0.62,h:h*0.62,rot:0}}   /* kartu pratinjau: kotak 62% di tengah */
    const tw=Math.round(b.w),th=Math.round(b.h);
    if(!(tw>=4&&th>=4))return;
    const rad=b.rot*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad);
    /* seberapa besar media harus diperbesar dari tengahnya supaya menutup semua sudut frame, dan apakah media sudah menutup frame */
    let kmax=1,cover=true;
    for(const q of [[0,0],[w,0],[w,h],[0,h]]){
      const dx=q[0]-b.cx,dy=q[1]-b.cy,lx=dx*cs+dy*sn,ly=-dx*sn+dy*cs;
      kmax=Math.max(kmax,Math.abs(lx)/(tw/2),Math.abs(ly)/(th/2));
      if(Math.abs(lx)>tw/2+0.5||Math.abs(ly)>th/2+0.5)cover=false;
    }
    if(cover&&!demo)return;
    const S=ac('sf_s',w,h);S.drawImage(g.canvas,0,0);
    /* media diluruskan (rotasi dibalik) jadi satu ubin */
    const T=ac('sf_t',tw,th);
    T.translate(tw/2,th/2);T.rotate(-rad);T.translate(-b.cx,-b.cy);T.drawImage(S.canvas,0,0);
    /* bayangan digambar di kanvas kecil (ringan), diberi blur, lalu dibesarkan sebesar frame */
    const ds=Math.min(1,200/Math.max(w,h)),Wd=Math.max(8,Math.round(w*ds)),Hd=Math.max(8,Math.round(h*ds));
    const blurFull=p.blur/100*0.1*Math.min(w,h),bs=blurFull*ds,m=Math.ceil(bs*3)+2;
    const kc=kmax*(1+(2*m+4)/Math.min(Wd,Hd)),k=kc*Math.max(0.1,p.size/100);
    const ox=p.ox/100*0.3*w,oy=p.oy/100*0.3*h;
    const U=ac('sf_u',Wd+2*m,Hd+2*m);
    if(bs>=0.3&&'filter' in U)U.filter='blur('+bs.toFixed(2)+'px)';
    U.setTransform(ds,0,0,ds,m,m);
    U.translate(b.cx+ox,b.cy+oy);U.rotate(rad);
    U.drawImage(T.canvas,-tw*k/2,-th*k/2,tw*k,th*k);
    U.filter='none';
    const Fc=ac('sf_f',w,h);
    Fc.imageSmoothingEnabled=true;Fc.imageSmoothingQuality='high';
    Fc.drawImage(U.canvas,m,m,Wd,Hd,0,0,w,h);
    /* gelap atau terang, lalu warna tint */
    if(p.lum!==0){
      Fc.globalCompositeOperation='source-atop';
      Fc.fillStyle=p.lum<0?'rgba(0,0,0,'+(-p.lum/100)+')':'rgba(255,255,255,'+(p.lum/100)+')';
      Fc.fillRect(0,0,w,h);
    }
    if(p.tint>0){
      Fc.globalCompositeOperation='source-atop';
      Fc.fillStyle='hsla('+p.hue+',80%,55%,'+(p.tint/100*0.7)+')';
      Fc.fillRect(0,0,w,h);
    }
    Fc.globalCompositeOperation='source-over';
    g.clearRect(0,0,w,h);
    g.globalAlpha=Math.min(1,Math.max(0,p.op/100));
    g.drawImage(Fc.canvas,0,0);
    g.globalAlpha=1;
    if(demo){
      g.save();
      g.translate(b.cx,b.cy);g.rotate(rad);g.beginPath();g.rect(-b.w/2,-b.h/2,b.w,b.h);g.clip();
      g.setTransform(1,0,0,1,0,0);g.drawImage(S.canvas,0,0);
      g.restore();
    }else g.drawImage(S.canvas,0,0);
  }

  const entry={
    id:'shadowfill',
    name:'Isi Bayangan',
    desc:'Menutup frame kosong dengan bayangan blur dari media itu sendiri, ikut gerak media',
    len:5,
    perLayer:true,
    params:[
      ['blur','Blur bayangan (0 = tajam, makin besar makin lembut)',0,100,60],
      ['lum','Gelap atau terang bayangan (minus = gelap, plus = terang)',-100,100,-30],
      ['size','Ukuran bayangan (%, 100 = pas menutup frame)',50,300,100],
      ['ox','Geser bayangan ke samping (minus = kiri, plus = kanan)',-100,100,0],
      ['oy','Geser bayangan ke atas bawah (minus = atas, plus = bawah)',-100,100,0],
      ['tint','Warna tint (0 = tanpa warna)',0,100,0],
      ['hue','Pilihan warna tint (0 sampai 360)',0,360,210],
      ['op','Transparansi bayangan (100 = penuh)',0,100,100]
    ],
    apply:shadowFill
  };
  /* diletakkan tepat setelah Isi Cermin di daftar efek */
  const i=F.LIST.findIndex(e=>e.id==='mirror');
  if(i>=0)F.LIST.splice(i+1,0,entry);else F.LIST.push(entry);
  F.DEF[entry.id]=entry;
})();
