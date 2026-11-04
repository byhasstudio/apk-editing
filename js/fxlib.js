/* Daftar efek di bilah kanan (tombol "Efek" di timeline), ala CapCut.
   Tiap kartu menampilkan foto atau video contoh yang memakai efek itu dan bergerak langsung (memakai media project kalau ada, kalau tidak gambar contoh bawaan).
   Ketuk kartu = tambahkan clip efek di posisi playhead (js/fxclip.js). Di layar kecil daftar ini jadi tab "Efek" di bawah. */
window.APK=window.APK||{};
APK.fxlib=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mq=window.matchMedia?matchMedia('(max-width:900px)'):{matches:false};
  const CW=240,CH=135;
  const imgs=new Map(),demos=[];
  let cards=[],raf=0,last=0;
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}

  /* gambar contoh bawaan, dibuat sekali lewat canvas (tanpa file gambar) */
  function demo(i){
    if(demos[i])return demos[i];
    const cv=document.createElement('canvas');cv.width=CW;cv.height=CH;
    const g=cv.getContext('2d');
    if(i===0){
      const sky=g.createLinearGradient(0,0,0,CH);sky.addColorStop(0,'#24124d');sky.addColorStop(0.6,'#e8590c');sky.addColorStop(1,'#ffd166');
      g.fillStyle=sky;g.fillRect(0,0,CW,CH);
      g.fillStyle='#fff3bf';g.beginPath();g.arc(CW*0.7,CH*0.55,CH*0.17,0,Math.PI*2);g.fill();
      g.fillStyle='#4a2d7a';g.beginPath();g.moveTo(0,CH);g.lineTo(0,CH*0.68);g.lineTo(CW*0.22,CH*0.45);g.lineTo(CW*0.42,CH*0.7);g.lineTo(CW*0.6,CH*0.52);g.lineTo(CW*0.8,CH*0.72);g.lineTo(CW,CH*0.6);g.lineTo(CW,CH);g.closePath();g.fill();
      g.fillStyle='#1d1040';g.beginPath();g.moveTo(0,CH);g.lineTo(0,CH*0.85);g.lineTo(CW*0.3,CH*0.7);g.lineTo(CW*0.55,CH*0.88);g.lineTo(CW*0.85,CH*0.74);g.lineTo(CW,CH*0.86);g.lineTo(CW,CH);g.closePath();g.fill();
    }else{
      const bg=g.createLinearGradient(0,0,0,CH);bg.addColorStop(0,'#0b1d4d');bg.addColorStop(1,'#4cc9f0');
      g.fillStyle=bg;g.fillRect(0,0,CW,CH);
      const hs=[0.5,0.7,0.4,0.85,0.55,0.65,0.45,0.78],bw=CW/hs.length;
      hs.forEach((v,k)=>{
        const x=k*bw,bh=CH*v;
        g.fillStyle=k%2?'#14213d':'#1b2a52';g.fillRect(x+2,CH-bh,bw-4,bh);
        g.fillStyle='#ffd166';
        for(let y=CH-bh+8;y<CH-6;y+=12)for(let xx=x+8;xx<x+bw-10;xx+=10)if((k*7+Math.floor(y)*3+Math.floor(xx))%3)g.fillRect(xx,y,4,5);
      });
    }
    return demos[i]=cv;
  }
  /* sumber pratinjau: thumbnail foto/video milik project (kartu bergantian memakainya), kalau kosong dua gambar contoh */
  function sources(){
    const p=P(),out=[];
    if(p)for(const m of p.media){
      if(!m.thumb||(m.type!=='image'&&m.type!=='video'))continue;
      let e=imgs.get(m.id);
      if(!e){const im=new Image();e={im,ok:false,type:m.type};im.onload=()=>{e.ok=true};im.src=m.thumb;imgs.set(m.id,e)}
      out.push(e);
    }
    return{list:out.length?out:[0,1].map(i=>({im:demo(i),ok:true,type:'demo'})),own:out.length>0};
  }
  const TAG={image:'Foto',video:'Video',demo:'Contoh'};

  function paint(c,tm){
    const g=c.g,s=c.src,w=CW,h=CH;
    g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
    g.fillStyle='#000';g.fillRect(0,0,w,h);
    if(s&&s.ok){
      const iw=s.im.naturalWidth||s.im.width,ih=s.im.naturalHeight||s.im.height;
      if(iw&&ih){const k=Math.max(w/iw,h/ih),dw=iw*k,dh=ih*k;g.drawImage(s.im,(w-dw)/2,(h-dh)/2,dw,dh)}
    }
    APK.fxclip.run(g,c.fx,tm,true);
  }
  function build(){
    const grid=$('fx-grid'),src=sources();
    grid.innerHTML=APK.fxclip.LIST.map(e=>`<button type="button" class="fx-card" data-fx="${e.id}" title="Tambahkan efek ${esc(e.name)} di posisi playhead"><canvas width="${CW}" height="${CH}"></canvas><span class="fx-tag"></span><span class="fx-add">+</span><b>${esc(e.name)}</b><small>${esc(e.desc)}</small></button>`).join('');
    cards=[...grid.querySelectorAll('.fx-card')].map((el,i)=>{
      const s=src.list[i%src.list.length];
      el.querySelector('.fx-tag').textContent=TAG[s.type]||'Contoh';
      return{el,g:el.querySelector('canvas').getContext('2d'),fx:{type:el.dataset.fx},src:s};
    });
    $('fx-note').textContent=src.own
      ?'Pratinjau memakai foto dan video dari project kamu. Ketuk efek untuk menambahkannya sebagai clip sendiri di posisi playhead.'
      :'Pratinjau memakai gambar contoh. Impor foto atau video agar pratinjau memakai media kamu. Ketuk efek untuk menambahkannya sebagai clip sendiri di posisi playhead.';
    for(const c of cards)paint(c,performance.now()/1000);
  }
  function tick(now){
    raf=0;
    const pl=$('panel-efek');
    if(!pl||pl.offsetParent===null)return;   /* panel tidak terlihat: animasi berhenti, jalan lagi saat dibuka */
    if(now-last>=40){last=now;for(const c of cards)paint(c,now/1000)}
    raf=requestAnimationFrame(tick);
  }
  const start=()=>{if(!raf){last=0;raf=requestAnimationFrame(tick)}};
  const stop=()=>{cancelAnimationFrame(raf);raf=0};

  const ed=()=>$('editor');
  const small=()=>mq.matches;
  const tabOn=tab=>document.querySelectorAll('#mtabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
  const isOpen=()=>small()?ed().dataset.tab==='efek':ed().dataset.right==='efek';
  function open(){
    if(!P())return;
    build();
    if(small()){ed().dataset.tab='efek';tabOn('efek')}else ed().dataset.right='efek';
    $('tl-fx').classList.add('on');start();
  }
  /* tutup daftar efek: kembali ke panel Properti (desktop) atau tab Timeline (layar kecil) */
  function close(){
    ed().removeAttribute('data-right');
    if(ed().dataset.tab==='efek'){ed().dataset.tab='timeline';tabOn('timeline')}
    $('tl-fx').classList.remove('on');stop();
  }

  function init(){
    $('tl-fx').onclick=()=>isOpen()?close():open();
    $('fx-close').onclick=close;
    $('fx-grid').addEventListener('click',e=>{
      const b=e.target.closest('[data-fx]');if(!b||!P())return;
      const c=APK.fxclip.add(b.dataset.fx);if(!c)return;
      const nm=APK.fxclip.label(c.fx);
      if(small()){close();toast('Efek '+nm+' ditambahkan di timeline. Ketuk clip efeknya untuk mengatur.')}
      else toast('Efek '+nm+' ditambahkan di timeline. Klik clip efeknya untuk mengatur dan memilih media yang terkena.');
    });
    /* tab bawah di layar kecil */
    $('mtabs').addEventListener('click',e=>{
      const b=e.target.closest('[data-tab]');if(!b)return;
      if(b.dataset.tab==='efek'){build();$('tl-fx').classList.add('on');start()}
      else{$('tl-fx').classList.remove('on');stop()}
    });
    /* memilih clip (di timeline atau di preview) membuka kembali panel Properti */
    const back=ok=>setTimeout(()=>{if(isOpen()&&!small()&&ok())close()},0);
    $('tl-content').addEventListener('pointerdown',e=>{if(e.target.closest('.clip'))back(()=>!!APK.timeline.selectedClip())});
    $('pv-gizmo').addEventListener('pointerdown',()=>back(()=>!!APK.timeline.selectedClip()));
    new MutationObserver(()=>{if(ed().hidden)close()}).observe(ed(),{attributes:true,attributeFilter:['hidden']});
  }
  try{init()}catch(e){console.error('Daftar efek gagal dimuat',e)}
  return{open,close,isOpen};
})();
