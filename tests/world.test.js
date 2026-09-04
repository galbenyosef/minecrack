import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  HexWorld,
  generateTerrain,
  hexToWorld,
  worldToHex,
  hexDistance,
  HEX_NEIGHBORS,
  createHexBlockGeometry,
} from "../src/world.js";

test("voxel facets have hard normals and a complete upright texture on every side", () => {
  const geometry = createHexBlockGeometry();
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const position = geometry.attributes.position;
  const sideGroup = geometry.groups.find((group) => group.materialIndex === 0);
  const directions = new Set();
  for (let i = sideGroup.start; i < sideGroup.start + sideGroup.count; i += 3) {
    const n = [normal.getX(i), normal.getY(i), normal.getZ(i)];
    directions.add(n.map((v) => v.toFixed(4)).join(","));
    for (let j = i; j < i + 3; j++) {
      assert.ok(Math.abs(normal.getX(j) - n[0]) < 1e-6);
      assert.ok(Math.abs(normal.getZ(j) - n[2]) < 1e-6);
      assert.ok(Math.abs(normal.getY(j)) < 1e-6);
      assert.equal(uv.getY(j), position.getY(j) > 0 ? 1 : 0);
    }
    const u = [uv.getX(i), uv.getX(i + 1), uv.getX(i + 2)];
    assert.ok(Math.abs(Math.max(...u) - Math.min(...u) - 1) < 1e-6);
  }
  assert.equal(directions.size, 6, "six distinct flat faces, never interpolated cylinder normals");
  geometry.dispose();
});

test("grass and flowers keep real support after mining, covering, saving and restoring", () => {
  const world = new HexWorld(new THREE.Scene(), { seed: "GROUND-COVER", radius: 24 }).generate();
  const supports = () => world.decorations.children.flatMap((mesh) => mesh.userData.supportBlocks);
  const initial = supports();
  assert.ok(initial.length > 50);
  const removed = initial[0], covered = initial[1];
  world.removeBlock(removed.q, removed.r, removed.y);
  world.setBlock(covered.q, covered.r, covered.y + 1, "stone");
  world.rebuild();
  for (const block of supports()) {
    assert.equal(world.getBlock(block.q, block.r, block.y)?.type, "grass");
    assert.equal(world.getBlock(block.q, block.r, block.y + 1), null);
    assert.notDeepEqual(block, removed);
    assert.notDeepEqual(block, covered);
  }
  const restored = new HexWorld(new THREE.Scene(), { seed: "GROUND-COVER", radius: 24 }).generate();
  restored.restore(world.serialize());
  assert.deepEqual(restored.decorations.children.flatMap((mesh) => mesh.userData.supportBlocks), supports());
  assert.ok(world.meshes.every((mesh) => !mesh.name.startsWith("ground-cover")), "plants do not intercept mining rays");
  const scene = world.scene;
  world.dispose();
  assert.ok(!scene.children.some((object) => object.name === "ground-cover"));
  restored.dispose();
});

test("hex coordinates round trip and the six neighbors share an edge", () => {
  for (let q = -20; q <= 20; q++)
    for (let r = -20; r <= 20; r++) {
      const p = hexToWorld(q, r);
      assert.deepEqual(worldToHex(p.x, p.z), { q, r });
    }
  for (const [q, r] of HEX_NEIGHBORS) {
    const p = hexToWorld(q, r);
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - Math.sqrt(3)) < 1e-10);
    assert.equal(hexDistance(q, r), 1);
  }
});

test("terrain is deterministic, varies by seed and Lucky Blocks are exactly 1% of land surfaces above terrain", () => {
  const a = generateTerrain({ seed: "MINETEST", radius: 24 });
  const b = generateTerrain({ seed: "MINETEST", radius: 24 });
  const c = generateTerrain({ seed: "OTHER", radius: 24 });
  assert.deepEqual([...a.blocks], [...b.blocks]);
  assert.notDeepEqual(a.columns, c.columns);
  const lucky = [...a.blocks.values()].filter(
    (block) => block.type === "lucky",
  );
  assert.equal(lucky.length, Math.floor(a.stats.surfaceCount * 0.01));
  for (const block of lucky) {
    const col = a.columns.find((v) => v.q === block.q && v.r === block.r);
    assert.equal(col.dry, true);
    assert.equal(block.y, col.surface + 1);
    assert.notEqual(
      a.blocks.get(`${block.q},${block.r},${block.y - 1}`).type,
      "water",
    );
  }
  const types = new Set([...a.blocks.values()].map((v) => v.type));
  for (const type of [
    "grass",
    "dirt",
    "stone",
    "water",
    "wood",
    "birch",
    "pine",
    "lucky",
    "ore",
  ])
    assert.ok(types.has(type), type);
});

test("destruction, placement, collision height and edit restoration agree", () => {
  const world = new HexWorld(new THREE.Scene(), {
    seed: "MINETEST",
    radius: 10,
  }).generate();
  const h = world.surfaceY(0, 4),
    before = world.getBlock(0, 4, h);
  assert.ok(before);
  assert.equal(world.removeBlock(0, 4, h).type, before.type);
  assert.equal(world.getBlock(0, 4, h), null);
  assert.equal(world.surfaceY(0, 4), h - 1);
  assert.equal(world.removeBlock(0, 4, 0), null, "bedrock remains immutable");
  assert.equal(
    world.setBlock(0, 4, 0, "stone"),
    false,
    "placement cannot replace bedrock",
  );
  assert.equal(world.setBlock(0, 4, h + 1, "stone"), true);
  const xz = hexToWorld(0, 4);
  assert.equal(world.getGroundHeight(xz.x, xz.z), h + 2);
  world.rebuild();
  const snapshot = world.serialize();
  const restored = new HexWorld(new THREE.Scene(), {
    seed: "MINETEST",
    radius: 10,
  }).generate();
  assert.equal(restored.restore(snapshot), true);
  assert.equal(restored.getBlock(0, 4, h), null);
  assert.equal(restored.getBlock(0, 4, h + 1).type, "stone");
  assert.ok(world.stats.visibleBlocks < world.stats.totalBlocks);
  assert.equal(world.setBlock(0, 0, -1, "stone"), false);
  assert.equal(world.setBlock(0, 0, 3, "unknown"), false);
  restored.dispose();
  world.dispose();
});

test("raycast uses top and each of six side normals for placement", () => {
  const world = new HexWorld(new THREE.Scene(), { radius: 6 });
  world.setBlock(0, 0, 10, "stone");
  world.rebuild();
  world.scene.updateMatrixWorld(true);
  const top = world.raycast(
    new THREE.Raycaster(
      new THREE.Vector3(0, 13, 0),
      new THREE.Vector3(0, -1, 0),
    ),
  );
  assert.deepEqual(top.place, { q: 0, r: 0, y: 11 });
  for (const [q, r] of HEX_NEIGHBORS) {
    const p = hexToWorld(q, r),
      position = new THREE.Vector3(p.x * 2, 10.5, p.z * 2);
    const direction = new THREE.Vector3(-p.x, 0, -p.z).normalize();
    const hit = world.raycast(new THREE.Raycaster(position, direction));
    assert.deepEqual(hit.place, { q, r, y: 10 });
  }
  world.dispose();
});

test("raycasts respect short projectile segments and preserve caller range", () => {
  const world = new HexWorld(new THREE.Scene(), { radius: 6 });
  world.setBlock(0, 0, 10, "stone");
  world.rebuild();
  world.scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 13, 0),
    new THREE.Vector3(0, -1, 0),
    0,
    0.5,
  );
  assert.equal(
    world.raycast(ray, 6),
    null,
    "a supplied short ray is never extended",
  );
  assert.equal(ray.far, 0.5);
  ray.far = Infinity;
  assert.equal(world.raycast(ray, 1.9), null);
  assert.equal(world.raycast(ray, 2.1).type, "stone");
  assert.equal(ray.far, Infinity, "temporary range is restored");
  assert.equal(world.raycast(ray, NaN), null);
  assert.equal(world.raycast(ray, -1), null);
  world.dispose();
});

test("save restoration ignores malformed, out-of-bounds and unsupported edits", () => {
  const world = new HexWorld(new THREE.Scene(), {
    seed: "SAVE-CHECK",
    radius: 6,
  }).generate();
  const initialCount = world.blocks.size;
  const surface = world.surfaceY(0, 3);
  assert.equal(world.restore(null), false);
  assert.equal(world.restore({ edits: "corrupt" }), false);
  assert.equal(
    world.restore({
      edits: [
        null,
        {},
        { key: "0,3", type: "stone" },
        { key: "0,3,20,99", type: "stone" },
        { key: "0,3,NaN", type: "stone" },
        { key: "0,3,0", type: null },
        { key: "0,3,0", type: "stone" },
        { key: "0,3,65", type: "stone" },
        { key: "0,3,20", type: "unknown" },
        { key: "999,999,2", type: "grass" },
        { key: "0.5,3,12", type: "stone" },
        { key: "0,3,12", type: "ore" },
        { key: `0,3,${surface}`, type: null },
      ],
    }),
    true,
  );
  assert.equal(
    world.blocks.size,
    initialCount,
    "one valid placement and one removal cancel",
  );
  assert.equal(world.getBlock(0, 3, 0).type, "bedrock");
  assert.equal(world.getBlock(0, 3, 12).type, "ore");
  assert.equal(world.getBlock(0, 3, surface), null);
  assert.equal(
    world.edits.size,
    2,
    "invalid edits never enter the saved journal",
  );
  assert.deepEqual(
    world
      .serialize()
      .edits.map((v) => v.key)
      .sort(),
    [`0,3,${surface}`, "0,3,12"].sort(),
  );
  world.dispose();
});

test("missing and water-only columns never create a walkable imaginary floor", () => {
  const world = new HexWorld(new THREE.Scene(), { radius: 6 });
  assert.equal(world.surfaceY(0, 0), -Infinity);
  assert.equal(world.getGroundHeight(0, 0), -Infinity);
  world.setBlock(0, 0, 2, "water");
  assert.equal(world.surfaceY(0, 0), -Infinity);
  world.setBlock(0, 0, 1, "sand");
  assert.equal(world.getGroundHeight(0, 0), 2);
  world.removeBlock(0, 0, 1);
  assert.equal(world.getGroundHeight(0, 0), -Infinity);
  const generated = new HexWorld(new THREE.Scene(), { radius: 34 }).generate();
  assert.ok(
    Number.isFinite(
      generated.getGroundHeight(generated.spawn.x, generated.spawn.z),
    ),
  );
  const outside = hexToWorld(35, 0);
  assert.equal(generated.getGroundHeight(outside.x, outside.z), -Infinity);
  generated.dispose();
  world.dispose();
});
