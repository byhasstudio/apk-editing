/* UI tambahan: aktifkan gizmo preview, mode Sederhana/Lanjutan, tooltip, tutorial pertama kali, export frame PNG */
(function(){
  const $=id=>document.getElementById(id);
  const LS=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(_){return null}};
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),2200)}

  if(APK.gizmo)APK.gizmo.init();

  /* ===== Mode Sederhana / Lanjutan: elemen berkelas .adv disembunyikan di mode Sederhana ===== */
  function setMode(simple,quiet){
    document.body.classList.toggle('mode-simple',simple);
    const b=$('btn-mode');
    b.textContent=simple?'Mode: Sederhana':'Mode: Lanjutan';
    b.title=simple?'Fitur rumit sedang disembunyikan. Klik untuk menampilkan semua fitur':'Klik untuk menyembunyikan fitur rumit (chroma, mask, kurva bezier, blend, gradien, dll)';
    LS('apk.mode',simple?'simple':'adv');
    if(!quiet)toast(simple?'Mode Sederhana: fitur rumit disembunyikan':'Mode Lanjutan: semua fitur tampil');
  }
  $('btn-mode').onclick=()=>setMode(!document.body.classList.contains('mode-simple'));
  setMode(LS('apk.mode')==='simple',true);

  /* ===== Export frame saat ini sebagai PNG (gizmo tidak ikut karena digambar di canvas terpisah) ===== */
  $('btn-png').onclick=()=>{
    const p=APK.project.current;if(!p)return;
    APK.preview.pause();
    $('pv-canvas').toBlob(b=>{
      if(!b){toast('Gagal membuat PNG');return}
      const a=document.createElement('a');
      a.href=URL.createObjectURL(b);
      a.download=(p.name||'frame')+'-'+APK.preview.fmt(APK.preview.time).replace(/[:.]/g,'-')+'.png';
      a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      toast('Frame disimpan sebagai PNG');
    },'image/png');
  };

  /* ===== Tooltip untuk semua elemen ber-title (juga yang dibuat dinamis). Di layar sentuh: tahan sebentar. ===== */
  const tip=document.createElement('div');tip.id='tip';document.body.appendChild(tip);
  let timer=0,cur=null;
  function showTip(el){
    const txt=el.dataset.tip;if(!txt||!el.isConnected)return;
    tip.textContent=txt;tip.classList.add('show');
    const r=el.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
    const x=Math.min(Math.max(8,r.left+r.width/2-w/2),innerWidth-w-8);
    let y=r.bottom+8;if(y+h>innerHeight-8)y=r.top-h-8;
    tip.style.left=x+'px';tip.style.top=Math.max(8,y)+'px';
  }
  function hideTip(){clearTimeout(timer);tip.classList.remove('show');cur=null}
  document.addEventListener('pointerover',e=>{
    const el=e.target.closest&&e.target.closest('[title],[data-tip]');
    if(!el||el===cur||el===tip)return;
    if(el.hasAttribute('title')){
      el.dataset.tip=el.getAttribute('title');el.removeAttribute('title');
      if(el.tagName==='BUTTON'&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',el.dataset.tip);
    }
    cur=el;clearTimeout(timer);
    timer=setTimeout(()=>{if(cur===el)showTip(el)},e.pointerType==='touch'?450:350);
  });
  document.addEventListener('pointerout',e=>{if(cur&&!cur.contains(e.relatedTarget))hideTip()});
  document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')hideTip()},true);
  document.addEventListener('scroll',hideTip,true);

  /* ===== Tutorial singkat (otomatis sekali saat pertama membuka editor; buka lagi lewat tombol ?) ===== */
  const STEPS=[
    ['Selamat datang di APK EDITING','Editor video di browser. Alurnya: impor media, susun di timeline, atur dan animasikan, lalu export. Panduan ini muncul sekali saja; buka lagi kapan pun lewat tombol ?.'],
    ['1. Impor media','Klik Import di panel Media atau seret file ke jendela. Klik media untuk menaruhnya di timeline, atau seret ke posisi yang kamu mau.'],
    ['2. Susun di timeline','Seret clip untuk memindah, tarik tepinya untuk memotong, tekan S untuk membelah clip di garis merah (playhead). Geser garis merah untuk melihat hasilnya di preview.'],
    ['3. Ubah objek langsung di preview','Klik objek di preview, lalu seret untuk menggeser. Tarik kotak di sudut untuk memperbesar atau memperkecil, dan tarik titik bulat di atasnya untuk memutar. Garis merah putus-putus menandakan titik tengah layar.'],
    ['4. Pilih banyak, salin, kunci','Tahan Shift atau Ctrl lalu klik clip (di ponsel: tombol Pilih banyak). Salin dan tempel dengan Ctrl+C / Ctrl+V atau tombol Salin / Tempel. Ikon gembok mengunci layer, ikon mata menyembunyikannya.'],
    ['5. Animasi dengan keyframe','Pilih clip, geser playhead, lalu klik ◇ di samping properti (misalnya Posisi X) di dua waktu berbeda. Di mode Lanjutan kamu bisa menarik kurva bezier untuk mengatur kecepatan geraknya.'],
    ['6. Export','Klik Export untuk video, atau PNG untuk menyimpan frame saat ini. Tombol Mode menyembunyikan atau menampilkan fitur rumit.']
  ];
  const dlg=document.createElement('dialog');dlg.id='dlg-help';
  dlg.innerHTML='<form method="dialog"><h3 id="hp-title"></h3><p id="hp-body" class="hp-body"></p><p class="meta" id="hp-step"></p><div class="dlg-actions"><button class="btn" id="hp-prev" type="button">Kembali</button><button class="btn" id="hp-close" value="cancel" formnovalidate>Tutup</button><button class="btn primary" id="hp-next" type="button">Lanjut</button></div></form>';
  document.body.appendChild(dlg);
  let step=0;
  function paint(){
    const s=STEPS[step];
    $('hp-title').textContent=s[0];$('hp-body').textContent=s[1];
    $('hp-step').textContent='Langkah '+(step+1)+' dari '+STEPS.length;
    $('hp-prev').disabled=step===0;
    $('hp-next').textContent=step===STEPS.length-1?'Selesai':'Lanjut';
  }
  function openHelp(){step=0;paint();if(!dlg.open)dlg.showModal()}
  $('hp-prev').onclick=()=>{if(step>0){step--;paint()}};
  $('hp-next').onclick=()=>{if(step<STEPS.length-1){step++;paint()}else dlg.close()};
  dlg.addEventListener('close',()=>LS('apk.tutorial','1'));
  $('btn-help').onclick=openHelp;
  new MutationObserver(()=>{
    if(!$('editor').hidden&&!LS('apk.tutorial'))setTimeout(()=>{if(!$('editor').hidden&&!dlg.open)openHelp()},350);
  }).observe($('editor'),{attributes:true,attributeFilter:['hidden']});
})();
