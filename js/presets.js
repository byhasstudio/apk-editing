/* Preset: simpan semua layer project sekali klik (atau hanya yang dipilih bila memilih 2 clip atau lebih) jadi file .apkpreset.json,
   berisi animasi keyframe, jalur gerak, vektor, teks, bentuk, dan hubungan parent.
   Lalu masukkan lagi ke project mana pun. Hasil import adalah clip biasa di track baru, persis seperti aslinya (waktu, urutan track, nama, mute/kunci/sembunyi), jadi bisa diedit seperti biasa.
   Format 2: {apkPreset:2, name, created, tracks:[{id,kind,name,muted,hidden,locked}], media:[{id,name,type}], items:[{kind, tid, c:<clip, start absolut>}]}
   Format 3 = format 2 + isi file media (biner, lihat bagian 'Preset dengan media'). Format 1 dan 2 (lama) tetap bisa dibuka; format 2 tidak membawa file media, jadi clip medianya hanya tersambung jika project punya media dengan id atau nama dan jenis yang sama. */
window.APK=window.APK||{};
APK.presets=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current,T=()=>APK.timeline;
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const num=v=>typeof v==='number'&&isFinite(v);
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3000)}

  /* kumpulkan clip menjadi objek preset (format 2: waktu mulai ABSOLUT, struktur track ikut disimpan, media dicatat lewat id) */
  function pack(p,ids,name){
    const items=[],tracks=[],mediaIds=new Set();
    for(const tr of p.tracks){
      let any=false;
      for(const c of tr.clips){
        if(!ids.includes(c.id))continue;
        items.push({kind:tr.kind,tid:tr.id,c:clone(c)});any=true;
        if(c.mediaId)mediaIds.add(c.mediaId);
      }
      if(any)tracks.push({id:tr.id,kind:tr.kind,name:tr.name,muted:!!tr.muted,hidden:!!tr.hidden,locked:!!tr.locked});
    }
    if(!items.length)return{o:null,media:0};
    const media=(p.media||[]).filter(m=>mediaIds.has(m.id)).map(m=>({id:m.id,name:m.name,type:m.type}));
    return{media:media.length,o:{apkPreset:2,name:name||'Preset',created:Date.now(),tracks,media,items}};
  }
  /* ubah preset menjadi track baru. Format 2 dikembalikan persis seperti aslinya (waktu absolut, nama dan status track sama).
     Format 1 (lama) tetap bisa dibuka: waktunya relatif terhadap t. hasMedia(id) = apakah media itu ada di project ini. */
  function unpack(o,t,hasMedia,existing){
    if(!o||![1,2,3].includes(o.apkPreset)||!Array.isArray(o.items))return null;
    const abs=o.apkPreset>=2,off=abs?0:(t||0),hm=hasMedia||(()=>false);
    let dropped=0,same=0;
    const all=o.items.filter(i=>{
      if(!(i&&i.c&&typeof i.c==='object'&&num(i.c.start)&&num(i.c.dur)&&i.c.dur>0))return false;
      if(i.c.mediaId&&!hm(i.c.mediaId)){dropped++;return false}
      return true;
    }).slice(0,500);
    /* layer yang isinya sama persis dengan clip yang SUDAH ADA di project dilewati, supaya membuka preset berkali-kali
       (atau ke project asalnya) tidak menumpuk salinan teks. Anak dari layer yang dilewati tetap tersambung ke layer yang sudah ada. */
    /* bandingkan dalam bentuk yang sama dengan hasil impor (nilai bawaan props dilengkapi, urutan kunci diabaikan) */
    const canon=v=>Array.isArray(v)?'['+v.map(canon).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}':v===undefined?'null':JSON.stringify(v);
    const sigOf=(c,d)=>{
      const x=Object.assign({},c,{start:Math.max(0,c.start+d)});delete x.id;delete x.parent;
      x.props=Object.assign({x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},x.props);if(!x.mediaId)x.mediaId=null;
      return canon(x);
    };
    const have=new Map();for(const c of (existing||[]))if(c&&num(c.start))have.set(sigOf(c,0),c.id);
    const map={},items=[];
    for(const i of all){
      const old=have.get(sigOf(i.c,off));
      if(old){map[i.c.id]=old;same++}else items.push(i);
    }
    if(!items.length)return{tracks:[],ids:[],dropped,same,name:String(o.name||'Preset')};
    const groups=new Map(),meta=new Map((Array.isArray(o.tracks)?o.tracks:[]).filter(x=>x&&typeof x==='object').map(x=>[String(x.id),x]));
    for(const i of items){const nid=uid('c_');map[i.c.id]=nid;i._n=nid}
    for(const i of items){
      const c=clone(i.c);
      c.id=i._n;c.start=Math.max(0,c.start+off);if(!c.mediaId)c.mediaId=null;
      c.props=Object.assign({x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},c.props);
      if(c.parent){if(map[c.parent])c.parent=map[c.parent];else delete c.parent}
      const k=String(i.tid);
      if(!groups.has(k))groups.set(k,{kind:i.kind,clips:[]});
      groups.get(k).clips.push(c);
    }
    const tracks=[],name=String(o.name||'Preset').slice(0,40);
    let n=0;
    for(const [k,g] of groups){
      n++;const m=meta.get(k);
      tracks.push({id:uid('t_'),kind:(m&&m.kind)||g.kind||'video',name:m&&m.name?String(m.name).slice(0,60):name+(groups.size>1?' '+n:''),
        muted:!!(m&&m.muted),hidden:!!(m&&m.hidden),locked:!!(m&&m.locked),clips:g.clips});
    }
    return{tracks,ids:tracks.flatMap(t=>t.clips.map(c=>c.id)),dropped,same,name};
  }

  /* ===== Preset dengan media (format 3) =====
     File biner: 'APKPRESET3' + panjang header (uint32 LE) + header JSON (sama seperti format 2, daftar media lengkap dengan ukuran) + isi file media berurutan.
     Tanpa media, preset tetap file JSON biasa (format 2). */
  const MAGIC='APKPRESET3',KINDS=['video','audio','image'],enc=new TextEncoder();
  const mb=b=>b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB';

  /* susun file preset dari hasil pack(). Kalau ada media, isi filenya ikut dimasukkan. */
  async function build(p,r,base){
    if(!r.media){return{blob:new Blob([JSON.stringify(r.o)],{type:'application/json'}),fname:base+'.apkpreset.json',note:'',total:0}}
    const parts=[],metas=[];let total=0,miss=0;
    for(const m of r.o.media){
      const full=(p.media||[]).find(x=>x.id===m.id),rec=full&&await APK.db.getMedia(m.id);
      if(!rec||!rec.blob){miss++;continue}
      metas.push({id:m.id,name:full.name,type:full.type,size:rec.blob.size,mime:full.mime||rec.blob.type||'',width:full.width||0,height:full.height||0,duration:full.duration||0,thumb:full.thumb||null});
      parts.push(rec.blob);total+=rec.blob.size;
    }
    let note=miss?'. '+miss+' media tidak ditemukan sehingga tidak ikut tersimpan':'';
    if(!metas.length)return{blob:new Blob([JSON.stringify(r.o)],{type:'application/json'}),fname:base+'.apkpreset.json',note,total:0};
    const hb=enc.encode(JSON.stringify(Object.assign({},r.o,{apkPreset:3,media:metas}))),len=new Uint8Array(4);
    new DataView(len.buffer).setUint32(0,hb.length,true);
    const blob=new Blob([enc.encode(MAGIC),len,hb,...parts],{type:'application/octet-stream'});
    return{blob,fname:base+'.apkpreset',note:', termasuk '+metas.length+' media ('+mb(blob.size)+')'+note,total};
  }
  /* baca file preset: format 3 (biner, tiap media jadi m._blob) atau JSON biasa (format 1 dan 2) */
  async function readFile(file){
    const L=MAGIC.length;
    if(file.size>L+4&&(await file.slice(0,L).text())===MAGIC){
      const hl=new DataView(await file.slice(L,L+4).arrayBuffer()).getUint32(0,true);
      if(L+4+hl>file.size)throw new Error('file rusak');
      const o=JSON.parse(await file.slice(L+4,L+4+hl).text());
      let off=L+4+hl;
      for(const m of (Array.isArray(o.media)?o.media:[])){
        if(!m||!num(m.size)||m.size<0||off+m.size>file.size)throw new Error('file rusak');
        m._blob=file.slice(off,off+m.size,typeof m.mime==='string'?m.mime:'');off+=m.size;
      }
      return o;
    }
    const o=JSON.parse(await file.text());
    /* preset teks murni boleh membawa foto bawaan sebagai base64 (m.b64), supaya bisa disimpan sebagai file teks biasa di repo */
    for(const m of (Array.isArray(o&&o.media)?o.media:[])){
      if(!m||typeof m.b64!=='string')continue;
      try{const bin=atob(m.b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
        m._blob=new Blob([u],{type:typeof m.mime==='string'?m.mime:''});m.size=u.length}catch(_){}
      delete m.b64;
    }
    return o;
  }
  /* sambungkan media preset ke project: pakai media yang sudah ada (id sama, atau nama+jenis+ukuran sama), kalau belum ada impor dari isi preset.
     Lalu clip di preset diarahkan ke id media di project ini. Mengembalikan jumlah media yang baru diimpor. */
  async function bindMedia(p,o){
    if(!o||!Array.isArray(o.media)||!Array.isArray(o.items))return 0;
    if(!Array.isArray(p.media))p.media=[];
    const map={};let added=0;
    for(const m of o.media){
      if(!m||typeof m.id!=='string'||typeof m.name!=='string'||!KINDS.includes(m.type))continue;
      const ex=p.media.find(x=>x.id===m.id)||p.media.find(x=>x.name===m.name&&x.type===m.type&&(!num(m.size)||x.size===m.size));
      if(ex){map[m.id]=ex.id;continue}
      if(!m._blob)continue;
      const id='m_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      await APK.db.putMedia({id,projectId:p.id,blob:m._blob});
      p.media.push({id,name:m.name,type:m.type,size:m._blob.size,mime:typeof m.mime==='string'?m.mime:'',
        width:num(m.width)?m.width:0,height:num(m.height)?m.height:0,duration:num(m.duration)?m.duration:0,
        thumb:typeof m.thumb==='string'&&m.thumb.startsWith('data:image/')?m.thumb:null});
      map[m.id]=id;added++;
    }
    for(const i of o.items)if(i&&i.c&&i.c.mediaId&&map[i.c.mediaId])i.c.mediaId=map[i.c.mediaId];
    if(added){APK.project.markDirty();if(APK.media)APK.media.render()}
    return added;
  }

  /* tanpa seleksi banyak: ambil SEMUA clip di project; kalau 2+ clip dipilih: hanya yang dipilih */
  async function save(){
    const p=P();if(!p)return;
    const sel=T().selectedIds(),all=sel.length<2,ids=all?p.tracks.flatMap(tr=>tr.clips.map(c=>c.id)):sel;
    if(!ids.length){toast('Belum ada layer di project ini');return}
    const first=p.tracks.flatMap(tr=>tr.clips).find(c=>ids.includes(c.id)&&c.text),def=(first&&String(first.text.content).split('\n')[0].slice(0,24))||'Preset saya';
    const name=prompt('Nama preset ('+(all?'semua layer di project':sel.length+' layer terpilih')+'):',def);
    if(name===null)return;
    const r=pack(p,ids,name.trim()||def);
    if(!r.o){toast('Tidak ada layer yang bisa disimpan');return}
    let b;
    try{b=await build(p,r,r.o.name.replace(/[^\w\- ]+/g,'').trim()||'preset')}catch(e){toast('Gagal menyimpan preset: '+e.message);return}
    if(b.total>314572800&&!confirm('Preset ini berisi media sebesar '+mb(b.total)+' dan bisa berat di HP. Tetap simpan?'))return;
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b.blob);
    a.download=b.fname;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),b.total?120000:1500);
    toast('Preset disimpan ('+r.o.items.length+' layer'+b.note+')');
  }
  async function load(file){
    const p=P();if(!p||!file)return;
    let o,nm=0;
    try{o=await readFile(file)}catch(_){toast('File preset tidak valid: '+file.name);return}
    try{nm=await bindMedia(p,o)}catch(e){toast('Gagal memasukkan media dari preset: '+e.message);return}
    const r=unpack(o,APK.preview.time,id=>(p.media||[]).some(m=>m.id===id),p.tracks.flatMap(tr=>tr.clips));
    if(!r){toast('Bukan preset APK EDITING yang valid: '+file.name);return}
    if(!r.ids.length){toast(r.same?'Preset "'+r.name+'" sudah ada di project ini ('+r.same+' layer sama), tidak ditambahkan lagi':'Tidak ada layer yang bisa dimasukkan'+(r.dropped?' ('+r.dropped+' clip media tidak ditemukan di project ini)':''));return}
    APK.history.record();
    p.tracks.unshift(...r.tracks);
    T().select(r.ids[0]);
    for(const id of r.ids.slice(1))T().select(id,{toggle:true});
    T().commit();
    toast('Preset "'+r.name+'" dimasukkan persis seperti aslinya ('+r.ids.length+' layer)'+(nm?'. '+nm+' media ikut diimpor':'')+(r.same?'. '+r.same+' layer yang sudah ada tidak diduplikat':'')+(r.dropped?'. '+r.dropped+' clip media dilewati karena medianya tidak ada di preset maupun project ini':''));
  }

  function init(){
    const anchor=$('btn-mode');
    if(!anchor)return;
    const mk=(id,txt,title,fn)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.textContent=txt;b.title=title;b.onclick=fn;return b};
    const b1=mk('btn-preset-save','⬇ Preset','Simpan SEMUA layer project jadi file preset sekali klik, media ikut tersimpan (pilih 2 clip atau lebih jika hanya ingin sebagian)',save);
    const b2=mk('btn-preset-open','⬆ Preset','Buka file preset (bisa pilih beberapa file); layer masuk persis seperti aslinya dan bisa diedit',()=>$('file-preset').click());
    anchor.before(b1,b2);
    const f=document.createElement('input');f.type='file';f.id='file-preset';f.hidden=true;f.multiple=true;f.accept='.json,.apkpreset';
    f.onchange=async e=>{const fl=[...e.target.files];e.target.value='';for(const x of fl)await load(x)};
    document.body.appendChild(f);
  }
  init();
  return{pack,unpack,build,readFile,bindMedia,save,load};
})();
