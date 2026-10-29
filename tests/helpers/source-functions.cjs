'use strict';
const assert=require('node:assert/strict');
function topFunction(source,name){
 source=source.replace(/\r\n/g,'\n');
 const marker=name.startsWith('window.')?'  '+name+'=':'  '+(source.includes('  async function '+name+'(')?'async ':'')+'function '+name+'(';
 const start=source.indexOf(marker);assert.ok(start>=0,'Missing actual function '+name);
 const tail=source.slice(start),end=/^  };?$/m.exec(tail);assert.ok(end,'Missing function end '+name);
 return tail.slice(0,end.index+end[0].length);
}
module.exports={topFunction};
