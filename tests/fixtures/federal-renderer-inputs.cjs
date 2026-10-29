'use strict';
const stats=require('../../assets/js/federal-statistics.js'),{taggedReference}=require('./federal-tags.cjs');
function inputs(){
 const m=taggedReference('team','renderer-team');m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:'Player '+side+i,team:side?'b':'a',year:2026})));
 const report=stats.federalReportData([m],{year:2026,reportHost:'SK'},2026),metrics=stats.federalCalculateMatch(m).sides.map(s=>s.metrics);
 metrics[0].pottingSuccess={kind:'percent',coverage:'partial',value:null,numerator:14,denominator:15,reasons:['unknown_intent']};metrics[0].pottedBalls={kind:'count',coverage:'partial',value:null,count:14,reasons:['unknown_pots']};metrics[1].bankShots={kind:'ratio',coverage:'complete',value:null,numerator:0,denominator:0,reasons:[]};metrics[1].jumpShots={coverage:'unknown',reasons:['missing']};
 return {report,metrics,person:report.people.a1,side:0};
}
module.exports={inputs};
