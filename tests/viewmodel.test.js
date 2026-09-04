import test from 'node:test';
import assert from 'node:assert/strict';
import {HandMotion,FirstPersonView} from '../src/viewmodel.js';

test('holding mine produces full repeated strokes and synchronized impacts',()=>{
  const a=new HandMotion(),angles=[],hits=[];
  for(let i=0;i<120;i++){const result=a.update(1/60,{mining:true,time:i/60});angles.push(result.pose.rx);if(result.hit)hits.push(i/60);}
  assert.ok(hits.length>=5&&hits.length<=6);assert.ok(Math.max(...angles)-Math.min(...angles)>1.2);
  for(let i=1;i<hits.length;i++)assert.ok(hits[i]-hits[i-1]>.3&&hits[i]-hits[i-1]<.38);
});
test('different item uses follow visibly different paths and return to rest',()=>{
  const poses=[];for(const action of ['eat','throw','recoil','place','read']){const a=new HandMotion();a.trigger(action);for(let i=0;i<10;i++)a.update(1/60);poses.push(a.pose);for(let i=0;i<120;i++)a.update(1/60);assert.equal(a.action,null);assert.ok(Math.abs(a.pose.rx+.12)<.001);}
  assert.equal(new Set(poses.map(p=>JSON.stringify(p))).size,5);
});
test('cancelled mining stops retriggering; independent simulation rates keep impact count',()=>{
  const simulate=fps=>{const a=new HandMotion();for(let i=0;i<fps*2;i++)a.update(1/fps,{mining:true});return a.impactCount;};assert.equal(simulate(60),simulate(120));
  const a=new HandMotion();a.update(.1,{mining:true});a.reset();for(let i=0;i<90;i++)a.update(1/60);assert.equal(a.action,null);assert.equal(a.phase,0);
});

test('held eating stays raised through five bites, suppresses mining, then lowers on release',()=>{
  const motion=new HandMotion(),ys=[];
  motion.trigger('mine');
  for(let i=0;i<=100;i++){
    const result=motion.update(.0125,{usingItem:true,useProgress:i/100,useKind:'eat',mining:true});
    assert.equal(result.hit,false);assert.equal(result.action,'eat');
    if(i>=20){assert.ok(result.pose.y>-.42,'food remains near the mouth until the use ends');ys.push(result.pose.y);}
  }
  assert.equal(motion.impactCount,0,'holding food cannot emit melee or mining contacts');
  let peaks=0;
  for(let i=1;i<ys.length-1;i++)if(ys[i]>ys[i-1]&&ys[i]>ys[i+1])peaks++;
  assert.ok(peaks>=3&&peaks<=5,'several visible bites instead of one short use pulse');
  const heldY=motion.pose.y;
  motion.update(1/60,{usingItem:false});
  assert.ok(motion.pose.y<heldY&&motion.pose.y>-.63,'release lowers rather than snapping to rest');
  for(let i=0;i<60;i++)motion.update(1/60);
  assert.ok(Math.abs(motion.pose.y+.63)<.001);
  assert.equal(motion.action,null);
  assert.equal(motion.usingItem,false);
});

test('reading hold has its own stable pose and resets completely on item selection',()=>{
  const eating=new HandMotion(),reading=new HandMotion();
  eating.update(.1,{usingItem:true,useProgress:.5,useKind:'eat'});
  reading.update(.1,{usingItem:true,useProgress:.5,useKind:'read'});
  assert.ok(Math.abs(eating.pose.rx-reading.pose.rx)>.8);
  reading.reset();
  reading.update(1/60);
  assert.equal(reading.usingItem,false);assert.equal(reading.useBlend,0);
  assert.ok(Math.abs(reading.pose.rx+.12)<.001);
});

test('a following held food starts without snapping the raised hand down between uses',()=>{
  const motion=new HandMotion();
  motion.update(.1,{usingItem:true,useProgress:1,useKind:'eat'});
  motion.update(1/60,{usingItem:false});
  const before=motion.pose.y;
  motion.update(1/60,{usingItem:true,useProgress:.015,useKind:'eat'});
  assert.ok(Math.abs(motion.pose.y-before)<.03);
  assert.ok(motion.pose.y>-.46);
});

test('last held consumable remains visible during use and lowering, but item switching is immediate',()=>{
  // The renderer-independent guard can be exercised without creating a WebGL context.
  const retained={itemId:'chocolatine',costume:false,world:{},motion:new HandMotion(),group:{clear(){throw new Error('prematurely removed held item');}}};
  retained.motion.update(.1,{usingItem:true,useProgress:.7,useKind:'eat'});
  assert.doesNotThrow(()=>FirstPersonView.prototype.setItem.call(retained,'chocolatine',0,retained.world));
  assert.throws(()=>FirstPersonView.prototype.setItem.call(retained,'stone',4,retained.world),/prematurely removed/,'selecting a different item is allowed to replace the held model immediately');
  retained.motion.update(1/60,{usingItem:false});
  assert.doesNotThrow(()=>FirstPersonView.prototype.setItem.call(retained,'chocolatine',0,retained.world));
  retained.motion.reset();
  assert.throws(()=>FirstPersonView.prototype.setItem.call(retained,'chocolatine',0,retained.world),/prematurely removed/,'after cancellation the previous item is allowed to clear');
});
