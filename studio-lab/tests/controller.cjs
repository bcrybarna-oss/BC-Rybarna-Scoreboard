'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

class MockEl {
  constructor(id) {
    this.id=id;
    this.value='';
    this.textContent='';
    this.dataset={};
    this.attrs={};
    this.listeners={};
    this.options=[];
    this.disabled=false;
    this.srcObject=null;
    this.style={setProperty:(key,value)=>{this.style[key]=value;}};
    this.classList={toggle:(name,on)=>{this['class_'+name]=on;}};
  }
  addEventListener(name,callback) {(this.listeners[name]??=[]).push(callback);}
  async emit(name){await Promise.all((this.listeners[name]||[]).map(cb=>cb()));}
  setAttribute(name,value){this.attrs[name]=value;}
  appendChild(el){this.options.push(el);return el;}
  querySelectorAll(){return [];}
  remove(){this.removed=true;}
  pause(){this.paused=true;}
  async play(){this.played=true;}
}

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
const els=Object.fromEntries(ids.map(id=>[id,new MockEl(id)]));
for(const [id,value] of Object.entries({
  playerLeft:'Jarda Tichý',playerRight:'René Kulas',
  clubLeft:'BC Rybárna',clubRight:'Hosté',
  colorLeft:'#d9ab44',colorRight:'#357bd3',cameraSelect:'environment'
}))els[id].value=value;
els.cameraSelect.options=[{value:'environment'},{value:'user'}];
const buttons=['camera','soon','pause','end'].map(scene=>{
  const b=new MockEl(scene);
  b.dataset.sceneButton=scene;
  return b;
});
const documentMock={
  getElementById:id=>els[id],
  querySelectorAll:query=>query==='[data-scene-button]'?buttons:[],
  createElement:()=>new MockEl('option')
};
const makeStream=()=>{
  const track={stopped:false,stop(){this.stopped=true;},addEventListener(){}};
  return {track,getTracks:()=>[track],getVideoTracks:()=>[track]};
};
let acquire=async()=>makeStream();
let callCount=0;
const mediaDevices={
  async getUserMedia(options){callCount++;assert.equal(options.audio,false);return acquire(options);},
  async enumerateDevices(){return [{kind:'videoinput',deviceId:'dev0',label:'Testovací kamera'}];},
  addEventListener(){}
};
const windowMock={events:{},addEventListener(kind,fn){this.events[kind]=fn;}};
new Function('document','navigator','window',script)(documentMock,{mediaDevices},windowMock);

(async()=>{
  assert.equal(els.nameLeftPreview.textContent,'Jarda Tichý');
  await els.leftMinus.emit('click');
  assert.equal(els.scoreLeftPreview.textContent,'0','Score cannot go negative');
  await els.leftPlus.emit('click');
  assert.equal(els.scoreLeftPreview.textContent,'1');
  await els.rightPlus.emit('click');
  assert.equal(els.scoreRightPreview.textContent,'1');
  els.playerLeft.value='<script>oops</script>';
  await els.playerLeft.emit('input');
  assert.equal(els.nameLeftPreview.textContent,'<script>oops</script>','Names use textContent, never HTML');
  els.colorRight.value='#abcdef';
  await els.colorRight.emit('input');
  assert.equal(els.stage.style['--right'],'#abcdef');
  await buttons[2].emit('click');
  assert.equal(els.stage.dataset.scene,'pause');
  assert.equal(els.cardTitle.textContent,'PAUZA');
  await buttons[0].emit('click');
  assert.equal(els.stage.dataset.scene,'camera');

  await els.startCamera.emit('click');
  assert.equal(callCount,1);
  assert.equal(els.status.dataset.kind,'ok');
  assert.ok(els.cameraVideo.srcObject);
  const first=els.cameraVideo.srcObject;
  await els.stopCamera.emit('click');
  assert.equal(first.track.stopped,true);
  assert.equal(els.cameraVideo.srcObject,null);

  let finishPermission;
  acquire=()=>new Promise(resolve=>{finishPermission=resolve;});
  const pending=els.startCamera.emit('click');
  await Promise.resolve();
  assert.equal(typeof finishPermission,'function','Camera permission request has started');
  windowMock.events.pagehide();
  const late=makeStream();
  finishPermission(late);
  await pending;
  assert.equal(late.track.stopped,true,'Late stream must be closed after page exit');
  assert.equal(els.cameraVideo.srcObject,null,'Late stream must not reattach');

  console.log('PASS camera lab controller: scoreboard, scene switching, color, permissions, teardown, stale camera');
})().catch(error=>{console.error(error);process.exitCode=1;});
