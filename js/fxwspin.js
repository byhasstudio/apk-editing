/* Efek clip tambahan: Gelombang Putar (js/fxclip.js menyediakan daftar efek, file ini menambahkan satu efek ke dalamnya).
   Dimuat setelah js/fxclip.js dan sebelum js/fxlib.js, jadi efeknya muncul di daftar Efek dan di pilihan "Jenis efek" panel Properti. */
window.APK=window.APK||{};
(function(){
  if(!APK.fxclip||!APK.fxclip.LIST||!APK.fxclip.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
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
  /* ===== efek: Gelombang Putar =====
     Satu efek utuh yang meniru transisi di video referensi (sekitar 4,4 detik), terdiri dari lima tahap berurutan sepanjang clip efek:
       1. GELOMBANG (0 sampai 33%): gambar meliuk miring, simpangan membesar pelan (mulai terlihat sekitar 20%) sampai kuat, gambar ikut membesar supaya tepi tidak bolong.
       2. KILAT PUTAR (33 sampai 40%): layar memutih, gambar kabur dan berputar 90 derajat berlawanan arah jarum jam.
       3. UBIN CERMIN (40 sampai 86%): gambar jadi ubin cermin miring yang berputar pelan, bergaris putih tipis di sambungannya.
       4. PEMBUKAAN DARI ATAS (41 sampai 86%): dari atas ke bawah, isi layar yang asli (tanpa efek) terbuka dan mendorong ubin ke bawah sampai habis.
          Potong clip A ke clip B di sekitar tahap ini (sekitar 45% dari panjang clip efek) supaya yang terbuka dari atas adalah clip B.
       5. KABUR GERAK (84 sampai 100%): gambar kabur dan sedikit membesar, lalu tajam kembali.
     Semua tahap mengikuti PANJANG CLIP: clip diperpanjang = semua tahap melambat bersama. */
  const WS_U=[0.33,0.40,0.86];   /* batas tahap: akhir gelombang, akhir kilat putar, akhir pembukaan */
  const WS_REV=[[0.40,0],[0.41,0.05],[0.45,0.2],[0.57,0.4],[0.68,0.55],[0.80,0.72],[0.86,1]];   /* tinggi pembukaan (0..1 tinggi layar) menurut u, diukur dari video referensi */
  function wsLerp(tab,u){
    if(u<=tab[0][0])return tab[0][1];
    for(let i=1;i<tab.length;i++)if(u<=tab[i][0]){const a=tab[i-1],b=tab[i],t=(u-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t}
    return tab[tab.length-1][1];
  }
  /* gelombang miring (sama dengan efek Gelombang): src digeser per strip mengikuti sinus, hasil digambar ke g */
  function wsWave(g,src,w,h,A,cnt,ph,deg){
    const th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th),ux=cs,uy=-sn;
    const z=1+2*A*Math.max(Math.abs(ux)/w,Math.abs(uy)/h);
    const Z=ac('z',w,h);
    Z.translate(w/2,h/2);Z.scale(z,z);Z.translate(-w/2,-h/2);Z.drawImage(src,0,0);
    g.clearRect(0,0,w,h);
    if(deg===0){
      const st=Math.max(1,Math.round(h/320));
      for(let y=0;y<h;y+=st){const hh=Math.min(st,h-y),dx=A*Math.sin(2*Math.PI*(cnt*(y+hh/2)/h-ph));g.drawImage(Z.canvas,0,y,w,hh,dx,y,w,hh)}
      return;
    }
    const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h),st=Math.max(3,Math.round(Ev/180));
    for(let v=-Ev/2;v<Ev/2;v+=st){
      const fr=(v+st/2+Ev/2)/Ev,dx=A*Math.sin(2*Math.PI*(cnt*fr-ph));
      g.save();
      g.translate(w/2,h/2);g.rotate(-th);
      g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();
      g.setTransform(1,0,0,1,0,0);
      g.drawImage(Z.canvas,dx*ux,dx*uy);
      g.restore();
    }
  }
  function wspin(g,w,h,p,tm,opaque,rel,dur){
    const u=dur>0?clamp(rel/dur,0,1):0,ss=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
    const amt=p.amt/100,bl=p.blr/100,S=ac('s',w,h);
    S.drawImage(g.canvas,0,0);
    const sc=w/576;   /* skala ukuran piksel terhadap video referensi (lebar 576) */
    const base=()=>{g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.filter='none';g.clearRect(0,0,w,h);if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}};
    const blurTo=(src,px,zoom,al)=>{   /* gambar src kabur dan sedikit membesar ke g */
      g.save();g.globalAlpha=al==null?1:al;
      if(px>0.3&&'filter' in g)g.filter='blur('+(px*sc).toFixed(1)+'px)';
      g.translate(w/2,h/2);g.scale(zoom,zoom);g.translate(-w/2,-h/2);g.drawImage(src,0,0);g.restore();
    };
    /* tahap 1 dan 2 memakai hasil gelombang W; env naik pelan sampai 1 di akhir gelombang */
    if(u<WS_U[1]){
      const e=Math.pow(ss((u-0.2)/(WS_U[0]-0.2)),1.2),W=ac('w',w,h);
      const A=amt*0.28*w*e,zb=1+0.25*amt*e;
      if(A>0.3){wsWave(W,S.canvas,w,h,A,p.cnt,rel*1.8,p.ang);if(zb>1.001){const Y=ac('y',w,h);Y.drawImage(W.canvas,0,0);W.clearRect(0,0,w,h);W.translate(w/2,h/2);W.scale(zb,zb);W.translate(-w/2,-h/2);W.drawImage(Y.canvas,0,0);W.setTransform(1,0,0,1,0,0)}}else W.drawImage(S.canvas,0,0);
      if(u<WS_U[0]){base();g.drawImage(W.canvas,0,0);return}
      /* tahap 2: kilat putih, kabur, berputar 90 derajat */
      const x=(u-WS_U[0])/(WS_U[1]-WS_U[0]),a=ss(x);
      base();
      g.fillStyle='#fff';g.fillRect(0,0,w,h);
      g.save();
      if('filter' in g)g.filter='blur('+((4+30*bl*(1-0.5*a))*sc).toFixed(1)+'px)';
      g.translate(w/2,h/2);g.rotate(-Math.PI/2*a);g.scale(1+0.25*a,1+0.25*a);g.translate(-w/2,-h/2);
      g.drawImage(W.canvas,0,0);
      g.restore();
      g.save();g.filter='none';g.globalAlpha=0.85*ss(x/0.2)*(1-0.8*a);g.fillStyle='#fff';g.fillRect(0,0,w,h);g.restore();
      return;
    }
    /* tahap 3 dan 4: ubin cermin berputar dan pembukaan dari atas */
    if(u<WS_U[2]){
      const x=(u-WS_U[1])/(WS_U[2]-WS_U[1]),k=p.tl/60;
      const tw=Math.round(w*(1.05-0.35*ss(x/0.55))*k),th=Math.round(tw*w/h);
      const T=ac('t',tw,th);
      T.translate(tw/2,th/2);T.rotate(-Math.PI/2);
      const s2=tw/h;T.drawImage(S.canvas,-w*s2/2,-h*s2/2,w*s2,h*s2);
      base();
      const tilt=(p.tilt-6*ss(x))*Math.PI/180;
      g.save();
      if(u<0.5&&'filter' in g)g.filter='blur('+(8*bl*(1-ss((u-0.40)/0.10))*sc).toFixed(1)+'px)';
      g.translate(w/2,h/2);g.rotate(tilt);
      const nx=Math.ceil(Math.hypot(w,h)/2/tw)+1,ny=Math.ceil(Math.hypot(w,h)/2/th)+1;
      for(let j=-ny;j<=ny;j++)for(let i=-nx;i<=nx;i++){
        g.save();g.translate(i*tw,j*th);g.scale(i&1?-1:1,j&1?-1:1);
        g.drawImage(T.canvas,-tw/2-0.5,-th/2-0.5,tw+1,th+1);
        g.restore();
      }
      g.filter='none';
      g.strokeStyle='rgba(255,255,255,0.6)';g.lineWidth=Math.max(1,2*sc);
      for(let j=-ny;j<=ny;j++){g.beginPath();g.moveTo(-nx*tw-tw/2,j*th+th/2);g.lineTo(nx*tw+tw/2,j*th+th/2);g.stroke()}
      for(let i=-nx;i<=nx;i++){g.beginPath();g.moveTo(i*tw+tw/2,-ny*th-th/2);g.lineTo(i*tw+tw/2,ny*th+th/2);g.stroke()}
      g.restore();
      /* kabut putih tipis di awal ubin */
      const hz=0.45*(1-ss((u-0.40)/0.08));
      if(hz>0.01){g.save();g.globalAlpha=hz;g.fillStyle='#fff';g.fillRect(0,0,w,h);g.restore()}
      const ry=wsLerp(WS_REV,u)*h;
      if(ry>1){
        g.save();g.beginPath();g.rect(0,0,w,ry);g.clip();g.drawImage(S.canvas,0,0);g.restore();
        g.save();g.globalAlpha=0.5;g.fillStyle='#fff';g.fillRect(0,ry-2*sc,w,3*sc);g.restore();
      }
      return;
    }
    /* tahap 5: kabur gerak yang mereda */
    const q=(u-WS_U[2]+0.02)/(1-WS_U[2]+0.02),bell=q<0.5?ss(q/0.5):1-ss((q-0.5)/0.5)*0.9;
    base();
    blurTo(S.canvas,26*bl*bell,1+0.07*bell,1);
    if(bell>0.05)blurTo(S.canvas,10*bl*bell,1+0.14*bell,0.45);
  }

  const entry={id:'wspin',name:'Gelombang Putar',desc:'Gelombang, kilat putar, ubin cermin, lalu kabur: satu transisi utuh seperti video referensi',len:4.4,
    params:[['amt','Kekuatan gelombang',0,100,60],['cnt','Jumlah gelombang',1,8,2],['ang','Arah gelombang (60 = miring naik, 90 = naik turun, minus = dibalik)',-90,90,60],['blr','Kekuatan kabur',0,100,60],['tl','Ukuran ubin cermin',30,120,60],['tilt','Kemiringan ubin (derajat)',-60,60,-28]],
    apply:wspin};
  APK.fxclip.LIST.push(entry);APK.fxclip.DEF[entry.id]=entry;
})();
