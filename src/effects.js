import * as THREE from "three";

export const MAX_PARTICLES = 480;
export const MAX_RINGS = 16;
const PALETTES = {
  grass: [0x628d36, 0x82ad4a, 0x785239, 0x9f7548],
  dirt: [0x926b45, 0x795034, 0xb18858, 0x624631],
  stone: [0x939c94, 0xb4b9a8, 0x757f79, 0xc5c7b8],
  sand: [0xe5d6a0, 0xc6ad76, 0xf1dfac, 0xd0bf8e],
  wood: [0x865a35, 0xaa7d46, 0x69442b, 0xc49a61],
  birch: [0xe1ddc8, 0xf4efda, 0x62594a, 0xb8b9a8],
  leaves: [0x406d31, 0x72a543, 0x588c32, 0x8aaf4e],
  pine: [0x315e41, 0x497a4b, 0x63894d, 0x254b34],
  ore: [0x859590, 0x75dfd2, 0xb4b9a8, 0xafe9e1],
  lucky: [0xffdc65, 0xe2aa32, 0xfff1a5, 0xc28c27],
  water: [0x65bfd0, 0xa3e5e7, 0x81d8d5],
  bedrock: [0x4d6259, 0x6b7b71, 0x364b41],
};
const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Bounded, geometric particles. clear() disposes owned materials, never terrain maps. */
export class Effects {
  constructor(scene, { groundHeight, maxParticles = MAX_PARTICLES } = {}) {
    this.scene = scene;
    this.particles = [];
    this.rings = [];
    this.materials = new Map();
    this.maxParticles = Math.max(1, Math.min(MAX_PARTICLES, maxParticles | 0));
    this.groundHeight = groundHeight || null;
    this.geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.fragmentGeometries = Array.from({ length: 4 }, (_, index) => {
      const geometry = this.geometry.clone();
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setXY(i, uv.getX(i) * 0.23 + (index % 2) * 0.5, uv.getY(i) * 0.23 + Math.floor(index / 2) * 0.5);
      uv.needsUpdate = true;
      return geometry;
    });
    this.disposed = false;
  }

  setWorld(world) {
    this.groundHeight = world?.getGroundHeight ? (x, z) => world.getGroundHeight(x, z) : null;
    return this;
  }

  material(color, texture = null, kind = "debris") {
    const key = `${color}|${texture?.uuid || ""}|${kind}`;
    if (!this.materials.has(key)) {
      const options = { color, map: texture || null, depthWrite: true, toneMapped: kind !== "flash" };
      const material = kind === "debris"
        ? new THREE.MeshStandardMaterial({ ...options, roughness: 1, metalness: 0, flatShading: true })
        : new THREE.MeshBasicMaterial({ ...options, transparent: kind === "smoke", opacity: kind === "smoke" ? 0.68 : 1, depthWrite: kind !== "smoke" });
      material.name = `voxel-effect-${kind}`;
      material.userData.effectKey = key;
      material.userData.effectReferences = 0;
      this.materials.set(key, material);
    }
    return this.materials.get(key);
  }

  _removeParticle(index) {
    const [particle] = this.particles.splice(index, 1);
    this.scene.remove(particle.mesh);
    const material = particle.mesh.material;
    material.userData.effectReferences--;
    if (material.userData.effectReferences <= 0) {
      this.materials.delete(material.userData.effectKey);
      material.dispose();
    }
  }

  _spawn(position, color, velocity, options = {}) {
    if (this.disposed) return null;
    if (this.particles.length >= this.maxParticles) this._removeParticle(0);
    const kind = options.kind || "debris";
    const mesh = new THREE.Mesh(
      options.texture ? this.fragmentGeometries[Math.floor(Math.random() * 4)] : this.geometry,
      this.material(color, options.texture, kind),
    );
    mesh.name = `voxel-${kind}`;
    mesh.material.userData.effectReferences++;
    mesh.position.copy(position);
    const size = options.size ?? 0.55 + Math.random() * 1.3;
    mesh.scale.set(size, size * (options.flat ? 0.4 : 1), size);
    if (kind === "debris") mesh.rotation.set(Math.random(), Math.random(), Math.random());
    const life = options.life ?? 0.65 + Math.random() * 0.5;
    const particle = {
      mesh, velocity: velocity.clone(), life, totalLife: life,
      baseScale: mesh.scale.clone(), kind, grounded: false, bounces: 0,
      gravity: options.gravity ?? (kind === "smoke" ? -0.45 : 13.5),
      fallbackGround: options.groundY ?? position.y - 1,
      spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8),
    };
    this.particles.push(particle);
    this.scene.add(mesh);
    return particle;
  }

  burst(position, color = 0xffc74c, count = 20, power = 3) {
    if (this.disposed) return;
    const number = Math.max(0, Math.min(this.maxParticles, Math.floor(count)));
    for (let i = 0; i < number; i++) {
      const velocity = new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power * 0.8 + 1, (Math.random() - 0.5) * power);
      this._spawn(position, color, velocity, { life: 0.65 + Math.random() * 0.7 });
    }
    if (power >= 6 || count >= 55) {
      for (let i = 0; i < 3; i++) {
        const flash = position.clone().add(new THREE.Vector3((i - 1) * 0.24, i * 0.14, 0));
        this._spawn(flash, [0xfff8c7, 0xffd267, 0xff8645][i], ZERO, { kind: "flash", size: 4 + i * 2, life: 0.12 + i * 0.045, gravity: 0 });
      }
      for (let i = 0; i < 12; i++)
        this._spawn(position, [0x53514d, 0x746f60, 0xaaa18a][i % 3], new THREE.Vector3((Math.random() - 0.5) * 2.5, 0.7 + Math.random() * 1.5, (Math.random() - 0.5) * 2.5), { kind: "smoke", size: 1.8 + Math.random() * 2, life: 1.3 + Math.random() * 0.7 });
    }
  }

  hitBlock(point, normal = UP, type = "stone", texture = null) {
    if (this.disposed || !point) return;
    const palette = PALETTES[type] || PALETTES.stone;
    const direction = normal?.lengthSq?.() > 0 ? normal.clone().normalize() : UP;
    const origin = point.clone().addScaledVector(direction, 0.045);
    const count = type === "leaves" || type === "pine" ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const scatter = new THREE.Vector3((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.8);
      const inward = scatter.dot(direction);
      if (inward < 0) scatter.addScaledVector(direction, -inward);
      scatter.addScaledVector(direction, 0.8 + Math.random() * 1.6);
      scatter.y += 0.9;
      if (scatter.dot(direction) < 0.4) scatter.addScaledVector(direction, 0.4 - scatter.dot(direction));
      this._spawn(origin, palette[i % palette.length], scatter, { texture, size: 0.45 + Math.random() * 0.55, life: 0.35 + Math.random() * 0.4, flat: type === "leaves" || type === "pine", groundY: Math.floor(point.y) });
    }
  }

  breakBlock(position, type = "stone", texture = null) {
    if (this.disposed || !position) return;
    const palette = PALETTES[type] || PALETTES.stone;
    const count = type === "leaves" || type === "pine" ? 25 : 32;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.sqrt(Math.random()) * 0.72;
      const origin = position.clone().add(new THREE.Vector3(Math.sin(angle) * radial, (Math.random() - 0.5) * 0.7, Math.cos(angle) * radial));
      const velocity = origin.clone().sub(position).multiplyScalar(4.2);
      velocity.y = 1.2 + Math.random() * 3.8;
      this._spawn(origin, palette[i % palette.length], velocity, { texture, size: 0.75 + Math.random() * 1.5, life: 0.75 + Math.random() * 0.65, flat: type === "leaves" || type === "pine", groundY: Math.floor(position.y) });
    }
  }

  ring(position, radius, color = 0xffc74c) {
    if (this.disposed || !Number.isFinite(radius) || radius <= 0) return;
    if (this.rings.length >= MAX_RINGS) this._removeRing(0);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Group();
    mesh.name = "voxel-shockwave";
    mesh.position.copy(position);
    for (let side = 0; side < 6; side++) {
      const a = side * Math.PI / 3, b = (side + 1) * Math.PI / 3;
      for (let step = 0; step < 4; step++) {
        const t = (step + 0.5) / 4;
        const piece = new THREE.Mesh(this.geometry, material);
        piece.position.set(Math.sin(a) * (1 - t) + Math.sin(b) * t, 0, Math.cos(a) * (1 - t) + Math.cos(b) * t);
        piece.rotation.y = a + Math.PI / 6;
        piece.scale.set(1.85, 0.55, 0.65);
        mesh.add(piece);
      }
    }
    mesh.scale.setScalar(0.1);
    this.scene.add(mesh);
    this.rings.push({ mesh, material, life: 0.55, totalLife: 0.55, radius });
  }

  _removeRing(index) {
    const [ring] = this.rings.splice(index, 1);
    this.scene.remove(ring.mesh);
    ring.material.dispose();
  }

  update(dt) {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this._removeParticle(i); continue; }
      const steps = Math.ceil(Math.min(dt, 2) / 0.025), step = Math.min(dt, 2) / steps;
      for (let n = 0; n < steps; n++) {
        if (p.grounded) break;
        const previousY = p.mesh.position.y;
        p.velocity.y -= p.gravity * step;
        p.mesh.position.addScaledVector(p.velocity, step);
        if (p.kind !== "debris") continue;
        const queried = this.groundHeight?.(p.mesh.position.x, p.mesh.position.z);
        const ground = Number.isFinite(queried) ? queried : (this.groundHeight ? -Infinity : p.fallbackGround);
        const floor = ground + 0.06 * p.baseScale.y;
        if (previousY >= floor && p.mesh.position.y <= floor && p.velocity.y < 0) {
          p.mesh.position.y = floor;
          p.velocity.y *= -0.2;
          p.velocity.x *= 0.48;
          p.velocity.z *= 0.48;
          p.bounces++;
          if (p.bounces >= 2 || p.velocity.y < 0.5) { p.grounded = true; p.velocity.set(0, 0, 0); }
        }
      }
      const remaining = p.life / p.totalLife;
      const fade = p.kind === "flash" ? remaining : Math.min(1, remaining / 0.3);
      const expansion = p.kind === "smoke" ? 1 + (1 - remaining) * 1.3 : 1;
      p.mesh.scale.copy(p.baseScale).multiplyScalar(Math.max(0.02, fade * expansion));
      if (!p.grounded && p.kind === "debris") {
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
        p.mesh.rotation.z += p.spin.z * dt;
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) { this._removeRing(i); continue; }
      const age = 1 - r.life / r.totalLife;
      const radial = (0.12 + age * 0.88) * r.radius;
      r.mesh.scale.set(radial, 0.7 + radial * 0.06, radial);
      r.material.opacity = (1 - age) * 0.78;
    }
  }

  clear() {
    for (const particle of this.particles) this.scene.remove(particle.mesh);
    this.particles.length = 0;
    while (this.rings.length) this._removeRing(this.rings.length - 1);
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.clear();
    this.geometry.dispose();
    for (const geometry of this.fragmentGeometries) geometry.dispose();
    this.groundHeight = null;
    this.disposed = true;
  }
}
