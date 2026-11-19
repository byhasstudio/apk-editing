/* Efek clip tambahan: 4 Gelombang Baru (Gelombang Baru 1 sampai 4), ditiru dari video referensi (empat efek bergelombang berurutan, bertanda 1 sampai 4).
   Fade hitam masuk dan keluar di video referensi sengaja TIDAK ditiru; hanya gerak gelombangnya.
   Cara ukur: tiap frame video dibandingkan dengan frame diam sebelum efek, lalu dicocokkan ke model "putar dari tengah + strip digeser mengikuti gelombang sinus".
   Tepi yang terbuka dibiarkan KOSONG (tanpa zoom penutup dan tanpa tarik tepi); frame kosong nanti diisi efek Isi Cermin kalau dipasang.
   Hasilnya tiga kurva waktu per efek: Goyang putar (derajat), Simpangan (pecahan lebar layar),
   dan Fase gelombang (putaran). Kurva itu dipakai apa adanya, jadi gerak bawaan sama dengan video, dan semuanya bisa diatur:
   Kekuatan (skala simpangan), Goyang putar (skala putaran), Jumlah gelombang, Kecepatan, Arah (sudut), dan Balik arah.
   Durasi diatur lewat panjang clip efek di timeline: kurva ikut memanjang atau memendek.
   Efek 4 memakai model lain (peregangan + pantulan ke bawah), lihat catatan di bawah.
   Di bagian paling bawah file ini, efek bawaan fxclip.js (Gelombang, Gelombang Balik, Getar, Glitch RGB, JJ Tipis, JJ Tipis Pintar) dipasang ulang tanpa penutup tepi.
   Dimuat setelah fxwavecc.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;

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
  /* gambar diberi bingkai kosong (transparan) m piksel di semua sisi; saat gambar bergeser atau berputar, bagian yang terbuka DIBIARKAN KOSONG
     (tidak ditarik dari piksel tepi dan tidak ditutup zoom). Frame kosong nanti diisi efek Isi Cermin kalau dipasang. */
  function pad(src,w,h,m){
    const P=ac('wb_p',w+2*m,h+2*m);
    P.drawImage(src,m,m);
    return P.canvas;
  }

  /* kurva hasil ukur dari video referensi, titik sama rata sepanjang efek (u = 0 sampai 1)
     Efek 1 sampai 3: rot = putaran dalam derajat (positif = berlawanan arah jarum jam), amp = simpangan sebagai pecahan lebar layar,
     ph = fase gelombang dalam putaran, dihitung dari ph0.
     Efek 4: bukan gelombang strip, tapi peregangan lalu pantulan ke bawah: rot (derajat), tx dan ty (geser, pecahan lebar dan tinggi layar, ty positif = ke bawah),
     zx dan zy (selisih skala lebar dan tinggi dari 1, zx negatif dan zy positif = menyempit dan memanjang ke bawah) */
  const C={
    wavebaru1:{len:2.06,ph0:0.278,
      rot:[0,0.24,0.51,0.99,1.63,2.39,3.39,4.28,4.79,4.8,3.91,1.88,-1.17,-4.45,-7.48,-9.26,-10.13,-10.09,-9.44,-8.27,-6.99,-5.61,-4.08,-2.87,-1.85,-1.13,-0.62,0],
      amp:[0,0.003,0.005,0.006,0.01,0.016,0.028,0.043,0.059,0.079,0.094,0.106,0.102,0.082,0.062,0.051,0.047,0.048,0.05,0.051,0.049,0.045,0.037,0.03,0.022,0.015,0.009,0],
      ph:[0,0,0,0,0,0,0.034,0.059,0.082,0.102,0.121,0.142,0.165,0.202,0.26,0.329,0.403,0.465,0.504,0.533,0.55,0.562,0.576,0.586,0.596,0.602,0.603,0.603]},
    wavebaru2:{len:2.07,ph0:1.407,
      rot:[0,-0.06,-0.29,-0.86,-1.66,-2.72,-3.56,-3.73,-3.03,-2.09,-1.29,-0.5,-0.14,-0.04,-0.09,-0.18,-0.28,-0.34,-0.37,-0.41,-0.46,-0.47,-0.47,-0.41,-0.32,-0.23,-0.14,0],
      amp:[0,0.006,0.016,0.031,0.048,0.066,0.085,0.111,0.142,0.138,0.115,0.085,0.054,0.022,0.001,0.018,0.029,0.034,0.034,0.032,0.026,0.021,0.016,0.011,0.007,0.005,0.003,0],
      ph:[0,0,-0.008,-0.055,-0.108,-0.175,-0.247,-0.314,-0.379,-0.413,-0.437,-0.457,-0.476,-0.495,-0.775,-1.031,-1.052,-1.072,-1.094,-1.115,-1.136,-1.163,-1.183,-1.183,-1.183,-1.183,-1.183,-1.183]},
    wavebaru3:{len:1.47,ph0:-0.092,
      rot:[0,-0.41,-0.95,-1.63,-2.4,-3.24,-4.08,-4.23,-3.53,-1.76,1.31,4.95,7.56,9.59,10.76,11.19,10.88,9.58,8.08,6.46,4.77,3.16,1.99,1.13,0.47,0.11,-0.03,0],
      amp:[0,0.009,0.013,0.013,0.011,0.008,0.025,0.051,0.081,0.114,0.142,0.155,0.134,0.107,0.084,0.066,0.051,0.038,0.033,0.031,0.03,0.029,0.027,0.023,0.018,0.013,0.009,0],
      ph:[0,0,0,-0.065,-0.171,-0.278,-0.401,-0.433,-0.451,-0.462,-0.47,-0.476,-0.488,-0.509,-0.538,-0.573,-0.615,-0.682,-0.747,-0.807,-0.86,-0.897,-0.918,-0.932,-0.945,-0.95,-0.95,-0.95]},
    wavebaru4:{len:1.4,
      rot:[0,0.0111,-0.0394,-0.1057,-0.1859,-0.3716,-0.4919,-0.2147,0.3276,0.5241,0.3238,0.2518,0.1043,-0.0002,-0.0636,-0.1057,-0.114,-0.1255,-0.0829,-0.0564,-0.0133,0],
      tx:[0,0.0008,0.0006,0.0011,0.0008,-0.0005,-0.0031,-0.0054,-0.0066,-0.0005,0.0005,0.0028,0.0034,0.0041,0.0041,0.0034,0.0023,0.0008,-0.0001,-0.0007,-0.0004,0],
      ty:[0,0.0004,-0.001,-0.0033,-0.0044,-0.0023,0.0063,0.0223,0.0418,0.0496,0.046,0.039,0.0301,0.0209,0.0124,0.0057,0.0015,-0.0002,-0.0001,0.0007,0.0015,0],
      zx:[0,0.0017,0.0014,-0.0056,-0.0252,-0.0566,-0.0929,-0.1165,-0.1081,-0.0708,-0.0361,-0.0042,0.0168,0.0279,0.029,0.0233,0.0136,0.0044,-0.0022,-0.0046,-0.004,0],
      zy:[0,-0.0031,-0.0027,0.0042,0.0252,0.0579,0.0984,0.1259,0.114,0.0658,0.0273,-0.0041,-0.0238,-0.032,-0.0312,-0.0251,-0.016,-0.0067,-0.0001,0.0014,0.0012,0]}
  };

  /* interpolasi Catmull-Rom pada titik sama rata, u = 0 sampai 1 */
  function cr(a,u){
    const n=a.length-1,x=Math.min(n,Math.max(0,u*n)),i=Math.min(n-1,Math.floor(x)),t=x-i;
    const p0=a[Math.max(0,i-1)],p1=a[i],p2=a[i+1],p3=a[Math.min(n,i+2)];
    return 0.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);
  }

  function make(id){
    const E=C[id];
    return function(g,w,h,p,tm,opaque,rel,dur){
      const D=dur>0?dur:E.len;
      const u=Math.min(1,Math.max(0,rel/D*p.spd/100));
      const inv=p.inv?-1:1;
      const A=Math.max(0,cr(E.amp,u))*p.amt/100*w;
      const rot=cr(E.rot,u)*p.rot/100*inv*Math.PI/180;
      if(A<0.3&&Math.abs(rot)<0.0005)return;
      const ph=E.ph0+cr(E.ph,u),cyc=p.cnt/2;
      const deg=p.ang||0,th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th),ux=cs,uy=-sn;
      const fast=!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);
      const S=ac('wb_s',w,h);S.drawImage(g.canvas,0,0);
      /* 1) putar dari tengah; sudut yang terbuka dibiarkan kosong (tanpa zoom) */
      const m1=Math.min(Math.ceil(Math.max(w,h)*0.5),Math.ceil(Math.abs(rot)*Math.hypot(w,h)/2)+2);
      const Z=ac('wb_z',w,h);
      Z.translate(w/2,h/2);Z.rotate(-rot);
      Z.drawImage(pad(S.canvas,w,h,m1),-w/2-m1,-h/2-m1);
      /* 2) strip digeser mengikuti gelombang sinus; tepi yang terbuka dibiarkan kosong */
      const m=Math.ceil(A)+2,Pc=pad(Z.canvas,w,h,m);
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      if(deg===0){
        const st=Math.max(1,Math.round(h/(fast?180:320)));
        for(let y=0;y<h;y+=st){
          const hh=Math.min(st,h-y),dx=inv*A*Math.sin(2*Math.PI*(cyc*(y+hh/2)/h-ph));
          g.drawImage(Pc,m+dx,y+m,w,hh,0,y,w,hh);
        }
        return;
      }
      const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h);
      const st=Math.max(3,Math.round(Ev/(fast?120:180)));
      for(let v=-Ev/2;v<Ev/2;v+=st){
        const fr=(v+st/2+Ev/2)/Ev,dx=inv*A*Math.sin(2*Math.PI*(cyc*fr-ph));
        g.save();
        g.translate(w/2,h/2);g.rotate(-th);
        g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();
        g.setTransform(1,0,0,1,0,0);
        g.drawImage(Pc,-dx*ux-m,-dx*uy-m);
        g.restore();
      }
    };
  }

  /* efek 4: transformasi dari tengah layar (skala lebar/tinggi terpisah, putar, geser), tepi yang terbuka dibiarkan kosong */
  function make4(id){
    const E=C[id];
    return function(g,w,h,p,tm,opaque,rel,dur){
      const D=dur>0?dur:E.len;
      const u=Math.min(1,Math.max(0,rel/D*p.spd/100));
      const inv=p.inv?-1:1,k=p.amt/100;
      const zx=1+cr(E.zx,u)*k*p.str/100,zy=1+cr(E.zy,u)*k*p.str/100;
      const rt=cr(E.rot,u)*k*p.rot/100*inv*Math.PI/180;
      const tx=cr(E.tx,u)*k*p.drop/100*inv*w,ty=cr(E.ty,u)*k*p.drop/100*h;
      if(Math.abs(zx-1)<0.0005&&Math.abs(zy-1)<0.0005&&Math.abs(rt)<0.0002&&Math.abs(tx)<0.3&&Math.abs(ty)<0.3)return;
      /* M = Rot(rt) * diag(zx,zy), lalu seluruhnya diputar ke arah yang dipilih (sudut Arah) */
      const c=Math.cos(rt),s=Math.sin(rt);
      let m00=zx*c,m01=zy*s,m10=-zx*s,m11=zy*c,Tx=tx,Ty=ty;
      const th=(p.ang||0)*Math.PI/180;
      if(th!==0){
        const ct=Math.cos(th),st=Math.sin(th);
        const a00=ct*m00+st*m10,a01=ct*m01+st*m11,a10=-st*m00+ct*m10,a11=-st*m01+ct*m11;
        m00=a00*ct+a01*st;m01=-a00*st+a01*ct;m10=a10*ct+a11*st;m11=-a10*st+a11*ct;
        const nx=ct*Tx+st*Ty,ny=-st*Tx+ct*Ty;Tx=nx;Ty=ny;
      }
      const cx=w/2,cy=h/2;
      const e=cx+Tx-(m00*cx+m01*cy),f=cy+Ty-(m10*cx+m11*cy);
      const mg=Math.min(Math.ceil(Math.max(w,h)*0.5),Math.ceil(0.5*Math.hypot(w,h)*(Math.abs(zx-1)+Math.abs(zy-1)+Math.abs(rt)+0.02)+Math.hypot(Tx,Ty)*1.2+4));
      const S=ac('wb_s',w,h);S.drawImage(g.canvas,0,0);
      const Pm=pad(S.canvas,w,h,mg);
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      g.save();
      g.setTransform(m00,m10,m01,m11,e,f);
      g.drawImage(Pm,-mg,-mg);
      g.restore();
    };
  }

  const PR=(cnt,ang)=>[
    ['amt','Kekuatan gelombang (%, 100 = persis video)',0,300,100],
    ['rot','Goyang putar (%, 100 = persis video, 0 = tanpa putar)',0,300,100],
    ['cnt','Jumlah gelombang (1 = setengah, 2 = satu gelombang, makin besar makin rapat)',1,12,cnt],
    ['spd','Kecepatan (%, 100 = persis video, makin besar makin cepat selesai)',20,300,100],
    ['ang','Arah gelombang (0 = ke samping, 45 = miring naik, 90 = naik turun, minus = dibalik)',-90,90,ang],
    ['inv','Balik arah kiri kanan (0 = normal, 1 = dibalik)',0,1,0]
  ];
  const PR4=[
    ['amt','Kekuatan efek (%, 100 = persis video)',0,300,100],
    ['str','Peregangan lebar dan tinggi (%, 100 = persis video, 0 = tanpa peregangan)',0,300,100],
    ['drop','Geser turun (%, 100 = persis video, 0 = tanpa geser)',0,300,100],
    ['rot','Goyang putar (%, 100 = persis video, 0 = tanpa putar)',0,300,100],
    ['spd','Kecepatan (%, 100 = persis video, makin besar makin cepat selesai)',20,300,100],
    ['ang','Arah (0 = turun ke bawah seperti video, 90 = ke kanan, -90 = ke kiri)',-90,90,0],
    ['inv','Balik kiri kanan (0 = normal, 1 = dibalik)',0,1,0]
  ];
  const ENT=[
    {id:'wavebaru1',name:'Gelombang Baru 1',desc:'Miring ke kanan lalu berayun balik, gelombang ke samping (efek 1 video)',len:C.wavebaru1.len,params:PR(1,0)},
    {id:'wavebaru2',name:'Gelombang Baru 2',desc:'Dua denyut: satu kuat, satu tipis, ke samping (efek 2 video)',len:C.wavebaru2.len,params:PR(1,0)},
    {id:'wavebaru3',name:'Gelombang Baru 3',desc:'Miring ke kiri lalu hentak ke kanan, ke samping (efek 3 video)',len:C.wavebaru3.len,params:PR(1,0)},
    {id:'wavebaru4',name:'Gelombang Baru 4',desc:'Meregang lalu memantul ke bawah di tengah layar (efek 4 video)',len:C.wavebaru4.len,params:PR4,mk:make4}
  ];
  let at=F.LIST.findIndex(e=>e.id==='wavecc');
  if(at<0)at=F.LIST.findIndex(e=>e.id==='wave2');
  ENT.forEach((en,k)=>{
    en.apply=(en.mk||make)(en.id);
    F.DEF[en.id]=en;
    if(at>=0)F.LIST.splice(at+1+k,0,en);else F.LIST.push(en);
  });

  /* ===== efek bawaan fxclip.js, versi tanpa penutup tepi =====
     Aturan semua efek: kalau ada frame kosong akibat efek (strip bergeser, gambar berputar, getar, hentak), biarkan KOSONG.
     Jadi di sini efek Gelombang, Gelombang Balik, Getar, Glitch RGB, JJ Tipis, dan JJ Tipis Pintar dipasang ulang tanpa zoom penutup tepi dan tanpa
     membungkus potongan ke sisi seberang. Zoom sentak milik JJ Tipis (parameter Zoom sentak) tetap ada karena itu bagian dari gayanya, bukan penutup tepi.
     Frame kosong diisi dengan efek Isi Cermin yang dipasang sesudahnya. */
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  function curveAt(pts,u){
    const n=pts.length;
    if(!n)return 0;
    if(u<=pts[0][0])return pts[0][1];
    if(u>=pts[n-1][0])return pts[n-1][1];
    let i=0;while(i<n-2&&u>pts[i+1][0])i++;
    const sl=k=>(pts[k+1][1]-pts[k][1])/Math.max(1e-9,pts[k+1][0]-pts[k][0]);
    const tg=k=>{
      if(k===0)return sl(0);
      if(k===n-1)return sl(n-2);
      const a=sl(k-1),b=sl(k);
      return a*b<=0?0:2*a*b/(a+b);
    };
    const x0=pts[i][0],x1=pts[i+1][0],y0=pts[i][1],y1=pts[i+1][1],hh=x1-x0;
    if(hh<=1e-9)return y1;
    const t=(u-x0)/hh,t2=t*t,t3=t2*t;
    return clamp((2*t3-3*t2+1)*y0+(t3-2*t2+t)*hh*tg(i)+(-2*t3+3*t2)*y1+(t3-t2)*hh*tg(i+1),0,1);
  }
  const CURVE_DEF=[[0,0],[0.05,1],[0.3,0],[0.5,0],[0.55,0.8],[0.8,0],[1,0]];

  function waveK(dir){
    return function(g,w,h,p,tm,opaque,rel,dur){
      let env=1;
      if(dur>0){
        const u=Math.min(1,rel/dur),a=p.atk/100,s0=a*0.15,rise=a*0.45,pk=s0+rise;
        if(u<s0)env=0;
        else if(u<pk){const x=(u-s0)/rise;env=x*x*(3-2*x)}
        if(p.dec>0&&u>pk)env*=Math.exp(-((u-pk)/Math.max(1e-6,1-pk))*p.dec/100*5);
      }
      const A=p.amt/100*0.08*w*env;
      if(A<0.3)return;
      const S=ac('wb_ks',w,h);S.drawImage(g.canvas,0,0);
      const src=S.canvas;
      const ph=dir*rel*1.3*(p.spd/50),deg=p.ang||0;
      const th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th);
      const ux=cs,uy=-sn;
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      if(deg===0){
        const st=Math.max(1,Math.round(h/320));
        for(let y=0;y<h;y+=st){
          const hh=Math.min(st,h-y),dx=dir*A*Math.sin(2*Math.PI*(p.cnt*(y+hh/2)/h-ph));
          g.drawImage(src,0,y,w,hh,dx,y,w,hh);
        }
        return;
      }
      const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h);
      const st=Math.max(3,Math.round(Ev/180));
      for(let v=-Ev/2;v<Ev/2;v+=st){
        const fr=(v+st/2+Ev/2)/Ev,dx=dir*A*Math.sin(2*Math.PI*(p.cnt*fr-ph));
        g.save();
        g.translate(w/2,h/2);g.rotate(-th);
        g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();
        g.setTransform(1,0,0,1,0,0);
        g.drawImage(src,dx*ux,dx*uy);
        g.restore();
      }
    };
  }
  function shakeK(g,w,h,p,tm,opaque){
    const a=p.amt/100;if(a<=0)return;
    const k=Math.max(0.2,p.spd/50),u=tm*k*24;
    const S=ac('wb_ks',w,h);S.drawImage(g.canvas,0,0);
    const pos=v=>({
      x:(Math.sin(v)+0.6*Math.sin(v*2.31+1.2))*a*0.018*w,
      y:(Math.cos(v*1.37)+0.6*Math.sin(v*1.93+0.4))*a*0.018*h,
      r:Math.sin(v*0.87+2)*a*0.02
    });
    const put=(q,al)=>{g.save();g.globalAlpha=al;g.translate(w/2+q.x,h/2+q.y);g.rotate(q.r);g.translate(-w/2,-h/2);g.drawImage(S.canvas,0,0);g.restore()};
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    put(pos(u-0.8),1);
    put(pos(u),0.65);
  }
  function glitchK(g,w,h,p,tm){
    const amt=p.amt/100;if(amt<=0)return;
    const k=Math.max(0.2,p.spd/50),rnd=rng(Math.floor(tm*k*14)*7919+101);
    const pulse=0.5+0.5*Math.abs(Math.sin(tm*k*4.3)*Math.cos(tm*k*1.7));
    const S=ac('wb_gs',w,h),T=ac('wb_gt',w,h);
    S.drawImage(g.canvas,0,0);
    T.drawImage(S.canvas,0,0);
    const n=1+Math.round(amt*pulse*9);
    for(let i=0;i<n;i++){
      const y=Math.floor(rnd()*h),hh=Math.min(h-y,Math.max(2,Math.floor((0.01+rnd()*0.07)*h))),dx=Math.round((rnd()-0.5)*2*amt*pulse*w*0.16);
      if(hh<=0)continue;
      S.clearRect(0,y,w,hh);
      S.drawImage(T.canvas,0,y,w,hh,dx,y,w,hh);   /* tanpa membungkus ke sisi seberang: celah dibiarkan kosong */
    }
    const sh=Math.max(1,Math.round(w*0.016*amt*(0.4+0.6*pulse)));
    g.clearRect(0,0,w,h);
    g.globalCompositeOperation='lighter';
    for(const ch of [['#f00',-sh],['#0f0',0],['#00f',sh]]){
      T.globalCompositeOperation='source-over';T.clearRect(0,0,w,h);
      T.drawImage(S.canvas,0,0);
      T.globalCompositeOperation='multiply';T.fillStyle=ch[0];T.fillRect(0,0,w,h);
      T.globalCompositeOperation='destination-in';T.drawImage(S.canvas,0,0);
      g.drawImage(T.canvas,ch[1],0);
    }
  }
  function jjShot(g,w,h,p,opaque,e){
    const rd=rng(31),ang=rd()*Math.PI*2,sg=rd()<0.5?-1:1;
    const A=p.amt/100*0.03*Math.min(w,h)*e,r=sg*p.rot*Math.PI/180*e;
    const dx=Math.cos(ang)*A,dy=Math.sin(ang)*A;
    const z=1+p.zm/100*e;
    const S=ac('wb_ks',w,h);S.drawImage(g.canvas,0,0);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    g.save();
    g.translate(w/2+dx,h/2+dy);g.rotate(r);g.scale(z,z);g.translate(-w/2,-h/2);
    g.drawImage(S.canvas,0,0);
    g.restore();
  }
  function jjK(g,w,h,p,tm,opaque,rel){
    const t=Math.max(0,rel),AT=0.025,k=5+p.dec*0.1;
    let e;
    if(t<AT){const x=t/AT;e=x*x*(3-2*x)}else e=Math.exp(-(t-AT)*k);
    if(t>AT&&e<0.004)return;
    if(e<=0)return;
    jjShot(g,w,h,p,opaque,e);
  }
  function jjpK(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0,e=curveAt(p.curve||CURVE_DEF,u);
    if(e<0.003)return;
    jjShot(g,w,h,p,opaque,e);
  }
  [['wave',waveK(1)],['wave2',waveK(-1)],['shake',shakeK],['glitch',glitchK],['jj',jjK],['jjp',jjpK]].forEach(q=>{
    const d=F.DEF[q[0]];if(d)d.apply=q[1];
  });
})();
