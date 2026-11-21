/* Efek Transisi (kategori kedua di daftar efek): efek clip yang menutupi SAMBUNGAN antara dua clip, tanpa glitch.
   Cara pakai: taruh playhead di sambungan dua clip, ketuk efeknya. Clip transisi diletakkan tepat di TENGAH playhead
   (setengah sebelum, setengah sesudah sambungan). Kekuatan efek naik halus ke puncak di tengah clip (di situ clip berganti, jadi sambungannya tertutup),
   lalu turun halus ke nol di akhir clip, jadi tidak ada lonjakan di awal maupun akhir.
   Aturan yang sama dengan js/fxbersih.js: tepi tidak pernah kosong (zoom otomatis menutup), blur lewat kecilkan-besarkan gambar (tanpa ctx.filter),
   cahaya dan gelap hanya menyentuh piksel yang sudah ada.
   Efek ditandai cat:'transisi' supaya muncul di tab "Efek Transisi" (js/fxlib.js); efek tanpa cat masuk tab "Efek Media".
   Dimuat setelah js/fxclip.js dan sebelum js/fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;
  if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const TAU=Math.PI*2;

  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.imageSmoothingEnabled=true;
    if('imageSmoothingQuality' in g)g.imageSmoothingQuality='high';
    g.clearRect(0,0,w,h);
    return g;
  }
  function blurFull(src,w,h,div,tag){
    const tw=Math.max(4,Math.round(w/div)),th=Math.max(4,Math.round(h/div));
    let cur=src,cw=w,ch=h,i=0;
    while(cw>tw){
      cw=Math.max(tw,Math.ceil(cw/2));ch=Math.max(th,Math.ceil(ch/2));
      const t=ac(tag+'d'+i,cw,ch);
      t.drawImage(cur,0,0,cw,ch);
      cur=t.canvas;i++;
    }
    if(cur===src)return src;
    cw=cur.width;i=0;
    while(cw<w){
      cw=Math.min(w,cw*2);
      const c2=cw>=w?h:Math.max(1,Math.round(h*cw/w));
      const t=ac(tag+'u'+i,cw,c2);
      t.drawImage(cur,0,0,cw,c2);
      cur=t.canvas;i++;
    }
    return cur;
  }
  /* kekuatan transisi 0..1: nol di awal dan akhir clip, puncak (dengan dataran pendek) di tengah clip, tempat clip berganti */
  function bell(rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):((rel/1.8)%1);
    return ss(Math.min(1,(1-Math.abs(2*u-1))*1.35));
  }
  const fastMode=()=>!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);
  /* skala minimum supaya gambar yang diperbesar z dan diputar r (radian, boleh besar) tetap menutup layar */
  function coverScale(w,h,z,r){
    let a=Math.abs(r)%Math.PI;if(a>Math.PI/2)a=Math.PI-a;
    const ar=Math.max(w/h,h/w);
    return Math.max(1,z)+(Math.cos(a)+Math.sin(a)*ar-1)+0.002;
  }
  function put(g,src,w,h,s,r,dx,dy,opaque){
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.save();
    g.translate(w/2+dx,h/2+dy);
    if(r)g.rotate(r);
    g.scale(s,s);
    g.translate(-w/2,-h/2);
    g.drawImage(src,0,0);
    g.restore();
  }
  const gray=k=>{const c=Math.round(255*(1-clamp(k,0,100)/100));return c+','+c+','+c};

  /* ===== 1. Zoom Kabur: zoom masuk dengan blur radial (rata-rata banyak salinan berukuran berbeda) ===== */
  function zoomkabur(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const n=fastMode()?8:14,zmax=p.str/100*0.35*b,z0=1+p.zm/100*b;
    const S=ac('zk',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    for(let i=0;i<n;i++){
      const s=z0*(1+zmax*(i/(n-1)));
      g.save();
      g.globalAlpha=1/(i+1);                       /* rata-rata berjalan: tiap salinan berbobot sama */
      g.translate(w/2,h/2);g.scale(s,s);g.translate(-w/2,-h/2);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
    const a=clamp(b*p.glw/100*0.5,0,1);
    if(a>0.004){g.save();g.globalCompositeOperation='source-atop';g.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')';g.fillRect(0,0,w,h);g.restore()}
  }

  /* ===== 2. Kilat Warna: layar memutih (atau menghitam) di puncak, dengan zoom tipis ===== */
  function kilat(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    if(p.zm>0){
      const S=ac('kt',w,h);S.drawImage(g.canvas,0,0);
      put(g,S.canvas,w,h,1+p.zm/100*b,0,0,0,opaque);
    }
    const a=clamp(p.amt/100*b,0,1);
    if(a<0.004)return;
    g.save();g.globalCompositeOperation='source-atop';
    g.fillStyle='rgba('+gray(p.wrn)+','+a.toFixed(3)+')';g.fillRect(0,0,w,h);
    g.restore();
  }

  /* ===== 3. Geser Kabur: gambar bergeser cepat dengan blur gerak searah ===== */
  function geserkabur(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const th=p.ang*Math.PI/180,dx=Math.cos(th),dy=-Math.sin(th),sg=p.dir>=1?-1:1;
    const D=p.amt/100*0.30*w*b;
    if(D<0.5)return;
    const n=fastMode()?10:18,maxOff=D*0.85;
    const s=1+2*Math.max(Math.abs(dx)*maxOff/w,Math.abs(dy)*maxOff/h)+0.002;   /* zoom penutup tepi untuk geseran terjauh */
    const S=ac('gk',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    for(let i=0;i<n;i++){
      const off=sg*(b*D*0.35+(i/(n-1)-0.5)*D);
      g.save();
      g.globalAlpha=1/(i+1);
      g.translate(w/2+dx*off,h/2+dy*off);g.scale(s,s);g.translate(-w/2,-h/2);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
  }

  /* ===== 4. Putar Zoom: gambar berputar dan membesar ke puncak, dengan blur lembut ===== */
  function putarzoom(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,r=sg*p.rot*Math.PI/180*b,z0=1+p.zm/100*b;
    const S=ac('pz',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,coverScale(w,h,z0,r),r,0,0,opaque);
    const a=clamp(b*p.blr/100,0,1);
    if(a>0.01){
      const T=ac('pt',w,h);T.drawImage(g.canvas,0,0);
      const B=blurFull(T.canvas,w,h,2+a*14,'pb');
      g.save();g.globalAlpha=a;g.drawImage(B,0,0,w,h);g.restore();
    }
  }

  /* ===== 5. Kabur Lembut: seluruh gambar mengabur lembut ke puncak lalu jernih lagi ===== */
  function kaburlembut(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    if(p.zm>0){
      const S=ac('kz',w,h);S.drawImage(g.canvas,0,0);
      put(g,S.canvas,w,h,1+p.zm/100*b,0,0,0,opaque);
    }
    const T=ac('kb0',w,h);T.drawImage(g.canvas,0,0);
    const B=blurFull(T.canvas,w,h,2+p.blr/100*20,'kb');
    g.save();g.globalAlpha=clamp(b,0,1);g.drawImage(B,0,0,w,h);g.restore();
    const a=clamp(b*p.lft/100*0.5,0,1);
    if(a>0.004){g.save();g.globalCompositeOperation='source-atop';g.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')';g.fillRect(0,0,w,h);g.restore()}
  }

  /* ===== 6. Tirai Sinema: dua tirai menutup dari tepi dan bertemu di puncak, lalu membuka lagi ===== */
  function tirai(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const horiz=p.sty<1,L=(horiz?h:w)/2*b,fe=Math.min(w,h)*0.12*p.sf/100+1,col=gray(p.wrn);
    if(L<0.5)return;
    g.save();g.globalCompositeOperation='source-atop';
    for(let k=0;k<2;k++){
      const T=L+fe;
      let grd,rx,ry,rw,rh;
      if(horiz){
        const y0=k?h:0,y1=k?h-T:T;
        grd=g.createLinearGradient(0,y0,0,y1);rx=0;rw=w;ry=Math.min(y0,y1);rh=T;
      }else{
        const x0=k?w:0,x1=k?w-T:T;
        grd=g.createLinearGradient(x0,0,x1,0);ry=0;rh=h;rx=Math.min(x0,x1);rw=T;
      }
      grd.addColorStop(0,'rgba('+col+',1)');
      grd.addColorStop(L/T,'rgba('+col+',1)');
      grd.addColorStop(1,'rgba('+col+',0)');
      g.fillStyle=grd;g.fillRect(rx,ry,rw,rh);
    }
    g.restore();
  }

  /* ===== definisi efek transisi ===== */
  const LIST=[
    {id:'trzoomkabur',cat:'transisi',name:'Zoom Kabur',desc:'Transisi zoom masuk dengan blur radial, sambungan tertutup di puncak',len:0.8,
      params:[['zm','Zoom dasar (%)',0,60,12],['str','Kekuatan blur radial',0,100,60],['glw','Cahaya di puncak',0,100,25]],apply:zoomkabur},
    {id:'trkilat',cat:'transisi',name:'Kilat Warna',desc:'Layar memutih (atau menghitam) sesaat di sambungan, dengan zoom tipis',len:0.7,
      params:[['amt','Kekuatan (100 = layar penuh)',0,100,100],['wrn','Warna (0 = putih, 100 = hitam)',0,100,0],['zm','Zoom tipis (%)',0,20,4]],apply:kilat},
    {id:'trgeserkabur',cat:'transisi',name:'Geser Kabur',desc:'Gambar bergeser cepat dengan blur gerak, arah bisa diatur',len:0.7,
      params:[['amt','Panjang gerak',0,100,70],['ang','Arah (0 = kanan-kiri, 90 = naik-turun, minus = dibalik)',-90,90,0],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:geserkabur},
    {id:'trputarzoom',cat:'transisi',name:'Putar Zoom',desc:'Gambar berputar dan membesar ke puncak, lalu kembali, blur lembut',len:0.9,
      params:[['rot','Sudut putar (derajat)',0,180,25],['zm','Zoom dasar (%)',0,60,15],['blr','Blur lembut',0,100,40],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:putarzoom},
    {id:'trkaburlembut',cat:'transisi',name:'Kabur Lembut',desc:'Seluruh gambar mengabur lembut di sambungan lalu jernih lagi',len:0.9,
      params:[['blr','Kekuatan blur',0,100,70],['zm','Zoom tipis (%)',0,20,5],['lft','Terang di puncak',0,100,15]],apply:kaburlembut},
    {id:'trtirai',cat:'transisi',name:'Tirai Sinema',desc:'Dua tirai menutup dari tepi, bertemu di sambungan, lalu membuka',len:1.0,
      params:[['sty','Arah (0 = atas-bawah, 1 = kiri-kanan)',0,1,0],['wrn','Warna (0 = putih, 100 = hitam)',0,100,100],['sf','Kelembutan tepi tirai',0,100,30]],apply:tirai}
  ];
  for(const e of LIST){if(F.DEF[e.id])continue;F.LIST.push(e);F.DEF[e.id]=e}
})();
