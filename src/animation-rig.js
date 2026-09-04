import * as THREE from "three";

// Object references deliberately live outside userData: Three clones userData via
// JSON, which would either duplicate or make a circular copy of a skeleton.
const rigs = new WeakMap();
const jointNames = [
  "motion-root", "head", "left-arm", "right-arm", "left-leg", "right-leg",
  "tail", "speaker", "antenna", "indicator",
];

export function joint(parent, name, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.name = `rig:${name}`;
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

/** Resolves joints in this particular clone, never in its template or a sibling. */
export function getAnimationRig(model) {
  if (rigs.has(model)) return rigs.get(model);
  const rig = { joints: {}, rest: {} };
  for (const name of jointNames) {
    const node = model.getObjectByName(`rig:${name}`);
    if (!node) continue;
    rig.joints[name] = node;
    rig.rest[name] = {
      position: node.position.clone(),
      rotation: node.rotation.clone(),
      scale: node.scale.clone(),
    };
  }
  rigs.set(model, rig);
  return rig;
}

function reset(rig) {
  for (const [name, node] of Object.entries(rig.joints)) {
    const rest = rig.rest[name];
    node.position.copy(rest.position);
    node.rotation.copy(rest.rotation);
    node.scale.copy(rest.scale);
  }
}

/** speed is world units/second; attack is one swing's normalized progress. */
export function animateHumanoid(model, {
  time = 0, moving = false, speed = 0, grounded = true, attack = 0,
  jump = 0, hit = 0,
} = {}) {
  const rig = getAnimationRig(model);
  reset(rig);
  const j = rig.joints;
  const cadence = THREE.MathUtils.clamp(5.1 + speed * 1.3, 7, 16);
  // Integrate phase across speed changes. Multiplying absolute world time by a
  // different walk/run frequency made limbs snap when the sprint key changed.
  if (!rig.gait || time < rig.gait.time)
    rig.gait = { time, phase: time * cadence };
  else {
    if (moving) rig.gait.phase += (time - rig.gait.time) * cadence;
    rig.gait.time = time;
  }
  const pace = moving ? THREE.MathUtils.clamp(0.6 + speed * (2 / 15), 0.45, 1.5) : 0;
  const step = Math.sin(rig.gait.phase);
  const stride = grounded ? step * 0.68 * pace : 0;
  const idle = Math.sin(time * 2.3) * 0.025;
  const swing = attack > 0 && attack < 1 ? Math.sin(attack * Math.PI) : 0;
  if (j["left-leg"]) j["left-leg"].rotation.x += stride;
  if (j["right-leg"]) j["right-leg"].rotation.x -= stride;
  if (j["left-arm"]) {
    j["left-arm"].rotation.x -= stride * 0.85;
    j["left-arm"].rotation.z -= idle;
  }
  if (j["right-arm"]) {
    j["right-arm"].rotation.x += stride * 0.85 - swing * 1.75;
    j["right-arm"].rotation.z += idle - swing * 0.2;
  }
  if (!grounded) {
    const tuck = Math.max(0, Math.min(1, jump || 0.5));
    if (j["left-leg"]) j["left-leg"].rotation.x -= 0.3 + tuck * 0.35;
    if (j["right-leg"]) j["right-leg"].rotation.x += 0.25 + tuck * 0.25;
    if (j["left-arm"]) j["left-arm"].rotation.z -= 0.22;
    if (j["right-arm"]) j["right-arm"].rotation.z += 0.22;
  }
  if (j["motion-root"]) {
    j["motion-root"].position.y += moving && grounded
      ? Math.abs(step) * 0.032 * pace : Math.sin(time * 2.3) * 0.006;
    j["motion-root"].rotation.z += moving && grounded ? step * pace * 0.018 : 0;
    j["motion-root"].rotation.x -= THREE.MathUtils.clamp(hit, 0, 1) * 0.2;
    j["motion-root"].rotation.y -= swing * 0.12;
  }
  if (j.head) j.head.rotation.x += idle * 0.45 + hit * 0.15;
  if (j.tail) j.tail.rotation.y += Math.sin(time * 5) * (moving ? 0.3 : 0.13);
  return rig;
}

/** One nod/bounce for each audible greeting; the placed feet do not drift. */
export function animateGnome(model, time, greetingAge = Infinity) {
  const rig = getAnimationRig(model);
  reset(rig);
  const { head, "motion-root": body } = rig.joints;
  const greeting = greetingAge >= 0 && greetingAge < 1.1
    ? Math.sin(greetingAge / 1.1 * Math.PI) : 0;
  if (head) head.rotation.x += Math.sin(greetingAge < 1.1 ? greetingAge * 12 : time * 1.6) * greeting * 0.24;
  if (body) {
    body.position.y += Math.abs(Math.sin(greetingAge * 10) || 0) * greeting * 0.11;
    body.rotation.z += Math.sin(greetingAge * 10) * greeting * 0.045 || 0;
  }
  return rig;
}

/** Geometry pulses rather than editing a shared material, including held radios. */
export function animateRadio(model, time, playing = true) {
  const rig = getAnimationRig(model);
  reset(rig);
  if (!playing) return rig;
  const beat = 0.5 + Math.sin(time * 8) * 0.5;
  if (rig.joints.speaker) rig.joints.speaker.position.z += beat * 0.013;
  if (rig.joints.indicator) rig.joints.indicator.scale.multiplyScalar(1 + beat * 0.8);
  if (rig.joints.antenna) rig.joints.antenna.rotation.z += Math.sin(time * 8) * 0.012;
  return rig;
}
