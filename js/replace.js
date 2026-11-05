/* Ganti clip: klik clip video/foto/audio di timeline, tekan "Ganti", pilih file baru.
   File baru otomatis diimpor ke daftar Media (kiri atas), lalu clip itu memakai media baru.
   Yang berubah HANYA medianya. Posisi, durasi, track, properti (posisi, ukuran, rotasi, opacity), keyframe, kurva, filter, mask, chroma, efek, fade,
   dan tanda biru tetap sama persis.
   Aturan: clip di track Video bisa diganti video atau foto, track Gambar hanya foto, track Audio hanya audio.
   Video diganti video: mulai dari awal video baru, kecepatan dan arah putar clip tetap. Diganti foto: kecepatan dan putar balik dilepas (foto tidak memakainya).
   Tanda biru dipindah supaya tetap jatuh di waktu timeline yang sama. Dimuat paling akhir (setelah js/fxblue.js). */
window.APK=window.APK||{};
(function(){
  const T=APK.timeline;if(!T)return;
  const $=id=>document.getElementById(id),P=()=>APK.project.current;
  function toast(m){const t=$('toast');if(!t)return;t.textContent=m;t.classList.add('show');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('show'),3200)}
  const media=id=>{const p=P();return p?p.media.find(m=>m.id===id):null};
  const spOf=c=>c.speed||1;
  const srcAt=(c,t)=>c.reverse?c.in+c.dur*spOf(c)-(t-c.start)*spOf(c):c.in+(t-c.start)*spOf(c);
  const timeOf=(c,s)=>c.reverse?c.start+(c.in+c.dur*spOf(c)-s)/spOf(c):c.start+(s-c.in)/spOf(c);
  const find=id=>{const p=P();if(p)for(const tr of p.tracks){const c=tr.clips.find(x=>x.id===id);if(c)return{c,tr}}return null};
  let target=null,inp=null;

  /* clip yang bisa diganti: clip bermedia (bukan teks, bentuk, atau clip efek) */
  function pick(){
    const s=T.selectedClip();
    if(!s||!s.c.mediaId||s.c.fx||s.c.text||s.c.shape||!s.m)return null;
    return s;
  }
  function start(){
    if(!P())return;
    const s=pick();
    if(!s){toast('Klik dulu clip video atau foto yang mau diganti di timeline, lalu tekan Ganti');return}
    if(s.tr.locked){toast('Layer terkunci. Buka kunci dulu');return}
    target=s.c.id;
    inp.accept=s.tr.kind==='audio'?'.mp3,.wav':s.tr.kind==='image'?'.png,.jpg,.jpeg,.webp':'.mp4,.mov,.webm,.png,.jpg,.jpeg,.webp';
    inp.click();
  }
  function apply(clipId,mid){
    const f=find(clipId),m=media(mid);
    if(!f||!m){toast('Clip yang mau diganti sudah tidak ada. Medianya tetap masuk ke daftar Media');return}
    const c=f.c,tr=f.tr;
    if(tr.locked){toast('Layer terkunci. Medianya tetap masuk ke daftar Media');return}
    const ok=tr.kind==='audio'?m.type==='audio':tr.kind==='image'?m.type==='image':m.type!=='audio';
    if(!ok){
      toast(tr.kind==='audio'?'Clip audio hanya bisa diganti file audio. Medianya tetap masuk ke daftar Media'
        :tr.kind==='image'?'Track Gambar hanya bisa diganti foto. Medianya tetap masuk ke daftar Media'
        :'Clip ini tidak bisa diganti file audio. Medianya tetap masuk ke daftar Media');
      return;
    }
    /* tanda biru: catat dulu posisinya di timeline (relatif terhadap awal clip), lalu hitung ulang terhadap media baru */
    let rel=null;
    if(Array.isArray(c.blue)&&c.blue.length)rel=c.blue.map(q=>[timeOf(c,+q[0])-c.start,q[1]]).filter(q=>isFinite(q[0])&&q[0]>=-1e-3&&q[0]<=c.dur+1e-3);
    APK.history.record();
    if(APK.preview&&APK.preview.pause)APK.preview.pause();
    c.mediaId=mid;c.in=0;
    if(m.type==='image'){delete c.speed;delete c.reverse}
    if(rel){
      if(rel.length)c.blue=rel.map(q=>[Math.round(srcAt(c,c.start+Math.max(0,q[0]))*1000)/1000,q[1]]).sort((a,b)=>a[0]-b[0]);
      else delete c.blue;
    }
    /* elemen video/foto lama masih tersimpan di preview: dilepas supaya dimuat ulang dari media baru */
    if(APK.preview&&APK.preview.unload)APK.preview.unload();
    T.commit();
    if(m.type!=='image'&&m.duration>0&&c.dur*spOf(c)>m.duration+0.05)toast('Clip diganti. Video barunya lebih pendek dari clip, jadi bagian akhirnya diam di frame terakhir');
    else toast('Clip diganti. Gerakan, kurva, dan pengaturan lain tetap sama');
  }
  function init(){
    inp=document.createElement('input');inp.type='file';inp.id='file-replace';inp.hidden=true;
    document.body.appendChild(inp);
    inp.onchange=async()=>{
      const file=inp.files&&inp.files[0],id=target;
      inp.value='';target=null;
      if(!file||!id)return;
      const ids=await APK.media.importFiles([file],toast);
      if(ids&&ids.length)apply(id,ids[0]);
    };
    const after=$('tl-dup')||$('tl-split');if(!after)return;
    const b=document.createElement('button');
    b.type='button';b.className='btn';b.id='tl-replace';b.textContent='⇄ Ganti';
    b.title='Ganti media clip terpilih dengan video atau foto baru. Gerakan, kurva, dan pengaturan clip tetap sama, hanya medianya yang berubah. File baru otomatis masuk ke daftar Media.';
    b.onclick=start;
    after.after(b);
  }
  try{init()}catch(e){console.error('Tombol Ganti clip gagal dimuat',e)}
})();
