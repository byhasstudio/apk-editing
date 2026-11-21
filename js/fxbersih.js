/* Efek clip bersih (tanpa glitch): Zoom Denyut, Ayun Lembut, Melayang Halus, Cahaya Lembut, Tilt Fokus, Vignet Sinema, Kilau Sapu.
   Semua efek memakai gerak yang mulus (kurva sinus dan smoothstep), tanpa pecah warna RGB, tanpa potongan strip acak, tanpa bayangan ganda.
   Aturan supaya tidak ada frame hitam atau bolong:
   – Efek yang menggeser, memutar, atau memperbesar gambar selalu menambah zoom secukupnya (coverScale) sehingga tepi frame tetap terisi gambar asli.
   – Kekuatan efek naik pelan di awal clip dan turun pelan di akhir clip (edge), jadi tidak ada lonjakan saat efek mulai atau berhenti.
   – Blur dibuat dengan mengecilkan lalu membesarkan gambar bertahap (tidak memakai ctx.filter), jadi sama di semua browser dan ringan.
   – Efek yang menambah cahaya atau gelap hanya menyentuh piksel yang sudah ada (tidak mengisi area transparan).
   Dimuat setelah js/fxclip.js dan sebelum js/fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;
  if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
  const TAU=Math.PI*2;

  /* ===== kanvas bantu (dipakai bergantian, ukuran tetap antar frame supaya tidak dialokasi ulang) ===== */
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

  /* kekuatan 0..1: naik pelan di awal clip efek, turun pelan di akhir (tanpa lonjakan) */
  function edge(rel,dur){
    if(!(dur>0))return 1;
    const L=Math.min(0.35,dur*0.25);
    return ss(rel/L)*ss((dur-rel)/L);
  }

  /* skala minimum supaya gambar yang diperbesar z, diputar r (radian), dan digeser (dx,dy) tetap menutup seluruh layar (tidak ada tepi kosong) */
  function coverScale(w,h,z,r,dx,dy){
    const ar=Math.max(w/h,h/w),c=Math.cos(Math.abs(r)),s=Math.sin(Math.abs(r));
    const rc=c+s*ar;                                        /* syarat menutup layar untuk gambar yang diputar */
    const tx=Math.abs(dx)*c+Math.abs(dy)*s,ty=Math.abs(dx)*s+Math.abs(dy)*c;   /* geseran dalam sumbu gambar yang diputar */
    const tr=2*Math.max(tx/w,ty/h);
    return Math.max(1,z)+(rc-1)+tr+0.002;
  }

  /* gambar src ke g dengan zoom s, putar r, geser (dx,dy) dari tengah */
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

  /* blur: kecilkan gambar bertahap (separuh tiap langkah) sampai ukuran w/div, lalu besarkan bertahap lagi sampai ukuran penuh */
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

  /* ===== efek 1: Zoom Denyut =====
     Zoom masuk dan kembali berulang mengikuti ketukan (BPM). Zoom tidak pernah di bawah 1, jadi tepi tidak pernah kosong.
     "Bentuk denyut" 0 = naik turun halus seperti napas, 100 = hentak cepat lalu mereda pelan. */
  function zoomdenyut(g,w,h,p,tm,opaque,rel,dur){
    const env=edge(rel,dur);
    const ph=rel*p.bpm/60,f=ph-Math.floor(ph);
    const wave=0.5-0.5*Math.cos(TAU*f);
    const AT=0.06,hit=f<AT?ss(f/AT):Math.exp(-(f-AT)*7);
    const m=p.shp/100,v=(1-m)*wave+m*hit;
    const z=1+p.amt/100*v*env;
    if(z<=1.0005)return;
    const S=ac('zd',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,z,0,0,0,opaque);
  }

  /* ===== efek 2: Ayun Lembut =====
     Gambar berayun pelan seperti bandul (putar tipis dan geser samping), halus dan tanpa patah. Zoom tambahan otomatis menutup tepi. */
  function ayunlembut(g,w,h,p,tm,opaque,rel,dur){
    const env=edge(rel,dur);
    const a=TAU*(0.15+p.spd/100*0.9)*rel;
    const r=Math.sin(a)*p.rot*Math.PI/180*env;
    const dx=Math.sin(a+0.6)*p.mv/100*0.025*w*env;
    const dy=Math.sin(a*2+1.1)*p.mv/100*0.006*h*env;
    const s=coverScale(w,h,1,r,dx,dy);
    const S=ac('ay',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,s,r,dx,dy,opaque);
  }

  /* ===== efek 3: Melayang Halus =====
     Gambar melayang pelan (zoom, geser, putar tipis) sepanjang clip, dan kembali tepat ke posisi semula di awal dan akhir clip,
     jadi sambungan dengan bagian tanpa efek mulus. Panjang clip diperpanjang = gerakan makin lambat. */
  function melayanghalus(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):(rel/6)%1;
    const b=0.5-0.5*Math.cos(TAU*u);
    const sg=p.flp>=1?-1:1,pa=p.pan/100;
    const z=1+p.zm/100*b;
    const dx=sg*(Math.sin(TAU*u)*0.6+Math.sin(2*TAU*u)*0.25)*pa*0.04*w;
    const dy=(Math.sin(2*TAU*u)*0.4+Math.sin(3*TAU*u)*0.15)*pa*0.04*h;
    const r=sg*Math.sin(TAU*u)*p.rot*Math.PI/180;
    const s=coverScale(w,h,z,r,dx,dy);
    const S=ac('ml',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,s,r,dx,dy,opaque);
  }

  /* ===== efek 4: Cahaya Lembut =====
     Cahaya halus di sekitar bagian terang (bloom): salinan gambar yang di-blur lalu ditumpuk dengan mode screen.
     "Fokus ke bagian terang" membuat cahaya hanya keluar dari area terang. "Napas cahaya" membuatnya berdenyut pelan. */
  function cahayalembut(g,w,h,p,tm,opaque,rel,dur){
    const env=edge(rel,dur);
    const br=1+Math.sin(TAU*rel*0.5)*p.br/100*0.35;
    const a=clamp(p.amt/100*env*br*1.2,0,1);
    if(a<0.01)return;
    const S=ac('cs',w,h);S.drawImage(g.canvas,0,0);
    let B=blurFull(S.canvas,w,h,2+p.rad/100*18,'cb');
    if(p.hl>0){
      const H=ac('chl',w,h);
      H.drawImage(B,0,0,w,h);
      H.globalCompositeOperation='multiply';H.globalAlpha=p.hl/100;
      H.drawImage(B,0,0,w,h);
      B=H.canvas;
    }
    g.save();
    g.globalCompositeOperation='screen';g.globalAlpha=a;
    g.drawImage(B,0,0,w,h);
    g.restore();
  }

  /* ===== efek 5: Tilt Fokus =====
     Seperti lensa tilt-shift: pita horizontal tetap tajam, bagian atas dan bawah di-blur lembut. Pita bisa digeser dan bisa bergerak pelan naik turun. */
  function tiltfokus(g,w,h,p,tm,opaque,rel,dur){
    const env=edge(rel,dur);
    if(env<0.01||p.blur<1)return;
    const cy=h*(p.pos/100+Math.sin(TAU*rel*0.2)*p.mv/100*0.12);
    const band=h*p.band/100,fe=Math.max(h*0.06,band*0.8);
    const S=ac('ts',w,h);S.drawImage(g.canvas,0,0);
    const B=blurFull(S.canvas,w,h,2+p.blur/100*14,'tb');
    const M=ac('tm',w,h);M.drawImage(S.canvas,0,0);
    const grd=M.createLinearGradient(0,0,0,h),st=y=>clamp(y/h,0,1);
    const y0=cy-band/2-fe,y1=cy-band/2,y2=cy+band/2,y3=cy+band/2+fe,N=8;
    for(let i=0;i<=N;i++)grd.addColorStop(st(y0+(y1-y0)*i/N),'rgba(0,0,0,'+ss(i/N).toFixed(3)+')');
    for(let i=0;i<=N;i++)grd.addColorStop(st(y2+(y3-y2)*i/N),'rgba(0,0,0,'+(1-ss(i/N)).toFixed(3)+')');
    M.globalCompositeOperation='destination-in';M.fillStyle=grd;M.fillRect(0,0,w,h);
    g.save();g.globalAlpha=env;g.drawImage(B,0,0,w,h);g.restore();   /* bagian blur menimpa gambar asli sebesar kekuatan efek */
    g.drawImage(M.canvas,0,0);                                       /* pita tajam di atasnya */
  }

  /* ===== efek 6: Vignet Sinema =====
     Tepi layar menggelap lembut dengan peralihan halus, warna tepi bisa hitam, hangat, atau dingin. Hanya menggelapkan piksel yang sudah ada. */
  function vignetsinema(g,w,h,p,tm,opaque,rel,dur){
    const env=edge(rel,dur);
    const br=1+Math.sin(TAU*rel*0.4)*p.br/100*0.2;
    const a=clamp(p.str/100*0.9*env*br,0,0.95);
    if(a<0.01)return;
    const inner=Math.min(w,h)*(0.15+p.sz/100*0.45),outer=Math.hypot(w,h)/2*1.02;
    const mix=(x,y,k)=>x.map((v,i)=>Math.round(v+(y[i]-v)*k));
    const t=p.tn,col=t<=50?mix([0,0,0],[38,16,4],t/50):mix([38,16,4],[4,14,46],(t-50)/50);
    const c=x=>'rgba('+col[0]+','+col[1]+','+col[2]+','+x.toFixed(3)+')';
    const grd=g.createRadialGradient(w/2,h/2,inner,w/2,h/2,outer);
    grd.addColorStop(0,c(0));grd.addColorStop(0.5,c(a*0.2));grd.addColorStop(0.8,c(a*0.6));grd.addColorStop(1,c(a));
    g.save();
    g.globalCompositeOperation='source-atop';
    g.fillStyle=grd;g.fillRect(0,0,w,h);
    g.restore();
  }

  /* ===== efek 7: Kilau Sapu =====
     Pita cahaya lembut menyapu layar (seperti kilap pada kaca atau logam). Mulai dan berakhir di luar layar, jadi tidak ada lonjakan.
     Jumlah sapuan dibagi rata sepanjang clip. Cahaya hanya jatuh di piksel yang sudah ada. */
  function kilausapu(g,w,h,p,tm,opaque,rel,dur){
    const n=Math.max(1,Math.round(p.cnt)),total=dur>0?dur:1.8,seg=total/n;
    const idx=Math.min(n-1,Math.max(0,Math.floor(rel/seg)));
    const u=clamp((rel-idx*seg)/seg,0,1),e=0.5-0.5*Math.cos(Math.PI*u);
    const th=p.ang*Math.PI/180,dx=Math.cos(th),dy=Math.sin(th);
    const Ev=Math.abs(w*dx)+Math.abs(h*dy),bw=Ev*p.wd/100,hw=(bw/Ev);
    const tc=(-bw+(Ev+2*bw)*e)/Ev;                         /* pusat pita di sumbu 0..1 (bisa di luar layar) */
    const a=p.amt/100*0.9;
    const L=ac('kl',w,h);
    const grd=L.createLinearGradient(w/2-dx*Ev/2,h/2-dy*Ev/2,w/2+dx*Ev/2,h/2+dy*Ev/2);
    const N=16;
    for(let i=0;i<=N;i++){
      const t=clamp(tc-hw+2*hw*i/N,0,1),x=clamp((t-tc)/hw,-1,1),al=a*(0.5+0.5*Math.cos(Math.PI*x));
      grd.addColorStop(t,'rgba(255,255,255,'+al.toFixed(3)+')');
    }
    L.fillStyle=grd;L.fillRect(0,0,w,h);
    L.globalCompositeOperation='destination-in';L.drawImage(g.canvas,0,0);   /* batasi ke piksel yang sudah ada */
    g.save();g.globalCompositeOperation='screen';g.drawImage(L.canvas,0,0);g.restore();
  }

  /* ===== definisi efek ===== */
  const LIST=[
    {id:'zoomdenyut',name:'Zoom Denyut',desc:'Zoom masuk-keluar mengikuti ketukan, halus dan tepi tetap penuh',len:3,
      params:[['amt','Kekuatan zoom (%)',0,30,8],['bpm','Ketukan per menit',30,240,120],['shp','Bentuk denyut (0 = naik turun halus, 100 = hentak lalu mereda)',0,100,35]],apply:zoomdenyut},
    {id:'ayunlembut',name:'Ayun Lembut',desc:'Gambar berayun pelan seperti bandul, tanpa patah',len:4,
      params:[['rot','Sudut ayun (derajat)',0,15,3],['spd','Kecepatan',10,100,40],['mv','Geser samping',0,100,35]],apply:ayunlembut},
    {id:'melayanghalus',name:'Melayang Halus',desc:'Gambar melayang pelan (zoom, geser, putar tipis) lalu kembali ke posisi awal',len:4,
      params:[['zm','Zoom melayang (%)',0,40,10],['pan','Geser melayang',0,100,40],['rot','Putar halus (derajat)',0,6,1],['flp','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:melayanghalus},
    {id:'cahayalembut',name:'Cahaya Lembut',desc:'Cahaya halus (bloom) keluar dari bagian terang gambar',len:3,
      params:[['amt','Kekuatan cahaya',0,100,50],['rad','Lebar cahaya',0,100,40],['hl','Fokus ke bagian terang',0,100,60],['br','Napas cahaya (0 = tetap)',0,100,30]],apply:cahayalembut},
    {id:'tiltfokus',name:'Tilt Fokus',desc:'Pita tengah tajam, atas dan bawah blur lembut seperti lensa miniatur',len:4,
      params:[['pos','Posisi area tajam (% tinggi layar)',0,100,50],['band','Lebar area tajam (%)',5,70,28],['blur','Kekuatan blur',0,100,60],['mv','Gerak naik turun area tajam (0 = diam)',0,100,0]],apply:tiltfokus},
    {id:'vignetsinema',name:'Vignet Sinema',desc:'Tepi layar menggelap lembut ala film, warna tepi bisa diatur',len:4,
      params:[['str','Kegelapan tepi',0,100,55],['sz','Luas area terang',0,100,50],['tn','Warna tepi (0 = hitam, 50 = hangat, 100 = dingin)',0,100,0],['br','Napas vignet (0 = tetap)',0,100,0]],apply:vignetsinema},
    {id:'kilausapu',name:'Kilau Sapu',desc:'Pita cahaya lembut menyapu layar seperti kilap kaca',len:1.6,
      params:[['wd','Lebar kilau (%)',5,60,22],['ang','Sudut (derajat, 0 = pita tegak, bergerak kiri ke kanan)',-60,60,20],['amt','Kecerahan',0,100,55],['cnt','Jumlah sapuan',1,4,1]],apply:kilausapu}
  ];
  for(const e of LIST){if(F.DEF[e.id])continue;F.LIST.push(e);F.DEF[e.id]=e}
})();
