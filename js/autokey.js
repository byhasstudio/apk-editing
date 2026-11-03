/* Mode kurva otomatis (auto-keyframe, rekam langsung).
   Alur: nyalakan tombol "Kurva otomatis" -> muncul tombol Mulai di preview -> hitung mundur 3 detik -> timeline (playhead) LANGSUNG BERJALAN sendiri
   dan mode REKAM aktif. Selama timeline berjalan, setiap kali objek digeser, di-zoom, atau diputar (di preview, atau lewat slider properti),
   gerakannya direkam otomatis sebagai keyframe di waktu yang sedang berjalan. Berhenti lewat tombol Berhenti, tombol pause, atau saat timeline sampai ujung.
   Keyframe hasil rekam memakai easing linear dan dijarangkan (maks sekitar 20 per detik) supaya gerakannya mulus dan datanya tidak membengkak.
   Saat sebuah properti pertama kali diberi keyframe di waktu > 0, nilai awalnya otomatis dikunci di awal clip supaya gerakan mulai dari posisi semula. */
window.APK=window.APK||{};
APK.autokey=(function(){
  const $=id=>document.getElementById(id);
  const MIN=0.05;                       /* jarak waktu minimum antar keyframe rekam (detik) */
  let on=false,state='idle',n=0,timer=0,watch=0;   /* state: idle | counting | rec */
  const last=new Map(),pend=new Map();
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}

  /* tulis keyframe. lin = true: easing linear (hasil rekam langsung) */
  function put(c,p,r,val,lin){
    const K=APK.kf;
    if(!K.animated(c,p)&&r>0.01){
      const base=c.props&&c.props[p]!=null?c.props[p]:K.DEF[p];
      K.setKey(c,p,0,base);
      if(lin){const a=c.kf[p];if(a&&a[0])a[0].e='linear'}
    }
    const made=K.setKey(c,p,r,val);
    if(lin){
      const a=c.kf&&c.kf[p];
      if(a&&a.length){let b=a[0];for(const k of a)if(Math.abs(k.t-r)<Math.abs(b.t-r))b=k;b.e='linear'}
    }
    return made;
  }
  /* set nilai properti p pada waktu relatif r sebagai keyframe. Mengembalikan true kalau ada keyframe baru.
     Saat timeline berjalan (merekam langsung), keyframe dijarangkan dan sisa gerakan terakhir ditulis lewat flush(). */
  function key(c,p,r,val){
    const live=!!(APK.preview&&APK.preview.playing);
    if(!live)return put(c,p,r,val,false);
    const id=c.id+':'+p,l=last.get(id);
    if(l!=null&&r>=l&&r-l<MIN){pend.set(id,{c,p,r,val});return false}
    pend.delete(id);last.set(id,r);
    return put(c,p,r,val,true);
  }
  /* tulis gerakan terakhir yang tertahan (dipanggil saat jari dilepas dan saat rekaman berhenti) */
  function flush(){
    for(const v of pend.values())put(v.c,v.p,v.r,v.val,true);
    pend.clear();last.clear();
  }

  function paint(){
    const el=$('auto-ui'),btn=$('tl-auto');
    if(btn)btn.classList.toggle('on',on);
    if(!el)return;
    el.classList.toggle('counting',on&&state==='counting');
    if(!on){el.hidden=true;el.innerHTML='';return}
    el.hidden=false;
    if(state==='idle')el.innerHTML='<span class="au-t">Kurva otomatis aktif</span><button class="btn primary" data-au="start">▶ Mulai</button><button class="btn" data-au="off">Tutup</button>';
    else if(state==='counting')el.innerHTML='<span class="au-big">'+n+'</span><span class="au-t">Bersiap, timeline segera berjalan…</span><button class="btn" data-au="cancel">Batal</button>';
    else el.innerHTML='<span class="au-rec">● MEREKAM</span><span class="au-t">Timeline berjalan. Geser, zoom, atau putar objek: gerakannya direkam</span><button class="btn danger" data-au="stop">■ Berhenti</button>';
  }
  const stopTimers=()=>{clearInterval(timer);timer=0;clearInterval(watch);watch=0};
  function setOn(v){
    if(v&&!APK.project.current)return;
    if(!v&&state==='rec'){stop(true)}
    on=!!v;state='idle';stopTimers();paint();
    if(on)toast('Kurva otomatis aktif. Tekan Mulai untuk merekam');
  }
  function beginRec(){
    if(!APK.preview||!APK.preview.duration){state='idle';paint();toast('Belum ada clip di timeline untuk direkam');return}
    state='rec';paint();
    APK.preview.play();
    toast('Merekam. Geser, zoom, atau putar objek');
    /* rekaman ikut berhenti kalau timeline berhenti (tombol pause atau sampai ujung) */
    watch=setInterval(()=>{if(state==='rec'&&!APK.preview.playing)stop()},250);
  }
  function start(){
    if(!on||state!=='idle')return;
    if(APK.preview&&APK.preview.pause)APK.preview.pause();
    state='counting';n=3;paint();
    timer=setInterval(()=>{
      n--;
      if(n<=0){stopTimers();beginRec()}
      else paint();
    },1000);
  }
  function stop(quiet){
    stopTimers();
    const was=state==='rec';
    if(was){flush();if(APK.preview&&APK.preview.playing)APK.preview.pause();if(APK.timeline&&APK.timeline.commit)APK.timeline.commit()}
    state='idle';paint();
    if(was&&!quiet)toast('Rekaman berhenti. Keyframe sudah tersimpan di clip');
  }

  function init(){
    const btn=$('tl-auto'),ui=$('auto-ui');
    if(!btn||!ui)return;
    btn.onclick=()=>setOn(!on);
    ui.addEventListener('click',e=>{
      const b=e.target.closest('[data-au]');if(!b)return;
      const a=b.dataset.au;
      if(a==='start')start();
      else if(a==='stop')stop();
      else if(a==='cancel')stop(true);
      else if(a==='off')setOn(false);
    });
    const back=$('btn-back');if(back)back.addEventListener('click',()=>setOn(false));
    paint();
  }
  init();
  return{key,flush,start,stop,setOn,
    get enabled(){return on},
    get state(){return state},
    get recording(){return on&&state==='rec'&&!!APK.project.current}};
})();
