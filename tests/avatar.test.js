import test from "node:test";
import assert from "node:assert/strict";
import { createPlayerAvatar, updatePlayerAvatar } from "../src/avatar.js";
import { createItemModel } from "../src/items.js";
import { animateGnome, animateRadio, getAnimationRig } from "../src/animation-rig.js";

test("both player skins and NPCs swing around hips and shoulders, and stop in their idle pose", () => {
  for (const model of [createPlayerAvatar(), createPlayerAvatar(true), createItemModel("urssaf")]) {
    const rig = getAnimationRig(model);
    for (const name of ["left-leg", "right-leg", "left-arm", "right-arm", "head"])
      assert.ok(rig.joints[name], `${model.name}: ${name} pivot`);
    const hip = rig.joints["left-leg"].position.clone();
    const time = Math.PI / 18;
    updatePlayerAvatar(model, { time, moving: true, speed: 3, grounded: true });
    assert.ok(rig.joints["left-leg"].rotation.x > 0.6);
    assert.ok(rig.joints["right-leg"].rotation.x < -0.6);
    assert.ok(rig.joints["left-arm"].rotation.x < -0.5);
    assert.ok(rig.joints["right-arm"].rotation.x > 0.5);
    assert.deepEqual(rig.joints["left-leg"].position.toArray(), hip.toArray(), "hip stays attached to torso");
    updatePlayerAvatar(model, { time: 0, moving: false, speed: 0, grounded: true });
    for (const name of ["left-leg", "right-leg", "left-arm", "right-arm"])
      assert.ok(rig.joints[name].rotation.toArray().slice(0, 3).every((angle, i) => Math.abs(angle - rig.rest[name].rotation.toArray()[i]) < 1e-12), `${name}: no frozen gait`);
  }
});

test("attack and airborne poses visibly move limbs and reset on landing", () => {
  const model = createPlayerAvatar();
  const rig = updatePlayerAvatar(model, { time: 0, attack: 0.5 });
  assert.ok(rig.joints["right-arm"].rotation.x < -1.7, "punch travels forward from the shoulder");
  updatePlayerAvatar(model, { time: 0, grounded: false, jump: 1 });
  assert.ok(rig.joints["left-leg"].rotation.x < -0.6, "jump tucks one leg");
  assert.ok(rig.joints["right-leg"].rotation.x > 0.4);
  updatePlayerAvatar(model, { time: 0, grounded: true });
  assert.equal(rig.joints["left-leg"].rotation.x, 0);
  assert.equal(rig.joints["right-arm"].rotation.x, 0);
});

test("changing walk/run speed preserves gait phase while increasing stride and cadence", () => {
  const model = createPlayerAvatar();
  const rig = updatePlayerAvatar(model, { time: 63, moving: true, speed: 3.79 });
  const before = rig.joints["left-leg"].rotation.x;
  const phaseBefore = rig.gait.phase;
  updatePlayerAvatar(model, { time: 63 + 1 / 60, moving: true, speed: 3.81 });
  assert.ok(Math.abs(rig.joints["left-leg"].rotation.x - before) < 0.16, "crossing the former speed threshold cannot snap to an unrelated world-time phase");
  assert.ok(rig.gait.phase > phaseBefore && rig.gait.phase - phaseBefore < 0.2);
  const phaseWalking = rig.gait.phase;
  updatePlayerAvatar(model, { time: 63 + 2 / 60, moving: true, speed: 4.6 });
  const walkIncrement = rig.gait.phase - phaseWalking;
  const phaseRunning = rig.gait.phase;
  updatePlayerAvatar(model, { time: 63 + 3 / 60, moving: true, speed: 6.9 });
  assert.ok(rig.gait.phase - phaseRunning > walkIncrement * 1.2, "real player sprint has a faster cadence than walking");
});

test("animation references resolve inside each clone without altering siblings or templates", () => {
  const a = createItemModel("furry"), b = createItemModel("furry");
  const first = getAnimationRig(a), second = getAnimationRig(b);
  assert.notEqual(first.joints["left-arm"], second.joints["left-arm"]);
  updatePlayerAvatar(a, { time: 0.2, moving: true, speed: 3, attack: 0.5 });
  assert.equal(second.joints["right-arm"].rotation.x, 0);
  const third = getAnimationRig(createItemModel("furry"));
  assert.equal(third.joints["right-arm"].rotation.x, 0);
  assert.doesNotThrow(() => a.clone(true), "animation does not introduce cyclic userData");
});

test("gnome greetings nod and bounce once, radio pulse returns exactly to its resting geometry", () => {
  const gnome = createItemModel("gnome");
  const rig = animateGnome(gnome, 0.2, 0.2);
  assert.ok(Math.abs(rig.joints.head.rotation.x) > 0.05);
  assert.ok(rig.joints["motion-root"].position.y > 0.03);
  animateGnome(gnome, 3, 3);
  assert.ok(Math.abs(rig.joints.head.rotation.x) < 1e-12);
  assert.equal(rig.joints["motion-root"].position.y, 0);
  const radio = createItemModel("radio");
  const radioRig = animateRadio(radio, Math.PI / 16);
  assert.ok(radioRig.joints.indicator.scale.x > 1.7);
  assert.ok(radioRig.joints.speaker.position.z > radioRig.rest.speaker.position.z + 0.01);
  animateRadio(radio, 10, false);
  assert.deepEqual(radioRig.joints.indicator.scale.toArray(), radioRig.rest.indicator.scale.toArray());
  assert.deepEqual(radioRig.joints.speaker.position.toArray(), radioRig.rest.speaker.position.toArray());
});
