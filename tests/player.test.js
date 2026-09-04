import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Player } from "../src/player.js";
import { HexWorld, hexDistance, hexToWorld } from "../src/world.js";

const DT = 1 / 60;

function floorWorld(radius = 6) {
  const world = new HexWorld(new THREE.Scene(), { radius });
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++) {
      if (hexDistance(q, r) <= radius) world.setBlock(q, r, 0, "bedrock");
    }
  world.spawn.set(0, 1, 0);
  return world;
}

function makePlayer(world) {
  return new Player(world, new THREE.PerspectiveCamera(), { play() {} });
}

test("Ctrl sprints, while using food slows movement and hunger prevents sprinting", () => {
  const world=floorWorld(),player=makePlayer(world),keys=new Set(["KeyW","ControlLeft"]);
  assert.equal(player.update(DT,keys).sprinting,true);const sprint=Math.hypot(player.velocity.x,player.velocity.z);
  assert.equal(player.update(DT,keys,{canSprint:false}).sprinting,false);const hungry=Math.hypot(player.velocity.x,player.velocity.z);
  assert.equal(player.update(DT,keys,{using:true}).sprinting,false);const eating=Math.hypot(player.velocity.x,player.velocity.z);
  assert.ok(sprint>hungry);assert.ok(eating<hungry*.4);assert.ok(eating>0);
  assert.equal(player.update(DT,new Set(["KeyW","ControlRight"])).sprinting,true);
  assert.equal(player.update(DT,new Set(["KeyS","ControlLeft"])).sprinting,false,"backwards movement cannot sprint");
  assert.equal(player.update(DT,new Set(["KeyW"]),{speed:true}).sprinting,false,"a speed buff is not a Ctrl sprint");
  world.dispose();
});

test("player lands on a real hex floor, takes one fall hit and remains grounded", () => {
  const world = floorWorld();
  const player = makePlayer(world);
  player.position.y = 8;
  const fallDamage = [];
  player.onFall = (amount) => fallDamage.push(amount);
  for (let i = 0; i < 240; i++) {
    player.update(DT, new Set());
    assert.ok(player.position.y >= 1, "player never tunnels through the floor");
  }
  assert.equal(player.position.y, 1);
  assert.equal(player.velocity.y, 0);
  assert.equal(player.grounded, true);
  assert.equal(fallDamage.length, 1);
  assert.ok(fallDamage[0] > 0);
  world.dispose();
});

test("jumping in a two-block-high corridor cannot push the camera into its ceiling", () => {
  const world = floorWorld();
  world.setBlock(0, 0, 3, "stone");
  const player = makePlayer(world);
  player.update(DT, new Set());
  assert.equal(
    player.collides(0, 1, 0),
    false,
    "a two-block corridor remains traversable",
  );
  let jumped = false;
  for (let i = 0; i < 140; i++) {
    player.update(DT, new Set(i < 25 ? ["Space"] : []));
    jumped ||= player.position.y > 1.05;
    assert.ok(
      player.camera.position.y < 3,
      "camera stays beneath the solid ceiling",
    );
    assert.ok(player.position.y >= 1);
  }
  assert.equal(jumped, true);
  assert.equal(player.position.y, 1);
  assert.equal(player.grounded, true);
  world.dispose();
});

test("continuous outward movement stops at the playable hex boundary", () => {
  const world = floorWorld();
  const player = makePlayer(world);
  const edge = hexToWorld(world.radius - 1, 0);
  player.position.set(edge.x, 1, edge.z);
  player.yaw = -Math.PI / 2;
  for (let i = 0; i < 240; i++) {
    player.update(DT, new Set(["KeyW", "ControlLeft"]), { speed: true });
    const h = world.worldToHex(player.position.x, player.position.z);
    assert.ok(hexDistance(h.q, h.r) <= world.radius - 1);
    assert.ok(
      Number.isFinite(
        world.getGroundHeight(player.position.x, player.position.z),
      ),
    );
    assert.equal(player.position.y, 1);
  }
  assert.ok(
    player.position.x > edge.x,
    "movement reaches the boundary before stopping",
  );
  world.dispose();
});

test("physical WASD directions rotate with yaw and AZERTY aliases cannot cause extra movement", () => {
  const world=floorWorld();
  const cases=[
    ["KeyW",0,0,-1], ["KeyS",0,0,1], ["KeyA",0,-1,0], ["KeyD",0,1,0],
    ["KeyW",Math.PI/2,-1,0], ["KeyD",Math.PI/2,0,-1],
  ];
  for(const [key,yaw,x,z] of cases){
    const player=makePlayer(world);player.yaw=yaw;
    player.update(DT,new Set([key]));
    assert.ok(Math.abs(player.position.x-x*4.6*DT)<1e-10,`${key} x at yaw ${yaw}`);
    assert.ok(Math.abs(player.position.z-z*4.6*DT)<1e-10,`${key} z at yaw ${yaw}`);
  }
  const player=makePlayer(world);
  player.update(DT,new Set(["KeyZ","KeyQ"]));
  assert.deepEqual(player.position.toArray(),[0,1,0],"layout-independent codes W/A are the only forward/left bindings");
  player.update(DT,new Set(["KeyW","KeyD"]));
  assert.ok(Math.abs(Math.hypot(player.velocity.x,player.velocity.z)-4.6)<1e-10,"diagonals stay normalized");
  world.dispose();
});

test("Shift crouches slowly, overrides Ctrl and lowers the camera without changing foot height", () => {
  const world=floorWorld(),player=makePlayer(world);
  const keys=new Set(["KeyW","ShiftLeft","ControlLeft"]);
  const motion=player.update(DT,keys);
  assert.equal(motion.crouching,true);assert.equal(motion.sprinting,false);
  assert.ok(Math.abs(Math.hypot(player.velocity.x,player.velocity.z)-4.6*.3)<1e-10);
  for(let i=0;i<60;i++)player.update(DT,new Set(["ShiftRight"]));
  assert.equal(player.position.y,1);
  assert.ok(Math.abs(player.camera.position.y-player.position.y-1.27)<.001);
  for(let i=0;i<60;i++)player.update(DT,new Set());
  assert.equal(player.crouching,false);
  assert.ok(Math.abs(player.camera.position.y-player.position.y-1.64)<.001);
  world.dispose();
});

test("crouching keeps feet on a raised hex ledge, but releasing Shift permits falling", () => {
  const world=floorWorld();
  world.setBlock(0,0,3,"stone");
  const player=makePlayer(world);player.position.set(0,4,0);player.yaw=-Math.PI/2;
  player.update(DT,new Set());
  for(let i=0;i<180;i++){
    player.update(DT,new Set(["KeyW","ShiftLeft"]));
    assert.equal(player.position.y,4,"sneaking never drops onto the lower floor");
    assert.equal(player.grounded,true);
  }
  assert.ok(player.position.x>.5,"the player can approach and overhang the edge");
  const edgeX=player.position.x;
  for(let i=0;i<45;i++)player.update(DT,new Set(["KeyW"]));
  assert.ok(player.position.x>edgeX+.5);
  assert.ok(player.position.y<4,"ordinary movement can leave the ledge");
  world.dispose();
});

test("sneak edge protection does not lock a jump or movement through water", () => {
  const world=floorWorld();
  world.setBlock(0,0,3,"stone");
  const player=makePlayer(world);player.position.set(0,4,0);player.yaw=-Math.PI/2;
  player.update(DT,new Set());
  for(let i=0;i<120;i++)player.update(DT,new Set(["KeyW","ShiftLeft"]));
  const edgeX=player.position.x;
  player.update(DT,new Set(["KeyW","ShiftLeft","Space"]));
  assert.equal(player.grounded,false);assert.ok(player.position.y>4);
  for(let i=0;i<15;i++)player.update(DT,new Set(["KeyW","ShiftLeft"]));
  assert.ok(player.position.x>edgeX+.2,"airborne crouching can cross the edge");
  world.dispose();

  const waterWorld=floorWorld();
  for(let q=-2;q<=2;q++)for(let r=-2;r<=2;r++){
    waterWorld.removeBlock(q,r,0);
    waterWorld.setBlock(q,r,0,"water");
    waterWorld.setBlock(q,r,1,"water");
  }
  const swimmer=makePlayer(waterWorld);swimmer.grounded=true;
  const before=swimmer.position.clone();
  const motion=swimmer.update(DT,new Set(["KeyW","ShiftLeft","Space"]));
  assert.equal(motion.water,true);assert.equal(motion.crouching,true);
  assert.ok(swimmer.position.z<before.z,"water does not require a solid floor for crouch movement");
  assert.ok(swimmer.position.y>before.y,"Space still swims upward while Shift is held");
  waterWorld.dispose();
});
