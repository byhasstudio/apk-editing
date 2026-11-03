/* Shortcut dasar; tidak aktif saat mengetik di input atau saat dialog terbuka */
(function(){
  addEventListener('keydown',e=>{
    const P=APK.project.current;
    if(!P||document.querySelector('dialog[open]')||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
    const k=e.key,lk=k.toLowerCase(),ctrl=e.ctrlKey||e.metaKey,pv=APK.preview,T=APK.timeline;
    if(k===' '){e.preventDefault();if(e.target.blur)e.target.blur();pv.toggle()}
    else if(k==='Delete'||k==='Backspace'){e.preventDefault();T.del()}
    else if(ctrl&&lk==='z'){e.preventDefault();e.shiftKey?APK.history.redo():APK.history.undo()}
    else if(ctrl&&lk==='y'){e.preventDefault();APK.history.redo()}
    else if(ctrl&&lk==='d'){e.preventDefault();T.duplicate()}
    else if(ctrl&&lk==='c'){e.preventDefault();T.copy()}
    else if(ctrl&&lk==='x'){e.preventDefault();T.cut()}
    else if(ctrl&&lk==='v'){e.preventDefault();T.paste()}
    else if(ctrl&&lk==='a'){e.preventDefault();T.selectAll()}
    else if(k==='Escape'){T.select(null)}
    else if(!ctrl&&lk==='s'){T.split()}
    else if(!ctrl&&lk==='t'){e.preventDefault();T.addText()}
    else if(!ctrl&&lk==='k'){e.preventDefault();APK.properties.addAll()}
    else if(k==='['||k===']'){e.preventDefault();APK.properties.jump(k===']'?1:-1)}
    else if(k==='ArrowLeft'||k==='ArrowRight'){
      e.preventDefault();const st=e.shiftKey?1:1/P.fps;
      pv.seek(pv.time+(k==='ArrowRight'?st:-st));
    }
    else if(k==='Home'){e.preventDefault();pv.seek(0)}
    else if(k==='End'){e.preventDefault();pv.seek(pv.duration)}
  });
})();
