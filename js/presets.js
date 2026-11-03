/* Preset: simpan semua layer project sekali klik (atau hanya yang dipilih bila memilih 2 clip atau lebih) jadi file .apkpreset.json,
   berisi animasi keyframe, jalur gerak, vektor, teks, bentuk, dan hubungan parent.
   Lalu masukkan lagi ke project mana pun. Hasil import adalah clip biasa di track baru, persis seperti aslinya (waktu, urutan track, nama, mute/kunci/sembunyi), jadi bisa diedit seperti biasa.
   Format 2: {apkPreset:2, name, created, tracks:[{id,kind,name,muted,hidden,locked}], media:[{id,name,type}], items:[{kind, tid, c:<clip, start absolut>}]}
   Format 1 (lama) tetap bisa dibuka. File media tidak ada di dalam preset: clip media hanya dimasukkan jika media dengan id yang sama ada di project tujuan. */
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
  function unpack(o,t,hasMedia){
    if(!o||(o.apkPreset!==1&&o.apkPreset!==2)||!Array.isArray(o.items))return null;
    const abs=o.apkPreset===2,off=abs?0:(t||0),hm=hasMedia||(()=>false);
    let dropped=0;
    const items=o.items.filter(i=>{
      if(!(i&&i.c&&typeof i.c==='object'&&num(i.c.start)&&num(i.c.dur)&&i.c.dur>0))return false;
      if(i.c.mediaId&&!hm(i.c.mediaId)){dropped++;return false}
      return true;
    }).slice(0,500);
    if(!items.length)return{tracks:[],ids:[],dropped,name:String(o.name||'Preset')};
    const map={},groups=new Map(),meta=new Map((Array.isArray(o.tracks)?o.tracks:[]).filter(x=>x&&typeof x==='object').map(x=>[String(x.id),x]));
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
    return{tracks,ids:tracks.flatMap(t=>t.clips.map(c=>c.id)),dropped,name};
  }

  /* tanpa seleksi banyak: ambil SEMUA clip di project; kalau 2+ clip dipilih: hanya yang dipilih */
  function save(){
    const p=P();if(!p)return;
    const sel=T().selectedIds(),all=sel.length<2,ids=all?p.tracks.flatMap(tr=>tr.clips.map(c=>c.id)):sel;
    if(!ids.length){toast('Belum ada layer di project ini');return}
    const first=p.tracks.flatMap(tr=>tr.clips).find(c=>ids.includes(c.id)&&c.text),def=(first&&String(first.text.content).split('\n')[0].slice(0,24))||'Preset saya';
    const name=prompt('Nama preset ('+(all?'semua layer di project':sel.length+' layer terpilih')+'):',def);
    if(name===null)return;
    const r=pack(p,ids,name.trim()||def);
    if(!r.o){toast('Tidak ada layer yang bisa disimpan');return}
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(r.o)],{type:'application/json'}));
    a.download=(r.o.name.replace(/[^\w\- ]+/g,'').trim()||'preset')+'.apkpreset.json';
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    toast('Preset disimpan ('+r.o.items.length+' layer)'+(r.media?'. Clip media hanya muncul lagi jika media yang sama ada di project tujuan':''));
  }
  async function load(file){
    const p=P();if(!p||!file)return;
    let o;
    try{o=JSON.parse(await file.text())}catch(_){toast('File preset tidak valid: '+file.name);return}
    const r=unpack(o,APK.preview.time,id=>(p.media||[]).some(m=>m.id===id));
    if(!r){toast('Bukan preset APK EDITING yang valid: '+file.name);return}
    if(!r.ids.length){toast('Tidak ada layer yang bisa dimasukkan'+(r.dropped?' ('+r.dropped+' clip media tidak ditemukan di project ini)':''));return}
    APK.history.record();
    p.tracks.unshift(...r.tracks);
    T().select(r.ids[0]);
    for(const id of r.ids.slice(1))T().select(id,{toggle:true});
    T().commit();
    toast('Preset "'+r.name+'" dimasukkan persis seperti aslinya ('+r.ids.length+' layer)'+(r.dropped?'. '+r.dropped+' clip media dilewati karena medianya tidak ada di project ini':''));
  }

  function init(){
    const anchor=$('btn-mode');
    if(!anchor)return;
    const mk=(id,txt,title,fn)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.textContent=txt;b.title=title;b.onclick=fn;return b};
    const b1=mk('btn-preset-save','⬇ Preset','Simpan SEMUA layer project jadi file preset sekali klik (pilih 2 clip atau lebih jika hanya ingin sebagian)',save);
    const b2=mk('btn-preset-open','⬆ Preset','Buka file preset (bisa pilih beberapa file); layer masuk persis seperti aslinya dan bisa diedit',()=>$('file-preset').click());
    anchor.before(b1,b2);
    const f=document.createElement('input');f.type='file';f.id='file-preset';f.hidden=true;f.multiple=true;f.accept='.json,.apkpreset';
    f.onchange=async e=>{const fl=[...e.target.files];e.target.value='';for(const x of fl)await load(x)};
    document.body.appendChild(f);
  }
  init();
  return{pack,unpack,save,load};
})();
