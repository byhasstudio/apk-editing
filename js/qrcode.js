/* Pembuat kode QR mandiri (tanpa library luar), mode alfanumerik + byte, versi 1-40, koreksi L/M/Q/H.
   Dipakai fitur "QR preset" (js/qrpreset.js). API: APK.qr.make(teks, {ec:'M', minVersion}) -> {size, version, get(x,y)}
   APK.qr.capacity(ec, version) -> jumlah karakter alfanumerik maksimum satu QR. */
(function(root){
'use strict';
const ECL={L:0,M:1,Q:2,H:3},FMT=[1,0,3,2];
const ECW=[
[-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
[-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
[-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];
const NBLK=[
[-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
[-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
[-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];
const ALNUM='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function rawModules(v){
  let r=(16*v+128)*v+64;
  if(v>=2){const n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36}
  return r;
}
function dataCodewords(v,e){return Math.floor(rawModules(v)/8)-ECW[e][v]*NBLK[e][v]}
function ccBits(mode,v){ /* mode: 1 alfanumerik, 2 byte */
  const k=v<=9?0:v<=26?1:2;
  return mode===1?[9,11,13][k]:[8,16,16][k];
}
function capacity(ec,v){
  const e=ECL[ec],bits=dataCodewords(v,e)*8-4-ccBits(1,v);
  const pairs=Math.floor(bits/11),rem=bits-pairs*11;
  return pairs*2+(rem>=6?1:0);
}
function bitsFor(text,mode){
  const n=text.length;
  if(mode===1)return Math.floor(n/2)*11+(n%2?6:0);
  return n*8;
}

/* aritmetika GF(256) untuk Reed-Solomon */
const EXP=new Uint8Array(512),LOG=new Uint8Array(256);
(function(){let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
const gmul=(a,b)=>(a===0||b===0)?0:EXP[LOG[a]+LOG[b]];
function rsGen(d){
  let g=[1];
  for(let i=0;i<d;i++){
    const n=new Array(g.length+1).fill(0);
    for(let j=0;j<g.length;j++){n[j]^=g[j];n[j+1]^=gmul(g[j],EXP[i])}
    g=n;
  }
  return g;
}
function rsRem(data,gen){
  const d=gen.length-1,res=new Array(d).fill(0);
  for(const b of data){
    const f=b^res.shift();res.push(0);
    if(f!==0)for(let i=0;i<d;i++)res[i]^=gmul(gen[i+1],f);
  }
  return res;
}

function buildBits(text,mode,v,e){
  const bits=[];
  const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  put(mode===1?2:4,4);
  put(text.length,ccBits(mode,v));
  if(mode===1){
    for(let i=0;i<text.length;i+=2){
      const a=ALNUM.indexOf(text[i]);
      if(i+1<text.length)put(a*45+ALNUM.indexOf(text[i+1]),11);else put(a,6);
    }
  }else{
    for(let i=0;i<text.length;i++)put(text.charCodeAt(i)&255,8);
  }
  const cap=dataCodewords(v,e)*8;
  put(0,Math.min(4,cap-bits.length));
  while(bits.length%8)bits.push(0);
  for(let p=0xEC;bits.length<cap;p^=0xEC^0x11)put(p,8);
  const out=[];
  for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];out.push(b)}
  return out;
}
function interleave(data,v,e){
  const nb=NBLK[e][v],eb=ECW[e][v],raw=Math.floor(rawModules(v)/8),short=nb-raw%nb,sl=Math.floor(raw/nb);
  const gen=rsGen(eb),blocks=[],ecs=[];
  let k=0;
  for(let i=0;i<nb;i++){
    const len=sl-eb+(i<short?0:1),blk=data.slice(k,k+len);k+=len;
    blocks.push(blk);ecs.push(rsRem(blk,gen));
  }
  const res=[];
  for(let i=0;i<=sl-eb;i++)blocks.forEach((b,j)=>{if(i<b.length)res.push(b[i])});
  for(let i=0;i<eb;i++)ecs.forEach(b=>res.push(b[i]));
  return res;
}

function alignPos(v){
  if(v===1)return[];
  const n=Math.floor(v/7)+2,step=v===32?26:Math.ceil((v*4+4)/(n*2-2))*2,r=[6];
  for(let p=v*4+10;r.length<n;p-=step)r.splice(1,0,p);
  return r;
}
function formatBits(e,mask){
  const d=(FMT[e]<<3)|mask;let r=d;
  for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);
  return((d<<10)|r)^0x5412;
}
function versionBits(v){
  let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);
  return(v<<12)|r;
}

function layout(v){
  const n=v*4+17,mod=[],fn=[];
  for(let i=0;i<n;i++){mod.push(new Array(n).fill(false));fn.push(new Array(n).fill(false))}
  const set=(x,y,d)=>{if(x>=0&&y>=0&&x<n&&y<n){mod[y][x]=d;fn[y][x]=true}};
  for(let i=0;i<n;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!==2&&d!==4)}};
  finder(3,3);finder(n-4,3);finder(3,n-4);
  const ap=alignPos(v);
  for(let i=0;i<ap.length;i++)for(let j=0;j<ap.length;j++){
    if((i===0&&j===0)||(i===0&&j===ap.length-1)||(i===ap.length-1&&j===0))continue;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ap[i]+dx,ap[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
  }
  /* area format dan versi dipesan dulu (diisi nanti) */
  for(let i=0;i<9;i++){if(i!==6){set(8,i,false);set(i,8,false)}}
  for(let i=0;i<8;i++){set(n-1-i,8,false);set(8,n-1-i,false)}
  set(8,n-8,true);
  if(v>=7){const vb=versionBits(v);for(let i=0;i<18;i++){const b=((vb>>>i)&1)===1,a=n-11+i%3,c=Math.floor(i/3);set(a,c,b);set(c,a,b)}}
  return{n,mod,fn,set};
}
function placeData(L,codes){
  const{n,mod,fn}=L;let i=0;
  for(let right=n-1;right>=1;right-=2){
    if(right===6)right=5;
    for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){
      const x=right-j,up=((right+1)&2)===0,y=up?n-1-vert:vert;
      if(!fn[y][x]&&i<codes.length*8){mod[y][x]=((codes[i>>>3]>>>(7-(i&7)))&1)===1;i++}
    }
  }
}
const MASKS=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,
  (x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
function applyMask(L,m){
  const{n,mod,fn}=L;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!fn[y][x]&&MASKS[m](x,y))mod[y][x]=!mod[y][x];
}
function drawFormat(L,e,m){
  const{n,mod}=L,b=formatBits(e,m),g=i=>((b>>>i)&1)===1;
  for(let i=0;i<=5;i++)mod[i][8]=g(i);
  mod[7][8]=g(6);mod[8][8]=g(7);mod[8][7]=g(8);
  for(let i=9;i<15;i++)mod[8][14-i]=g(i);
  for(let i=0;i<8;i++)mod[8][n-1-i]=g(i);
  for(let i=8;i<15;i++)mod[n-15+i][8]=g(i);
  mod[n-8][8]=true;
}
function penalty(L){
  const{n,mod}=L;let p=0;
  const runs=line=>{
    let s=0,run=1;
    for(let i=1;i<=n;i++){
      if(i<n&&line[i]===line[i-1])run++;
      else{if(run>=5)s+=run-2;run=1}
    }
    return s;
  };
  for(let y=0;y<n;y++)p+=runs(mod[y]);
  for(let x=0;x<n;x++){const c=[];for(let y=0;y<n;y++)c.push(mod[y][x]);p+=runs(c)}
  for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){const c=mod[y][x];if(c===mod[y][x+1]&&c===mod[y+1][x]&&c===mod[y+1][x+1])p+=3}
  const pat=[true,false,true,true,true,false,true,false,false,false,false],pat2=pat.slice().reverse();
  const match=(get,i,q)=>{for(let k=0;k<11;k++)if(get(i+k)!==q[k])return false;return true};
  for(let y=0;y<n;y++)for(let x=0;x<=n-11;x++){
    if(match(k=>mod[y][k],x,pat)||match(k=>mod[y][k],x,pat2))p+=40;
  }
  for(let x=0;x<n;x++)for(let y=0;y<=n-11;y++){
    if(match(k=>mod[k][x],y,pat)||match(k=>mod[k][x],y,pat2))p+=40;
  }
  let dark=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(mod[y][x])dark++;
  p+=Math.floor(Math.abs(dark*20-n*n*10)/(n*n))*10;
  return p;
}

function make(text,opt){
  opt=opt||{};
  const ec=ECL[opt.ec||'M']!==undefined?opt.ec||'M':'M',e=ECL[ec];
  const isAl=[...text].every(c=>ALNUM.indexOf(c)>=0),mode=isAl?1:2;
  let v=opt.minVersion||1;
  for(;v<=40;v++){if(bitsFor(text,mode)+4+ccBits(mode,v)<=dataCodewords(v,e)*8)break}
  if(v>40)throw new Error('Data terlalu besar untuk satu QR');
  const codes=interleave(buildBits(text,mode,v,e),v,e);
  let best=null,bestP=1e9;
  for(let m=0;m<8;m++){if(opt.mask!==undefined&&m!==opt.mask)continue;
    const L=layout(v);
    placeData(L,codes);applyMask(L,m);drawFormat(L,e,m);
    const p=penalty(L);
    if(p<bestP){bestP=p;best=L}
  }
  const mod=best.mod;
  return{size:best.n,version:v,get:(x,y)=>mod[y][x]};
}

const api={make,capacity,ALNUM};
root.APK=root.APK||{};root.APK.qr=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
