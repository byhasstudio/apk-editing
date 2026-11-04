/* Animasi cepat (satu klik): masuk, keluar, dan loop. Semuanya ditulis sebagai keyframe biasa di clip, jadi hasilnya
   tetap bisa digeser, diubah kurvanya, atau dihapus seperti keyframe buatan sendiri.
   Data penanda di clip: clip.anim = { in, out, loop, inD, outD, loopP, pin:[prop], pout:[prop], ploop:[prop] }
   Jendela waktu: masuk = [0, inD], keluar = [dur-outD, dur], loop = di antara keduanya (dibagi rata menjadi siklus utuh yang berakhir di posisi awal). */
window.APK=window.APK||{};
APK.anim=(function(){
  const K=()=>APK.kf,P=()=>APK.project.current;
  const EPS=1e-4,DEFD={in:0.6,out:0.6,loop:1};
  /* Setiap preset: (b = nilai properti saat diam, W, H) -> { properti: [[fraksi 0..1, nilai, easing], ...] }.
     easing pada sebuah key berlaku untuk ruas dari key itu ke key berikutnya. */
  const fadeIn=b=>[[0,0,'out'],[1,b.opacity]];
  const IN={
    fade:{l:'Memudar muncul',f:b=>({opacity:fadeIn(b)})},
    pop:{l:'Pop (membesar memantul)',f:b=>({scale:[[0,0,'back'],[1,b.scale]],opacity:[[0,0,'out'],[.35,b.opacity],[1,b.opacity]]})},
    zoom:{l:'Zoom masuk (dari besar)',f:b=>({scale:[[0,b.scale*2.2,'out'],[1,b.scale]],opacity:fadeIn(b)})},
    zoomsmall:{l:'Zoom masuk (dari kecil)',f:b=>({scale:[[0,b.scale*0.3,'out'],[1,b.scale]],opacity:fadeIn(b)})},
    slideL:{l:'Geser dari kiri',f:(b,W)=>({x:[[0,b.x-W,'out'],[1,b.x]],opacity:[[0,0,'out'],[.3,b.opacity],[1,b.opacity]]})},
    slideR:{l:'Geser dari kanan',f:(b,W)=>({x:[[0,b.x+W,'out'],[1,b.x]],opacity:[[0,0,'out'],[.3,b.opacity],[1,b.opacity]]})},
    slideU:{l:'Geser dari atas',f:(b,W,H)=>({y:[[0,b.y-H,'out'],[1,b.y]],opacity:[[0,0,'out'],[.3,b.opacity],[1,b.opacity]]})},
    slideD:{l:'Geser dari bawah',f:(b,W,H)=>({y:[[0,b.y+H,'out'],[1,b.y]],opacity:[[0,0,'out'],[.3,b.opacity],[1,b.opacity]]})},
    drop:{l:'Jatuh memantul',f:(b,W,H)=>({y:[[0,b.y-H*0.7,'bounce'],[1,b.y]],opacity:[[0,0,'out'],[.15,b.opacity],[1,b.opacity]]})},
    spin:{l:'Putar masuk',f:b=>({rotation:[[0,b.rotation-180,'out'],[1,b.rotation]],scale:[[0,0,'out'],[1,b.scale]],opacity:fadeIn(b)})},
    stretchX:{l:'Melebar dari tengah',f:b=>({sx:[[0,0,'back'],[1,b.sx]],opacity:fadeIn(b)})},
    stretchY:{l:'Meninggi dari tengah',f:b=>({sy:[[0,0,'back'],[1,b.sy]],opacity:fadeIn(b)})},
    skew:{l:'Miring lalu lurus',f:(b,W)=>({skx:[[0,45,'out'],[1,b.skx]],x:[[0,b.x-W*0.25,'out'],[1,b.x]],opacity:fadeIn(b)})}
  };
  const fadeOut=b=>[[0,b.opacity,'in'],[1,0]];
  const hold=(b,k)=>[[0,b.opacity],[k,b.opacity,'in'],[1,0]];
  const OUT={
    fade:{l:'Memudar hilang',f:b=>({opacity:fadeOut(b)})},
    pop:{l:'Pop (mengecil)',f:b=>({scale:[[0,b.scale,'in'],[1,0]],opacity:hold(b,.6)})},
    zoom:{l:'Zoom keluar (membesar)',f:b=>({scale:[[0,b.scale,'in'],[1,b.scale*2.2]],opacity:fadeOut(b)})},
    zoomsmall:{l:'Zoom keluar (mengecil)',f:b=>({scale:[[0,b.scale,'in'],[1,b.scale*0.3]],opacity:fadeOut(b)})},
    slideL:{l:'Geser ke kiri',f:(b,W)=>({x:[[0,b.x,'in'],[1,b.x-W]],opacity:hold(b,.7)})},
    slideR:{l:'Geser ke kanan',f:(b,W)=>({x:[[0,b.x,'in'],[1,b.x+W]],opacity:hold(b,.7)})},
    slideU:{l:'Geser ke atas',f:(b,W,H)=>({y:[[0,b.y,'in'],[1,b.y-H]],opacity:hold(b,.7)})},
    slideD:{l:'Geser ke bawah',f:(b,W,H)=>({y:[[0,b.y,'in'],[1,b.y+H]],opacity:hold(b,.7)})},
    drop:{l:'Jatuh ke bawah',f:(b,W,H)=>({y:[[0,b.y,'in'],[1,b.y+H*0.7]],opacity:hold(b,.6)})},
    spin:{l:'Putar keluar',f:b=>({rotation:[[0,b.rotation,'in'],[1,b.rotation+180]],scale:[[0,b.scale,'in'],[1,0]],opacity:fadeOut(b)})},
    stretchX:{l:'Menyempit ke tengah',f:b=>({sx:[[0,b.sx,'in'],[1,0]],opacity:fadeOut(b)})},
    stretchY:{l:'Memendek ke tengah',f:b=>({sy:[[0,b.sy,'in'],[1,0]],opacity:fadeOut(b)})},
    skew:{l:'Miring lalu hilang',f:(b,W)=>({skx:[[0,b.skx,'in'],[1,45]],x:[[0,b.x,'in'],[1,b.x+W*0.25]],opacity:fadeOut(b)})}
  };
  /* loop: pola satu siklus, fase 0..1, selalu mulai dan berakhir di posisi diam. per = pengali panjang siklus */
  const wave=(v0,a,ease)=>[[0,v0,ease||'inout'],[.25,v0-a,ease||'inout'],[.75,v0+a,ease||'inout'],[1,v0]];
  const LOOP={
    pulse:{l:'Denyut (membesar mengecil)',f:b=>({scale:[[0,b.scale,'inout'],[.5,b.scale*1.15,'inout'],[1,b.scale]]})},
    breathe:{l:'Napas (melebar meninggi bergantian)',f:b=>({sx:[[0,b.sx,'inout'],[.5,b.sx*1.07,'inout'],[1,b.sx]],sy:[[0,b.sy,'inout'],[.5,b.sy*0.93,'inout'],[1,b.sy]]})},
    sway:{l:'Goyang (putar kiri kanan)',f:b=>({rotation:wave(b.rotation,8)})},
    float:{l:'Melayang (naik turun pelan)',f:(b,W,H)=>({y:wave(b.y,H*0.025)})},
    bounce:{l:'Memantul',f:(b,W,H)=>({y:[[0,b.y,'out'],[.5,b.y-H*0.08,'in'],[1,b.y]]})},
    blink:{l:'Berkedip',f:b=>({opacity:[[0,b.opacity,'inout'],[.5,b.opacity*0.25,'inout'],[1,b.opacity]]})},
    shake:{l:'Getar (cepat)',per:0.15,f:b=>({x:wave(b.x,8,'linear')})},
    wobble:{l:'Miring goyang',f:b=>({skx:wave(b.skx,10)})},
    spin360:{l:'Berputar terus',f:b=>({rotation:[[0,b.rotation,'linear'],[1,b.rotation+360]]})}
  };
  const KINDS={in:IN,out:OUT,loop:LOOP};
  const LABEL={in:'Animasi masuk',out:'Animasi keluar',loop:'Animasi berulang (loop)'};

  const sel=()=>{const s=APK.timeline.selectedClip();return s&&!s.tr.locked?s:null};
  /* hapus keyframe di dalam jendela [t0,t1]. inclusive=false: batas t0 dan t1 dibiarkan (dipakai loop, karena kunci di batas
     adalah posisi diam yang juga dipakai animasi masuk/keluar di sebelahnya) */
  function cut(c,p,t0,t1,inclusive){
    const a=c.kf&&c.kf[p];if(!a)return;
    const m=inclusive===false?EPS:-EPS;
    c.kf[p]=a.filter(k=>k.t<t0+m||k.t>t1-m);
    if(!c.kf[p].length)delete c.kf[p];
    if(!Object.keys(c.kf).length)delete c.kf;
  }
  /* tambah keyframe; kalau sudah ada keyframe di waktu yang sama, diganti (hindari dua key di waktu sama = pembagian nol) */
  function put(c,p,keys){
    c.kf=c.kf||{};let a=c.kf[p]=c.kf[p]||[];
    for(const k of keys){
      const t=Math.round(k[0]*10000)/10000;
      a=c.kf[p]=a.filter(x=>Math.abs(x.t-t)>EPS);
      a.push({t,v:k[1],e:k[2]||'inout'});
    }
    a.sort((x,y)=>x.t-y.t);
  }
  /* jendela waktu (detik relatif clip) untuk satu jenis animasi */
  function win(c,kind){
    const a=c.anim||{},inD=a.in?a.inD:0,outD=a.out?a.outD:0;
    if(kind==='in')return[0,Math.min(a.inD||DEFD.in,c.dur*0.5)];
    if(kind==='out'){const d=Math.min(a.outD||DEFD.out,c.dur*0.5);return[c.dur-d,c.dur]}
    return[Math.min(inD,c.dur*0.5),c.dur-Math.min(outD,c.dur*0.5)];
  }
  /* hapus keyframe hasil animasi jenis ini dan kembalikan nilai diam */
  function clearOne(c,kind){
    const a=c.anim;if(!a||!a['p'+kind])return;
    const[t0,t1]=win(c,kind),rest=K().props(c,kind==='in'?t1:t0);
    c.props=Object.assign({},K().DEF,c.props);
    for(const p of a['p'+kind]){
      cut(c,p,t0,t1,kind!=='loop');
      /* loop: kunci batas hanya dipertahankan kalau properti itu juga dipakai animasi masuk/keluar di sebelahnya */
      if(kind==='loop'&&!((a.in&&a.pin&&a.pin.includes(p))||(a.out&&a.pout&&a.pout.includes(p))))cut(c,p,t0,t1,true);
      const r=c.kf&&c.kf[p];
      /* tidak ada key tersisa, atau semua key tersisa hanya nilai diam: kembalikan jadi nilai biasa (bukan animasi) */
      if(!r||r.every(k=>Math.abs(k.v-rest[p])<1e-6)){
        if(r){delete c.kf[p];if(!Object.keys(c.kf).length)delete c.kf}
        c.props[p]=rest[p];
      }
    }
    delete a[kind];delete a['p'+kind];
    if(!a.in&&!a.out&&!a.loop)delete c.anim;
  }
  /* hapus animasi jenis kind. Kalau ada loop aktif, loop dilepas dulu lalu dipasang lagi supaya titik diam tetap benar. */
  function clear(c,kind){
    const a=c.anim;if(!a||!a['p'+kind])return;
    const reLoop=kind!=='loop'&&a.loop?a.loop:null,lp=a.loopP,oi=a.inD,oo=a.outD;
    if(reLoop)clearOne(c,'loop');
    clearOne(c,kind);
    if(reLoop){c.anim=c.anim||{};Object.assign(c.anim,{loopP:lp,inD:oi,outD:oo});applyTo(c,'loop',reLoop,0)}
  }
  /* terapkan preset 'name' untuk jenis kind (in|out|loop) ke clip c. Mengembalikan false kalau tidak bisa.
     dur > 0 mengganti lama animasi (masuk/keluar) atau lama satu siklus (loop). */
  function applyTo(c,kind,name,dur){
    const def=KINDS[kind]&&KINDS[kind][name],p=P();if(!def||!p)return false;
    const old=c.anim||{},D={inD:old.inD,outD:old.outD,loopP:old.loopP};
    /* loop dihitung ulang di akhir supaya titik diam masuk/keluar tidak terpengaruh gelombang loop */
    const reLoop=kind!=='loop'&&old.loop?old.loop:null;
    if(reLoop)clearOne(c,'loop');
    clearOne(c,kind);                                /* hapus animasi lama jenis ini dengan jendela waktu LAMA */
    c.anim=c.anim||{};
    Object.assign(c.anim,{inD:D.inD||DEFD.in,outD:D.outD||DEFD.out,loopP:D.loopP||DEFD.loop});
    if(dur>0){const v=Math.max(0.1,Math.min(10,dur));c.anim[kind==='in'?'inD':kind==='out'?'outD':'loopP']=v}
    const[t0,t1]=win(c,kind);
    if(t1-t0<0.05)return false;
    const b=K().props(c,kind==='in'?t1:t0),spec=def.f(b,p.width,p.height),props=Object.keys(spec);
    for(const q of props){
      cut(c,q,t0,t1,kind!=='loop');
      const list=spec[q];
      if(kind==='loop'){
        const per=Math.max(0.1,c.anim.loopP*(def.per||1)),n=Math.max(1,Math.min(100,Math.round((t1-t0)/per))),step=(t1-t0)/n,keys=[];
        for(let i=0;i<n;i++)for(let j=0;j<list.length-(i<n-1?1:0);j++)keys.push([t0+(i+list[j][0])*step,list[j][1],list[j][2]]);
        put(c,q,keys);
      }else put(c,q,list.map(k=>[t0+k[0]*(t1-t0),k[1],k[2]]));
    }
    c.anim[kind]=name;c.anim['p'+kind]=props;
    if(reLoop)applyTo(c,'loop',reLoop,0);
    return true;
  }

  /* ===== antarmuka ===== */
  const opts=kind=>'<option value="">— tidak ada —</option>'+Object.keys(KINDS[kind]).map(k=>`<option value="${k}">${KINDS[kind][k].l}</option>`).join('');
  function html(){
    return `<div class="adv"><h3 class="kf-title">Animasi cepat (jadi keyframe)</h3>
      ${['in','out','loop'].map(k=>`<label>${LABEL[k]}<select data-anim="${k}">${opts(k)}</select></label>`).join('')}
      <div class="pr-row"><label title="Lama animasi masuk (detik)">Masuk (dtk)<input type="number" data-animv="in" min="0.1" max="5" step="0.1"></label><label title="Lama animasi keluar (detik)">Keluar (dtk)<input type="number" data-animv="out" min="0.1" max="5" step="0.1"></label><label title="Lama satu siklus loop (detik)">Loop (dtk)<input type="number" data-animv="loop" min="0.1" max="10" step="0.1"></label></div>
      <p class="kf-hint">Pilih animasi, hasilnya langsung jadi keyframe di clip ini dan bisa diubah seperti biasa. Pilih "tidak ada" untuk menghapusnya. Animasi masuk dan keluar tidak menimpa gerakan buatanmu di tengah clip.</p></div>`;
  }
  function fill(el,c){
    const d=el.dataset,a=c.anim||{};
    if(d.anim!=null)el.value=a[d.anim]||'';
    else if(d.animv!=null)el.value=Math.round((d.animv==='in'?a.inD:d.animv==='out'?a.outD:a.loopP)*100)/100||DEFD[d.animv];
  }
  const owns=el=>!!el&&!!el.dataset&&(el.dataset.anim!=null||el.dataset.animv!=null);
  function onChange(e){
    const el=e.target;if(!owns(el))return;
    const s=sel();if(!s)return;
    const d=el.dataset,c=s.c;
    APK.history.record();
    if(d.anim!=null){
      if(!el.value)clear(c,d.anim);
      else if(!applyTo(c,d.anim,el.value,0)){const t=document.getElementById('toast');if(t){t.textContent='Clip terlalu pendek untuk animasi ini';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}}
    }else{
      const v=parseFloat(el.value);if(!isFinite(v)||v<=0)return;
      const kind=d.animv;
      if(c.anim&&c.anim[kind])applyTo(c,kind,c.anim[kind],v);
      else{c.anim=c.anim||{};c.anim[kind==='in'?'inD':kind==='out'?'outD':'loopP']=Math.max(0.1,Math.min(10,v))}
    }
    APK.timeline.commit();
  }
  const panel=document.getElementById('panel-props');
  if(panel)panel.addEventListener('change',onChange);
  return{IN,OUT,LOOP,html,fill,owns,applyTo,clear};
})();
