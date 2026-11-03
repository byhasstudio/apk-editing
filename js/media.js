/* Sistem media: import, metadata, thumbnail, daftar media */
window.APK=window.APK||{};
APK.media=(function(){
  const TYPES={mp4:'video',mov:'video',webm:'video',mp3:'audio',wav:'audio',png:'image',jpg:'image',jpeg:'image',webp:'image'};
  const urls=new Map();
  const $=id=>document.getElementById(id);
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const kind=f=>TYPES[(f.name.split('.').pop()||'').toLowerCase()];
  const fmtSize=b=>b<1048576?(b/1024).toFixed(0)+' KB':b<1073741824?(b/1048576).toFixed(1)+' MB':(b/1073741824).toFixed(2)+' GB';
  const fmtDur=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

  function thumbFrom(src,w,h){
    const c=document.createElement('canvas'),k=160/Math.max(w,h);
    c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
    c.getContext('2d').drawImage(src,0,0,c.width,c.height);
    return c.toDataURL('image/jpeg',.7);
  }
  function load(el,url,okEvent){
    return new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('timeout')),15000);
      el.addEventListener(okEvent,()=>{clearTimeout(t);res()},{once:true});
      el.addEventListener('error',()=>{clearTimeout(t);rej(new Error('format tidak didukung browser'))},{once:true});
      el.src=url;
    });
  }
  async function probe(file,type){
    const url=URL.createObjectURL(file);
    try{
      if(type==='image'){
        const im=new Image();await load(im,url,'load');
        return{width:im.naturalWidth,height:im.naturalHeight,duration:0,thumb:thumbFrom(im,im.naturalWidth,im.naturalHeight)};
      }
      const el=document.createElement(type);el.preload='metadata';el.muted=true;
      await load(el,url,'loadedmetadata');
      const duration=isFinite(el.duration)?el.duration:0;
      if(type==='audio')return{duration,width:0,height:0,thumb:null};
      el.currentTime=Math.min(1,duration/2);
      await new Promise(r=>{el.addEventListener('seeked',r,{once:true});setTimeout(r,3000)});
      return{duration,width:el.videoWidth,height:el.videoHeight,thumb:el.videoWidth?thumbFrom(el,el.videoWidth,el.videoHeight):null};
    }finally{URL.revokeObjectURL(url)}
  }
  async function importFiles(files,toast){
    const P=APK.project;if(!P.current)return;
    let ok=0;
    for(const f of files){
      const type=kind(f);
      if(!type){toast(`${f.name}: format tidak didukung`);continue}
      try{
        const info=await probe(f,type),id='m_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
        await APK.db.putMedia({id,projectId:P.current.id,blob:f});
        P.current.media.push({id,name:f.name,type,size:f.size,mime:f.type,...info});
        ok++;
      }catch(e){toast(`${f.name}: gagal diimpor (${e.message})`)}
    }
    if(ok){P.markDirty();render();toast(`${ok} media diimpor`)}
  }
  async function remove(id){
    const P=APK.project;
    P.current.media=P.current.media.filter(m=>m.id!==id);
    if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id)}
    await APK.db.delMedia(id);APK.timeline.dropMedia(id);P.markDirty();render();
  }
  async function getUrl(id){
    if(urls.has(id))return urls.get(id);
    const r=await APK.db.getMedia(id);if(!r)return null;
    const u=URL.createObjectURL(r.blob);urls.set(id,u);return u;
  }
  function releaseUrls(){urls.forEach(u=>URL.revokeObjectURL(u));urls.clear()}
  function render(){
    const list=$('media-list'),p=APK.project.current;
    if(!p)return;
    if(!p.media.length){list.innerHTML='<p class="empty">Belum ada media. Klik Import atau seret file ke sini.</p>';return}
    const icon={audio:'♪',video:'▶',image:'▣'};
    list.innerHTML=p.media.map(m=>`<div class="media-item" data-id="${m.id}">
      <div class="m-thumb">${m.thumb?`<img src="${m.thumb}" alt="">`:`<span>${icon[m.type]}</span>`}</div>
      <div class="m-info"><b title="${esc(m.name)}">${esc(m.name)}</b><small>${m.type==='image'?`${m.width}×${m.height}`:fmtDur(m.duration)} · ${fmtSize(m.size)}</small></div>
      <button class="btn" data-add="${m.id}" title="Tambah ke timeline" aria-label="Tambah ke timeline">+</button><button class="btn danger" data-rm="${m.id}" aria-label="Hapus media">✕</button></div>`).join('');
  }
  function init(toast){
    const panel=$('panel-media');
    $('btn-import').onclick=()=>$('file-media').click();
    $('file-media').onchange=e=>{const fs=[...e.target.files];e.target.value='';importFiles(fs,toast)};
    $('media-list').onclick=e=>{const b=e.target.closest('[data-rm]'),a=e.target.closest('[data-add]');if(b)remove(b.dataset.rm);else if(a)APK.timeline.addMedia(a.dataset.add)};
    $('media-list').ondblclick=e=>{const i=e.target.closest('.media-item');if(i&&!e.target.closest('button'))APK.timeline.addMedia(i.dataset.id)};
    panel.addEventListener('dragover',e=>{e.preventDefault();panel.classList.add('drop')});
    panel.addEventListener('dragleave',()=>panel.classList.remove('drop'));
    panel.addEventListener('drop',e=>{e.preventDefault();panel.classList.remove('drop');importFiles([...e.dataTransfer.files],toast)});
  }
  return{init,render,importFiles,remove,getUrl,releaseUrls};
})();
