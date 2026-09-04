import * as THREE from "three";
import { createItemModel, getItem } from "./items.js";
import { animateGnome, animateHumanoid, animateRadio } from "./animation-rig.js";
import { BLOCKS } from "./inventory.js";
import { createHexBlockGeometry } from "./world.js";
const NEIGHBORS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const resourceIds = ["ore", "stone", "wood", "cuir", "dirt", "grass", "sand"];
const supportedObjects = new Set(["gnome", "radio", "nucleaire"]);
const isWalker = (e) => e.kind === "hostile" || e.kind === "friend";
const down = new THREE.Vector3(0, -1, 0);

function createBombModel() {
  const model = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x354138, roughness: 0.84, metalness: 0.15, flatShading: true,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.6, 6), material);
  body.castShadow = true;
  model.add(body);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.38), material);
    fin.position.y = 0.27;
    fin.rotation.y = i * Math.PI / 2;
    model.add(fin);
  }
  model.name = "falling-bomb";
  return model;
}

function disposeProjectile(projectile) {
  if (!projectile.bomb) return;
  const materials = new Set();
  projectile.model.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry.dispose();
    materials.add(node.material);
  });
  for (const material of materials) material.dispose();
}
const distanceHex = (a, b) =>
  Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(a.q + a.r - b.q - b.r),
  );
export class Entities {
  constructor(game) {
    this.g = game;
    this.all = [];
    this.projectiles = [];
    this.visuals = [];
    this.pickupGeometry = null;
    this.nextId = 1;
  }
  spawn(kind, position, extra = {}) {
    const id =
      kind === "hostile" ? "urssaf" : kind === "friend" ? "furry" : kind;
    let model;
    if (extra.pickup && BLOCKS.has(id) && this.g.world.materials?.[id]) {
      model = new THREE.Group();
      const geometry = this.g.world.geometry || (this.pickupGeometry ??= createHexBlockGeometry());
      const block = new THREE.Mesh(geometry, this.g.world.materials[id]);
      block.scale.setScalar(0.5);
      block.position.y = 0.25;
      block.castShadow = block.receiveShadow = true;
      model.add(block);
      model.name = `item:${id}`;
      model.userData.itemId = id;
      model.userData.assetShared = true;
    } else model = createItemModel(id);
    model.position.copy(position);
    if (kind === "hostile") model.scale.setScalar(1.9);
    if (kind === "friend") model.scale.setScalar(1.55);
    const e = {
      uid: this.nextId++,
      kind,
      model,
      health: kind === "hostile" ? 55 : 30,
      inventory: {},
      cooldown: 0,
      fear: 0,
      age: 0,
      pickupDelay: 0.35,
      anchor: position.clone(),
      hitTime: 0,
      attackTime: Infinity,
      pendingAttack: false,
      greetingTime: Infinity,
      flash: null,
      knockback: null,
      path: [],
      pathAt: 0,
      lastSound: -10,
      ...extra,
    };
    if (e.pickup) model.scale.setScalar(0.7);
    model.traverse((o) => {
      o.userData.entity = e;
    });
    if (kind === "nucleaire" && !e.pickup) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.35, 65, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x8cfce4,
          transparent: true,
          opacity: 0.38,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.y = 33;
      model.add(beam);
      e.beam = beam;
      const light = new THREE.PointLight(0x78ffe2, 8, 13, 1.5);
      light.position.y = 2;
      model.add(light);
    }
    if (kind === "b2" && !e.pickup) {
      model.scale.setScalar(9);
      e.origin = position.clone();
      e.bombs = 0;
      model.rotation.y = Math.PI;
    }
    this.g.scene.add(model);
    this.all.push(e);
    return e;
  }
  drop(id, position, count = 1) {
    const e = this.spawn(id, position, {
      pickup: true,
      item: id,
      count,
      health: 1,
    });
    return e;
  }
  nearby(position, distance = 8) {
    return this.all.filter(
      (e) =>
        !e.pickup &&
        ["hostile", "friend"].includes(e.kind) &&
        e.model.position.distanceTo(position) < distance,
    );
  }
  remove(e, { linger = false } = {}) {
    if (linger) {
      e.deathAge = 0;
      e.deathRotation = e.model.rotation.clone();
      e.deathScale = e.model.scale.clone();
      this.visuals.push(e);
    } else {
      this.g.scene.remove(e.model);
      this.clearFlash(e);
    }
    if (e.beam) {
      e.beam.geometry.dispose();
      e.beam.material.dispose();
    }
    const i = this.all.indexOf(e);
    if (i >= 0) this.all.splice(i, 1);
  }
  clear() {
    for (const e of [...this.all]) this.remove(e);
    for (const e of this.visuals) {
      this.g.scene.remove(e.model);
      this.clearFlash(e);
    }
    this.visuals = [];
    for (const p of this.projectiles) {
      this.g.scene.remove(p.model);
      disposeProjectile(p);
    }
    this.projectiles = [];
    // Only the optional local fallback belongs to Entities. The world's shared
    // geometry and materials are always disposed by the world itself.
    this.pickupGeometry?.dispose();
    this.pickupGeometry = null;
  }
  flash(e) {
    e.hitTime = 0.24;
    if (e.flash) return;
    const slots = [], copies = new Map();
    const replacement = (material) => {
      if (!copies.has(material)) {
        const copy = material.clone();
        copy.color?.lerp(new THREE.Color(0xff6253), 0.65);
        copy.emissive?.setHex(0x6c1610);
        if (copy.emissive) copy.emissiveIntensity = 0.65;
        copies.set(material, copy);
      }
      return copies.get(material);
    };
    e.model.traverse((node) => {
      if (!node.isMesh || node === e.beam) return;
      slots.push([node, node.material]);
      node.material = Array.isArray(node.material)
        ? node.material.map(replacement) : replacement(node.material);
    });
    e.flash = { slots, materials: [...copies.values()] };
  }
  clearFlash(e) {
    if (!e.flash) return;
    for (const [mesh, original] of e.flash.slots) mesh.material = original;
    for (const material of e.flash.materials) material.dispose();
    e.flash = null;
  }
  target(raycaster, range = 4.5) {
    const meshes = this.all
      .filter((e) => !e.pickup && e.kind !== "b2")
      .map((e) => e.model);
    for (const mesh of meshes) mesh.updateMatrixWorld(true);
    for (const hit of raycaster.intersectObjects(meshes, true)) {
      if (hit.distance > range) break;
      if (hit.object.userData.entity)
        return {
          entity: hit.object.userData.entity,
          distance: hit.distance,
          point: hit.point,
        };
    }
    return null;
  }
  damage(e, amount, knockback = 0, direction = null) {
    if (!this.all.includes(e)) return;
    e.health -= amount;
    if (amount > 0) this.flash(e);
    this.g.fx.burst(
      e.model.position.clone().add(new THREE.Vector3(0, 0.7, 0)),
      0xff9d61,
      8,
      2,
    );
    if (direction && knockback) {
      const p = e.model.position,
        dx = direction.x * knockback,
        dz = direction.z * knockback;
      const ground = this.g.world.getGroundHeight(p.x + dx, p.z + dz);
      if (Number.isFinite(ground) && ground < p.y + 2) {
        e.knockback = {
          from: p.clone(),
          to: new THREE.Vector3(p.x + dx, Math.max(ground, p.y), p.z + dz),
          age: 0,
        };
      }
    }
    if (e.health <= 0) {
      const p = e.model.position.clone();
      const kind = e.kind;
      this.remove(e, { linger: isWalker(e) });
      if (kind === "nucleaire") {
        this.explode(p, 8, 80, true);
        this.g.ui.notify("Réacteur détruit : détonation nucléaire !", {
          title: "CRITICITÉ",
          tone: "danger",
        });
      } else if (kind === "hostile" || kind === "friend") {
        for (const [id, n] of Object.entries(e.inventory))
          if (n > 0) {
            this.g.inv.add(id, n);
          }
        if (kind === "hostile") {
          this.g.inv.add("cuir", 1);
          this.g.ui.notify("Agent vaincu. Ressources saisies récupérées.");
        }
      } else {
        this.g.inv.add(kind);
        this.g.ui.notify(`${getItem(kind)?.name || kind} récupéré.`);
      }
    }
  }
  pathTo(e, target) {
    const w = this.g.world,
      start = w.worldToHex(e.model.position.x, e.model.position.z),
      goal = w.worldToHex(target.x, target.z);
    if (distanceHex(start, goal) > 22) return [];
    const key = (h) => `${h.q},${h.r}`,
      open = [{ ...start, g: 0, f: distanceHex(start, goal) }],
      seen = new Map([[key(start), 0]]),
      parent = new Map();
    let end = null;
    for (let i = 0; i < 280 && open.length; i++) {
      open.sort((a, b) => a.f - b.f);
      const cur = open.shift();
      if (distanceHex(cur, goal) <= 1) {
        end = cur;
        break;
      }
      const cy = w.surfaceY(cur.q, cur.r);
      for (const [dq, dr] of NEIGHBORS) {
        const next = { q: cur.q + dq, r: cur.r + dr },
          ny = w.surfaceY(next.q, next.r);
        if (!Number.isFinite(ny) || ny > cy + 1 || ny < cy - 3) continue;
        const k = key(next),
          ng = cur.g + 1 + (ny < w.seaLevel ? 0.5 : 0);
        if ((seen.get(k) ?? Infinity) <= ng) continue;
        seen.set(k, ng);
        parent.set(k, cur);
        open.push({ ...next, g: ng, f: ng + distanceHex(next, goal) });
      }
    }
    const path = [];
    while (end && key(end) !== key(start)) {
      const xz = w.hexToWorld(end.q, end.r);
      path.unshift(new THREE.Vector3(xz.x, w.surfaceY(end.q, end.r) + 1, xz.z));
      end = parent.get(key(end));
    }
    return path;
  }
  throwItem(id, position, velocity, { bomb = false } = {}) {
    const model = bomb ? createBombModel() : createItemModel(id);
    model.scale.setScalar(bomb ? 1 : 0.65);
    model.position.copy(position);
    this.g.scene.add(model);
    this.projectiles.push({
      model,
      velocity: velocity.clone(),
      life: 5,
      age: 0,
      bomb,
      id,
    });
  }
  explode(position, radius, damage, terrain = false) {
    const { g } = this;
    g.fx.burst(position, 0xffb84e, 65, radius * 2);
    g.fx.ring(position, radius, 0xffcc62);
    g.audio.play("explosion");
    g.shake = 0.35;
    for (const e of [...this.all]) {
      if (e.pickup || e.kind === "b2") continue;
      const d = e.model.position.distanceTo(position);
      if (d < radius)
        this.damage(
          e,
          damage * (1 - d / radius) + 10,
          2,
          e.model.position.clone().sub(position).normalize(),
        );
    }
    const dp = g.player.position.distanceTo(position);
    if (dp < radius) g.hurt(damage * (1 - dp / radius));
    if (terrain) {
      const luckyDrops = [],
        h = g.world.worldToHex(position.x, position.z),
        r = Math.ceil(radius / 1.5);
      for (let q = h.q - r; q <= h.q + r; q++)
        for (let s = h.r - r; s <= h.r + r; s++) {
          const p = g.world.hexToWorld(q, s);
          for (
            let y = Math.max(0, Math.floor(position.y - radius));
            y <= position.y + radius;
            y++
          ) {
            if (
              Math.hypot(
                p.x - position.x,
                y + 0.5 - position.y,
                p.z - position.z,
              ) > radius
            )
              continue;
            const b = g.world.getBlock(q, s, y);
            if (b && b.type !== "water" && b.type !== "bedrock") {
              g.world.removeBlock(q, s, y);
              if (b.type === "lucky")
                luckyDrops.push(new THREE.Vector3(p.x, y + 0.6, p.z));
            }
          }
        }
      g.world.rebuild();
      for (const p of luckyDrops) g.openLucky?.(p);
    }
  }
  update(dt) {
    const { g } = this,
      p = g.player.position;
    for (const e of [...this.all]) {
      e.age += dt;
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.fear = Math.max(0, e.fear - dt);
      e.attackTime += dt;
      e.greetingTime += dt;
      e.hitTime = Math.max(0, e.hitTime - dt);
      if (e.flash && e.hitTime === 0) this.clearFlash(e);
      const pos = e.model.position;
      if (e.pickup) {
        // A fixed anchor and absolute phase keep bobbing bounded at every FPS.
        pos.copy(e.anchor);
        pos.y += Math.sin(e.age * 3) * 0.12;
        e.model.rotation.y = e.age * 0.9;
        if (e.item === "radio") animateRadio(e.model, e.age);
        const d = pos.distanceTo(p.clone().add(new THREE.Vector3(0, 0.65, 0)));
        const delay = Number.isFinite(e.pickupDelay) ? Math.max(0, e.pickupDelay) : 0.35;
        const canPickup = e.age >= delay;
        if (d < 3 && canPickup) {
          e.anchor.lerp(
            p.clone().add(new THREE.Vector3(0, 0.7, 0)),
            1 - Math.exp(-dt * 5),
          );
          pos.copy(e.anchor);
          pos.y += Math.sin(e.age * 3) * 0.12;
        }
        if (d < 1.4 && canPickup) {
          g.inv.add(e.item, e.count);
          g.audio.play("eat");
          g.ui.notify(`+${e.count} ${getItem(e.item)?.name || e.item}`, {
            icon: getItem(e.item)?.icon,
          });
          this.remove(e);
        }
        continue;
      }
      if (supportedObjects.has(e.kind)) {
        // Check the contact cell, not the column's highest surface: an object
        // can stand on an interior floor with another floor or roof above it.
        const cell = g.world.worldToHex(pos.x, pos.z);
        const support = g.world.getBlock(cell.q, cell.r, Math.floor(pos.y - 1e-4));
        if (!support || support.type === "water") {
          const position = pos.clone();
          this.remove(e);
          this.drop(e.kind, position);
          // The new pickup is not in this frame's snapshot, so it cannot be
          // processed twice. Losing a reactor's floor never calls damage().
          continue;
        }
      }
      if (e.kind === "b2") {
        pos.z = e.origin.z - e.age * 13;
        pos.x = e.origin.x + Math.sin(e.age * 0.7) * 3;
        pos.y = e.origin.y + Math.sin(e.age * 0.7) * 0.45 + Math.max(0, e.age - 4.8) * 0.65;
        e.model.rotation.y = Math.atan2(Math.cos(e.age * 0.7) * 2.1, -13);
        e.model.rotation.z = -Math.cos(e.age * 0.7) * 0.17;
        e.model.rotation.x = -0.025 - (e.age > 4.8 ? 0.04 : 0);
        if (
          e.age > 1 &&
          e.age < 4.8 &&
          e.bombs < 7 &&
          e.age > 1 + e.bombs * 0.48
        ) {
          e.bombs++;
          this.throwItem(
            null,
            pos.clone().add(new THREE.Vector3(e.bombs % 2 ? -1.6 : 1.6, -1, 0)),
            new THREE.Vector3(Math.cos(e.age * 0.7), -3, -7),
            { bomb: true },
          );
        }
        if (e.age > 12) this.remove(e);
        continue;
      }
      if (
        e.kind === "gnome" &&
        pos.distanceTo(p) < 5 &&
        g.time - e.lastSound > 7
      ) {
        e.lastSound = g.time;
        e.greetingTime = 0;
        g.audio.play("gnome");
        g.ui.notify("« Hou… hou ! »", { title: "LE GNOME VOUS SALUE" });
      }
      if (e.kind === "gnome") animateGnome(e.model, e.age, e.greetingTime);
      if (e.kind === "radio") animateRadio(e.model, e.age);
      if (isWalker(e)) {
        const previous = pos.clone();
        if (e.knockback) {
          const impulse = e.knockback;
          impulse.age += dt;
          const t = Math.min(1, impulse.age / 0.22);
          const next = impulse.from.clone().lerp(impulse.to, 1 - (1 - t) ** 3);
          const ground = g.world.getGroundHeight(next.x, next.z);
          if (Number.isFinite(ground) && ground <= pos.y + 1.05) {
            pos.copy(next);
            pos.y = Math.max(pos.y, ground);
          } else e.knockback = null;
          if (t === 1) e.knockback = null;
        }
        const d = pos.distanceTo(p);
        let target = null;
        if (e.fear > 0)
          target = pos
            .clone()
            .add(pos.clone().sub(p).setY(0).normalize().multiplyScalar(6));
        else if (
          (e.kind === "hostile" && d < 30 && d > 1.35) ||
          (e.kind === "friend" && d > 5 && d < 20)
        ) {
          if (g.time > e.pathAt) {
            e.path = this.pathTo(e, p);
            e.pathAt = g.time + 1.5 + Math.random() * 0.4;
          }
          if (e.path.length && pos.distanceTo(e.path[0]) < 0.4) e.path.shift();
          target = e.path[0] || p;
        }
        if (target && !e.knockback) {
          const dir = target.clone().sub(pos).setY(0).normalize(),
            pace = e.fear ? 4.5 : e.kind === "hostile" ? 2.45 : 1.7,
            nx = pos.x + dir.x * pace * dt,
            nz = pos.z + dir.z * pace * dt,
            ground = g.world.getGroundHeight(nx, nz);
          if (
            Number.isFinite(ground) &&
            ground <= pos.y + 1.05 &&
            ground > pos.y - 5
          ) {
            pos.x = nx;
            pos.z = nz;
            pos.y = THREE.MathUtils.lerp(pos.y, ground, Math.min(1, dt * 12));
          }
          e.model.rotation.y = Math.atan2(dir.x, dir.z);
        }
        if (e.kind === "hostile" && d < 1.9 && e.cooldown <= 0 && e.fear <= 0) {
          e.cooldown = 1.5;
          e.attackTime = 0.001;
          e.pendingAttack = true;
          e.model.rotation.y = Math.atan2(p.x - pos.x, p.z - pos.z);
        }
        // A hostile's damage happens when its fist reaches the forward arc,
        // allowing a visible wind-up and a chance to step out of its reach.
        if (e.pendingAttack && e.attackTime >= 0.18) {
          e.pendingAttack = false;
          if (d < 2.05 && e.fear <= 0 && !g.invulnerable()) {
            g.hurt(7);
            const id = resourceIds.find((k) => (g.inv.counts[k] || 0) > 0);
            if (id) {
              const n = Math.min(g.inv.counts[id], 3);
              g.inv.remove(id, n);
              e.inventory[id] = (e.inventory[id] || 0) + n;
              g.ui.notify(
                `Saisie de ${n} ${g.name(id)}. Battez l’agent pour les récupérer.`,
                { title: "CONTRÔLE URSSAF", tone: "danger" },
              );
            }
          }
        }
        const speed = Math.hypot(pos.x - previous.x, pos.z - previous.z) / Math.max(dt, 1e-6);
        animateHumanoid(e.model, {
          time: e.age, moving: speed > 0.15, speed,
          attack: e.attackTime / 0.42, hit: e.hitTime / 0.24,
        });
      }
    }
    // Dead walkers leave gameplay immediately, then visibly fall and dissolve.
    for (let i = this.visuals.length - 1; i >= 0; i--) {
      const e = this.visuals[i];
      e.deathAge += dt;
      const t = Math.min(1, e.deathAge / 0.48);
      e.model.rotation.z = e.deathRotation.z + (e.uid % 2 ? -1 : 1) * Math.sin(t * Math.PI / 2) * 1.35;
      e.model.scale.copy(e.deathScale).multiplyScalar(1 - t * 0.2);
      if (e.flash) for (const material of e.flash.materials) {
        material.transparent = true;
        material.opacity = 1 - t;
        material.depthWrite = false;
      }
      if (t === 1) {
        this.g.scene.remove(e.model);
        this.clearFlash(e);
        this.visuals.splice(i, 1);
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.age += dt;
      pr.velocity.y -= 13 * dt;
      const before = pr.model.position.clone();
      pr.model.position.addScaledVector(pr.velocity, dt);
      if (pr.bomb) {
        pr.model.quaternion.setFromUnitVectors(down, pr.velocity.clone().normalize());
        pr.model.rotateY(pr.age * 1.5);
      } else {
        pr.model.rotation.x += dt * 4;
        pr.model.rotation.y += dt * 1.6;
      }
      const pos = pr.model.position,
        delta = pos.clone().sub(before);
      const ray = new THREE.Raycaster(
        before,
        delta.clone().normalize(),
        0,
        delta.length() + 0.1,
      );
      const contact = g.world.raycast(ray, delta.length() + 0.1);
      const entityHit = this.nearby(pos, 1).length > 0;
      if (contact || entityHit || pr.life < 0) {
        this.g.scene.remove(pr.model);
        disposeProjectile(pr);
        this.projectiles.splice(i, 1);
        this.explode(
          contact?.point || pos,
          pr.bomb ? 4.5 : 4,
          pr.bomb ? 45 : 38,
          pr.bomb,
        );
      }
    }
  }
  serialize() {
    return this.all
      .filter((e) => e.kind !== "b2")
      .map((e) => ({
        kind: e.kind,
        position: (e.pickup ? e.anchor : e.model.position).toArray(),
        health: e.health,
        inventory: e.inventory,
        pickup: !!e.pickup,
        ...(e.pickup ? {
          item: e.item,
          count: e.count,
          pickupDelay: Math.max(0, (Number.isFinite(e.pickupDelay) ? e.pickupDelay : 0.35) - e.age),
        } : {}),
      }));
  }
  restore(data) {
    this.clear();
    if (!Array.isArray(data)) return;
    for (const d of data.slice(0, 160)) {
      if (
        !(d.pickup && (BLOCKS.has(d.kind) || d.kind === "pickaxe")) && ![
          "hostile",
          "friend",
          "gnome",
          "nucleaire",
          "radio",
          ...[
            "chocolatine",
            "cuir",
            "poche",
            "impots",
            "journal",
            "urssaf",
            "b2",
            "socialiste",
            "cb12",
            "zerator",
            "megaphone",
            "tgv",
            "furry",
          ],
        ].includes(d.kind)
      )
        continue;
      if (!Array.isArray(d.position) || !d.position.every(Number.isFinite))
        continue;
      this.spawn(d.kind, new THREE.Vector3(...d.position), {
        health: Math.max(1, Math.min(100, Number(d.health) || 30)),
        inventory:
          d.inventory && typeof d.inventory === "object" ? d.inventory : {},
        pickup: !!d.pickup,
        item: d.item,
        count: Number.isInteger(d.count) && d.count > 0
          ? Math.min(999999, d.count) : 1,
        pickupDelay: Number.isFinite(d.pickupDelay) ? Math.max(0, d.pickupDelay) : 0.35,
      });
    }
  }
}
