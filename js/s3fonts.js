/* Font tambahan untuk teks Edit 3D (dimuat setelah js/scene3d.js, isi scene3d.js tidak diubah).
   Teks 3D tadinya hanya punya satu font (Arial Black). Modul ini menambah:
   1) Pemilih font di panel properti layer teks: ±220 font berkategori (estetik, tulisan tangan/script, poster, abstrak,
      retro/futuristik, lucu, gotik, modern) + font bawaan perangkat + FONT SENDIRI dari file .ttf/.otf/.woff/.woff2
      (disimpan di IndexedDB, jalan tanpa internet). Pilihan disimpan di layer teks (it.font), jadi ikut undo/redo,
      simpan otomatis, Export, dan Kirim ke editor.
   2) Font web dimuat dari Google Fonts hanya saat dilihat/dipakai (butuh internet pertama kali). Kalau gagal dimuat,
      dipakai font cadangan dan layar tidak rusak.
   Cara kerja: scene3d.js menggambar teks dengan satu string font tetap. Modul ini mencegat penetapan string itu pada
   kanvas teks (kanvas dikenali lewat ID layer saat disimpan di texPool, dicatat dari Map.set) lalu menggantinya dengan
   font pilihan layer. Layer tanpa pilihan font tetap memakai Arial Black seperti sebelumnya. */
(function(){
'use strict';
window.APK=window.APK||{};
const $=id=>document.getElementById(id);
const toast=m=>{try{APK.app&&APK.app.toast&&APK.app.toast(m)}catch(_){}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sc=()=>{try{return(APK.s3d&&APK.s3d.scene)||null}catch(_){return null}};
const rerender=()=>{try{APK.s3d&&APK.s3d.render()}catch(_){}};

/* ===== daftar font ===== */
const CAT=[['sys','Bawaan perangkat'],['est','Estetik & elegan'],['scr','Tulisan tangan & script'],['bld','Tebal & judul poster'],
  ['abs','Abstrak & eksperimen'],['ret','Retro, piksel & futuristik'],['fun','Lucu & kartun'],['drk','Gelap & gotik'],['mod','Modern bersih'],['my','Font saya']];
const NOTE={sys:'Font bawaan bergantung perangkat. Di sebagian HP bisa berganti ke font cadangan.',
  my:'Font dari filemu tersimpan di perangkat ini dan jalan tanpa internet.'};
const NOTE_WEB='Font dimuat dari Google Fonts, butuh internet saat pertama kali dipakai.';
/* [nama, bobot, daftar font, 1 = font bawaan Layer (default lama)] */
const SYS=[['Arial Black',900,'"Arial Black","Helvetica Neue",Arial,sans-serif',1],['Impact',400,'Impact,"Arial Black",sans-serif'],
  ['Georgia',700,'Georgia,"Times New Roman",serif'],['Times New Roman',700,'"Times New Roman",Times,serif'],
  ['Trebuchet MS',700,'"Trebuchet MS",Verdana,sans-serif'],['Verdana',700,'Verdana,Geneva,sans-serif'],
  ['Courier New',700,'"Courier New",monospace'],['Comic Sans MS',700,'"Comic Sans MS","Segoe Script",cursive'],
  ['Brush Script MT',400,'"Brush Script MT","Segoe Script",cursive']];
/* "Nama:bobot", tanpa bobot = 400 */
const G={
est:'Playfair Display:700|Cormorant Garamond:700|DM Serif Display|Abril Fatface|Bodoni Moda:700|Cinzel:700|Italiana|Marcellus|Yeseva One|Gloock|Fraunces:700|Prata|Rozha One|Gilda Display|Forum|Poiret One|Limelight|Tenor Sans|Libre Caslon Display|Lora:700',
scr:'Dancing Script:700|Pacifico|Great Vibes|Sacramento|Satisfy|Allura|Parisienne|Kaushan Script|Caveat:700|Shadows Into Light|Permanent Marker|Rock Salt|Homemade Apple|Yellowtail|Lobster|Mr Dafoe|Alex Brush|Italianno|Tangerine:700|Cookie|Courgette|Marck Script|Nanum Pen Script|Reenie Beanie|Gloria Hallelujah|Covered By Your Grace|Rouge Script|Playball|Norican|Damion|Leckerli One|Sriracha|Amatic SC:700|Architects Daughter|Indie Flower',
bld:'Bebas Neue|Anton|Oswald:700|Archivo Black|Bangers|Righteous|Alfa Slab One|Passion One:700|Staatliches|Bowlby One|Black Han Sans|Big Shoulders Display:900|Barlow Condensed:800|League Gothic|Fjalla One|Teko:700|Antonio:700|Squada One|Russo One|Paytone One|Gasoek One|Dela Gothic One|Rubik Mono One|Climate Crisis|Unbounded:800|Bungee|Lilita One|Titan One|Luckiest Guy|Shrikhand',
abs:'Monoton|Rubik Glitch|Rubik Maze|Rubik Pixels|Rubik Scribble|Rubik Gemstones|Rubik Wet Paint|Rubik Spray Paint|Rubik Distressed|Rubik Burned|Rubik Iso|Rubik Moonrocks|Rubik Puddles|Rubik Vinyl|Rubik Microbe|Rubik Bubbles|Rubik Marker Hatch|Rubik Beastly|Syne:800|Faster One|Fascinate|Fascinate Inline|Bungee Shade|Bungee Inline|Bungee Outline|Tilt Prism|Tilt Neon|Tilt Warp|Londrina Outline|Londrina Shadow|Londrina Sketch|Londrina Solid:900|Major Mono Display|Megrim|Vast Shadow|Plaster|Ribeye Marrow|Lacquer|Kumar One Outline|Emilys Candy|Sedgwick Ave Display',
ret:'Press Start 2P|VT323|DotGothic16|Pixelify Sans:700|Silkscreen:700|Orbitron:900|Audiowide|Syncopate:700|Michroma|Zen Dots|Aldrich|Wallpoet|Black Ops One|Special Elite|Share Tech Mono|Space Mono:700|Electrolize|Exo 2:800|Turret Road:800|Quantico:700|Chakra Petch:700|Rajdhani:700|Saira Stencil One|Stalinist One|Bruno Ace',
fun:'Fredoka:700|Baloo 2:800|Chewy|Cherry Bomb One|Sniglet:800|Coiny|Bubblegum Sans|Gochi Hand|Boogaloo|Modak|Chango|Knewave|Lemon|DynaPuff:700|Caprasimo|Bagel Fat One|Oi|Shantell Sans:800|Grandstander:800|Comfortaa:700',
drk:'Nosifer|Creepster|Eater|Butcherman|Metal Mania|Pirata One|UnifrakturCook:700|UnifrakturMaguntia|New Rocker|Jolly Lodger|Henny Penny|Frijole|Fontdiner Swanky|Griffy|Grenze Gotisch:800|Germania One|MedievalSharp|Uncial Antiqua',
mod:'Montserrat:800|Poppins:700|Raleway:800|Inter:800|Outfit:800|Sora:700|Lexend:700|Space Grotesk:700|Rubik:800|Josefin Sans:700|Quicksand:700|Nunito:800|Work Sans:700|DM Sans:700|Manrope:800|Plus Jakarta Sans:800|Urbanist:800|Figtree:800|Bricolage Grotesque:800|Gabarito:800|Red Hat Display:800|Archivo:800|Kanit:700|Prompt:700|Jost:700|Albert Sans:800|Epilogue:800'};
const REG={},ALL=[],CUST={};
const stackOf=n=>'"'+n+'","Arial Black",Arial,sans-serif';
function add(f){REG[f.n]=f;ALL.push(f)}
SYS.forEach(([n,w,stack,def])=>add({n,w,stack,cat:'sys',sys:1,def:def?1:0}));
CAT.forEach(([id])=>{if(!G[id])return;G[id].split('|').forEach(x=>{
  const i=x.lastIndexOf(':'),n=i>0?x.slice(0,i):x,w=i>0?+x.slice(i+1):400;add({n,w,cat:id,stack:stackOf(n)})})});

/* ===== pemuatan font web ===== */
const ST={},WARNED={};
const gUrl=f=>'https://fonts.googleapis.com/css2?family='+encodeURIComponent(f.n).replace(/%20/g,'+')+(f.w!==400?':wght@'+f.w:'')+'&display=swap';
function done(){rerender();markRows();refreshBtn()}
function ensure(f){
  if(!f||f.sys||f.custom)return Promise.resolve(true);
  if(ST[f.n])return ST[f.n].p;
  const s=ST[f.n]={s:'load'};
  s.p=new Promise((res,rej)=>{
    const l=document.createElement('link');l.rel='stylesheet';l.href=gUrl(f);l.setAttribute('data-s3font',f.n);
    l.onload=()=>res();l.onerror=()=>rej(new Error('css'));document.head.appendChild(l);
    setTimeout(()=>rej(new Error('waktu habis')),15000);
  }).then(()=>document.fonts.load(f.w+' 48px "'+f.n+'"','Aa')).then(a=>{if(!a||!a.length)throw new Error('kosong')})
  .then(()=>{s.s='ok';return true},()=>{
    s.s='fail';
    if(!WARNED[f.n]){WARNED[f.n]=1;toast('Font "'+f.n+'" gagal dimuat (cek internet). Dipakai font cadangan.')}
    document.querySelectorAll('link[data-s3font]').forEach(l=>{if(l.getAttribute('data-s3font')===f.n)l.remove()});
    return false;
  }).then(ok=>{done();return ok});
  return s.p;
}
/* string font untuk kanvas teks 3D; null = pakai bawaan (Arial Black) */
function css(it,size){
  const f=it&&it.font&&REG[it.font];
  if(!f||f.def)return null;
  if(!f.sys&&!f.custom&&!ST[f.n])ensure(f);
  return f.w+' '+size+'px '+f.stack;
}
const busy=()=>{const s=sc();return !!s&&s.items.some(i=>i.kind==='text'&&i.font&&ST[i.font]&&ST[i.font].s==='load')};

/* ===== pencegat font kanvas teks ===== */
const OWN=new WeakMap(),SIG=/^900 (\S+)px "Arial Black","Helvetica Neue",Arial,sans-serif$/;
function itemOf(c){const id=c&&OWN.get(c),s=id&&sc();return s?s.items.find(i=>i.id===id)||null:null}
function hooks(){
  if(Map.prototype.set.__s3f)return;
  const ms=Map.prototype.set;
  const ns=function(k,v){if(typeof k==='string'&&v&&v.nodeName==='CANVAS')OWN.set(v,k);return ms.call(this,k,v)};
  ns.__s3f=1;Map.prototype.set=ns;
  const P=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype,D=P&&Object.getOwnPropertyDescriptor(P,'font');
  if(!D||!D.set||!D.configurable)return;
  Object.defineProperty(P,'font',{configurable:true,enumerable:D.enumerable,get:D.get,set(v){
    if(typeof v==='string'&&v.charCodeAt(0)===57){
      const m=SIG.exec(v);
      if(m){const c=css(itemOf(this.canvas),m[1]);if(c)v=c}
    }
    D.set.call(this,v);
  }});
}

/* ===== font sendiri (IndexedDB) ===== */
let dbp;
const odb=()=>dbp||(dbp=new Promise((res,rej)=>{const r=indexedDB.open('apk-3d-fonts',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('fonts',{keyPath:'name'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
async function dbx(mode,fn){const d=await odb();return new Promise((res,rej)=>{const t=d.transaction('fonts',mode),o=fn(t.objectStore('fonts'));
  t.oncomplete=()=>res(o.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
async function regFace(name,blob){
  const ff=new FontFace(name,await blob.arrayBuffer(),{weight:'100 900'});
  await ff.load();document.fonts.add(ff);
  if(CUST[name]){try{document.fonts.delete(CUST[name])}catch(_){}}
  CUST[name]=ff;
  if(!REG[name])add({n:name,w:700,cat:'my',custom:1,stack:stackOf(name)});
}
async function loadCustom(){
  try{
    const all=await dbx('readonly',s=>s.getAll());
    for(const r of all||[]){try{await regFace(r.name,r.blob)}catch(_){}}
    if(all&&all.length){rerender();refreshBtn()}
  }catch(_){}
}
async function addCustom(file){
  let n=file.name.replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9 _-]/g,' ').replace(/\s+/g,' ').trim().slice(0,28)||'Font saya';
  if(REG[n]&&!REG[n].custom)n='Saya '+n;
  try{
    await regFace(n,file);
    try{await dbx('readwrite',s=>s.put({name:n,blob:file}))}catch(_){toast('Font dipakai, tapi tidak bisa disimpan permanen di perangkat ini')}
    tab='my';$('s3-fd-q').value='';list();rerender();toast('Font "'+n+'" ditambahkan. Ketuk untuk memakainya.');
  }catch(err){toast('File font tidak bisa dibaca. Pakai file .ttf, .otf, .woff, atau .woff2')}
}
async function delCustom(n){
  if(!confirm('Hapus font "'+n+'" dari perangkat ini? Teks yang memakainya kembali ke font bawaan.'))return;
  try{await dbx('readwrite',s=>s.delete(n))}catch(_){}
  try{CUST[n]&&document.fonts.delete(CUST[n])}catch(_){}
  delete CUST[n];delete REG[n];
  const i=ALL.findIndex(f=>f.n===n);if(i>=0)ALL.splice(i,1);
  list();rerender();refreshBtn();
}

/* ===== antarmuka ===== */
const CSS=`.s3-fontpick{margin-bottom:10px}
.s3-fp-l{display:block;color:var(--dim);font-size:12px;margin-bottom:4px}
.s3-fp-b{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:8px 10px;font:inherit;cursor:pointer;text-align:left}
.s3-fp-b .n{font-size:22px;line-height:1.2;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s3-fp-b small{flex:none;color:var(--dim);font-size:12px}
#s3-dlg-font{width:min(640px,100vw);max-width:100vw;max-height:52vh;margin:auto auto 0;padding:10px 12px 12px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:14px 14px 0 0;overflow:hidden}
#s3-dlg-font[open]{display:flex;flex-direction:column}
#s3-dlg-font::backdrop{background:rgba(0,0,0,.2)}
.s3-fd-q{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:8px;font:inherit;flex:none}
.s3-fd-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 0 4px;flex:none;scrollbar-width:thin}
.s3-fd-list{flex:1;min-height:90px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;margin:6px 0;overscroll-behavior:contain}
.s3-fd-item{display:flex;align-items:stretch;border-bottom:1px solid var(--line)}
.s3-fd-row{flex:1;min-width:0;display:flex;align-items:center;gap:10px;background:transparent;color:var(--text);border:0;padding:8px 10px;font:inherit;cursor:pointer;text-align:left}
.s3-fd-row.on{background:var(--accent);color:var(--accent-ink)}
.s3-fd-row .s{flex:1;min-width:0;font-size:22px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s3-fd-row .n{flex:none;max-width:42%;font:11px system-ui,sans-serif;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s3-fd-row.bad .n::after{content:" · gagal dimuat"}
.s3-fd-x{flex:none;background:var(--panel2);color:var(--text);border:0;border-left:1px solid var(--line);padding:0 12px;cursor:pointer}
.s3-fd-act{display:flex;gap:8px;justify-content:space-between;flex:none}
#s3-fd-msg{margin:0 0 6px;font-size:12px;color:var(--dim);flex:none}`;
let tab='est',gen=0;
function curItem(){const s=sc(),c=document.querySelector('#s3-chips .on'),id=c&&c.dataset.sel;return s&&id?s.items.find(i=>i.id===id)||null:null}
function btnHtml(it){
  const f=it&&it.font&&REG[it.font],u=f&&!f.def?f:REG['Arial Black'];
  return '<span class="n" style="font-family:'+esc(u.stack)+';font-weight:'+u.w+'">'+esc(f&&!f.def?f.n:'Bawaan (Arial Black)')+'</span><small>Ganti ▸</small>';
}
function refreshBtn(){const b=document.querySelector('#s3-props .s3-fp-b'),it=curItem();if(b&&it&&it.kind==='text')b.innerHTML=btnHtml(it)}
function markRows(){
  document.querySelectorAll('#s3-fd-list .s3-fd-row').forEach(b=>{const s=ST[b.dataset.fn];b.classList.toggle('bad',!!s&&s.s==='fail')});
}
function inject(){
  const box=$('s3-props');if(!box||box.querySelector('.s3-fontpick'))return;
  const ta=box.querySelector('textarea[data-f="text"]'),it=curItem();
  if(!ta||!it||it.kind!=='text')return;
  const lab=ta.closest('label');if(!lab)return;
  const w=document.createElement('div');w.className='s3-fontpick';
  w.innerHTML='<span class="s3-fp-l">Jenis huruf (font)</span><button type="button" class="s3-fp-b" aria-label="Pilih font">'+btnHtml(it)+'</button><input type="hidden" data-f="font" value="'+esc(it.font||'')+'">';
  w.querySelector('button').onclick=openPicker;
  lab.insertAdjacentElement('afterend',w);
  if(it.font&&REG[it.font])ensure(REG[it.font]);
}
function sample(it){const t=String((it&&it.text)||'').split('\n')[0].trim().slice(0,26);return t||'Aa Bb Cc 123'}
function list(){
  const it=curItem(),cur=(it&&it.font)||'',q=$('s3-fd-q').value.trim().toLowerCase(),smp=sample(it);
  document.querySelectorAll('#s3-fd-tabs [data-tab]').forEach(b=>b.classList.toggle('on',!q&&b.dataset.tab===tab));
  const L=q?ALL.filter(f=>f.n.toLowerCase().includes(q)).slice(0,60):ALL.filter(f=>f.cat===tab);
  $('s3-fd-list').innerHTML=L.length?L.map(f=>{
    const on=f.def?!cur:f.n===cur;
    return '<div class="s3-fd-item"><button type="button" class="s3-fd-row'+(on?' on':'')+'" data-fn="'+esc(f.n)+'"><span class="s" style="font-family:'+esc(f.stack)+';font-weight:'+f.w+'">'+esc(smp)+'</span><span class="n">'+esc(f.n)+'</span></button>'
      +(f.custom?'<button type="button" class="s3-fd-x" data-fdel="'+esc(f.n)+'" aria-label="Hapus font '+esc(f.n)+'">✕</button>':'')+'</div>';
  }).join(''):'<p class="meta" style="padding:12px">'+(q?'Tidak ada font dengan nama itu.':'Belum ada font sendiri. Ketuk "+ Font sendiri", lalu pilih file .ttf, .otf, atau .woff.')+'</p>';
  $('s3-fd-msg').textContent=q?NOTE_WEB:(NOTE[tab]||NOTE_WEB);
  const g=++gen;   /* pratinjau dimuat bergantian supaya tidak menembak puluhan permintaan sekaligus */
  L.forEach((f,i)=>{if(!f.sys&&!f.custom)setTimeout(()=>{if(g===gen)ensure(f)},i*70)});
  markRows();
  const on=$('s3-fd-list').querySelector('.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest'});
  const tb=document.querySelector('#s3-fd-tabs .on');if(tb&&tb.scrollIntoView)tb.scrollIntoView({block:'nearest',inline:'nearest'});
}
function pick(n){
  const f=REG[n],inp=document.querySelector('#s3-props input[data-f="font"]'),it=curItem();
  if(!f||!inp||!it)return;
  if(ST[n]&&ST[n].s==='fail')delete ST[n];
  inp.value=f.def?'':f.n;
  inp.dispatchEvent(new Event('input',{bubbles:true}));   /* ditangkap panel properti: menyimpan, undo/redo, dan menggambar ulang */
  ensure(f);refreshBtn();
  document.querySelectorAll('#s3-fd-list .s3-fd-row').forEach(b=>b.classList.toggle('on',b.dataset.fn===n));
}
function buildDlg(){
  if($('s3-dlg-font'))return;
  const d=document.createElement('dialog');d.id='s3-dlg-font';
  d.innerHTML='<input class="s3-fd-q" id="s3-fd-q" type="search" placeholder="Cari font…" aria-label="Cari font" autocomplete="off">'
    +'<div class="s3-fd-tabs" id="s3-fd-tabs">'+CAT.map(([id,l])=>'<button type="button" class="s3-chip" data-tab="'+id+'">'+esc(l)+'</button>').join('')+'</div>'
    +'<div class="s3-fd-list" id="s3-fd-list"></div><p id="s3-fd-msg"></p>'
    +'<div class="s3-fd-act"><button class="btn" type="button" id="s3-fd-add">+ Font sendiri</button><button class="btn primary" type="button" id="s3-fd-close">Selesai</button></div>'
    +'<input type="file" id="s3-fd-file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden>';
  document.body.appendChild(d);
  $('s3-fd-q').oninput=list;
  $('s3-fd-tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;$('s3-fd-q').value='';list()}};
  $('s3-fd-list').onclick=e=>{
    const x=e.target.closest('[data-fdel]');if(x){delCustom(x.dataset.fdel);return}
    const b=e.target.closest('[data-fn]');if(b)pick(b.dataset.fn);
  };
  $('s3-fd-add').onclick=()=>$('s3-fd-file').click();
  $('s3-fd-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await addCustom(f)};
  $('s3-fd-close').onclick=()=>d.close();
  d.addEventListener('click',e=>{if(e.target===d)d.close()});
  d.addEventListener('close',()=>{gen++});
}
function openPicker(){
  const it=curItem();if(!it||it.kind!=='text')return;
  buildDlg();
  const cf=it.font&&REG[it.font];if(cf)tab=cf.cat;
  $('s3-fd-q').value='';list();
  $('s3-dlg-font').showModal();
}
/* export / kirim ke editor ditahan sebentar kalau font yang dipakai scene belum selesai dimuat (supaya tidak ikut font cadangan) */
function guard(e){if(busy()){e.stopImmediatePropagation();e.preventDefault();toast('Font teks masih dimuat. Tunggu sebentar lalu tekan Mulai Export lagi.')}}

function init(){
  if(!$('s3d'))return;
  const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
  hooks();
  const pr=$('s3-props');if(pr)new MutationObserver(inject).observe(pr,{childList:true});
  const xb=$('s3-ex-start');if(xb)xb.addEventListener('click',guard,true);
  APK.s3fonts={fonts:ALL,ensure,css};
  loadCustom();
}
try{init()}catch(e){console.error('Font Edit 3D gagal dimuat',e)}
})();
