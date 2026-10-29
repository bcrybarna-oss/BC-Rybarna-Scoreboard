'use strict';
// Read-only baseline source overlay for isolated browser comparisons, never application loading.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'index.html'),read=fs.readFileSync.bind(fs);
const ref=process.env.REPORT_SOURCE_REF;
const source=ref?cp.execFileSync('git',['show',ref+':index.html'],{cwd:root,maxBuffer:10e6}):read(file);
fs.readFileSync=function(p,...args){if(typeof p==='string'&&path.resolve(p).toLowerCase()===file.toLowerCase())return args[0]==='utf8'?source.toString('utf8'):Buffer.from(source);return read(p,...args);};
console.log('ISOLATED REPORT SOURCE:',ref||'working candidate');
require(path.resolve(process.argv[2]));
