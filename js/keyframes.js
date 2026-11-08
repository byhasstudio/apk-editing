/* Keyframe: animasi properti clip (x, y, scale, opacity, rotation, volume) dengan easing.
   Data per clip: clip.kf = { x:[{t,v,e}], ... } ; t = detik relatif terhadap awal clip, e = nama easing atau 'bz:x1,y1,x2,y2' (kurva bezier kustom)
   v24: keyframe TANPA easing (e kosong, seperti pada preset hasil ekstrak) tidak lagi linear patah-patah, tapi dihaluskan dengan interpolasi kubik
   monotonik (kecepatan nyambung antar keyframe, tanpa pantulan melewati nilai keyframe). Keyframe yang easing-nya diisi tetap persis seperti dulu.
   v25: clip.smooth=true (dipasang otomatis saat preset "kamu yang kasi tinggal 3 foto" dibuka) memakai kemiringan rata-rata dua sisi
   (bukan rata-rata harmonis), dibatasi supaya tidak melewati keyframe, jadi gerak lebih mengalir dan tidak melambat di tiap titik. */
window.APK=window.APK||{};
APK.kf=(function(){
  const PROPS=['x','y','scale','opacity','rotation','volume','sx','sy','skx','sky'];
  const VISUAL=['x','y','scale','opacity','rotation','sx','sy','skx','sky'];
  const DEF={x:0,y:0,scale:1,opacity:1,rotation:0,volume:1,sx:1,sy:1,skx:0,sky:0};
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
  /* kurva bezier kubik seperti CSS cubic-bezier(x1,y1,x2,y2) */
  const bez=(x1,y1,x2,y2)=>{
    const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by;
    const X=s=>((ax*s+bx)*s+cx)*s,Y=s=>((ay*s+by)*s+cy)*s,dX=s=>(3*ax*s+2*bx)*s+cx;
    return t=>{
      if(t<=0)return 0;if(t>=1)return 1;
      let s=t;
      for(let i=0;i<8;i++){const e=X(s)-t;if(Math.abs(e)<1e-5)return Y(s);const d=dX(s);if(Math.abs(d)<1e-6)break;s-=e/d}
      let lo=0,hi=1;s=t;
      for(let i=0;i<30;i++){const x=X(s);if(Math.abs(x-t)<1e-5)break;if(t>x)lo=s;else hi=s;s=(lo+hi)/2}
      return Y(s);
    };
  };
  const BZC=new Map();
  const parseBz=e=>{if(typeof e!=='string'||e.slice(0,3)!=='bz:')return null;const a=e.slice(3).split(',').map(Number);return a.length===4&&a.every(isFinite)?a:null};
  /* perkiraan bezier untuk easing bawaan, dipakai sebagai titik awal di editor grafik */
  const APPROX={linear:[0,0,1,1],inout:[.45,0,.55,1],in:[.32,0,.67,0],out:[.33,1,.68,1],back:[.34,1.56,.64,1]};
  const bezOf=e=>parseBz(e)||APPROX[e]||null;
  const fmtBz=a=>'bz:'+a.map(v=>Math.round(v*1000)/1000).join(',');
  function easeFn(e){
    const a=parseBz(e);
    if(a){
      let f=BZC.get(e);
      if(!f){if(BZC.size>200)BZC.clear();f=bez(a[0],a[1],a[2],a[3]);BZC.set(e,f)}
      return f;
    }
    return(EASE[e]||EASE.linear).f;
  }
  const eps=()=>{const p=APK.project.current;return Math.max(0.005,0.5/((p&&p.fps)||30))};
  const arr=(c,p)=>c.kf&&c.kf[p]&&c.kf[p].length?c.kf[p]:null;
  const find=(a,rel,e)=>a.findIndex(k=>Math.abs(k.t-rel)<=e);
  const clone=o=>JSON.parse(JSON.stringify(o));

  /* kemiringan di keyframe k: rata-rata harmonis kemiringan dua sisi (nol kalau arahnya berbalik, jadi tidak melampaui keyframe).
     sm=true (mode smooth): rata-rata berbobot jarak waktu, dibatasi 3x kemiringan terkecil (batas Fritsch-Carlson) supaya tetap tidak melampaui keyframe */
  function slopeAt(a,k,sm){
    const n=a.length,sl=j=>(a[j+1].v-a[j].v)/Math.max(1e-6,a[j+1].t-a[j].t);
    if(n<2)return 0;
    if(k===0)return sl(0);
    if(k===n-1)return sl(n-2);
    const s0=sl(k-1),s1=sl(k);
    if(s0*s1<=0)return 0;
    if(sm){
      const h0=Math.max(1e-6,a[k].t-a[k-1].t),h1=Math.max(1e-6,a[k+1].t-a[k].t),
        m=(s0*h1+s1*h0)/(h0+h1),lim=3*Math.min(Math.abs(s0),Math.abs(s1));
      return Math.sign(m)*Math.min(Math.abs(m),lim);
    }
    return 2*s0*s1/(s0+s1);
  }
  function value(c,p,rel){
    const a=arr(c,p);
    if(!a)return c.props&&c.props[p]!=null?c.props[p]:DEF[p];
    if(rel<=a[0].t)return a[0].v;
    const L=a[a.length-1];if(rel>=L.t)return L.v;
    let i=0;while(i<a.length-2&&rel>=a[i+1].t)i++;
    const k0=a[i],k1=a[i+1],h=k1.t-k0.t,u=(rel-k0.t)/h;
    if(k0.e==null){
      /* tanpa easing: kubik Hermite monotonik */
      const t2=u*u,t3=t2*u,sm=!!c.smooth;
      return (2*t3-3*t2+1)*k0.v+(t3-2*t2+u)*h*slopeAt(a,i,sm)+(-2*t3+3*t2)*k1.v+(t3-t2)*h*slopeAt(a,i+1,sm);
    }
    return k0.v+(k1.v-k0.v)*easeFn(k0.e)(u);
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

  /* Preset "kamu yang kasi tinggal 3 foto": saat file presetnya dibaca, semua clip diberi smooth=true.
     Dipasang setelah halaman selesai dimuat, karena js/presets.js dimuat sesudah file ini. */
  window.addEventListener('load',()=>{
    const P=APK.presets;if(!P||typeof P.readFile!=='function'||P._smoothWrap)return;
    const orig=P.readFile;
    P.readFile=async function(){
      const o=await orig.apply(this,arguments);
      try{
        if(o&&Array.isArray(o.items)&&/kamu.*kasi/i.test(String(o.name||'')))
          for(const i of o.items)if(i&&i.c&&typeof i.c==='object')i.c.smooth=true;
      }catch(_){}
      return o;
    };
    P._smoothWrap=true;
  });
  return{PROPS,VISUAL,DEF,EASE,easeFn,bezOf,fmtBz,value,props,animated,hasKey,setKey,delKey,delAt,clear,times,step,easeAt,setEase,move,shift,split,clone};
})();
