/* Efek clip tambahan bergaya glitch (keluarga Glitch RGB, tapi masing-masing punya ciri sendiri):
   - Blok Glitch    : potongan blok persegi acak pindah tempat (seperti video rusak/datamosh), sebagian diberi warna cyan, magenta, atau kuning
   - Mosaik Glitch  : beberapa area acak mendadak jadi kotak-kotak piksel besar
   - VHS Retro      : pita tracking bergulir yang membengkokkan gambar, warna merah dan cyan bergeser, garis scan, bintik putih
   - Statik TV      : bintik statis (noise), kedip terang gelap, dan layar yang sesekali menggulung ke atas atau bawah
   - Pisah RGB Radial : kanal merah, hijau, biru melebar dari tengah (chromatic aberration), bisa berdenyut
   Semua efek memakai pola yang sama dengan Glitch RGB: acak yang STABIL per potongan waktu (1/12 atau 1/24 detik, dikali Kecepatan), jadi preview, scrub, dan export
   menghasilkan gambar yang sama persis. "Seberapa sering muncul" mengatur berapa persen potongan waktu yang kena glitch, sisanya gambar bersih.
   Dimuat setelah fxirisan.js dan sebelum fxlib.js (daftar efek membaca APK.fxclip.LIST saat dibuka). */
window.APK=window.APK||{};
(function(){
  if(!APK.fxclip||!APK.fxclip.LIST||!APK.fxclip.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
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
  /* satu kanal warna dari kanvas src (warna lain dibuang, transparansi asli tetap) */
  function chan(src,w,h,color,name){
    const T=ac(name,w,h);
    T.drawImage(src,0,0);
    T.globalCompositeOperation='multiply';T.fillStyle=color;T.fillRect(0,0,w,h);
    T.globalCompositeOperation='destination-in';T.drawImage(src,0,0);
    T.globalCompositeOperation='source-over';
    return T.canvas;
  }
  /* acak stabil per potongan waktu: rate = potongan per detik pada Kecepatan 50 */
  function slotRnd(tm,spd,rate,seed){
    const k=Math.max(0.2,spd/50),slot=Math.floor(tm*k*rate);
    return rng(slot*7919+seed);
  }

  /* ===== Blok Glitch ===== */
  function blok(g,w,h,p,tm){
    if(p.amt<=0)return;
    const rnd=slotRnd(tm,p.spd,12,211);
    if(rnd()*100>=p.frq)return;
    const S=ac('gb_s',w,h);S.drawImage(g.canvas,0,0);
    const n=2+Math.round(p.amt/100*26),sz=p.sz/100,tints=['#00ffff','#ff00ff','#ffff00'];
    for(let i=0;i<n;i++){
      const bw=Math.min(w-1,Math.max(4,Math.round(w*(0.03+rnd()*0.25*sz)))),bh=Math.min(h-1,Math.max(3,Math.round(h*(0.01+rnd()*0.12*sz))));
      const sx=Math.floor(rnd()*(w-bw)),sy=Math.floor(rnd()*(h-bh));
      const dx=Math.round(clamp(sx+(rnd()-0.5)*w*0.5,0,w-bw)),dy=Math.round(clamp(sy+(rnd()-0.5)*h*0.08,0,h-bh));
      const tint=rnd()*100<p.tint,tc=tints[Math.floor(rnd()*3)],ta=0.3+rnd()*0.3;
      g.drawImage(S.canvas,sx,sy,bw,bh,dx,dy,bw,bh);
      if(tint){g.save();g.globalCompositeOperation='source-atop';g.globalAlpha=ta;g.fillStyle=tc;g.fillRect(dx,dy,bw,bh);g.restore()}
    }
  }

  /* ===== Mosaik Glitch ===== */
  function mosaik(g,w,h,p,tm){
    if(p.amt<=0)return;
    const rnd=slotRnd(tm,p.spd,10,313);
    if(rnd()*100>=p.frq)return;
    const S=ac('gm_s',w,h);S.drawImage(g.canvas,0,0);
    const n=1+Math.round(p.amt/100*5);
    for(let i=0;i<n;i++){
      const bw=Math.min(w-1,Math.round(w*(0.15+rnd()*0.45))),bh=Math.min(h-1,Math.round(h*(0.08+rnd()*0.35)));
      const x=Math.floor(rnd()*(w-bw)),y=Math.floor(rnd()*(h-bh));
      const ps=Math.max(2,Math.round(Math.min(w,h)*p.px/1000*(0.6+rnd()*0.8)));
      const sw=Math.max(1,Math.round(bw/ps)),sh=Math.max(1,Math.round(bh/ps));
      const T=ac('gm_t',sw,sh);
      T.drawImage(S.canvas,x,y,bw,bh,0,0,sw,sh);
      g.save();g.imageSmoothingEnabled=false;g.drawImage(T.canvas,0,0,sw,sh,x,y,bw,bh);g.restore();
    }
  }

  /* ===== VHS Retro ===== */
  function vhs(g,w,h,p,tm,opaque){
    const a=p.amt/100;if(a<=0)return;
    const k=Math.max(0.2,p.spd/50),rnd=rng(Math.floor(tm*k*24)*104729+7);
    const S=ac('gv_s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    const st=Math.max(2,Math.round(h/200)),yb=((tm*k*0.22)%1.3-0.15)*h,bandH=h*0.14;
    for(let y=0;y<h;y+=st){
      const hh=Math.min(st,h-y),cy=y+hh/2,d=(cy-yb)/bandH;
      let dx=Math.sin(cy/h*40+tm*k*6)*a*w*0.0025;           /* goyang halus di seluruh layar */
      if(d>-1&&d<1){const f=1-Math.abs(d);dx+=Math.sin(cy*0.35+tm*k*30)*f*f*a*w*0.05+(rnd()-0.5)*f*a*w*0.04}   /* pita tracking: gambar bengkok */
      g.drawImage(S.canvas,0,y,w,hh,dx,y,w,hh);
    }
    if(p.clr>0){
      const W=ac('gv_w',w,h);W.drawImage(g.canvas,0,0);
      const sh=Math.max(1,Math.round(w*0.005*(p.clr/50)*(0.5+a)));
      g.save();g.globalCompositeOperation='lighter';g.globalAlpha=0.35;
      g.drawImage(chan(W.canvas,w,h,'#ff0000','gv_r'),sh,0);
      g.drawImage(chan(W.canvas,w,h,'#00ffff','gv_c'),-sh,0);
      g.restore();
    }
    g.save();g.globalCompositeOperation='source-atop';
    const ls=Math.max(2,Math.round(h/180));
    g.fillStyle='rgba(0,0,0,'+(0.22*a).toFixed(3)+')';
    for(let y=0;y<h;y+=ls)g.fillRect(0,y,w,Math.max(1,ls/2));   /* garis scan */
    g.fillStyle='rgba(255,255,255,0.6)';
    const dots=Math.round(a*120),lh=Math.max(1,h/270);
    for(let i=0;i<dots;i++){
      const y=yb+(rnd()-0.5)*bandH*2,x=rnd()*w,len=w*(0.01+rnd()*0.08);
      if(y>=0&&y<h)g.fillRect(x,y,len,lh);   /* bintik putih di pita tracking */
    }
    g.restore();
  }

  /* ===== Statik TV ===== */
  function statik(g,w,h,p,tm){
    const a=p.amt/100,rnd=slotRnd(tm,p.spd,24,19);
    if(a<=0||rnd()*100>=p.frq)return;
    if(p.roll>0&&rnd()<p.roll/100*0.5){
      const S=ac('gs_s',w,h);S.drawImage(g.canvas,0,0);
      const off=Math.round((rnd()-0.5)*0.3*h);
      g.clearRect(0,0,w,h);
      g.drawImage(S.canvas,0,off);
      g.drawImage(S.canvas,0,off>0?off-h:off+h);   /* menggulung, tanpa celah */
    }
    if(rnd()<0.45){
      g.save();g.globalCompositeOperation='source-atop';
      g.fillStyle='rgba(0,0,0,'+(rnd()*0.4*a).toFixed(3)+')';g.fillRect(0,0,w,h);   /* kedip gelap */
      g.restore();
    }
    const nw=Math.max(32,w>>2),nh=Math.max(18,h>>2),N=ac('gs_n',nw,nh),im=N.createImageData(nw,nh),d=im.data;
    for(let i=0;i<d.length;i+=4){const v=(rnd()*255)|0;d[i]=v;d[i+1]=v;d[i+2]=v;d[i+3]=255}
    N.putImageData(im,0,0);
    g.save();g.globalCompositeOperation='overlay';g.globalAlpha=Math.min(1,0.25+0.6*a);g.imageSmoothingEnabled=false;
    g.drawImage(N.canvas,0,0,w,h);
    g.restore();
  }

  /* ===== Pisah RGB Radial ===== */
  function radial(g,w,h,p,tm,opaque){
    let a=p.amt/100*0.04;
    const k=Math.max(0.2,p.spd/50);
    if(p.pls>0){const e=0.5+0.5*Math.sin(tm*k*6);a*=(1-p.pls/100)+p.pls/100*e}
    if(a<0.0005)return;
    const S=ac('gr_s',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.globalCompositeOperation='lighter';
    /* ketiga kanal sedikit diperbesar (biru paling kecil) supaya tepi frame tidak bolong */
    for(const ch of [['#ff0000',1+2*a],['#00ff00',1+a],['#0000ff',1]]){
      const c=chan(S.canvas,w,h,ch[0],'gr_t');
      g.save();g.translate(w/2,h/2);g.scale(ch[1],ch[1]);g.translate(-w/2,-h/2);g.drawImage(c,0,0);g.restore();
    }
    g.globalCompositeOperation='source-over';
  }

  const FRQ=['frq','Seberapa sering muncul (%)',0,100,70],SPD=['spd','Kecepatan',10,100,50];
  const ENTRIES=[
    {id:'blokgl',name:'Blok Glitch',desc:'Potongan blok acak pindah tempat dan sebagian berwarna, seperti video rusak',len:3,
      params:[['amt','Jumlah blok',0,100,50],['sz','Ukuran blok',0,100,40],['tint','Blok berwarna (%)',0,100,30],FRQ,SPD],apply:blok},
    {id:'mosaikgl',name:'Mosaik Glitch',desc:'Beberapa area acak mendadak jadi kotak-kotak piksel besar',len:3,
      params:[['amt','Jumlah area',0,100,50],['px','Besar piksel',5,100,30],FRQ,SPD],apply:mosaik},
    {id:'vhs',name:'VHS Retro',desc:'Pita tracking bergulir, warna bergeser, garis scan dan bintik, ala kaset lama',len:4,
      params:[['amt','Kekuatan',0,100,60],['clr','Pisah warna merah dan cyan',0,100,50],SPD],apply:vhs},
    {id:'statik',name:'Statik TV',desc:'Bintik statis, kedip gelap, dan layar yang sesekali menggulung',len:3,
      params:[['amt','Kekuatan bintik dan kedip',0,100,60],['roll','Layar gulung (%)',0,100,30],['frq','Seberapa sering muncul (%)',0,100,80],SPD],apply:statik},
    {id:'rgbradial',name:'Pisah RGB Radial',desc:'Warna merah, hijau, biru melebar dari tengah, bisa berdenyut',len:2,
      params:[['amt','Kekuatan',0,100,50],['pls','Denyut (0 = tetap, 100 = berdenyut penuh)',0,100,60],SPD],apply:radial}
  ];
  ENTRIES.forEach(function(e){APK.fxclip.LIST.push(e);APK.fxclip.DEF[e.id]=e});
})();
