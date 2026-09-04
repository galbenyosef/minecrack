import * as THREE from "three";

export const CRACK_STAGES = 10;
export const CRACK_TEXTURE_SIZE = 512;
const CELL = 8;
const GRID = CRACK_TEXTURE_SIZE / CELL;
const DIRECTIONS = [[1, 0.18], [0.7, 1], [-0.2, 1], [-1, 0.45], [-0.8, -0.7], [0.25, -1]];

function random(seed) {
  let state = seed >>> 0;
  return () => { state = Math.imul(state, 1664525) + 1013904223; return (state >>> 0) / 4294967296; };
}

function paths() {
  const branches = [];
  for (let arm = 0; arm < DIRECTIONS.length; arm++) {
    const rng = random(831 + arm * 161);
    const [dx, dy] = DIRECTIONS[arm];
    const points = [[32, 31]];
    let x = 32, y = 31;
    for (let i = 0; i < 11; i++) {
      x += dx * (2.5 + rng() * 1.1) + (rng() - 0.5) * 2.8;
      y += dy * (2.5 + rng() * 1.1) + (rng() - 0.5) * 2.8;
      points.push([Math.round(x), Math.round(y)]);
    }
    branches.push({ points, delay: arm % 3 });
    for (const pivot of [4, 7]) {
      const start = points[pivot], fork = [start];
      let bx = start[0], by = start[1];
      const sign = pivot === 4 ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        bx += (dx * 0.35 - dy * sign) * 2 + (rng() - 0.5) * 2;
        by += (dy * 0.35 + dx * sign) * 2 + (rng() - 0.5) * 2;
        fork.push([Math.round(bx), Math.round(by)]);
      }
      branches.push({ points: fork, delay: pivot + 1 });
    }
  }
  return branches;
}
const FRACTURES = paths();

/** Native512 RGBA raster is also the deterministic, canvas-free Node fallback. */
export function createCrackPixels(stage) {
  stage = Math.max(0, Math.min(CRACK_STAGES - 1, Math.floor(stage)));
  const mask = new Uint8Array(GRID * GRID);
  const mark = (x, y, width) => {
    for (let dy = 0; dy < width; dy++) for (let dx = 0; dx < width; dx++)
      if (x + dx >= 0 && x + dx < GRID && y + dy >= 0 && y + dy < GRID) mask[(y + dy) * GRID + x + dx] = 1;
  };
  const width = stage >= 7 ? 2 : 1;
  for (const branch of FRACTURES) {
    const revealed = Math.min(branch.points.length - 1, Math.max(0, Math.ceil((stage + 1 - branch.delay) / (CRACK_STAGES - branch.delay) * (branch.points.length - 1))));
    for (let i = 1; i <= revealed; i++) {
      const [x0, y0] = branch.points[i - 1], [x1, y1] = branch.points[i];
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let j = 0; j <= steps; j++) mark(Math.round(x0 + (x1 - x0) * j / steps), Math.round(y0 + (y1 - y0) * j / steps), width);
    }
  }
  const data = new Uint8Array(CRACK_TEXTURE_SIZE * CRACK_TEXTURE_SIZE * 4);
  let opaquePixels = 0;
  for (let y = 0; y < CRACK_TEXTURE_SIZE; y++) for (let x = 0; x < CRACK_TEXTURE_SIZE; x++) {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL), index = (y * CRACK_TEXTURE_SIZE + x) * 4;
    const crack = mask[gy * GRID + gx];
    const lip = !crack && gx > 0 && gy > 0 && mask[(gy - 1) * GRID + gx - 1];
    if (crack) {
      data[index] = 29; data[index + 1] = 26; data[index + 2] = 22; data[index + 3] = 228;
      opaquePixels++;
    } else if (lip) {
      data[index] = 236; data[index + 1] = 227; data[index + 2] = 201; data[index + 3] = 85;
    }
  }
  return { data, width: CRACK_TEXTURE_SIZE, height: CRACK_TEXTURE_SIZE, opaquePixels };
}

function createCrackTexture(stage) {
  const pixels = createCrackPixels(stage);
  let texture;
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CRACK_TEXTURE_SIZE;
    const context = canvas.getContext("2d");
    if (context) {
      const image = context.createImageData(CRACK_TEXTURE_SIZE, CRACK_TEXTURE_SIZE);
      image.data.set(pixels.data);
      context.putImageData(image, 0, 0);
      texture = new THREE.CanvasTexture(canvas);
    }
  }
  texture ||= new THREE.DataTexture(pixels.data, CRACK_TEXTURE_SIZE, CRACK_TEXTURE_SIZE, THREE.RGBAFormat);
  texture.name = `mining-fractures-${stage + 1}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.userData.opaquePixels = pixels.opaquePixels;
  texture.needsUpdate = true;
  return texture;
}

/** Hex side orientations/UVs match HexWorld's radius1 six-sided CylinderGeometry. */
export class MiningOverlay {
  constructor(scene) {
    this.scene = scene;
    this.textures = Array.from({ length: CRACK_STAGES }, (_, stage) => createCrackTexture(stage));
    this.geometry = new THREE.CylinderGeometry(1.002, 1.002, 1.004, 6, 1, false);
    const uv = this.geometry.attributes.uv;
    for (let i = 0; i < 14; i++) uv.setX(i, uv.getX(i) * 6);
    uv.needsUpdate = true;
    const top = this.geometry.groups[1];
    this.geometry.setIndex(Array.from(this.geometry.index.array.slice(0, top.start + top.count)));
    this.geometry.clearGroups();
    this.material = new THREE.MeshBasicMaterial({
      map: this.textures[0], transparent: true, alphaTest: 0.04, opacity: 1,
      depthWrite: false, depthTest: true, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "mining-fractures";
    this.mesh.renderOrder = 3;
    this.mesh.visible = false;
    this.mesh.raycast = () => {};
    scene.add(this.mesh);
    this.stage = -1;
    this.progress = 0;
    this.targetKey = null;
    this.awaitingReset = false;
    this.disposed = false;
  }

  get visible() { return this.mesh.visible; }

  update(block, progress, world) {
    if (this.disposed) return;
    if (!block || !Number.isFinite(progress) || progress <= 0 || ![block.q, block.r, block.y].every(Number.isFinite) || block.type === "water" || block.type === "bedrock") { this.clear(); return; }
    if (world?.getBlock && !world.getBlock(block.q, block.r, block.y)) { this.clear(); return; }
    const key = `${block.q},${block.r},${block.y}`;
    if (key !== this.targetKey) {
      const changed = this.targetKey !== null;
      this.clear();
      this.targetKey = key;
      if (changed) { this.awaitingReset = true; return; }
    }
    if (this.awaitingReset) {
      // Suppress the old target for one update; caller progress stays authoritative,
      // including a creative-mode strike that advances more than10% per frame.
      this.awaitingReset = false;
    }
    const center = world?.hexToWorld?.(block.q, block.r) || { x: Math.sqrt(3) * (block.q + block.r / 2), z: 1.5 * block.r };
    if (!Number.isFinite(center.x) || !Number.isFinite(center.z)) { this.clear(); return; }
    this.progress = Math.max(0, Math.min(1, progress));
    this.stage = Math.min(CRACK_STAGES - 1, Math.max(0, Math.ceil(this.progress * CRACK_STAGES) - 1));
    this.mesh.position.set(center.x, block.y + 0.5, center.z);
    this.material.map = this.textures[this.stage];
    this.mesh.userData.stage = this.stage;
    this.mesh.visible = true;
  }

  clear() {
    this.mesh.visible = false;
    this.stage = -1;
    this.progress = 0;
    this.targetKey = null;
    this.awaitingReset = false;
    this.mesh.userData.stage = -1;
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.scene.remove(this.mesh);
    for (const texture of this.textures) texture.dispose();
    this.textures.length = 0;
    this.geometry.dispose();
    this.material.dispose();
    this.disposed = true;
  }
}
