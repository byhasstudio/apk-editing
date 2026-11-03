/* Shortcut dasar; tidak aktif saat mengetik di input */
(function(){
  addEventListener('keydown',e=>{
    const P=APK.project.current;
    if(!P||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
    const k=e.key,ctrl=e.ctrlKey||e.metaKey,pv=APK.preview;
    if(k===' '){e.preventDefault();if(e.target.blur)e.target.blur();pv.toggle()}
    else if(k==='Delete'){e.preventDefault();APK.timeline.del()}
    else if(ctrl&&k.toLowerCase()==='z'){e.preventDefault();e.shiftKey?APK.history.redo():APK.history.undo()}
    else if(ctrl&&k.toLowerCase()==='y'){e.preventDefault();APK.history.redo()}
    else if(ctrl&&k.toLowerCase()==='d'){e.preventDefault();APK.timeline.duplicate()}
    else if(!ctrl&&k.toLowerCase()==='s'){APK.timeline.split()}
    else if(k==='ArrowLeft'||k==='ArrowRight'){
      e.preventDefault();const st=e.shiftKey?1:1/P.fps;
      pv.seek(pv.time+(k==='ArrowRight'?st:-st));
    }
    else if(k==='Home'){e.preventDefault();pv.seek(0)}
    else if(k==='End'){e.preventDefault();pv.seek(pv.duration)}
  });
})();
