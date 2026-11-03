/* Navigasi dan UI utama */
(function(){
  const $=id=>document.getElementById(id),P=APK.project;
  const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=t=>new Date(t).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});
  let tt;
  function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2200)}

  async function renderHome(){
    const list=$('project-list'),all=await APK.db.all();
    if(!all.length){list.innerHTML='<div class="empty-home">Belum ada project. Klik <b>Project Baru</b> untuk mulai.</div>';return}
    list.innerHTML=all.map(p=>`<div class="card" data-id="${p.id}"><div class="thumb"><i style="aspect-ratio:${p.width}/${p.height};${p.width>=p.height?'width:80%':'height:80%'}">${p.aspect}</i></div>
      <div class="card-body"><b>${esc(p.name)}</b><small>${p.width}×${p.height} · ${p.fps} fps</small>
      <div class="card-foot"><small>Diedit ${fmt(p.updated)}</small><button class="btn danger" data-del="${p.id}">Hapus</button></div></div></div>`).join('');
  }
  function show(v){$('home').hidden=v!=='home';$('editor').hidden=v!=='editor'}
  function renderEditor(){
    const p=P.current;
    $('project-name').value=p.name;
    $('project-meta').textContent=`${p.width}×${p.height} · ${p.fps} fps · ${p.aspect}`;
    APK.media.render();APK.timeline.load();APK.preview.load();
  }
  APK.media.init(toast);APK.timeline.init(toast);APK.preview.init();
  async function openProject(p){await P.open(p);renderEditor();show('editor')}
  async function goHome(){if(P.dirty)await P.save();P.close();show('home');renderHome()}

  P.onChange((p,d)=>{const s=$('save-state');s.textContent=d?'Belum disimpan':'Tersimpan';s.classList.toggle('dirty',d)});

  function updateRes(){const f=new FormData($('form-new')),s=P.size(f.get('aspect'),f.get('quality'));$('new-res').textContent=`Resolusi: ${s.width}×${s.height}`}
  $('btn-new').onclick=()=>{updateRes();$('dlg-new').showModal()};
  $('form-new').addEventListener('change',updateRes);
  $('form-new').addEventListener('submit',async e=>{
    if(e.submitter&&e.submitter.value!=='ok')return;
    const p=P.create(Object.fromEntries(new FormData(e.target)));
    await APK.db.put(p);await openProject(p);
  });
  $('btn-open').onclick=()=>$('file-open').click();
  $('file-open').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    try{
      const o=JSON.parse(await file.text());
      if(!P.validate(o))throw 0;
      o.id='p_'+Date.now().toString(36);o.media=[];o.tracks=[];o.updated=Date.now();
      await APK.db.put(o);await openProject(o);toast('Project dibuka');
    }catch(_){toast('File project tidak valid')}
  };
  $('project-list').onclick=async e=>{
    const del=e.target.closest('[data-del]'),card=e.target.closest('.card');
    if(del){if(confirm('Hapus project ini? Tindakan ini tidak bisa dibatalkan.')){await P.remove(del.dataset.del);renderHome();toast('Project dihapus')}return}
    if(card){const p=await APK.db.get(card.dataset.id);if(p)openProject(p)}
  };
  $('btn-back').onclick=goHome;
  $('btn-save').onclick=async()=>{await P.save();toast('Project disimpan')};
  $('btn-export-json').onclick=()=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(P.toFile());
    a.download=P.current.name+'.apkedit.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
  $('project-name').oninput=e=>P.rename(e.target.value);
  addEventListener('keydown',e=>{
    if(P.current&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();$('btn-save').click()}
  });
  addEventListener('beforeunload',e=>{if(P.dirty){e.preventDefault();e.returnValue=''}});
  renderHome();
})();
