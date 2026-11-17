/* Efek clip tambahan: Irisan Pulsa
   Meniru video referensi (diukur frame demi frame, 60 fps, 4,55 detik). Hanya bagian efeknya; latar kotak-kotak biru, media mengecil, bayangan, fade hitam di awal,
   dan watermark TikTok di video referensi sengaja tidak ikut.
   Cara kerja yang diukur dari video:
   – Gambar dibelah jadi 5 irisan tegak yang lebarnya sama. Irisan paling kiri dan paling kanan diam.
   – Tiga irisan di tengah bergeser naik turun (tanpa zoom, tanpa geser ke samping): irisan tengah paling jauh (sekitar 3,05% tinggi layar),
     dua irisan di sebelahnya sekitar 2,36% tinggi layar dan tertinggal sekitar 0,12 detik dari irisan tengah, jadi terlihat seperti gelombang yang merambat keluar dari tengah.
   – Satu hentakan = gelombang sinus (sekitar 0,86 detik per putaran, 7,33 rad/detik) yang kekuatannya naik lalu turun berbentuk lonceng (lebar sekitar 0,51 detik),
     puncaknya di detik 1,32 dari awal clip. Hentakan yang sama muncul lagi tiap 2,27 detik (di video: detik 1,32 dan 3,59).
   – Bersamaan dengan hentakan, gambar menjadi lebih terang sekitar 40% (puncaknya sekitar 0,055 detik setelah puncak gelombang), lalu kembali normal.
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
  const N=5;                    /* jumlah irisan tegak */
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
    let n=per>0?Math.round((rel-t0)/per):0;
    if(!p.rep||n<0)n=0;
    const s=rel-(t0+n*per),env=Math.exp(-(s/w)*(s/w));
    const mid=A_MID*h*k*env*Math.sin(OM*s+PH_MID),near=A_NEAR*h*k*env*Math.sin(OM*s+PH_NEAR);
    return [0,near,mid,near,0];
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
    const o=offsets(h,p,rel),fl=flash(p,rel);
    let any=fl>0.002;
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
    if(fl>0.002){
      /* kilatan terang: gambar ditambahkan ke dirinya sendiri (hasil = gambar x (1 + kekuatan), terpotong di putih) */
      const B=ac('is_br',w,h);B.drawImage(g.canvas,0,0);
      g.save();
      g.globalCompositeOperation='lighter';g.globalAlpha=fl;
      g.drawImage(B.canvas,0,0);
      g.restore();
    }
  }

  const entry={
    id:'irisan',
    name:'Irisan Pulsa',
    desc:'Gambar terbelah 5 irisan tegak, 3 irisan tengah bergeser naik turun seperti gelombang dan terang sesaat, berulang tiap hentakan',
    len:4.5,
    params:[
      ['amt','Kekuatan geser irisan (100 = persis video referensi)',0,200,100],
      ['brt','Kilatan terang saat hentakan (40 = persis video referensi, 0 = tanpa kilatan)',0,100,40],
      ['t0','Puncak hentakan pertama (satuan 0,01 detik dari awal clip, 132 = detik 1,32)',0,600,132],
      ['per','Jarak antar hentakan (satuan 0,01 detik, 227 = 2,27 detik)',100,600,227],
      ['wid','Lama hentakan (satuan 0,01 detik, makin besar makin lama bergoyang)',20,150,51],
      ['rep','Ulangi hentakan (1 = berulang sepanjang clip, 0 = sekali saja)',0,1,1]
    ],
    apply:irisan
  };
  APK.fxclip.LIST.push(entry);
  APK.fxclip.DEF[entry.id]=entry;
})();
