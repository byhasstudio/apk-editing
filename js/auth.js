/* AKUN LOKAL SplineWay: daftar, masuk, keluar. Dimuat di <head> tepat setelah js/device.js, SEBELUM js/db.js membuka database.
   Tanpa server dan tanpa API key: akun disimpan di IndexedDB perangkat ini (database "splineway-auth"). Kata sandi tidak disimpan,
   hanya hasil PBKDF2-SHA256 (210.000 putaran, garam acak per akun).
   Project tiap akun dipisah: semua IndexedDB aplikasi (apk-editing, apk-3d, dst.) dibuka dengan nama + "@id-akun".
   Itu dilakukan dengan membungkus indexedDB.open dan deleteDatabase di sini, jadi db.js dan scene3d.js tidak perlu diubah.
   - Akun PERTAMA yang dibuat di perangkat ini memakai nama database lama (tanpa akhiran), jadi project yang sudah ada tetap miliknya.
   - Sebelum masuk, aplikasi memakai database kosong "@guest" dan ditutup layar masuk.
   - Masuk atau daftar berhasil -> sesi disimpan -> halaman dimuat ulang supaya semua modul membuka database akun itu.
   - Sesi: "Tetap masuk" dicentang -> localStorage (bertahan); tidak -> sessionStorage (hilang saat aplikasi ditutup).
   - Keluar: tombol "Keluar" di beranda (project sudah tersimpan otomatis di sana).
   - 5 kali salah berturut-turut -> tunggu 30 detik.
   Batas yang jujur: ini pembatas akses di perangkat, bukan keamanan server. Lupa kata sandi tidak bisa dipulihkan, dan data tidak ikut
   ke perangkat lain (pakai Simpan ke File / preset untuk memindahkan). Kalau suatu hari butuh akun online, ganti sumber akun di sini. */
(function(){
'use strict';
if(window.__swAuth)return;window.__swAuth=1;
const AUTH_DB='splineway-auth',SKEY='splineway:session',FKEY='splineway:authfail',ITER=210000;
const NAME_RE=/^[a-z0-9_.-]{3,24}$/;
const proto=window.IDBFactory&&IDBFactory.prototype;
if(!proto||!window.indexedDB)return;
const rawOpen=proto.open,rawDelete=proto.deleteDatabase;

function readSession(){
  let s=null;
  [function(){return localStorage},function(){return sessionStorage}].forEach(function(f){
    if(s)return;
    try{const v=f().getItem(SKEY);if(v){const o=JSON.parse(v);if(o&&o.id&&o.name)s=o}}catch(e){}
  });
  return s;
}
const S=readSession();
function mapName(n){n=String(n);if(n===AUTH_DB)return n;if(!S)return n+'@guest';return S.legacy?n:n+'@'+S.id}
proto.open=function(name){return rawOpen.apply(this,[mapName(name)].concat([].slice.call(arguments,1)))};
proto.deleteDatabase=function(name){return rawDelete.call(this,mapName(name))};
if(!S)document.documentElement.classList.add('au-out');

/* ---------- penyimpanan akun ---------- */
function authDb(){return new Promise(function(res,rej){
  const r=rawOpen.call(indexedDB,AUTH_DB,1);
  r.onupgradeneeded=function(){const st=r.result.createObjectStore('users',{keyPath:'id'});st.createIndex('name','name',{unique:true})};
  r.onsuccess=function(){res(r.result)};
  r.onerror=function(){rej(r.error)};
})}
function getByName(name){
  return authDb().then(function(db){return new Promise(function(res,rej){
    const q=db.transaction('users','readonly').objectStore('users').index('name').get(name);
    q.onsuccess=function(){res(q.result)};q.onerror=function(){rej(q.error)};
  })});
}
function newId(){return 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function createUser(name,salt,hash){
  return authDb().then(function(db){return new Promise(function(res,rej){
    const t=db.transaction('users','readwrite'),st=t.objectStore('users');
    const user={id:newId(),name:name,salt:salt,hash:hash,iter:ITER,created:Date.now(),legacy:false};
    const c=st.count();
    c.onsuccess=function(){user.legacy=c.result===0;st.add(user)};
    t.oncomplete=function(){res(user)};
    t.onabort=function(){rej(t.error||new Error('gagal'))};
  })});
}
async function derive(pw,salt,iter){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt,iterations:iter},key,256));
}
function same(a,b){
  if(!a||!b||a.length!==b.length)return false;
  let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;
}

/* ---------- percobaan salah ---------- */
function lockLeft(){try{const o=JSON.parse(localStorage.getItem(FKEY)||'{}');return Math.max(0,(o.until||0)-Date.now())}catch(e){return 0}}
function noteFail(){try{const o=JSON.parse(localStorage.getItem(FKEY)||'{}');o.n=(o.n||0)+1;if(o.n>=5){o.until=Date.now()+30000;o.n=0}localStorage.setItem(FKEY,JSON.stringify(o))}catch(e){}}
function noteOk(){try{localStorage.removeItem(FKEY)}catch(e){}}

/* ---------- sesi ---------- */
function logout(){
  try{localStorage.removeItem(SKEY)}catch(e){}
  try{sessionStorage.removeItem(SKEY)}catch(e){}
  location.reload();
}
function login(u,keep){
  const v=JSON.stringify({id:u.id,name:u.name,legacy:!!u.legacy});
  try{(keep?localStorage:sessionStorage).setItem(SKEY,v)}catch(e){return false}
  location.reload();return true;
}

/* ---------- tampilan ---------- */
function addCss(){
  const s=document.createElement('style');s.id='au-css';
  s.textContent=[
    'html.au-out body>*:not(#auth-ui){visibility:hidden!important}',
    '#auth-ui{position:fixed;inset:0;z-index:100000;display:flex;background:#000833;color:#fff;font:15px system-ui,sans-serif;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow:auto;visibility:visible!important}',
    '#auth-ui *{box-sizing:border-box}',
    '#auth-ui .au-card{width:100%;max-width:380px;background:#0b1030;border:1px solid #1d2552;border-radius:18px;padding:24px 20px;margin:auto;box-shadow:0 10px 40px rgba(0,0,0,.5)}',
    '#auth-ui .au-logo{width:72px;height:72px;margin:0 auto 10px;border-radius:18px;background:var(--brand-logo) center/contain no-repeat}',
    '#auth-ui h1{margin:0;text-align:center;font-size:22px}',
    '#auth-ui .au-sub{margin:4px 0 16px;text-align:center;color:#9aa3c7}',
    '#auth-ui .au-tabs{display:flex;gap:6px;background:#060a22;border-radius:10px;padding:4px;margin-bottom:14px}',
    '#auth-ui .au-tabs button{flex:1;border:0;border-radius:8px;padding:9px;background:transparent;color:#9aa3c7;font:600 14px system-ui,sans-serif;cursor:pointer}',
    '#auth-ui .au-tabs button.on{background:#2bd67b;color:#04122a}',
    '#auth-ui label{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;color:#c6ccea;font-size:13px}',
    '#auth-ui label[hidden]{display:none}',
    '#auth-ui input:not([type=checkbox]){width:100%;border:1px solid #2a3470;border-radius:10px;background:#060a22;color:#fff;padding:11px 12px;font:16px system-ui,sans-serif}',
    '#auth-ui input:not([type=checkbox]):focus{outline:2px solid #2bd67b;outline-offset:1px}',
    '#auth-ui .au-ck{flex-direction:row;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer}',
    '#auth-ui .au-err{min-height:18px;margin:4px 0 10px;color:#ff8a8a;font-size:13px}',
    '#auth-ui .au-go{width:100%;border:0;border-radius:10px;padding:12px;background:#2bd67b;color:#04122a;font:700 16px system-ui,sans-serif;cursor:pointer}',
    '#auth-ui .au-go:disabled{opacity:.6;cursor:default}',
    '#auth-ui .au-note{margin:14px 0 0;color:#7e87ad;font-size:12px;line-height:1.45;text-align:center}'
  ].join('\n');
  document.head.appendChild(s);
}
function mountAuth(){
  addCss();
  const box=document.createElement('div');box.id='auth-ui';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Masuk ke SplineWay');
  box.innerHTML=
    '<div class="au-card">'+
      '<div class="au-logo" role="img" aria-label="SplineWay"></div>'+
      '<h1>SplineWay</h1><p class="au-sub" id="au-sub"></p>'+
      '<div class="au-tabs"><button type="button" data-m="in">Masuk</button><button type="button" data-m="up">Daftar</button></div>'+
      '<form id="au-form" novalidate>'+
        '<label>Nama pengguna<input id="au-name" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24"></label>'+
        '<label>Kata sandi<input id="au-pw" type="password" maxlength="128"></label>'+
        '<label id="au-l2">Ulangi kata sandi<input id="au-pw2" type="password" autocomplete="new-password" maxlength="128"></label>'+
        '<label class="au-ck"><input type="checkbox" id="au-show"> Tampilkan kata sandi</label>'+
        '<label class="au-ck"><input type="checkbox" id="au-keep" checked> Tetap masuk di perangkat ini</label>'+
        '<p class="au-err" id="au-err" role="alert"></p>'+
        '<button class="au-go" id="au-go" type="submit"></button>'+
      '</form>'+
      '<p class="au-note">Akun disimpan hanya di perangkat ini, tanpa server. Project tiap akun terpisah; akun pertama yang dibuat di perangkat ini otomatis memegang project yang sudah ada. Kata sandi yang lupa tidak bisa dipulihkan.</p>'+
    '</div>';
  document.body.appendChild(box);
  const $=function(id){return box.querySelector('#'+id)};
  const nameEl=$('au-name'),pw=$('au-pw'),pw2=$('au-pw2'),l2=$('au-l2'),go=$('au-go'),errEl=$('au-err'),sub=$('au-sub'),keep=$('au-keep');
  const tabs=[].slice.call(box.querySelectorAll('.au-tabs button'));
  let mode='in',busy=false;
  function err(m){errEl.textContent=m||''}
  function setMode(m){
    mode=m;
    tabs.forEach(function(b){b.classList.toggle('on',b.dataset.m===m)});
    l2.hidden=m!=='up';
    pw.autocomplete=m==='up'?'new-password':'current-password';
    go.textContent=m==='up'?'Buat akun':'Masuk';
    sub.textContent=m==='up'?'Buat akun untuk menyimpan project kamu.':'Masuk untuk membuka project kamu.';
    err('');
  }
  tabs.forEach(function(b){b.onclick=function(){if(!busy)setMode(b.dataset.m)}});
  $('au-show').onchange=function(){const t=this.checked?'text':'password';pw.type=t;pw2.type=t};
  $('au-form').onsubmit=async function(e){
    e.preventDefault();
    if(busy)return;
    err('');
    const name=nameEl.value.trim().toLowerCase(),pass=pw.value;
    if(!NAME_RE.test(name)){err('Nama pengguna 3 sampai 24 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');return}
    if(pass.length<6){err('Kata sandi minimal 6 karakter.');return}
    if(mode==='up'&&pass!==pw2.value){err('Kata sandi tidak sama.');return}
    if(!window.crypto||!crypto.subtle){err('Akun butuh koneksi aman (https).');return}
    if(mode==='in'){const w=lockLeft();if(w){err('Terlalu banyak percobaan. Coba lagi dalam '+Math.ceil(w/1000)+' detik.');return}}
    busy=true;go.disabled=true;const label=go.textContent;go.textContent='Memproses...';
    try{
      let u;
      if(mode==='in'){
        const rec=await getByName(name);
        let good=false;
        if(rec){good=same(await derive(pass,rec.salt,rec.iter),rec.hash)}
        else{await derive(pass,new Uint8Array(16),ITER)}
        if(!good){noteFail();err('Nama pengguna atau kata sandi salah.');return}
        noteOk();u=rec;
      }else{
        const salt=crypto.getRandomValues(new Uint8Array(16));
        u=await createUser(name,salt,await derive(pass,salt,ITER));
      }
      if(login(u,keep.checked))return;
      err('Penyimpanan peramban diblokir, sesi tidak bisa disimpan.');
    }catch(ex){
      err(ex&&ex.name==='ConstraintError'?'Nama pengguna sudah dipakai.':'Gagal memproses akun. Coba lagi.');
    }finally{
      if(document.getElementById('auth-ui')){busy=false;go.disabled=false;go.textContent=label}
    }
  };
  setMode('in');
  nameEl.focus();
}
function mountUserBar(){
  const a=document.querySelector('.home-head .actions');
  if(!a||document.getElementById('btn-logout'))return;
  const chip=document.createElement('span');
  chip.className='meta';chip.id='au-chip';chip.textContent=S.name;chip.title='Akun yang sedang masuk';
  chip.style.cssText='align-self:center;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  const b=document.createElement('button');
  b.className='btn';b.id='btn-logout';b.textContent='Keluar';b.title='Keluar dari akun';
  b.onclick=logout;
  a.appendChild(chip);a.appendChild(b);
}
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn);else fn()}
ready(function(){if(S)mountUserBar();else mountAuth()});
window.APK=window.APK||{};
APK.auth={get user(){return S?S.name:null},logout:logout};
})();
