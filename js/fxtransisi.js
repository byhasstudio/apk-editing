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

  /* ===== efek transisi bergaya video referensi (panel manga, strip, kipas, inversi gelembung, pusaran) ===== */
  const rnd=(i,s)=>{const x=Math.sin(i*127.1+s*311.7)*43758.5453;return x-Math.floor(x)};
  const scl=(w,h)=>Math.min(w,h)/368;
  /* envelope cepat: naik sangat cepat lalu tahan sebentar di tengah clip, lalu turun cepat (lebih menyentak dari bell) */
  function snap(rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):((rel/1.2)%1);
    const v=clamp((u<0.5?u*2:(1-u)*2)*1.3,0,1);
    return 1-Math.pow(1-v,3);
  }

  /* ===== 7. Panel Geser: gambar terpotong jadi panel persegi yang membesar dan meluncur keluar satu per satu, dengan bayangan ===== */
  function panelgeser(g,w,h,p,tm,opaque,rel,dur){
    const b=snap(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('pg',w,h);S.drawImage(g.canvas,0,0);
    const z=1+p.zm/100*b;
    put(g,S.canvas,w,h,z,0,0,0,true);
    const n=Math.round(p.cnt),gp=Math.max(0,1.5*k*ss(b*4));
    let tot=0;const wt=[];for(let i=0;i<n;i++){const v=0.6+rnd(i,3);wt.push(v);tot+=v}
    let y=0;
    for(let i=0;i<n;i++){
      const rh=h*wt[i]/tot,y0=y;y+=rh;
      const cells=2+Math.floor(rnd(i,2)*2),xs=[0];
      for(let c=1;c<cells;c++)xs.push(w*(c/cells+(rnd(i,10+c)-0.5)*0.25));
      xs.push(w);
      for(let c=0;c<cells;c++){
        const loc=ss(b*1.4-0.4*rnd(i,30+c));
        const dirI=((i+c)%2?1:-1)*sg;
        const ox=dirI*(0.3+0.7*rnd(i,7+c))*p.amt/100*w*0.7*loc;
        const oy=(rnd(i,20+c)-0.5)*h*0.1*loc;
        const x0=xs[c],x1=xs[c+1],pcx=(x0+x1)/2,pcy=y0+rh/2;
        const zc=1+loc*(0.25+0.45*rnd(i,40+c));
        const rx=x0+ox,ry=y0+oy+gp,rw=x1-x0,rhh=rh-2*gp;
        g.save();
        g.shadowColor='rgba(0,0,0,'+(p.shw/100*0.7*ss(b*3)).toFixed(3)+')';
        g.shadowBlur=10*k*b;g.fillStyle='#000';g.fillRect(rx,ry,rw,rhh);
        g.shadowColor='transparent';g.shadowBlur=0;
        g.beginPath();g.rect(rx,ry,rw,rhh);g.clip();
        g.translate(pcx+ox,pcy+oy);g.scale(zc*z,zc*z);g.translate(-pcx,-pcy);
        g.drawImage(S.canvas,0,0);
        g.restore();
      }
    }
  }

  /* ===== 8. Strip Putih: pita horizontal tipis dan tebal bergeser berlawanan arah, dipisah celah putih ===== */
  function strip(g,w,h,p,tm,opaque,rel,dur){
    const b=snap(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('st',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    const n=Math.round(p.cnt),gapMax=p.gap/100*h*0.09;
    let tot=0;const wt=[];for(let i=0;i<n;i++){const r=rnd(i,5);const v=0.2+r*r*1.6;wt.push(v);tot+=v}
    let y=0;
    for(let i=0;i<n;i++){
      const rh=h*wt[i]/tot,y0=y;y+=rh;
      const loc=ss(b*1.4-0.3*rnd(i,4));
      const ox=(i%2?1:-1)*sg*p.amt/100*w*0.55*(0.4+0.6*rnd(i,9))*loc;
      const oy=(rnd(i,13)-0.5)*h*0.05*loc;
      const zc=1+0.3*loc*(i%2?1:0.4),gap=Math.min(rh*0.8,gapMax*b*(0.3+rnd(i,2)));
      g.save();
      g.beginPath();g.rect(0,y0+gap/2,w,Math.max(0,rh-gap));g.clip();
      for(let s=-1;s<=1;s++){
        g.save();g.translate(w/2+ox+s*w*zc,y0+rh/2+oy);g.scale(zc,zc);g.translate(-w/2,-(y0+rh/2));
        g.drawImage(S.canvas,0,0);g.restore();
      }
      g.restore();
      if(i>0){g.fillStyle='rgba(0,0,0,'+(0.75*ss(b*6)).toFixed(3)+')';g.fillRect(0,y0+gap/2-0.5*k,w,Math.max(1,k))}
    }
  }

  /* ===== 9. Kipas Silang: garis silang di tengah, lalu juring-juring membesar dan berputar berlawanan, celah hitam di antaranya ===== */
  function kipas(g,w,h,p,tm,opaque,rel,dur){
    const b=snap(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('kp',w,h);S.drawImage(g.canvas,0,0);
    const n=Math.max(4,Math.round(p.cnt/2)*2),cx=w/2,cy=h/2,R=Math.hypot(w,h);
    const e=ss(b*1.1);
    const rot=p.rot*Math.PI/180*e,open=p.opn/100*Math.min(w,h)*0.1*e,z=1+p.zm/100*e+0.15*e;
    g.clearRect(0,0,w,h);g.fillStyle='#000';g.fillRect(0,0,w,h);
    for(let i=0;i<n;i++){
      const a0=i*TAU/n-Math.PI/2+rot*0.15*sg,a1=(i+1)*TAU/n-Math.PI/2+rot*0.15*sg,mid=(a0+a1)/2;
      const ox=cx+Math.cos(mid)*open,oy=cy+Math.sin(mid)*open;
      g.save();
      g.translate(ox,oy);
      g.beginPath();g.moveTo(0,0);g.arc(0,0,R,a0,a1);g.closePath();
      g.clip();
      g.rotate((i%2?1:-1)*sg*rot);
      const s2=z*(i%2?1:1+0.25*e);
      g.scale(s2,s2);g.translate(-cx,-cy);
      g.drawImage(S.canvas,0,0);
      g.restore();
      g.save();g.translate(ox,oy);
      g.strokeStyle='rgba(0,0,0,0.9)';g.lineWidth=Math.max(1,k);
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

  /* ===== 11. Pusaran: gambar mengecil dan berputar jadi kincir kecil di layar putih, lalu mekar kembali ===== */
  function pusaran(g,w,h,p,tm,opaque,rel,dur){
    const b=snap(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('ps',w,h);S.drawImage(g.canvas,0,0);
    const cx=w/2,cy=h/2,n=Math.round(p.cnt),sc=Math.max(0.012,1-b*0.99);
    const R=Math.hypot(w,h)/2*sc*1.02,tw=p.tw/100*Math.PI*0.9*b,rot=sg*p.rot*Math.PI/180*b;
    const f=1-0.45*ss(b*1.6),bw=TAU/n*f,N=14;
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
      g.strokeStyle='rgba(20,20,20,'+(0.85*ss(b*4)).toFixed(3)+')';g.lineWidth=Math.max(1,1.6*k);g.stroke();
      g.restore();
    }
  }


  /* ===== 12. Pecahan Miring: gambar terbelah jadi pecahan diagonal yang bergeser dan miring, dengan bayangan ===== */
  function pecahan(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('pc',w,h);S.drawImage(g.canvas,0,0);
    const cx=w/2,cy=h/2,R=Math.hypot(w,h),th=p.ang*Math.PI/180,n=Math.round(p.cnt);
    put(g,S.canvas,w,h,1+p.zm/100*b,0,0,0,true);
    for(let i=0;i<n;i++){
      const y0=-R/2+R*i/n,y1=-R/2+R*(i+1)/n,sh=(i%2?1:-1)*sg*p.amt/100*0.45*w*b*(0.5+0.5*rnd(i,4)),tl=(rnd(i,9)-0.5)*0.25*b;
      const path=()=>{g.beginPath();g.rect(-R,y0,2*R,y1-y0)};
      g.save();g.translate(cx,cy);g.rotate(th);g.translate(sh,0);g.rotate(tl);
      g.shadowColor='rgba(0,0,0,'+(0.55*ss(b*3)).toFixed(3)+')';g.shadowBlur=10*k*b;
      path();g.fillStyle='#000';g.fill();g.shadowColor='transparent';g.shadowBlur=0;
      path();g.clip();
      g.rotate(-tl);g.translate(-sh,0);g.rotate(-th);g.translate(-cx,-cy);
      g.translate(cx,cy);g.rotate(th);g.translate(sh,0);g.rotate(tl);g.rotate(-th);g.translate(-cx,-cy);
      g.translate(cx,cy);g.scale(1+0.08*b,1+0.08*b);g.translate(-cx,-cy);
      g.drawImage(S.canvas,0,0);
      g.restore();
    }
  }

  /* ===== 13. Belah Garis: celah tipis membelah layar, kedua sisi bergeser dan pita tengah menyelip ===== */
  function belahgaris(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const sg=p.dir>=1?-1:1,k=scl(w,h),S=ac('bg',w,h);S.drawImage(g.canvas,0,0);
    const V=p.ori>=1,L=V?w:h,T=V?h:w,pos=L*p.pos/100,gap=p.gap/100*L*0.18*b,bw=L*0.12*b;
    g.clearRect(0,0,w,h);g.fillStyle='rgb('+gray(p.wrn)+')';g.fillRect(0,0,w,h);
    const slide=sg*p.amt/100*0.4*T*b;
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

  /* ===== 14. Mosaik Kotak: layar terpecah jadi kotak-kotak yang masing-masing berzoom dan bergeser acak ===== */
  function mosaik(g,w,h,p,tm,opaque,rel,dur){
    const b=bell(rel,dur);if(b<0.003)return;
    const k=scl(w,h),S=ac('ms',w,h);S.drawImage(g.canvas,0,0);
    put(g,S.canvas,w,h,1,0,0,0,true);
    const cols=Math.round(p.cnt),rows=Math.max(2,Math.round(cols*h/w)),tw=w/cols,th=h/rows,gp=Math.max(0,1.2*k*ss(b*4));
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const id=r*cols+c,x=c*tw,y=r*th;
      const z=1+p.zm/100*b*(0.3+2*rnd(id,2)),ox=(rnd(id,3)-0.5)*p.amt/100*tw*2.2*b,oy=(rnd(id,4)-0.5)*p.amt/100*th*2.2*b;
      g.save();
      g.beginPath();g.rect(x+gp,y+gp,tw-2*gp,th-2*gp);g.clip();
      g.translate(x+tw/2+ox,y+th/2+oy);g.scale(z,z);g.translate(-(x+tw/2),-(y+th/2));
      g.drawImage(S.canvas,0,0);
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
      params:[['cnt','Jumlah baris panel',2,6,3],['amt','Jauh geseran',0,100,80],['zm','Zoom dasar (%)',0,30,10],['shw','Bayangan panel',0,100,50],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:panelgeser},
    {id:'trstrip',cat:'transisi',name:'Strip Putih',desc:'Gambar terpotong jadi pita horizontal yang bergeser berlawanan arah, dipisah celah putih',len:0.9,
      params:[['cnt','Jumlah pita',3,12,6],['amt','Jauh geseran',0,100,60],['gap','Lebar celah',0,100,60],['wrn','Warna celah (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:strip},
    {id:'trkipas',cat:'transisi',name:'Kipas Silang',desc:'Layar terbelah silang jadi juring kipas yang berputar berlawanan, celah hitam di antaranya',len:0.9,
      params:[['cnt','Jumlah juring (genap)',4,16,8],['rot','Sudut putar (derajat)',0,90,35],['opn','Lebar celah hitam',0,100,50],['zm','Zoom dasar (%)',0,30,10],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:kipas},
    {id:'trinversi',cat:'transisi',name:'Inversi Gelembung',desc:'Gambar jadi garis tepi terang di latar gelap dengan cincin gelembung, lalu kembali normal',len:0.9,
      params:[['amt','Kekuatan inversi',0,100,100],['cnt','Jumlah gelembung',0,150,90],['edg','Tebal garis tepi',1,6,2],['zm','Zoom dasar (%)',0,30,6]],apply:inversi},
    {id:'trpusaran',cat:'transisi',name:'Pusaran',desc:'Gambar mengecil dan berputar jadi kincir kecil di layar putih, lalu mekar kembali',len:1.0,
      params:[['cnt','Jumlah bilah kincir',3,8,5],['rot','Putaran (derajat)',0,360,140],['tw','Lengkung bilah',0,100,50],['wrn','Warna latar (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:pusaran},
    {id:'trpecahan',cat:'transisi',name:'Pecahan Miring',desc:'Gambar terbelah jadi pecahan diagonal yang bergeser dan miring dengan bayangan',len:0.9,
      params:[['cnt','Jumlah pecahan',2,6,3],['ang','Sudut potong (derajat)',-80,80,-20],['amt','Jauh geseran',0,100,60],['zm','Zoom dasar (%)',0,30,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:pecahan},
    {id:'trbelahgaris',cat:'transisi',name:'Belah Garis',desc:'Celah tipis membelah layar, kedua sisi merenggang dan pita tengah menyelip',len:0.8,
      params:[['ori','Arah (0 = mendatar, 1 = tegak)',0,1,0],['pos','Posisi belahan (%)',10,90,50],['gap','Lebar celah',0,100,40],['amt','Geser pita tengah',0,100,60],['wrn','Warna celah (0 = putih, 100 = hitam)',0,100,6],['dir','Balik arah (0 = tidak, 1 = ya)',0,1,0]],apply:belahgaris},
    {id:'trmosaik',cat:'transisi',name:'Mosaik Kotak',desc:'Layar pecah jadi kotak-kotak yang berzoom dan bergeser acak',len:0.9,
      params:[['cnt','Jumlah kolom',2,8,4],['amt','Jauh geseran',0,100,50],['zm','Zoom kotak (%)',0,100,50]],apply:mosaik}
  ];
  for(const e of LIST){if(F.DEF[e.id])continue;F.LIST.push(e);F.DEF[e.id]=e}
})();
