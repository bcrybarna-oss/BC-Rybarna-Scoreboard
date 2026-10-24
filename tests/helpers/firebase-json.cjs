'use strict';
// Model RTDB storage, then its JSON REST representation. Empty containers/null
// disappear; dense numeric children become arrays (max index < 2 * count).
function store(x){
 if(x==null)return null;
 if(typeof x!=='object')return x;
 const out={};for(const [k,v]of Object.entries(x)){const child=store(v);if(child!==null)out[k]=child;}
 return Object.keys(out).length?out:null;
}
function wire(x){
 if(x===null||typeof x!=='object')return x;
 const keys=Object.keys(x).sort(),out=Object.fromEntries(keys.map(k=>[k,wire(x[k])]));
 if(keys.length&&keys.every(k=>/^(0|[1-9]\d*)$/.test(k))){const max=Math.max(...keys.map(Number));if(max<keys.length*2){const a=Array(max+1).fill(null);for(const k of keys)a[Number(k)]=out[k];return a;}}
 return out;
}
const roundTrip=x=>wire(store(x));
const canonical=x=>JSON.stringify(sort(x));
function sort(x){return Array.isArray(x)?x.map(sort):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])])):x;}
module.exports={store,wire,roundTrip,canonical};
