import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Effects, MAX_RINGS } from "../src/effects.js";
import { MiningOverlay, CRACK_STAGES, CRACK_TEXTURE_SIZE, createCrackPixels } from "../src/mining-overlay.js";

function fixture() {
  const scene = new THREE.Scene();
  const block = { q: 2, r: -1, y: 4, type: "stone" };
  const cells = new Map([["2,-1,4", block]]);
  const world = {
    hexToWorld: (q, r) => ({ x: Math.sqrt(3) * (q + r / 2), z: r * 1.5 }),
    getBlock: (q, r, y) => cells.get(`${q},${r},${y}`),
  };
  return { scene, block, cells, world, overlay: new MiningOverlay(scene) };
}

test("fracture stages reveal a deterministic growing raster at native512", () => {
  let previous = null;
  for (let stage = 0; stage < CRACK_STAGES; stage++) {
    const pixels = createCrackPixels(stage);
    assert.equal(pixels.width, CRACK_TEXTURE_SIZE);
    assert.equal(pixels.height, CRACK_TEXTURE_SIZE);
    assert.equal(pixels.data.length, 512 * 512 * 4);
    assert.ok(pixels.opaquePixels > 0);
    if (previous) {
      assert.ok(pixels.opaquePixels > previous.opaquePixels, `stage ${stage} adds visible damage`);
      for (let i = 3; i < previous.data.length; i += 4)
        if (previous.data[i] === 228) assert.equal(pixels.data[i], 228, "existing fractures persist");
    }
    previous = pixels;
  }
  assert.deepEqual(createCrackPixels(4).data, createCrackPixels(4).data);
  assert.ok(previous.opaquePixels < 512 * 512 * 0.6, "fractures preserve the underlying material");
});

test("overlay follows the precise hex coordinate, six side UVs and top cap", () => {
  const { overlay, block, world, scene } = fixture();
  overlay.update(block, 0.52, world);
  assert.equal(overlay.visible, true);
  assert.equal(overlay.stage, 5);
  assert.equal(overlay.material.map, overlay.textures[5]);
  assert.deepEqual(overlay.mesh.position.toArray(), [Math.sqrt(3) * 1.5, 4.5, -1.5]);
  assert.equal(overlay.geometry.index.count, 54, "12 side triangles plus6 top triangles");
  const normals = overlay.geometry.attributes.normal, sides = new Set();
  for (const i of overlay.geometry.index.array) {
    assert.ok(normals.getY(i) >= 0, "bottom faces are absent");
    if (normals.getY(i) === 0) sides.add(`${normals.getX(i).toFixed(3)},${normals.getZ(i).toFixed(3)}`);
  }
  // Cylinder vertices preserve corner normals; six strips still cover the entire perimeter.
  assert.ok(sides.size >= 6);
  assert.equal(overlay.geometry.attributes.uv.getX(6), 6);
  assert.equal(overlay.material.depthWrite, false);
  assert.equal(overlay.material.polygonOffset, true);
  assert.equal(overlay.textures[5].image.width, 512);
  assert.equal(overlay.textures[5].magFilter, THREE.NearestFilter);
  overlay.dispose();
  assert.equal(scene.children.length, 0);
});

test("mining release, target switch, missing blocks and pause remove cracks immediately", () => {
  const { overlay, block, cells, world } = fixture();
  overlay.update(block, 0.88, world);
  assert.equal(overlay.stage, 8);
  const next = { q: 3, r: -1, y: 4, type: "stone" };
  cells.set("3,-1,4", next);
  overlay.update(next, 0.88, world);
  assert.equal(overlay.visible, false, "previous target damage cannot transfer");
  assert.equal(overlay.stage, -1);
  overlay.update(next, 0.03, world);
  assert.equal(overlay.stage, 0);
  overlay.update(next, 0, world);
  assert.equal(overlay.visible, false, "mouse release removes cracks");
  overlay.update(next, 1, world);
  assert.equal(overlay.stage, 9);
  cells.delete("3,-1,4");
  overlay.update(next, 1, world);
  assert.equal(overlay.visible, false, "destroyed blocks never retain floating cracks");
  overlay.update(block, 0.5, world);
  overlay.clear();
  assert.equal(overlay.visible, false, "pause explicitly clears the overlay");
  overlay.update(null, 0.5, world);
  overlay.dispose();
});

test("fast creative strikes remain visible after switching a target", () => {
  const { overlay, block, cells, world } = fixture();
  overlay.update(block, 0.7, world);
  const next = { ...block, q: 3 };
  cells.set("3,-1,4", next);
  overlay.update(next, 0.15, world);
  assert.equal(overlay.visible, false);
  overlay.update(next, 0.3, world);
  assert.equal(overlay.visible, true);
  assert.equal(overlay.stage, 2);
  overlay.dispose();
});

test("overlay disposes all owned textures, geometry and material exactly once", () => {
  const { overlay, block, world, scene } = fixture();
  let disposed = 0;
  for (const resource of [...overlay.textures, overlay.geometry, overlay.material]) resource.addEventListener("dispose", () => disposed++);
  overlay.update(block, 0.9, world);
  overlay.dispose();
  overlay.dispose();
  overlay.update(block, 0.9, world);
  assert.equal(disposed, CRACK_STAGES + 2);
  assert.equal(overlay.visible, false);
  assert.equal(scene.children.length, 0);
});

test("contact particles leave every hit face and retain the original material texture", () => {
  const scene = new THREE.Scene(), effects = new Effects(scene);
  const texture = new THREE.Texture();
  let textureDisposed = 0;
  texture.addEventListener("dispose", () => textureDisposed++);
  for (const normal of [new THREE.Vector3(1,0,0), new THREE.Vector3(-1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,-1,0)]) {
    effects.hitBlock(new THREE.Vector3(0, 4, 0), normal, "wood", texture);
    for (const particle of effects.particles.slice(-5)) {
      assert.ok(particle.velocity.dot(normal) >= 0.39);
      assert.equal(particle.mesh.material.map, texture);
      assert.equal(particle.mesh.geometry.type, "BoxGeometry");
    }
  }
  assert.ok(new Set(effects.particles.map(p => p.mesh.material.color.getHex())).size >= 3);
  effects.clear();
  assert.equal(textureDisposed, 0, "terrain textures remain owned by the world");
  assert.equal(effects.materials.size, 0);
  assert.equal(scene.children.length, 0);
  effects.dispose();
});

test("particles evolve under gravity and expire without material or scene leaks", () => {
  const scene = new THREE.Scene(), effects = new Effects(scene, { groundHeight: () => 0 });
  effects.breakBlock(new THREE.Vector3(0, 10, 0), "stone");
  const particle = effects.particles[0], startY = particle.mesh.position.y, startVelocity = particle.velocity.y;
  let disposed = 0;
  for (const material of effects.materials.values()) material.addEventListener("dispose", () => disposed++);
  const materialCount = effects.materials.size;
  effects.update(0.1);
  assert.ok(Math.abs(particle.velocity.y - (startVelocity - 1.35)) < 1e-8);
  assert.notEqual(particle.mesh.position.y, startY);
  assert.ok(particle.life < particle.totalLife);
  effects.update(3);
  assert.equal(effects.particles.length, 0);
  assert.equal(effects.materials.size, 0);
  assert.equal(disposed, materialCount);
  assert.equal(scene.children.length, 0);
  effects.dispose();
});

test("debris collides with real ground and settles above it during slow frames", () => {
  const scene = new THREE.Scene(), effects = new Effects(scene);
  effects.setWorld({ getGroundHeight: () => 0 });
  effects.burst(new THREE.Vector3(0, 0.35, 0), 0x777777, 12, 0);
  effects.update(0.4);
  assert.ok(effects.particles.some(p => p.bounces > 0), "falling fragments hit the floor");
  for (const p of effects.particles) assert.ok(p.mesh.position.y >= 0.06 * p.baseScale.y - 1e-8, "substeps prevent tunneling");
  effects.update(3);
  assert.equal(scene.children.length, 0);
  effects.dispose();
});

test("voxel explosion flashes, smoke and waves animate, stay capped, then clean up", () => {
  const scene = new THREE.Scene(), effects = new Effects(scene, { maxParticles: 96 });
  effects.burst(new THREE.Vector3(0, 4, 0), 0xffb84e, 65, 8);
  assert.ok(effects.particles.some(p => p.kind === "flash"));
  const smoke = effects.particles.find(p => p.kind === "smoke"), smokeY = smoke.mesh.position.y;
  effects.ring(new THREE.Vector3(0, 4, 0), 5);
  const ring = effects.rings[0], oldScale = ring.mesh.scale.x;
  assert.equal(ring.mesh.children.length, 24);
  assert.ok(ring.mesh.children.every(c => c.geometry.type === "BoxGeometry" && !c.material.wireframe));
  effects.update(0.05);
  assert.ok(ring.mesh.scale.x > oldScale);
  assert.ok(ring.material.opacity < 0.78);
  assert.ok(smoke.mesh.position.y > smokeY);
  for (let i = 0; i < 25; i++) { effects.burst(new THREE.Vector3(), 0x888888, 50, 3); effects.ring(new THREE.Vector3(), 3); }
  assert.equal(effects.particles.length, 96);
  assert.equal(effects.rings.length, MAX_RINGS);
  assert.equal(scene.children.length, 96 + MAX_RINGS);
  effects.update(3);
  assert.equal(scene.children.length, 0);
  assert.equal(effects.materials.size, 0);
  effects.dispose();
  effects.burst(new THREE.Vector3());
  assert.equal(scene.children.length, 0);
});
