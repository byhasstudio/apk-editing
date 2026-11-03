/* Riwayat undo/redo: dasar untuk Tahap 4 */
window.APK=window.APK||{};
APK.history=(function(){
  let undo=[],redo=[];
  return{
    push(s){undo.push(s);redo=[];if(undo.length>100)undo.shift()},
    clear(){undo=[];redo=[]},
    canUndo:()=>undo.length>0,canRedo:()=>redo.length>0
  };
})();
