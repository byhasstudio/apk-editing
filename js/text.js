/* Klip teks / judul: data default dan penggambaran ke canvas (dengan gradien dan bayangan) */
window.APK=window.APK||{};
APK.text=(function(){
  const FONTS=[['Sans-serif','Arial, Helvetica, sans-serif'],['Serif','Georgia, "Times New Roman", serif'],['Monospace','"Courier New", monospace'],['Impact (judul tebal)','Impact, "Arial Black", sans-serif'],['Tulisan tangan','"Comic Sans MS", "Segoe Script", cursive'],['Membulat','"Trebuchet MS", Verdana, sans-serif']];
  const DEF={content:'Teks',font:FONTS[0][1],size:96,bold:true,italic:false,color:'#ffffff',stroke:'#000000',strokeW:0,bgOn:false,bg:'#000000',align:'center',
    gradOn:false,color2:'#ff6b6b',gradAngle:90,shadowOn:false,shadowColor:'#000000',shadowBlur:12,shadowX:4,shadowY:4};
  const make=()=>({...DEF});
  /* pr = properti hasil keyframe (x, y, scale, opacity, rotation). Mengembalikan ukuran kotak teks (sebelum scale). */
  function draw(ctx,c,pr,W,H){
    const tx=Object.assign({},DEF,c.text),lines=String(tx.content).split('\n'),fx=APK.fx;
    const m=ctx.getTransform(),K0=Math.hypot(m.a,m.b)||1;
    ctx.save();
    ctx.globalAlpha=Math.min(1,Math.max(0,pr.opacity));
    ctx.globalCompositeOperation=c.blend||'source-over';
    const s=Math.max(0,pr.scale),kk=K0*s;APK.layers.xf(ctx,c,pr,W,H,s);
    ctx.font=`${tx.italic?'italic ':''}${tx.bold?'bold ':''}${tx.size}px ${tx.font}`;
    ctx.textBaseline='middle';ctx.textAlign=tx.align;
    const lh=tx.size*1.25,th=lh*lines.length,pad=tx.size*.3;
    let mw=0;for(const l of lines)mw=Math.max(mw,ctx.measureText(l).width);
    const ax=tx.align==='left'?-mw/2:tx.align==='right'?mw/2:0;
    const fillSt=tx.gradOn?fx.grad(ctx,tx.color,tx.color2,tx.gradAngle,mw/2,th/2):tx.color;
    if(tx.bgOn){fx.shadow(ctx,tx.shadowOn,tx,kk);ctx.fillStyle=tx.bg;ctx.fillRect(-mw/2-pad,-th/2-pad*.5,mw+pad*2,th+pad);fx.shadow(ctx,false,tx,kk)}
    ctx.lineJoin='round';
    const sOn=tx.shadowOn&&!tx.bgOn,st=tx.strokeW>0;
    lines.forEach((l,i)=>{
      const y=-th/2+lh*(i+.5);
      if(st){fx.shadow(ctx,sOn,tx,kk);ctx.lineWidth=tx.strokeW;ctx.strokeStyle=tx.stroke;ctx.strokeText(l,ax,y);fx.shadow(ctx,false,tx,kk)}
      fx.shadow(ctx,sOn&&!st,tx,kk);ctx.fillStyle=fillSt;ctx.fillText(l,ax,y);fx.shadow(ctx,false,tx,kk);
    });
    ctx.restore();
    return{w:mw+(tx.bgOn?pad*2:0),h:th+(tx.bgOn?pad:0)};
  }
  return{FONTS,DEF,make,draw};
})();
