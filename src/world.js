import * as THREE from "three";
import {
  createTerrainMaterials,
  createPlantMaterial,
  disposeTerrainMaterials,
} from "./terrain-textures.js";

export const HEX_RADIUS = 1;
export const HEX_NEIGHBORS = Object.freeze([
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
]);
export const BLOCK_TYPES = Object.freeze([
  "grass",
  "dirt",
  "stone",
  "sand",
  "wood",
  "birch",
  "leaves",
  "pine",
  "ore",
  "water",
  "lucky",
  "bedrock",
]);
const SQRT3 = Math.sqrt(3);
const BLOCK_SET = new Set(BLOCK_TYPES);
export const blockKey = (q, r, y) => `${q},${r},${y}`;
const columnKey = (q, r) => `${q},${r}`;

/** Flat six-sided prisms with one complete tile per side and hard face normals. */
export function createHexBlockGeometry() {
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false);
  const uv = cylinder.attributes.uv;
  for (let i = 0; i < 14; i++) uv.setX(i, uv.getX(i) * 6);
  const geometry = cylinder.toNonIndexed();
  cylinder.dispose();
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    // A restrained underside/foot shade makes stacked blocks legible without outlines.
    const shade = normals.getY(i) > 0.5 ? 1 : normals.getY(i) < -0.5
      ? 0.8 : positions.getY(i) > 0 ? 0.97 : 0.86;
    colors.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.name = "crisp-hex-voxel";
  return geometry;
}

export function hexToWorld(q, r) {
  return { x: SQRT3 * (q + r / 2), z: 1.5 * r };
}

export function worldToHex(x, z) {
  const q = (SQRT3 / 3) * x - z / 3,
    r = (2 / 3) * z;
  let rq = Math.round(q),
    rr = Math.round(r),
    rs = Math.round(-q - r);
  const qd = Math.abs(rq - q),
    rd = Math.abs(rr - r),
    sd = Math.abs(rs + q + r);
  if (qd > rd && qd > sd) rq = -rr - rs;
  else if (rd > sd) rr = -rq - rs;
  return { q: rq || 0, r: rr || 0 };
}

export function hexDistance(q1, r1, q2 = 0, r2 = 0) {
  return (
    (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2
  );
}

export function hashSeed(value) {
  let h = 2166136261;
  for (const c of String(value)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randomAt(q, r, salt) {
  let h = Math.imul(q, 374761393) + Math.imul(r, 668265263) + salt;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

function noise(x, z, seed) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    fx = smooth(x - ix),
    fz = smooth(z - iz);
  return (
    lerp(
      lerp(randomAt(ix, iz, seed), randomAt(ix + 1, iz, seed), fx),
      lerp(randomAt(ix, iz + 1, seed), randomAt(ix + 1, iz + 1, seed), fx),
      fz,
    ) *
      2 -
    1
  );
}

/** Pure deterministic terrain model; does not create GPU resources. y is block bottom. */
export function generateTerrain({ seed = "MINECRACK", radius = 34 } = {}) {
  const numericSeed = hashSeed(seed),
    seaLevel = 4;
  const blocks = new Map(),
    columns = [],
    treeColumns = new Set();
  const spawnHex = {
    q: 0,
    r: Math.max(3, Math.min(13, Math.floor(radius * 0.41))),
  };
  const put = (q, r, y, type) =>
    blocks.set(blockKey(q, r, y), { q, r, y, type });
  for (let q = -radius; q <= radius; q++)
    for (
      let r = Math.max(-radius, -q - radius);
      r <= Math.min(radius, -q + radius);
      r++
    ) {
      const { x, z } = hexToWorld(q, r),
        d = hexDistance(q, r);
      const broad =
        noise(q / 10, r / 10, numericSeed) * 2.6 +
        noise(q / 4.5, r / 4.5, numericSeed + 17) * 1.15;
      const lake = 7.0 * Math.exp(-(((x + 3) / 16) ** 2 + ((z + 1) / 12) ** 2));
      const mountain =
        5.3 * Math.exp(-(((x + 21) / 18) ** 2 + ((z + 21) / 15) ** 2));
      const river =
        3.7 *
        Math.exp(-(((x - Math.sin(z / 9) * 4 + 3) / 3.8) ** 2)) *
        Math.max(0, Math.min(1, (Math.abs(z) - 9) / 10));
      const edge = Math.max(0, d - radius + 6) * 1.45;
      let surface = Math.max(
        0,
        Math.min(17, Math.floor(7.1 + broad + mountain - lake - river - edge)),
      );
      // High ground forms dramatic three-block limestone terraces rather than a smooth cone.
      if (surface >= 8) surface = 8 + Math.floor((surface - 8) / 3) * 3;
      const fromSpawn = hexDistance(q, r, spawnHex.q, spawnHex.r);
      if (fromSpawn <= 2) surface = 7;
      else if (fromSpawn === 3) surface = Math.max(6, surface);
      const dry = surface >= seaLevel;
      const topType = surface <= seaLevel + 1 ? "sand" : "grass";
      columns.push({ q, r, surface, dry, topType });
      for (let y = 0; y <= surface; y++) {
        let type =
          y === 0
            ? "bedrock"
            : y === surface
              ? topType
              : y >= surface - (surface >= 8 ? 1 : 2)
                ? "dirt"
                : randomAt(q * 23 + y, r * 19 - y, numericSeed + 37) < 0.065
                  ? "ore"
                  : "stone";
        if (topType === "sand" && y >= surface - 1 && y > 0) type = "sand";
        put(q, r, y, type);
      }
      for (let y = surface + 1; y <= seaLevel; y++) put(q, r, y, "water");
    }

  // Trees deliberately keep a readable clearing around the initial overlook.
  const dryColumns = columns.filter((c) => c.dry);
  const columnLookup = new Map(columns.map((c) => [columnKey(c.q, c.r), c]));
  const acceptedTrees = [];
  for (const col of columns) {
    if (
      col.topType !== "grass" ||
      col.surface <= seaLevel + 1 ||
      hexDistance(col.q, col.r, spawnHex.q, spawnHex.r) < 5 ||
      hexDistance(col.q, col.r) > radius - 4
    )
      continue;
    if (randomAt(col.q, col.r, numericSeed + 112) > 0.07) continue;
    if (acceptedTrees.some((t) => hexDistance(t.q, t.r, col.q, col.r) < 3))
      continue;
    const kind = randomAt(col.q, col.r, numericSeed + 516);
    const isPine = kind < 0.3,
      isBirch = kind > 0.66;
    const trunkType = isBirch ? "birch" : "wood",
      foliage = isPine ? "pine" : "leaves";
    const height =
      (isPine ? 6 : isBirch ? 5 : 4) +
      (randomAt(col.q, col.r, numericSeed + 73) > 0.58 ? 1 : 0);
    for (let dy = 1; dy <= height; dy++)
      put(col.q, col.r, col.surface + dy, trunkType);
    // Oaks have broad uneven crowns, birches are tall and narrow, spruces have
    // alternating stepped branch tiers and a needle tip. No cylindrical disks.
    const crown = isPine ? [2, 1, 2, 1, 1, 0] : isBirch ? [1, 2, 1, 1] : [2, 2, 2, 1];
    const lean = HEX_NEIGHBORS[Math.floor(randomAt(col.q, col.r, numericSeed + 810) * 6)];
    for (let layer = 0; layer < crown.length; layer++) {
      const spread = crown[layer];
      const level = col.surface + height - (isPine ? 3 : isBirch ? 2 : 1) + layer;
      const offset = !isPine && layer >= crown.length - 2 ? 1 : 0;
      for (let dq = -spread; dq <= spread; dq++)
        for (let dr = -spread; dr <= spread; dr++) {
          if (hexDistance(dq, dr) > spread) continue;
          const cq = col.q + dq + lean[0] * offset,
            cr = col.r + dr + lean[1] * offset,
            key = blockKey(cq, cr, level);
          if (!columnLookup.has(columnKey(cq, cr))) continue;
          if (cq === col.q && cr === col.r && level <= col.surface + height) continue;
          if (
            spread === 2 &&
            hexDistance(dq, dr) === 2 &&
            randomAt(cq + level, cr, numericSeed) < (isPine ? 0.13 : isBirch ? 0.43 : 0.23)
          )
            continue;
          if (!blocks.has(key)) put(cq, cr, level, foliage);
          treeColumns.add(columnKey(cq, cr));
        }
    }
    if (isPine) put(col.q, col.r, col.surface + height + 2, foliage);
    treeColumns.add(columnKey(col.q, col.r));
    acceptedTrees.push(col);
  }

  const luckyCount = Math.floor(dryColumns.length * 0.01);
  const luckyCandidates = dryColumns.filter(
    (c) =>
      !treeColumns.has(columnKey(c.q, c.r)) &&
      hexDistance(c.q, c.r, spawnHex.q, spawnHex.r) >= 2 &&
      !blocks.has(blockKey(c.q, c.r, c.surface + 1)),
  );
  luckyCandidates.sort(
    (a, b) =>
      randomAt(a.q, a.r, numericSeed + 991) -
      randomAt(b.q, b.r, numericSeed + 991),
  );
  // One of the 1% remains discoverable within a short walk from spawn.
  const nearby = [...luckyCandidates]
    .filter((c) => c.r < spawnHex.r)
    .sort(
      (a, b) =>
        hexDistance(a.q, a.r, spawnHex.q, spawnHex.r) -
        hexDistance(b.q, b.r, spawnHex.q, spawnHex.r),
    )[0];
  if (nearby) {
    luckyCandidates.splice(luckyCandidates.indexOf(nearby), 1);
    luckyCandidates.unshift(nearby);
  }
  for (const c of luckyCandidates.slice(0, luckyCount))
    put(c.q, c.r, c.surface + 1, "lucky");
  const spawnXZ = hexToWorld(spawnHex.q, spawnHex.r);
  const spawnColumn = columnLookup.get(columnKey(spawnHex.q, spawnHex.r));
  return {
    blocks,
    columns,
    seaLevel,
    spawn: { x: spawnXZ.x, y: spawnColumn.surface + 1.03, z: spawnXZ.z },
    stats: {
      seed: String(seed),
      surfaceCount: dryColumns.length,
      luckyCount,
      treeCount: acceptedTrees.length,
      columnCount: columns.length,
    },
  };
}

export class HexWorld {
  constructor(scene, { seed = "MINECRACK", radius = 34 } = {}) {
    this.scene = scene;
    this.seed = String(seed);
    this.radius = Math.max(6, Math.min(70, Math.floor(radius)));
    this.blocks = new Map();
    this.columns = new Map();
    this.meshes = [];
    this.meshByType = new Map();
    this.edits = new Map();
    this.dirtyTypes = new Set();
    this.materials = null;
    this.geometry = null;
    this.decorations = new THREE.Group();
    this.decorations.name = "ground-cover";
    this.scene?.add(this.decorations);
    this.plantGeometry = null;
    this.plantMaterials = null;
    this._plantTime = { value: 0 };
    this.spawn = new THREE.Vector3();
    this.seaLevel = 4;
    this.stats = { seed: this.seed, surfaceCount: 0, luckyCount: 0 };
    this._matrix = new THREE.Matrix4();
    this._color = new THREE.Color();
  }

  generate() {
    this._clearMeshes();
    this.edits.clear();
    const model = generateTerrain({ seed: this.seed, radius: this.radius });
    this.blocks = model.blocks;
    this.seaLevel = model.seaLevel;
    this.stats = model.stats;
    this.spawn.set(model.spawn.x, model.spawn.y, model.spawn.z);
    this.columns.clear();
    for (const block of this.blocks.values()) this._indexBlock(block);
    this.dirtyTypes = new Set(BLOCK_TYPES);
    this.rebuild();
    return this;
  }

  hexToWorld(q, r) {
    return hexToWorld(q, r);
  }
  worldToHex(x, z) {
    return worldToHex(x, z);
  }
  getBlock(q, r, y) {
    return this.blocks.get(blockKey(q, r, y)) || null;
  }

  _indexBlock(block) {
    const key = columnKey(block.q, block.r);
    if (!this.columns.has(key)) this.columns.set(key, new Map());
    this.columns.get(key).set(block.y, block.type);
  }

  _markDirty(q, r, y, extraType) {
    if (extraType) this.dirtyTypes.add(extraType);
    for (const [dq, dr, dy] of [
      [0, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      ...HEX_NEIGHBORS.map(([a, b]) => [a, b, 0]),
    ]) {
      const b = this.getBlock(q + dq, r + dr, y + dy);
      if (b) this.dirtyTypes.add(b.type);
    }
  }

  setBlock(q, r, y, type) {
    if (
      ![q, r, y].every(Number.isInteger) ||
      y < 0 ||
      y > 64 ||
      hexDistance(q, r) > this.radius + 4 ||
      !BLOCK_SET.has(type)
    )
      return false;
    const old = this.getBlock(q, r, y);
    if (old?.type === type || old?.type === "bedrock") return false;
    const block = { q, r, y, type };
    this.blocks.set(blockKey(q, r, y), block);
    this._indexBlock(block);
    this.edits.set(blockKey(q, r, y), type);
    this._markDirty(q, r, y, old?.type);
    return true;
  }

  removeBlock(q, r, y) {
    const old = this.getBlock(q, r, y);
    if (!old || old.type === "bedrock") return null;
    this.blocks.delete(blockKey(q, r, y));
    const col = this.columns.get(columnKey(q, r));
    col?.delete(y);
    if (col?.size === 0) this.columns.delete(columnKey(q, r));
    this.edits.set(blockKey(q, r, y), null);
    this._markDirty(q, r, y, old.type);
    return old;
  }

  surfaceY(q, r) {
    const col = this.columns.get(columnKey(q, r));
    if (!col) return -Infinity;
    let max = -Infinity;
    for (const [y, type] of col) if (type !== "water" && y > max) max = y;
    return max;
  }

  getGroundHeight(x, z) {
    const { q, r } = worldToHex(x, z);
    return this.surfaceY(q, r) + 1;
  }

  isWater(x, y, z) {
    const hex = worldToHex(x, z);
    return this.getBlock(hex.q, hex.r, Math.floor(y))?.type === "water";
  }

  _isVisible(b) {
    const transparentTo = (neighbor) =>
      !neighbor || (neighbor.type === "water" && b.type !== "water");
    if (transparentTo(this.getBlock(b.q, b.r, b.y + 1))) return true;
    if (b.y > 0 && transparentTo(this.getBlock(b.q, b.r, b.y - 1))) return true;
    for (const [dq, dr] of HEX_NEIGHBORS)
      if (transparentTo(this.getBlock(b.q + dq, b.r + dr, b.y))) return true;
    return false;
  }

  /** Rebuild dirty material groups once per frame after a batch of edits. */
  rebuild() {
    if (this.dirtyTypes.size === 0) return;
    if (!this.materials) this.materials = createTerrainMaterials();
    if (!this.geometry) this.geometry = createHexBlockGeometry();
    const byType = new Map([...this.dirtyTypes].map((type) => [type, []]));
    for (const block of this.blocks.values())
      if (byType.has(block.type) && this._isVisible(block))
        byType.get(block.type).push(block);
    for (const [type, records] of byType) {
      const previous = this.meshByType.get(type);
      if (previous) {
        this.scene?.remove(previous);
        previous.dispose();
        this.meshByType.delete(type);
      }
      if (!records.length) continue;
      const mesh = new THREE.InstancedMesh(
        this.geometry,
        this.materials[type],
        records.length,
      );
      mesh.name = `hex-terrain-${type}`;
      mesh.userData.world = this;
      mesh.userData.blocks = records;
      mesh.castShadow = type !== "water";
      mesh.receiveShadow = true;
      if (type === "water") mesh.renderOrder = 1;
      for (let i = 0; i < records.length; i++) {
        const b = records[i],
          { x, z } = hexToWorld(b.q, b.r);
        this._matrix.makeTranslation(
          x,
          b.y + (type === "water" ? 0.43 : 0.5),
          z,
        );
        if (type === "water") this._matrix.scale(new THREE.Vector3(1, 0.86, 1));
        mesh.setMatrixAt(i, this._matrix);
        const shade =
          0.94 + randomAt(b.q + b.y, b.r - b.y, hashSeed(this.seed)) * 0.11;
        this._color.setRGB(shade, shade, shade);
        mesh.setColorAt(i, this._color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.meshByType.set(type, mesh);
      this.scene?.add(mesh);
    }
    this.meshes = [...this.meshByType.values()];
    this.stats.visibleBlocks = this.meshes.reduce(
      (total, mesh) => total + mesh.count,
      0,
    );
    this.stats.totalBlocks = this.blocks.size;
    this._rebuildPlants();
    this.dirtyTypes.clear();
  }

  _rebuildPlants() {
    for (const mesh of [...this.decorations.children]) {
      this.decorations.remove(mesh);
      mesh.dispose();
    }
    const seed = hashSeed(this.seed);
    const plants = { grass: [], poppy: [], daisy: [] };
    for (const block of this.blocks.values()) {
      if (block.type !== "grass" || this.getBlock(block.q, block.r, block.y + 1)) continue;
      const chance = randomAt(block.q, block.r, seed + 3281);
      if (chance > 0.29) continue;
      const kind = chance < 0.025 ? "poppy" : chance < 0.052 ? "daisy" : "grass";
      plants[kind].push(block);
    }
    if (!this.plantGeometry) {
      this.plantGeometry = new THREE.BufferGeometry();
      this.plantGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
        -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0,
        -0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
        0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5,
        0, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
      ], 3));
      this.plantGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([
        0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
        0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1,
      ], 2));
      this.plantGeometry.computeVertexNormals();
      this.plantGeometry.name = "crossed-pixel-plants";
      this.plantMaterials = {};
      for (const kind of Object.keys(plants)) {
        const material = createPlantMaterial(kind);
        material.onBeforeCompile = (shader) => {
          shader.uniforms.plantTime = this._plantTime;
          shader.vertexShader = "uniform float plantTime;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
            #include <begin_vertex>
            #ifdef USE_INSTANCING
              float breeze = sin(plantTime * 1.7 + instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45);
              transformed.x += breeze * 0.065 * position.y * position.y;
              transformed.z += breeze * 0.025 * position.y;
            #endif
          `);
        };
        material.customProgramCacheKey = () => "minecrack-pixel-plants-v1";
        this.plantMaterials[kind] = material;
      }
    }
    const transform = new THREE.Object3D();
    for (const [kind, records] of Object.entries(plants)) {
      if (!records.length) continue;
      const mesh = new THREE.InstancedMesh(this.plantGeometry, this.plantMaterials[kind], records.length);
      mesh.name = `ground-cover-${kind}`;
      mesh.userData.supportBlocks = records;
      mesh.receiveShadow = true;
      for (let i = 0; i < records.length; i++) {
        const block = records[i], { x, z } = hexToWorld(block.q, block.r);
        const variation = randomAt(block.q, block.r, seed + 381);
        transform.position.set(x + (variation - 0.5) * 0.65, block.y + 1.012, z + (randomAt(block.r, block.q, seed + 746) - 0.5) * 0.65);
        transform.rotation.set(0, variation * Math.PI * 2, 0);
        const height = kind === "grass" ? 0.62 + variation * 0.3 : 0.71 + variation * 0.15;
        transform.scale.set(height, height, height);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.decorations.add(mesh);
    }
    this.stats.plantCount = this.decorations.children.reduce((total, mesh) => total + mesh.count, 0);
  }

  /** One cheap shared wind uniform plus stepped water texels; no geometry rebuild. */
  updateVisuals(elapsed) {
    if (!Number.isFinite(elapsed)) return;
    this._plantTime.value = elapsed;
    const waterMap = this.materials?.water?.[0]?.map;
    if (waterMap) waterMap.offset.set(Math.floor(elapsed * 1.7) / 32, Math.floor(elapsed * 0.8) / 32);
  }

  raycast(raycaster, maxDistance = 6) {
    const previousFar = raycaster.far;
    if (!Number.isFinite(maxDistance) || maxDistance <= 0) return null;
    raycaster.far = Math.min(previousFar, maxDistance);
    const hits = raycaster.intersectObjects(
      this.meshes.filter((m) => m.name !== "hex-terrain-water"),
      false,
    );
    raycaster.far = previousFar;
    const hit = hits.find((h) => h.distance <= maxDistance);
    if (!hit) return null;
    const block = hit.object.userData.blocks[hit.instanceId];
    if (!block || !this.getBlock(block.q, block.r, block.y)) return null;
    const normal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld);
    let place;
    if (normal.y > 0.5) place = { q: block.q, r: block.r, y: block.y + 1 };
    else if (normal.y < -0.5)
      place = { q: block.q, r: block.r, y: block.y - 1 };
    else {
      let best = null,
        bestDot = -Infinity;
      for (const [dq, dr] of HEX_NEIGHBORS) {
        const n = hexToWorld(dq, dr),
          dot = n.x * normal.x + n.z * normal.z;
        if (dot > bestDot) {
          bestDot = dot;
          best = [dq, dr];
        }
      }
      place = { q: block.q + best[0], r: block.r + best[1], y: block.y };
    }
    return {
      ...block,
      point: hit.point.clone(),
      normal,
      place,
      distance: hit.distance,
    };
  }

  serialize() {
    return {
      seed: this.seed,
      radius: this.radius,
      edits: [...this.edits].map(([key, type]) => ({ key, type })),
    };
  }

  restore(saved) {
    const edits = Array.isArray(saved) ? saved : saved?.edits;
    if (!Array.isArray(edits)) return false;
    for (const edit of edits) {
      if (!edit || typeof edit.key !== "string") continue;
      if (!/^-?\d+,-?\d+,\d+$/.test(edit.key)) continue;
      const [q, r, y] = edit.key.split(",").map(Number);
      if (![q, r, y].every(Number.isInteger)) continue;
      if (edit.type === null) this.removeBlock(q, r, y);
      else this.setBlock(q, r, y, edit.type);
    }
    this.rebuild();
    return true;
  }

  _clearMeshes() {
    for (const mesh of this.meshByType.values()) {
      this.scene?.remove(mesh);
      mesh.dispose();
    }
    this.meshByType.clear();
    this.meshes = [];
    for (const mesh of [...this.decorations.children]) {
      this.decorations.remove(mesh);
      mesh.dispose();
    }
  }

  dispose() {
    this._clearMeshes();
    this.geometry?.dispose();
    if (this.materials) disposeTerrainMaterials(this.materials);
    this.plantGeometry?.dispose();
    if (this.plantMaterials) {
      for (const material of Object.values(this.plantMaterials)) {
        material.map?.dispose();
        material.dispose();
      }
    }
    this.scene?.remove(this.decorations);
    this.materials = null;
    this.geometry = null;
    this.plantGeometry = null;
    this.plantMaterials = null;
  }
}
