/* Preset: simpan semua layer project sekali klik (atau hanya yang dipilih bila memilih 2 clip atau lebih) jadi file .apkpreset.json,
   berisi animasi keyframe, jalur gerak, vektor, teks, bentuk, dan hubungan parent.
   Lalu masukkan lagi ke project mana pun. Hasil import adalah clip biasa di track baru, jadi bisa diedit seperti biasa.
   Format: {apkPreset:1, name, created, items:[{kind, tid, c:<clip dengan start relatif>}]}
   Clip yang memakai media (video/gambar/audio) tidak ikut karena file media tidak ada di dalam preset. */
window.APK=window.APK||{};
APK.presets=(function(){
  const $=id=>document.getElementById(id),P=()=>APK.project.current,T=()=>APK.timeline;
  const clone=o=>JSON.parse(JSON.stringify(o));
  const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const num=v=>typeof v==='number'&&isFinite(v);
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3000)}

  /* kumpulkan clip terpilih menjadi objek preset */
  function pack(p,ids,name){
    const items=[];let skipped=0;
    for(const tr of p.tracks)for(const c of tr.clips){
      if(!ids.includes(c.id))continue;
      if(c.mediaId||tr.kind==='audio'){skipped++;continue}
      items.push({kind:tr.kind,tid:tr.id,c:clone(c)});
    }
    if(!items.length)return{skipped,o:null};
    const t0=Math.min(...items.map(i=>i.c.start));
    for(const i of items)i.c.start=Math.round((i.c.start-t0)*1000)/1000;
    return{skipped,o:{apkPreset:1,name:name||'Preset',created:Date.now(),items}};
  }
  /* ubah preset menjadi track baru di waktu t (id clip baru, parent dipetakan ulang). Mengembalikan {tracks, ids} atau null bila tidak valid. */
  function unpack(o,t){
    if(!o||o.apkPreset!==1||!Array.isArray(o.items))return null;
    const items=o.items.filter(i=>i&&i.c&&typeof i.c==='object'&&!i.c.mediaId&&i.kind!=='audio'&&num(i.c.start)&&num(i.c.dur)&&i.c.dur>0).slice(0,300);
    if(!items.length)return null;
    const map={},groups=new Map();
    for(const i of items){const nid=uid('c_');map[i.c.id]=nid;i._n=nid}
    for(const i of items){
      const c=clone(i.c);
      c.id=i._n;c.start=Math.max(0,c.start+t);c.mediaId=null;
      c.props=Object.assign({x:0,y:0,scale:1,opacity:1,rotation:0,volume:1},c.props);
      if(c.parent){if(map[c.parent])c.parent=map[c.parent];else delete c.parent}
      const k=String(i.tid);
      if(!groups.has(k))groups.set(k,[]);
      groups.get(k).push(c);
    }
    const tracks=[],name=String(o.name||'Preset').slice(0,40);
    let n=0;
    for(const cl of groups.values()){
      n++;
      tracks.push({id:uid('t_'),kind:'video',name:name+(groups.size>1?' '+n:''),muted:false,clips:cl});
    }
    return{tracks,ids:tracks.flatMap(t=>t.clips.map(c=>c.id)),name};
  }

  /* tanpa seleksi banyak: ambil SEMUA clip non-media di project; kalau 2+ clip dipilih: hanya yang dipilih */
  function save(){
    const p=P();if(!p)return;
    const sel=T().selectedIds(),all=sel.length<2,ids=all?p.tracks.flatMap(tr=>tr.clips.map(c=>c.id)):sel;
    if(!ids.length){toast('Belum ada layer di project ini');return}
    const first=p.tracks.flatMap(tr=>tr.clips).find(c=>ids.includes(c.id)&&c.text),def=(first&&String(first.text.content).split('\n')[0].slice(0,24))||'Preset saya';
    const name=prompt('Nama preset ('+(all?'semua layer di project':sel.length+' layer terpilih')+'):',def);
    if(name===null)return;
    const r=pack(p,ids,name.trim()||def);
    if(!r.o){toast('Tidak ada layer yang bisa disimpan. Preset hanya untuk teks, bentuk, vektor, dan grup (bukan video, gambar, audio)');return}
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(r.o)],{type:'application/json'}));
    a.download=(r.o.name.replace(/[^\w\- ]+/g,'').trim()||'preset')+'.apkpreset.json';
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    toast('Preset disimpan ('+r.o.items.length+' layer)'+(r.skipped?'. '+r.skipped+' clip media dilewati':''));
  }
  async function load(file){
    const p=P();if(!p||!file)return;
    let o;
    try{o=JSON.parse(await file.text())}catch(_){toast('File preset tidak valid: '+file.name);return}
    const r=unpack(o,APK.preview.time);
    if(!r){toast('Bukan preset APK EDITING yang valid: '+file.name);return}
    APK.history.record();
    p.tracks.unshift(...r.tracks);
    T().select(r.ids[0]);
    for(const id of r.ids.slice(1))T().select(id,{toggle:true});
    T().commit();
    toast('Preset "'+r.name+'" dimasukkan ('+r.ids.length+' layer) di posisi playhead. Semua bisa diedit.');
  }

  function init(){
    const anchor=$('btn-mode');
    if(!anchor)return;
    const mk=(id,txt,title,fn)=>{const b=document.createElement('button');b.className='btn';b.id=id;b.textContent=txt;b.title=title;b.onclick=fn;return b};
    const b1=mk('btn-preset-save','⬇ Preset','Simpan SEMUA layer project jadi file preset sekali klik (pilih 2 clip atau lebih jika hanya ingin sebagian)',save);
    const b2=mk('btn-preset-open','⬆ Preset','Buka file preset (bisa pilih beberapa file); layer masuk di posisi playhead dan bisa diedit',()=>$('file-preset').click());
    anchor.before(b1,b2);
    const f=document.createElement('input');f.type='file';f.id='file-preset';f.hidden=true;f.multiple=true;f.accept='.json,.apkpreset';
    f.onchange=async e=>{const fl=[...e.target.files];e.target.value='';for(const x of fl)await load(x)};
    document.body.appendChild(f);
  }
  init();
  return{pack,unpack,save,load};
})();
