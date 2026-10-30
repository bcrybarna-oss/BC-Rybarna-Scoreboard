'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,1,'Standalone lab has exactly one local script');
new Function(scripts[0][1]);
for(const id of ['cameraVideo','stage','cameraSelect','startCamera','stopCamera','status','scoreLeftPreview','scoreRightPreview','colorLeft','colorRight','playerLeft','playerRight']){
  assert.ok(html.includes('id="'+id+'"'),'Missing UI control: '+id);
}
for(const scene of ['camera','soon','pause','end']){
  assert.ok(html.includes('data-scene-button="'+scene+'"'),'Missing scene: '+scene);
}
assert.match(html,/playsinline autoplay muted/,'iPhone compatible muted inline preview');
assert.match(html,/getUserMedia\(/,'Video permission is obtained only in the UI controller');
assert.match(html,/getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/,'Camera tracks must be stopped');
assert.doesNotMatch(html,/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/,'Lab must not send network requests');
assert.doesNotMatch(html,/\b(firebase|livekit|rtmp|streamkey)\s*=/i,'Lab must not contain real integration credentials');
assert.doesNotMatch(html,/localStorage|sessionStorage/,'Lab should not persist test data');
console.log('PASS studio-lab: HTML controls, scene IDs, inline video, JS syntax, stop tracks, no networking/storage');
