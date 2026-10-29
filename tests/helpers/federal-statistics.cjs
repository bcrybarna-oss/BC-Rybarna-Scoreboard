'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'assets/js/federal-statistics.js');
function load(ref){
  if(!ref)return require(file);
  // Explicit historical comparison only; never used by the application.
  const html=execFileSync('git',['show',ref+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6});
  const start=html.indexOf('  // Federal Cup calculation contract v1.'),end=html.indexOf('  function detailedCounterActive()',start);
  if(start<0){const c={};vm.createContext(c);vm.runInContext(execFileSync('git',['show',ref+':assets/js/federal-statistics.js'],{cwd:root,encoding:'utf8',maxBuffer:2e6}),c);return c.FederalStatistics;}
  const a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4,c={};vm.createContext(c);vm.runInContext(html.slice(a,b)+'\n'+html.slice(start,end),c);return c;
}
function instrumented(){
  const c={};vm.createContext(c);const source=fs.readFileSync(file,'utf8');
  const names=[...source.matchAll(/^  function (\w+)\(/gm)].map(m=>m[1]);
  const hook=names.map(n=>`${n}=((fn)=>function(...args){globalThis.__observe?.('${n}');return fn.apply(this,args);})(${n});`).join('\n');
  vm.runInContext(source.replace('  return Object.freeze({',hook+'\n  return Object.freeze({'),c);
  const api={...c.FederalStatistics};Object.defineProperty(api,'__observe',{set(fn){c.__observe=fn;}});return api;
}
function serve(route,transform,cloudTransform){
  const request=route.request(),url=new URL(request.url());
  if(url.pathname==='/assets/js/federal-report-controller.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'assets/js/federal-report-controller.js'),'utf8')});
  if(url.pathname==='/assets/js/federal-report-renderer.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(root,'assets/js/federal-report-renderer.js'),'utf8')});
  const statistics=url.pathname==='/assets/js/federal-statistics.js',xlsx=url.pathname==='/assets/pushout-xlsx.js',cloud=url.pathname==='/assets/js/cloud-refresh.js',reports=url.pathname==='/assets/js/own-reports.js',viewer=url.pathname==='/assets/js/federal-viewer.js',admin=url.pathname==='/assets/js/admin-reports.js';
  if(!statistics&&!xlsx&&!cloud&&!reports&&!viewer&&!admin)return false;
  if(request.method()!=='GET')throw Error('Statistics module is read-only');
  const source=fs.readFileSync(statistics?file:path.join(root,cloud?'assets/js/cloud-refresh.js':reports?'assets/js/own-reports.js':viewer?'assets/js/federal-viewer.js':admin?'assets/js/admin-reports.js':'assets/pushout-xlsx.js'),'utf8');
  return route.fulfill({contentType:'application/javascript',body:statistics&&transform?transform(source):cloud&&cloudTransform?cloudTransform(source):source});
}
module.exports={load,instrumented,serve};
