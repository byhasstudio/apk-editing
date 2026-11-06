/* Preset foto (template): hasil edit yang sudah jadi, pengguna HANYA mengganti fotonya.
   Yang tetap persis sama: video, teks, bentuk, animasi, keyframe, kurva, efek, filter, musik, urutan track, rasio, fps.
   Yang bisa diganti: foto (media bertipe gambar yang dipakai clip). Foto yang tidak diganti memakai foto bawaan preset.

   Alur memakai (tombol "✦ Preset" di beranda):
   1. Buka file preset (.apktemplate) -> muncul daftar foto yang bisa diganti.
   2. Ganti foto sesuka hati (boleh sebagian saja), isi nama project, tekan "Pakai Preset".
   3. Project baru dibuat dan langsung terbuka di editor. Tidak ada yang ditulis ke penyimpanan sebelum tombol Pakai ditekan.

   Alur membuat (tombol "⬇ Preset Foto" di editor): menyimpan SEMUA layer project + media + pengaturan project (rasio, fps) jadi satu file .apktemplate.
   Formatnya sama dengan preset format 3 (js/presets.js: 'APKPRESET3' + header JSON + isi media) ditambah header:
     template:{v:1, project:{aspect,width,height,fps,...}, slots:[id media foto yang boleh diganti]}
   Daftar preset bawaan BELUM ada. Nanti cukup panggil APK.template.register({id,name,desc,url}) dan daftarnya otomatis muncul di dialog.
   Dimuat setelah js/presets.js dan js/app.js (memakai APK.presets dan APK.app). */
window.APK=window.APK||{};
APK.template=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  const clone=o=>JSON.parse(JSON.stringify(o));
  const num=v=>typeof v==='number'&&isFinite(v);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const RATIOS=['16:9','9:16','1:1','4:3','21:9'],IMG='.png,.jpg,.jpeg,.webp';
  const registry=[];
  let cur=null,urls=[],fileIn=null,slotIn=null,pickIdx=-1;
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3200)}

  /* daftar preset bawaan (kosong dulu): {id,name,desc,url} */
  function register(t){if(t&&typeof t.name==='string'&&typeof t.url==='string'&&!registry.some(x=>x.id===t.id&&t.id))registry.push(t)}

  /* ===== membuat preset (di editor) ===== */
  async function save(){
    const p=P();if(!p)return;
    if(!APK.presets){toast('Sistem preset belum dimuat');return}
    const ids=p.tracks.flatMap(tr=>tr.clips.map(c=>c.id));
    if(!ids.length){toast('Belum ada layer di project ini');return}
    const def=String(p.name||'Preset').slice(0,40),name=prompt('Nama preset foto (seluruh layer project ikut tersimpan, pengguna hanya bisa mengganti fotonya):',def);
    if(name===null)return;
    const nm=name.trim()||def,r=APK.presets.pack(p,ids,nm);
    if(!r.o){toast('Tidak ada layer yang bisa disimpan');return}
    const imgs=r.o.media.filter(m=>m.type==='image');
    if(!imgs.length){toast('Preset foto butuh minimal 1 foto di project, sebagai tempat foto yang bisa diganti');return}
    const meta=clone(p);['id','name','media','tracks','created','updated','version'].forEach(k=>delete meta[k]);
    r.o.template={v:1,project:meta,slots:imgs.map(m=>m.id)};
    const base=nm.replace(/[^\w\- ]+/g,'').trim()||'preset';
    let b;
    try{b=await APK.presets.build(p,r,base)}catch(e){toast('Gagal menyimpan preset: '+e.message);return}
    if(b.total>314572800&&!confirm('Preset ini berisi media sebesar '+Math.round(b.total/1048576)+' MB dan bisa berat di HP. Tetap simpan?'))return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b.blob);a.download=base+'.apktemplate';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),b.total?120000:1500);
    toast('Preset foto disimpan ('+imgs.length+' foto bisa diganti'+b.note+')');
  }

  /* ===== memakai preset (di beranda) ===== */
  function probe(file){
    return new Promise((res,rej)=>{
      const u=URL.createObjectURL(file),im=new Image();
      im.onload=()=>{
        try{
          const w=im.naturalWidth,h=im.naturalHeight;
          if(!w||!h)throw new Error('foto kosong');
          const k=160/Math.max(w,h),c=document.createElement('canvas');
          c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
          c.getContext('2d').drawImage(im,0,0,c.width,c.height);
          res({width:w,height:h,thumb:c.toDataURL('image/jpeg',.7)});
        }catch(e){rej(e)}finally{URL.revokeObjectURL(u)}
      };
      im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('format tidak didukung browser'))};
      im.src=u;
    });
  }
  function cleanup(){urls.forEach(u=>URL.revokeObjectURL(u));urls=[];cur=null;pickIdx=-1}
  function dlg(){
    let d=$('dlg-template');if(d)return d;
    d=document.createElement('dialog');d.id='dlg-template';document.body.appendChild(d);
    d.addEventListener('close',cleanup);
    return d;
  }
  const thumbOf=m=>{
    if(typeof m.thumb==='string'&&m.thumb.startsWith('data:image/'))return m.thumb;
    const u=URL.createObjectURL(m._blob);urls.push(u);return u;
  };

  function showStart(){
    const d=dlg();
    const items=registry.map((t,i)=>'<div class="tp-item"><div><b>'+esc(t.name)+'</b>'+(t.desc?'<small>'+esc(t.desc)+'</small>':'')+'</div><button class="btn" type="button" data-use="'+i+'">Pakai</button></div>').join('');
    d.innerHTML='<h3>Preset</h3>'
      +'<p class="tp-note">Preset adalah hasil edit yang sudah jadi. Kamu tinggal mengganti fotonya, sedangkan animasi, teks, efek, dan musiknya tetap.</p>'
      +(registry.length?'<div class="tp-list">'+items+'</div>':'')
      +'<div class="dlg-actions"><button class="btn" type="button" id="tp-close">Tutup</button><button class="btn primary" type="button" id="tp-file">Buka file preset</button></div>';
    d.querySelector('#tp-close').onclick=()=>d.close();
    d.querySelector('#tp-file').onclick=()=>fileIn.click();
    d.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>useBuiltin(+b.dataset.use));
    if(!d.open)d.showModal();
  }
  async function useBuiltin(i){
    const t=registry[i];if(!t)return;
    toast('Memuat preset...');
    try{
      const r=await fetch(t.url);if(!r.ok)throw new Error('HTTP '+r.status);
      await openBlob(await r.blob());
    }catch(e){toast('Gagal memuat preset: '+e.message)}
  }
  async function openBlob(file){
    if(!APK.presets||!APK.app){toast('Sistem preset belum dimuat');return}
    let o;
    try{o=await APK.presets.readFile(file)}catch(e){toast('File preset tidak valid'+(file&&file.name?': '+file.name:''));return}
    if(!o||![2,3].includes(o.apkPreset)||!Array.isArray(o.items)||!Array.isArray(o.tracks)){toast('Bukan file preset APK EDITING yang valid');return}
    const pr=o.template&&o.template.project;
    if(!pr||!num(pr.width)||!num(pr.height)||!num(pr.fps)||pr.width<=0||pr.height<=0||pr.fps<=0||pr.width>8192||pr.height>8192||!RATIOS.includes(pr.aspect)){
      toast('File ini preset layer biasa, bukan preset foto. Buka lewat tombol ⬆ Preset di dalam editor');return;
    }
    const media=Array.isArray(o.media)?o.media:[],used=new Set(),first=new Map();
    for(const i of o.items){
      const c=i&&i.c;if(!c||!c.mediaId)continue;
      used.add(c.mediaId);
      if(num(c.start))first.set(c.mediaId,Math.min(first.has(c.mediaId)?first.get(c.mediaId):Infinity,c.start));
    }
    const allow=Array.isArray(o.template.slots)?new Set(o.template.slots):null;
    urls.forEach(u=>URL.revokeObjectURL(u));urls=[];
    const slots=media.filter(m=>m&&m.type==='image'&&m._blob&&used.has(m.id)&&(!allow||allow.has(m.id)))
      .sort((a,b)=>(first.get(a.id)||0)-(first.get(b.id)||0)).map((m,i)=>({m,label:'Foto '+(i+1),replaced:false}));
    cur={o,pr,slots,busy:false,name:String(o.name||'Project preset').slice(0,80)};
    showSlots();
  }
  function slotCards(){
    return cur.slots.map((s,i)=>'<div class="tp-slot'+(s.replaced?' done':'')+'"><div class="tp-thumb"><img alt="" src="'+esc(thumbOf(s.m))+'"></div>'
      +'<b>'+esc(s.label)+'</b><small>'+(num(s.m.width)&&s.m.width?s.m.width+'×'+s.m.height+' · ':'')+(s.replaced?'foto kamu':'bawaan preset')+'</small>'
      +'<button class="btn" type="button" data-pick="'+i+'">'+(s.replaced?'Ganti lagi':'Ganti foto')+'</button></div>').join('');
  }
  function showSlots(){
    const d=dlg();
    d.innerHTML='<h3>'+esc(cur.name)+'</h3>'
      +'<p class="tp-note">'+(cur.slots.length
        ?'Ganti foto yang kamu mau. Foto yang tidak diganti memakai foto bawaan preset. Selain foto, semuanya tidak bisa diubah di sini.'
        :'Preset ini tidak punya foto yang bisa diganti. Kamu tetap bisa memakainya apa adanya.')+'</p>'
      +(cur.slots.length?'<div class="tp-slots" id="tp-slots">'+slotCards()+'</div>':'')
      +'<label>Nama project<input id="tp-name" maxlength="80" value="'+esc(cur.name)+'"></label>'
      +'<div class="dlg-actions"><button class="btn" type="button" id="tp-cancel">Batal</button><button class="btn primary" type="button" id="tp-apply">Pakai Preset</button></div>';
    d.querySelector('#tp-cancel').onclick=()=>d.close();
    d.querySelector('#tp-apply').onclick=apply;
    const g=d.querySelector('#tp-slots');
    if(g)g.onclick=e=>{const b=e.target.closest('[data-pick]');if(!b)return;pickIdx=+b.dataset.pick;slotIn.click()};
    if(!d.open)d.showModal();
  }
  async function replaceSlot(i,file){
    const s=cur&&cur.slots[i];if(!s)return;
    if(!/\.(png|jpe?g|webp)$/i.test(file.name||'')){toast('Hanya foto (PNG, JPG, WEBP) yang bisa dipakai');return}
    let info;
    try{info=await probe(file)}catch(e){toast(file.name+': gagal dibaca ('+e.message+')');return}
    if(!cur||cur.slots[i]!==s)return;
    Object.assign(s.m,{name:file.name,size:file.size,mime:file.type||'',width:info.width,height:info.height,thumb:info.thumb,_blob:file});
    s.replaced=true;
    const g=$('tp-slots');if(g)g.innerHTML=slotCards();
  }
  async function apply(){
    if(!cur||cur.busy)return;
    const c0=cur,btn=$('tp-apply'),o=c0.o,pr=c0.pr;
    c0.busy=true;if(btn)btn.disabled=true;
    let p=null;
    try{
      const nm=(($('tp-name')||{}).value||'').trim()||c0.name;
      p=APK.project.create({name:nm,aspect:pr.aspect,quality:720,fps:pr.fps});
      /* pengaturan project dari preset (rasio, ukuran, fps, dan lainnya); identitas dan isi tetap milik project baru */
      Object.assign(p,clone(pr),{id:p.id,name:nm,version:p.version,created:p.created,updated:p.updated,media:[],tracks:[]});
      /* impor media (foto yang diganti sudah ada di o.media); id media baru dibuat, jadi memakai preset berkali-kali tidak saling menimpa */
      const o2=Object.assign({},o,{items:clone(o.items)});
      await APK.presets.bindMedia(p,o2);
      const have=new Set(p.media.map(m=>m.id)),tmap=new Map();
      for(const m of o.tracks){
        if(!m||typeof m!=='object'||m.id==null)continue;
        tmap.set(String(m.id),{id:String(m.id),kind:String(m.kind||'video'),name:String(m.name||'').slice(0,60),muted:!!m.muted,hidden:!!m.hidden,locked:!!m.locked,clips:[]});
      }
      let dropped=0;
      /* id clip dan id track dipertahankan apa adanya (project baru, tidak bentrok), jadi parent, grup, dan target efek tetap tersambung */
      for(const i of o2.items.slice(0,2000)){
        const c=i&&i.c;
        if(!c||typeof c!=='object'||!c.id||!num(c.start)||!num(c.dur)||c.dur<=0)continue;
        const tr=tmap.get(String(i.tid));if(!tr)continue;
        if(c.mediaId&&!have.has(c.mediaId)){dropped++;continue}
        if(!c.mediaId)c.mediaId=null;
        tr.clips.push(c);
      }
      p.tracks=[...tmap.values()];
      if(!p.tracks.some(t=>t.clips.length))throw new Error('preset kosong');
      p.updated=Date.now();
      await APK.db.put(p);
      const d=dlg();d.close();
      await APK.app.openProject(p);
      toast('Preset dipakai'+(dropped?' ('+dropped+' clip dilewati karena medianya tidak ada di file)':'. Foto masih bisa diganti lewat tombol ⇄ Ganti di timeline'));
    }catch(e){
      /* gagal: bersihkan media yang sudah terlanjur diimpor supaya tidak jadi sampah di penyimpanan */
      if(p&&p.media)for(const m of p.media){try{await APK.db.delMedia(m.id)}catch(_){}}
      toast('Gagal memakai preset: '+(e&&e.message||e));
      c0.busy=false;if(btn)btn.disabled=false;
    }
  }

  function mk(id,txt,title,fn){const b=document.createElement('button');b.type='button';b.className='btn';b.id=id;b.textContent=txt;b.title=title;b.onclick=fn;return b}
  function init(){
    fileIn=document.createElement('input');fileIn.type='file';fileIn.id='file-template';fileIn.hidden=true;fileIn.accept='.apktemplate,.apkpreset,.json';
    fileIn.onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await openBlob(f)};
    slotIn=document.createElement('input');slotIn.type='file';slotIn.id='file-template-slot';slotIn.hidden=true;slotIn.accept=IMG;
    slotIn.onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f&&cur&&pickIdx>=0)await replaceSlot(pickIdx,f)};
    document.body.append(fileIn,slotIn);
    const nb=$('btn-new');
    if(nb)nb.before(mk('btn-preset-home','✦ Preset','Pakai preset: hasil edit yang sudah jadi, kamu tinggal mengganti fotonya',showStart));
    const anchor=$('btn-preset-save')||$('btn-mode');
    if(anchor)anchor.before(mk('btn-preset-foto','⬇ Preset Foto','Simpan project ini jadi preset foto (.apktemplate): seluruh layer dan media ikut tersimpan, pengguna hanya bisa mengganti fotonya',save));
  }
  try{init()}catch(e){console.error('Preset foto gagal dimuat',e)}
  return{register,save,showStart,openBlob};
})();
