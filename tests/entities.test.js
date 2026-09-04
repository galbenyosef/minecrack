import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Entities } from "../src/entities.js";
import { Inventory } from "../src/inventory.js";
import { HexWorld, hexToWorld } from "../src/world.js";
import { getAnimationRig } from "../src/animation-rig.js";

function fixture() {
  const scene = new THREE.Scene();
  const sounds = [];
  const inv = new Inventory();
  inv.counts = {};
  const game = {
    scene,
    world: new HexWorld(scene, { radius: 6 }),
    player: { position: new THREE.Vector3(40, 5, 40) },
    time: 0,
    inv,
    fx: { burst() {}, ring() {} },
    audio: {
      play(name) {
        sounds.push(name);
      },
    },
    ui: { notify() {} },
    hurt() {},
    invulnerable() {
      return false;
    },
    name(id) {
      return id;
    },
  };
  return { game, entities: new Entities(game), sounds };
}

test("nuclear chain explosions pay each hostile inventory back exactly once", () => {
  const { game, entities, sounds } = fixture();
  const first = entities.spawn("nucleaire", new THREE.Vector3(0, 2, 0));
  entities.spawn("nucleaire", new THREE.Vector3(1, 2, 0));
  const hostile = entities.spawn("hostile", new THREE.Vector3(2, 2, 0), {
    inventory: { ore: 7, stone: 2 },
  });
  entities.damage(first, 100);
  assert.equal(
    entities.all.length,
    0,
    "the chain destroyed both reactors and the hostile",
  );
  assert.deepEqual(game.inv.counts, { ore: 7, stone: 2, cuir: 1 });
  assert.equal(sounds.filter((name) => name === "explosion").length, 2);
  entities.damage(hostile, 100);
  assert.deepEqual(
    game.inv.counts,
    { ore: 7, stone: 2, cuir: 1 },
    "late damage cannot duplicate a removed entity reward",
  );
  game.world.dispose();
});

test("fleeing and knockback cannot move a hostile onto missing world columns", () => {
  const { game, entities } = fixture();
  game.world.setBlock(0, 0, 0, "bedrock");
  game.world.setBlock(1, 0, 0, "bedrock");
  game.player.position.set(0, 1, 0);
  const start = hexToWorld(1, 0);
  const hostile = entities.spawn(
    "hostile",
    new THREE.Vector3(start.x, 1, start.z),
    { fear: 10 },
  );
  for (let i = 0; i < 180; i++) {
    game.time += 1 / 60;
    entities.update(1 / 60);
    const pos = hostile.model.position;
    assert.ok(
      Number.isFinite(game.world.getGroundHeight(pos.x, pos.z)),
      "fleeing stays on real terrain",
    );
    assert.equal(pos.y, 1);
  }
  assert.ok(hostile.model.position.x > start.x, "hostile flees up to the edge");
  const before = hostile.model.position.clone();
  entities.damage(hostile, 0, 8, new THREE.Vector3(1, 0, 0));
  assert.deepEqual(
    hostile.model.position.toArray(),
    before.toArray(),
    "knockback landing beyond terrain is rejected",
  );
  entities.clear();
  game.world.dispose();
});

test("NPC pathfinding rejects a route whose intermediate columns have no floor", () => {
  const { game, entities } = fixture();
  game.world.setBlock(0, 0, 0, "bedrock");
  game.world.setBlock(3, 0, 0, "bedrock");
  const hostile = entities.spawn("hostile", new THREE.Vector3(0, 1, 0));
  const target = hexToWorld(3, 0);
  assert.deepEqual(
    entities.pathTo(hostile, new THREE.Vector3(target.x, 1, target.z)),
    [],
  );
  // Restoring a contiguous floor makes the same goal navigable.
  game.world.setBlock(1, 0, 0, "bedrock");
  game.world.setBlock(2, 0, 0, "bedrock");
  const path = entities.pathTo(
    hostile,
    new THREE.Vector3(target.x, 1, target.z),
  );
  assert.ok(path.length > 0);
  for (const point of path)
    assert.equal(point.y, game.world.getGroundHeight(point.x, point.z));
  entities.clear();
  game.world.dispose();
});

test("explosions open destroyed Lucky Blocks exactly once and preserve bedrock", () => {
  const { game, entities } = fixture();
  const drops = [];
  game.openLucky = (p) => drops.push(p);
  game.world.setBlock(0, 0, 0, "bedrock");
  game.world.setBlock(0, 0, 1, "lucky");
  entities.explode(new THREE.Vector3(0, 1.5, 0), 2, 30, true);
  assert.equal(game.world.getBlock(0, 0, 1), null);
  assert.equal(game.world.getBlock(0, 0, 0).type, "bedrock");
  assert.equal(drops.length, 1);
  entities.explode(new THREE.Vector3(0, 1.5, 0), 2, 30, true);
  assert.equal(drops.length, 1);
  game.world.dispose();
});

test("dropped items bob around a fixed anchor identically at 30 and 120 FPS", () => {
  const simulate = (fps) => {
    const { game, entities } = fixture();
    const item = entities.drop("cuir", new THREE.Vector3(0, 3, 0));
    for (let i = 0; i < fps * 10; i++) {
      entities.update(1 / fps);
      assert.ok(Math.abs(item.model.position.y - 3) <= 0.1200001, "height never accumulates drift");
    }
    const position = item.model.position.clone();
    entities.clear();
    game.world.dispose();
    return position;
  };
  assert.ok(simulate(30).distanceTo(simulate(120)) < 1e-10);
});

test("saving and restoring a bobbing drop preserves its anchor and pickup scale", () => {
  const { game, entities } = fixture();
  entities.drop("cuir", new THREE.Vector3(0, 3, 0), 4);
  entities.update(0.6);
  const saved = entities.serialize();
  assert.deepEqual(saved[0].position, [0, 3, 0]);
  entities.restore(saved);
  assert.deepEqual(entities.all[0].anchor.toArray(), [0, 3, 0]);
  assert.equal(entities.all[0].model.scale.x, 0.7);
  assert.equal(entities.all[0].count, 4);
  entities.clear();
  game.world.dispose();
});

test("saving a thrown resource stack preserves all 1200 units and the remaining pickup delay", () => {
  const { game, entities } = fixture();
  game.player.position.set(0, 1, 0);
  const drop = entities.drop("stone", new THREE.Vector3(0, 1.65, 0), 1200);
  drop.pickupDelay = 2;
  entities.update(1.5);
  assert.equal(entities.all.length, 1, "a player-thrown stack cannot be collected before two seconds");
  assert.deepEqual(game.inv.counts, {});
  const saved = entities.serialize();
  assert.equal(saved[0].count, 1200);
  assert.equal(saved[0].pickupDelay, 0.5);
  entities.restore(saved);
  assert.equal(entities.all[0].kind, "stone", "resource pickups survive restoration");
  assert.equal(entities.all[0].count, 1200, "restoration cannot truncate the thrown stack to 999");
  entities.update(0.49);
  assert.deepEqual(game.inv.counts, {}, "loading a save cannot bypass the remaining delay");
  entities.update(0.01);
  assert.equal(entities.all.length, 0);
  assert.deepEqual(game.inv.counts, { stone: 1200 }, "the whole stack returns exactly once");
  entities.update(1);
  assert.deepEqual(game.inv.counts, { stone: 1200 });
  game.world.dispose();
});

test("restored pickup counts stay integral and respect the inventory quantity limit", () => {
  const { game, entities } = fixture();
  entities.drop("pickaxe", new THREE.Vector3(0, 3, 0), 1);
  const [saved] = entities.serialize();
  entities.restore([999999, 1000000, 1.5, 0, -2, "42"].map((count) => ({ ...saved, count })));
  assert.deepEqual(entities.all.map((entity) => entity.count), [999999, 999999, 1, 1, 1, 1]);
  assert.ok(entities.all.every((entity) => entity.kind === "pickaxe" && entity.pickup));
  entities.clear();
  game.world.dispose();
});

test("dropped blocks share the terrain prism and materials without disposing world assets", () => {
  const { game, entities } = fixture();
  game.world.setBlock(0, 0, 0, "stone");
  game.world.rebuild();
  const geometry = game.world.geometry;
  const materials = game.world.materials.stone;
  let geometryDisposals = 0, materialDisposals = 0;
  geometry.addEventListener("dispose", () => { geometryDisposals++; });
  for (const material of new Set(materials))
    material.addEventListener("dispose", () => { materialDisposals++; });
  const a = entities.drop("stone", new THREE.Vector3(0, 3, 0));
  const b = entities.drop("stone", new THREE.Vector3(2, 3, 0));
  for (const entity of [a, b]) {
    const mesh = entity.model.children[0];
    assert.equal(mesh.geometry, geometry, "the pickup remains a true hexagonal voxel");
    assert.equal(mesh.material, materials, "the pickup uses its terrain block textures");
  }
  const saved = entities.serialize();
  entities.restore(saved);
  assert.equal(entities.all[0].model.children[0].geometry, geometry);
  entities.clear();
  assert.equal(geometryDisposals, 0, "removing pickups leaves shared terrain geometry alive");
  assert.equal(materialDisposals, 0, "removing pickups leaves shared terrain materials alive");
  game.world.dispose();
  assert.equal(geometryDisposals, 1, "the world owns disposal of its geometry");
  assert.equal(materialDisposals, new Set(materials).size);
});

test("damage flashes only the struck instance and restores its exact shared materials", () => {
  const { game, entities } = fixture();
  const a = entities.spawn("hostile", new THREE.Vector3(0, 1, 0));
  const b = entities.spawn("hostile", new THREE.Vector3(2, 1, 0));
  const meshes = (model) => {
    const list = [];
    model.traverse((node) => { if (node.isMesh) list.push(node); });
    return list;
  };
  const am = meshes(a.model), bm = meshes(b.model);
  const originals = am.map((mesh) => mesh.material);
  const colors = originals.map((material) => material.color.getHex());
  entities.damage(a, 5);
  am.forEach((mesh, index) => {
    assert.notEqual(mesh.material, originals[index]);
    assert.equal(bm[index].material, originals[index]);
    assert.equal(originals[index].color.getHex(), colors[index]);
  });
  entities.update(0.1);
  assert.ok(getAnimationRig(a.model).joints["motion-root"].rotation.x < -0.05, "visible hit recoil");
  entities.update(0.2);
  am.forEach((mesh, index) => assert.equal(mesh.material, originals[index], "material restored by identity"));
  assert.ok(Math.abs(getAnimationRig(a.model).joints["motion-root"].rotation.x) < 1e-12);
  entities.clear();
  game.world.dispose();
});

test("hostile melee damage is synchronized to the visible forward swing and rechecks reach", () => {
  const { game, entities } = fixture();
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++)
    game.world.setBlock(q, r, 0, "bedrock");
  game.player.position.set(0, 1, 1.2);
  game.inv.add("ore", 8);
  const hurts = [];
  game.hurt = (amount) => hurts.push(amount);
  const actor = entities.spawn("hostile", new THREE.Vector3(0, 1, 0));
  entities.update(0.016);
  assert.deepEqual(hurts, [], "wind-up has no premature damage");
  assert.equal(game.inv.counts.ore, 8);
  entities.update(0.19);
  assert.deepEqual(hurts, [7]);
  assert.equal(game.inv.counts.ore, 5);
  assert.ok(getAnimationRig(actor.model).joints["right-arm"].rotation.x < -1.6, "fist is forward on contact");
  entities.update(0.1);
  assert.deepEqual(hurts, [7], "one contact cannot charge twice");
  actor.cooldown = 0;
  entities.update(0.016);
  game.player.position.set(40, 1, 40);
  entities.update(0.2);
  assert.deepEqual(hurts, [7], "moving out of reach before contact avoids the hit");
  entities.clear();
  game.world.dispose();
});

test("knockback travels over time and a defeated walker falls before its visual is removed", () => {
  const { game, entities } = fixture();
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++)
    game.world.setBlock(q, r, 0, "bedrock");
  const actor = entities.spawn("hostile", new THREE.Vector3(0, 1, 0));
  entities.damage(actor, 5, 1, new THREE.Vector3(1, 0, 0));
  assert.equal(actor.model.position.x, 0, "impact does not teleport the actor");
  entities.update(0.05);
  assert.ok(actor.model.position.x > 0 && actor.model.position.x < 1);
  entities.update(0.3);
  assert.equal(actor.model.position.x, 1);
  entities.damage(actor, 100);
  assert.equal(entities.all.length, 0, "death leaves gameplay immediately");
  assert.equal(game.inv.counts.cuir, 1);
  assert.ok(game.scene.children.includes(actor.model), "fall is still visible");
  entities.update(0.2);
  assert.ok(Math.abs(actor.model.rotation.z) > 0.5);
  assert.ok(actor.flash.materials.every((material) => material.opacity < 0.7));
  entities.damage(actor, 100);
  assert.equal(game.inv.counts.cuir, 1, "death visual cannot pay out twice");
  entities.update(0.3);
  assert.equal(entities.visuals.length, 0);
  assert.ok(!game.scene.children.includes(actor.model));
  game.world.dispose();
});

test("bomber banks and releases a finned bomb that points along its falling velocity", () => {
  const { game, entities } = fixture();
  const bomber = entities.spawn("b2", new THREE.Vector3(0, 25, 0));
  entities.update(1.1);
  assert.ok(Math.abs(bomber.model.rotation.z) > 0.05);
  assert.ok(bomber.model.position.z < 0);
  assert.equal(entities.projectiles.length, 1);
  const bomb = entities.projectiles[0];
  assert.ok(bomb.model.children.length >= 5, "body and visible fins");
  assert.ok(bomb.model.position.y < bomber.model.position.y - 1);
  const pointing = new THREE.Vector3(0, -1, 0).applyQuaternion(bomb.model.quaternion);
  assert.ok(pointing.dot(bomb.velocity.clone().normalize()) > 0.99999);
  entities.clear();
  game.world.dispose();
});

test("removing placed objects' floor yields one inert pickup each without a nuclear detonation", () => {
  const { game, entities, sounds } = fixture();
  const originals = ["gnome", "radio", "nucleaire"].map((kind, q) => {
    game.world.setBlock(q, 0, 0, "stone");
    const p = hexToWorld(q, 0);
    return entities.spawn(kind, new THREE.Vector3(p.x, 1, p.z));
  });
  entities.update(0.016);
  assert.ok(originals.every((e) => entities.all.includes(e) && !e.pickup));
  const beam = originals[2].beam;
  let beamDisposed = false;
  beam.geometry.addEventListener("dispose", () => { beamDisposed = true; });
  for (let q = 0; q < 3; q++) game.world.removeBlock(q, 0, 0);
  entities.update(0.016);
  assert.equal(entities.all.length, 3);
  assert.ok(originals.every((e) => !entities.all.includes(e) && !game.scene.children.includes(e.model)));
  assert.deepEqual(entities.all.map((e) => [e.item, e.count, e.pickup]), [
    ["gnome", 1, true], ["radio", 1, true], ["nucleaire", 1, true],
  ]);
  const nuclearDrop = entities.all.find((e) => e.item === "nucleaire");
  assert.equal(nuclearDrop.beam, undefined, "a pickup is not an operating reactor");
  assert.ok(beamDisposed, "removed reactor frees its unique beam geometry");
  assert.equal(sounds.filter((sound) => sound === "explosion").length, 0);
  assert.deepEqual(game.inv.counts, {}, "items are returned as pickups, not silently credited");
  entities.update(0.016);
  assert.equal(entities.all.length, 3, "converted drops cannot convert again");
  entities.clear();
  game.world.dispose();
});

test("an object's actual floor supports it under a roof, but a distant lower floor or water cannot", () => {
  const { game, entities } = fixture();
  game.world.setBlock(0, 0, 0, "stone");
  game.world.setBlock(0, 0, 3, "wood");
  game.world.setBlock(0, 0, 7, "stone");
  const radio = entities.spawn("radio", new THREE.Vector3(0, 4, 0));
  assert.equal(game.world.getGroundHeight(0, 0), 8, "the column's highest surface is the roof");
  entities.update(0.016);
  assert.ok(entities.all.includes(radio) && !radio.pickup, "the interior floor remains the support");
  game.world.removeBlock(0, 0, 3);
  entities.update(0.016);
  assert.equal(entities.all.length, 1);
  assert.ok(entities.all[0].pickup, "the surviving lower floor and roof cannot support an object across air");
  entities.clear();
  game.world.setBlock(0, 0, 3, "water");
  entities.spawn("gnome", new THREE.Vector3(0, 4, 0));
  entities.update(0.016);
  assert.ok(entities.all[0].pickup, "water is not solid support");
  entities.clear();
  game.world.dispose();
});

test("a terrain explosion can remove a reactor support without the reactor itself detonating", () => {
  const { game, entities, sounds } = fixture();
  game.world.setBlock(0, 0, 4, "stone");
  const reactor = entities.spawn("nucleaire", new THREE.Vector3(0, 5, 0));
  // A small blast intersects the floor cell's center but not the reactor origin.
  entities.explode(new THREE.Vector3(0, 4.3, 0), 0.6, 8, true);
  assert.equal(game.world.getBlock(0, 0, 4), null);
  assert.equal(reactor.health, 30);
  entities.update(0.016);
  assert.equal(entities.all.length, 1);
  assert.equal(entities.all[0].item, "nucleaire");
  assert.equal(entities.all[0].pickup, true);
  assert.equal(sounds.filter((sound) => sound === "explosion").length, 1, "only the initiating explosion occurred");
  entities.clear();
  game.world.dispose();
});
