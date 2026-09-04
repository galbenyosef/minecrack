import test from 'node:test';
import assert from 'node:assert/strict';
import {MouseLook} from '../src/mouse-look.js';
test('uncaptured input never moves the camera even at screen edges',()=>{
  const m=new MouseLook();
  for(const x of [0,400,1920,9999])assert.deepEqual(m.move({clientX:x,movementX:500,movementY:90}),{x:0,y:0});
});
test('captured input remains relative and unbounded by client coordinates',()=>{
  const m=new MouseLook();
  assert.deepEqual(m.move({clientX:0,movementX:8000,movementY:-3},{locked:true}),{x:8000,y:-3});
  assert.deepEqual(m.move({movementX:Infinity,movementY:NaN},{locked:true}),{x:0,y:0});
});
