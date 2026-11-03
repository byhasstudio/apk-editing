/* Efek klip: chroma key (hapus warna latar) dan mask bentuk, diproses di canvas perantara.
   Data per clip: clip.chroma = {on,color,sim,smooth} ; clip.mask = {on,type,x,y,w,h,feather,invert} (satuan persen) */
window.APK=window.APK||{};
APK.fx=(function(){
  const MAXD=1280;
  const DEF={
    chroma:{on:false,color:'#00b140',sim:35,smooth:15},
    mask:{on:false,type:'ellipse',x:0,y:0,w:80,h:80,feather:0,invert:false}
  };
  let cv=null,g=null;
  const rgb=h=>{const n=parseInt(String(h).slice(1),16);return isFinite(n)?[n>>16&255,n>>8&255,n&255]:[0,177,64]};
  function layer(w,h){
    if(!cv){cv=document.createElement('canvas');g=cv.getContext('2d',{willReadFrequently:true})}
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,w,h);
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
  /* kembalikan canvas hasil olahan (chroma + mask) atau null bila clip tidak memakai efek */
  function process(el,w,h,c){
    const ck=c.chroma&&c.chroma.on,mk=c.mask&&c.mask.on;
    if(!ck&&!mk)return null;
    const sc=Math.min(1,MAXD/Math.max(w,h)),cw=Math.max(1,Math.round(w*sc)),ch=Math.max(1,Math.round(h*sc));
    const ctx=layer(cw,ch);
    try{
      ctx.drawImage(el,0,0,cw,ch);
      if(ck)key(ctx,cw,ch,Object.assign({},DEF.chroma,c.chroma));
      if(mk)mask(ctx,cw,ch,Object.assign({},DEF.mask,c.mask));
    }catch(_){return null}
    return cv;
  }
  return{DEF,process};
})();
