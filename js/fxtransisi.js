/* Efek Transisi (kategori kedua di daftar efek): efek clip yang menutupi SAMBUNGAN antara dua clip, tanpa glitch.
   Cara pakai: taruh playhead di sambungan dua clip, ketuk efeknya. Clip transisi diletakkan tepat di TENGAH playhead
   (setengah sebelum, setengah sesudah sambungan). Kekuatan efek naik halus ke puncak di tengah clip (di situ clip berganti, jadi sambungannya tertutup),
   lalu turun halus ke nol di akhir clip, jadi tidak ada lonjakan di awal maupun akhir.
   Aturan yang sama dengan js/fxbersih.js: tepi tidak pernah kosong (zoom otomatis menutup), blur lewat kecilkan-besarkan gambar (tanpa ctx.filter),
   cahaya dan gelap hanya menyentuh piksel yang sudah ada.
   Efek ditandai cat:'transisi' supaya muncul di tab "Efek Transisi" (js/fxlib.js); efek tanpa cat masuk tab "Efek Media".
   Dimuat setelah js/fxclip.js dan sebelum js/fxlib.js.
   Di akhir file ada tambahan: Shake Video dibuat MENYAMBUNG (pelan masuk > klimaks > pelan reda) dan dua transisi baru dari video referensi (Kotak Bingkai, Belah Empat). */
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

  /* ===== 8 efek baru: gerak MENERUS satu arah (bukan maju lalu mundur) ===== 
     u = kemajuan 0..1 sepanjang clip. Potongan gambar bergerak dengan easing halus satu arah sampai satu putaran/lebar penuh,
     jadi di akhir posisinya kembali identik dengan awal tanpa pernah berbalik arah. b = kurva lonceng hanya untuk hal simetris (celah, bayangan, zoom). */
  const sm5=x=>{x=clamp(x,0,1);return x*x*x*(x*(6*x-15)+10)};
  const uOf=(rel,dur)=>dur>0?clamp(rel/dur,0,1):((rel/1.8)%1);
  function bell2(rel,dur){const u=uOf(rel,dur);return sm5(Math.min(1,(1-Math.abs(2*u-1))*1.3))}
  const run=(u,dl)=>sm5((u-clamp(dl,0,1)*0.35)/0.65);   /* gerak menerus 0..1, dl = tunda 0..1 supaya tiap potongan tidak serempak */
  function mb(fn){
    return function(g,w,h,p,tm,opaque,rel,dur){
      const n=fastMode()?3:6,sp=(dur>0?dur:1)*0.016;
      const S=ac('mbs',w,h);S.drawImage(g.canvas,0,0);
      const A=ac('mba',w,h);
      for(let i=0;i<n;i++){
        g.clearRect(0,0,w,h);g.drawImage(S.canvas,0,0);
        fn(g,w,h,p,tm,opaque,rel+(i/(n-1)-0.5)*sp,dur);
        A.globalAlpha=1/(i+1);A.drawImage(g.canvas,0,0);
      }
      g.clearRect(0,0,w,h);g.drawImage(A.canvas,0,0);
    };
  }
  /* envelope cepat: naik sangat cepat lalu tahan sebentar di tengah clip, lalu turun cepat (lebih menyentak dari bell) */
  function snap(rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):((rel/1.2)%1);
    const v=clamp((u<0.5?u*2:(1-u)*2)*1.3,0,1);
    return 1-Math.pow(1-v,3);
  }

  const rnd=(i,s)=>{const x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x)};
  const scl=(w,h)=>Math.min(w,h)/368;

  /* ===== 7. Panel Geser: panel-panel melaju menyeberang layar satu arah, bergantian arah per baris, dengan bayangan ===== */
  function panelgeser(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('pg',w,h);S.drawImage(g.canvas,0,0);
    const z=1+p.zm/100*b;
    put(g,S.canvas,w,h,z,0,0,0,true);
    const n=Math.round(p.cnt),gp=Math.max(0,1.5*k*ss(b*4));
    let tot=0;const wt=[];for(let i=0;i<n;i++){const v=0.55+rnd(i,3);wt.push(v);tot+=v}
    let y=0;
    for(let i=0;i<n;i++){
      const rh=h*wt[i]/tot,y0=y;y+=rh;
      const xs=w*(0.25+0.5*rnd(i,11));
      for(let c=0;c<2;c++){
        const x0=c?xs:0,x1=c?w:xs,id=i*2+c;
        const dl=rnd(id,31),o2=(i%2?1:-1)*sg*(c?0.75:1)*w*run(u,dl);
        const oy=(rnd(id,20)-0.4)*h*0.08*b*(p.amt/40);
        const rx=x0+o2,ry=y0+oy+gp,rw=x1-x0,rhh=rh-2*gp;
        if(rx>w||rx+rw<0)continue;
        g.save();
        g.shadowColor='rgba(0,0,0,'+(p.shw/100*0.6*ss(b*3)).toFixed(3)+')';
        g.shadowBlur=9*k*b;g.shadowOffsetX=20000;g.fillStyle='#000';g.fillRect(rx-20000,ry,rw,rhh);g.shadowOffsetX=0;
        g.shadowColor='transparent';g.shadowBlur=0;
        g.beginPath();g.rect(rx,ry,rw,rhh);g.clip();
        g.translate(w/2+o2,h/2+oy);g.scale(z,z);g.translate(-w/2,-h/2);
        g.drawImage(S.canvas,0,0);
        g.restore();
      }
    }
  }

  /* ===== 8. Strip Putih: pita horizontal mengalir satu arah (bergantian per pita) dan kembali selaras di akhir ===== */
  function strip(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('st',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    const n=Math.round(p.cnt),gap=p.gap/100*h*0.045*b;
    let tot=0;const wt=[];for(let i=0;i<n;i++){const v=0.5+rnd(i,5);wt.push(v);tot+=v}
    let y=0;
    for(let i=0;i<n;i++){
      const rh=h*wt[i]/tot,y0=y;y+=rh;
      const ox=(i%2?1:-1)*sg*w*run(u,rnd(i,9)),oy=(rnd(i,13)-0.5)*h*0.03*b*(p.amt/40);
      g.save();
      g.beginPath();g.rect(0,y0+gap/2,w,Math.max(0,rh-gap));g.clip();
      for(let s=-1;s<=1;s++)g.drawImage(S.canvas,ox+s*w,oy);
      g.restore();
      if(i>0){
        g.fillStyle='rgba(0,0,0,'+(0.7*ss(b*6)).toFixed(3)+')';
        g.fillRect(0,y0-0.5*k,w,Math.max(1,k));
      }
    }
  }

  /* ===== 9. Kipas Silang: juring-juring berputar penuh berlawanan arah (menerus), celah hitam melebar lalu menutup ===== */
  function kipas(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('kp',w,h);S.drawImage(g.canvas,0,0);
    const n=Math.max(4,Math.round(p.cnt/2)*2),cx=w/2,cy=h/2,R=Math.hypot(w,h);
    const rot=TAU*Math.round(p.trn)*run(u,0),open=p.opn/100*Math.min(w,h)*0.08*b,z=1+p.zm/100*b+0.1*b;
    g.clearRect(0,0,w,h);g.fillStyle='#000';g.fillRect(0,0,w,h);
    for(let i=0;i<n;i++){
      const a0=i*TAU/n-Math.PI/2,a1=(i+1)*TAU/n-Math.PI/2,mid=(a0+a1)/2;
      g.save();
      g.translate(cx+Math.cos(mid)*open,cy+Math.sin(mid)*open);
      g.beginPath();g.moveTo(0,0);g.arc(0,0,R,a0,a1);g.closePath();
      g.clip();
      g.rotate((i%2?1:-1)*sg*rot);
      const s2=z*(i%2?1:1+0.12*b);
      g.scale(s2,s2);g.translate(-cx,-cy);
      g.drawImage(S.canvas,0,0);
      g.restore();
      g.save();g.translate(cx+Math.cos(mid)*open,cy+Math.sin(mid)*open);
      g.strokeStyle='rgba(0,0,0,'+(0.85*ss(b*5)).toFixed(3)+')';g.lineWidth=Math.max(1,1.5*k);
      g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a0)*R,Math.sin(a0)*R);g.stroke();
      g.restore();
    }
  }

  /* ===== 10. Inversi Gelembung: warna dibalik jadi negatif, lalu tinggal garis tepi terang tipis di latar gelap, dengan cincin gelembung ===== */
  function inversi(g,w,h,p,tm,opaque,rel,dur){
    const b=snap(rel,dur);if(b<0.003)return;
    const k=scl(w,h),S=ac('iv',w,h);S.drawImage(g.canvas,0,0);
    const A=p.amt/100,zz=1+p.zm/100*b;
    /* negatif: gambar dibalik warnanya lalu dibuat abu-abu kebiruan */
    const N=ac('ivn',w,h);
    put(N,S.canvas,w,h,zz,0,0,0,true);
    N.globalCompositeOperation='difference';N.fillStyle='#fff';N.fillRect(0,0,w,h);
    N.globalCompositeOperation='multiply';N.fillStyle='rgb(170,200,215)';N.fillRect(0,0,w,h);
    N.globalCompositeOperation='source-over';
    /* garis tepi */
    const E=ac('ive',w,h);
    put(E,S.canvas,w,h,zz,0,0,0,true);
    const T=ac('ivt',w,h);T.drawImage(E.canvas,0,0);
    const ed=Math.max(1,p.edg*k*0.7);
    E.globalCompositeOperation='difference';E.drawImage(T.canvas,ed,ed);
    E.globalCompositeOperation='lighter';E.drawImage(E.canvas,0,0);E.drawImage(E.canvas,0,0);
    E.globalCompositeOperation='multiply';E.fillStyle='rgb(200,240,255)';E.fillRect(0,0,w,h);
    E.globalCompositeOperation='source-over';
    const aN=clamp(ss(b*2.2)*A,0,1)*(1-ss(b*2-0.9)),aE=clamp(ss(b*1.6-0.2)*A,0,1);
    g.save();
    g.globalAlpha=clamp(ss(b*2)*A,0,1);g.drawImage(N.canvas,0,0);
    g.globalAlpha=clamp(ss(b*1.8-0.5)*A,0,1);g.fillStyle='#000';g.fillRect(0,0,w,h);
    g.globalAlpha=aE;g.drawImage(E.canvas,0,0);
    g.restore();
    const cn=Math.round(p.cnt*(fastMode()?0.6:1)),cx=w/2,cy=h/2,ex=1+0.4*b;
    g.save();
    g.strokeStyle='rgba(235,245,255,'+(0.85*ss(b*2)).toFixed(3)+')';g.lineWidth=Math.max(1,1.2*k);
    for(let i=0;i<cn;i++){
      if(rnd(i,6)>ss(b*1.4)+0.05)continue;
      const x=cx+(rnd(i,1)*w-cx)*ex,y=cy+(rnd(i,2)*h-cy)*ex;
      const r=(3+rnd(i,3)*13)*k*(0.5+b*0.8),ry=r*(0.55+0.3*rnd(i,4)),rt=rnd(i,5)*Math.PI;
      g.beginPath();g.ellipse(x,y,r,ry,rt,0,TAU);g.stroke();
      if(rnd(i,8)>0.55){g.beginPath();g.ellipse(x+r*0.5,y+ry*0.25,r*0.8,ry*0.8,rt,0,TAU);g.stroke()}
    }
    g.restore();
  }

  /* ===== 11. Pusaran: gambar berputar menerus ke satu arah sambil mengecil jadi kincir, lalu mekar dengan putaran yang sama ===== */
  function pusaran(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('ps',w,h);S.drawImage(g.canvas,0,0);
    const cx=w/2,cy=h/2,n=Math.round(p.cnt),sc=Math.max(0.015,1-b*0.985);
    const R=Math.hypot(w,h)/2*sc*1.02,tw=p.tw/100*Math.PI*0.9*b,rot=sg*TAU*Math.round(p.trn)*run(u,0);
    const f=1-0.4*ss(b*1.6),bw=TAU/n*f,N=14;
    g.clearRect(0,0,w,h);g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    for(let i=0;i<n;i++){
      const a0=i*TAU/n,a1=a0+bw;
      g.save();
      g.translate(cx,cy);g.rotate(rot);
      g.beginPath();g.moveTo(0,0);
      for(let t=1;t<=N;t++){const a=a0+tw*t/N,r=R*t/N;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
      for(let t=1;t<=6;t++){const a=a0+tw+(a1-a0)*t/6;g.lineTo(Math.cos(a)*R,Math.sin(a)*R)}
      for(let t=N-1;t>=0;t--){const a=a1+tw*t/N,r=R*t/N;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}
      g.closePath();
      g.save();g.clip();g.scale(sc,sc);g.translate(-cx,-cy);g.drawImage(S.canvas,0,0);g.restore();
      g.strokeStyle='rgba(20,20,20,'+(0.8*ss(b*4)).toFixed(3)+')';g.lineWidth=Math.max(1,1.6*k);g.stroke();
      g.restore();
    }
  }

  /* ===== 12. Pecahan Miring: pita diagonal diam, isinya mengalir satu arah (bergantian per pita) dengan bayangan di tepinya ===== */
  function pecahan(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('pc',w,h);S.drawImage(g.canvas,0,0);
    const cx=w/2,cy=h/2,R=Math.hypot(w,h),th=p.ang*Math.PI/180,n=Math.round(p.cnt);
    put(g,S.canvas,w,h,1+p.zm/100*b,0,0,0,true);
    for(let i=0;i<n;i++){
      const y0=-R/2+R*i/n,y1=-R/2+R*(i+1)/n,sh=(i%2?1:-1)*sg*w*run(u,rnd(i,4)*p.amt/100);
      g.save();g.translate(cx,cy);g.rotate(th);
      g.shadowColor='rgba(0,0,0,'+(0.55*ss(b*3)).toFixed(3)+')';g.shadowBlur=10*k*b;
      g.shadowOffsetX=20000*Math.cos(th);g.shadowOffsetY=20000*Math.sin(th);
      g.translate(-20000,0);g.beginPath();g.rect(-R,y0,2*R,y1-y0);g.fillStyle='#000';g.fill();g.translate(20000,0);
      g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetX=0;g.shadowOffsetY=0;
      g.beginPath();g.rect(-R,y0,2*R,y1-y0);g.clip();
      g.setTransform(1,0,0,1,0,0);
      g.translate(cx,cy);g.scale(1+0.06*b,1+0.06*b);g.translate(-cx,-cy);
      for(let s=-1;s<=1;s++)g.drawImage(S.canvas,sh+s*w,0);
      g.restore();
    }
  }

  /* ===== 13. Belah Garis: celah tipis membelah layar lalu menutup, pita tengah mengalir satu arah dan kembali selaras ===== */
  function belahgaris(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('bg',w,h);S.drawImage(g.canvas,0,0);
    const V=p.ori>=1,L=V?w:h,T=V?h:w,pos=L*p.pos/100,gap=p.gap/100*L*0.18*b,bw=L*0.12*b*(p.amt/60);
    g.clearRect(0,0,w,h);g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    const slide=sg*T*run(u,0);
    const part=(a0,a1,d,sx)=>{
      g.save();g.beginPath();
      if(V)g.rect(a0,0,a1-a0,h);else g.rect(0,a0,w,a1-a0);
      g.clip();
      for(let s=-1;s<=1;s++){if(V)g.drawImage(S.canvas,d,sx+s*h);else g.drawImage(S.canvas,sx+s*w,d)}
      g.restore();
    };
    part(0,Math.max(0,pos-bw/2-gap/2),-gap/2,0);
    part(Math.min(L,pos+bw/2+gap/2),L,gap/2,0);
    if(bw>1)part(pos-bw/2-gap/2,pos+bw/2+gap/2,0,slide);
    g.fillStyle='rgba(0,0,0,'+(0.8*ss(b*5)).toFixed(3)+')';
    const t=Math.max(1,1.3*k),e=[pos-bw/2-gap/2,pos+bw/2+gap/2];
    for(const q of e){if(V)g.fillRect(q-t/2,0,t,h);else g.fillRect(0,q-t/2,w,t)}
  }

  /* ===== 14. Mosaik Kotak: tiap kotak berputar penuh satu arah (bergantian) dengan jeda acak, zoom naik lalu turun ===== */
  function mosaik(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),k=scl(w,h),S=ac('ms',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,1,0,0,0,true);
    const cols=Math.round(p.cnt),rows=Math.max(2,Math.round(cols*h/w)),tw=w/cols,th=h/rows,gp=Math.max(0,1.2*k*ss(b*4));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const id=r*cols+c,x=c*tw,y=r*th,cxx=x+tw/2,cyy=y+th/2;
      const z=1+p.zm/100*b*(0.3+1.4*rnd(id,2)),rt=((r+c)%2?1:-1)*TAU*run(u,rnd(id,3)*p.amt/100);
      g.save();
      g.beginPath();g.rect(x+gp,y+gp,tw-2*gp,th-2*gp);g.clip();
      g.translate(cxx,cyy);g.rotate(rt);g.scale(z,z);g.translate(-cxx,-cyy);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
  }

  /* ===== 15. Kotak Bingkai (dari video referensi): gambar mengecil jadi kotak berbingkai tipis di tengah, latarnya cermin gambar yang diperbesar dan digelapkan,
     lalu kotak membesar lagi sampai penuh. Latar disusun dari ubin cermin (bolak-balik) jadi tepi tidak pernah kosong. ===== */
  function kotak(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const k=scl(w,h),S=ac('kx',w,h);S.drawImage(g.canvas,0,0);
    const si=1-b*(1-p.sz/100),zb=1+p.zm/100*b;
    g.clearRect(0,0,w,h);g.fillStyle='#000';g.fillRect(0,0,w,h);
    for(let a=-1;a<=1;a++)for(let c=-1;c<=1;c++){
      g.save();
      g.translate(w/2+a*w*zb,h/2+c*h*zb);g.scale(a?-zb:zb,c?-zb:zb);g.translate(-w/2,-h/2);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
    const dm=clamp(p.dim/100*b*0.85,0,1);
    if(dm>0.004){g.fillStyle='rgba(0,0,0,'+dm.toFixed(3)+')';g.fillRect(0,0,w,h)}
    const bw=w*si,bh=h*si,x=(w-bw)/2,y=(h-bh)/2;
    if(b>0.02){
      g.save();
      g.shadowColor='rgba(0,0,0,'+(p.shw/100*0.8*ss(b*3)).toFixed(3)+')';g.shadowBlur=16*k*b;
      g.fillStyle='#000';g.fillRect(x,y,bw,bh);
      g.restore();
    }
    g.save();
    g.beginPath();g.rect(x,y,bw,bh);g.clip();
    g.translate(w/2,h/2);g.scale(si,si);g.translate(-w/2,-h/2);
    g.drawImage(S.canvas,0,0);
    g.restore();
    g.strokeStyle='rgba(235,235,235,'+(0.9*ss(b*4)).toFixed(3)+')';g.lineWidth=Math.max(1,1.5*k);
    g.strokeRect(x,y,bw,bh);
  }

  /* ===== 16. Belah Empat (dari video referensi): layar terbelah silang jadi empat petak dengan celah tipis di tengah,
     tiap petak mengalir satu arah (bergantian per petak, ada jeda acak) lalu kembali menyatu persis seperti semula. ===== */
  function empat(g,w,h,p,tm,opaque,rel,dur){
    const b=bell2(rel,dur);if(b<0.003)return;
    const u=uOf(rel,dur),sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('em',w,h);S.drawImage(g.canvas,0,0);
    const gp=p.gap/100*Math.min(w,h)*0.012*b+1.2*k*ss(b*4),cx=w/2,cy=h/2;
    g.clearRect(0,0,w,h);g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    for(let q=0;q<4;q++){
      const qx=q&1,qy=q>>1;
      const x0=qx?cx+gp/2:0,x1=qx?w:cx-gp/2,y0=qy?cy+gp/2:0,y1=qy?h:cy-gp/2;
      const sh=((q===0||q===3)?1:-1)*sg*w*run(u,rnd(q,7)*p.amt/100);
      const z=1+p.zm/100*b*(0.4+0.8*rnd(q,5));
      g.save();
      g.beginPath();g.rect(x0,y0,x1-x0,y1-y0);g.clip();
      g.translate(cx+sh,cy);g.scale(z,z);g.translate(-cx,-cy);
      for(let s=-1;s<=1;s++)g.drawImage(S.canvas,s*w,0);
      g.restore();
    }
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
      params:[['sty','Arah (0 = atas-bawah, 1 = kiri-kanan)',0,1,0],['wrn','Warna (0 = putih, 100 = hitam)',0,100,100],['sf','Kelembutan tepi tirai',0,100,30]],apply:tirai},
    {id:'trpanel',cat:'transisi',name:'Panel Geser',desc:'Gambar terpotong jadi panel persegi yang bergeser dengan bayangan, gaya panel manga',len:0.9,
      params:[['cnt','Jumlah baris panel',2,6,3],['amt','Gerak naik-turun',0,100,40],['zm','Zoom dasar (%)',0,30,10],['shw','Bayangan panel',0,100,50],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(panelgeser)},
    {id:'trstrip',cat:'transisi',name:'Strip Putih',desc:'Gambar terpotong jadi pita horizontal yang bergeser berlawanan arah, dipisah celah putih',len:0.9,
      params:[['cnt','Jumlah pita',3,12,6],['amt','Gerak naik-turun',0,100,40],['gap','Lebar celah',0,100,60],['wrn','Warna celah (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(strip)},
    {id:'trkipas',cat:'transisi',name:'Kipas Silang',desc:'Layar terbelah silang jadi juring kipas yang berputar berlawanan, celah hitam di antaranya',len:0.9,
      params:[['cnt','Jumlah juring (genap)',4,16,8],['trn','Putaran penuh (kali)',1,3,1],['opn','Lebar celah hitam',0,100,50],['zm','Zoom dasar (%)',0,30,10],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(kipas)},
    {id:'trinversi',cat:'transisi',name:'Inversi Gelembung',desc:'Gambar jadi garis tepi terang di latar gelap dengan cincin gelembung, lalu kembali normal',len:0.9,
      params:[['amt','Kekuatan inversi',0,100,100],['cnt','Jumlah gelembung',0,150,90],['edg','Tebal garis tepi',1,6,2],['zm','Zoom dasar (%)',0,30,6]],apply:mb(inversi)},
    {id:'trpusaran',cat:'transisi',name:'Pusaran',desc:'Gambar mengecil dan berputar jadi kincir kecil di layar putih, lalu mekar kembali',len:1.0,
      params:[['cnt','Jumlah bilah kincir',3,8,5],['trn','Putaran penuh (kali)',1,3,1],['tw','Lengkung bilah',0,100,50],['wrn','Warna latar (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(pusaran)},
    {id:'trpecahan',cat:'transisi',name:'Pecahan Miring',desc:'Gambar terbelah jadi pecahan diagonal yang bergeser dan miring dengan bayangan',len:0.9,
      params:[['cnt','Jumlah pecahan',2,6,3],['ang','Sudut potong (derajat)',-80,80,-20],['amt','Jeda antar pecahan',0,100,60],['zm','Zoom dasar (%)',0,30,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(pecahan)},
    {id:'trbelahgaris',cat:'transisi',name:'Belah Garis',desc:'Celah tipis membelah layar, kedua sisi merenggang dan pita tengah menyelip',len:0.8,
      params:[['ori','Arah (0 = mendatar, 1 = tegak)',0,1,0],['pos','Posisi belahan (%)',10,90,50],['gap','Lebar celah',0,100,40],['amt','Lebar pita tengah',0,100,60],['wrn','Warna celah (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(belahgaris)},
    {id:'trmosaik',cat:'transisi',name:'Mosaik Kotak',desc:'Layar pecah jadi kotak-kotak yang berzoom dan bergeser acak',len:0.9,
      params:[['cnt','Jumlah kolom',2,8,4],['amt','Jeda antar kotak',0,100,70],['zm','Zoom kotak (%)',0,100,50]],apply:mb(mosaik)},
    {id:'trkotak',cat:'transisi',name:'Kotak Bingkai',desc:'Gambar mengecil jadi kotak berbingkai di tengah dengan latar cermin yang diperbesar, lalu membesar penuh lagi',len:0.9,
      params:[['sz','Ukuran kotak di puncak (%)',30,90,55],['zm','Zoom latar cermin (%)',0,80,30],['dim','Gelapkan latar',0,80,30],['shw','Bayangan kotak',0,100,60]],apply:mb(kotak)},
    {id:'trempat',cat:'transisi',name:'Belah Empat',desc:'Layar terbelah empat petak dengan celah tipis, tiap petak mengalir bergantian lalu menyatu lagi',len:0.9,
      params:[['gap','Lebar celah',0,100,60],['amt','Jeda antar petak',0,100,50],['zm','Zoom petak (%)',0,50,15],['wrn','Warna celah (0 = putih, 100 = hitam)',0,100,20],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:mb(empat)}
  ];
  for(const e of LIST){if(F.DEF[e.id])continue;F.LIST.push(e);F.DEF[e.id]=e}

  /* ===== Shake Video MENYAMBUNG =====
     Shake Video asli (js/fxclip.js) mengulang satu hentakan dari awal sampai akhir clip dengan kekuatan tetap, jadi tiap putaran terasa seperti hentakan baru.
     Di sini kekuatannya dibungkus kurva sepanjang clip: DIAM > naik pelan > KLIMAKS (dataran di tengah clip) > mereda pelan > DIAM,
     jadi gerakannya menyambung seperti fade in > klimaks > fade out. Zoom tambahan ikut dikalikan kurva yang sama supaya tidak melompat di awal atau akhir.
     Gerak dasar tetap data dari video referensi (tidak diubah). "Naik pelan" dan "Turun pelan" mengatur panjang bagian naik dan turun (0 = tajam, 100 = sepanjang separuh clip).
     Kalau "Ulangi terus" = 0 (sekali di awal), perilaku lama dipakai apa adanya tanpa kurva. */
  (function(){
    const d=F.DEF.vshake;
    if(!d||d.cont)return;
    const orig=d.apply;
    d.cont=true;
    d.len=3;
    d.desc='Hentakan kamera dari video referensi yang menyambung: pelan masuk, klimaks di tengah clip, lalu pelan mereda sampai diam';
    d.params=d.params.concat([
      ['atk','Naik pelan (0 = langsung kuat, 100 = naik pelan sampai tengah clip)',0,100,60],
      ['dec','Turun pelan (0 = tetap kuat sampai akhir, 100 = mereda pelan dari tengah clip)',0,100,60]
    ]);
    d.apply=function(g,w,h,p,tm,opaque,rel,dur){
      let q=p;
      if(p.rep>=1&&dur>0){
        const u=clamp(rel/dur,0,1),ri=0.04+0.46*p.atk/100,fa=0.04+0.46*p.dec/100;
        let e=1;
        if(u<ri)e=sm5(u/ri);
        if(u>1-fa)e=Math.min(e,sm5((1-u)/fa));
        if(e<0.002)return;
        q=Object.assign({},p,{amt:p.amt*e,zm:p.zm*e});
      }
      orig(g,w,h,q,tm,opaque,rel,dur);
    };
  })();
})();
