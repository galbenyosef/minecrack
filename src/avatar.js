import * as THREE from "three";
import { createItemModel } from "./items.js";
import { animateHumanoid, joint } from "./animation-rig.js";

const box = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map();
function material(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        flatShading: true,
      }),
    );
  return materials.get(color);
}
function part(group, color, size, position) {
  const mesh = new THREE.Mesh(box, material(color));
  mesh.scale.set(...size);
  mesh.position.set(...position);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
export function createPlayerAvatar(furry = false) {
  if (furry) {
    const model = createItemModel("furry");
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    model.scale.multiplyScalar(1.85 / size.y);
    model.name = "player-furry-costume";
    return model;
  }
  const group = new THREE.Group();
  group.name = "player-adventurer";
  const body = joint(group, "motion-root");
  part(body, 0x326c7b, [0.54, 0.62, 0.28], [0, 1.03, 0]);
  for (const side of [-1, 1]) {
    const leg = joint(body, side < 0 ? "left-leg" : "right-leg", side * 0.145, 0.725, 0);
    part(leg, 0x3a5056, [0.23, 0.57, 0.25], [0, -0.285, 0]);
    part(leg, 0x413c34, [0.27, 0.17, 0.38], [0, -0.64, 0.045]);
    const arm = joint(body, side < 0 ? "left-arm" : "right-arm", side * 0.36, 1.3, 0);
    part(arm, 0x326c7b, [0.19, 0.32, 0.26], [0, -0.16, 0]);
    part(arm, 0xd3a778, [0.17, 0.34, 0.23], [0, -0.47, 0]);
  }
  part(body, 0x8b6847, [0.54, 0.085, 0.29], [0, 0.755, 0.005]);
  part(body, 0xbca46d, [0.095, 0.075, 0.025], [0, 0.755, 0.165]);
  const head = joint(body, "head", 0, 1.335, 0);
  part(head, 0xd8ae82, [0.41, 0.4, 0.37], [0, 0.2, 0]);
  part(head, 0x584332, [0.43, 0.1, 0.39], [0, 0.41, -0.015]);
  part(head, 0x584332, [0.43, 0.25, 0.075], [0, 0.275, -0.19]);
  for (const side of [-1, 1])
    part(head, 0x2b3230, [0.045, 0.045, 0.018], [side * 0.105, 0.225, 0.193]);
  part(head, 0xb4885e, [0.08, 0.065, 0.035], [0, 0.155, 0.202]);
  return group;
}

/** The same pose driver is used by the player and both walking NPC models. */
export function updatePlayerAvatar(model, options) {
  return animateHumanoid(model, options);
}
