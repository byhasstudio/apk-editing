/* Sambungan clip + ikon transisi di timeline.
   Dua media (foto/video) yang bersebelahan di satu track dianggap tersambung. Di titik sambungannya muncul ikon kecil;
   ketuk ikon itu untuk memilih transisi (daftar efek bertanda cat:'transisi' dari js/fxtransisi.js).
   Transisi yang dipilih adalah clip efek biasa yang diletakkan tepat di TENGAH sambungan (setengah sebelum, setengah sesudah),
   jadi preview, export, undo/redo, dan simpan project memakai jalur yang sama dengan efek lain.
   Clip transisi diberi tautan c.seam={a,b,t} (id dua clip media dan waktu sambungan). Kalau dua clip itu digeser dan masih
   bersebelahan, clip transisi ikut bergeser sejauh perpindahan sambungan (posisi manual relatif ke sambungan tetap terjaga).
   Dimuat paling akhir, setelah js/timeline.js, js/fxclip.js, dan js/fxtransisi.js. */
window.APK=window.APK||{};
(function(){
  'use strict';
  const $=id=>document.getElementById(id),P=()=>APK.project&&APK.project.current;
  const GAP=0.12;          /* selisih maksimum (detik) antara akhir clip A dan awal clip B supaya dianggap tersambung */
  const MINPX=16;          /* clip yang lebih pendek dari ini (piksel) tidak diberi ikon, karena tidak muat */
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const F=()=>APK.fxclip,T=()=>APK.timeline;
  const isTr=c=>!!(c&&c.fx&&F()&&F().DEF[c.fx.type]&&F().DEF[c.fx.type].cat==='transisi');
  const ICON='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M3 6l8 6-8 6zM21 6l-8 6 8 6z" fill="currentColor"/></svg>';
  let pop=null,popSeam=null,busy=false;

  /* ===== mencari sambungan: pasangan clip media bersebelahan di track video/gambar yang sama ===== */
  function isMedia(c,p){
    if(!c||c.fx||!c.mediaId)return false;
    const m=p.media.find(x=>x.id===c.mediaId);
    return !!m&&(m.type==='image'||m.type==='video');
  }
  function seams(p){
    const out=[];
    for(const tr of p.tracks){
      if(tr.kind==='audio')continue;
      const cl=tr.clips.filter(c=>isMedia(c,p)).sort((a,b)=>a.start-b.start);
      for(let i=0;i<cl.length-1;i++){
        const a=cl[i],b=cl[i+1],end=a.start+a.dur,gap=b.start-end;
        if(gap>GAP||gap<-1e-6)continue;
        out.push({tr,a,b,t:(end+b.start)/2});
      }
    }
    return out;
  }
  function allTransitions(p){
    const out=[];
    for(const tr of p.tracks)for(const c of tr.clips)if(isTr(c))out.push({tr,c});
    return out;
  }
  /* transisi milik sambungan ini: yang tertaut ke dua clip itu, atau (kalau ditambah dari panel Efek tanpa tautan) yang bagian tengahnya tepat di sambungan */
  function findFor(p,s){
    const list=allTransitions(p);
    const linked=list.find(x=>x.c.seam&&x.c.seam.a===s.a.id&&x.c.seam.b===s.b.id);
    if(linked)return linked;
    return list.find(x=>!x.c.seam&&Math.abs(x.c.start+x.c.dur/2-s.t)<=0.15)||null;
  }

  /* ===== menjaga clip transisi tetap menempel ke sambungannya ===== */
  function follow(p){
    let moved=false;
    for(const x of allTransitions(p)){
      const k=x.c.seam;if(!k)continue;
      const a=find(p,k.a),b=find(p,k.b);
      if(!a||!b)continue;
      const gap=b.start-(a.start+a.dur);
      if(gap>GAP||gap<-1e-6)continue;
      const t=(a.start+a.dur+b.start)/2,d=t-k.t;
      if(Math.abs(d)<1e-3)continue;
      k.t=t;
      const ns=Math.max(0,x.c.start+d);
      if(x.tr.locked)continue;
      if(x.tr.clips.some(o=>o!==x.c&&ns<o.start+o.dur-1e-6&&ns+x.c.dur>o.start+1e-6))continue;
      x.c.start=ns;moved=true;
    }
    return moved;
  }
  function find(p,id){for(const tr of p.tracks){const c=tr.clips.find(x=>x.id===id);if(c)return c}return null}

  /* ===== menambah, mengganti, dan menghapus transisi ===== */
  function removeClip(p,x){
    x.tr.clips=x.tr.clips.filter(c=>c!==x.c);
    if(T().selected===x.c.id)T().select(null);
  }
  function setTransition(s,type){
    const p=P(),d=F()&&F().DEF[type];if(!p)return null;
    APK.history.record();
    const old=findFor(p,s);
    if(old)removeClip(p,old);
    if(!d){T().commit();return null}
    const dur=Math.max(0.2,Math.min(d.len||0.8,2*Math.min(s.a.dur,s.b.dur)));
    const start=Math.max(0,s.t-dur/2);
    const free=tr=>!tr.locked&&tr.kind==='video'&&!tr.clips.some(o=>start<o.start+o.dur-1e-6&&start+dur>o.start+1e-6);
    let tr=p.tracks[0];
    if(!tr||!free(tr)){
      tr={id:uid('t_'),kind:'video',name:'Video '+(p.tracks.filter(x=>x.kind==='video').length+1),muted:false,clips:[]};
      p.tracks.unshift(tr);
    }
    const c={id:uid('c_'),mediaId:null,start,in:0,dur,props:{x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},fx:{type},seam:{a:s.a.id,b:s.b.id,t:s.t}};
    tr.clips.push(c);
    T().commit();
    return c;
  }

  /* ===== ikon di timeline ===== */
  function paint(){
    const p=P(),root=$('tl-content');
    if(!p||!root||busy)return;
    if(follow(p)){busy=true;try{T().commit()}finally{busy=false}return}   /* commit menggambar ulang timeline lalu memanggil paint lagi lewat pengamat */
    const list=seams(p);
    for(const s of list){
      /* letak ikon dibaca dari clip yang sudah digambar, jadi tidak perlu tahu skala zoom timeline */
      const ea=root.querySelector('.clip[data-id="'+s.a.id+'"]'),eb=root.querySelector('.clip[data-id="'+s.b.id+'"]');
      const lane=root.querySelector('[data-lane="'+s.tr.id+'"]');
      if(!ea||!eb||!lane)continue;
      const aw=parseFloat(ea.style.width)||0,bw=parseFloat(eb.style.width)||0;
      if(Math.min(aw,bw)<MINPX)continue;
      const x=((parseFloat(ea.style.left)||0)+aw+(parseFloat(eb.style.left)||0))/2;
      const has=findFor(p,s),b=document.createElement('button');
      b.type='button';b.className='seam-btn'+(has?' on':'');
      b.dataset.a=s.a.id;b.dataset.b=s.b.id;
      b.style.left=x+'px';
      const nm=has?F().label(has.c.fx):'';
      b.title=has?'Transisi: '+nm+' (ketuk untuk mengganti)':'Tambah transisi di sambungan ini';
      b.setAttribute('aria-label',b.title);
      b.innerHTML=ICON;
      /* jangan sampai pointerdown mencapai handler timeline (yang akan membatalkan pilihan dan menggambar ulang sebelum klik selesai) */
      b.addEventListener('pointerdown',e=>e.stopPropagation());
      b.addEventListener('click',e=>{e.stopPropagation();openPicker(b,s.a.id,s.b.id)});
      lane.appendChild(b);
    }
    if(popSeam&&pop&&!list.some(s=>s.a.id===popSeam.a&&s.b.id===popSeam.b))closePicker();
  }
  /* ===== jendela pilih transisi ===== */
  function closePicker(){
    if(pop){pop.remove();pop=null}
    popSeam=null;
    document.removeEventListener('pointerdown',outside,true);
    document.removeEventListener('keydown',onKey,true);
  }
  const outside=e=>{if(pop&&!pop.contains(e.target)&&!e.target.closest('.seam-btn'))closePicker()};
  const onKey=e=>{if(e.key==='Escape')closePicker()};
  function current(aId,bId){
    const p=P();if(!p)return null;
    return seams(p).find(s=>s.a.id===aId&&s.b.id===bId)||null;
  }
  function openPicker(btn,aId,bId){
    const p=P(),s=current(aId,bId);
    if(!p||!s||!F())return;
    if(pop&&popSeam&&popSeam.a===aId&&popSeam.b===bId){closePicker();return}
    closePicker();
    popSeam={a:aId,b:bId};
    if(APK.preview&&APK.preview.seek)APK.preview.seek(s.t);
    const has=findFor(p,s),cur=has&&has.c.fx.type;
    const items=F().LIST.filter(e=>e.cat==='transisi');
    pop=document.createElement('div');
    pop.className='seam-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Pilih transisi');
    pop.innerHTML='<div class="seam-hd"><b>Transisi</b><button type="button" class="seam-x" data-close aria-label="Tutup">✕</button></div><div class="seam-list">'
      +(has?'<button type="button" class="seam-it none" data-none><b>Tanpa transisi</b><small>Hapus transisi di sambungan ini</small></button>':'')
      +items.map(e=>'<button type="button" class="seam-it'+(e.id===cur?' on':'')+'" data-fx="'+esc(e.id)+'"><b>'+esc(e.name)+'</b><small>'+esc(e.desc)+'</small></button>').join('')
      +'</div>'
      +(has?'<div class="seam-ft"><button type="button" class="seam-set" data-edit>Atur transisi</button></div>':'');
    document.body.appendChild(pop);
    place(btn);
    pop.addEventListener('click',e=>{
      if(e.target.closest('[data-close]')){closePicker();return}
      const sm=current(aId,bId);if(!sm){closePicker();return}
      if(e.target.closest('[data-none]')){setTransition(sm,null);closePicker();return}
      if(e.target.closest('[data-edit]')){
        const h=findFor(P(),sm);closePicker();
        if(h)T().select(h.c.id);
        return;
      }
      const b=e.target.closest('[data-fx]');if(!b)return;
      const c=setTransition(sm,b.dataset.fx);
      closePicker();
      if(c){
        T().select(c.id);
        const t=document.getElementById('toast');
        if(t){t.textContent='Transisi '+F().label(c.fx)+' dipasang di sambungan. Ketuk clipnya untuk mengatur.';t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2600)}
      }
    });
    document.addEventListener('pointerdown',outside,true);
    document.addEventListener('keydown',onKey,true);
  }
  /* letak jendela: di atas ikon (timeline ada di bagian bawah layar), dijaga tetap di dalam layar */
  function place(btn){
    const r=btn.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
    const w=Math.min(300,vw-16);
    pop.style.width=w+'px';
    let left=r.left+r.width/2-w/2;
    left=Math.max(8,Math.min(left,vw-w-8));
    pop.style.left=left+'px';
    const room=r.top-12,below=vh-r.bottom-12;
    if(room>=220||room>=below){pop.style.bottom=(vh-r.top+8)+'px';pop.style.maxHeight=Math.max(160,room-8)+'px'}
    else{pop.style.top=(r.bottom+8)+'px';pop.style.maxHeight=Math.max(160,below-8)+'px'}
  }

  function init(){
    const root=$('tl-content');if(!root)return;
    /* timeline mengganti isi #tl-content tiap kali digambar ulang: pasang ikon lagi setelahnya */
    new MutationObserver(()=>{try{paint()}catch(e){console.error('Ikon transisi gagal dipasang',e)}}).observe(root,{childList:true});
    try{paint()}catch(e){console.error('Ikon transisi gagal dipasang',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  APK.tlseam={seams:()=>P()?seams(P()):[],setTransition,closePicker};
})();
