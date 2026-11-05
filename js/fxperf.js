/* Perbaikan performa efek Gelombang dan Gelombang Balik (menggantikan fungsi apply milik js/fxclip.js; dimuat setelahnya).
   Hasilnya sama persis. Bedanya: saat preview sedang diputar, jumlah strip gelombang dikurangi (jauh lebih ringan);
   saat export dan saat preview berhenti, jumlah strip tetap penuh. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.DEF)return;
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
      let env=1;
      if(dur>0){
        const u=Math.min(1,rel/dur),a=p.atk/100,s0=a*0.15,rise=a*0.45,pk=s0+rise;
        if(u<s0)env=0;
        else if(u<pk){const x=(u-s0)/rise;env=x*x*(3-2*x)}
        if(p.dec>0&&u>pk)env*=Math.exp(-((u-pk)/Math.max(1e-6,1-pk))*p.dec/100*5);
      }
      const A=p.amt/100*0.08*w*env;
      if(A<0.3)return;
      const fast=!!(APK.preview&&APK.preview.playing&&!APK.preview.exporting);
      const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
      const ph=dir*rel*1.3*(p.spd/50),deg=p.ang||0;
      const th=deg*Math.PI/180,sn=Math.sin(th),cs=Math.cos(th);
      const ux=cs,uy=-sn;
      /* gambar diperbesar dari tengah sebesar yang dibutuhkan supaya geseran terjauh tidak membuka tepi kosong */
      const z=1+2*A*Math.max(Math.abs(ux)/w,Math.abs(uy)/h);
      const Z=ac('z',w,h);
      Z.translate(w/2,h/2);Z.scale(z,z);Z.translate(-w/2,-h/2);Z.drawImage(S.canvas,0,0);
      const src=Z.canvas;
      g.clearRect(0,0,w,h);
      if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
      if(deg===0){
        /* ke samping: strip horizontal digeser kiri kanan */
        const st=Math.max(1,Math.round(h/(fast?180:320)));
        for(let y=0;y<h;y+=st){
          const hh=Math.min(st,h-y),dx=dir*A*Math.sin(2*Math.PI*(p.cnt*(y+hh/2)/h-ph));
          g.drawImage(src,0,y,w,hh,dx,y,w,hh);
        }
        return;
      }
      /* miring atau naik turun: strip digeser sepanjang arah simpangan, fase berubah sepanjang arah tegak lurusnya */
      const Ev=w*Math.abs(sn)+h*Math.abs(cs),R=Math.hypot(w,h);
      const st=Math.max(3,Math.round(Ev/(fast?120:180)));
      for(let v=-Ev/2;v<Ev/2;v+=st){
        const fr=(v+st/2+Ev/2)/Ev,dx=dir*A*Math.sin(2*Math.PI*(p.cnt*fr-ph));
        g.save();
        g.translate(w/2,h/2);g.rotate(-th);
        g.beginPath();g.rect(-R,v,2*R,st+1);g.clip();                /* +1 supaya antar strip saling menimpa, tidak ada garis tipis */
        g.setTransform(1,0,0,1,0,0);
        g.drawImage(src,dx*ux,dx*uy);
        g.restore();
      }
    };
  }
  for(const id of ['wave','wave2']){const d=F.DEF[id];if(d)d.apply=waveFx(id==='wave'?1:-1)}
})();
