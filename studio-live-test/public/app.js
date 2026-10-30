'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const canvas=$('output'),ctx=canvas.getContext('2d',{alpha:false});
  const camera=$('camera');
  const W=canvas.width,H=canvas.height;
  let scene='camera',stream=null,recorder=null,socket=null,recording=false,upload=Promise.resolve();
  let scores=[0,0],frameRequest=0,previousFrame=0;
  const uploadLimit=6*1024*1024;
  const names=['camera','soon','pause','end'];

  function status(id,message,kind=''){
    const el=$(id);el.textContent=message;el.className='status'+(kind?' '+kind:'');
  }
  function paintText(text,x,y,maxWidth,size=20,align='left',color='#fff'){
    ctx.fillStyle=color;ctx.textAlign=align;ctx.font='700 '+size+'px system-ui, sans-serif';
    ctx.fillText(String(text),x,y,maxWidth);
  }
  function renderFrame(t){
    frameRequest=requestAnimationFrame(renderFrame);
    if(t-previousFrame<40)return;
    previousFrame=t;
    ctx.fillStyle='#0c1c1a';ctx.fillRect(0,0,W,H);
    if(scene==='camera'){
      if(stream && camera.readyState>=2){
        const vw=camera.videoWidth||W,vh=camera.videoHeight||H;
        const ratio=Math.max(W/vw,H/vh);
        const cw=vw*ratio,ch=vh*ratio;
        try{ctx.drawImage(camera,(W-cw)/2,(H-ch)/2,cw,ch);}catch(_){}
      }else{
        paintText('ZAPNI KAMERU',W/2,H/2,600,34,'center','#c5d8ce');
      }
      ctx.fillStyle='rgba(9,17,25,0.87)';ctx.fillRect(15,H-91,W-30,76);
      const colA=$('colorA').value,colB=$('colorB').value;
      ctx.fillStyle=colA;ctx.fillRect(17,H-89,8,72);
      ctx.fillStyle=colB;ctx.fillRect(W-25,H-89,8,72);
      const barY=H-66;
      paintText($('clubA').value||'Bez klubu',35,H-71,240,12);
      paintText($('nameA').value||'Hráč A',35,barY+24,280,23);
      paintText($('clubB').value||'Bez klubu',W-35,H-71,240,12,'right');
      paintText($('nameB').value||'Hráč B',W-35,barY+24,280,23,'right');
      paintText(scores[0]+' : '+scores[1],W/2,H-38,205,37,'center','#f4cf75');
    }else{
      const labels={soon:'BRZY ZAČÍNÁME',pause:'PAUZA',end:'DĚKUJEME ZA SLEDOVÁNÍ'};
      ctx.fillStyle='#1a1e29';ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='#8c7041';ctx.lineWidth=3;ctx.strokeRect(90,95,W-180,H-190);
      paintText('POOLČÍTADLO LIVE',W/2,H/2-72,700,25,'center','#dabb79');
      paintText(labels[scene],W/2,H/2+10,W-150,43,'center');
      paintText($('nameA').value+'  •  '+$('nameB').value,W/2,H/2+55,W-160,18,'center','#c8d0d9');
    }
    ctx.fillStyle='rgba(11,17,23,0.72)';ctx.fillRect(W-218,12,205,47);
    paintText('POOLČÍTADLO',W-22,31,183,17,'right','#ffffff');
    paintText('by BC Rybárna',W-22,49,183,12,'right','#e8c176');
  }
  if(ctx)frameRequest=requestAnimationFrame(renderFrame);

  function updateButtons(){
    $('startCamera').disabled=!!stream;
    $('stopCamera').disabled=!stream;
    $('startLive').disabled=!stream||recording;
    $('stopLive').disabled=!recording;
    $('cameraFacing').disabled=recording;
  }
  function stopCamera(){
    if(stream)stream.getTracks().forEach(t=>t.stop());
    stream=null;
    camera.pause();
    camera.srcObject=null;
    updateButtons();
  }
  async function startCamera(){
    if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext){
      status('cameraStatus','Kamera vyžaduje Safari/Chrome otevřené přes HTTPS.','error');return;
    }
    if(recording){status('cameraStatus','Nejdřív ukonči vysílání.','error');return;}
    stopCamera();
    try{
      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:$('cameraFacing').value},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:20}},
        audio:false
      });
      camera.srcObject=stream;
      camera.muted=true;
      camera.playsInline=true;
      try{await camera.play();}catch(e){
        status('cameraStatus','Kamera je povolená, ale přehrání Safari odmítlo ('+e.name+'). Zkus znovu klepnout na Zapnout kameru.','error');
      }
      if(camera.readyState>=2)status('cameraStatus','Kamera je připravená. Náhled obsahuje i grafiku výsledku.','good');
      else status('cameraStatus','Kamera je připojená. Čekám na první snímek…');
      updateButtons();
    }catch(e){stopCamera();status('cameraStatus','Kamera se nezapnula: '+e.name+'. Zkontroluj oprávnění Safari.','error');}
  }
  function chooseRecorderType(){
    if(!window.MediaRecorder?.isTypeSupported || !canvas.captureStream)return '';
    for(const mime of [
      'video/mp4;codecs="avc1.42E01E"','video/mp4',
      'video/webm;codecs=vp8','video/webm'
    ])if(MediaRecorder.isTypeSupported(mime))return mime;
    return '';
  }
  function validateFields(){
    if($('adminPassword').value.length<24)throw Error('Zadej heslo testovacího serveru.');
    if(!$('fbServer').value.trim().startsWith('rtmps://'))throw Error('Vlož RTMPS adresu z Facebooku.');
    if($('fbKey').value.trim().length<8)throw Error('Vlož platný klíč z Facebook Live Produceru.');
  }
  function closeLive(message,kind=''){
    recording=false;
    try{if(recorder&&recorder.state!=='inactive')recorder.stop();}catch(_){}
    recorder=null;
    if(socket){
      const ws=socket;socket=null;
      if(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)ws.close();
    }
    updateButtons();
    if(message)status('liveStatus',message,kind);
  }
  function transmit(blob){
    if(!blob||!blob.size)return;
    upload=upload.then(async()=>{
      if(!socket||socket.readyState!==WebSocket.OPEN||!recording)return;
      if(socket.bufferedAmount>uploadLimit){
        closeLive('Připojení nestíhá odesílat video. Přenos byl zastaven kvůli ochraně paměti.','error');
        return;
      }
      const bytes=await blob.arrayBuffer();
      if(socket&&socket.readyState===WebSocket.OPEN&&recording)socket.send(bytes);
    }).catch(()=>{
      closeLive('Chyba při odesílání videozáznamu.','error');
    });
  }
  function beginRecording(mime){
    try{
      const videoStream=canvas.captureStream(20);
      if(!videoStream.getVideoTracks().length)throw Error('Canvas capture unavailable');
      recorder=new MediaRecorder(videoStream,{mimeType:mime,videoBitsPerSecond:1500000});
      recorder.ondataavailable=event=>transmit(event.data);
      recorder.onerror=event=>closeLive('Chyba videorekordéru '+(event.error?.name||'')+'.','error');
      recorder.onstop=()=>{
        videoStream.getTracks().forEach(track=>track.stop());
      };
      recorder.start(1000);
      status('liveStatus','Odesílám video serveru. Zkontroluj náhled ve Facebook Live Produceru.','good');
    }catch(e){closeLive('Zařízení nedokáže spustit záznam obrazu: '+e.message,'error');}
  }
  function startLive(){
    if(recording||!stream)return;
    try{validateFields();}catch(e){status('liveStatus',e.message,'error');return;}
    if(camera.readyState<2){
      status('liveStatus','Kamera ještě neposkytuje obraz. Zkontroluj náhled a zkus to znovu.','error');return;
    }
    const mime=chooseRecorderType();
    if(!mime){status('liveStatus','Safari nepodporuje potřebný formát MediaRecorder/canvas.captureStream. Tento iPhone nelze tímto testovacím způsobem použít.','error');return;}
    const pw=$('adminPassword').value;
    const key=$('fbKey').value.trim();
    const serverUrl=$('fbServer').value.trim();
    const socketUrl=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';
    let ws;
    try{ws=new WebSocket(socketUrl);}catch(e){status('liveStatus','Nelze připojit streamovací server.','error');return;}
    socket=ws;recording=true;updateButtons();
    status('liveStatus','Připojuji se k testovacímu serveru…');
    ws.onopen=()=>{
      if(socket!==ws)return;
      ws.send(JSON.stringify({type:'start',password:pw,streamKey:key,serverUrl,mimeType:mime}));
      $('adminPassword').value='';$('fbKey').value='';
    };
    ws.onmessage=event=>{
      if(socket!==ws)return;
      let msg;try{msg=JSON.parse(event.data);}catch(_){return;}
      if(msg.type==='ready'){beginRecording(mime);}
      else if(msg.type==='error'){closeLive(msg.message||'Server hlásí chybu.','error');}
      else if(msg.type==='stopped'){closeLive('Odesílání ukončeno.');}
    };
    ws.onerror=()=>{if(socket===ws)closeLive('Nepodařilo se udržet spojení se serverem.','error');};
    ws.onclose=()=>{if(socket===ws)closeLive('Spojení se serverem bylo ukončeno.','error');};
  }
  function stopLive(){
    if(!recording)return;
    recording=false;
    const ws=socket;
    const r=recorder;
    if(!r||r.state==='inactive'){
      if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'stop'}));
      closeLive('Test skončil. Facebook může potřebovat chvíli na ukončení.');return;
    }
    r.onstop=()=>{
      try{r.stream.getTracks().forEach(t=>t.stop());}catch(_){}
      upload.finally(()=>{
        if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'stop'}));
        closeLive('Odesílání ukončeno. Zastav živé vysílání také na Facebooku.');
      });
    };
    try{r.stop();}catch(_){closeLive('Odesílání ukončeno.');}
  }
  for(const [id,index,delta] of [
    ['minusA',0,-1],['plusA',0,1],['minusB',1,-1],['plusB',1,1]
  ]){
    $(id).addEventListener('click',()=>{
      scores[index]=Math.max(0,Math.min(999,scores[index]+delta));
      $('scoreLabel').textContent=scores.join(' : ');
    });
  }
  document.querySelectorAll('[data-scene]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      scene=btn.dataset.scene;
      document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    });
  });
  $('startCamera').addEventListener('click',startCamera);
  $('stopCamera').addEventListener('click',()=>{if(recording)stopLive();stopCamera();status('cameraStatus','Kamera vypnutá.');});
  $('cameraFacing').addEventListener('change',()=>{if(stream&&!recording)startCamera();});
  $('startLive').addEventListener('click',startLive);
  $('stopLive').addEventListener('click',stopLive);
  window.addEventListener('pagehide',()=>{if(recording)stopLive();stopCamera();cancelAnimationFrame(frameRequest);});
  updateButtons();
})();
