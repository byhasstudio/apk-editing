/* Perbaikan performa efek (dimuat paling akhir, setelah js/fxclip.js dan js/fxlib.js).
   Gelombang dan Gelombang Balik: versi lama menggambar ratusan strip dengan clip() miring per frame (sangat berat).
   Versi ini memutar gambar SATU kali ke kanvas bantu sehingga arah simpangan menjadi mendatar, menggeser strip mendatar
   tanpa clip (drawImage potongan biasa), lalu memutar balik SATU kali. Rumus gelombangnya sama (amplitudo, jumlah gelombang, fase, arah, kecepatan).
   Bonus: zoom dihitung dari gambar utuh (tidak terpotong tepi kanvas), jadi geseran tidak membuka tepi kosong. */
window.APK=window.APK||{};
(function(){
  if(!APK.fxclip||!APK.fxclip.DEF)return;
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
  function waveFx(dir){
    return function(g,w,h,p,tm,opaque,rel,dur){
      /* kekuatan sepanjang clip: diam sebentar, naik pelan, lalu mereda (sama dengan versi lama) */
      let env=1;
      if(dur>0){
        const u=Math.min(1,rel/dur),a=p.atk/100,s0=a*0.15,rise=a*0.45,pk=s0+rise;
        if(u<s0)env=0;
        else if(u<pk){const x=(u-s0)/rise;env=x*x*(3-2*x)}
        if(p.dec>0&&u>pk)env*=Math.exp(-((u-pk)/Math.max(1e-6,1-pk))*p.dec/100*5);
      }
      const A=p.amt/100*0.08*w*env;
      if(A<0.3)return;
      const ph=dir*rel*1.3*(p.spd/50),th=(p.ang||0)*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th);
      /* zoom dari tengah sebesar yang dibutuhkan supaya geseran terjauh tidak membuka tepi kosong */
      const z=1+2*A*Math.max(Math.abs(cs)/w,Math.abs(sn)/h);
      /* kanvas bantu Q: gambar diputar sebesar sudut (sumbu a = arah simpangan mendatar, sumbu b = urutan strip), lebar diberi margin sebesar simpangan maksimum */
      const Eu=Math.ceil(w*Math.abs(cs)+h*Math.abs(sn)),Ev=Math.ceil(w*Math.abs(sn)+h*Math.abs(cs));
      const m=Math.ceil(p.amt/100*0.08*w)+2,Wq=Math.ceil((Eu+2*m)/2)*2,Hq=Math.ceil(Ev/2)*2;
      const Q=ac('q',Wq,Hq),R=ac('r',Wq,Hq);
      Q.translate(Wq/2,Hq/2);Q.rotate(th);Q.scale(z,z);Q.translate(-w/2,-h/2);
      Q.drawImage(g.canvas,0,0);
      /* strip mendatar bergeser mengikuti sinus (fase berubah sepanjang sumbu b) */
      const st=Math.max(2,Math.round(Hq/260));
      for(let y=0;y<Hq;y+=st){
        const hh=Math.min(st+1,Hq-y),dx=dir*A*Math.sin(2*Math.PI*(p.cnt*(y+st/2)/Hq-ph));
        R.drawImage(Q.canvas,0,y,Wq,hh,dx,y,Wq,hh);   /* +1 supaya antar strip saling menimpa, tidak ada garis tipis */
      }
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      g.save();
      g.translate(w/2,h/2);g.rotate(-th);g.translate(-Wq/2,-Hq/2);
      g.drawImage(R.canvas,0,0);
      g.restore();
    };
  }
  for(const [id,dir] of [['wave',1],['wave2',-1]]){
    const e=APK.fxclip.DEF[id];
    if(e)e.apply=waveFx(dir);
  }
})();
