/* Efek klip: chroma key (hapus warna latar), mask bentuk, serta bantuan gradien dan bayangan.
   Data per clip: clip.chroma = {on,color,sim,smooth} ; clip.mask = {on,type,x,y,w,h,feather,invert} (satuan persen)
   Performa (v20): resolusi olahan mengikuti ukuran kanvas yang sebenarnya (parameter lim), dan kanvas yang membaca piksel (CPU)
   dipisah dari kanvas yang hanya menggambar (GPU), jadi mask dan vignette saja tidak lagi memaksa jalur lambat. */
window.APK=window.APK||{};
APK.fx=(function(){
  const MAXD=1280;
  const DEF={
    chroma:{on:false,color:'#00b140',sim:35,smooth:15},
    mask:{on:false,type:'ellipse',x:0,y:0,w:80,h:80,feather:0,invert:false}
  };
  const cvs={},gs={};
  const rgb=h=>{const n=parseInt(String(h).slice(1),16);return isFinite(n)?[n>>16&255,n>>8&255,n&255]:[0,177,64]};
  /* cpu = true: kanvas yang sering dibaca pikselnya (getImageData); false: kanvas biasa yang dipercepat GPU */
  function layer(w,h,cpu){
    const k=cpu?'c':'g';
    if(!cvs[k]){cvs[k]=document.createElement('canvas');gs[k]=cvs[k].getContext('2d',cpu?{willReadFrequently:true}:{})}
    const cv=cvs[k],g=gs[k];
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    if('filter' in g)g.filter='none';
    g.clearRect(0,0,w,h);
    return g;
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
  /* efek piksel: glitch (potongan horizontal bergeser, acak stabil per 1/12 detik), pemisah RGB, dan vignette. f = clip.flt, tm = waktu (detik) */
  function pixelFx(ctx,w,h,f,tm){
    const gl=+f.glitch||0,rg=(+f.rgb||0)+gl*0.12,vg=+f.vig||0;
    if(gl>0){
      let seed=(Math.floor(tm*12)*2654435761)>>>0;
      const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
      const n=Math.round(1+gl/100*9);
      for(let i=0;i<n;i++){
        const y0=Math.floor(rnd()*h),hh=Math.max(2,Math.floor((0.01+rnd()*0.08)*h)),dx=Math.round((rnd()-.5)*2*gl/100*w*0.18),hc=Math.min(hh,h-y0);
        if(hc<=0)continue;
        const im=ctx.getImageData(0,y0,w,hc);ctx.clearRect(0,y0,w,hc);ctx.putImageData(im,dx,y0);ctx.putImageData(im,dx>0?dx-w:dx+w,y0);   /* membungkus ke sisi lain, tanpa celah */
      }
    }
    if(rg>0.2){
      const s=Math.max(1,Math.round(rg*w/1280)),img=ctx.getImageData(0,0,w,h),d=img.data,src=new Uint8ClampedArray(d);
      for(let y=0;y<h;y++){
        const row=y*w*4;
        for(let x=0;x<w;x++){
          const i=row+x*4,ir=row+Math.min(w-1,x+s)*4,ib=row+Math.max(0,x-s)*4;
          d[i]=src[ir];d[i+2]=src[ib+2];
          d[i+3]=Math.max(src[i+3],src[ir+3],src[ib+3]);
        }
      }
      ctx.putImageData(img,0,0);
    }
    if(vg>0){
      const r=Math.hypot(w,h)/2,gr=ctx.createRadialGradient(w/2,h/2,r*0.35,w/2,h/2,r);
      gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,'+Math.min(1,vg/100)+')');
      ctx.save();ctx.globalCompositeOperation='source-atop';ctx.fillStyle=gr;ctx.fillRect(0,0,w,h);ctx.restore();
    }
  }
  /* kembalikan canvas hasil olahan (chroma + mask + efek piksel) atau null bila clip tidak memakai efek.
     lim (opsional) = sisi terpanjang yang dibutuhkan (px kanvas); olahan tidak dibuat lebih besar dari itu */
  function process(el,w,h,c,lim){
    const ck=c.chroma&&c.chroma.on,mk=c.mask&&c.mask.on,f=c.flt,px=!!f&&(f.vig>0||f.rgb>0||f.glitch>0);
    if(!ck&&!mk&&!px)return null;
    const cap=Math.max(320,Math.min(MAXD,lim>0?lim:MAXD)),sc=Math.min(1,cap/Math.max(w,h)),cw=Math.max(1,Math.round(w*sc)),ch=Math.max(1,Math.round(h*sc));
    const cpu=!!ck||(!!f&&(f.rgb>0||f.glitch>0)),ctx=layer(cw,ch,cpu);
    try{
      ctx.drawImage(el,0,0,cw,ch);
      if(ck)key(ctx,cw,ch,Object.assign({},DEF.chroma,c.chroma));
      if(mk)mask(ctx,cw,ch,Object.assign({},DEF.mask,c.mask));
      if(px)pixelFx(ctx,cw,ch,f,APK.preview?APK.preview.time:0);
    }catch(_){return null}
    return cpu?cvs.c:cvs.g;
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
