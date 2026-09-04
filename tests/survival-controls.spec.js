import {test,expect} from '@playwright/test';

async function start(page) {
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused&&document.pointerLockElement?.id==='game-canvas');
  await page.mouse.move(768,432);
  await page.evaluate(()=>window.__minecrack.game.entities.clear());
}

test('mouse stays captured through multiple complete rotations and right click never pauses',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page);
  const before=await page.evaluate(()=>({yaw:window.__minecrack.game.player.yaw,pitch:window.__minecrack.game.player.pitch}));
  await page.mouse.move(8400,502,{steps:30});
  const after=await page.evaluate(()=>({yaw:window.__minecrack.game.player.yaw,pitch:window.__minecrack.game.player.pitch,left:window.__minecrack.game.leftHeld,right:window.__minecrack.game.rightHeld}));
  expect(Math.abs(after.yaw-before.yaw)).toBeGreaterThan(Math.PI*2);expect(Math.abs(after.pitch-before.pitch)).toBeGreaterThan(.1);
  expect(after.left||after.right).toBe(false);
  await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  expect(await page.evaluate(()=>window.__minecrack.game.paused)).toBe(false);
  expect(await page.evaluate(()=>document.pointerLockElement?.id)).toBe('game-canvas');
  await page.keyboard.press('e');await expect(page.getByRole('dialog',{name:'Dans vos poches.',exact:true})).toBeVisible();
  const pausedYaw=await page.evaluate(()=>window.__minecrack.game.player.yaw);
  await page.mouse.move(420,340,{steps:6});expect(await page.evaluate(()=>window.__minecrack.game.player.yaw)).toBe(pausedYaw);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!window.__minecrack.game.paused&&!!document.pointerLockElement);
  await page.mouse.move(800,400);await page.mouse.move(940,400,{steps:6});
  expect(Math.abs(await page.evaluate(()=>window.__minecrack.game.player.yaw)-pausedYaw)).toBeGreaterThan(.15);
  expect(errors).toEqual([]);
});

test('right-click eating can be cancelled, commits after the hold, and cannot waste food when full',async({page})=>{
  await start(page);
  await page.evaluate(()=>{const g=window.__minecrack.game;g.hunger=20;g.health=40;g.inv.counts.chocolatine=2;g.select(3);});
  await expect(page.getByText('Maintenir clic droit · Manger',{exact:true})).toBeVisible();
  await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__minecrack.game.itemUse.progress>.2);
  expect(await page.evaluate(()=>window.__minecrack.game.inv.counts.chocolatine)).toBe(2);
  await page.mouse.up({button:'right'});await page.waitForFunction(()=>!window.__minecrack.game.itemUse.active);
  expect(await page.evaluate(()=>window.__minecrack.game.inv.counts.chocolatine)).toBe(2);
  await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__minecrack.game.inv.counts.chocolatine===1);await page.mouse.up({button:'right'});
  const fed=await page.evaluate(()=>({hunger:window.__minecrack.game.hunger,health:window.__minecrack.game.health}));
  expect(fed.hunger).toBeGreaterThan(51);expect(fed.health).toBeGreaterThanOrEqual(62);
  const blocked=await page.evaluate(()=>{const g=window.__minecrack.game;g.health=100;g.hunger=100;const before=g.inv.counts.chocolatine;const began=g.use();return{began,before,after:g.inv.counts.chocolatine};});
  expect(blocked.began).toBe(false);expect(blocked.after).toBe(blocked.before);
});

test('eating has priority over mining and switching slots cancels without spending food',async({page})=>{
  await start(page);
  const block=await page.evaluate(()=>{
    const g=window.__minecrack.game;g.hunger=20;g.player.reset(g.world.spawn);g.player.pitch=-1;g.player.updateCamera();g.updateTarget();
    const b=g.target;g.world.setBlock(b.q,b.r,b.y,'ore');g.world.rebuild();g.select(3);return {q:b.q,r:b.r,y:b.y};
  });
  await page.mouse.down({button:'right'});await page.waitForFunction(()=>window.__minecrack.game.itemUse.progress>.15);
  await page.mouse.down({button:'left'});
  await page.waitForFunction(()=>window.__minecrack.game.itemUse.progress>.45);
  expect(await page.evaluate(()=>window.__minecrack.game.miningProgress)).toBe(0);
  await page.keyboard.press('1');await page.mouse.up({button:'right'});await page.mouse.up({button:'left'});
  expect(await page.evaluate(()=>window.__minecrack.game.itemUse.active)).toBe(false);
  expect(await page.evaluate(()=>window.__minecrack.game.inv.counts.chocolatine)).toBe(3);
  expect(await page.evaluate(b=>window.__minecrack.game.world.getBlock(b.q,b.r,b.y)?.type,block)).toBe('ore');
});

test('empty tool stacks lose their mining bonus and failed placement never consumes or animates',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const g=window.__minecrack.game;g.paused=true;g.inv.counts.pickaxe=0;g.select(0);
    g.player.pitch=-1;g.player.updateCamera();g.updateTarget();const b=g.target;g.world.setBlock(b.q,b.r,b.y,'ore');g.world.rebuild();g.updateTarget();g.leftHeld=true;g.mine(.5);
    const emptyProgress=g.miningProgress;g.leftHeld=false;g.select(1);g.player.pitch=1.48;g.player.updateCamera();g.lastUse=-Infinity;
    const before=g.inv.counts.grass;g.use();return{emptyProgress,before,after:g.inv.counts.grass,action:g.viewModel.motion.action};
  });
  expect(result.emptyProgress).toBeLessThan(.3);expect(result.after).toBe(result.before);expect(result.action).toBe(null);
});

test('holding right click places successive blocks and releasing stops construction',async({page})=>{
  await start(page);
  const before=await page.evaluate(()=>{
    const g=window.__minecrack.game;g.player.reset(g.world.spawn);g.player.pitch=-.4;g.player.updateCamera();g.select(1);g.updateTarget();return g.inv.counts.grass;
  });
  await page.mouse.down({button:'right'});
  await page.waitForFunction(n=>window.__minecrack.game.inv.counts.grass<=n-2,before,{timeout:5000});
  await page.mouse.up({button:'right'});
  const stopped=await page.evaluate(()=>({count:window.__minecrack.game.inv.counts.grass,time:window.__minecrack.game.time}));
  await page.waitForFunction(t=>window.__minecrack.game.time>t+.65,stopped.time);
  expect(await page.evaluate(()=>window.__minecrack.game.inv.counts.grass)).toBe(stopped.count);
});

test('a denied capture offers a desktop window and never starts unsafe free-mouse gameplay',async({page})=>{
  await page.addInitScript(()=>{HTMLElement.prototype.requestPointerLock=()=>Promise.reject(new DOMException('Host denies capture','SecurityError'));});
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ouvrir la fenêtre de jeu',exact:true})).toBeVisible();
  const before=await page.evaluate(()=>({time:window.__minecrack.game.time,yaw:window.__minecrack.game.player.yaw}));
  await page.mouse.move(0,0);await page.mouse.move(3000,3000);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});
  expect(await page.evaluate(()=>({time:window.__minecrack.game.time,yaw:window.__minecrack.game.player.yaw,paused:window.__minecrack.game.paused}))).toEqual({...before,paused:true});
});

test('a delayed mouse capture arriving after the player cancels is released',async({page})=>{
  await page.addInitScript(()=>{
    window.fakeCapture=null;
    Object.defineProperty(document,'pointerLockElement',{get:()=>window.fakeCapture,configurable:true});
    HTMLElement.prototype.requestPointerLock=function(){
      window.captureLater=()=>{window.fakeCapture=this;document.dispatchEvent(new Event('pointerlockchange'));};
      return new Promise(()=>{});
    };
    document.exitPointerLock=()=>{window.fakeCapture=null;queueMicrotask(()=>document.dispatchEvent(new Event('pointerlockchange')));};
  });
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Petite pause.',exact:true})).toBeVisible();
  await page.evaluate(()=>window.captureLater());
  await page.waitForFunction(()=>!document.pointerLockElement&&!window.__minecrack.game.expectedUnlock);
  expect(await page.evaluate(()=>window.__minecrack.game.paused)).toBe(true);
  await expect(page.getByRole('dialog',{name:'Petite pause.',exact:true})).toBeVisible();
});

test('placed objects and summoned characters cannot spawn under an unsupported ceiling or inside the player',async({page})=>{
  await start(page);
  const result=await page.evaluate(()=>{
    const api=window.__minecrack,g=api.game;g.paused=true;
    g.player.reset(g.world.spawn);
    const h=g.world.worldToHex(g.player.position.x,g.player.position.z-3),c=g.world.hexToWorld(h.q,h.r),base=Math.floor(g.player.position.y);
    for(let y=base;y<=base+7;y++)g.world.removeBlock(h.q,h.r,y);
    g.world.setBlock(h.q,h.r,base+4,'stone');g.world.rebuild();
    g.camera.lookAt(c.x,base+4+.01,c.z);g.updateTarget();
    const underside=g.target?.place?.y===base+3;
    const counts={};
    for(const id of ['gnome','radio','nucleaire','urssaf','zerator']){
      g.inv.counts[id]=2;api.use(id);counts[id]=g.inv.counts[id];
    }
    const spawned=g.entities.all.length;
    g.camera.lookAt(g.player.position.x,g.player.position.y-2,g.player.position.z);api.use('zerator');
    return {underside,counts,spawned,insidePlayer:g.entities.all.length,egg:g.inv.counts.zerator};
  });
  expect(result.underside).toBe(true);expect(Object.values(result.counts)).toEqual([2,2,2,2,2]);
  expect(result.spawned).toBe(0);expect(result.insidePlayer).toBe(0);expect(result.egg).toBe(2);
});

test('Minecraft keys sprint with Ctrl, crouch with Shift, drop with Q and keep browser focus',async({page})=>{
  await start(page);
  await page.keyboard.down('Control');await page.keyboard.down('w');
  await page.waitForFunction(()=>Math.hypot(window.__minecrack.game.player.velocity.x,window.__minecrack.game.player.velocity.z)>6);
  await page.keyboard.up('Control');await page.keyboard.down('Shift');
  await page.waitForFunction(()=>window.__minecrack.game.player.crouching&&window.__minecrack.game.player.crouchOffset<-.3);
  expect(await page.evaluate(()=>Math.hypot(window.__minecrack.game.player.velocity.x,window.__minecrack.game.player.velocity.z))).toBeLessThan(2);
  await page.keyboard.up('w');await page.keyboard.up('Shift');
  await page.keyboard.press('4');const count=await page.evaluate(()=>window.__minecrack.game.inv.counts.chocolatine);
  await page.keyboard.press('q');
  expect(await page.evaluate(()=>window.__minecrack.game.inv.counts.chocolatine)).toBe(count-1);
  expect(await page.evaluate(()=>window.__minecrack.game.entities.all.find(e=>e.pickup&&e.item==='chocolatine')?.pickupDelay)).toBe(2);
  const screenshotDownload=page.waitForEvent('download');await page.keyboard.press('F2');
  const screenshot=await screenshotDownload;expect(screenshot.suggestedFilename()).toMatch(/^Minecrack-.*\.png$/);expect(await screenshot.failure()).toBe(null);
  await page.keyboard.press('F1');expect(await page.evaluate(()=>window.__minecrack.game.screenshotMode)).toBe(true);
  await page.keyboard.press('p');expect(await page.evaluate(()=>window.__minecrack.game.paused)).toBe(false);
  expect(await page.evaluate(()=>document.pointerLockElement?.id)).toBe('game-canvas');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Petite pause.',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reprendre l’aventure',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused&&!!document.pointerLockElement);
  await page.keyboard.press('F1');expect(await page.evaluate(()=>window.__minecrack.game.screenshotMode)).toBe(false);
});

test('desktop handoff sends the current world, restores it and preserves the previous browser save',async({page,context})=>{
  await page.addInitScript(()=>{HTMLElement.prototype.requestPointerLock=()=>Promise.reject(new DOMException('Host denies capture','SecurityError'));});
  let sent;
  await page.route('**/api/launch-desktop',async route=>{sent=route.request().postDataJSON().save;await route.fulfill({json:{opened:true,message:'Votre partie est prête dans la fenêtre de jeu.'}});});
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ouvrir la fenêtre de jeu',exact:true})).toBeVisible();
  await page.evaluate(()=>{const g=window.__minecrack.game;g.inv.counts.ore=1200;g.hunger=37;});
  await page.getByRole('button',{name:'Ouvrir la fenêtre de jeu',exact:true}).click();
  await expect(page.getByRole('button',{name:'Reprendre dans la fenêtre de jeu',exact:true})).toBeVisible();
  expect(sent.inventory.counts.ore).toBe(1200);expect(sent.hunger).toBe(37);
  const desktop=await context.newPage();
  await desktop.route('**/api/handoff**',route=>route.fulfill({json:{save:sent}}));
  await desktop.addInitScript(()=>localStorage.setItem('minecrack-save-v1',JSON.stringify({oldSave:true})));
  await desktop.goto('/?qa&handoff='+'A'.repeat(43));
  await expect(desktop.getByRole('dialog',{name:'Petite pause.',exact:true})).toBeVisible();
  expect(await desktop.evaluate(()=>window.__minecrack.game.inv.counts.ore)).toBe(1200);
  expect(await desktop.evaluate(()=>window.__minecrack.game.hunger)).toBe(37);
  expect(await desktop.evaluate(()=>JSON.parse(localStorage.getItem('minecrack-save-v1-before-transfer')))).toEqual({oldSave:true});
  expect(desktop.url()).not.toContain('handoff=');await desktop.close();
});
