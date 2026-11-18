/* Efek clip tambahan dari VIDEO REFERENSI (mp4 762x576, 19,3 dtk, 30 fps; dua layar 9:16 dan 1:1, bagian efeknya diukur frame demi frame;
   bingkai, teks "PRESET di komentar", dan teks "ZETSS" dilewati).
   Video yang sama sudah dipakai untuk Glitch Tarik Piksel, Kilat Negatif Ungu, dan Blur Jadi Cahaya Redup (js/fxglitch.js), dan irisan tegak
   sudah ada di Irisan Pulsa (js/fxirisan.js), jadi di sini hanya tiga efek BARU lain dari video itu:

   – Muncul dari Gelap (frame 0 sampai 36, sekitar 1,2 detik, satu kali di awal clip)
       Frame 0 hampir rata abu-abu gelap. Piksel TERANG (lampu, kilau) muncul lebih dulu: kecerahan terangnya naik dari 50 ke 139 (frame 3), 180 (frame 6), 202 (frame 9),
       lalu penuh sekitar 210 di frame 12 sampai 15 (naik cepat lalu melambat, jadi dibuat kurva keluar pangkat empat selama 0,42 detik). Nada tengah dan bayangan baru terangkat
       belakangan: rata-rata kecerahan 39,7 (frame 9) tetap rendah sampai frame 15, lalu naik mulus ke 55 di frame 33 (dibuat mulus dari detik 0,5 sampai 1,13).
       Cara kerjanya: gambar ditarik ke abu-abu gelap rata, hanya piksel di atas ambang (turun pelan dari 0,9 ke 0,6) yang tampil sebagai cahaya, lalu gambar naik ke aslinya.
       Selesai urutan, gambar kembali bersih sepenuhnya (efek tidak mengubah apa pun lagi).

   – Cermin Kabur Tahan (frame 442 sampai 458, sekitar 0,5 detik)
       Dalam satu frame gambar langsung berlapis dan bertahan sampai akhir: ketajaman (variansi Laplace) turun dari sekitar 670 ke 190 sampai 290, sedangkan kecerahan rata-rata
       TIDAK berubah (sekitar 70). Hasil uji: penurunan ketajaman itu hampir seluruhnya datang dari lapisan cermin dan bayangan ganda, bukan dari blur kuat (blur bawaan hanya halus).
       Selama bertahan gambar mengecil pelan dan salinan yang dibalik tegak (cermin atas bawah) menumpuk di gambar asli, ditambah bayangan ganda ke kiri dan kanan.
       Di frame terakhir ada SATU frame kilatan putih (rata-rata 70 naik ke 175, setara putih sekitar 57%), lalu gambar kembali tajam dan bersih.
       Kilatan jatuh di frame terakhir clip, jadi memperpendek atau memperpanjang clip menggeser kilatannya.

   – Sobek Garis Mendatar (diukur dari layar 1:1, frame 340 sampai 362)
       Irisan horizontal tipis bergeser ke kiri atau ke kanan saja: TANPA pecah warna RGB, TANPA warna lain. Tinggi irisan acak dari beberapa piksel sampai sekitar 4% tinggi layar
       (kebanyakan tipis), geseran acak sampai sekitar 4% lebar layar. Muncul berkelompok: sekitar 55% frame kena, sisanya bersih, dan tiap kejadian hanya mengenai satu jendela
       vertikal (bukan seluruh tinggi layar). Acak STABIL per frame (30 per detik pada Kecepatan 100), jadi preview, scrub, dan export menghasilkan gambar yang sama persis.

   Dimuat setelah fxglitch.js dan sebelum fxlib.js (daftar efek membaca APK.fxclip.LIST saat dibuka). */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};                 /* naik mulus */
  const eo=x=>{x=clamp(x,0,1);const q=1-x;return 1-q*q*q*q};      /* naik cepat lalu melambat */
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};

  /* kanvas bantu (dipakai bergantian, tidak pernah bersarang) */
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

  /* ===== Muncul dari Gelap ===== */
  const MT1=0.42,MT2A=0.5,MT2B=1.13;   /* detik: cahaya terang naik sampai MT1; bayangan dan nada tengah naik dari MT2A sampai MT2B */
  function muncul(g,w,h,p,tm,opaque,rel){
    const t=Math.max(0,rel)*(p.spd/100);
    if(t>=MT2B)return;                                  /* urutan selesai: gambar bersih */
    const e2=ss((t-MT2A)/(MT2B-MT2A));                  /* 0 = masih abu-abu rata, 1 = gambar asli */
    const a=eo(t/MT1)*p.hl/100;                         /* seberapa kuat cahaya terang sudah muncul */
    const S=ac('mg_s',w,h);S.drawImage(g.canvas,0,0);
    /* 1. seluruh gambar ditarik ke abu-abu gelap rata, naik pelan ke gambar asli */
    const gv=Math.round(255*p.base/100);
    g.save();
    g.globalCompositeOperation='source-atop';g.globalAlpha=1-e2;
    g.fillStyle='rgb('+gv+','+gv+','+gv+')';g.fillRect(0,0,w,h);
    g.restore();
    /* 2. piksel terang di atas ambang tampil lebih dulu: hasil = campuran antara langkah 1 dan gambar asli, dengan bobot = mask terang x a */
    if(a>0.003&&'filter' in g){
      const th=0.9-0.3*clamp(t/0.5,0,1),B=0.5/th;
      const M=ac('mg_m',w,h);                           /* mask hitam putih: putih = piksel terang */
      M.filter='grayscale(1) brightness('+B.toFixed(3)+') contrast(12)';
      M.drawImage(S.canvas,0,0);
      M.filter='none';
      const Mi=ac('mg_i',w,h);                          /* kebalikan mask */
      Mi.filter='invert(1)';
      Mi.drawImage(M.canvas,0,0);
      Mi.filter='none';
      M.globalCompositeOperation='multiply';            /* M jadi gambar asli yang hanya menyisakan piksel terang */
      M.drawImage(S.canvas,0,0);
      M.globalCompositeOperation='destination-in';
      M.drawImage(S.canvas,0,0);
      g.save();
      g.globalAlpha=a;
      g.globalCompositeOperation='multiply';g.drawImage(Mi.canvas,0,0);      /* bagian terang dikosongkan dulu */
      g.globalCompositeOperation='lighter';g.drawImage(M.canvas,0,0);        /* diisi gambar asli */
      g.globalAlpha=1;
      g.globalCompositeOperation='destination-in';g.drawImage(S.canvas,0,0); /* transparansi asli kembali */
      g.restore();
    }
  }

  /* ===== Cermin Kabur Tahan ===== */
  const FR=1/30;
  function cermin(g,w,h,p,tm,opaque,rel,dur){
    const D=dur>0?dur:0.6,r=Math.max(0,rel);
    const on=ss(r/FR);                                   /* berlapis dalam satu frame */
    const u=clamp(r/Math.max(0.05,D-FR),0,1);            /* kemajuan selama bertahan */
    const fl=(dur>0&&r>=D-FR*1.05)?p.fl/100*0.57:0;     /* satu frame kilatan putih di akhir clip */
    if(on<=0.001&&fl<=0)return;
    const S=ac('ck_s',w,h);S.drawImage(g.canvas,0,0);
    const bl=p.bl/100*0.012*Math.min(w,h)*on;
    const B=ac('ck_b',w,h);                              /* salinan halus, dipakai ulang untuk semua lapisan */
    if('filter' in B&&bl>0.3)B.filter='blur('+bl.toFixed(1)+'px)';
    B.drawImage(S.canvas,0,0);
    B.filter='none';
    const z=1-p.zm/100*(0.6+0.4*u)*on;
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    const put=(sx,sy,dx,al)=>{
      g.save();g.globalAlpha=al;
      g.translate(w/2+dx,h/2);g.scale(sx,sy);g.translate(-w/2,-h/2);
      g.drawImage(B.canvas,0,0);
      g.restore();
    };
    if(z<0.999)put(1.15,1.15,0,1);                       /* latar pengisi tepi: gambar diperbesar */
    put(z,z,0,1);                                        /* gambar utama yang mengecil pelan */
    if(p.gh>0){                                          /* bayangan ganda ke kiri dan kanan */
      const d=p.gh/100*0.03*w*on;
      put(z,z,-d,0.3*p.gh/100);
      put(z,z,d,0.3*p.gh/100);
    }
    if(p.mir>0)put(z*1.02,-z*1.02,0,p.mir/100*0.55*on);  /* salinan dibalik tegak (cermin atas bawah) menumpuk di atasnya */
    if(fl>0){
      g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=fl;g.fillStyle='#fff';g.fillRect(0,0,w,h);g.restore();
    }
  }

  /* ===== Sobek Garis Mendatar ===== */
  function sobek(g,w,h,p,tm){
    const amt=p.amt/100;if(amt<=0)return;
    const slot=Math.floor(tm*30*(p.spd/100)),rnd=rng(slot*7919+4231);
    if(rnd()*100>=p.frq)return;                          /* frame ini bersih */
    const S=ac('sg_s',w,h);S.drawImage(g.canvas,0,0);
    /* jendela vertikal tempat sobekan muncul (acak per frame) */
    const half=Math.max(0.04,p.wdw/100*(0.4+0.6*rnd())/2),hc=rnd();
    const y0=clamp(hc-half,0,1)*h,y1=clamp(hc+half,0,1)*h;
    const n=Math.max(1,Math.round(p.jml*(0.5+rnd())));
    const maxH=Math.max(2,Math.round(h*0.04*p.tbl/100)),A=amt*0.04*w;
    for(let i=0;i<n;i++){
      const hh=Math.max(1,Math.round(maxH*Math.pow(rnd(),1.6)));     /* kebanyakan tipis */
      const y=Math.floor(y0+rnd()*Math.max(1,y1-y0-hh));
      const dx=Math.round((rnd()-0.5)*2*A*(0.25+0.75*rnd()));
      if(!dx||y<0||y+hh>h)continue;
      g.clearRect(0,y,w,hh);
      g.drawImage(S.canvas,0,y,w,hh,dx,y,w,hh);
      g.drawImage(S.canvas,0,y,w,hh,dx>0?dx-w:dx+w,y,w,hh);        /* membungkus ke sisi lain, tanpa celah */
    }
  }

  const SPR=['spd','Kecepatan (100 = sama dengan video referensi)',25,300,100];
  const ENTRIES=[
    {id:'munculgelap',name:'Muncul dari Gelap',desc:'Cahaya terang muncul duluan di layar gelap, lalu bayangan terangkat pelan, satu kali di awal clip (dari video referensi)',len:1.6,
      params:[['hl','Kekuatan cahaya terang yang muncul duluan',0,100,100],['base','Terang abu-abu awal (14 = sama dengan video)',0,60,14],SPR],apply:muncul},
    {id:'cerminkabur',name:'Cermin Kabur Tahan',desc:'Gambar langsung berlapis cermin dan bayangan ganda, mengecil pelan, lalu satu kilatan putih di akhir clip (dari video referensi)',len:0.6,
      params:[['bl','Blur halus (20 = sama dengan video)',0,100,20],['mir','Lapisan cermin atas bawah (0 = tanpa)',0,100,40],['gh','Bayangan ganda kiri kanan (0 = tanpa)',0,100,30],['zm','Zoom keluar (%)',0,30,8],['fl','Kilatan putih di frame terakhir (0 = tanpa)',0,100,100]],apply:cermin},
    {id:'sobekgaris',name:'Sobek Garis Mendatar',desc:'Irisan horizontal tipis bergeser kiri kanan berkelompok, tanpa pecah warna (dari video referensi)',len:2,
      params:[['amt','Kekuatan geser (100 = sekitar 4% lebar layar)',0,100,70],['jml','Jumlah irisan tiap kejadian',2,60,24],['tbl','Ketebalan irisan (100 = sampai 4% tinggi layar)',5,100,40],['wdw','Luas jendela sobekan (100 = seluruh tinggi layar)',10,100,45],['frq','Seberapa sering muncul (%)',0,100,55],SPR],apply:sobek}
  ];
  ENTRIES.forEach(function(e){F.LIST.push(e);F.DEF[e.id]=e});
})();
