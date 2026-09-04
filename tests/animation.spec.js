import {test,expect} from '@playwright/test';

test('held mouse cycles the pickaxe, advances real cracks, emits debris and cancels cleanly',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused);
  await page.mouse.move(768,432);
  const block=await page.evaluate(()=>{
    const g=window.__minecrack.game;g.entities.clear();g.player.reset(g.world.spawn);g.player.pitch=-1.1;g.player.updateCamera();g.updateTarget();
    const b=g.target;g.world.setBlock(b.q,b.r,b.y,'ore');g.world.rebuild();g.updateTarget();
    window.motionSamples=[];window.captureMotion=true;
    const sample=()=>{if(!window.captureMotion)return;window.motionSamples.push({rx:g.hand.rotation.x,stage:g.miningOverlay.stage,particles:g.fx.particles.length,impacts:g.viewModel.motion.impactCount});requestAnimationFrame(sample);};requestAnimationFrame(sample);
    return {q:b.q,r:b.r,y:b.y};
  });
  await page.mouse.down();
  await page.waitForFunction(()=>window.__minecrack.game.miningOverlay.stage>=4);
  await page.mouse.up();
  await page.waitForFunction(()=>!window.__minecrack.game.miningOverlay.visible);
  expect(await page.evaluate(()=>window.__minecrack.game.miningProgress)).toBe(0);
  expect(await page.evaluate(b=>window.__minecrack.game.world.getBlock(b.q,b.r,b.y)?.type,block)).toBe('ore');
  await page.mouse.down();
  await page.waitForFunction(b=>!window.__minecrack.game.world.getBlock(b.q,b.r,b.y),block);
  await page.mouse.up();
  await page.waitForFunction(()=>window.__minecrack.game.viewModel.motion.action===null);
  const sampled=await page.evaluate(()=>{window.captureMotion=false;return window.motionSamples;});
  const rotations=sampled.map(s=>s.rx);
  expect(Math.max(...rotations)-Math.min(...rotations)).toBeGreaterThan(1.2);
  expect(new Set(sampled.filter(s=>s.stage>=0).map(s=>s.stage)).size).toBeGreaterThanOrEqual(6);
  expect(Math.max(...sampled.map(s=>s.particles))).toBeGreaterThan(5);
  expect(Math.max(...sampled.map(s=>s.impacts))).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('e');
  expect(await page.evaluate(()=>({cracks:window.__minecrack.game.miningOverlay.visible,hand:window.__minecrack.game.viewModel.visible,pending:window.__minecrack.game.pendingMelee}))).toEqual({cracks:false,hand:false,pending:false});
  expect(errors).toEqual([]);
});

test('consuming the last item completes its animation, then returns to an empty hand',async({page})=>{
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused);
  await page.evaluate(()=>{
    const g=window.__minecrack.game;g.inv.counts.chocolatine=1;g.inv.slots[0]='chocolatine';g.select(0);g.hunger=20;g.lastUse=-Infinity;
  });
  await page.mouse.move(768,432);await page.mouse.down({button:'right'});
  await page.waitForFunction(()=>window.__minecrack.game.viewModel.motion.action==='eat');
  const active=await page.evaluate(()=>({count:window.__minecrack.game.inv.counts.chocolatine,id:window.__minecrack.game.viewModel.itemId,hunger:window.__minecrack.game.hunger}));
  expect(active.count).toBe(1);expect(active.id).toBe('chocolatine');expect(active.hunger).toBeLessThan(21);
  await page.waitForFunction(()=>window.__minecrack.game.inv.counts.chocolatine===0);
  await page.mouse.up({button:'right'});
  expect(await page.evaluate(()=>window.__minecrack.game.hunger)).toBeGreaterThan(50);
  await page.waitForFunction(()=>window.__minecrack.game.viewModel.itemId===null);
  expect(await page.evaluate(()=>window.__minecrack.game.viewModel.motion.action)).toBe(null);
  await page.keyboard.press('2');await page.waitForFunction(()=>window.__minecrack.game.viewModel.itemId==='grass');
  expect(await page.evaluate(()=>window.__minecrack.game.hand.children[0].geometry.name)).toBe('crisp-hex-voxel');
});

test('quick inventory reopen waits for the requested mouse unlock without pausing again',async({page})=>{
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused);
  for(let i=0;i<4;i++){
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog',{name:'Dans vos poches.',exact:true})).toBeVisible();
    await page.keyboard.press('e');
    await page.waitForFunction(()=>!window.__minecrack.game.paused && !window.__minecrack.game.expectedUnlock);
  }
  await page.keyboard.down('w');
  const before=await page.evaluate(()=>window.__minecrack.game.player.position.z);
  await page.waitForFunction(z=>window.__minecrack.game.player.position.z<z-.2,before);
  await page.keyboard.up('w');
});

test('the held tool and all nine slots remain inside a narrow desktop panel',async({page})=>{
  await page.setViewportSize({width:397,height:718});
  await page.goto('/?qa');await page.waitForFunction(()=>window.__minecrack);
  await page.getByRole('button',{name:'Jouer',exact:true}).click();
  await page.waitForFunction(()=>!window.__minecrack.game.paused && window.__minecrack.game.viewModel.visible);
  const anchor=await page.evaluate(()=>{const g=window.__minecrack.game;return g.hand.position.clone().project(g.viewModel.camera).x;});
  expect(anchor).toBeGreaterThan(0);expect(anchor).toBeLessThan(.9);
  const slots=page.locator('.hotbar-slot');await expect(slots).toHaveCount(9);
  const left=await slots.first().boundingBox(),right=await slots.last().boundingBox();
  expect(left.x).toBeGreaterThanOrEqual(0);expect(right.x+right.width).toBeLessThanOrEqual(397);
});
