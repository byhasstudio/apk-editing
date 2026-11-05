/* Efek klip: chroma key (hapus warna latar), mask bentuk, serta bantuan gradien dan bayangan.
   Data per clip: clip.chroma = {on,color,sim,smooth} ; clip.mask = {on,type,x,y,w,h,feather,invert} (satuan persen)
   Perbaikan performa: kanvas olahan dipakai ulang per ukuran (tidak dialokasi ulang tiap frame), glitch memakai drawImage (bukan getImageData),
   pemisah RGB memakai operasi 32-bit tanpa alokasi baru, dan ukuran olahan dikecilkan saat preview diputar (export tetap penuh). */
window.APK=window.APK||{};
APK.fx=(function(){
  const MAXD=1280,MAXP=720;   /* MAXP = batas ukuran olahan saat preview diputar */
  const DEF={
    chroma:{on:false,color:'#00b140',sim:35,smooth:15},
    mask:{on:false,type:'ellipse',x:0,y:0,w:80,h:80,feather:0,invert:false}
  };
  const LE=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;   /* little-endian: urutan byte piksel R,G,B,A = bit rendah ke tinggi */
  const pool=new Map();
  let rgbBuf=null;
  const rgb=h=>{const n=parseInt(String(h).slice(1),16);return isFinite(n)?[n>>16&255,n>>8&255,n&255]:[0,177,64]};
  /* satu kanvas olahan per ukuran (maksimal 4 ukuran), jadi dua clip berukuran beda tidak saling mengubah ukuran kanvas tiap frame */
  function layer(w,h){
    const k=w+'x'+h;let o=pool.get(k);
    if(!o){
      if(pool.size>=4)pool.delete(pool.keys().next().value);
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      o={cv,g:cv.getContext('2d',{willReadFrequently:true}),tmp:null,tg:null};pool.set(k,o);
    }
    const g=o.g;
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
    return o;
  }
  /* jarak warna di bidang Cb/Cr supaya tidak terpengaruh terang gelapnya latar */
  function key(ctx,w,h,k){
    const img=ctx.getImageData(0,0,w,h),d=img.data,c=rgb(k.color);
    const kb=-0.1687*c[0]-0.3313*c[1]+0.5*c[2],kr=0.5*c[0]-0.4187*c[1]-0.0813*c[2];
    const s=Math.max(0,k.sim)/100,m=Math.max(0.5,k.smooth)/100,s2=s*s,e=s+m,e2=e*e;
    for(let i=0;i<d.length;i+=4){
      const r=d[i],gg=d[i+1],b=d[i+2];
      const db=-0.1687*r-0.3313*gg+0.5*b-kb,dr=0.5*r-0.4187*gg-0.0813*b-kr;
      const q=(db*db+dr*dr)/16384;
      if(q<=s2)d[i+3]=0;
      else if(q<e2)d[i+3]=d[i+3]*(Math.sqrt(q)-s)/m;
    }
    ctx.putImageData(img,0,0);
  }
  function mask(ctx,w,h,m){
    const mw=w*m.w/100,mh=h*m.h/100,cx=w/2+w*m.x/100,cy=h/2+h*m.y/100;
    const f=m.feather/100*Math.min(w,h)*0.25;
    ctx.save();
    ctx.globalCompositeOperation=m.invert?'destination-out':'destination-in';
    ctx.translate(cx,cy);
    if(f>0.5&&'filter' in ctx)ctx.filter='blur('+f+'px)';
    ctx.fillStyle='#000';
    APK.shapes.path(ctx,m.type,mw,mh,Math.min(mw,mh)*0.2);
    ctx.fill();
    ctx.restore();
  }
  /* pemisah RGB: merah dari piksel kanan, biru dari piksel kiri, hijau tetap */
  function rgbSplit(ctx,w,h,s){
    const img=ctx.getImageData(0,0,w,h),d=img.data;
    if(LE){
      const n=w*h,px=new Uint32Array(d.buffer,d.byteOffset,n);
      if(!rgbBuf||rgbBuf.length<n)rgbBuf=new Uint32Array(n);
      rgbBuf.set(px);
      const src=rgbBuf;
      for(let y=0;y<h;y++){
        const row=y*w;
        for(let x=0;x<w;x++){
          const i=row+x,c=src[i],cr=src[row+(x+s<w?x+s:w-1)],cb=src[row+(x-s>0?x-s:0)];
          let a=c>>>24;const a1=cr>>>24,a2=cb>>>24;
          if(a1>a)a=a1;if(a2>a)a=a2;
          px[i]=((a<<24)|(cb&0xFF0000)|(c&0xFF00)|(cr&0xFF))>>>0;
        }
      }
    }else{
      const src=new Uint8ClampedArray(d);
      for(let y=0;y<h;y++){
        const row=y*w*4;
        for(let x=0;x<w;x++){
          const i=row+x*4,ir=row+Math.min(w-1,x+s)*4,ib=row+Math.max(0,x-s)*4;
          d[i]=src[ir];d[i+2]=src[ib+2];
          d[i+3]=Math.max(src[i+3],src[ir+3],src[ib+3]);
        }
      }
    }
    ctx.putImageData(img,0,0);
  }
  /* efek piksel: glitch (potongan horizontal bergeser, acak stabil per 1/12 detik), pemisah RGB, dan vignette. f = clip.flt, tm = waktu (detik) */
  function pixelFx(ctx,w,h,f,tm,o){
    const gl=+f.glitch||0,rg=(+f.rgb||0)+gl*0.12,vg=+f.vig||0;
    if(gl>0){
      let seed=(Math.floor(tm*12)*2654435761)>>>0;
      const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
      /* salinan sementara: potongan digambar dari salinan ini (drawImage), tanpa membaca piksel ke CPU */
      if(!o.tmp){o.tmp=document.createElement('canvas');o.tmp.width=w;o.tmp.height=h;o.tg=o.tmp.getContext('2d',{willReadFrequently:true})}
      const tg=o.tg;tg.setTransform(1,0,0,1,0,0);tg.globalCompositeOperation='copy';tg.drawImage(ctx.canvas,0,0);tg.globalCompositeOperation='source-over';
      const n=Math.round(1+gl/100*9);
      for(let i=0;i<n;i++){
        const y0=Math.floor(rnd()*h),hh=Math.max(2,Math.floor((0.01+rnd()*0.08)*h)),dx=Math.round((rnd()-.5)*2*gl/100*w*0.18),hc=Math.min(hh,h-y0);
        if(hc<=0)continue;
        ctx.clearRect(0,y0,w,hc);
        ctx.drawImage(o.tmp,0,y0,w,hc,dx,y0,w,hc);
        ctx.drawImage(o.tmp,0,y0,w,hc,dx>0?dx-w:dx+w,y0,w,hc);   /* membungkus ke sisi lain, tanpa celah */
      }
    }
    if(rg>0.2)rgbSplit(ctx,w,h,Math.max(1,Math.round(rg*w/1280)));
    if(vg>0){
      const r=Math.hypot(w,h)/2,gr=ctx.createRadialGradient(w/2,h/2,r*0.35,w/2,h/2,r);
      gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,'+Math.min(1,vg/100)+')');
      ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);ctx.restore();
    }
  }
  /* kembalikan canvas hasil olahan (chroma + mask + efek piksel) atau null bila clip tidak memakai efek */
  function process(el,w,h,c){
    const ck=c.chroma&&c.chroma.on,mk=c.mask&&c.mask.on,f=c.flt,px=!!f&&(f.vig>0||f.rgb>0||f.glitch>0);
    if(!ck&&!mk&&!px)return null;
    const pv=APK.preview,lim=pv&&pv.playing&&!pv.exporting?MAXP:MAXD;
    const sc=Math.min(1,lim/Math.max(w,h)),cw=Math.max(1,Math.round(w*sc)),ch=Math.max(1,Math.round(h*sc));
    const o=layer(cw,ch),ctx=o.g;
    try{
      ctx.drawImage(el,0,0,cw,ch);
      if(ck)key(ctx,cw,ch,Object.assign({},DEF.chroma,c.chroma));
      if(mk)mask(ctx,cw,ch,Object.assign({},DEF.mask,c.mask));
      if(px)pixelFx(ctx,cw,ch,f,pv?pv.time:0,o);
    }catch(_){return null}
    return o.cv;
  }
  /* gradien linear dua warna untuk kotak berukuran 2*hw x 2*hh yang berpusat di (0,0); deg 0 = kiri ke kanan, 90 = atas ke bawah */
  function grad(ctx,c1,c2,deg,hw,hh){
    const a=deg*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a),r=Math.abs(dx*hw)+Math.abs(dy*hh)||1;
    const gr=ctx.createLinearGradient(-dx*r,-dy*r,dx*r,dy*r);
    gr.addColorStop(0,c1);gr.addColorStop(1,c2);
    return gr;
  }
  /* bayangan canvas tidak ikut transform, jadi ukurannya dikali k (skala canvas * skala objek) */
  function shadow(ctx,on,o,k){
    if(on){ctx.shadowColor=o.shadowColor;ctx.shadowBlur=o.shadowBlur*k;ctx.shadowOffsetX=o.shadowX*k;ctx.shadowOffsetY=o.shadowY*k}
    else{ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0}
  }
  return{DEF,process,grad,shadow};
})();
