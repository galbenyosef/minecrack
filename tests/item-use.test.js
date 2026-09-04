import test from "node:test";
import assert from "node:assert/strict";
import { ItemUse, ITEM_USES, getItemUse } from "../src/item-use.js";

test("hold descriptors preserve the three consumables' promised effects", () => {
  assert.deepEqual(Object.keys(ITEM_USES), ["chocolatine", "cb12", "impots"]);
  assert.equal(ITEM_USES.chocolatine.duration, 1.25);
  assert.equal(ITEM_USES.chocolatine.hunger, 32);
  assert.equal(ITEM_USES.chocolatine.health, 22);
  assert.equal(ITEM_USES.cb12.duration, 1.6);
  assert.equal(ITEM_USES.cb12.hunger, 65);
  assert.equal(ITEM_USES.cb12.health, 35);
  assert.equal(ITEM_USES.impots.duration, 0.9);
  assert.equal(ITEM_USES.impots.buffDuration, 18);
  assert.equal(ITEM_USES.impots.kind, "read");
  assert.ok(Object.isFrozen(ITEM_USES) && Object.isFrozen(ITEM_USES.cb12));
  assert.equal(getItemUse("toString"), null);
});

test("full hunger, missing quantity, and non-consumable items cannot start a hold", () => {
  const use = new ItemUse();
  assert.equal(use.begin("chocolatine", { count: 2, canUse: false }), false);
  for (const count of [0, -1, NaN, Infinity])
    assert.equal(use.begin("chocolatine", { count, canUse: true }), false);
  assert.equal(use.begin("pickaxe", { count: 1 }), false);
  assert.equal(use.active, false);
  assert.equal(use.update(10).completedId, null);
});

test("one completed hold emits one transaction and locks the unchanged item count", () => {
  const use = new ItemUse();
  assert.equal(use.begin("chocolatine", { count: 3 }), true);
  let result = use.update(0.5, { held: true, id: "chocolatine", count: 3 });
  assert.equal(result.completedId, null);
  assert.equal(result.progress, 0.4);
  assert.equal(use.begin("chocolatine", { count: 3 }), true, "repeated begin during a hold cannot restart its clock");
  result = use.update(0.75, { held: true, id: "chocolatine", count: 3 });
  assert.equal(result.completedId, "chocolatine");
  assert.equal(result.progress, 1);
  assert.equal(result.active, false);
  for (let i = 0; i < 10; i++)
    assert.equal(use.update(2, { held: true, id: "chocolatine", count: 3 }).completedId, null);
  assert.equal(use.begin("chocolatine", { count: 3 }), false, "stale inventory cannot consume twice");
  assert.equal(use.begin("chocolatine", { count: 2 }), true, "the game committed the previous transaction");
  assert.equal(use.update(1.25, { held: true, id: "chocolatine", count: 2 }).completedId, "chocolatine");
});

test("release, changing item, depleted count, or becoming ineligible cancel without consuming", () => {
  for (const change of [
    { held: false, id: "cb12", count: 1 },
    { held: true, id: "chocolatine", count: 1 },
    { held: true, id: "cb12", count: 0 },
    { held: true, id: "cb12", count: 1, canUse: false },
  ]) {
    const use = new ItemUse();
    use.begin("cb12", { count: 1 });
    use.update(0.8, { held: true, id: "cb12", count: 1 });
    const result = use.update(20, change);
    assert.equal(result.completedId, null);
    assert.equal(result.progress, 0);
    assert.equal(use.active, false);
    assert.equal(use.update(20, { held: true, id: "cb12", count: 1 }).completedId, null);
  }
});

test("a large frame finishes at most one item, while invalid frame deltas cannot advance use", () => {
  const use = new ItemUse();
  use.begin("impots", { count: 4 });
  for (const dt of [-4, NaN, Infinity]) {
    const result = use.update(dt);
    assert.equal(result.progress, 0);
    assert.equal(result.completedId, null);
  }
  const result = use.update(100);
  assert.equal(result.completedId, "impots");
  assert.equal(result.justBite, false);
  assert.equal(use.update(100).completedId, null);
  use.cancel();
  assert.equal(use.begin("impots", { count: 4 }), true, "an explicit release/cancel permits a fresh intentional use");
});

test("food emits five bite events and completes at the same time at 30 and 120 FPS", () => {
  for (const fps of [30, 120]) {
    const use = new ItemUse();
    use.begin("cb12", { count: 1 });
    let bites = 0, completions = 0;
    for (let frame = 0; frame < fps * 1.6; frame++) {
      const result = use.update(1 / fps);
      bites += Number(result.justBite);
      completions += Number(result.completedId === "cb12");
      if (frame < fps * 1.6 - 1) assert.equal(result.completedId, null);
    }
    assert.equal(bites, 5);
    assert.equal(completions, 1);
  }
});
