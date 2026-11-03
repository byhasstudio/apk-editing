/* Mode kurva otomatis (auto-keyframe).
   Alur: nyalakan tombol "Kurva otomatis" -> muncul tombol Mulai di preview -> hitung mundur 3 detik -> mode REKAM.
   Selama REKAM, setiap kali objek digeser, di-zoom, atau diputar (di preview, atau lewat slider properti), keyframe dibuat otomatis
   di posisi playhead. Playhead tidak berjalan sendiri: geser playhead ke waktu lain lalu gerakkan objek lagi untuk keyframe berikutnya.
   Saat sebuah properti pertama kali diberi keyframe di waktu > 0, nilai awalnya otomatis dikunci di awal clip supaya gerakan mulai dari posisi semula. */
window.APK=window.APK||{};
APK.autokey=(function(){
  const $=id=>document.getElementById(id);
  let on=false,state='idle',n=0,timer=0;   /* state: idle | counting | rec */
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2800)}

  /* set nilai properti p pada waktu relatif r sebagai keyframe. Mengembalikan true kalau ada keyframe baru. */
  function key(c,p,r,val){
    const K=APK.kf;
    if(!K.animated(c,p)&&r>0.01){
      const base=c.props&&c.props[p]!=null?c.props[p]:K.DEF[p];
      K.setKey(c,p,0,base);
    }
    return K.setKey(c,p,r,val);
  }

  function paint(){
    const el=$('auto-ui'),btn=$('tl-auto');
    if(btn)btn.classList.toggle('on',on);
    if(!el)return;
    el.classList.toggle('counting',on&&state==='counting');
    if(!on){el.hidden=true;el.innerHTML='';return}
    el.hidden=false;
    if(state==='idle')el.innerHTML='<span class="au-t">Kurva otomatis aktif</span><button class="btn primary" data-au="start">▶ Mulai</button><button class="btn" data-au="off">Tutup</button>';
    else if(state==='counting')el.innerHTML='<span class="au-big">'+n+'</span><span class="au-t">Bersiap, merekam sebentar lagi…</span><button class="btn" data-au="cancel">Batal</button>';
    else el.innerHTML='<span class="au-rec">● MEREKAM</span><span class="au-t">Geser, zoom, atau putar objek: keyframe dibuat otomatis di playhead</span><button class="btn danger" data-au="stop">■ Berhenti</button>';
  }
  const stopTimer=()=>{clearInterval(timer);timer=0};
  function setOn(v){
    if(v&&!APK.project.current)return;
    on=!!v;state='idle';stopTimer();paint();
    if(on)toast('Kurva otomatis aktif. Tekan Mulai untuk merekam');
  }
  function start(){
    if(!on||state!=='idle')return;
    if(APK.preview&&APK.preview.pause)APK.preview.pause();
    state='counting';n=3;paint();
    timer=setInterval(()=>{
      n--;
      if(n<=0){stopTimer();state='rec';paint();toast('Merekam. Geser, zoom, atau putar objek')}
      else paint();
    },1000);
  }
  function stop(quiet){
    stopTimer();
    const was=state==='rec';
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
  return{key,start,stop,setOn,
    get enabled(){return on},
    get state(){return state},
    get recording(){return on&&state==='rec'&&!!APK.project.current}};
})();
