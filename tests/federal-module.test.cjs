'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../assets/js/federal-statistics.js'),root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/federal-statistics.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const {reference,copy}=require('./fixtures/federal-calculation.cjs');
test('production loads one statistics module synchronously before the application, without inline copies',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
 const module=scripts.filter(s=>/src="assets\/js\/federal-statistics\.js\?v=/.test(s[1]));assert.equal(module.length,1);assert.doesNotMatch(module[0][1],/\b(async|defer|type=)/);
 const main=scripts.find(s=>s[2].includes("const DB_KEY ="));assert.ok(module[0].index<main.index);assert.match(main[2],/FEDERAL_STATISTICS_MODULE_UNAVAILABLE/);
 for(const name of Object.keys(api)){assert.doesNotMatch(html,new RegExp('function\\s+'+name+'\\s*\\('),name+' has no inline body');assert.match(main[2],new RegExp('\\b'+name+'\\b'));}
 assert.equal(Object.keys(api).length,24);assert.ok(Object.isFrozen(api));
});
test('browser and CommonJS use the same side-effect-free module and immutable inputs',()=>{
 const c={};for(const key of ['document','localStorage','fetch','setTimeout','setInterval','data','match'])Object.defineProperty(c,key,{get(){throw Error('Forbidden dependency '+key);}});
 vm.createContext(c);vm.runInContext(source,c);const input=reference('team'),before=JSON.stringify(input),a=copy(api.federalCalculateMatch(input)),b=copy(c.FederalStatistics.federalCalculateMatch(input));assert.deepEqual(a,b);assert.equal(JSON.stringify(input),before);
 assert.equal(a.sides[0].metrics.pottingSuccess.numerator,5);assert.equal(a.sides[0].metrics.pottingSuccess.denominator,7);
 const frozen=(x)=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))frozen(v);}return x;};
 assert.deepEqual(copy(api.federalCalculateMatch(frozen(input))),a);
});
