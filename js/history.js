/* Undo/redo berbasis snapshot susunan track (maks 100 langkah) */
window.APK=window.APK||{};
APK.history=(function(){
  let undoS=[],redoS=[];
  const $=id=>document.getElementById(id);
  const snap=()=>JSON.stringify(APK.project.current.tracks);
  function sync(){const u=$('btn-undo'),r=$('btn-redo');if(u)u.disabled=!undoS.length;if(r)r.disabled=!redoS.length}
  const api={
    snapshot:snap,
    record(s){if(!APK.project.current)return;undoS.push(s||snap());if(undoS.length>100)undoS.shift();redoS=[];sync()},
    clear(){undoS=[];redoS=[];sync()},
    undo(){if(!undoS.length||!APK.project.current)return;redoS.push(snap());APK.timeline.restore(undoS.pop());sync()},
    redo(){if(!redoS.length||!APK.project.current)return;undoS.push(snap());APK.timeline.restore(redoS.pop());sync()},
    canUndo:()=>undoS.length>0,canRedo:()=>redoS.length>0
  };
  const u=$('btn-undo'),r=$('btn-redo');
  if(u)u.onclick=()=>api.undo();
  if(r)r.onclick=()=>api.redo();
  return api;
})();
