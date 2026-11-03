/* Keyframe: animasi properti clip (x, y, scale, opacity, rotation, volume) dengan easing.
   Data per clip: clip.kf = { x:[{t,v,e}], ... } ; t = detik relatif terhadap awal clip, e = nama easing */
window.APK=window.APK||{};
APK.kf=(function(){
  const PROPS=['x','y','scale','opacity','rotation','volume'];
  const VISUAL=['x','y','scale','opacity','rotation'];
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1};
  const DEFAULT_EASE='inout';
  const bounce=t=>{const n=7.5625,d=2.75;
    if(t<1/d)return n*t*t;
    if(t<2/d){t-=1.5/d;return n*t*t+.75}
    if(t<2.5/d){t-=2.25/d;return n*t*t+.9375}
    t-=2.625/d;return n*t*t+.984375};
  const EASE={
    linear:{l:'Linear',f:t=>t},
    inout:{l:'Halus (Ease In-Out)',f:t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2},
    in:{l:'Ease In (mulai pelan)',f:t=>t*t*t},
    out:{l:'Ease Out (akhir pelan)',f:t=>1-Math.pow(1-t,3)},
    back:{l:'Overshoot (melewati target)',f:t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2)}},
    bounce:{l:'Bounce (memantul)',f:bounce},
    hold:{l:'Hold (tahan, lompat)',f:t=>t<1?0:1}
  };
  const eps=()=>{const p=APK.project.current;return Math.max(0.005,0.5/((p&&p.fps)||30))};
  const arr=(c,p)=>c.kf&&c.kf[p]&&c.kf[p].length?c.kf[p]:null;
  const find=(a,rel,e)=>a.findIndex(k=>Math.abs(k.t-rel)<=e);
  const clone=o=>JSON.parse(JSON.stringify(o));

  function value(c,p,rel){
    const a=arr(c,p);
    if(!a)return c.props&&c.props[p]!=null?c.props[p]:DEF[p];
    if(rel<=a[0].t)return a[0].v;
    const L=a[a.length-1];if(rel>=L.t)return L.v;
    let i=0;while(i<a.length-2&&rel>=a[i+1].t)i++;
    const k0=a[i],k1=a[i+1],u=(rel-k0.t)/(k1.t-k0.t),f=(EASE[k0.e]||EASE.linear).f;
    return k0.v+(k1.v-k0.v)*f(u);
  }
  function props(c,rel){
    const o=Object.assign({},DEF,c.props);
    for(const p of PROPS)if(arr(c,p))o[p]=value(c,p,rel);
    return o;
  }
  const animated=(c,p)=>p?!!arr(c,p):!!(c.kf&&PROPS.some(q=>arr(c,q)));
  const hasKey=(c,p,rel)=>{const a=arr(c,p);return !!a&&find(a,rel,eps())>=0};

  function setKey(c,p,rel,v){
    const e=eps();c.kf=c.kf||{};
    const a=c.kf[p]=c.kf[p]||[],i=find(a,rel,e);
    if(i>=0){a[i].v=v;return false}
    a.push({t:rel,v,e:DEFAULT_EASE});a.sort((x,y)=>x.t-y.t);return true;
  }
  function delKey(c,p,rel){
    const a=arr(c,p);if(!a)return;
    const i=find(a,rel,eps());if(i<0)return;
    const v=a[i].v;a.splice(i,1);
    if(!a.length){
      delete c.kf[p];c.props=c.props||{};c.props[p]=v;
      if(!Object.keys(c.kf).length)delete c.kf;
    }
  }
  function delAt(c,rel){for(const p of PROPS)delKey(c,p,rel)}
  function clear(c,rel){
    if(!c.kf)return;
    const cur=props(c,rel);c.props=Object.assign({},DEF,c.props);
    for(const p of PROPS)if(arr(c,p))c.props[p]=cur[p];
    delete c.kf;
  }
  function times(c,p){
    const e=eps(),r=[];
    if(c.kf)for(const q of (p?[p]:PROPS))for(const k of (c.kf[q]||[]))if(!r.some(t=>Math.abs(t-k.t)<=e))r.push(k.t);
    return r.sort((a,b)=>a-b);
  }
  function step(c,rel,dir,p){
    const e=eps(),ts=times(c,p);
    return dir>0?ts.find(t=>t>rel+e):ts.slice().reverse().find(t=>t<rel-e);
  }
  function easeAt(c,rel){
    const e=eps();
    for(const p of PROPS){const a=arr(c,p);if(!a)continue;const i=find(a,rel,e);if(i>=0)return a[i].e}
    return null;
  }
  function setEase(c,rel,name){
    const e=eps();let n=0;
    for(const p of PROPS){const a=arr(c,p);if(!a)continue;const i=find(a,rel,e);if(i>=0){a[i].e=name;n++}}
    return n>0;
  }
  /* pindahkan semua keyframe di waktu 'from' ke 'to', dihitung ulang dari salinan kf0 */
  function move(c,kf0,from,to){
    const e=eps(),out={};
    for(const p of PROPS){
      const a=kf0[p];if(!a||!a.length)continue;
      const mv=a.filter(k=>Math.abs(k.t-from)<=e).map(k=>({...k,t:to}));
      const rest=a.filter(k=>Math.abs(k.t-from)>e&&Math.abs(k.t-to)>e).map(k=>({...k}));
      out[p]=rest.concat(mv).sort((x,y)=>x.t-y.t);
    }
    c.kf=out;
  }
  function shift(kf,d){
    const o=clone(kf);
    for(const p in o)for(const k of o[p])k.t+=d;
    return o;
  }
  /* bagi keyframe saat clip di-split pada waktu relatif d */
  function split(c,d){
    const L={},R={};
    for(const p of PROPS){
      const a=arr(c,p);if(!a)continue;
      const v=value(c,p,d);let ez='linear';
      for(const k of a)if(k.t<=d+1e-6)ez=k.e;
      L[p]=a.filter(k=>k.t<d-1e-6).map(k=>({...k}));L[p].push({t:d,v,e:'linear'});
      R[p]=[{t:0,v,e:ez}].concat(a.filter(k=>k.t>d+1e-6).map(k=>({...k,t:k.t-d})));
    }
    return{left:L,right:R};
  }
  return{PROPS,VISUAL,DEF,EASE,value,props,animated,hasKey,setKey,delKey,delAt,clear,times,step,easeAt,setEase,move,shift,split,clone};
})();
