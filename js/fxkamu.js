/* Efek tambahan dari video referensi preset "kamu yang kasi tinggal 3 foto" (js/fxclip.js menyediakan daftar efek, file ini menambahkan tiga efek ke dalamnya
   dan memasang clip efek ke preset itu saat file presetnya dibuka).
   Dimuat setelah js/presets.js dan js/fxclip.js, sebelum js/fxlib.js, jadi efeknya muncul di daftar Efek dan di pilihan "Jenis efek" panel Properti.

   EFEK BARU (semuanya mengikuti PANJANG CLIP efek: kuat di tengah lalu mereda, kecuali Kabur mode naik terus)
   - Pusaran Blur  : gambar berputar dan membesar kabur ke segala arah, makin lama makin hitam putih lalu warnanya kembali (transisi detik 8,3-9,0 di referensi).
   - Zoom Blur     : gambar tersedot masuk dengan kabur radial, lalu tajam lagi (detik 10,4-10,8).
   - Kabur Halus   : gambar mengabur lalu tajam lagi (atau mengabur terus sampai akhir clip) dengan kabut terang tipis (detik 11,3-12,3 dan penutup 16,2-17,3).

   PRESET: saat file preset "kamu yang kasi tinggal 3 foto" dibaca, dua track efek ditambahkan di atas semua track:
   Glitch RGB di tiap ketukan flip (0,6 / 7,0 / 9,9 / 11,1 / 12,7 / 13,9 / 15,9 dtk), Pusaran Blur, Zoom Blur, tiga Gelombang beruntun dengan Kabur Halus
   (11,3 / 11,75 / 12,05 dtk), dan Kabur Halus penutup. Waktunya diukur frame demi frame dari video referensi. Efek berdiri sendiri sebagai clip,
   jadi bisa digeser, dipotong, diganti jenisnya, atau dihapus di timeline seperti clip efek biasa. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
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
  const fast=()=>!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);   /* preview diputar: lebih sedikit cuplikan, lebih ringan */
  const bell=u=>Math.pow(Math.sin(Math.PI*clamp(u,0,1)),1.2);
  const reset=(g,w,h,opaque)=>{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
  };
  /* kaburkan seluruh S ke g (blur Gaussian kalau browser mendukung, kalau tidak: perkecil lalu perbesar). Tepi tidak memudar karena gambar sedikit diperbesar. */
  function blurTo(g,S,w,h,px){
    if(px<0.8){g.drawImage(S.canvas,0,0);return}
    if('filter' in g){
      const m=Math.ceil(px*2);
      g.filter='blur('+px.toFixed(1)+'px)';
      g.drawImage(S.canvas,-m,-m,w+2*m,h+2*m);
      g.filter='none';
      return;
    }
    const s=1/(1+px/2),tw=Math.max(2,Math.round(w*s)),th=Math.max(2,Math.round(h*s)),T=ac('b',tw,th);
    T.imageSmoothingQuality='high';T.drawImage(S.canvas,0,0,tw,th);
    g.imageSmoothingQuality='high';g.drawImage(T.canvas,0,0,tw,th,0,0,w,h);
  }
  /* kurangi warna sebesar k (0..1) pada hasil g, transparansi tetap */
  function desat(g,w,h,k){
    if(k<0.01)return;
    const T=ac('d',w,h);
    T.drawImage(g.canvas,0,0);
    T.globalCompositeOperation='saturation';T.globalAlpha=clamp(k,0,1);T.fillStyle='#808080';T.fillRect(0,0,w,h);
    T.globalCompositeOperation='destination-in';T.globalAlpha=1;T.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);g.drawImage(T.canvas,0,0);
  }
  /* rata-rata N cuplikan gambar S: tiap cuplikan memakai transformasi tab(f) (f dari -0.5 sampai 0.5) pada pusat layar */
  function accum(g,S,w,h,opaque,N,tf){
    reset(g,w,h,opaque);
    for(let i=0;i<N;i++){
      const f=N>1?i/(N-1)-0.5:0;
      g.save();
      g.globalAlpha=1/(i+1);                      /* cuplikan ke-i berbobot 1/(i+1) = rata-rata rata semua cuplikan */
      g.translate(w/2,h/2);tf(g,f);g.translate(-w/2,-h/2);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
  }

  /* ===== Pusaran Blur ===== */
  function swirl(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5,e=bell(u)*p.amt/100;
    if(e<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const rot=p.rot*Math.PI/180*e,zm=p.zm/100*e,asp=Math.max(w/h,h/w),N=fast()?7:14;
    accum(g,S,w,h,opaque,N,(c,f)=>{
      const a=f*rot,cover=Math.cos(Math.abs(a))+asp*Math.sin(Math.abs(a));     /* diperbesar supaya sudut tidak membuka tepi kosong */
      const z=(1+(f+0.5)*zm)*Math.max(1,cover);
      c.rotate(a);c.scale(z,z);
    });
    desat(g,w,h,p.gry/100*clamp(e*1.4,0,1));
  }

  /* ===== Zoom Blur ===== */
  function zblur(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5,pk=0.45;
    const e=(u<pk?ss(u/pk):1-ss((u-pk)/(1-pk)))*p.amt/100;
    if(e<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const span=p.zm/100*e,N=fast()?8:16;
    accum(g,S,w,h,opaque,N,(c,f)=>{const z=1+(f+0.5)*span+0.35*span;c.scale(z,z)});
  }

  /* ===== Kabur Halus ===== */
  function kabur(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0.5,ramp=p.rmp>=50;
    const e=(ramp?ss(u):bell(u))*p.amt/100;
    if(e<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    reset(g,w,h,opaque);
    blurTo(g,S,w,h,e*0.07*w);
    const mst=p.mst/100*e*0.75;
    if(mst>0.005){
      g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=1;g.fillStyle='rgba(214,214,218,'+mst.toFixed(3)+')';g.fillRect(0,0,w,h);g.restore();
    }
  }

  const NEW=[
    {id:'swirl',name:'Pusaran Blur',desc:'Gambar berputar dan tersedot kabur, memutih-hitam sesaat, lalu kembali normal',len:0.75,
      params:[['amt','Kekuatan pusaran',0,100,85],['rot','Putaran (derajat)',0,180,50],['zm','Zoom (%)',0,60,20],['gry','Hitam putih (%)',0,100,85]],apply:swirl},
    {id:'zblur',name:'Zoom Blur',desc:'Gambar tersedot masuk dengan kabur radial, lalu tajam lagi',len:0.5,
      params:[['amt','Kekuatan',0,100,75],['zm','Zoom (%)',0,80,35]],apply:zblur},
    {id:'kabur',name:'Kabur Halus',desc:'Gambar mengabur lalu tajam lagi (atau mengabur terus sampai akhir), bisa dengan kabut terang',len:0.5,
      params:[['amt','Kekuatan kabur',0,100,50],['mst','Kabut terang (%)',0,100,0],['rmp','Mode (0 = naik lalu turun, 100 = naik terus sampai akhir)',0,100,0]],apply:kabur}
  ];
  for(const d of NEW)if(!F.DEF[d.id]){F.LIST.push(d);F.DEF[d.id]=d}

  /* ===== clip efek untuk preset "kamu yang kasi tinggal 3 foto" =====
     [track, mulai, lama, jenis, parameter]. Track A = paling atas, B = di bawahnya (untuk Kabur yang bertumpuk dengan Gelombang). Waktu dalam detik. */
  const PLAN=[
    ['A',0.55,0.50,'glitch',{amt:70,spd:60}],
    ['A',6.95,0.35,'glitch',{amt:50,spd:55}],
    ['A',8.25,0.75,'swirl',{amt:85,rot:50,zm:20,gry:85}],
    ['A',9.85,0.25,'glitch',{amt:50,spd:55}],
    ['A',10.35,0.50,'zblur',{amt:75,zm:35}],
    ['A',11.05,0.23,'glitch',{amt:85,spd:70}],
    ['A',11.28,0.24,'wave',{amt:80,cnt:2,spd:60,ang:60,atk:0,dec:40}],
    ['A',11.72,0.26,'wave2',{amt:90,cnt:2,spd:60,ang:60,atk:0,dec:40}],
    ['A',12.02,0.26,'wave',{amt:70,cnt:2,spd:60,ang:30,atk:0,dec:40}],
    ['A',12.65,0.30,'glitch',{amt:45,spd:50}],
    ['A',13.85,0.25,'glitch',{amt:50,spd:55}],
    ['A',15.86,0.22,'glitch',{amt:90,spd:70}],
    ['A',16.15,1.15,'kabur',{amt:80,mst:70,rmp:100}],
    ['B',11.28,0.24,'kabur',{amt:25,mst:0,rmp:0}],
    ['B',11.72,0.26,'kabur',{amt:40,mst:0,rmp:0}],
    ['B',12.02,0.26,'kabur',{amt:25,mst:0,rmp:0}]
  ];
  const TR={A:{id:'t_fkA',kind:'video',name:'Efek Referensi 1',muted:false,hidden:false,locked:false},
            B:{id:'t_fkB',kind:'video',name:'Efek Referensi 2',muted:false,hidden:false,locked:false}};
  const isKamu=o=>{
    if(!o||!Array.isArray(o.items)||!Array.isArray(o.tracks))return false;
    if(/kamu.*kasi/i.test(String(o.name||'')))return true;
    return Array.isArray(o.media)&&o.media.some(m=>m&&/^lagu\.mp3$/i.test(String(m.name||'')));   /* cadangan: hanya preset ini yang membawa lagu.mp3 bawaan */
  };
  function inject(o){
    if(!isKamu(o)||o._fxk||o.items.some(i=>i&&i.c&&i.c.fx))return;
    o._fxk=true;
    for(const i of o.items)if(i&&i.c&&typeof i.c==='object')i.c.smooth=true;   /* gerak lebih mengalir (lihat js/keyframes.js) */
    o.tracks.unshift(Object.assign({},TR.A),Object.assign({},TR.B));
    PLAN.forEach((q,n)=>{
      o.items.push({kind:'video',tid:TR[q[0]].id,c:{id:'c_fk'+n,mediaId:null,start:q[1],in:0,dur:q[2],
        props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},fx:{type:q[3],p:Object.assign({},q[4])}}});
    });
  }
  const P=APK.presets;
  if(P&&typeof P.readFile==='function'&&!P._fxk){
    const orig=P.readFile;
    P.readFile=async function(){
      const o=await orig.apply(this,arguments);
      try{inject(o)}catch(e){console.error('Efek preset gagal dipasang',e)}
      return o;
    };
    P._fxk=true;
  }
})();
