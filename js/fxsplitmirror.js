/* Efek clip tambahan: Split Mirror (Layar Belah Cermin)
   Meniru 100% gaya edit video referensi (TikTok style):
   – Layar dibagi 2 secara horizontal tepat di tengah
   – Panel atas: clip asli, zoom in, sedikit miring, parallax naik
   – Panel bawah: clip yang sama tapi di-flip vertikal (mirror), zoom berbeda, parallax turun
   – Napas zoom (breathing) pelan mengikuti waktu
   – Vignette gelap di tepi
   – Garis pemisah tipis di tengah dengan cahaya
   – Saat clip dimulai/berakhir: motion blur gerak keluar (untuk menyambung clip)
   – Semua parameter bisa disesuaikan
   Dimuat setelah fxwspin.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  if(!APK.fxclip||!APK.fxclip.LIST||!APK.fxclip.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};

  /* kanvas bantu */
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

  /* gambar vignette oval di atas layer g */
  function vignette(g,w,h,str){
    if(str<0.01)return;
    const grd=g.createRadialGradient(w/2,h/2,Math.min(w,h)*0.28,w/2,h/2,Math.max(w,h)*0.75);
    grd.addColorStop(0,'rgba(0,0,0,0)');
    grd.addColorStop(1,'rgba(0,0,0,'+str.toFixed(2)+')');
    g.fillStyle=grd;g.fillRect(0,0,w,h);
  }

  /* gambar satu panel (atas atau bawah) clip ke kanvas g */
  function drawPanel(g,src,w,h,panH,cx,cy,zoom,rot,flipY,offY,blurPx){
    g.save();
    /* potong area panel */
    g.beginPath();g.rect(0,cy-panH/2,w,panH);g.clip();
    /* terapkan transformasi */
    g.translate(cx,cy);
    if(rot)g.rotate(rot);
    if(flipY)g.scale(1,-1);
    if(blurPx>0.3&&'filter' in g)g.filter='blur('+blurPx.toFixed(1)+'px)';
    /* ukuran gambar yang ditampilkan di panel (diperbesar zoom, lebar penuh) */
    const srcW=src.width||src.naturalWidth||w;
    const srcH=src.height||src.naturalHeight||h;
    const dw=w,dH=w*(srcH/srcW);
    g.drawImage(src,-dw/2*zoom,-dH/2*zoom+offY*zoom,dw*zoom,dH*zoom);
    g.restore();
  }

  /* ===== fungsi apply utama ===== */
  function splitmirror(g,w,h,p,tm,opaque,rel,dur){
    /* salin frame asli sebelum dimodifikasi */
    const S=ac('sm_src',w,h);
    S.drawImage(g.canvas,0,0);

    /* parameter yang dinormalisasi */
    const zoomBase=1+(p.zm/100)*0.18+0.07;         /* zoom dasar panel atas (selalu sedikit zoom in) */
    const zoomMirror=zoomBase*(1+(p.mzd/100)*0.08); /* zoom panel bawah sedikit berbeda */
    const tiltDeg=(p.tlt-50)/50*3.5;               /* kemiringan ±3.5 derajat */
    const tiltRad=tiltDeg*Math.PI/180;
    const vigStr=0.45+p.vig/100*0.35;              /* kekuatan vignette 0.45..0.80 */
    const lineW=Math.max(1,Math.round(w*0.003));    /* lebar garis tengah */
    const parallax=(p.par/100)*h*0.04;             /* jarak parallax vertikal */

    /* "napas" zoom pelan mengikuti waktu (seperti di video) */
    const breathFreq=0.4;                          /* Hz: 0.4 putaran/detik */
    const breathAmt=(p.brth/100)*0.025;
    const breath=Math.sin(tm*breathFreq*2*Math.PI)*breathAmt;

    /* motion blur masuk/keluar: 0.22 detik pertama dan terakhir */
    const fadeLen=Math.min(0.22,dur*0.15);
    const fadeIn=rel<fadeLen?ss(rel/fadeLen):1;
    const fadeOut=rel>dur-fadeLen?ss((dur-rel)/fadeLen):1;
    const fade=fadeIn*fadeOut;
    const blurPx=(1-fade)*14*(p.mbl/100)*(w/576);

    /* tinggi tiap panel = tepat setengah layar */
    const panH=h/2;
    const sepY=h/2;   /* posisi garis tengah dalam piksel */

    /* geseran parallax vertikal (panel atas naik, panel bawah turun) */
    const parOff=parallax*(0.5+0.5*Math.sin(tm*0.3));

    const zm1=zoomBase+breath;
    const zm2=zoomMirror-breath*0.7;

    /* kosongkan g */
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}

    /* ===== panel atas ===== */
    drawPanel(g,S.canvas,w,h,panH,w/2,panH/2,zm1,tiltRad,false,-parOff,blurPx);

    /* ===== panel bawah (mirror vertikal) ===== */
    drawPanel(g,S.canvas,w,h,panH,w/2,sepY+panH/2,zm2,-tiltRad*0.6,true,parOff,blurPx);

    /* ===== garis pemisah tengah ===== */
    /* bayangan lembut di sekitar garis */
    const shadow=g.createLinearGradient(0,sepY-lineW*5,0,sepY+lineW*5);
    shadow.addColorStop(0,'rgba(0,0,0,0)');
    shadow.addColorStop(0.4,'rgba(0,0,0,0.45)');
    shadow.addColorStop(0.5,'rgba(0,0,0,0.6)');
    shadow.addColorStop(0.6,'rgba(0,0,0,0.45)');
    shadow.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=shadow;g.fillRect(0,sepY-lineW*5,w,lineW*10);
    /* garis putih tipis */
    g.fillStyle='rgba(255,255,255,0.55)';
    g.fillRect(0,sepY-lineW/2,w,lineW);
    /* kilau di tengah garis */
    const glow=g.createLinearGradient(w*0.1,0,w*0.9,0);
    glow.addColorStop(0,'rgba(255,255,255,0)');
    glow.addColorStop(0.5,'rgba(255,255,255,0.3)');
    glow.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=glow;g.fillRect(0,sepY-lineW,w,lineW*2);

    /* ===== vignette di seluruh layar ===== */
    vignette(g,w,h,vigStr*fade);

    /* ===== motion blur overlay saat fade masuk/keluar ===== */
    if(fade<0.98){
      g.save();
      g.globalAlpha=(1-fade)*0.55;
      if('filter' in g)g.filter='blur('+(blurPx*0.5).toFixed(1)+'px)';
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
  }

  /* ===== definisi efek ===== */
  const entry={
    id:'splitmirror',
    name:'Split Mirror',
    desc:'Layar belah dua: atas asli, bawah cermin terbalik, zoom napas, vignette, garis tengah — 100% gaya edit TikTok',
    len:3.0,
    params:[
      ['zm' ,'Zoom panel atas (lebih besar = makin zoom in)',0,100,55],
      ['mzd','Perbedaan zoom panel bawah (lebih besar = makin beda)',0,100,40],
      ['tlt','Kemiringan (50 = lurus, kurang dari 50 = kiri, lebih dari 50 = kanan)',0,100,42],
      ['par','Kekuatan parallax vertikal (0 = diam)',0,100,60],
      ['brth','Kekuatan napas zoom',0,100,65],
      ['vig','Kegelapan vignette tepi',0,100,55],
      ['mbl','Kekuatan motion blur masuk/keluar',0,100,70]
    ],
    apply:splitmirror
  };
  APK.fxclip.LIST.push(entry);
  APK.fxclip.DEF[entry.id]=entry;
})();
