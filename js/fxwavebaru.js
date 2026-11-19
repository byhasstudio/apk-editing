/* Efek clip tambahan: 4 Gelombang Baru (Gelombang Baru 1 sampai 4), ditiru dari video referensi (empat efek bergelombang berurutan, bertanda 1 sampai 4).
   Fade hitam masuk dan keluar di video referensi sengaja TIDAK ditiru; hanya gerak gelombangnya.
   Cara ukur: tiap frame video dibandingkan dengan frame diam sebelum efek, lalu dicocokkan ke model "putar dari tengah + strip digeser mengikuti gelombang sinus,
   tepi yang terbuka diisi CERMIN gambar itu sendiri (tanpa zoom)". Hasilnya tiga kurva waktu per efek: Goyang putar (derajat), Simpangan (pecahan lebar layar),
   dan Fase gelombang (putaran). Kurva itu dipakai apa adanya, jadi gerak bawaan sama dengan video, dan semuanya bisa diatur:
   Kekuatan (skala simpangan), Goyang putar (skala putaran), Jumlah gelombang, Kecepatan, Arah (sudut), dan Balik arah.
   Durasi diatur lewat panjang clip efek di timeline: kurva ikut memanjang atau memendek.
   Frame kosong (sudut akibat putar, tepi akibat geser): DULU ditutup dengan menarik memanjang piksel tepi, hasilnya garis-garis lurus; SEKARANG diisi pantulan
   cermin gambar (bolak-balik seperti ubin cermin), jadi tidak ada garis dan sambungan di tepi mulus.
   Gelombang Baru 4 punya opsi tambahan "Arah ke bawah tengah" (dwn = 1): gelombang berbentuk lingkaran konsentris yang pusatnya di tengah tepi bawah layar,
   riaknya merambat MENUJU titik bawah tengah itu (simpangan searah jari-jari). Tiap cincin digeser dengan cara diskalakan dari titik bawah tengah, tepi yang terbuka
   diisi cermin juga. Kalau dwn = 0 (bawaan), perilakunya ikut "Arah gelombang" sudut.
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
  /* gambar diberi bingkai m piksel di semua sisi; isi bingkai = pantulan cermin gambar itu sendiri (ubin dibalik bergantian),
     jadi tidak ada garis hasil tarikan piksel tepi dan sambungan di tepi selalu mulus */
  function pad(src,w,h,m){
    const P=ac('wb_p',w+2*m,h+2*m);
    const nx=Math.ceil(m/w),ny=Math.ceil(m/h);
    for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++){
      const fx=i&1,fy=j&1;
      P.save();
      P.translate(m+i*w+(fx?w:0),m+j*h+(fy?h:0));
      P.scale(fx?-1:1,fy?-1:1);
      P.drawImage(src,0,0);
      P.restore();
    }
    return P.canvas;
  }

  /* kurva hasil ukur dari video referensi, 28 titik sama rata sepanjang efek (u = 0 sampai 1)
     rot = putaran dalam derajat (positif = berlawanan arah jarum jam), amp = simpangan sebagai pecahan lebar layar,
     ph  = fase gelombang dalam putaran, dihitung dari ph0 */
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
    wavebaru4:{len:1.2,ph0:-0.477,
      rot:[0,-0.14,-0.1,-0.02,0.31,0.86,1.66,2.55,3.37,4.13,3.8,3.39,2.92,2.45,1.94,1.4,0.93,0.47,0,-0.55,-1.05,-1.52,-1.99,-1.82,-1.07,-0.57,-0.21,0],
      amp:[0,0.001,0.002,0.003,0.008,0.016,0.028,0.041,0.054,0.067,0.07,0.069,0.065,0.061,0.057,0.053,0.05,0.046,0.042,0.038,0.034,0.03,0.027,0.02,0.011,0.005,0.003,0],
      ph:[0,0,0,0,0,0,-0.003,-0.025,-0.045,-0.063,-0.088,-0.118,-0.151,-0.184,-0.22,-0.258,-0.291,-0.324,-0.357,-0.396,-0.43,-0.463,-0.496,-0.513,-0.513,-0.513,-0.513,-0.513]}
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
      /* 1) putar dari tengah; sudut yang terbuka diisi cermin gambar (tanpa zoom, tanpa garis tarikan) */
      const m1=Math.min(Math.ceil(Math.max(w,h)*0.5),Math.ceil(Math.abs(rot)*Math.hypot(w,h)/2)+2);
      const Z=ac('wb_z',w,h);
      Z.translate(w/2,h/2);Z.rotate(-rot);
      Z.drawImage(pad(S.canvas,w,h,m1),-w/2-m1,-h/2-m1);
      /* 2) strip digeser mengikuti gelombang sinus; tepi yang terbuka diisi cermin */
      const m=Math.ceil(A)+2,Pc=pad(Z.canvas,w,h,m);
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      if(p.dwn>=1){
        /* arah ke bawah tengah: cincin konsentris berpusat di tengah tepi bawah layar, riak merambat menuju pusat itu.
           Tiap cincin digeser searah jari-jari dengan menskalakan gambar dari titik pusat (skala = 1 + simpangan / jari-jari).
           Dekat pusat simpangan dilandaikan ke 0 supaya skalanya tidak meledak. */
        const cx0=w/2,cy0=h,Rm=Math.hypot(w/2,h),st=Math.max(2,Math.round(Rm/(fast?110:170))),ramp=Rm*0.12;
        for(let r=0;r<Rm;r+=st){
          const rm=r+st/2,fr=rm/Rm;
          let dx=inv*A*Math.sin(2*Math.PI*(cyc*fr-ph));
          dx*=Math.min(1,rm/ramp);
          const s=1+dx/Math.max(rm,1);
          g.save();
          g.beginPath();
          g.arc(cx0,cy0,r+st+1,0,Math.PI*2);                 /* +1 supaya antar cincin saling menimpa, tidak ada garis tipis */
          g.moveTo(cx0+r,cy0);
          g.arc(cx0,cy0,r,0,Math.PI*2,true);
          g.clip();
          g.translate(cx0,cy0);g.scale(s,s);
          g.drawImage(Pc,-cx0-m,-cy0-m);
          g.restore();
        }
        return;
      }
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

  const PR=(cnt,ang,dwn)=>{
    const a=[
      ['amt','Kekuatan gelombang (%, 100 = persis video)',0,300,100],
      ['rot','Goyang putar (%, 100 = persis video, 0 = tanpa putar)',0,300,100],
      ['cnt','Jumlah gelombang (1 = setengah, 2 = satu gelombang, makin besar makin rapat)',1,12,cnt],
      ['spd','Kecepatan (%, 100 = persis video, makin besar makin cepat selesai)',20,300,100],
      ['ang','Arah gelombang (0 = ke samping, 45 = miring naik, 90 = naik turun, minus = dibalik)',-90,90,ang],
      ['inv','Balik arah kiri kanan (0 = normal, 1 = dibalik)',0,1,0]
    ];
    if(dwn)a.push(['dwn','Arah ke bawah tengah (0 = ikut sudut di atas, 1 = riak lingkaran merambat menuju bawah tengah layar)',0,1,0]);
    return a;
  };
  const ENT=[
    {id:'wavebaru1',name:'Gelombang Baru 1',desc:'Miring ke kanan lalu berayun balik, gelombang ke samping (efek 1 video)',len:C.wavebaru1.len,params:PR(1,0)},
    {id:'wavebaru2',name:'Gelombang Baru 2',desc:'Dua denyut: satu kuat, satu tipis, ke samping (efek 2 video)',len:C.wavebaru2.len,params:PR(1,0)},
    {id:'wavebaru3',name:'Gelombang Baru 3',desc:'Miring ke kiri lalu hentak ke kanan, ke samping (efek 3 video)',len:C.wavebaru3.len,params:PR(1,0)},
    {id:'wavebaru4',name:'Gelombang Baru 4',desc:'Gelombang miring 45 derajat, lebih tipis; bisa diarahkan ke bawah tengah (efek 4 video)',len:C.wavebaru4.len,params:PR(2,45,true)}
  ];
  let at=F.LIST.findIndex(e=>e.id==='wavecc');
  if(at<0)at=F.LIST.findIndex(e=>e.id==='wave2');
  ENT.forEach((en,k)=>{
    en.apply=make(en.id);
    F.DEF[en.id]=en;
    if(at>=0)F.LIST.splice(at+1+k,0,en);else F.LIST.push(en);
  });
})();
