/* Efek clip tambahan: Irisan Pulsa
   Meniru video referensi (diukur frame demi frame, 60 fps, 4,55 detik). Hanya bagian efeknya; latar kotak-kotak biru, media mengecil, bayangan, fade hitam di awal,
   dan watermark TikTok di video referensi sengaja tidak ikut.
   Cara kerja yang diukur dari video:
   – Gambar dibelah jadi irisan tegak yang lebarnya sama (bawaan 5, bisa 2 sampai 10 lewat "Jumlah irisan").
   – SEMUA irisan bergeser naik turun (tanpa zoom, tanpa geser ke samping), termasuk yang paling kiri dan paling kanan. Irisan tengah paling jauh
     (sekitar 3,05% tinggi layar), irisan di sebelahnya sekitar 2,36% dan tertinggal sekitar 0,12 detik dari irisan tengah, makin ke tepi makin kecil
     (tapi tidak pernah di bawah 60% simpangan irisan sebelah tengah) dan makin tertinggal, jadi terlihat seperti gelombang yang merambat keluar dari tengah.
     Dengan 5 irisan, irisan tengah dan sebelahnya persis hasil ukur video referensi.
   – Satu hentakan = gelombang sinus (sekitar 0,86 detik per putaran, 7,33 rad/detik) yang kekuatannya naik lalu turun berbentuk lonceng (lebar sekitar 0,51 detik),
     puncaknya di detik 1,32 dari awal clip. Hentakan yang sama muncul lagi tiap 2,27 detik (di video: detik 1,32 dan 3,59).
   – Kilatan terang di video referensi SENGAJA TIDAK ada di efek ini; pindah jadi efek clip sendiri: "Flash Pulsa" (di bawah file ini),
     dengan waktu hentakan yang sama, jadi kalau dipakai bersama keduanya serempak.
   – Di luar hentakan gambar diam sepenuhnya.
   Tepi atas atau bawah irisan yang terbuka karena bergeser ditutup dengan pantulan gambar irisan itu sendiri (bukan zoom), jadi gambar tidak membesar.
   Semua angka bisa diubah di panel Properti, nilai bawaannya persis hasil ukur.
   Dimuat setelah fxkamu.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  if(!APK.fxclip||!APK.fxclip.LIST||!APK.fxclip.DEF)return;

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

  /* konstanta hasil ukur dari video referensi */
  const OM=7.333;               /* kecepatan sudut gelombang (rad/detik) */
  const A_MID=0.03055;          /* simpangan irisan tengah (bagian tinggi layar) */
  const A_NEAR=0.02360;         /* simpangan irisan di sebelahnya (bagian tinggi layar) */
  const PH_MID=3.356;           /* fase irisan tengah (rad) */
  const PH_NEAR=2.462;          /* fase irisan sebelahnya (rad), tertinggal sekitar 0,12 detik dari irisan tengah */
  const BR_LAG=0.055;           /* puncak kecerahan terlambat sekian detik dari puncak gelombang */
  const BR_W=0.919;             /* lebar lonceng kecerahan dibanding lebar lonceng gelombang */

  /* simpangan vertikal (px, positif = turun) tiap irisan pada waktu rel (detik sejak clip mulai) */
  function offsets(h,p,rel){
    const per=p.per/100,t0=p.t0/100,w=p.wid/100,k=p.amt/100;
    const n=Math.max(2,Math.min(10,Math.round(+p.n||5)));
    let m=per>0?Math.round((rel-t0)/per):0;
    if(!p.rep||m<0)m=0;
    const s=rel-(t0+m*per),env=Math.exp(-(s/w)*(s/w)),c=(n-1)/2,out=[];
    for(let i=0;i<n;i++){
      const d=Math.abs(i-c);                                            /* jarak irisan dari tengah (dalam lebar irisan) */
      const amp=d<=1?A_MID+(A_NEAR-A_MID)*d:Math.max(A_NEAR*Math.pow(0.85,d-1),A_NEAR*0.6);   /* tepi pun tetap bergerak */
      const ph=PH_MID+(PH_NEAR-PH_MID)*d;                              /* makin ke tepi makin tertinggal */
      out.push(amp*h*k*env*Math.sin(OM*s+ph));
    }
    return out;
  }
  /* kekuatan kilatan terang (0..1) pada waktu rel */
  function flash(p,rel){
    const per=p.per/100,t0=p.t0/100,w=p.wid/100*BR_W;
    let n=per>0?Math.round((rel-t0-BR_LAG)/per):0;
    if(!p.rep||n<0)n=0;
    const s=rel-(t0+BR_LAG+n*per);
    return Math.min(1,p.brt/100*Math.exp(-(s/w)*(s/w)));
  }

  function irisan(g,w,h,p,tm,opaque,rel){
    const o=offsets(h,p,rel),N=o.length;
    let any=false;
    for(const v of o)if(Math.abs(v)>0.05)any=true;
    if(!any)return;
    const S=ac('is_src',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    for(let k=0;k<N;k++){
      const xa=Math.round(k*w/N),xb=Math.round((k+1)*w/N),dy=o[k];
      g.save();
      g.beginPath();g.rect(xa,0,xb-xa,h);g.clip();
      if(dy>0.05){
        /* irisan turun: bagian atas yang terbuka diisi pantulan tepi atas gambar */
        g.save();g.translate(0,dy);g.scale(1,-1);g.drawImage(S.canvas,0,0);g.restore();
      }else if(dy<-0.05){
        /* irisan naik: bagian bawah yang terbuka diisi pantulan tepi bawah gambar */
        g.save();g.translate(0,2*h+dy);g.scale(1,-1);g.drawImage(S.canvas,0,0);g.restore();
      }
      g.drawImage(S.canvas,0,dy);
      g.restore();
    }
  }
  /* Flash Pulsa: kilatan terang saja (gambar ditambahkan ke dirinya sendiri, hasil = gambar x (1 + kekuatan), terpotong di putih) */
  function kilat(g,w,h,p,tm,opaque,rel){
    const fl=flash(p,rel);
    if(fl<=0.002)return;
    const B=ac('is_br',w,h);B.drawImage(g.canvas,0,0);
    g.save();g.globalCompositeOperation='lighter';g.globalAlpha=fl;g.drawImage(B.canvas,0,0);g.restore();
  }

  const entry={
    id:'irisan',
    name:'Irisan Pulsa',
    desc:'Gambar terbelah irisan tegak (2 sampai 10), semua irisan bergeser naik turun seperti gelombang dari tengah, berulang tiap hentakan. Tanpa kilatan terang',
    len:4.5,
    params:[
      ['n','Jumlah irisan (2 sampai 10)',2,10,5],
      ['amt','Kekuatan geser irisan (100 = persis video referensi)',0,200,100],
      ['t0','Puncak hentakan pertama (satuan 0,01 detik dari awal clip, 132 = detik 1,32)',0,600,132],
      ['per','Jarak antar hentakan (satuan 0,01 detik, 227 = 2,27 detik)',100,600,227],
      ['wid','Lama hentakan (satuan 0,01 detik, makin besar makin lama bergoyang)',20,150,51],
      ['rep','Ulangi hentakan (1 = berulang sepanjang clip, 0 = sekali saja)',0,1,1]
    ],
    apply:irisan
  };
  const entryFlash={
    id:'kilat',
    name:'Flash Pulsa',
    desc:'Gambar terang sesaat lalu kembali normal, berulang tiap hentakan. Waktunya sama dengan Irisan Pulsa, jadi bisa dipakai berdampingan',
    len:4.5,
    params:[
      ['brt','Kekuatan kilatan terang (40 = persis video referensi)',0,100,40],
      ['t0','Puncak hentakan pertama (satuan 0,01 detik dari awal clip, 132 = detik 1,32)',0,600,132],
      ['per','Jarak antar hentakan (satuan 0,01 detik, 227 = 2,27 detik)',100,600,227],
      ['wid','Lama hentakan (satuan 0,01 detik, makin besar makin lama terang)',20,150,51],
      ['rep','Ulangi hentakan (1 = berulang sepanjang clip, 0 = sekali saja)',0,1,1]
    ],
    apply:kilat
  };
  [entry,entryFlash].forEach(function(e){APK.fxclip.LIST.push(e);APK.fxclip.DEF[e.id]=e});
})();
