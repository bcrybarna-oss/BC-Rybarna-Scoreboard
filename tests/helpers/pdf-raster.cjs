'use strict';
// Read jsPDF's existing Flate/PNG-predictor image streams for export comparison.
const zlib=require('node:zlib'),assert=require('node:assert/strict');
function images(buffer){const text=buffer.toString('latin1'),out=[];for(const m of text.matchAll(/\d+ 0 obj\s*<<[^]*?endobj/g)){
 const obj=m[0],stream=obj.indexOf('stream\n');if(stream<0)continue;const head=obj.slice(0,stream);if(!/\/Subtype \/Image/.test(head))continue;
 const n=k=>Number(new RegExp('/'+k+' (\\d+)').exec(head)?.[1]),w=n('Width'),h=n('Height'),length=n('Length'),channels=/\/DeviceRGB/.test(head)?3:1;
 assert.match(head,/\/FlateDecode/);assert.equal(n('BitsPerComponent'),8);
 const data=zlib.inflateSync(buffer.subarray(m.index+stream+7,m.index+stream+7+length)),stride=w*channels,pixels=Buffer.alloc(stride*h);
 assert.equal(data.length,(stride+1)*h);
 for(let y=0;y<h;y++){const filter=data[y*(stride+1)];for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;let prediction=0;if(filter===1)prediction=a;else if(filter===2)prediction=b;else if(filter===3)prediction=Math.floor((a+b)/2);else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);prediction=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else assert.equal(filter,0);pixels[i]=(data[y*(stride+1)+1+x]+prediction)&255;}}
 out.push({w,h,channels,pixels});
 }return out;}
function compare(a,b){const x=images(a),y=images(b);assert.equal(x.length,y.length);let different=0,delta=0,total=0,max=0;for(let k=0;k<x.length;k++){assert.deepEqual([x[k].w,x[k].h,x[k].channels],[y[k].w,y[k].h,y[k].channels]);for(let i=0;i<x[k].pixels.length;i++){const d=Math.abs(x[k].pixels[i]-y[k].pixels[i]);if(d)different++;delta+=d;max=Math.max(max,d);}total+=x[k].pixels.length;}return {images:x.map(({w,h,channels})=>({w,h,channels})),differentChannels:different,totalChannels:total,meanAbsoluteDelta:delta/total,maxDelta:max};}
module.exports={compare};
