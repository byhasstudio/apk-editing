/* Efek pintar: menganalisis clip langsung di perangkat (tanpa internet dan tanpa AI luar) lalu menyarankan 2 efek sederhana.
   Analisis: kecerahan dan kontras rata-rata frame, tingkat gerakan (selisih dua frame berdekatan), dan beat audio (lonjakan amplitudo dari APK.wave).
   Efek 1, Cerah otomatis : mengisi clip.flt.bright dan clip.flt.contrast (sistem filter di effects.js).
   Efek 2, Zoom beat      : membuat keyframe scale yang berdenyut tiap beat (sistem keyframe di keyframes.js). Kekuatan zoom dikurangi kalau clip sudah banyak bergerak.
   Sumber beat: audio di track audio yang menimpa clip, kalau tidak ada baru audio bawaan clip video itu sendiri.
   Tidak ada field baru di data project: hasilnya memakai flt dan kf yang sudah ada, jadi ikut tersimpan, bisa di-undo, dan ikut ter-export.
   Clip yang dipilih di timeline otomatis tercentang, clip lain bisa dicentang sendiri di daftar. */
window.APK=window.APK||{};
APK.smartfx=(function(){
  const $=id=>document.getElementById(id);
  const P=()=>APK.project&&APK.project.current;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const media=id=>{const p=P();return p?p.media.find(m=>m.id===id):null};
  const MAXBEAT=150;       /* batas denyut per clip supaya keyframe tidak membengkak */
  const MINGAP=0.28;       /* jarak minimum antar denyut (detik di timeline) */
  let dlg=null,results=[],token=0;
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}

  /* ===== daftar clip yang bisa dianalisis: video dan gambar di layer yang tidak terkunci ===== */
  function targets(){
    const p=P(),out=[];if(!p)return out;
    for(const tr of p.tracks){
      if(tr.locked||tr.kind==='audio')continue;
      for(const c of tr.clips){
        const m=c.mediaId&&media(c.mediaId);
        if(m&&(m.type==='video'||m.type==='image'))out.push({c,tr,m});
      }
    }
    return out;
  }
  function findClip(id){
    const p=P();if(!p)return null;
    for(const tr of p.tracks){const c=tr.clips.find(x=>x.id===id);if(c)return{c,tr}}
    return null;
  }

  /* ===== analisis visual (kecerahan, kontras, gerakan) ===== */
  function loadVideo(url){
    return new Promise((res,rej)=>{
      const v=document.createElement('video');
      v.muted=true;v.preload='auto';v.playsInline=true;
      const t=setTimeout(()=>rej(new Error('video terlalu lama dibuka')),15000);
      v.addEventListener('loadeddata',()=>{clearTimeout(t);res(v)},{once:true});
      v.addEventListener('error',()=>{clearTimeout(t);rej(new Error('format video tidak didukung browser'))},{once:true});
      v.src=url;
    });
  }
  function seek(v,t){
    return new Promise(res=>{
      if(Math.abs(v.currentTime-t)<0.001){res();return}
      let h=0;
      const done=()=>{clearTimeout(h);v.removeEventListener('seeked',done);res()};
      h=setTimeout(done,3000);
      v.addEventListener('seeked',done);
      v.currentTime=t;
    });
  }
  function grab(src,w,h,g){
    g.drawImage(src,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data,y=new Uint8Array(w*h);
    for(let i=0,j=0;i<d.length;i+=4,j++)y[j]=(d[i]*299+d[i+1]*587+d[i+2]*114)/1000;
    return y;
  }
  function meanStd(y){
    let s=0;for(let i=0;i<y.length;i++)s+=y[i];
    const m=s/y.length;let q=0;
    for(let i=0;i<y.length;i++){const d=y[i]-m;q+=d*d}
    return{mean:m,std:Math.sqrt(q/y.length)};
  }
  function diff(a,b){let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length}

  async function analyzeVisual(c,m){
    const url=await APK.media.getUrl(m.id);
    if(!url)throw new Error('file media tidak ditemukan');
    const W=64,cv=document.createElement('canvas');
    if(m.type==='image'){
      const im=new Image();
      await new Promise((ok,no)=>{im.onload=ok;im.onerror=()=>no(new Error('gambar gagal dibaca'));im.src=url});
      const H=Math.max(8,Math.round(W*im.naturalHeight/Math.max(1,im.naturalWidth)));
      cv.width=W;cv.height=H;
      const s=meanStd(grab(im,W,H,cv.getContext('2d',{willReadFrequently:true})));
      return{mean:s.mean,std:s.std,motion:null};
    }
    const v=await loadVideo(url);
    try{
      if(!v.videoWidth)throw new Error('frame video tidak terbaca');
      const H=Math.max(8,Math.round(W*v.videoHeight/v.videoWidth)),g=cv.getContext('2d',{willReadFrequently:true});
      cv.width=W;cv.height=H;
      const sp=c.speed||1,len=c.dur*sp,end=isFinite(v.duration)&&v.duration>0?v.duration-0.03:1e9;
      const N=clamp(Math.round(c.dur/2),3,6),means=[],stds=[],mot=[];
      for(let i=0;i<N;i++){
        const t0=clamp(c.in+len*(i+0.5)/N,0,end);
        await seek(v,t0);
        const y1=grab(v,W,H,g),s=meanStd(y1);
        means.push(s.mean);stds.push(s.std);
        const t1=Math.min(t0+0.12,c.in+len-0.02,end);
        if(t1>t0+0.03){await seek(v,t1);mot.push(diff(y1,grab(v,W,H,g)))}
      }
      return{mean:avg(means),std:avg(stds),motion:mot.length?avg(mot):null};
    }finally{v.removeAttribute('src');v.load()}
  }

  /* rekomendasi cerah otomatis. mean = rata-rata luma 0..255, std = sebaran luma (kontras). null = tidak perlu */
  function recBright(a){
    const T=120;let b=100,k=100;
    if(a.mean<T-18||a.mean>T+22)b=Math.round(clamp(100*Math.pow(T/Math.max(a.mean,8),0.5),80,150));
    if(a.std<45)k=Math.round(clamp(100+(50-a.std)*1.3,100,140));
    if(b===100&&k===100)return null;
    return{bright:b,contrast:k};
  }
  /* kekuatan zoom: makin banyak gerakan di clip, makin halus denyutnya */
  const ampFor=motion=>motion==null?0.11:Math.round(clamp(0.11-motion*0.006,0.04,0.11)*1000)/1000;

  /* ===== analisis beat audio ===== */
  function peaksFor(id){
    return new Promise(res=>{
      let n=0;
      const tick=()=>{const p=APK.wave.peaks(id);if(p)return res(p);if(++n>40)return res(null);setTimeout(tick,250)};
      tick();
    });
  }
  /* pk = puncak amplitudo ternormalisasi (R sampel per detik). Mengembalikan [{t (detik sumber), s (kekuatan 0..1)}] */
  function detectBeats(pk,R,from,to){
    const i0=Math.max(0,Math.floor(from*R)),i1=Math.min(pk.length,Math.ceil(to*R)),n=i1-i0;
    if(n<R)return[];
    const W=Math.round(R*0.5),sc=new Float32Array(n),pre=new Float64Array(n+1);
    for(let i=0;i<n;i++)pre[i+1]=pre[i]+pk[i0+i];
    let mx=0;
    for(let i=0;i<n;i++){
      const a=Math.max(0,i-W),cnt=i-a,m=cnt>0?(pre[i]-pre[a])/cnt:pk[i0+i];
      sc[i]=pk[i0+i]-m;if(sc[i]>mx)mx=sc[i];
    }
    if(mx<0.08)return[];
    const thr=clamp(mx*0.4,0.08,0.22),gap=Math.round(R*MINGAP),r=3,out=[];
    let last=-1e9;
    for(let i=0;i<n;i++){
      const v=sc[i];if(v<thr)continue;
      let top=true;
      for(let j=Math.max(0,i-r);j<=Math.min(n-1,i+r);j++)if(sc[j]>v){top=false;break}
      if(!top)continue;
      if(i-last<gap){if(out.length&&v>out[out.length-1].v){out[out.length-1]={t:(i0+i)/R,v};last=i}continue}
      out.push({t:(i0+i)/R,v});last=i;
    }
    return out.map(b=>({t:b.t,s:clamp(b.v/mx,0,1)}));
  }
  /* kandidat sumber beat: audio di track audio yang menimpa clip (paling lama menimpa dulu), lalu audio bawaan clip video */
  function audioSources(c,m){
    const p=P(),out=[];
    for(const tr of p.tracks){
      if(tr.kind!=='audio')continue;
      for(const a of tr.clips){
        if(!a.mediaId)continue;
        const ov=Math.min(c.start+c.dur,a.start+a.dur)-Math.max(c.start,a.start);
        if(ov>=1)out.push({a,ov});
      }
    }
    out.sort((x,y)=>y.ov-x.ov);
    const list=out.map(x=>x.a);
    if(m.type==='video'&&!list.includes(c))list.push(c);
    return list;
  }
  async function analyzeBeat(c,m){
    for(const a of audioSources(c,m)){
      const am=media(a.mediaId);if(!am||a.reverse)continue;
      const pk=await peaksFor(a.mediaId);if(!pk)continue;
      const sp=a.speed||1,t0=Math.max(c.start,a.start),t1=Math.min(c.start+c.dur,a.start+a.dur);
      if(t1-t0<1)continue;
      const bs=detectBeats(pk,APK.wave.RATE,a.in+(t0-a.start)*sp,a.in+(t1-a.start)*sp);
      const list=[];let lastRel=-1e9;
      for(const b of bs){
        const rel=a.start+(b.t-a.in)/sp-c.start;
        if(rel<0.02||rel>c.dur-0.1||rel-lastRel<MINGAP)continue;
        list.push({rel,s:b.s});lastRel=rel;
        if(list.length>=MAXBEAT)break;
      }
      if(list.length>=3)return{list,from:a===c?'audio bawaan clip':'audio '+am.name};
    }
    return null;
  }

  async function analyzeClip(c,m){
    const r={id:c.id,name:m.name,vis:null,bright:null,beat:null,brightWhy:'',beatWhy:'',err:''};
    try{
      r.vis=await analyzeVisual(c,m);
      r.bright=recBright(r.vis);
      if(!r.bright)r.brightWhy='Tidak perlu, pencahayaan dan kontras sudah pas.';
    }catch(e){r.err=e&&e.message||'analisis gagal';return r}
    if(APK.kf.animated(c,'scale')){r.beatWhy='Dilewati, properti scale clip ini sudah beranimasi.';return r}
    try{
      const b=await analyzeBeat(c,m);
      if(b)r.beat={list:b.list,from:b.from,amp:ampFor(r.vis.motion)};
      else r.beatWhy='Tidak ada beat yang jelas (clip tanpa audio, hening, atau musiknya rata).';
    }catch(e){r.beatWhy='Audio tidak bisa dianalisis.'}
    return r;
  }

  /* ===== menerapkan efek ke data clip ===== */
  function applyBright(c,r){
    c.flt=c.flt||{};
    if(r.bright===100)delete c.flt.bright;else c.flt.bright=r.bright;
    if(r.contrast===100)delete c.flt.contrast;else c.flt.contrast=r.contrast;
    if(!Object.keys(c.flt).length)delete c.flt;
  }
  /* tiap beat: scale naik cepat ke puncak lalu turun pelan ke ukuran dasar */
  function applyBeat(c,r){
    const K=APK.kf;
    if(K.animated(c,'scale'))return false;
    const b0=c.props&&c.props.scale!=null?c.props.scale:1,L=r.list;
    for(let i=0;i<L.length;i++){
      const rel=L[i].rel,next=i+1<L.length?L[i+1].rel:rel+1;
      const tp=Math.max(0,rel-0.05),te=Math.min(c.dur,rel+Math.min(0.22,(next-rel)*0.7));
      const pv=Math.round(b0*(1+r.amp*(0.6+0.4*L[i].s))*1000)/1000;
      K.setKey(c,'scale',tp,b0);K.setKey(c,'scale',rel,pv);K.setKey(c,'scale',te,b0);
    }
    if(c.kf&&c.kf.scale)for(const k of c.kf.scale)k.e='out';
    return true;
  }
  function applyAll(){
    const picks=[...dlg.querySelectorAll('[data-sf-fx]')].filter(i=>i.checked);
    if(!picks.length){toast('Belum ada efek yang dicentang');return}
    APK.history.record();
    let nb=0,nz=0;
    for(const el of picks){
      const sep=el.dataset.sfFx.indexOf(':'),kind=el.dataset.sfFx.slice(0,sep),id=el.dataset.sfFx.slice(sep+1);
      const r=results.find(x=>x.id===id),f=findClip(id);
      if(!r||!f)continue;
      if(kind==='b'&&r.bright){applyBright(f.c,r.bright);nb++}
      else if(kind==='z'&&r.beat&&applyBeat(f.c,r.beat))nz++;
    }
    APK.timeline.commit();
    close();
    const t=[];if(nb)t.push('Cerah otomatis di '+nb+' clip');if(nz)t.push('Zoom beat di '+nz+' clip');
    toast(t.length?t.join(', ')+'. Bisa di-undo (Ctrl+Z)':'Tidak ada efek yang diterapkan');
  }

  /* ===== tampilan dialog ===== */
  const body=()=>$('sf-body'),acts=()=>$('sf-actions');
  function close(){token++;if(dlg&&dlg.open)dlg.close()}
  function showPick(){
    token++;
    const list=targets(),on=new Set(APK.timeline.selectedIds());
    if(!list.length){
      body().innerHTML='<p class="sf-intro">Belum ada clip video atau gambar yang bisa dianalisis. Tambahkan media ke timeline dulu (layer yang terkunci tidak ikut).</p>';
      acts().innerHTML='<button class="btn" data-sf="close" type="button">Tutup</button>';
      return;
    }
    body().innerHTML='<p class="sf-intro">Aplikasi menganalisis kecerahan, gerakan, dan beat audio clip langsung di perangkatmu (tanpa internet), lalu menyarankan efek. Clip yang terpilih di timeline sudah dicentang, kamu bisa mencentang clip lain.</p><div class="sf-list">'+
      list.map(x=>`<label class="sf-chk"><input type="checkbox" data-sf-pick="${esc(x.c.id)}"${on.has(x.c.id)?' checked':''}><span><b>${esc(x.m.name)}</b><small>${esc(x.tr.name)} · ${mmss(x.c.start)} sampai ${mmss(x.c.start+x.c.dur)}</small></span></label>`).join('')+'</div>';
    acts().innerHTML='<button class="btn" data-sf="close" type="button">Tutup</button><button class="btn primary" data-sf="go" type="button">Analisis</button>';
  }
  function showProgress(i,n,name){
    body().innerHTML=`<p class="sf-intro">Menganalisis clip ${i+1} dari ${n}: ${esc(name)}</p><div class="ex-bar"><i style="width:${Math.round(i/n*100)}%"></i></div><p class="sf-intro">Biarkan tab tetap terbuka. Clip panjang atau file besar butuh beberapa detik.</p>`;
    acts().innerHTML='<button class="btn" data-sf="cancel" type="button">Batalkan</button>';
  }
  const lvl=m=>m==null?'gambar diam':m<2?'rendah':m<6?'sedang':'tinggi';
  const lum=v=>v<85?'gelap':v>165?'terang':'normal';
  function showResults(){
    const cards=results.map(r=>{
      if(r.err)return`<div class="sf-card"><b>${esc(r.name)}</b><p class="sf-no">Gagal dianalisis: ${esc(r.err)}</p></div>`;
      const v=r.vis;
      const stat=`Kecerahan ${Math.round(v.mean)}/255 (${lum(v.mean)}) · Gerakan ${lvl(v.motion)} · Beat ${r.beat?r.beat.list.length+' terdeteksi':'tidak ada'}`;
      const fb=r.bright
        ?`<label class="sf-chk"><input type="checkbox" data-sf-fx="b:${esc(r.id)}" checked><span><b>Cerah otomatis</b><small>Kecerahan ${r.bright.bright}%, kontras ${r.bright.contrast}%</small></span></label>`
        :`<p class="sf-no">Cerah otomatis: ${esc(r.brightWhy)}</p>`;
      const fz=r.beat
        ?`<label class="sf-chk"><input type="checkbox" data-sf-fx="z:${esc(r.id)}" checked><span><b>Zoom beat</b><small>${r.beat.list.length} denyut dari ${esc(r.beat.from)}, zoom sampai ${Math.round(r.beat.amp*100)}%. Keyframe scale dibuat otomatis.</small></span></label>`
        :`<p class="sf-no">Zoom beat: ${esc(r.beatWhy)}</p>`;
      return`<div class="sf-card"><b>${esc(r.name)}</b><small class="sf-stat">${stat}</small>${fb}${fz}</div>`;
    }).join('');
    body().innerHTML='<p class="sf-intro">Hasil analisis. Centang efek yang mau dipakai, lalu tekan Terapkan.</p><div class="sf-list">'+(cards||'<p class="sf-no">Tidak ada hasil.</p>')+'</div>';
    acts().innerHTML='<button class="btn" data-sf="back" type="button">Kembali</button><button class="btn primary" data-sf="apply" type="button">Terapkan</button>';
  }
  async function run(ids){
    const my=++token;results=[];
    for(let i=0;i<ids.length;i++){
      if(my!==token)return;
      const f=findClip(ids[i]),m=f&&media(f.c.mediaId);
      if(!f||!m)continue;
      showProgress(i,ids.length,m.name);
      results.push(await analyzeClip(f.c,m));
    }
    if(my!==token)return;
    showResults();
  }
  function open(){
    if(!P()||!dlg)return;
    showPick();
    if(!dlg.open)dlg.showModal();
  }
  function init(){
    const btn=$('tl-smart');dlg=$('dlg-smart');
    if(!btn||!dlg)return;
    btn.onclick=open;
    dlg.addEventListener('click',e=>{
      const b=e.target.closest('[data-sf]');if(!b)return;
      const a=b.dataset.sf;
      if(a==='close')close();
      else if(a==='cancel')showPick();
      else if(a==='back')showPick();
      else if(a==='apply')applyAll();
      else if(a==='go'){
        const ids=[...dlg.querySelectorAll('[data-sf-pick]')].filter(i=>i.checked).map(i=>i.dataset.sfPick);
        if(!ids.length){toast('Centang minimal satu clip dulu');return}
        run(ids);
      }
    });
    dlg.addEventListener('close',()=>{token++});
  }
  try{init()}catch(e){console.error('Efek pintar gagal dimuat',e)}
  return{open,detectBeats,recBright,ampFor,applyBright,applyBeat};
})();
