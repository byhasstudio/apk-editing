/* Bentuk (shape) dan stiker emoji. Path bentuk juga dipakai oleh mask. */
window.APK=window.APK||{};
APK.shapes=(function(){
  const TYPES=[['rect','Persegi'],['rounded','Persegi membulat'],['ellipse','Lingkaran / elips'],['triangle','Segitiga'],['diamond','Belah ketupat'],['star','Bintang'],['heart','Hati']];
  const STICKERS=['😀','😂','🥰','😎','🤩','😭','😡','🤔','👍','👎','👏','🙏','🔥','⭐','❤️','💯','🎉','✨','👑','🌈','⚡','💥','🎵','🎬','📌','✅','❌','⚠️','➡️','⬅️','⬆️','⬇️','💬','🔔','📷','🎁'];
  const DEF={type:'rect',w:400,h:400,fillOn:true,fill:'#ff6b6b',stroke:'#ffffff',strokeW:0,radius:60,
    gradOn:false,fill2:'#4dabf7',gradAngle:90,shadowOn:false,shadowColor:'#000000',shadowBlur:16,shadowX:6,shadowY:6};
  const label=t=>(TYPES.find(x=>x[0]===t)||TYPES[0])[1];
  const make=type=>Object.assign({},DEF,{type:type||'rect'});
  /* path bentuk berpusat di (0,0) dengan lebar w dan tinggi h */
  function path(ctx,type,w,h,r){
    const x=-w/2,y=-h/2;
    ctx.beginPath();
    if(type==='ellipse'){ctx.ellipse(0,0,Math.abs(w)/2,Math.abs(h)/2,0,0,Math.PI*2)}
    else if(type==='rounded'){
      const q=Math.max(0,Math.min(r||0,Math.abs(w)/2,Math.abs(h)/2));
      ctx.moveTo(x+q,y);ctx.lineTo(x+w-q,y);ctx.arcTo(x+w,y,x+w,y+q,q);
      ctx.lineTo(x+w,y+h-q);ctx.arcTo(x+w,y+h,x+w-q,y+h,q);
      ctx.lineTo(x+q,y+h);ctx.arcTo(x,y+h,x,y+h-q,q);
      ctx.lineTo(x,y+q);ctx.arcTo(x,y,x+q,y,q);
    }
    else if(type==='triangle'){ctx.moveTo(0,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h)}
    else if(type==='diamond'){ctx.moveTo(0,y);ctx.lineTo(x+w,0);ctx.lineTo(0,y+h);ctx.lineTo(x,0)}
    else if(type==='star'){
      for(let i=0;i<10;i++){
        const a=-Math.PI/2+i*Math.PI/5,k=i%2?0.42:1,px=Math.cos(a)*k*w/2,py=Math.sin(a)*k*h/2;
        i?ctx.lineTo(px,py):ctx.moveTo(px,py);
      }
    }
    else if(type==='heart'){
      ctx.moveTo(0,h*0.5);
      ctx.bezierCurveTo(-w*0.7,h*0.1,-w*0.62,-h*0.6,0,-h*0.2);
      ctx.bezierCurveTo(w*0.62,-h*0.6,w*0.7,h*0.1,0,h*0.5);
    }
    else{ctx.rect(x,y,w,h)}
    ctx.closePath();
  }
  /* gambar klip bentuk; pr = properti hasil keyframe. Mengembalikan ukuran kotak bentuk (sebelum scale). */
  function draw(ctx,c,pr,W,H){
    const s=Object.assign({},DEF,c.shape),fx=APK.fx;
    const m=ctx.getTransform(),K0=Math.hypot(m.a,m.b)||1;
    ctx.save();
    ctx.globalAlpha=Math.min(1,Math.max(0,pr.opacity));
    ctx.globalCompositeOperation=c.blend||'source-over';
    ctx.translate(W/2+pr.x,H/2+pr.y);ctx.rotate(pr.rotation*Math.PI/180);
    const k=Math.max(0,pr.scale),kk=K0*k;ctx.scale(k*(c.flipX?-1:1),k*(c.flipY?-1:1));
    path(ctx,s.type,s.w,s.h,s.radius);
    if(s.fillOn){
      fx.shadow(ctx,s.shadowOn,s,kk);
      ctx.fillStyle=s.gradOn?fx.grad(ctx,s.fill,s.fill2,s.gradAngle,s.w/2,s.h/2):s.fill;
      ctx.fill();fx.shadow(ctx,false,s,kk);
    }
    if(s.strokeW>0){
      fx.shadow(ctx,s.shadowOn&&!s.fillOn,s,kk);
      ctx.lineWidth=s.strokeW;ctx.strokeStyle=s.stroke;ctx.lineJoin='round';ctx.stroke();
      fx.shadow(ctx,false,s,kk);
    }
    ctx.restore();
    return{w:s.w,h:s.h};
  }
  return{TYPES,STICKERS,DEF,label,make,path,draw};
})();
