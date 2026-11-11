/* Efek clip tambahan: Gelombang CapCut (meniru efek gelombang di video referensi "gelombang capcut")
   Ciri yang diukur dari video referensi (detik 6 sampai 7,5):
   – strip horizontal digeser mengikuti gelombang sinus (miring/meliuk), kuat di tengah lalu mereda
   – seluruh gambar ikut goyang putar tipis (miring searah jarum jam lalu kembali), bukan cuma strip yang bergeser
   – tepi yang terbuka karena strip bergeser TIDAK diperbesar, tapi ditarik memanjang dari piksel tepi (garis tipis memanjang di sisi objek, mis. panah di kiri)
   Pola kekuatan sama dengan Gelombang biasa: diam sebentar, naik pelan sampai puncak, lalu mereda sampai akhir clip (mengikuti panjang clip).
   Parameter dasar sama seperti Gelombang dan Gelombang Balik (Kekuatan, Jumlah gelombang, Kecepatan, Arah, Awal pelan, Peredam),
   ditambah dua parameter khas efek ini: Goyang putar dan Tarik tepi.
   Dimuat setelah fxsplitmirror.js dan sebelum fxlib.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;

  /* kanvas bantu */
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

  /* gambar diberi bingkai m piksel di semua sisi; isi bingkai = piksel tepi yang ditarik memanjang (clamp ke tepi),
     jadi saat strip bergeser, bagian yang terbuka terisi garis memanjang seperti di video referensi */
  function pad(src,w,h,m){
    const P=ac('wc_p',w+2*m,h+2*m);
    P.drawImage(src,m,m);
    P.drawImage(src,0,0,1,h,0,m,m,h);
    P.drawImage(src,w-1,0,1,h,w+m,m,m,h);
    P.drawImage(src,0,0,w,1,m,0,w,m);
    P.drawImage(src,0,h-1,w,1,m,h+m,w,m);
    P.drawImage(src,0,0,1,1,0,0,m,m);
    P.drawImage(src,w-1,0,1,1,w+m,0,m,m);
    P.drawImage(src,0,h-1,1,1,0,h+m,m,m);
    P.drawImage(src,w-1,h-1,1,1,w+m,h+m,m,m);
    return P.canvas;
  }

  function wavecc(g,w,h,p,tm,opaque,rel,dur){
    /* kekuatan sepanjang clip: diam, naik pelan, lalu mereda (sama dengan Gelombang biasa) */
    let env=1;
    if(dur>0){
      const u=Math.min(1,rel/dur),a=p.atk/100,s0=a*0.15,rise=a*0.45,pk=s0+rise;
      if(u<s0)env=0;
      else if(u<pk){const x=(u-s0)/rise;env=x*x*(3-2*x)}
      if(p.dec>0&&u>pk)env*=Math.exp(-((u-pk)/Math.max(1e-6,1-pk))*p.dec/100*5);
    }
    const A=p.amt/100*0.08*w*env;
    const rotMax=p.rot*Math.PI/180*env;
    if(A<0.3&&rotMax<0.0005)return;
    const fast=!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);
    const sm=p.smr/100,spd=p.spd/50;
    const ph=rel*1.3*spd;
    const r=rotMax*Math.sin(2*Math.PI*rel*0.7*spd);          /* goyang putar: berayun pelan, searah lalu kembali */
    const deg=p.ang||0,th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th);
    const ux=cs,uy=-sn;
    /* zoom penutup tepi: untuk putaran selalu, untuk geseran gelombang hanya sebesar bagian yang tidak ditutup tarikan tepi */
    const cr=Math.abs(Math.cos(r))+Math.abs(Math.sin(r))*Math.max(w/h,h/w);
    const zw=1+2*A*(1-sm)*Math.max(Math.abs(ux)/w,Math.abs(uy)/h);
    const z=cr*zw;
    const S=ac('wc_s',w,h);S.drawImage(g.canvas,0,0);
    const Z=ac('wc_z',w,h);
    Z.translate(w/2,h/2);Z.rotate(r);Z.scale(z,z);Z.translate(-w/2,-h/2);Z.drawImage(S.canvas,0,0);
    const m=Math.ceil(A)+2,Pc=pad(Z.canvas,w,h,m);
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
    if(deg===0){
      /* ke samping: strip horizontal digeser kiri kanan */
      const st=Math.max(1,Math.round(h/(fast?180:320)));
      for(let y=0;y<h;y+=st){
        const hh=Math.min(st,h-y),dx=A*Math.sin(2*Math.PI*(p.cnt*(y+hh/2)/h-ph));
        g.drawImage(Pc,m-dx,y+m,w,hh,0,y,w,hh);
      }
      return;
    }
    /* miring atau naik turun: strip digeser sepanjang arah simpangan, fase berubah sepanjang arah tegak lurusnya */
    const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h);
    const st=Math.max(3,Math.round(Ev/(fast?120:180)));
    for(let v=-Ev/2;v<Ev/2;v+=st){
      const fr=(v+st/2+Ev/2)/Ev,dx=A*Math.sin(2*Math.PI*(p.cnt*fr-ph));
      g.save();
      g.translate(w/2,h/2);g.rotate(-th);
      g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();
      g.setTransform(1,0,0,1,0,0);
      g.drawImage(Pc,dx*ux-m,dx*uy-m);
      g.restore();
    }
  }

  const entry={
    id:'wavecc',
    name:'Gelombang CapCut',
    desc:'Gelombang meliuk + goyang putar tipis, tepi ditarik memanjang — seperti video referensi',
    len:1.6,
    params:[
      ['amt','Kekuatan',0,100,55],
      ['cnt','Jumlah gelombang',1,8,1],
      ['spd','Kecepatan',10,100,50],
      ['ang','Arah gelombang (0 = ke samping, 60 = miring naik, 90 = naik turun, minus = dibalik)',-90,90,0],
      ['atk','Awal pelan (0 = langsung kuat, makin besar makin lama diam dan naik pelan)',0,100,40],
      ['dec','Peredam (mereda sampai akhir clip, 0 = tetap kuat)',0,100,60],
      ['rot','Goyang putar (derajat, 0 = tanpa putar)',0,10,4],
      ['smr','Tarik tepi (0 = tepi ditutup zoom, 100 = tepi ditarik memanjang seperti video)',0,100,70]
    ],
    apply:wavecc
  };
  /* diletakkan tepat setelah Gelombang Balik di daftar efek */
  const i=F.LIST.findIndex(e=>e.id==='wave2');
  if(i>=0)F.LIST.splice(i+1,0,entry);else F.LIST.push(entry);
  F.DEF[entry.id]=entry;
})();
