import * as THREE from "three";
const OFFSETS = [
  [0, 0],
  [0.27, 0],
  [-0.27, 0],
  [0, 0.27],
  [0, -0.27],
  [0.2, 0.2],
  [-0.2, -0.2],
  [0.2, -0.2],
  [-0.2, 0.2],
];
const SOLID = (b) => b && b.type !== "water";
export class Player {
  constructor(world, camera, audio) {
    this.world = world;
    this.camera = camera;
    this.audio = audio;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.08;
    this.grounded = false;
    this.walkTime = 0;
    this.stepDistance = 0;
    this.cameraDip = 0;
    this.crouching = false;
    this.crouchOffset = 0;
    this.eyeHeight = 1.64;
    this.onFall = () => {};
    this.reset(world.spawn);
  }
  reset(position) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.yaw = 0;
    this.pitch = -0.08;
    this.cameraDip = 0;
    this.crouching = false;
    this.crouchOffset = 0;
    this.stepDistance = 0;
    this.updateCamera(0);
  }
  look(dx, dy) {
    this.yaw -= dx * 0.0021;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0021, -1.48, 1.48);
  }
  solidAt(x, y, z) {
    const h = this.world.worldToHex(x, z);
    return SOLID(this.world.getBlock(h.q, h.r, Math.floor(y)));
  }
  collides(x, y, z) {
    for (const [ox, oz] of OFFSETS)
      for (const h of [0.08, 0.7, 1.79])
        if (this.solidAt(x + ox, y + h, z + oz)) return true;
    return false;
  }
  groundBelow(x, z, maxY) {
    let top = -Infinity;
    for (const [ox, oz] of OFFSETS) {
      const h = this.world.worldToHex(x + ox, z + oz);
      for (let y = Math.floor(maxY); y >= Math.floor(maxY) - 5; y--) {
        if (y + 1 > maxY + 0.002) continue;
        if (SOLID(this.world.getBlock(h.q, h.r, y))) {
          top = Math.max(top, y + 1);
          break;
        }
      }
    }
    return top;
  }
  update(dt, keys, { speed = false, furry = false, creative = false, using = false, canSprint = true } = {}) {
    const startX=this.position.x,startZ=this.position.z;
    this.cameraDip=THREE.MathUtils.damp(this.cameraDip,0,12,dt);
    const p = this.position,
      water = this.world.isWater(p.x, p.y + 0.7, p.z);
    const forward =
      Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
    const right =
      Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    this.crouching = keys.has("ShiftLeft") || keys.has("ShiftRight");
    this.crouchOffset = THREE.MathUtils.damp(this.crouchOffset, this.crouching ? -0.37 : 0, 16, dt);
    const sprinting = (keys.has("ControlLeft") || keys.has("ControlRight")) &&
      forward > 0 && canSprint && !using && !this.crouching;
    const pace =
      (sprinting ? 6.9 : 4.6) * (this.crouching ? 0.3 : 1) *
      (speed ? 1.8 : 1) *
      (water ? 0.57 : 1) * (using ? .35 : 1);
    const length = Math.hypot(forward, right) || 1;
    this.velocity.x =
      ((-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) / length) *
      pace;
    this.velocity.z =
      ((-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) / length) *
      pace;
    if (keys.has("Space")) {
      if (water) this.velocity.y = 3.7;
      else if (this.grounded) {
        this.velocity.y = furry ? 11.7 : 8.4;
        this.grounded = false;
        this.audio.play("jump");
      }
    }
    this.velocity.y -= (water ? 7 : 24) * dt;
    this.velocity.y = Math.max(this.velocity.y, water ? -3 : -36);
    const wasGrounded = this.grounded,
      oldY = p.y;
    for (const axis of ["x", "z"]) {
      const d = this.velocity[axis] * dt,
        steps = Math.max(1, Math.ceil(Math.abs(d) / 0.16));
      for (let i = 0; i < steps; i++) {
        const nx = p.x + (axis === "x" ? d / steps : 0),
          nz = p.z + (axis === "z" ? d / steps : 0);
        const h = this.world.worldToHex(nx, nz);
        if (
          Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) >
          this.world.radius - 1
        )
          break;
        if (!this.collides(nx, p.y, nz)) {
          // Sneaking can overhang an edge while at least part of the foot
          // remains supported, but cannot step into a drop. Once airborne or
          // swimming, normal movement applies so jumping off is still possible.
          if (this.crouching && wasGrounded && !water &&
              this.groundBelow(nx, nz, p.y + 0.03) < p.y - 0.05)
            break;
          p.x = nx;
          p.z = nz;
        } else if (wasGrounded && !this.collides(nx, p.y + 1.01, nz)) {
          const step = this.groundBelow(nx, nz, p.y + 1.02);
          if (step <= p.y + 1.02 && step >= p.y) {
            p.x = nx;
            p.z = nz;
            p.y = step;
          }
        }
      }
    }
    const dy = this.velocity.y * dt,
      newY = p.y + dy;
    const floor = this.groundBelow(p.x, p.z, p.y + 0.03);
    if (this.velocity.y <= 0 && newY <= floor) {
      if (this.velocity.y < -12)
        this.onFall(Math.round((-this.velocity.y - 11) * 3));
      if(!wasGrounded&&this.velocity.y < -2.5){this.cameraDip=-Math.min(.11,-this.velocity.y*.012);this.audio.play("land");}
      p.y = floor;
      this.velocity.y = 0;
      this.grounded = true;
    } else if (this.velocity.y > 0 && this.collides(p.x, newY, p.z)) {
      this.velocity.y = 0;
    } else {
      p.y = newY;
      this.grounded = false;
    }
    if (p.y < -18 || !Number.isFinite(p.y)) {
      this.onFall(35);
      this.reset(this.world.spawn);
    }
    const distance=Math.hypot(p.x-startX,p.z-startZ),walking=distance>.001;
    this.walkTime += walking && this.grounded ? distance*.85 : 0;
    this.stepDistance += walking && (this.grounded||water)?distance:0;
    if(this.stepDistance>1.8){this.stepDistance%=1.8;const h=this.world.worldToHex(p.x,p.z);this.audio.footstep?.(this.world.getBlock(h.q,h.r,Math.floor(p.y-.1))?.type,water);}
    this.updateCamera(
      (walking && this.grounded ? Math.sin(this.walkTime * 6) * 0.032 : 0)+this.cameraDip,
    );
    return {
      moving: walking,
      water,
      submerged: this.world.isWater(p.x, p.y + 1.4, p.z),
      sprinting: sprinting && walking,
      crouching: this.crouching,
      fall: oldY - p.y,
    };
  }
  updateCamera(bob = 0) {
    this.camera.position
      .copy(this.position)
      .add(new THREE.Vector3(0, this.eyeHeight + this.crouchOffset + bob, 0));
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
  direction() {
    return new THREE.Vector3(0, 0, -1)
      .applyEuler(this.camera.rotation)
      .normalize();
  }
}
