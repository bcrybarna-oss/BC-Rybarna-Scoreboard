'use strict';
// Isolated RTDB-shaped JSON boundary: null/empty collections disappear, numeric zero survives.
// This is an explicit model, not a connection to a Firebase server.
function firebaseJsonRoundtrip(value){
 const parsed=JSON.parse(JSON.stringify(value));
 function tree(v){
  if(v===null||v===undefined)return undefined;
  if(typeof v!=='object')return v;
  const pairs=Object.entries(v).map(([k,x])=>[k,tree(x)]).filter(([,x])=>x!==undefined);
  if(!pairs.length)return undefined;
  // RTDB renders dense numeric children as arrays; empty collections still disappear.
  if(Array.isArray(v)){const out=[];for(const [k,x]of pairs)out[Number(k)]=x;return out;}
  return Object.fromEntries(pairs);
 }
 return tree(parsed)??null;
}
module.exports={firebaseJsonRoundtrip};
