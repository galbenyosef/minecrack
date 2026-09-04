import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';

// Records an isolated browser session; never reads or changes a player's save.
const url=process.env.MINECRACK_TEST_URL||'http://127.0.0.1:5194';
const output=path.resolve(process.argv[2]||'artifacts');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
  const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused);
  await page.mouse.move(768,432);
  await page.evaluate(()=>{const g=window.__minecrack.game;g.player.reset(g.world.spawn);g.mode='creative';g.inv.counts.socialiste=0;g.entities.clear();g.player.updateCamera();});
  await page.waitForTimeout(1800);
  await page.screenshot({path:path.join(output,'minecrack-1.2-world.png')});
  await page.evaluate(()=>{
    const g=window.__minecrack.game,stream=g.renderer.domElement.captureStream(30);
    const sound=g.audio.ctx.createMediaStreamDestination();g.audio.master.connect(sound);stream.addTrack(sound.stream.getAudioTracks()[0]);
    const chunks=[];window.videoRecorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9,opus',videoBitsPerSecond:6500000});
    window.recorded=new Promise(resolve=>{window.videoRecorder.ondataavailable=e=>chunks.push(e.data);window.videoRecorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())));});
    window.videoRecorder.start();window.frameSamples=[];let previous=performance.now();
    const sample=now=>{window.frameSamples.push(now-previous);previous=now;if(window.videoRecorder.state==='recording')requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.keyboard.down('d');await page.waitForTimeout(450);await page.keyboard.up('d');
  await page.waitForTimeout(400);
  // A real ore block makes the ten crack stages easy to see in this demonstration.
  await page.evaluate(()=>{
    const g=window.__minecrack.game;g.player.reset(g.world.spawn);
    const cell=g.world.worldToHex(g.player.position.x,g.player.position.z-3),p=g.world.hexToWorld(cell.q,cell.r),top=Math.floor(g.player.position.y)+1;
    for(let y=Math.floor(g.world.getGroundHeight(p.x,p.z));y<=top;y++)g.world.setBlock(cell.q,cell.r,y,y===top?'ore':'stone');
    g.world.rebuild();g.player.updateCamera();
    const dx=p.x-g.camera.position.x,dy=top+.5-g.camera.position.y,dz=p.z-g.camera.position.z;
    g.player.yaw=Math.atan2(-dx,-dz);g.player.pitch=Math.atan2(dy,Math.hypot(dx,dz));g.player.updateCamera();g.mode='survival';g.updateTarget();
  });
  await page.mouse.down();await page.waitForFunction(()=>window.__minecrack.game.miningOverlay.stage>=5);
  await page.screenshot({path:path.join(output,'minecrack-1.2-mining.png')});
  await page.waitForTimeout(750);await page.mouse.up();await page.waitForTimeout(400);
  await page.evaluate(()=>{const g=window.__minecrack.game;g.player.position.y=g.world.getGroundHeight(g.player.position.x,g.player.position.z);g.player.pitch=-.5;g.player.updateCamera();g.updateTarget();g.mode='creative';});
  await page.keyboard.press('2');await page.mouse.click(768,432,{button:'right'});await page.waitForTimeout(600);
  await page.evaluate(()=>{const g=window.__minecrack.game;g.player.reset(g.world.spawn);g.player.pitch=-.08;g.player.updateCamera();g.mode='survival';g.hunger=30;g.inv.slots[4]='chocolatine';g.inv.counts.chocolatine=3;g.select(4);});
  await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__minecrack.game.itemUse.progress>.4);
  await page.screenshot({path:path.join(output,'minecrack-1.2-eating.png')});
  await page.waitForFunction(()=>window.__minecrack.game.inv.counts.chocolatine===2);await page.mouse.up({button:'right'});
  await page.waitForTimeout(350);
  await page.evaluate(()=>window.__minecrack.use('radio'));await page.waitForTimeout(900);
  await page.evaluate(()=>{const g=window.__minecrack.game;window.__minecrack.use('furry');g.thirdPerson=true;g.player.pitch=-.08;});
  await page.keyboard.down('d');await page.waitForTimeout(900);await page.keyboard.up('d');
  await page.keyboard.down('Space');await page.waitForTimeout(200);await page.keyboard.up('Space');await page.waitForTimeout(800);
  await page.screenshot({path:path.join(output,'minecrack-1.2-avatar.png')});
  await page.evaluate(()=>{window.__minecrack.game.thirdPerson=false;window.__minecrack.game.player.reset(window.__minecrack.game.world.spawn);window.__minecrack.game.select(0);});
  await page.waitForTimeout(500);
  const metrics=await page.evaluate(()=>{
    window.videoRecorder.stop();const g=window.__minecrack.game,sorted=window.frameSamples.filter(x=>x>0&&x<1000).sort((a,b)=>a-b);
    return {samples:sorted.length,medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],strokes:g.viewModel.motion.strokeCount,impacts:g.viewModel.motion.impactCount,world:g.world.stats};
  });
  const bytes=await page.evaluate(()=>window.recorded);await fs.writeFile(path.join(output,'minecrack-1.2-gameplay.webm'),Buffer.from(bytes));
  await fs.writeFile(path.join(output,'minecrack-1.2-capture.json'),JSON.stringify({url,errors,...metrics},null,2));
  console.log(JSON.stringify({output,errors,...metrics}));
} finally {await browser.close();}
