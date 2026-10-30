'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {WebSocket}=require('ws');
const {createApp,validateFacebook,validPassword,inputFormat,ffmpegArgs}=require('../server.js');
const PASSWORD='a-very-long-random-admin-passphrase-for-tests';

function awaitMessage(ws){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('WebSocket timed out')),4000);
    ws.once('message',data=>{clearTimeout(timeout);resolve(JSON.parse(String(data)));});
    ws.once('error',error=>{clearTimeout(timeout);reject(error);});
  });
}
function connect(port,origin='valid'){
  return new Promise((resolve,reject)=>{
    const host='127.0.0.1:'+port;
    const ws=new WebSocket('ws://'+host+'/ws',{origin:origin==='valid'?'http://'+host:origin});
    ws.once('open',()=>resolve(ws));ws.once('error',reject);
  });
}
function fakeSpawn(){
  const children=[];
  const spawnFfmpeg=(name,args,opts)=>{
    const child=new EventEmitter();
    child.stdin=new PassThrough();
    child.writes=[];
    child.stdin.on('data',buf=>child.writes.push(Buffer.from(buf)));
    child.stdin.on('finish',()=>setImmediate(()=>child.emit('exit',0)));
    child.kill=()=>{child.stdin.destroy();child.killed=true;return true;};
    child.killed=false;
    child.args=args;
    children.push(child);
    setImmediate(()=>child.emit('spawn'));
    return child;
  };
  return {spawnFfmpeg,children};
}

test('Facebook destination must be RTMPS and actually Facebook',()=>{
  const valid='rtmps://live-api-s.facebook.com:443/rtmp/';
  assert.equal(validateFacebook(valid,'ABCdef0987654321'),valid+'ABCdef0987654321');
  for(const url of [
    'rtmp://live-api-s.facebook.com/rtmp/',
    'rtmps://fakefacebook.com/rtmp/',
    'rtmps://facebook.com.evil.org/rtmp/',
    'rtmps://user:password@facebook.com/rtmp/',
    'rtmps://facebook.com.evil.org/rtmp/',
    'rtmps://facebook.com/path',
    'rtmps://facebook.com/rtmp/?evil=1',
    'https://facebook.com/rtmp/'
  ])assert.throws(()=>validateFacebook(url,'ABCdef0987654321'),url);
  assert.throws(()=>validateFacebook(valid,'\nattack'));
  assert.throws(()=>validateFacebook(valid,'a/b'));
});
test('Format, password and FFmpeg parameters',()=>{
  assert.equal(inputFormat('video/mp4;codecs=avc1.42E01E'),'mp4');
  assert.equal(inputFormat('video/webm;codecs=vp8'),'matroska');
  assert.throws(()=>inputFormat('image/png'));
  assert.equal(validPassword(PASSWORD,PASSWORD),true);
  assert.equal(validPassword('wrong',PASSWORD),false);
  const args=ffmpegArgs('mp4','/tmp/sink.flv');
  assert.ok(args.includes('pipe:0'));
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('anullsrc=channel_layout=stereo:sample_rate=44100'));
  assert.equal(args.at(-1),'/tmp/sink.flv');
});
test('Secure HTTP no secrets, unauthorized clients, one active stream, teardown',async()=>{
  const fake=fakeSpawn();
  const app=createApp({token:PASSWORD,port:0,spawnFfmpeg:fake.spawnFfmpeg});
  await app.listen();
  const port=app.server.address().port;
  const sockets=[];
  try{
    const health=await fetch('http://127.0.0.1:'+port+'/health');
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok',busy:false});
    const html=await fetch('http://127.0.0.1:'+port+'/');
    assert.equal(html.status,200);
    const htmlString=await html.text();
    assert.ok(!htmlString.includes(PASSWORD));
    assert.equal(html.headers.get('cache-control'),'no-store');
    assert.match(html.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const badOrigin='https://attacker.example';
    await assert.rejects(connect(port,badOrigin));

    let ws=await connect(port);sockets.push(ws);
    const denial=awaitMessage(ws);
    ws.send(JSON.stringify({type:'start',password:'wrong',mimeType:'video/webm',serverUrl:'rtmps://live-api-s.facebook.com/rtmp/',streamKey:'ABCdef0987654321'}));
    assert.equal((await denial).type,'error');
    await new Promise(resolve=>ws.once('close',resolve));
    assert.equal(fake.children.length,0);

    ws=await connect(port);sockets.push(ws);
    const granted=awaitMessage(ws);
    ws.send(JSON.stringify({
      type:'start',password:PASSWORD,mimeType:'video/webm;codecs=vp8',
      serverUrl:'rtmps://live-api-s.facebook.com:443/rtmp/',streamKey:'ABCdef0987654321'
    }));
    assert.equal((await granted).type,'ready');
    assert.equal(app.isBusy(),true);
    assert.equal(fake.children.length,1);
    assert.ok(fake.children[0].args.at(-1).startsWith('rtmps://'));
    assert.equal((await (await fetch('http://127.0.0.1:'+port+'/health')).json()).busy,true);

    const other=await connect(port);sockets.push(other);
    const denied=awaitMessage(other);
    other.send(JSON.stringify({
      type:'start',password:PASSWORD,mimeType:'video/webm',
      serverUrl:'rtmps://facebook.com/rtmp/',streamKey:'ABCdef0987654321'
    }));
    assert.equal((await denied).type,'error');

    ws.send(Buffer.from('synthetic-fragment-1'));
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(Buffer.concat(fake.children[0].writes).toString('utf8'),'synthetic-fragment-1');
    ws.send(JSON.stringify({type:'stop'}));
    await new Promise(resolve=>ws.once('close',resolve));
    assert.equal(app.isBusy(),false,'Stop must release global stream slot');
  }finally{
    for(const ws of sockets)ws.terminate();
    await app.close();
  }
});
