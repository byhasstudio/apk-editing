/* Efek clip tambahan dari video referensi (edit TikTok hitam-putih: mobil dan anime bermata menyala).
   Tiga efek ini muncul di daftar Efek (tombol ✦ Efek di timeline) dan di pilihan "Jenis efek" panel Properti, dan semuanya mengikuti PANJANG CLIP efek:

   – Flash Gelap (darkflash): clip mulai hampir hitam, hanya titik-titik paling terang (lampu, kilau mata) yang berkedip-kedip dan berpendar,
     lalu gambar muncul pelan dari gelap. Mode "padam" membalik urutannya (gambar meredup jadi bulatan cahaya lalu hitam, seperti akhir video referensi).
   – Color Pop (colorpop): seluruh gambar dijadikan hitam putih (agak gelap dan kontras), tapi warna yang jenuh (mata ungu, biru) tetap berwarna, bersinar,
     dan sinarnya berdenyut pelan. Warna yang dipertahankan bisa otomatis (semua warna jenuh) atau dipilih manual lewat slider Warna.
   – Blur Zoom Sentak (zsnap): gambar menyedot ke dalam makin lama makin cepat dengan blur radial dan sedikit putaran, lalu "snap" kembali tajam.
     Berbeda dari Zoom Blur biasa (js/fxkamu.js): naiknya menyentak (makin cepat), kembalinya sangat cepat, ada pecah warna RGB di tepi, kilau putih
     di puncak, dan pusat zoom bisa digeser.

   Dimuat setelah js/fxclip.js dan sebelum js/fxlib.js. apply(g, w, h, p, tm, opaque, rel, dur): lihat penjelasan di js/fxclip.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
  const fast=()=>!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);   /* preview diputar: cuplikan lebih sedikit, lebih ringan */

  /* kanvas bantu (dipakai bergantian, tidak pernah bersarang); read=true untuk kanvas yang dibaca pikselnya */
  const aux={};
  function ac(name,w,h,read){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d',read?{willReadFrequently:true}:undefined);
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    return g;
  }
  const reset=(g,w,h,opaque)=>{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
  };
  /* pendar lembut: src diperkecil dua tahap lalu diperbesar kembali dan DITAMBAHKAN ke g (murah, tanpa blur berat) */
  function bloom(g,src,w,h,alpha){
    if(alpha<0.01)return;
    const a=Math.max(4,Math.round(w/10)),b=Math.max(4,Math.round(h/10));
    const A=ac('bl1',a,b);A.imageSmoothingQuality='high';A.drawImage(src,0,0,a,b);
    const c=Math.max(8,Math.round(w/3)),d=Math.max(8,Math.round(h/3));
    const B=ac('bl2',c,d);B.imageSmoothingQuality='high';B.drawImage(A.canvas,0,0,c,d);
    g.save();
    g.globalCompositeOperation='lighter';g.globalAlpha=clamp(alpha,0,1);g.imageSmoothingQuality='high';
    g.drawImage(B.canvas,0,0,w,h);
    g.restore();
  }

  /* ===== Flash Gelap ===== */
  function darkflash(g,w,h,p,tm,opaque,rel,dur){
    let u=dur>0?clamp(rel/dur,0,1):0.5;
    if(p.dir>=50)u=1-u;                                   /* mode padam: urutan dibalik */
    const r=ss((u-0.04)/Math.max(0.05,p.rvl/100)),dk=1-r;  /* r = seberapa muncul (0..1), dk = seberapa gelap */
    const vs=p.vig/100*0.85*(0.25+0.75*dk);
    if(dk<0.004&&vs<0.01)return;
    /* kedipan: acak stabil per 1/20 detik (disesuaikan kecepatan), hanya terasa selama masih gelap */
    const fl=p.flk/100,rd=rng(Math.floor(rel*p.spd/50*20)*7919+313),n=rd(),n2=rd();
    const hlA=clamp(p.hl/100*(1-fl*dk*(n<0.38?0.95:0.4*(1-n))),0,1);
    const fullA=clamp(r*(1-fl*dk*0.5*(n2<0.3?1:0))+dk*p.dim/200,0,1);
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    reset(g,w,h,opaque);
    if(hlA>0.01&&dk>0.004){
      /* lapisan titik cahaya: kontras tinggi membuang semua yang redup, tersisa hanya bagian paling terang */
      const H=ac('h',w,h);
      if('filter' in H){
        H.filter='brightness('+lerp(1.5,0.55,p.thr/100).toFixed(2)+') contrast(4)';
        H.drawImage(S.canvas,0,0);H.filter='none';
      }else{
        H.drawImage(S.canvas,0,0);
        H.globalCompositeOperation='multiply';H.drawImage(S.canvas,0,0);H.drawImage(S.canvas,0,0);
        H.globalCompositeOperation='source-over';
      }
      g.globalAlpha=hlA;g.drawImage(H.canvas,0,0);g.globalAlpha=1;
      bloom(g,H.canvas,w,h,hlA*p.gl/100*0.9*Math.min(1,dk*1.5));
    }
    if(fullA>0.003){g.globalAlpha=fullA;g.drawImage(S.canvas,0,0);g.globalAlpha=1}
    if(vs>0.01){
      const grd=g.createRadialGradient(w/2,h/2,Math.min(w,h)*0.12,w/2,h/2,Math.hypot(w,h)*0.55);
      grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(1,'rgba(0,0,0,'+vs.toFixed(3)+')');
      g.globalCompositeOperation='source-atop';g.fillStyle=grd;g.fillRect(0,0,w,h);
      g.globalCompositeOperation='source-over';
    }
  }

  /* ===== Color Pop ===== */
  function colorpop(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5;
    const inK=(p.fin>0&&dur>0)?ss(u/(p.fin/100)):1;        /* warna muncul pelan di awal clip */
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    /* topeng warna dihitung di kanvas kecil (lebar maks 320 px) supaya ringan, lalu diperbesar dan dilembutkan */
    const sw=Math.min(w,320),sh=Math.max(1,Math.round(sw*h/w));
    const M=ac('m',sw,sh,true);M.drawImage(S.canvas,0,0,sw,sh);
    const id=M.getImageData(0,0,sw,sh),d=id.data;
    const auto=p.auto>=50,hue=p.hue,rg=Math.max(5,p.rng),smin=p.sat/100,vmin=0.16;
    for(let i=0;i<d.length;i+=4){
      const r=d[i]/255,gg=d[i+1]/255,b=d[i+2]/255;
      const mx=Math.max(r,gg,b),mn=Math.min(r,gg,b),dl=mx-mn;
      let a=0;
      if(mx>vmin){
        const sa=ss((dl/mx-smin)/0.14);
        if(sa>0){
          let ha=1;
          if(!auto){
            let hh;
            if(dl<1e-6)hh=0;
            else if(mx===r)hh=60*(((gg-b)/dl+6)%6);
            else if(mx===gg)hh=60*((b-r)/dl+2);
            else hh=60*((r-gg)/dl+4);
            let dd=Math.abs(hh-hue);dd=Math.min(dd,360-dd);   /* jarak warna melingkar */
            ha=dd<=rg*0.6?1:dd>=rg?0:1-(dd-rg*0.6)/(rg*0.4);
          }
          a=sa*ha*ss((mx-vmin)/0.14);
        }
      }
      d[i]=d[i+1]=d[i+2]=255;d[i+3]=Math.round(a*255);
    }
    M.putImageData(id,0,0);
    const B=ac('mb',sw,sh);
    if('filter' in B){B.filter='blur(1.4px)';B.drawImage(M.canvas,0,0);B.filter='none'}else B.drawImage(M.canvas,0,0);
    /* lapisan warna = gambar asli yang hanya terlihat di dalam topeng */
    const K=ac('k',w,h);
    K.imageSmoothingQuality='high';K.drawImage(B.canvas,0,0,sw,sh,0,0,w,h);
    K.globalCompositeOperation='source-in';K.drawImage(S.canvas,0,0);K.globalCompositeOperation='source-over';
    /* dasar hitam putih, agak gelap dan kontras */
    reset(g,w,h,opaque);
    const gy=p.gry/100,ct=(1+p.ctr/100).toFixed(2),br=(1-p.drk/100).toFixed(2);
    if('filter' in g){
      g.filter='grayscale('+gy.toFixed(2)+') contrast('+ct+') brightness('+br+')';
      g.drawImage(S.canvas,0,0);g.filter='none';
    }else{
      g.drawImage(S.canvas,0,0);
      g.globalCompositeOperation='saturation';g.globalAlpha=gy;g.fillStyle='#808080';g.fillRect(0,0,w,h);
      g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(S.canvas,0,0);
      g.globalCompositeOperation='source-over';
    }
    /* warna ditempel kembali, sedikit lebih tajam */
    if('filter' in g)g.filter='saturate(1.25)';
    g.globalAlpha=inK;g.drawImage(K.canvas,0,0);
    g.globalAlpha=1;if('filter' in g)g.filter='none';
    /* pendar berdenyut di sekitar bagian berwarna */
    const pulse=1-p.pls/100*0.45*(0.5+0.5*Math.sin(tm*5.6));
    bloom(g,K.canvas,w,h,p.gl/100*inK*pulse*0.9);
  }

  /* ===== Blur Zoom Sentak ===== */
  function zsnap(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5;
    const pk=0.35+p.pk/100*0.5,fl=Math.max(0.05,(1-pk)*lerp(1,0.25,p.snp/100));
    let e;
    if(u<pk)e=Math.pow(u/pk,2);                            /* naik menyentak: makin lama makin cepat */
    else if(u<pk+fl)e=1-ss((u-pk)/fl);                     /* kembali tajam dengan cepat */
    else e=0;
    e*=p.amt/100;
    if(e<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const span=p.zm/100*e,rot=p.rot*Math.PI/180*e,N=fast()?8:16,asp=Math.max(w/h,h/w);
    const px=w*p.cx/100,py=h*p.cy/100;
    reset(g,w,h,opaque);
    for(let i=0;i<N;i++){
      const f=N>1?i/(N-1)-0.5:0,a=f*rot;
      const cover=Math.max(1,Math.cos(Math.abs(a))+asp*Math.sin(Math.abs(a)));   /* tutup tepi kosong akibat putaran */
      const z=1+(f+0.5)*span+0.2*span;
      g.save();
      g.globalAlpha=1/(i+1);                               /* bobot 1/(i+1) = rata-rata semua cuplikan */
      g.translate(w/2,h/2);g.rotate(a);g.scale(cover,cover);g.translate(-w/2,-h/2);
      g.translate(px,py);g.scale(z,z);g.translate(-px,-py);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
    /* pecah warna RGB: tiap kanal diperbesar sedikit berbeda dari pusat zoom */
    if(p.ca>0&&e>0.04){
      const ca=p.ca/100*e*0.035,A=ac('a',w,h),T=ac('t',w,h);
      A.drawImage(g.canvas,0,0);
      reset(g,w,h,opaque);
      g.globalCompositeOperation='lighter';
      for(const q of [['#f00',1+ca*1.6],['#0f0',1+ca*0.8],['#00f',1]]){
        T.globalCompositeOperation='source-over';T.clearRect(0,0,w,h);
        T.drawImage(A.canvas,0,0);
        T.globalCompositeOperation='multiply';T.fillStyle=q[0];T.fillRect(0,0,w,h);
        T.globalCompositeOperation='destination-in';T.drawImage(A.canvas,0,0);
        g.save();g.translate(px,py);g.scale(q[1],q[1]);g.translate(-px,-py);g.drawImage(T.canvas,0,0);g.restore();
      }
      g.globalCompositeOperation='source-over';
    }
    /* kilau putih di puncak sentakan */
    if(p.flr>0){
      g.globalCompositeOperation=opaque?'lighter':'source-atop';
      g.fillStyle='rgba(255,255,255,'+(p.flr/100*e*0.35).toFixed(3)+')';g.fillRect(0,0,w,h);
      g.globalCompositeOperation='source-over';
    }
  }

  const NEW=[
    {id:'darkflash',name:'Flash Gelap',desc:'Muncul dari gelap: hanya titik cahaya yang berkedip dan berpendar, lalu gambar terang pelan-pelan',len:1.2,
      params:[
        ['dir','Arah (0 = muncul dari gelap, 100 = padam ke gelap)',0,100,0],
        ['rvl','Lama gambar muncul (% dari panjang clip)',10,100,70],
        ['flk','Kekuatan kedipan',0,100,70],
        ['spd','Kecepatan kedipan',10,100,50],
        ['hl','Terang titik cahaya',0,100,100],
        ['thr','Batas titik cahaya (makin besar = makin sedikit yang menyala)',0,100,50],
        ['gl','Pendar titik cahaya',0,100,60],
        ['dim','Terang dasar saat gelap (0 = hitam pekat)',0,40,6],
        ['vig','Vignette gelap di tepi',0,100,40]],apply:darkflash},
    {id:'colorpop',name:'Color Pop',desc:'Hitam putih, hanya warna jenuh (misalnya mata) yang tetap berwarna dan bersinar',len:3,
      params:[
        ['auto','Mode warna (0 = pilih manual lewat Warna, 100 = otomatis: semua warna jenuh dipertahankan)',0,100,100],
        ['hue','Warna yang dipertahankan, mode manual (0 merah, 60 kuning, 120 hijau, 180 cyan, 240 biru, 300 ungu/pink)',0,360,300],
        ['rng','Jangkauan warna, mode manual (derajat)',5,180,60],
        ['sat','Batas kejenuhan (makin besar = hanya warna paling pekat yang tetap)',0,100,45],
        ['gry','Hitam putih (100 = abu-abu penuh)',0,100,100],
        ['ctr','Kontras hitam putih',0,100,25],
        ['drk','Gelapkan hitam putih',0,60,15],
        ['gl','Pendar warna',0,100,55],
        ['pls','Denyut pendar',0,100,40],
        ['fin','Warna muncul pelan di awal (% dari panjang clip, 0 = langsung)',0,100,12]],apply:colorpop},
    {id:'zsnap',name:'Blur Zoom Sentak',desc:'Tersedot masuk menyentak dengan blur radial dan pecah warna, lalu snap tajam lagi',len:0.6,
      params:[
        ['amt','Kekuatan',0,100,85],
        ['zm','Zoom blur (%)',0,150,70],
        ['pk','Titik puncak (0 = cepat tiba, 100 = menjelang akhir clip)',0,100,55],
        ['snp','Kecepatan kembali tajam (makin besar = makin cepat)',0,100,60],
        ['rot','Putaran sedikit (derajat)',0,30,4],
        ['ca','Pecah warna RGB',0,100,45],
        ['flr','Kilau putih di puncak',0,100,25],
        ['cx','Pusat zoom, kiri-kanan (50 = tengah)',0,100,50],
        ['cy','Pusat zoom, atas-bawah (50 = tengah)',0,100,50]],apply:zsnap}
  ];
  for(const d of NEW)if(!F.DEF[d.id]){F.LIST.push(d);F.DEF[d.id]=d}
})();

/* ===== Bagian 2: empat efek lagi dari video referensi yang sama =====
   – Streak Horizontal (hstreak): gambar ditarik jadi garis cahaya horizontal (motion blur ekstrem), terang dan kontras, lalu kembali. Cocok sebelum pindah clip.
   – Potong Geser (gslice): gambar terpotong jadi pita horizontal yang bergeser dan melebar acak, muncul sebentar-sebentar (beda dari Glitch RGB: tanpa pecah warna).
   – Meredup Bulat (vigfade): gambar mengabur, memudar jadi hitam putih, menyusut jadi bulatan cahaya abu-abu di tengah, lalu hitam (akhir video referensi).
   – Getar Ritme (pshake): zoom menghentak tiap ketukan (tempo bisa diatur) lalu mereda, dengan geser dan getar halus. Taruh awal clip tepat di ketukan pertama. */
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const lerp=(a,b,t)=>a+(b-a)*t;
  const bell=u=>Math.pow(Math.sin(Math.PI*clamp(u,0,1)),1.2);
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
  const fast=()=>!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);
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
  const reset=(g,w,h,opaque)=>{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
  };
  function bloom(g,src,w,h,alpha){
    if(alpha<0.01)return;
    const a=Math.max(4,Math.round(w/10)),b=Math.max(4,Math.round(h/10));
    const A=ac('b1',a,b);A.imageSmoothingQuality='high';A.drawImage(src,0,0,a,b);
    const c=Math.max(8,Math.round(w/3)),d=Math.max(8,Math.round(h/3));
    const B=ac('b2',c,d);B.imageSmoothingQuality='high';B.drawImage(A.canvas,0,0,c,d);
    g.save();g.globalCompositeOperation='lighter';g.globalAlpha=clamp(alpha,0,1);g.imageSmoothingQuality='high';
    g.drawImage(B.canvas,0,0,w,h);g.restore();
  }
  function desat(g,w,h,k){
    if(k<0.01)return;
    const T=ac('d',w,h);
    T.drawImage(g.canvas,0,0);
    T.globalCompositeOperation='saturation';T.globalAlpha=clamp(k,0,1);T.fillStyle='#808080';T.fillRect(0,0,w,h);
    T.globalCompositeOperation='destination-in';T.globalAlpha=1;T.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);g.drawImage(T.canvas,0,0);
  }

  /* ===== Streak Horizontal ===== */
  function hstreak(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5,e=bell(u)*p.amt/100;
    if(e<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const span=p.len/100*e*0.8,N=fast()?10:20;
    reset(g,w,h,opaque);
    for(let i=0;i<N;i++){
      const f=N>1?i/(N-1)-0.5:0;
      g.save();
      g.globalAlpha=1/(i+1);
      g.translate(w/2+f*span*w,h/2);g.scale(1+span,1);g.translate(-w/2,-h/2);   /* diperlebar sedikit supaya tepi tidak bolong */
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
    if('filter' in g){
      const T=ac('t',w,h);T.drawImage(g.canvas,0,0);
      reset(g,w,h,opaque);
      g.filter='contrast('+(1+e*p.brt/40).toFixed(2)+') brightness('+(1-e*p.drk/100).toFixed(2)+')';
      g.drawImage(T.canvas,0,0);g.filter='none';
    }
    bloom(g,g.canvas,w,h,e*p.brt/100*0.5);
  }

  /* ===== Potong Geser ===== */
  function gslice(g,w,h,p,tm,opaque,rel,dur){
    const k=Math.max(0.2,p.spd/50),rd=rng(Math.floor(tm*k*14)*104729+57);
    if(rd()>p.bst/100)return;                               /* hanya muncul sebentar-sebentar */
    const u=dur>0?clamp(rel/dur,0,1):0.5,env=dur>0?Math.max(0.35,bell(u)):1,amt=p.amt/100*env;
    if(amt<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    for(let i=0;i<p.cnt;i++){
      const y=Math.floor(rd()*h),hh=Math.min(h-y,Math.max(2,Math.floor((0.01+rd()*p.hgt/100)*h)));
      const dx=(rd()-0.5)*2*amt*w*0.35,sx=1+rd()*p.str/100*amt*0.8,dy=(rd()-0.5)*2*p.vsh/100*amt*h*0.04;
      if(hh<=0)continue;
      g.drawImage(S.canvas,0,y,w,hh,dx-(sx-1)*w/2,y+dy,w*sx,hh);
    }
  }

  /* ===== Meredup Bulat ===== */
  function vigfade(g,w,h,p,tm,opaque,rel,dur){
    let u=dur>0?clamp(rel/dur,0,1):0.5;
    if(p.dir>=50)u=1-u;
    const er=ss(u),e=er*p.amt/100;
    if(er<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    reset(g,w,h,opaque);
    const kb=1+e*p.blr/100*18,tw=Math.max(8,Math.round(w/kb)),th=Math.max(8,Math.round(h/kb));
    const T=ac('t',tw,th);T.imageSmoothingQuality='high';T.drawImage(S.canvas,0,0,tw,th);
    g.imageSmoothingQuality='high';g.drawImage(T.canvas,0,0,tw,th,0,0,w,h);
    desat(g,w,h,e*p.gry/100*1.3);
    const cl=p.cls/100,R0=Math.hypot(w,h)/2*1.05,R=lerp(R0,R0*0.06,er*cl);
    const grd=g.createRadialGradient(w/2,h/2,R*0.15,w/2,h/2,R);
    grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(0.5,'rgba(0,0,0,0.5)');grd.addColorStop(1,'rgba(0,0,0,1)');
    g.globalCompositeOperation='source-atop';
    if(cl>0){g.fillStyle=grd;g.fillRect(0,0,w,h)}
    const ba=ss((er-0.75)/0.25)*cl;                         /* menjelang akhir clip: hitam penuh */
    if(ba>0.003){g.fillStyle='rgba(0,0,0,'+ba.toFixed(3)+')';g.fillRect(0,0,w,h)}
    g.globalCompositeOperation='source-over';
  }

  /* ===== Getar Ritme ===== */
  function pshake(g,w,h,p,tm,opaque,rel){
    const bp=60/p.bpm,ph=(rel%bp)/bp,beat=Math.floor(rel/bp);
    const env=Math.exp(-ph*(3+p.dec*0.12)),rd=rng(beat*7919+11),A=p.amt/100,J=p.jit/100;
    const jx=(rd()-0.5)*2,jy=(rd()-0.5)*2,jr=(rd()-0.5)*2;
    const tx=(jx*env*A*0.025+Math.sin(tm*47)*J*0.004)*w,ty=(jy*env*A*0.025+Math.cos(tm*53)*J*0.004)*h;
    const r=jr*p.rot*Math.PI/180*env+Math.sin(tm*31)*J*0.002;
    const cover=1+2*Math.max((Math.abs(tx)+Math.abs(r)*h/2+1)/w,(Math.abs(ty)+Math.abs(r)*w/2+1)/h);
    const z=Math.max(1+A*0.12*env,cover);
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    reset(g,w,h,opaque);
    g.translate(w/2+tx,h/2+ty);g.rotate(r);g.scale(z,z);g.translate(-w/2,-h/2);
    g.drawImage(S.canvas,0,0);
  }

  const NEW2=[
    {id:'hstreak',name:'Streak Horizontal',desc:'Gambar ditarik jadi garis cahaya horizontal, terang dan kontras, lalu kembali',len:0.5,
      params:[
        ['amt','Kekuatan',0,100,90],
        ['len','Panjang garis',0,100,70],
        ['brt','Terang dan kontras garis',0,100,60],
        ['drk','Gelapkan dasar',0,100,25]],apply:hstreak},
    {id:'gslice',name:'Potong Geser',desc:'Gambar terpotong jadi pita horizontal yang bergeser dan melebar acak, muncul sebentar-sebentar',len:1,
      params:[
        ['amt','Kekuatan geser',0,100,60],
        ['cnt','Jumlah potongan',1,24,8],
        ['hgt','Tinggi potongan maks (% layar)',1,30,10],
        ['str','Pelebaran potongan',0,100,40],
        ['vsh','Geser vertikal',0,100,25],
        ['spd','Kecepatan ganti pola',10,100,50],
        ['bst','Seberapa sering muncul (100 = terus)',0,100,70]],apply:gslice},
    {id:'vigfade',name:'Meredup Bulat',desc:'Gambar mengabur, memudar hitam putih, menyusut jadi bulatan cahaya, lalu hitam',len:2,
      params:[
        ['dir','Arah (0 = meredup ke hitam, 100 = muncul dari bulatan)',0,100,0],
        ['amt','Kekuatan kabur dan hitam putih',0,100,85],
        ['blr','Kabur',0,100,70],
        ['gry','Hitam putih',0,100,80],
        ['cls','Penyusutan bulatan dan gelap (0 = tanpa)',0,100,100]],apply:vigfade},
    {id:'pshake',name:'Getar Ritme',desc:'Zoom menghentak tiap ketukan lalu mereda, dengan geser dan getar halus',len:3,
      params:[
        ['amt','Kekuatan hentak',0,100,60],
        ['bpm','Tempo (ketukan per menit)',60,240,120],
        ['dec','Kecepatan mereda (makin besar = makin cepat)',0,100,50],
        ['jit','Getar halus',0,100,40],
        ['rot','Putar sedikit (derajat)',0,10,1]],apply:pshake}
  ];
  for(const d of NEW2)if(!F.DEF[d.id]){F.LIST.push(d);F.DEF[d.id]=d}
})();
