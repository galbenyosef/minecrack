import test from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "../src/inventory.js";
test("inventory preserves quantities across assignment, use and serialization", () => {
  const a = new Inventory();
  a.add("cuir", 5);
  a.slots[8] = "cuir";
  assert.equal(a.counts.cuir, 5);
  assert(a.craft("furry"));
  assert.equal(a.counts.cuir, 0);
  assert.equal(a.counts.furry, 1);
  assert(!a.craft("furry"));
  assert.equal(a.counts.furry, 1);
  const b = new Inventory();
  assert(b.restore(a.serialize(), new Set([...Object.keys(a.counts)])));
  assert.deepEqual(b.serialize(), a.serialize());
});
test("invalid save values cannot create negative or unknown quantities", () => {
  const i = new Inventory();
  i.restore(
    {
      counts: { wood: -2, stone: Infinity, ore: 3, arbitrary: 10 },
      slots: ["arbitrary", "ore"],
      selected: 25,
    },
    new Set(["wood", "stone", "ore"]),
  );
  assert.deepEqual(i.counts, { ore: 3 });
  assert.equal(i.slots.length, 9);
  assert.equal(i.slots[0], null);
  assert.equal(i.selected, 8);
});
test("consumption is atomic for insufficient stacks", () => {
  const i = new Inventory();
  const n = i.counts.chocolatine;
  assert(!i.remove("chocolatine", n + 1));
  assert.equal(i.counts.chocolatine, n);
  assert(i.remove("chocolatine"));
  assert.equal(i.counts.chocolatine, n - 1);
});
