import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Box3, Vector3 } from "three";
import {
  ITEMS,
  createItemModel,
  getItem,
  getItemTexture,
} from "../src/items.js";

const expected = [
  "chocolatine",
  "cuir",
  "poche",
  "impots",
  "journal",
  "urssaf",
  "nucleaire",
  "b2",
  "socialiste",
  "cb12",
  "zerator",
  "gnome",
  "megaphone",
  "tgv",
  "furry",
  "radio",
];
const assetPath = (name) =>
  fileURLToPath(new URL(`../public/assets/items/${name}`, import.meta.url));

test("the complete Lucky catalogue contains exactly the 16 promised unique drops", () => {
  assert.deepEqual(
    ITEMS.map((item) => item.id),
    expected,
  );
  assert.equal(new Set(ITEMS.map((item) => item.id)).size, 16);
  for (const item of ITEMS) {
    assert.equal(getItem(item.id), item);
    assert.ok(item.name && item.description && item.kind && item.color);
    assert.equal(item.icon, `/assets/items/${item.id}.png`);
  }
});

test("every icon and material map really is a 512 × 512 PNG", () => {
  for (const id of expected)
    for (const suffix of ["", "-texture"]) {
      const bytes = readFileSync(assetPath(`${id}${suffix}.png`));
      assert.equal(
        bytes.subarray(1, 4).toString(),
        "PNG",
        `${id}${suffix}: signature`,
      );
      assert.equal(bytes.subarray(12, 16).toString(), "IHDR");
      assert.equal(bytes.readUInt32BE(16), 512, `${id}${suffix}: width`);
      assert.equal(bytes.readUInt32BE(20), 512, `${id}${suffix}: height`);
      assert.ok(bytes.length > 500, `${id}${suffix}: populated image`);
    }
});

test("all sixteen models have textured meshes, distinct geometry, a grounded origin, and unit bounds", () => {
  const fingerprints = [];
  for (const id of expected) {
    const model = createItemModel(id);
    assert.equal(model.userData.itemId, id);
    assert.equal(model.parent, null, `${id}: no scene side effects`);
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    assert.ok(Math.abs(bounds.min.y) < 1e-6, `${id}: grounded origin`);
    assert.ok(
      Math.abs(Math.max(...size.toArray()) - 1) < 1e-6,
      `${id}: unit normalized`,
    );
    assert.ok(
      size.toArray().every((n) => n > 0 && Number.isFinite(n)),
      `${id}: valid bounds`,
    );
    let textured = 0;
    const parts = [];
    model.traverse((child) => {
      if (!child.isMesh) return;
      if (child.material.map) textured++;
      assert.ok(child.geometry.attributes.position.count >= 3);
      parts.push([
        child.geometry.type,
        child.geometry.attributes.position.count,
        ...child.position.toArray(),
      ]);
    });
    assert.ok(textured > 0, `${id}: material texture applied`);
    fingerprints.push(JSON.stringify(parts));
  }
  assert.equal(
    new Set(fingerprints).size,
    16,
    "each item has its own geometry composition",
  );
});

test("model clones isolate transforms while reusing expensive texture and mesh resources", () => {
  const a = createItemModel("radio");
  const b = createItemModel("radio");
  assert.notEqual(a, b);
  assert.notEqual(a.children[0], b.children[0]);
  assert.equal(
    a.children[0].children[0].geometry,
    b.children[0].children[0].geometry,
  );
  assert.equal(
    a.children[0].children[0].material,
    b.children[0].children[0].material,
  );
  a.position.set(8, 4, 2);
  assert.deepEqual(b.position.toArray(), [0, 0, 0]);
  assert.equal(getItemTexture("radio"), getItemTexture("radio"));
});

test("the integrated source images and generated object decals are available locally", () => {
  for (const file of [
    "references/journal-cover.jpeg",
    "references/zerator-logo.png",
    "references/socialiste-logo.png",
    "references/zevent-logo.svg",
    "impots-label.png",
    "urssaf-label.png",
    "nucleaire-label.png",
    "socialiste-label.png",
    "cb12-label.png",
    "radio-label.png",
  ]) {
    assert.ok(existsSync(assetPath(file)), file);
  }
});
