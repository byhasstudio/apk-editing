/* KONTROL LAYAR PENUH untuk preview editor 2D (tombol ⛶). Saat layar penuh muncul: tombol tutup (✕), play/pause, stop, mundur/maju 5 detik,
   bilah geser waktu dengan waktu berjalan, dan volume. Kontrol hilang sendiri setelah 3 detik tanpa sentuhan; ketuk layar untuk memunculkan lagi.
   Cara kerja: preview-wrap SELALU dibuat layar penuh lewat CSS (fixed, menutup seluruh layar) supaya kontrol pasti tampil di HP, APK, dan iOS
   (yang tidak punya requestFullscreen untuk elemen biasa), lalu mencoba layar penuh asli browser juga (menyembunyikan bilah alamat).
   Selama layar penuh, preview-wrap dipindah sementara ke <body> (tempatnya ditandai) supaya tidak terpengaruh transform/overflow induknya,
   dan dikembalikan saat ditutup. Mengendalikan APK.preview (play, pause, stop, seek) dan #pv-vol. Tombol Esc dan tombol kembali ikut menutup. */
window.APK=window.APK||{};
APK.fsctl=(function(){
  const $=id=>document.getElementById(id);
  let ui=null,on=false,ph=null,idle=0,tick=0,drag=false,wrap=null;
  const css=`#preview-wrap.fs-on{position:fixed!important;inset:0;z-index:2147482000;width:100vw!important;height:100vh!important;height:100dvh!important;border:0!important;border-radius:0!important;margin:0!important;background:#000}
#preview-wrap.fs-on #pv-gizmo,#preview-wrap.fs-on #auto-ui{display:none!important}
#preview-wrap .fs-ui{position:absolute;inset:0;display:none;z-index:5;color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
#preview-wrap.fs-on .fs-ui{display:block}
.fs-ui .fs-top,.fs-ui .fs-bot{position:absolute;left:0;right:0;display:flex;align-items:center;gap:10px;padding:10px 14px;transition:opacity .25s ease}
.fs-ui .fs-top{top:0;padding-top:calc(10px + env(safe-area-inset-top,0px));justify-content:flex-end;background:linear-gradient(rgba(0,0,0,.65),transparent)}
.fs-ui .fs-bot{bottom:0;padding-bottom:calc(12px + env(safe-area-inset-bottom,0px));flex-direction:column;align-items:stretch;gap:8px;background:linear-gradient(transparent,rgba(0,0,0,.75))}
.fs-ui.idle .fs-top,.fs-ui.idle .fs-bot{opacity:0;pointer-events:none}
.fs-ui button{appearance:none;border:0;background:rgba(255,255,255,.16);color:#fff;font-size:18px;min-width:46px;height:46px;border-radius:23px;padding:0 14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.fs-ui button:active{background:rgba(255,255,255,.34)}
.fs-ui button.fs-play{min-width:60px;height:60px;border-radius:30px;font-size:24px;background:#2bd67b;color:#04122a}
.fs-ui .fs-row{display:flex;align-items:center;gap:10px}
.fs-ui .fs-row.mid{justify-content:center;gap:14px}
.fs-ui input[type=range]{flex:1;min-width:0;accent-color:#2bd67b;height:28px;margin:0}
.fs-ui .fs-t{font-size:12px;opacity:.85;min-width:92px;text-align:right;font-variant-numeric:tabular-nums}
.fs-ui .fs-vol{width:110px;flex:none}`;
  function build(){
    if(ui)return;
    wrap=$('preview-wrap');if(!wrap)return;
    const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
    ui=document.createElement('div');ui.className='fs-ui';
    ui.innerHTML='<div class="fs-top"><button type="button" data-a="close" aria-label="Tutup layar penuh" title="Tutup layar penuh">✕</button></div>'
      +'<div class="fs-bot"><div class="fs-row"><input type="range" data-a="seek" min="0" max="1000" value="0" aria-label="Posisi video"><span class="fs-t" data-a="time">0:00 / 0:00</span></div>'
      +'<div class="fs-row mid"><button type="button" data-a="stop" aria-label="Stop" title="Stop, kembali ke awal">■</button><button type="button" data-a="back" aria-label="Mundur 5 detik" title="Mundur 5 detik">⏪ 5</button>'
      +'<button type="button" class="fs-play" data-a="play" aria-label="Putar atau jeda" title="Putar / jeda">▶</button>'
      +'<button type="button" data-a="fwd" aria-label="Maju 5 detik" title="Maju 5 detik">5 ⏩</button>'
      +'<input class="fs-vol" type="range" data-a="vol" min="0" max="1" step="0.05" value="1" aria-label="Volume"></div></div>';
    wrap.appendChild(ui);
    ui.addEventListener('click',function(e){
      const b=e.target.closest&&e.target.closest('[data-a]');
      if(!b){toggleBars();return}                                  /* ketuk area video: tampil/sembunyi kontrol */
      const a=b.dataset.a,P=APK.preview;wake();
      if(a==='close')exit();
      else if(a==='play')P.toggle();
      else if(a==='stop')P.stop();
      else if(a==='back')P.seek(P.time-5);
      else if(a==='fwd')P.seek(P.time+5);
      sync();
    });
    const seek=ui.querySelector('[data-a=seek]'),vol=ui.querySelector('[data-a=vol]');
    seek.addEventListener('input',function(){drag=true;wake();const P=APK.preview;P.seek(seek.value/1000*P.duration)});
    seek.addEventListener('change',function(){drag=false});
    vol.addEventListener('input',function(){wake();const v=$('pv-vol');if(v){v.value=vol.value;v.dispatchEvent(new Event('input',{bubbles:true}))}});
    ui.addEventListener('pointermove',function(e){if(e.pointerType==='mouse')wake()},{passive:true});   /* mouse digerakkan: kontrol muncul; sentuhan ditangani lewat ketukan */
  }
  const fmt=s=>{s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')};
  function sync(){
    if(!ui||!on)return;const P=APK.preview,d=P.duration||0;
    ui.querySelector('[data-a=play]').textContent=P.playing?'❚❚':'▶';
    ui.querySelector('[data-a=time]').textContent=fmt(P.time)+' / '+fmt(d);
    if(!drag){const s=ui.querySelector('[data-a=seek]');s.value=d>0?Math.round(P.time/d*1000):0}
  }
  function wake(){
    if(!ui)return;ui.classList.remove('idle');clearTimeout(idle);
    idle=setTimeout(function(){if(on&&!drag)ui.classList.add('idle')},3000);
  }
  function toggleBars(){
    if(!ui)return;
    if(ui.classList.contains('idle'))wake();else{ui.classList.add('idle');clearTimeout(idle)}
  }
  function enter(){
    build();if(!ui||on)return;on=true;
    ph=document.createComment('preview-wrap');wrap.parentNode.insertBefore(ph,wrap);document.body.appendChild(wrap);
    wrap.classList.add('fs-on');
    const v=$('pv-vol'),vv=ui.querySelector('[data-a=vol]');if(v)vv.value=v.value;
    try{const r=wrap.requestFullscreen||wrap.webkitRequestFullscreen;if(r){const p=r.call(wrap);if(p&&p.catch)p.catch(function(){})}}catch(e){}
    wake();sync();tick=setInterval(sync,100);
    try{window.dispatchEvent(new Event('resize'))}catch(e){}
  }
  function exit(){
    if(!on)return;on=false;clearInterval(tick);clearTimeout(idle);
    wrap.classList.remove('fs-on');
    if(ph&&ph.parentNode){ph.parentNode.insertBefore(wrap,ph);ph.remove()}ph=null;
    try{if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen();else if(document.webkitFullscreenElement&&document.webkitExitFullscreen)document.webkitExitFullscreen()}catch(e){}
    try{window.dispatchEvent(new Event('resize'))}catch(e){}
    if(APK.preview&&APK.preview.refresh)APK.preview.refresh();
  }
  const toggle=()=>on?exit():enter();
  function realChange(){   /* layar penuh asli ditutup lewat tombol kembali sistem: tutup juga yang buatan */
    if(on&&!document.fullscreenElement&&!document.webkitFullscreenElement&&realWas)exit();
    realWas=!!(document.fullscreenElement||document.webkitFullscreenElement);
  }
  let realWas=false;
  document.addEventListener('fullscreenchange',realChange);document.addEventListener('webkitfullscreenchange',realChange);
  document.addEventListener('keydown',function(e){if(on&&e.key==='Escape')exit()});
  return{toggle,enter,exit,get active(){return on}};
})();
