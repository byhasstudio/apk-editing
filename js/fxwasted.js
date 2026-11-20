/* Efek clip tambahan dari VIDEO REFERENSI "WhatsApp Video 2026-11-19 at 18.26.45" (mp4 480x864, 18,2 dtk, 60 fps; tiga foto 9:16 dengan Cermin Bayangan di atasnya).
   Bagian yang SUDAH ada di repo dan tidak dibuat ulang: Muncul dari Gelap (js/fxrefvideo.js), Cermin Bayangan (js/fxmirrorshadow.js),
   gerak foto (keyframe di preset), dan akhir video yang meredup jadi cahaya bulat (Blur Jadi Cahaya Redup / Meredup Bulat).
   Di sini tiga efek BARU yang diukur dari frame video:

   – Wasted (detik ke-5,05 di video, sekitar 1 detik)
       Dalam satu frame warna langsung LUNTUR dan gambar over-exposed (terang), lalu warna terus turun sampai hampir hitam putih dalam sekitar 0,35 detik.
       Bersamaan muncul PITA GELAP melintang (tinggi sekitar 16% layar, pusatnya sekitar 49% dari atas, setengah transparan sehingga teks di bawahnya masih tembus)
       dengan tulisan "wasted" MERAH di tengahnya (lebar tulisan sekitar 46% lebar layar), ala layar kematian game. Pita dan tulisan bertahan sekitar separuh clip,
       lalu memudar dan mengabur (di video bagian ini bertumpuk dengan awal transisi blur putar).
       Warna tetap luntur sampai clip efek berakhir (perpanjang clip kalau mau hitam putih lebih lama).

   – Blur Putar Putih (transisi antar foto, detik 5,4 sampai 6,3 dan 10,6 sampai 11,5 di video)
       Gambar mengabur kuat sambil berputar dan ter-zoom, berlapis bayangan sendiri, tersapu putih di puncak blur, lalu mengeras kembali dan menetap HITAM PUTIH
       (foto kedua di video tampil hitam putih). Pada peralihan kedua warnanya malah lebih pekat (oranye) saat mengabur dan tetap berwarna: itu parameter "Warna pekat saat blur"
       dan "Akhir hitam putih" = 0. Transisinya selalu 0,9 detik (dikali Kecepatan); sesudahnya keadaan akhir bertahan sampai clip efek berakhir, jadi clip boleh dibuat panjang.
       Pola: blur naik cepat sampai puncak sekitar 40% transisi, lalu turun mulus sampai tajam; putaran dan zoom mereda mengikuti.
       Sudut kosong akibat putar dan zoom ditutup dengan zoom tambahan secukupnya, jadi tidak ada sudut hitam.

   – Luntur Hitam Putih (detik 13,4 di video)
       Warna foto ketiga turun pelan (sekitar 0,4 detik) jadi hitam putih dan bertahan sampai clip efek berakhir.

   Dimuat setelah fxglitch2.js dan sebelum fxlib.js (daftar efek membaca APK.fxclip.LIST saat dibuka). */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};                 /* naik mulus */
  const eo=x=>{x=clamp(x,0,1);const q=1-x;return 1-q*q*q};         /* naik cepat lalu melambat */

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

  /* ===== Wasted ===== */
  function wasted(g,w,h,p,tm,opaque,rel){
    const t=Math.max(0,rel)*(p.spd/100);
    const lun=p.lun/100,glow=p.glow/100;
    /* 1. warna luntur dan terang berlebih: langsung kena di frame pertama, warna terus turun sampai sekitar 0,35 detik, terang mereda pelan */
    const sat=1-lun*(0.55+0.45*ss(t/0.35));
    const br=1+glow*0.55*eo(t/0.05)*(1-0.5*ss((t-0.4)/0.5));
    const ct=1+glow*0.18;
    if('filter' in g){
      const S=ac('wa_s',w,h);S.drawImage(g.canvas,0,0);
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      g.filter='saturate('+sat.toFixed(3)+') brightness('+br.toFixed(3)+') contrast('+ct.toFixed(3)+')';
      g.drawImage(S.canvas,0,0);
      g.filter='none';
    }
    /* 2. pita gelap dan tulisan merah: muncul seketika, bertahan, lalu memudar dan mengabur */
    const fade=1-ss((t-0.55)/0.3);
    if(fade<=0.004)return;
    const bh=Math.max(4,p.bh/100*h),cy=p.by/100*h,y0=cy-bh/2;
    const grow=0.35+0.65*eo(t/0.06);                       /* pita membuka cepat dari tengah */
    const hh=bh*grow;
    g.save();
    g.globalAlpha=fade*p.bd/100;
    g.fillStyle='#0a0a0a';
    g.fillRect(0,cy-hh/2,w,hh);
    g.restore();
    /* tulisan: ukuran huruf dicari supaya lebar kata sama dengan p.tw persen lebar layar */
    const txt='wasted';
    g.save();
    g.textAlign='center';g.textBaseline='middle';
    let fs=bh*0.5;
    g.font='500 '+fs+'px "Segoe UI",system-ui,Arial,sans-serif';
    const mw=g.measureText(txt).width;
    if(mw>0){fs=fs*(p.tw/100*w)/mw;g.font='500 '+fs+'px "Segoe UI",system-ui,Arial,sans-serif'}
    const blur=Math.max(0,(t-0.55)/0.3)*0.012*Math.min(w,h);   /* mengabur saat memudar */
    if(blur>0.3&&'filter' in g)g.filter='blur('+blur.toFixed(1)+'px)';
    g.globalAlpha=fade*clamp(0.35+hh/bh,0,1);
    g.fillStyle='#e5121b';
    g.fillText(txt,w/2,cy+bh*0.03);
    g.restore();
  }

  /* ===== Blur Putar Putih ===== */
  function blurputar(g,w,h,p,tm,opaque,rel,dur){
    const u=clamp(Math.max(0,rel)*(p.spd/100)/0.9,0,1);   /* transisi 0,9 detik; sesudahnya keadaan akhir (hitam putih) bertahan sampai clip berakhir */
    const hump=ss(u/0.3)*(1-ss((u-0.42)/0.55));            /* 0 -> 1 (puncak sekitar 40%) -> 0 */
    const bpx=p.bl/100*0.05*Math.min(w,h)*hump;
    const calm=1-ss(u);                                    /* putaran dan zoom mereda sampai akhir */
    const ang=p.rot*Math.PI/180*calm*(0.4+0.6*hump);
    const zm=1+p.zm/100*calm;
    /* sudut kosong akibat putar dan zoom ditutup dengan zoom tambahan secukupnya */
    const sa=Math.abs(Math.sin(ang)),ca=Math.cos(ang),ar=Math.max(w/h,h/w);
    const z=Math.max(zm,ca+sa*ar);
    const gray=p.gr/100*ss((u-0.25)/0.5);                  /* menetap hitam putih setelah blur reda */
    const sat=(1+p.bs/100*hump)*(1-gray);
    const wash=p.wh/100*hump;
    if(u<=0.001&&bpx<=0.1)return;
    const S=ac('bp_s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    const hasF='filter' in g;
    const put=(sc,rot,al,bl)=>{
      g.save();
      g.globalAlpha=al;
      if(hasF)g.filter='saturate('+Math.max(0,sat).toFixed(3)+') brightness('+(1+0.25*wash).toFixed(3)+')'+(bl>0.3?' blur('+bl.toFixed(1)+'px)':'');
      g.translate(w/2,h/2);g.rotate(rot);g.scale(sc,sc);g.translate(-w/2,-h/2);
      g.drawImage(S.canvas,0,0);
      g.restore();
    };
    put(z,ang,1,bpx);
    if(hump>0.02)put(z*(1+0.14*hump),-ang*1.6,0.45*hump,bpx*1.3);    /* bayangan berlapis yang berputar ke arah sebaliknya */
    if(wash>0.003){                                         /* sapuan putih di puncak blur */
      g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=wash*0.6;g.fillStyle='#fff';g.fillRect(0,0,w,h);g.restore();
    }
  }

  /* ===== Luntur Hitam Putih ===== */
  function hitamputih(g,w,h,p,tm,opaque,rel){
    if(!('filter' in g))return;
    const sat=1-p.lun/100*ss(Math.max(0,rel)/Math.max(0.05,p.rmp/10));
    if(sat>=0.999)return;
    const S=ac('hp_s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.filter='saturate('+Math.max(0,sat).toFixed(3)+')';
    g.drawImage(S.canvas,0,0);
    g.filter='none';
  }

  const SPR=['spd','Kecepatan (100 = sama dengan video referensi)',25,300,100];
  const ENTRIES=[
    {id:'wasted',name:'Wasted',desc:'Warna langsung luntur dan terang, pita gelap dengan tulisan "wasted" merah di tengah, lalu memudar (dari video referensi)',len:1,
      params:[['lun','Luntur warna (100 = hitam putih penuh)',0,100,90],['glow','Terang berlebih di awal',0,100,60],['bd','Kegelapan pita (%)',0,100,82],['bh','Tinggi pita (% tinggi layar)',5,40,16],['by','Posisi pita dari atas (%)',10,90,49],['tw','Lebar tulisan (% lebar layar)',20,90,46],SPR],apply:wasted},
    {id:'blurputar',name:'Blur Putar Putih',desc:'Transisi: gambar mengabur sambil berputar dan zoom, tersapu putih, lalu menetap hitam putih (dari video referensi)',len:0.9,
      params:[['bl','Blur maksimum',0,100,45],['rot','Putaran awal (derajat)',0,40,10],['zm','Zoom awal (%)',0,60,20],['wh','Sapuan putih di puncak',0,100,55],['gr','Akhir hitam putih (0 = tetap berwarna)',0,100,100],['bs','Warna pekat saat blur (%)',0,100,0],SPR],apply:blurputar},
    {id:'hitamputih',name:'Luntur Hitam Putih',desc:'Warna turun pelan jadi hitam putih dan bertahan sampai clip efek berakhir (dari video referensi)',len:3,
      params:[['lun','Luntur warna (100 = hitam putih penuh)',0,100,100],['rmp','Lama luntur (x0,1 detik)',1,50,4]],apply:hitamputih}
  ];
  ENTRIES.forEach(function(e){F.LIST.push(e);F.DEF[e.id]=e});
})();
