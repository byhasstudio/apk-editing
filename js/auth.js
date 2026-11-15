/* LOGIN GOOGLE (GMAIL) SplineWay: masuk dengan Google lewat Firebase Authentication, keluar lewat tombol "Keluar" di beranda.
   Dimuat di <head> tepat setelah js/device.js, SEBELUM js/db.js membuka database.
   Firebase SDK (compat) baru diunduh saat layar masuk tampil, jadi buka aplikasi setelah login tidak lebih lambat.
   Sesi disimpan sendiri di sini (localStorage / sessionStorage), jadi Firebase dipakai tanpa persistensi (Persistence.NONE).
   Project tiap akun dipisah: semua IndexedDB aplikasi (apk-editing, apk-3d, dst.) dibuka dengan nama + "@id-akun".
   Itu dilakukan dengan membungkus indexedDB.open dan deleteDatabase di sini, jadi db.js dan scene3d.js tidak perlu diubah.
   - Akun Google PERTAMA yang masuk di perangkat ini memakai nama database lama (tanpa akhiran), jadi project yang sudah ada tetap miliknya.
   - Sebelum masuk, aplikasi memakai database kosong "@guest" dan ditutup layar masuk.
   - Masuk berhasil -> sesi disimpan -> halaman dimuat ulang supaya semua modul membuka database akun itu.
   - Sesi: "Tetap masuk" dicentang -> localStorage (bertahan); tidak -> sessionStorage (hilang saat aplikasi ditutup).
   - Keluar: tombol "Keluar" di beranda (project sudah tersimpan otomatis di sana).
   SYARAT DI FIREBASE CONSOLE: Authentication > Sign-in method > Google harus Enabled, dan Authentication > Settings > Authorized domains
   harus memuat domain tempat aplikasi dibuka (mis. byhasstudio.github.io). Cek juga FB_CFG di bawah (authDomain dan projectId).
   Batas yang jujur: data project tetap tersimpan di perangkat (IndexedDB), tidak ikut ke perangkat lain. Akun hanya memisahkan project per akun Google. */
(function(){
'use strict';
if(window.__swAuth)return;window.__swAuth=1;
const FB_CFG={apiKey:'AIzaSyBahNCBMGHzRBTIT4aE2PMHDdTEQVgQkp4',authDomain:'splineway.firebaseapp.com',projectId:'splineway'};
const SDK='https://www.gstatic.com/firebasejs/10.14.1/';
const AUTH_DB='splineway-auth',SKEY='splineway:session',LKEY='splineway:legacy-owner',RKEY='splineway:redirect-keep';
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
function mapName(n){n=String(n);if(n===AUTH_DB||/^firebase/i.test(n))return n;if(!S)return n+'@guest';return S.legacy?n:n+'@'+S.id}
proto.open=function(name){return rawOpen.apply(this,[mapName(name)].concat([].slice.call(arguments,1)))};
proto.deleteDatabase=function(name){return rawDelete.call(this,mapName(name))};
if(!S)document.documentElement.classList.add('au-out');

/* ---------- sesi ---------- */
function logout(){
  try{localStorage.removeItem(SKEY)}catch(e){}
  try{sessionStorage.removeItem(SKEY)}catch(e){}
  location.reload();
}
function login(user,keep){
  const id='g'+user.uid;
  let legacy=false;
  try{
    const owner=localStorage.getItem(LKEY);
    if(!owner){localStorage.setItem(LKEY,id);legacy=true}
    else legacy=owner===id;
  }catch(e){}
  const v=JSON.stringify({id:id,name:user.email||user.displayName||id,legacy:legacy});
  try{(keep?localStorage:sessionStorage).setItem(SKEY,v)}catch(e){return false}
  location.reload();return true;
}

/* ---------- Firebase (dimuat saat dibutuhkan) ---------- */
function loadScript(src){return new Promise(function(res,rej){
  const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('sdk'))};document.head.appendChild(s);
})}
async function getAuth(){
  if(!(window.firebase&&firebase.auth)){
    await loadScript(SDK+'firebase-app-compat.js');
    await loadScript(SDK+'firebase-auth-compat.js');
  }
  if(!firebase.apps.length)firebase.initializeApp(FB_CFG);
  const a=firebase.auth();
  await a.setPersistence(firebase.auth.Auth.Persistence.NONE);
  return a;
}
function explain(e){
  const c=(e&&e.code)||'';
  if(e&&e.message==='sdk')return 'Tidak bisa memuat Firebase. Periksa koneksi internet.';
  if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request')return 'Masuk dibatalkan.';
  if(c==='auth/network-request-failed')return 'Tidak ada koneksi internet.';
  if(c==='auth/unauthorized-domain')return 'Domain ini belum didaftarkan di Firebase (Authentication > Settings > Authorized domains).';
  if(c==='auth/operation-not-allowed')return 'Login Google belum diaktifkan di Firebase (Authentication > Sign-in method > Google).';
  if(c==='auth/user-disabled')return 'Akun ini dinonaktifkan.';
  return 'Gagal masuk dengan Google. Coba lagi.';
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
    '#auth-ui .au-sub{margin:4px 0 18px;text-align:center;color:#9aa3c7}',
    '#auth-ui .au-ck{display:flex;align-items:center;gap:8px;margin:0 0 8px;color:#c6ccea;font-size:13px;cursor:pointer}',
    '#auth-ui .au-err{min-height:18px;margin:4px 0 10px;color:#ff8a8a;font-size:13px}',
    '#auth-ui .au-go{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:10px;padding:12px;background:#fff;color:#1f1f1f;font:600 16px system-ui,sans-serif;cursor:pointer}',
    '#auth-ui .au-go:disabled{opacity:.6;cursor:default}',
    '#auth-ui .au-go svg{width:20px;height:20px;flex:none}',
    '#auth-ui .au-note{margin:14px 0 0;color:#7e87ad;font-size:12px;line-height:1.45;text-align:center}'
  ].join('\n');
  document.head.appendChild(s);
}
const G_LOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function mountAuth(){
  addCss();
  const box=document.createElement('div');box.id='auth-ui';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Masuk ke SplineWay');
  box.innerHTML=
    '<div class="au-card">'+
      '<div class="au-logo" role="img" aria-label="SplineWay"></div>'+
      '<h1>SplineWay</h1><p class="au-sub">Masuk dengan akun Google (Gmail) untuk membuka project kamu.</p>'+
      '<label class="au-ck"><input type="checkbox" id="au-keep" checked> Tetap masuk di perangkat ini</label>'+
      '<p class="au-err" id="au-err" role="alert"></p>'+
      '<button class="au-go" id="au-go" type="button">'+G_LOGO+'<span id="au-lbl">Masuk dengan Google</span></button>'+
      '<p class="au-note">Project disimpan di perangkat ini dan dipisah per akun Google. Akun Google pertama yang masuk di perangkat ini otomatis memegang project yang sudah ada.</p>'+
    '</div>';
  document.body.appendChild(box);
  const go=box.querySelector('#au-go'),lbl=box.querySelector('#au-lbl'),errEl=box.querySelector('#au-err'),keep=box.querySelector('#au-keep');
  let busy=false;
  function err(m){errEl.textContent=m||''}
  function setBusy(b,t){busy=b;go.disabled=b;lbl.textContent=t||'Masuk dengan Google'}
  function done(user,k){
    if(login(user,k))return;
    setBusy(false);err('Penyimpanan peramban diblokir, sesi tidak bisa disimpan.');
  }
  go.onclick=async function(){
    if(busy)return;
    err('');setBusy(true,'Membuka Google...');
    try{
      const auth=await getAuth();
      const provider=new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      try{
        const r=await auth.signInWithPopup(provider);
        done(r.user,keep.checked);return;
      }catch(e){
        if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')){
          try{sessionStorage.setItem(RKEY,keep.checked?'1':'0')}catch(x){}
          await auth.signInWithRedirect(provider);return;
        }
        throw e;
      }
    }catch(e){setBusy(false);err(explain(e))}
  };
  /* kembali dari signInWithRedirect */
  let pending=null;
  try{pending=sessionStorage.getItem(RKEY)}catch(e){}
  if(pending!==null){
    setBusy(true,'Menyelesaikan masuk...');
    getAuth().then(function(a){return a.getRedirectResult()}).then(function(r){
      try{sessionStorage.removeItem(RKEY)}catch(e){}
      if(r&&r.user)done(r.user,pending==='1');else setBusy(false);
    }).catch(function(e){
      try{sessionStorage.removeItem(RKEY)}catch(x){}
      setBusy(false);err(explain(e));
    });
  }
}
function mountUserBar(){
  const a=document.querySelector('.home-head .actions');
  if(!a||document.getElementById('btn-logout'))return;
  const chip=document.createElement('span');
  chip.className='meta';chip.id='au-chip';chip.textContent=S.name;chip.title='Akun yang sedang masuk';
  chip.style.cssText='align-self:center;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
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
