import * as THREE from "three";

/** A 512px atlas with deliberate 32px pixel-art, never filtered into blurry noise. */
export const TEXTURE_SIZE = 512;
export const TEXEL_GRID = 32;

const PALETTES = {
  grass: ["#659b3a", "#588833", "#76aa42", "#82b84c", "#477b2c"],
  dirt: ["#855e40", "#714d35", "#9c714b", "#ab8054", "#60452f"],
  stone: ["#88887e", "#74766e", "#9c9b8e", "#aeaa9b", "#61675f"],
  sand: ["#d4c68d", "#c2b27b", "#e7d99f", "#eee2b0", "#b5a574"],
  wood: ["#76512e", "#583c24", "#92653b", "#a47b46", "#453523"],
  birch: ["#e4e0ca", "#c6c5b2", "#f4edd6", "#fcf5df", "#92998a"],
  leaves: ["#487d2e", "#2e5c26", "#63973b", "#79a948", "#214c22"],
  pine: ["#386641", "#234d37", "#4d7b43", "#67914e", "#1e4030"],
  ore: ["#858b83", "#6c776f", "#a0a498", "#b0b0a3", "#59675f"],
  water: ["#397bac", "#3673a4", "#498bb6", "#68a2c4", "#2d6c9b"],
  lucky: ["#ebbb25", "#d29616", "#f7d44b", "#ffe976", "#9a6414"],
  bedrock: ["#50564e", "#363d39", "#686d62", "#7c7d70", "#252e2b"],
};

function seeded(seed) {
  let state = seed | 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function paintPixelTexture(type, side = false) {
  if (typeof document === "undefined") return null;
  const pixels = document.createElement("canvas");
  pixels.width = pixels.height = TEXEL_GRID;
  const ctx = pixels.getContext("2d");
  const random = seeded([...type].reduce((s, c) => s * 31 + c.charCodeAt(0), side ? 31 : 17));
  const int = (n) => Math.floor(random() * n);
  const palette = PALETTES[side && type === "grass" ? "dirt" : type] || PALETTES.grass;
  const rect = (color, x, y, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  };
  const scatter = (count, colors, maxWidth = 3, maxHeight = 2) => {
    for (let i = 0; i < count; i++) {
      const x = int(32), y = int(32), w = 1 + int(maxWidth), h = 1 + int(maxHeight);
      rect(colors[int(colors.length)], x, y, w, h);
    }
  };
  rect(palette[0], 0, 0, 32, 32);

  // Each patch is a coherent mineral, soil clod or grass clump, not sub-pixel grain.
  if (type === "dirt" || (type === "grass" && side)) {
    for (let i = 0; i < 42; i++) {
      const x = int(32), y = int(32), w = 2 + int(4), h = 1 + int(3);
      rect(palette[1], x, y + 1, w, h);
      rect(palette[2], x, y, Math.max(1, w - 1), 1);
      if (i % 4 === 0) rect(palette[3], x + 1, y, 1, 1);
    }
    for (let i = 0; i < 10; i++) {
      const x = int(32), y = int(32);
      rect("#756b55", x, y, 2, 2);
      rect("#a2997b", x, y, 2, 1);
    }
  }

  if (type === "grass") {
    if (side) {
      rect("#466c2b", 0, 0, 32, 6);
      for (let x = 0; x < 32; x += 2) {
        const length = 4 + int(4);
        rect("#466c2b", x, 0, 2, length + 1);
        rect(PALETTES.grass[1 + int(3)], x, 0, 2, length);
      }
      rect("#76a545", 0, 0, 32, 1);
      for (let i = 0; i < 19; i++) rect("#83b34d", int(32), int(4), 2, 1);
    } else {
      for (let i = 0; i < 62; i++) {
        const x = int(32), y = int(32), w = 2 + int(3);
        rect(palette[1], x, y + 1, w, 2);
        rect(palette[2 + int(2)], x + 1, y, w - 1, 1);
        if (i % 3 === 0) rect(palette[4], x, y + 3, 2, 1);
      }
      scatter(32, [palette[0], palette[2]], 2, 1);
    }
  } else if (type === "wood" || type === "birch") {
    if (side && type === "wood") {
      // Offset, broken vertical strips make bark; the end grain has a separate map.
      for (let x = 0; x < 32; x += 4) {
        rect(palette[1], x, 0, 1, 32);
        for (let y = -2; y < 32; y += 6 + int(5)) {
          const height = 4 + int(8);
          rect(palette[2], x + 1, y, 2, height);
          rect(palette[3], x + 1, y, 1, height - 1);
          rect(palette[4], x + 3, y + 3, 1, height - 2);
        }
      }
      for (let i = 0; i < 5; i++) {
        const x = 2 + int(27), y = 2 + int(27);
        rect(palette[1], x, y, 3, 4);
        rect(palette[3], x + 1, y + 1, 1, 2);
      }
    } else if (side) {
      scatter(22, [palette[1], palette[2]], 4, 2);
      for (let i = 0; i < 19; i++) {
        const x = int(32), y = int(32), w = 2 + int(6);
        rect("#586053", x, y, w, 1);
        rect("#303d33", x + 1, y + 1, w - 1, 1 + int(2));
        if (i % 3 === 0) rect("#303d33", x + w - 2, y - 1, 1, 2);
        rect("#f8f1d8", x, y + 3, w, 1);
      }
    } else {
      const rings = type === "birch"
        ? ["#d7bd82", "#b99e69", "#edd69b", "#cab17a"]
        : ["#b58b50", "#896339", "#c9a066", "#a77b46"];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const radius = Math.max(Math.abs(x - 15), Math.abs(y - 16));
        const ring = (radius + (x > y + 7 ? 1 : 0)) % 4;
        rect(radius > 13 ? palette[1] : rings[ring], x, y);
      }
      rect(rings[1], 14, 14, 3, 4);
      rect(rings[0], 15, 15, 1, 2);
    }
  } else if (type === "leaves" || type === "pine") {
    // Branch silhouettes sit under overlapping stepped leaf clusters.
    rect(palette[4], 14, 0, 3, 32);
    for (let y = 3; y < 32; y += 7) {
      for (let s = 0; s < 7; s++) {
        rect(palette[4], 15 - s, y + s, 2, 2);
        rect(palette[4], 16 + s, y + s, 2, 2);
      }
    }
    for (let i = 0; i < 57; i++) {
      const x = int(32), y = int(32), w = type === "pine" ? 2 + int(3) : 3 + int(4);
      rect(palette[1], x, y + 1, w, 3);
      rect(palette[2], x + 1, y, w - 1, 2);
      rect(palette[3], x + 1, y, 1 + int(2), 1);
      if (type === "pine") rect(palette[2], x + w, y + 2, 1, 2);
    }
    // Small angular openings, with alpha test (no translucent sorting or blurry fringe).
    for (let i = 0; i < 22; i++) {
      const x = int(32), y = int(32);
      ctx.clearRect(x, y, 1 + int(2), 1 + int(2));
    }
  } else if (type === "stone" || type === "ore" || type === "bedrock") {
    for (let i = 0; i < 31; i++) {
      const x = int(32), y = int(32), w = 3 + int(6), h = 2 + int(4);
      rect(palette[1], x, y + 1, w, h);
      rect(palette[2], x, y, w - 1, Math.max(1, h - 1));
      rect(palette[3], x + 1, y, Math.max(1, w - 3), 1);
      if (i % 3 === 0) rect(palette[4], x + 2, y + h, w - 1, 1);
    }
    for (let i = 0; i < 9; i++) {
      const x = int(32), y = int(32);
      rect(palette[1], x, y, 4, 1);
      rect(palette[4], x + 3, y + 1, 3, 1);
      rect(palette[2], x + 4, y + 2, 2, 1);
    }
    if (type === "ore") {
      for (const [x, y, w] of [[4, 5, 4], [18, 3, 3], [12, 16, 5], [25, 21, 4], [3, 26, 3], [23, 10, 3]]) {
        rect("#365759", x - 1, y, w + 2, 4);
        rect("#53a9ac", x, y, w, 3);
        rect("#9be7da", x, y, w - 1, 1);
        rect("#70c7c2", x + 1, y + 1, 1, 1);
        rect("#38797e", x + 1, y + 3, w - 1, 1);
      }
    }
  } else if (type === "sand") {
    scatter(55, [palette[1], palette[2], palette[2]], 3, 1);
    scatter(14, [palette[3], palette[4]], 1, 1);
  } else if (type === "water") {
    for (let i = 0; i < 18; i++) {
      const x = int(32), y = int(32), w = 3 + int(6);
      rect(palette[1], x, y, w, 2);
      rect(palette[2], x + 1, y, w - 1, 1);
      rect(palette[3], x + 2, y + 1, Math.max(1, w - 4), 1);
    }
  } else if (type === "lucky") {
    rect(palette[4], 0, 0, 32, 32);
    rect(palette[2], 1, 1, 30, 30);
    rect(palette[1], 2, 2, 28, 28);
    rect(palette[0], 3, 3, 26, 26);
    rect(palette[3], 3, 3, 26, 1);
    rect(palette[3], 3, 3, 1, 26);
    for (const x of [4, 25]) for (const y of [4, 25]) {
      rect("#946b21", x, y, 3, 3);
      rect("#fff5b4", x, y, 2, 2);
    }
    // Original chunky pixel glyph: no anti-aliased system font dependency.
    const glyph = ["011110", "110011", "000011", "000110", "001100", "001100", "000000", "001100"];
    for (const [color, shift] of [["#aa7915", 1], ["#fff5bd", 0]]) {
      glyph.forEach((row, y) => [...row].forEach((bit, x) => {
        if (bit === "1") rect(color, 10 + x * 2 + shift, 8 + y * 2 + shift, 2, 2);
      }));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TEXTURE_SIZE;
  const output = canvas.getContext("2d");
  output.imageSmoothingEnabled = false;
  output.drawImage(pixels, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.anisotropy = 1;
  texture.name = `Minecrack / ${type}${side ? " side" : " top"} / 512 pixel HD`;
  return texture;
}

export function createTerrainMaterials() {
  const materials = {};
  for (const type of Object.keys(PALETTES)) {
    const top = paintPixelTexture(type);
    const side = ["grass", "wood", "birch", "lucky"].includes(type)
      ? paintPixelTexture(type, true) : top;
    const base = {
      roughness: 1,
      metalness: 0,
      flatShading: true,
      vertexColors: true,
      color: top ? "#ffffff" : PALETTES[type][0],
    };
    if (type === "water") {
      base.transparent = true;
      base.opacity = 0.76;
      base.roughness = 0.85;
      base.depthWrite = false;
    }
    if (type === "leaves" || type === "pine") base.alphaTest = 0.5;
    if (type === "lucky") {
      base.emissive = "#dca524";
      base.emissiveIntensity = 0.08;
    }
    const sideMaterial = new THREE.MeshStandardMaterial({ ...base, map: side });
    const topMaterial = new THREE.MeshStandardMaterial({ ...base, map: top });
    sideMaterial.name = `${type}-side`;
    topMaterial.name = `${type}-top`;
    materials[type] = [sideMaterial, topMaterial, sideMaterial];
  }
  return materials;
}

/** Crossed cutout sprites remain anchored to their supporting grass block. */
export function createPlantMaterial(kind = "grass") {
  let texture = null;
  if (typeof document !== "undefined") {
    const pixels = document.createElement("canvas");
    pixels.width = pixels.height = 32;
    const ctx = pixels.getContext("2d");
    const rect = (color, x, y, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    if (kind === "grass") {
      for (const [x, y, h] of [[7, 17, 15], [13, 8, 24], [18, 14, 18], [23, 19, 13]]) {
        rect("#3b6c28", x, y + 3, 3, h - 3);
        rect("#76a53e", x, y, 2, h);
        rect("#9abc58", x, y, 1, Math.floor(h * 0.65));
        rect("#5c8e32", x - 2, y + 7, 2, 2);
        rect("#5c8e32", x - 3, y + 4, 1, 4);
      }
    } else {
      rect("#467d2d", 15, 11, 2, 21);
      rect("#73a23d", 16, 12, 1, 20);
      rect("#508932", 11, 23, 4, 2);
      rect("#609e38", 9, 21, 3, 2);
      rect("#508932", 17, 19, 4, 2);
      rect("#74a645", 20, 17, 3, 2);
      const petal = kind === "poppy" ? "#df4533" : "#f3e8b5";
      const light = kind === "poppy" ? "#ff7151" : "#fff8dd";
      rect(petal, 11, 7, 10, 7);
      rect(petal, 13, 5, 6, 11);
      rect(light, 12, 7, 3, 2);
      rect(light, 15, 5, 3, 2);
      rect(kind === "poppy" ? "#713b22" : "#e3ac34", 15, 9, 3, 3);
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = TEXTURE_SIZE;
    const output = canvas.getContext("2d");
    output.imageSmoothingEnabled = false;
    output.drawImage(pixels, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.name = `Minecrack / ${kind} cutout / 512 pixel HD`;
  }
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? "#ffffff" : "#68943c",
    side: THREE.DoubleSide,
    alphaTest: 0.5,
    roughness: 1,
  });
  material.name = `plant-${kind}`;
  return material;
}

export function disposeTerrainMaterials(materials) {
  const seenMaterials = new Set(), seenTextures = new Set();
  for (const group of Object.values(materials)) for (const material of group) {
    if (seenMaterials.has(material)) continue;
    seenMaterials.add(material);
    if (material.map && !seenTextures.has(material.map)) {
      seenTextures.add(material.map);
      material.map.dispose();
    }
    material.dispose();
  }
}
