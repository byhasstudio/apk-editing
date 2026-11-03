/* Klip teks / judul: data default dan penggambaran ke canvas */
window.APK=window.APK||{};
APK.text=(function(){
  const FONTS=[['Sans-serif','Arial, Helvetica, sans-serif'],['Serif','Georgia, "Times New Roman", serif'],['Monospace','"Courier New", monospace'],['Impact (judul tebal)','Impact, "Arial Black", sans-serif'],['Tulisan tangan','"Comic Sans MS", "Segoe Script", cursive'],['Membulat','"Trebuchet MS", Verdana, sans-serif']];
  const DEF={content:'Teks',font:FONTS[0][1],size:96,bold:true,italic:false,color:'#ffffff',stroke:'#000000',strokeW:0,bgOn:false,bg:'#000000',align:'center'};
  const make=()=>({...DEF});
  /* pr = properti hasil keyframe (x, y, scale, opacity, rotation) */
  function draw(ctx,c,pr,W,H){
    const tx=Object.assign({},DEF,c.text),lines=String(tx.content).split('\n');
    ctx.save();
    ctx.globalAlpha=Math.min(1,Math.max(0,pr.opacity));
    ctx.globalCompositeOperation=c.blend||'source-over';
    ctx.translate(W/2+pr.x,H/2+pr.y);ctx.rotate(pr.rotation*Math.PI/180);
    const s=Math.max(0,pr.scale);ctx.scale(s*(c.flipX?-1:1),s*(c.flipY?-1:1));
    ctx.font=`${tx.italic?'italic ':''}${tx.bold?'bold ':''}${tx.size}px ${tx.font}`;
    ctx.textBaseline='middle';ctx.textAlign=tx.align;
    const lh=tx.size*1.25,th=lh*lines.length;
    let mw=0;for(const l of lines)mw=Math.max(mw,ctx.measureText(l).width);
    const ax=tx.align==='left'?-mw/2:tx.align==='right'?mw/2:0;
    if(tx.bgOn){const pad=tx.size*.3;ctx.fillStyle=tx.bg;ctx.fillRect(-mw/2-pad,-th/2-pad*.5,mw+pad*2,th+pad)}
    ctx.lineJoin='round';
    lines.forEach((l,i)=>{
      const y=-th/2+lh*(i+.5);
      if(tx.strokeW>0){ctx.lineWidth=tx.strokeW;ctx.strokeStyle=tx.stroke;ctx.strokeText(l,ax,y)}
      ctx.fillStyle=tx.color;ctx.fillText(l,ax,y);
    });
    ctx.restore();
  }
  return{FONTS,DEF,make,draw};
})();
