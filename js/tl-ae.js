/* Bilah transport timeline (gaya editor mobile): snap, frame mundur / maju, play / pause, undo / redo.
   Hanya meneruskan klik ke tombol yang sudah ada dan menyalin statusnya, jadi logika timeline tidak berubah. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const PLAY='<svg viewBox="0 0 24 24"><path class="f" d="M7 4.5v15l13-7.5z"/></svg>',PAUSE='<svg viewBox="0 0 24 24"><path class="f" d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
function init(){
  const play=$('tr-play');if(!play||!$('pv-play'))return;
  const frame=d=>{const P=APK.project&&APK.project.current;if(!P)return;const fps=P.fps||30;APK.preview.seek(Math.max(0,APK.preview.time+d/fps))};
  $('tr-prev').onclick=()=>frame(-1);
  $('tr-next').onclick=()=>frame(1);
  play.onclick=()=>$('pv-play').click();
  $('tr-snap').onclick=()=>$('tl-snap').click();
  $('tr-undo').onclick=()=>$('btn-undo').click();
  $('tr-redo').onclick=()=>$('btn-redo').click();
  const sync=()=>{
    play.innerHTML=$('pv-play').textContent.trim()==='▶'?PLAY:PAUSE;
    $('tr-snap').classList.toggle('on',$('tl-snap').classList.contains('on'));
    $('tr-undo').disabled=$('btn-undo').disabled;$('tr-redo').disabled=$('btn-redo').disabled;
    $('tr-time').textContent=($('pv-time').textContent.split('/')[0]||'').trim();
  };
  const mo=new MutationObserver(sync),o={attributes:true,childList:true,characterData:true,subtree:true};
  ['pv-play','tl-snap','btn-undo','btn-redo','pv-time'].forEach(id=>mo.observe($(id),o));
  sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
