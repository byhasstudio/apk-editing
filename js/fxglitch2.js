/* Efek glitch layar penuh tambahan (js/fxclip.js menyediakan daftar efek; file ini menambahkan tiga efek ke dalamnya).
   Dimuat setelah js/fxpopflash.js dan sebelum js/fxlib.js. Semuanya mengolah SELURUH layar, muncul sebentar-sebentar, dan mengikuti panjang clip efek.

   – Glitch Blok Digital (glblok): kotak-kotak acak di seluruh layar bergeser, berubah jadi piksel kasar, atau berubah negatif, seperti file video rusak.
   – Glitch TV Rusak (gltv): layar seperti TV rusak: gulir vertikal, garis bergelombang, pecah warna, garis scan, bintik noise, dan kedip gelap.
   – Glitch Sobek Layar (gtear): layar sobek jadi beberapa pita besar yang bergeser jauh, ada garis sobekan terang dan kilat negatif sesaat.
   apply(g, w, h, p, tm, opaque, rel, dur): lihat penjelasan di js/fxclip.js. */
window.APK=window.APK||{};
(function(){
  const F=APK.fxclip;if(!F||!F.LIST||!F.DEF)return;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const bell=u=>Math.pow(Math.sin(Math.PI*clamp(u,0,1)),1.2);
  const rng=s=>{let a=(s>>>0)||1;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296}};
  const aux={};
  function ac(name,w,h){
    let g=aux[name];
    if(!g)g=aux[name]=document.createElement('canvas').getContext('2d');
    const cv=g.canvas;
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.imageSmoothingEnabled=true;
    g.clearRect(0,0,w,h);
    return g;
  }
  const reset=(g,w,h,opaque)=>{
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    if(opaque){g.fillStyle='#000';g.fillRect(0,0,w,h)}
  };
  /* kekuatan sepanjang clip: naik di awal dan turun di akhir, tapi tidak pernah mati total di tengah */
  const envOf=(rel,dur,floor)=>dur>0?Math.max(floor,bell(clamp(rel/dur,0,1))):1;

  /* ===== Glitch Blok Digital ===== */
  function glblok(g,w,h,p,tm,opaque,rel,dur){
    const k=Math.max(0.2,p.spd/50),rd=rng(Math.floor(tm*k*12)*130363+7);
    if(rd()>p.bst/100)return;
    const amt=p.amt/100*envOf(rel,dur,0.4);
    if(amt<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    const pxP=p.pix/100,inP=p.inv/100,hasF='filter' in g;
    for(let i=0;i<p.cnt;i++){
      const bw=Math.max(4,Math.floor((0.04+rd()*p.siz/100*0.4)*w)),bh=Math.max(4,Math.floor((0.02+rd()*p.siz/100*0.2)*h));
      const x=Math.floor(rd()*Math.max(1,w-bw)),y=Math.floor(rd()*Math.max(1,h-bh));
      const dx=Math.round((rd()-0.5)*2*amt*w*0.2),dy=Math.round((rd()-0.5)*2*amt*h*0.1),kind=rd();
      if(kind<pxP){
        /* piksel kasar: blok diperkecil lalu diperbesar tanpa dihaluskan */
        const sz=Math.max(2,Math.floor(bw/(4+Math.floor(rd()*8)))),tw=Math.max(1,Math.floor(bw/sz)),th=Math.max(1,Math.floor(bh/sz));
        const T=ac('px',tw,th);T.drawImage(S.canvas,x,y,bw,bh,0,0,tw,th);
        g.imageSmoothingEnabled=false;g.drawImage(T.canvas,0,0,tw,th,x+dx,y+dy,bw,bh);g.imageSmoothingEnabled=true;
      }else if(kind<pxP+inP&&hasF){
        g.save();g.filter='invert(1)';g.drawImage(S.canvas,x,y,bw,bh,x+dx,y+dy,bw,bh);g.restore();
      }else{
        g.drawImage(S.canvas,x,y,bw,bh,x+dx,y+dy,bw,bh);
      }
    }
  }

  /* ===== Glitch TV Rusak ===== */
  const pcache={};
  function scanPattern(g,per){
    let c=pcache[per];
    if(!c){c=document.createElement('canvas');c.width=1;c.height=per;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,1,Math.max(1,Math.floor(per/2)));pcache[per]=c}
    return g.createPattern(c,'repeat');
  }
  function gltv(g,w,h,p,tm,opaque,rel,dur){
    const A=p.amt/100*envOf(rel,dur,0.5);
    if(A<0.01)return;
    const k=Math.max(0.2,p.spd/50),rd=rng(Math.floor(tm*k*24)*9973+3);
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    /* gulir vertikal (kadang saja), disambung dari sisi seberang supaya tidak ada celah */
    const roll=rd()<p.rll/100*0.6?Math.round((rd()-0.5)*2*h*0.25*A):0,wy=roll>0?roll-h:roll+h;
    const R=ac('r',w,h);R.drawImage(S.canvas,0,roll);R.drawImage(S.canvas,0,wy);
    /* garis-garis bergelombang: tiap pita tipis digeser, kadang meloncat jauh */
    reset(g,w,h,opaque);
    const st=Math.max(2,Math.round(h/140)),wob=p.wob/100*A*w*0.02,m=wob*4;
    for(let y=0;y<h;y+=st){
      const hh=Math.min(st,h-y),dx=Math.sin(y*0.045+tm*18*k)*wob+(rd()<0.04?(rd()-0.5)*wob*6:0);
      g.drawImage(R.canvas,0,y,w,hh,dx-m,y,w+2*m,hh);
    }
    /* pecah warna */
    const ca=p.ca/100*A*w*0.008;
    if(ca>0.5){
      const T=ac('t',w,h),C=ac('c',w,h);
      C.drawImage(g.canvas,0,0);
      reset(g,w,h,opaque);
      g.globalCompositeOperation='lighter';
      for(const q of [['#f00',-ca],['#0f0',0],['#00f',ca]]){
        T.globalCompositeOperation='source-over';T.clearRect(0,0,w,h);
        T.drawImage(C.canvas,0,0);
        T.globalCompositeOperation='multiply';T.fillStyle=q[0];T.fillRect(0,0,w,h);
        T.globalCompositeOperation='destination-in';T.drawImage(C.canvas,0,0);
        g.drawImage(T.canvas,q[1],0);
      }
      g.globalCompositeOperation='source-over';
    }
    /* garis scan */
    if(p.sl>0){
      g.globalCompositeOperation='source-atop';g.globalAlpha=p.sl/100*0.35;
      g.fillStyle=scanPattern(g,Math.max(2,Math.round(h/180)*2));g.fillRect(0,0,w,h);
      g.globalAlpha=1;g.globalCompositeOperation='source-over';
    }
    /* bintik noise (dibuat kecil lalu diperbesar tanpa dihaluskan) */
    if(p.nz>0){
      const nw=Math.max(32,Math.min(192,w>>2)),nh=Math.max(18,Math.round(nw*h/w)),N=ac('n',nw,nh),id=N.createImageData(nw,nh),d=id.data;
      for(let i=0;i<d.length;i+=4){const v=(rd()*255)|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}
      N.putImageData(id,0,0);
      g.globalCompositeOperation='source-atop';g.globalAlpha=p.nz/100*0.22*A;g.imageSmoothingEnabled=false;
      g.drawImage(N.canvas,0,0,nw,nh,0,0,w,h);
      g.imageSmoothingEnabled=true;g.globalAlpha=1;g.globalCompositeOperation='source-over';
    }
    /* kedip gelap sesaat */
    if(rd()<0.14*p.flk/100){
      g.globalCompositeOperation='source-atop';g.fillStyle='rgba(0,0,0,'+((0.15+rd()*0.3)*A).toFixed(3)+')';g.fillRect(0,0,w,h);
      g.globalCompositeOperation='source-over';
    }
  }

  /* ===== Glitch Sobek Layar ===== */
  function gtear(g,w,h,p,tm,opaque,rel,dur){
    const k=Math.max(0.2,p.spd/50),rd=rng(Math.floor(tm*k*10)*65537+11);
    if(rd()>p.bst/100)return;
    const env=envOf(rel,dur,0.4),amt=p.amt/100*env;
    if(amt<0.01)return;
    const S=ac('s',w,h);S.drawImage(g.canvas,0,0);
    /* batas pita: posisi sobekan acak, diurutkan */
    const cuts=[0];
    for(let i=0;i<p.tr;i++)cuts.push(Math.floor(rd()*h));
    cuts.push(h);cuts.sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const y=cuts[i],hh=cuts[i+1]-y;
      if(hh<2)continue;
      const dx=Math.round((rd()-0.5)*2*amt*w*0.25),dy=Math.round((rd()-0.5)*2*amt*h*0.03);
      g.drawImage(S.canvas,0,y,w,hh,dx,y+dy,w,hh);
      g.drawImage(S.canvas,0,y,w,hh,dx>0?dx-w:dx+w,y+dy,w,hh);   /* sambungan dari sisi seberang, tanpa celah */
      if(i>0){g.fillStyle='rgba(255,255,255,'+(0.35*amt).toFixed(3)+')';g.fillRect(0,y+dy,w,Math.max(1,Math.round(h/540)))}
    }
    /* kilat negatif: seluruh layar dibalik warnanya sesaat */
    if(rd()<p.inv/100*0.35*env){
      g.globalCompositeOperation='difference';g.fillStyle='#fff';g.fillRect(0,0,w,h);
      g.globalCompositeOperation='source-over';
    }
  }

  const NEW=[
    {id:'glblok',name:'Glitch Blok Digital',desc:'Kotak-kotak acak di seluruh layar bergeser, jadi piksel kasar, atau berubah negatif',len:1,
      params:[
        ['amt','Kekuatan geser',0,100,60],
        ['cnt','Jumlah kotak',1,40,14],
        ['siz','Ukuran kotak maks',1,100,50],
        ['pix','Kotak jadi piksel kasar (%)',0,100,35],
        ['inv','Kotak jadi negatif (%)',0,100,15],
        ['spd','Kecepatan ganti pola',10,100,50],
        ['bst','Seberapa sering muncul (100 = terus)',0,100,75]],apply:glblok},
    {id:'gltv',name:'Glitch TV Rusak',desc:'Layar seperti TV rusak: gulir, garis bergelombang, pecah warna, garis scan, noise, kedip',len:1.2,
      params:[
        ['amt','Kekuatan',0,100,70],
        ['rll','Gulir vertikal (seberapa sering)',0,100,35],
        ['wob','Garis bergelombang',0,100,50],
        ['ca','Pecah warna',0,100,45],
        ['sl','Garis scan',0,100,50],
        ['nz','Noise bintik',0,100,40],
        ['flk','Kedip gelap',0,100,50],
        ['spd','Kecepatan',10,100,50]],apply:gltv},
    {id:'gtear',name:'Glitch Sobek Layar',desc:'Layar sobek jadi pita besar yang bergeser jauh, dengan garis sobekan dan kilat negatif',len:0.8,
      params:[
        ['amt','Kekuatan geser',0,100,70],
        ['tr','Jumlah sobekan',1,6,3],
        ['inv','Kilat negatif (seberapa sering)',0,100,40],
        ['spd','Kecepatan ganti pola',10,100,50],
        ['bst','Seberapa sering muncul (100 = terus)',0,100,70]],apply:gtear}
  ];
  for(const d of NEW)if(!F.DEF[d.id]){F.LIST.push(d);F.DEF[d.id]=d}
})();
