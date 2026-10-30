'use strict';

// Isolated single-stream Facebook RTMPS test. No Firebase, no production dependencies.
// The server owns the RTMPS key in process memory ONLY during the test session.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {WebSocketServer,WebSocket}=require('ws');

const MAX_CHUNK=2*1024*1024;
const MAX_PENDING=12*1024*1024;
const SESSION_LIMIT_MS=60*60*1000;
const FILES={
  '/':{path:path.join(__dirname,'public','index.html'),type:'text/html; charset=utf-8'},
  '/app.js':{path:path.join(__dirname,'public','app.js'),type:'application/javascript; charset=utf-8'},
  '/robots.txt':{path:path.join(__dirname,'public','robots.txt'),type:'text/plain; charset=utf-8'}
};

function validateFacebook(serverUrl,streamKey){
  if(typeof serverUrl!=='string'||typeof streamKey!=='string')throw Error('Invalid destination');
  if(streamKey.length<8||streamKey.length>600||/[\s\/\\\0]/.test(streamKey))throw Error('Invalid stream key');
  let url;
  try{url=new URL(serverUrl);}catch(_){throw Error('Invalid Facebook server URL');}
  const host=url.hostname.toLowerCase();
  if(url.protocol!=='rtmps:'||url.username||url.password||
     !(host==='facebook.com'||host.endsWith('.facebook.com'))||
     url.search||url.hash||!url.pathname.startsWith('/rtmp')){
    throw Error('RTMPS Facebook server required');
  }
  // FFmpeg never invokes a shell. Reject ambiguous whitespace and slash injection.
  if(/\s/.test(serverUrl)||serverUrl.length>300)throw Error('Invalid Facebook destination');
  return serverUrl.replace(/\/+$/,'/')+'/'+streamKey;
}
function validPassword(candidate,expected){
  if(typeof candidate!=='string'||typeof expected!=='string')return false;
  const a=crypto.createHash('sha256').update(candidate).digest();
  const b=crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a,b);
}
function inputFormat(mime){
  const m=String(mime||'').toLowerCase();
  if(m.startsWith('video/mp4'))return 'mp4';
  if(m.startsWith('video/webm'))return 'matroska';
  throw Error('Unsupported MediaRecorder MIME');
}
function ffmpegArgs(format,target){
  return [
    '-hide_banner','-loglevel','error','-nostdin',
    '-fflags','+genpts','-probesize','1000000','-analyzeduration','3000000',
    '-f',format,'-i','pipe:0',
    '-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map','0:v:0','-map','1:a:0',
    '-vf','fps=20,scale=960:540:flags=fast_bilinear,format=yuv420p',
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-b:v','1100k','-maxrate','1400k','-bufsize','2400k',
    '-g','40','-keyint_min','40',
    '-c:a','aac','-b:a','96k','-ar','44100','-ac','2',
    '-flvflags','no_duration_filesize','-f','flv',target
  ];
}

function createApp({token=process.env.STUDIO_ADMIN_TOKEN,spawnFfmpeg=spawn,port=Number(process.env.PORT||10000),
  testSink=process.env.TEST_FLV_SINK||'',ffmpegBinary=process.env.FFMPEG_BIN||'ffmpeg'}={}){
  if(!token||token.length<24)throw Error('Configure STUDIO_ADMIN_TOKEN with at least 24 characters');
  if(testSink && process.env.NODE_ENV==='production')throw Error('Test sink cannot be enabled in production');
  let active=null;
  const server=http.createServer((req,res)=>{
    const p=(req.url||'').split('?')[0];
    if(req.method==='GET'&&p==='/health'){
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
      res.end(JSON.stringify({status:'ok',busy:!!active}));return;
    }
    const item=FILES[p];
    if(req.method!=='GET'||!item){
      res.writeHead(404,{'cache-control':'no-store'});res.end('Not found');return;
    }
    res.writeHead(200,{
      'content-type':item.type,'cache-control':'no-store','x-content-type-options':'nosniff',
      'x-frame-options':'DENY','referrer-policy':'no-referrer',
      'permissions-policy':'camera=(self), microphone=()',
      'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss: ws:; media-src 'self' blob:; frame-ancestors 'none'; form-action 'none'; base-uri 'none'"
    });
    fs.createReadStream(item.path).on('error',()=>res.destroy()).pipe(res);
  });
  const wss=new WebSocketServer({noServer:true,maxPayload:MAX_CHUNK,perMessageDeflate:false,clientTracking:true});
  server.on('upgrade',(req,socket,head)=>{
    const origin=req.headers.origin;
    let originValid=false;
    try{
      const url=new URL(origin);
      originValid=(url.protocol==='https:'||url.protocol==='http:')&&url.host===req.headers.host;
    }catch(_){ /* No valid Origin. */ }
    if(req.url!=='/ws'||!originValid){
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;
    }
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
  });

  wss.on('connection',ws=>{
    let own=null,authed=false;
    const send=(type,message)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,message}));};
    const stop=()=>{
      if(!own)return;
      const a=own;own=null;
      clearTimeout(a.timer);
      if(active===a)active=null;
      // Allow ffmpeg to drain the final fragment after a graceful stop.
      if(a.child&&!a.child.stdin.destroyed)a.child.stdin.end();
      const kill=setTimeout(()=>{if(a.child&&!a.child.killed)a.child.kill('SIGKILL');},6000);
      kill.unref?.();
      if(a.child)a.child.once('exit',()=>clearTimeout(kill));
    };
    ws.on('message',(raw,isBinary)=>{
      if(isBinary){
        if(!authed||!own||active!==own||!own.ready){ws.close(1008,'Not streaming');return;}
        if(raw.byteLength>MAX_CHUNK){ws.close(1009,'Chunk too large');return;}
        own.received+=raw.byteLength;
        if(own.received>3*1024*1024*1024){send('error','Dosažen limit přenesených dat.');ws.close(1009);return;}
        if(own.child.stdin.destroyed){send('error','Převodník již neběží.');ws.close(1011);return;}
        const accepted=own.child.stdin.write(raw);
        if(!accepted){
          ws._socket.pause();
          own.child.stdin.once('drain',()=>{if(ws.readyState===WebSocket.OPEN)ws._socket.resume();});
        }
        if(own.child.stdin.writableLength>MAX_PENDING){
          send('error','Spojení nestíhá zpracovávat obraz.');ws.close(1011);
        }
        return;
      }
      let packet;
      try{packet=JSON.parse(String(raw));}catch(_){ws.close(1003,'Invalid JSON');return;}
      if(!authed){
        if(packet.type!=='start'||!validPassword(packet.password,token)){
          send('error','Chybné heslo testovacího studia.');ws.close(1008,'Unauthorized');return;
        }
        if(active){send('error','Testovací server právě vysílá jiný přenos.');ws.close(1008,'Busy');return;}
        let format,dest;
        try{
          format=inputFormat(packet.mimeType);
          dest=testSink?testSink:validateFacebook(packet.serverUrl,packet.streamKey);
          if(testSink && !path.isAbsolute(testSink))throw Error('Test sink path must be absolute');
        }catch(_){
          send('error','Neplatná adresa Facebooku, klíč nebo formát videa.');
          ws.close(1008,'Invalid config');return;
        }
        authed=true;
        const a={child:null,ready:false,received:0,timer:null};
        active=a;own=a;
        let child;
        try{child=spawnFfmpeg(ffmpegBinary,ffmpegArgs(format,dest),{stdio:['pipe','ignore','ignore'],shell:false});}
        catch(_){active=null;own=null;send('error','Nepodařilo se spustit převodník.');ws.close(1011);return;}
        a.child=child;
        a.timer=setTimeout(()=>{send('error','Bezpečnostní limit: maximálně 60 minut testování.');ws.close(1000,'Time limit');},SESSION_LIMIT_MS);
        a.timer.unref?.();
        child.once('spawn',()=>{
          if(active!==a)return;
          a.ready=true;
          send('ready','Server převádí obraz. Sleduj náhled ve Facebook Live Produceru.');
        });
        child.once('error',()=>{
          if(active===a){send('error','Převodník FFmpeg nelze spustit.');ws.close(1011);}
        });
        child.once('exit',(code)=>{
          if(active===a){send('error','Přenosový proces skončil (kód '+String(code)+'). Zkontroluj Facebook Live Producer.');ws.close(1011);}
        });
        child.stdin.on('error',()=>{if(active===a)ws.close(1011,'Encoder error');});
        return;
      }
      if(packet.type==='stop'){send('stopped','Odesílání ukončeno.');stop();ws.close(1000,'Stopped');}
      else ws.close(1003,'Unsupported command');
    });
    ws.on('close',stop);
    ws.on('error',stop);
  });
  return {
    server,listen:()=>new Promise(resolve=>server.listen(port,'0.0.0.0',resolve)),
    close:()=>new Promise(resolve=>{
      if(active){active.child?.kill('SIGTERM');active=null;}
      for(const c of wss.clients)c.terminate();
      wss.close(()=>server.close(resolve));
    }),
    isBusy:()=>!!active
  };
}
if(require.main===module){
  const app=createApp();
  app.listen().then(()=>console.log('Poolcitadlo LIVE test relay listening (no Facebook key is logged)'));
}
module.exports={createApp,inputFormat,validateFacebook,validPassword,ffmpegArgs};
