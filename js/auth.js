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
   - Sesi menyimpan refresh token Firebase (rt). Dipakai js/sync.js untuk sinkron project ke cloud (Firebase Storage + Realtime Database).
     Sesi lama tanpa rt tetap bisa dipakai, tapi sinkron baru aktif setelah Keluar lalu Masuk lagi.
   - Keluar: tombol "Keluar" di beranda (project sudah tersimpan otomatis di sana).

   LOGIN LEWAT CHROME (untuk APK / WebView / browser dalam aplikasi):
   Google memblokir login di dalam WebView (disallowed_useragent), jadi di sana tombol Google diganti alur kode:
   1) Aplikasi membuat kode acak 10 karakter dan menampilkannya, lalu memeriksa Realtime Database tiap 2 detik (REST, tanpa SDK).
   2) Pengguna membuka tautan  APP_URL?link=KODE  di Chrome, masuk dengan Google di sana.
   3) Halaman Chrome menulis loginLinks/KODE = {uid, email, name, rt, created} memakai ID token Firebase (auth=...).
   4) Aplikasi menemukan data itu, menghapusnya, lalu masuk sebagai akun tersebut. Kode hanya berlaku 10 menit sejak dibuat di aplikasi.
   SYARAT DI FIREBASE CONSOLE: Realtime Database > Rules harus memuat blok "loginLinks" (lihat commit message / README).
   Database yang dipakai sama dengan js/qrlink.js (DB di bawah).

   SYARAT DI FIREBASE CONSOLE (umum): Authentication > Sign-in method > Google harus Enabled, dan Authentication > Settings > Authorized domains
   harus memuat domain tempat aplikasi dibuka (mis. byhasstudio.github.io). Cek juga FB_CFG di bawah (authDomain dan projectId).
   Data project tetap disimpan di perangkat (IndexedDB); salinan cloud dikelola js/sync.js. Akun memisahkan project per akun Google. */
(function(){
'use strict';
if(window.__swAuth)return;window.__swAuth=1;
const FB_CFG={apiKey:'AIzaSyBahNCBMGHzRBTIT4aE2PMHDdTEQVgQkp4',authDomain:'splineway.firebaseapp.com',projectId:'splineway'};
const SDK='https://www.gstatic.com/firebasejs/10.14.1/';
const AUTH_DB='splineway-auth',SKEY='splineway:session',LKEY='splineway:legacy-owner',RKEY='splineway:redirect-keep',CKEY='splineway:linkcode';
const APP_URL='https://byhasstudio.github.io/apk-editing/';
const DB='https://splineway-default-rtdb.asia-southeast1.firebasedatabase.app';
const LINKS=DB+'/loginLinks';
const ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789',CODE_RE=/^[A-HJKMNP-Z2-9]{10}$/,CODE_TTL=600000;
const proto=window.IDBFactory&&IDBFactory.prototype;
if(!proto||!window.indexedDB)return;
const rawOpen=proto.open,rawDelete=proto.deleteDatabase;

/* Deteksi WebView / browser dalam aplikasi: di sini login Google langsung diblokir Google */
const WV=(function(){
  const u=navigator.userAgent||'';
  try{if(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform())return true}catch(e){}
  if(/; wv\)|\bwv\b|FBAN|FBAV|Instagram|Line\/|MicroMessenger/.test(u))return true;
  if(/Android/.test(u)&&/Chrome\//.test(u)&&/Version\/\d+\.\d+/.test(u)&&!/SamsungBrowser|OPR\/|EdgA/.test(u))return true;
  return false;
})();
/* Halaman Chrome yang dibuka dari tautan ?link=KODE */
const LINK=(function(){
  try{const c=(new URLSearchParams(location.search).get('link')||'').toUpperCase();return CODE_RE.test(c)?c:''}catch(e){return ''}
})();
const LINK_MODE=!!LINK&&!WV;

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
if(!S||LINK_MODE)document.documentElement.classList.add('au-out');

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
  const v=JSON.stringify({id:id,name:user.email||user.displayName||id,legacy:legacy,rt:user.refreshToken||''});
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
  if(c==='auth/popup-blocked')return 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
  if(c==='auth/network-request-failed')return 'Tidak ada koneksi internet.';
  if(c==='auth/unauthorized-domain')return 'Domain ini belum didaftarkan di Firebase (Authentication > Settings > Authorized domains).';
  if(c==='auth/operation-not-allowed')return 'Login Google belum diaktifkan di Firebase (Authentication > Sign-in method > Google).';
  if(c==='auth/user-disabled')return 'Akun ini dinonaktifkan.';
  return 'Gagal masuk dengan Google. Coba lagi.';
}

/* ---------- kode penghubung (APK <-> Chrome) lewat Realtime Database REST ---------- */
function newCode(){
  const a=new Uint8Array(10);
  try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<10;i++)a[i]=Math.floor(Math.random()*256)}
  let c='';for(let i=0;i<10;i++)c+=ALPHA[a[i]%ALPHA.length];
  return c;
}
function getCode(){
  try{
    const o=JSON.parse(localStorage.getItem(CKEY)||'null');
    if(o&&CODE_RE.test(o.c)&&Date.now()-o.t<CODE_TTL)return o;
  }catch(e){}
  const o={c:newCode(),t:Date.now()};
  try{localStorage.setItem(CKEY,JSON.stringify(o))}catch(e){}
  return o;
}
async function checkLink(code){
  const r=await fetch(LINKS+'/'+code+'.json',{cache:'no-store'});
  if(!r.ok){const e=new Error('db');e.status=r.status;throw e}
  const j=await r.json();
  if(!j||typeof j.uid!=='string'||!j.uid)return null;
  return {uid:j.uid,email:String(j.email||''),displayName:String(j.name||''),refreshToken:String(j.rt||'')};
}
function dropLink(code){
  return fetch(LINKS+'/'+code+'.json',{method:'DELETE'}).catch(function(){});
}

/* ---------- tampilan ---------- */
function addCss(){
  if(document.getElementById('au-css'))return;
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
    '#auth-ui .au-go{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border:0;border-radius:10px;padding:12px;background:#fff;color:#1f1f1f;font:600 16px system-ui,sans-serif;cursor:pointer;text-decoration:none}',
    '#auth-ui .au-go:disabled{opacity:.6;cursor:default}',
    '#auth-ui .au-go svg{width:20px;height:20px;flex:none}',
    '#auth-ui .au-alt{margin-top:8px;background:#1d2552;color:#fff}',
    '#auth-ui .au-code{margin:2px 0 14px;text-align:center;font:700 26px ui-monospace,Menlo,monospace;letter-spacing:3px;color:#fff;user-select:all;-webkit-user-select:all}',
    '#auth-ui .au-st{margin:12px 0 0;text-align:center;color:#9aa3c7;font-size:13px}',
    '#auth-ui .au-note{margin:14px 0 0;color:#7e87ad;font-size:12px;line-height:1.45;text-align:center}'
  ].join('\n');
  document.head.appendChild(s);
}
const G_LOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
function fmtCode(c){return c.slice(0,5)+'-'+c.slice(5)}
function makeBox(html,label){
  addCss();
  const box=document.createElement('div');box.id='auth-ui';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',label);
  box.innerHTML='<div class="au-card"><div class="au-logo" role="img" aria-label="SplineWay"></div>'+html+'</div>';
  document.body.appendChild(box);
  return box;
}

/* --- layar masuk biasa (browser) --- */
function mountAuth(){
  const box=makeBox(
    '<h1>SplineWay</h1><p class="au-sub">Masuk dengan akun Google (Gmail) untuk membuka project kamu.</p>'+
    '<label class="au-ck"><input type="checkbox" id="au-keep" checked> Tetap masuk di perangkat ini</label>'+
    '<p class="au-err" id="au-err" role="alert"></p>'+
    '<button class="au-go" id="au-go" type="button">'+G_LOGO+'<span id="au-lbl">Masuk dengan Google</span></button>'+
    '<p class="au-note">Project disimpan di perangkat ini dan disalin ke cloud lewat tombol Sinkron, dipisah per akun Google. Akun Google pertama yang masuk di perangkat ini otomatis memegang project yang sudah ada.</p>',
    'Masuk ke SplineWay');
  const go=box.querySelector('#au-go'),lbl=box.querySelector('#au-lbl'),errEl=box.querySelector('#au-err'),keep=box.querySelector('#au-keep');
  let busy=false;
  function err(m){errEl.textContent=m||''}
  function setBusy(b,t){busy=b;go.disabled=b;lbl.textContent=t||'Masuk dengan Google'}
  function done(user,k){
    if(login(user,k))return;
    setBusy(false);err('Penyimpanan peramban diblokir, sesi tidak bisa disimpan.');
  }
  getAuth().catch(function(){}); /* unduh SDK lebih awal supaya popup tidak diblokir */
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
      if(r&&r.user)done(r.user,pending==='1');else{setBusy(false);err('Login tidak selesai. Coba lagi.')}
    }).catch(function(e){
      try{sessionStorage.removeItem(RKEY)}catch(x){}
      setBusy(false);err(explain(e));
    });
  }
}

/* --- layar masuk di APK / WebView: tampilkan kode, login dilakukan di Chrome --- */
function mountWebViewAuth(){
  const cr=getCode(),code=cr.c,t0=cr.t,url=APP_URL+'?link='+code;
  const box=makeBox(
    '<h1>SplineWay</h1><p class="au-sub">Google tidak mengizinkan login di dalam aplikasi. Masuk lewat Chrome, aplikasi ini akan otomatis ikut masuk.</p>'+
    '<div class="au-code" id="au-code" aria-label="Kode login">'+fmtCode(code)+'</div>'+
    '<label class="au-ck"><input type="checkbox" id="au-keep" checked> Tetap masuk di perangkat ini</label>'+
    '<p class="au-err" id="au-err" role="alert"></p>'+
    '<a class="au-go" id="au-chrome" target="_blank" rel="noopener">Buka di Chrome</a>'+
    '<button class="au-go au-alt" id="au-copy" type="button">Salin tautan</button>'+
    '<p class="au-st" id="au-st">Menunggu login di Chrome...</p>'+
    '<p class="au-note">Kalau tombol tidak membuka Chrome, tekan "Salin tautan", buka Chrome, lalu tempel di kolom alamat. Kode berlaku 10 menit. Project tetap disimpan di perangkat ini dan disalin ke cloud lewat tombol Sinkron.</p>',
    'Masuk ke SplineWay');
  const keep=box.querySelector('#au-keep'),errEl=box.querySelector('#au-err'),st=box.querySelector('#au-st');
  box.querySelector('#au-chrome').href=url;
  function err(m){errEl.textContent=m||''}
  box.querySelector('#au-copy').onclick=function(){
    const p=(navigator.clipboard&&navigator.clipboard.writeText)?navigator.clipboard.writeText(url):Promise.reject();
    p.then(function(){st.textContent='Tautan disalin. Tempel di Chrome.'},function(){window.prompt('Salin tautan ini lalu buka di Chrome:',url)});
  };
  let stop=false,running=false,fails=0,timer=0;
  async function tick(){
    if(stop||running)return;
    running=true;
    try{
      const u=await checkLink(code);fails=0;err('');
      if(u){
        stop=true;st.textContent='Berhasil, membuka aplikasi...';
        await dropLink(code);
        try{localStorage.removeItem(CKEY)}catch(e){}
        if(!login(u,keep.checked)){err('Penyimpanan peramban diblokir, sesi tidak bisa disimpan.');stop=false}
        running=false;if(stop)return;
      }
    }catch(e){
      if(++fails>=3)err('Tidak bisa memeriksa login (Rules database belum dipasang, atau koneksi bermasalah).');
    }
    running=false;
    if(Date.now()-t0>CODE_TTL){stop=true;try{localStorage.removeItem(CKEY)}catch(e){}location.reload();return}
    timer=setTimeout(tick,2000);
  }
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden&&!stop){clearTimeout(timer);tick()}
  });
  tick();
}

/* --- halaman Chrome (?link=KODE): masuk Google lalu hubungkan ke aplikasi --- */
function mountLinkPage(){
  const box=makeBox(
    '<h1>Hubungkan ke aplikasi</h1><p class="au-sub">Masuk dengan Google di sini, lalu kembali ke aplikasi SplineWay. Kode: <b>'+fmtCode(LINK)+'</b></p>'+
    '<p class="au-err" id="au-err" role="alert"></p>'+
    '<button class="au-go" id="au-go" type="button">'+G_LOGO+'<span id="au-lbl">Masuk dengan Google</span></button>'+
    '<p class="au-note">Pastikan kode di atas sama dengan yang tampil di aplikasi.</p>',
    'Hubungkan SplineWay');
  const go=box.querySelector('#au-go'),lbl=box.querySelector('#au-lbl'),errEl=box.querySelector('#au-err');
  let busy=false;
  function err(m){errEl.textContent=m||''}
  function setBusy(b,t){busy=b;go.disabled=b;lbl.textContent=t||'Masuk dengan Google'}
  getAuth().catch(function(){});
  go.onclick=async function(){
    if(busy)return;
    err('');setBusy(true,'Membuka Google...');
    try{
      const auth=await getAuth();
      const provider=new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      const r=await auth.signInWithPopup(provider);
      setBusy(true,'Menghubungkan...');
      const u=r.user,token=await u.getIdToken();
      const res=await fetch(LINKS+'/'+LINK+'.json?auth='+encodeURIComponent(token),{
        method:'PUT',
        body:JSON.stringify({uid:u.uid,email:u.email||'',name:u.displayName||'',rt:u.refreshToken||'',created:{'.sv':'timestamp'}})
      });
      try{await auth.signOut()}catch(x){}
      if(res.status===401||res.status===403){setBusy(false);err('Firebase menolak. Kode ini mungkin sudah dipakai (buka lagi dari aplikasi untuk kode baru), atau Rules database belum dipasang.');return}
      if(!res.ok){setBusy(false);err('Gagal menghubungkan (kode '+res.status+'). Coba lagi.');return}
      box.querySelector('.au-card').innerHTML=
        '<h1>Berhasil</h1><p class="au-sub">Kembali ke aplikasi SplineWay, kamu akan otomatis masuk. Halaman ini boleh ditutup.</p>';
    }catch(e){setBusy(false);err(explain(e))}
  };
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
ready(function(){
  if(LINK_MODE)mountLinkPage();
  else if(S)mountUserBar();
  else if(WV)mountWebViewAuth();
  else mountAuth();
});
window.APK=window.APK||{};
APK.auth={get user(){return S?S.name:null},get session(){return S},logout:logout};
})();
