import * as THREE from "three";
import { joint } from "./animation-rig.js";

/** Lucky drops. All inventory art and material maps are native 512 × 512 PNGs. */
export const ITEMS = [
  {
    id: "chocolatine",
    name: "Chocolatine",
    description:
      "Rend 32 points de faim et 22 points de vie. La vraie recette du Sud-Ouest.",
    color: "#e5aa59",
    kind: "consommable",
  },
  {
    id: "cuir",
    name: "Cuir",
    description:
      "Matériau de base : assemblez 5 cuirs pour fabriquer le costume de Furry.",
    color: "#aa7149",
    kind: "matériau",
  },
  {
    id: "poche",
    name: "Fuck de poche",
    description:
      "Arme de mêlée souple : frappe au contact et repousse légèrement.",
    color: "#edc0d2",
    kind: "arme",
  },
  {
    id: "impots",
    name: "Réduction d’impôts",
    description:
      "Une bouffée de liberté : vitesse et invulnérabilité temporaires.",
    color: "#97d9a2",
    kind: "consommable",
  },
  {
    id: "journal",
    name: "Journal d’un prisonnier",
    description:
      "Le livre de Nicolas Sarkozy. Se lance et inflige des dégâts de zone à l’impact.",
    color: "#f0e5c5",
    kind: "projectile",
  },
  {
    id: "urssaf",
    name: "Agent de l’URSSAF",
    description:
      "Un contrôleur hostile apparaît. Ses coups prélèvent vos ressources.",
    color: "#a3bed3",
    kind: "événement",
  },
  {
    id: "nucleaire",
    name: "Centrale nucléaire portable",
    description:
      "Posez-la pour un faisceau permanent. Sa destruction provoque une forte explosion.",
    color: "#c6dc84",
    kind: "bloc",
  },
  {
    id: "b2",
    name: "B2",
    description:
      "Un bombardier survole le point visé et y largue ses explosifs.",
    color: "#849bad",
    kind: "événement",
  },
  {
    id: "socialiste",
    name: "Carte du Parti Socialiste",
    description:
      "Dans l’inventaire, partage équitablement vos ressources avec les PNJ proches.",
    color: "#f188a6",
    kind: "passif",
  },
  {
    id: "cb12",
    name: "Commande CB12",
    description:
      "Votre ticket de commande McDonald’s. Utilisez-le pour récupérer une collation.",
    color: "#efd179",
    kind: "consommable",
  },
  {
    id: "zerator",
    name: "Œuf de ZeratoR",
    description:
      "Un œuf aux couleurs de ZeratoR. Faites éclore un compagnon en le posant.",
    color: "#a3db60",
    kind: "invocation",
  },
  {
    id: "gnome",
    name: "Gnome",
    description:
      "Une petite sentinelle de jardin qui lance des « hou » à votre passage.",
    color: "#f0836d",
    kind: "bloc",
  },
  {
    id: "megaphone",
    name: "Mégaphone du Zevent",
    description: "Une onde sonore en cône repousse les ennemis devant vous.",
    color: "#a9da73",
    kind: "arme",
  },
  {
    id: "tgv",
    name: "Klaxon du TGV",
    description:
      "Une puissante double trompe fait fuir les hostiles à longue portée.",
    color: "#d4be72",
    kind: "outil",
  },
  {
    id: "furry",
    name: "Costume de Furry",
    description:
      "Une armure complète avec oreilles et pattes : protection et saut amplifié.",
    color: "#edaa65",
    kind: "armure",
  },
  {
    id: "radio",
    name: "Radio de Portal",
    description:
      "Radio portable et posable. Boucle originale par défaut ; importez votre audio Portal dans les réglages.",
    color: "#d1ddbd",
    kind: "bloc",
  },
].map((item) =>
  Object.freeze({ ...item, icon: `/assets/items/${item.id}.png` }),
);

const itemsById = new Map(ITEMS.map((item) => [item.id, item]));
const textures = new Map();
const materials = new Map();
const geometries = new Map();
const templates = new Map();
export const getItem = (id) => itemsById.get(id);

function loadTexture(path) {
  if (textures.has(path)) return textures.get(path);
  let texture;
  if (typeof document === "undefined") {
    texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.needsUpdate = true;
  } else {
    texture = new THREE.TextureLoader().load(path);
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  textures.set(path, texture);
  return texture;
}

export function getItemTexture(id) {
  return loadTexture(
    `/assets/items/${itemsById.has(id) ? id : "cuir"}-texture.png`,
  );
}

function mat(color, id = null, options = {}) {
  const key = JSON.stringify([color, id, options]);
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.76,
        metalness: 0.02,
        flatShading: true,
        ...(id ? { map: getItemTexture(id) } : {}),
        ...options,
      }),
    );
  return materials.get(key);
}

function imageMat(path) {
  const key = `image:${path}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        map: loadTexture(path),
        roughness: 0.85,
        metalness: 0,
        flatShading: true,
        side: THREE.DoubleSide,
        transparent: path.endsWith(".png") || path.endsWith(".svg"),
        alphaTest: 0.05,
      }),
    );
  return materials.get(key);
}

function geometry(type, args) {
  const key = JSON.stringify([type, args]);
  if (!geometries.has(key)) geometries.set(key, new THREE[type](...args));
  return geometries.get(key);
}

function mesh(g, geo, material, x = 0, y = 0, z = 0, rotation = null) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function box(g, w, h, d, material, x = 0, y = h / 2, z = 0, rotation = null) {
  return mesh(
    g,
    geometry("BoxGeometry", [w, h, d]),
    material,
    x,
    y,
    z,
    rotation,
  );
}
function sphere(
  g,
  radius,
  material,
  x = 0,
  y = radius,
  z = 0,
  scale = [1, 1, 1],
) {
  const m = mesh(
    g,
    geometry("SphereGeometry", [radius, 8, 6]),
    material,
    x,
    y,
    z,
  );
  m.scale.set(...scale);
  return m;
}
function cylinder(
  g,
  top,
  bottom,
  h,
  material,
  x = 0,
  y = h / 2,
  z = 0,
  rotation = null,
  open = false,
) {
  return mesh(
    g,
    geometry("CylinderGeometry", [top, bottom, h, 8, 1, open]),
    material,
    x,
    y,
    z,
    rotation,
  );
}
function ring(g, radius, tube, material, x, y, z, rotation = null) {
  return mesh(
    g,
    geometry("TorusGeometry", [radius, tube, 4, 8]),
    material,
    x,
    y,
    z,
    rotation,
  );
}
function label(g, path, width, height, x, y, z, rotation = null) {
  return mesh(
    g,
    geometry("PlaneGeometry", [width, height]),
    imageMat(path),
    x,
    y,
    z,
    rotation,
  );
}
function shapeMesh(g, coordinates, depth, material) {
  const shape = new THREE.Shape();
  coordinates.forEach(([x, y], i) =>
    i ? shape.lineTo(x, y) : shape.moveTo(x, y),
  );
  shape.closePath();
  const key = JSON.stringify(["extruded", coordinates, depth]);
  if (!geometries.has(key))
    geometries.set(
      key,
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }),
    );
  return mesh(g, geometries.get(key), material);
}

const cream = () => mat("#f0e5c6");
const black = () => mat("#1a2830");
const gold = () => mat("#c7a35a", null, { metalness: 0.45, roughness: 0.48 });

function buildModel(id) {
  const g = new THREE.Group();
  const surface = mat("#ffffff", id);
  switch (id) {
    case "chocolatine": {
      box(g, 0.78, 0.32, 0.48, surface, 0, 0.22, 0);
      sphere(g, 0.26, surface, -0.24, 0.25, 0, [0.6, 0.8, 1]);
      sphere(g, 0.26, surface, 0.24, 0.25, 0, [0.6, 0.8, 1]);
      for (let i = 0; i < 7; i++) {
        cylinder(
          g,
          0.028,
          0.035,
          0.66,
          mat(i % 2 ? "#ebbc72" : "#ce903f"),
          0,
          0.365 + Math.sin(i * 0.5) * 0.015,
          -0.21 + i * 0.065,
          [0, 0, Math.PI / 2],
        );
      }
      for (const x of [-0.23, 0.23])
        box(g, 0.1, 0.1, 0.49, mat("#472718"), x, 0.2, 0.025);
      break;
    }
    case "cuir": {
      const leather = shapeMesh(
        g,
        [
          [-0.35, -0.34],
          [-0.1, -0.28],
          [0.03, -0.36],
          [0.3, -0.3],
          [0.27, -0.08],
          [0.38, 0.12],
          [0.22, 0.2],
          [0.26, 0.38],
          [0.05, 0.32],
          [-0.12, 0.4],
          [-0.24, 0.26],
          [-0.38, 0.18],
          [-0.27, -0.02],
        ],
        0.035,
        surface,
      );
      leather.rotation.x = -Math.PI / 2;
      leather.position.y = 0.05;
      for (let i = 0; i < 8; i++)
        box(
          g,
          0.035,
          0.012,
          0.02,
          mat("#e2b47a"),
          -0.24 + i * 0.067,
          0.072,
          0.25,
        );
      break;
    }
    case "poche": {
      const latex = mat("#ffffff", id, {
        roughness: 0.25,
        transparent: true,
        opacity: 0.9,
      });
      cylinder(g, 0.115, 0.135, 0.61, latex, 0, 0.39, 0);
      sphere(g, 0.116, latex, 0, 0.69, 0, [1, 0.9, 1]);
      cylinder(g, 0.029, 0.03, 0.09, latex, 0, 0.803, 0);
      sphere(g, 0.03, latex, 0, 0.85, 0);
      ring(g, 0.14, 0.032, mat("#e4a6bd"), 0, 0.075, 0, [Math.PI / 2, 0, 0]);
      ring(g, 0.132, 0.018, mat("#f7d2df"), 0, 0.108, 0, [Math.PI / 2, 0, 0]);
      break;
    }
    case "impots": {
      box(g, 0.6, 0.83, 0.022, surface, 0, 0.425, 0);
      label(g, "/assets/items/impots-label.png", 0.59, 0.82, 0, 0.425, 0.018);
      break;
    }
    case "journal": {
      box(g, 0.54, 0.83, 0.105, cream(), 0, 0.43, 0);
      for (const z of [-0.065, 0.065])
        box(g, 0.57, 0.855, 0.023, surface, 0, 0.43, z);
      box(g, 0.035, 0.855, 0.152, mat("#d4c49b"), -0.282, 0.43, 0);
      label(
        g,
        "/assets/items/references/journal-cover.jpeg",
        0.554,
        0.838,
        0,
        0.43,
        0.078,
      );
      for (let y = 0.05; y < 0.83; y += 0.026)
        box(g, 0.014, 0.002, 0.1, mat("#c3b896"), 0.276, y, 0);
      break;
    }
    case "urssaf": {
      const body = joint(g, "motion-root");
      for (const x of [-0.13, 0.13]) {
        const leg = joint(body, x < 0 ? "left-leg" : "right-leg", x, 0.4, 0);
        box(leg, 0.18, 0.35, 0.2, black(), 0, -0.175, 0);
        box(leg, 0.2, 0.105, 0.3, black(), 0, -0.345, 0.045);
      }
      box(body, 0.47, 0.42, 0.25, surface, 0, 0.57, 0);
      let leftArm;
      for (const side of [-1, 1]) {
        const arm = joint(body, side < 0 ? "left-arm" : "right-arm", side * 0.31, 0.755, 0);
        arm.rotation.z = side * 0.055;
        box(arm, 0.145, 0.35, 0.18, surface, 0, -0.165, 0);
        box(arm, 0.145, 0.11, 0.17, mat("#e0b38d"), 0, -0.395, 0);
        if (side < 0) leftArm = arm;
      }
      box(body, 0.13, 0.3, 0.018, cream(), 0, 0.62, 0.137);
      box(body, 0.042, 0.21, 0.025, mat("#c44b45"), 0, 0.58, 0.155, [0, 0, 0.03]);
      const head = joint(body, "head", 0, 0.795, 0);
      box(head, 0.3, 0.28, 0.27, mat("#e0b38d"), 0, 0.14, 0.005);
      box(head, 0.31, 0.073, 0.28, mat("#5b4531"), 0, 0.273, -0.007);
      for (const x of [-0.082, 0.082])
        box(head, 0.1, 0.041, 0.03, black(), x, 0.152, 0.15);
      box(head, 0.056, 0.015, 0.03, black(), 0, 0.152, 0.15);
      box(head, 0.077, 0.014, 0.012, mat("#805841"), 0, 0.066, 0.147);
      box(leftArm, 0.33, 0.25, 0.13, mat("#504737"), -0.03, -0.515, 0.12);
      ring(leftArm, 0.064, 0.014, gold(), -0.03, -0.355, 0.12);
      label(body, "/assets/items/urssaf-label.png", 0.2, 0.065, 0.12, 0.68, 0.137);
      break;
    }
    case "nucleaire": {
      box(g, 0.94, 0.11, 0.66, mat("#7f9289"), 0, 0.055, 0);
      for (const [x, z, h, r] of [
        [-0.2, 0, 0.7, 0.18],
        [0.24, -0.05, 0.47, 0.14],
      ]) {
        const pts = [
          new THREE.Vector2(r, 0),
          new THREE.Vector2(r * 0.8, h * 0.23),
          new THREE.Vector2(r * 0.57, h * 0.64),
          new THREE.Vector2(r * 0.68, h * 0.9),
          new THREE.Vector2(r * 0.88, h),
        ];
        const key = `tower:${h}`;
        if (!geometries.has(key))
          geometries.set(key, new THREE.LatheGeometry(pts, 8));
        mesh(g, geometries.get(key), surface, x, 0.1, z);
        cylinder(g, r * 0.81, r * 0.81, 0.018, black(), x, h + 0.087, z);
        ring(g, r * 0.85, 0.016, mat("#dce4d9"), x, h + 0.1, z, [
          Math.PI / 2,
          0,
          0,
        ]);
      }
      box(g, 0.27, 0.18, 0.25, surface, 0.2, 0.19, 0.2);
      label(
        g,
        "/assets/items/nucleaire-label.png",
        0.15,
        0.15,
        0.2,
        0.21,
        0.329,
      );
      sphere(
        g,
        0.042,
        mat("#c7fc87", null, { emissive: "#9edd62", emissiveIntensity: 1.6 }),
        -0.2,
        0.875,
        0,
      );
      g.userData.beacon = new THREE.Vector3(-0.2, 0.875, 0);
      break;
    }
    case "b2": {
      const wing = shapeMesh(
        g,
        [
          [0, -0.43],
          [0.73, 0.18],
          [0.58, 0.29],
          [0.38, 0.2],
          [0.24, 0.32],
          [0.1, 0.23],
          [0, 0.31],
          [-0.1, 0.23],
          [-0.24, 0.32],
          [-0.38, 0.2],
          [-0.58, 0.29],
          [-0.73, 0.18],
        ],
        0.048,
        surface,
      );
      wing.rotation.x = -Math.PI / 2;
      wing.position.y = 0.08;
      sphere(g, 0.13, mat("#4d5d68"), 0, 0.11, -0.085, [0.6, 0.55, 2.4]);
      box(
        g,
        0.095,
        0.035,
        0.1,
        mat("#9abfc5", null, { metalness: 0.6, roughness: 0.2 }),
        0,
        0.172,
        -0.21,
        [0.13, 0, 0],
      );
      for (const x of [-0.16, 0.16])
        box(g, 0.105, 0.024, 0.12, black(), x, 0.14, 0.07);
      for (const x of [-0.3, 0.3])
        box(g, 0.13, 0.007, 0.025, mat("#b3bec0"), x, 0.135, 0.17);
      break;
    }
    case "socialiste": {
      box(g, 0.8, 0.5, 0.026, surface, 0, 0.27, 0);
      box(g, 0.72, 0.4, 0.008, cream(), 0, 0.28, 0.019);
      label(
        g,
        "/assets/items/references/socialiste-logo.png",
        0.5,
        0.24,
        0,
        0.32,
        0.025,
      );
      label(g, "/assets/items/socialiste-label.png", 0.63, 0.1, 0, 0.13, 0.025);
      break;
    }
    case "cb12": {
      box(g, 0.48, 0.85, 0.014, surface, 0, 0.46, 0);
      label(g, "/assets/items/cb12-label.png", 0.47, 0.84, 0, 0.46, 0.009);
      for (let i = 0; i < 8; i++) {
        const tooth = shapeMesh(
          g,
          [
            [0, 0],
            [0.056, 0],
            [0.028, -0.035],
          ],
          0.014,
          surface,
        );
        tooth.position.set(-0.238 + i * 0.06, 0.035, -0.007);
      }
      break;
    }
    case "zerator": {
      const egg = sphere(g, 0.31, surface, 0, 0.4, 0, [1, 1.32, 1]);
      egg.geometry = geometry("SphereGeometry", [0.31, 8, 6]);
      sphere(g, 0.22, surface, 0, 0.62, 0, [1, 1.15, 1]);
      label(
        g,
        "/assets/items/references/zerator-logo.png",
        0.29,
        0.32,
        0,
        0.41,
        0.315,
      );
      for (let i = 0; i < 6; i++)
        sphere(
          g,
          0.023,
          mat("#abe478"),
          Math.sin(i) * 0.3,
          0.23 + (i % 2) * 0.35,
          Math.cos(i) * 0.2,
        );
      break;
    }
    case "gnome": {
      const body = joint(g, "motion-root");
      for (const x of [-0.12, 0.12])
        box(body, 0.21, 0.12, 0.31, mat("#644b35"), x, 0.06, 0.06);
      box(body, 0.4, 0.35, 0.3, mat("#307ba1"), 0, 0.3, 0);
      const head = joint(body, "head", 0, 0.47, 0.02);
      box(head, 0.3, 0.27, 0.27, mat("#e8ba91"), 0, 0.1, 0);
      for (let i = 0; i < 3; i++)
        box(head, 0.3 - i * 0.065, 0.085, 0.065, cream(), 0, 0.005 - i * 0.071, 0.15);
      cylinder(head, 0, 0.205, 0.48, surface, 0, 0.41, -0.02);
      box(head, 0.39, 0.06, 0.35, mat("#eb6451"), 0, 0.18, -0.02);
      box(head, 0.075, 0.065, 0.09, mat("#efbd96"), 0, 0.06, 0.155);
      for (const x of [-0.065, 0.065]) box(head, 0.03, 0.03, 0.012, black(), x, 0.12, 0.141);
      for (const x of [-0.25, 0.25])
        box(body, 0.13, 0.14, 0.14, mat("#e8ba91"), x, 0.26, 0.05);
      box(body, 0.41, 0.034, 0.31, mat("#463f2e"), 0, 0.25, 0.005);
      box(body, 0.055, 0.047, 0.02, gold(), 0, 0.25, 0.167);
      break;
    }
    case "megaphone": {
      cylinder(g, 0.285, 0.09, 0.47, cream(), 0, 0.45, 0.035, [
        Math.PI / 2,
        0,
        0,
      ]);
      cylinder(g, 0.075, 0.075, 0.23, surface, 0, 0.45, -0.27, [
        Math.PI / 2,
        0,
        0,
      ]);
      ring(g, 0.276, 0.032, surface, 0, 0.45, 0.272);
      cylinder(g, 0.24, 0.24, 0.025, black(), 0, 0.45, 0.273, [
        Math.PI / 2,
        0,
        0,
      ]);
      cylinder(g, 0.065, 0.08, 0.07, mat("#748778"), 0, 0.45, 0.29, [
        Math.PI / 2,
        0,
        0,
      ]);
      box(g, 0.1, 0.3, 0.12, surface, 0, 0.23, -0.18, [-0.17, 0, 0]);
      label(
        g,
        "/assets/items/references/zevent-logo.svg",
        0.14,
        0.14,
        -0.147,
        0.45,
        0.01,
        [0, -Math.PI / 2, 0],
      );
      label(
        g,
        "/assets/items/references/zevent-logo.svg",
        0.14,
        0.14,
        0.147,
        0.45,
        0.01,
        [0, Math.PI / 2, 0],
      );
      break;
    }
    case "tgv": {
      box(g, 0.61, 0.095, 0.36, gold(), 0, 0.048, 0);
      for (const [x, z, h, r] of [
        [-0.16, -0.1, 0.6, 0.12],
        [0.16, -0.07, 0.44, 0.105],
      ]) {
        cylinder(g, 0.038, 0.04, h * 0.58, surface, x, 0.16 + h * 0.23, z, [
          Math.PI / 2,
          0,
          0,
        ]);
        cylinder(
          g,
          r,
          0.038,
          h * 0.5,
          surface,
          x,
          0.16 + h * 0.23,
          z + h * 0.48,
          [Math.PI / 2, 0, 0],
          true,
        );
        ring(g, r, 0.013, mat("#7f989b"), x, 0.16 + h * 0.23, z + h * 0.73);
        cylinder(
          g,
          r * 0.92,
          r * 0.92,
          0.012,
          black(),
          x,
          0.16 + h * 0.23,
          z + h * 0.71,
          [Math.PI / 2, 0, 0],
        );
        box(g, 0.12, 0.17, 0.14, gold(), x, 0.1, z - 0.1);
      }
      break;
    }
    case "furry": {
      const body = joint(g, "motion-root");
      for (const x of [-0.12, 0.12]) {
        const leg = joint(body, x < 0 ? "left-leg" : "right-leg", x, 0.34, 0);
        box(leg, 0.18, 0.28, 0.19, surface, 0, -0.14, 0);
        box(leg, 0.23, 0.13, 0.3, mat("#58433b"), 0, -0.26, 0.058);
        const arm = joint(body, x < 0 ? "left-arm" : "right-arm", x * 2.65, 0.64, 0);
        arm.rotation.z = -x * 0.6;
        box(arm, 0.16, 0.31, 0.19, surface, 0, -0.16, 0);
        box(arm, 0.18, 0.14, 0.2, mat("#efe0c1"), 0, -0.34, 0.02);
      }
      box(body, 0.45, 0.4, 0.3, surface, 0, 0.48, 0);
      box(body, 0.3, 0.31, 0.035, cream(), 0, 0.46, 0.165);
      const head = joint(body, "head", 0, 0.685, 0);
      box(head, 0.38, 0.33, 0.32, surface, 0, 0.165, 0);
      for (const x of [-0.14, 0.14]) {
        box(head, 0.13, 0.22, 0.14, surface, x, 0.405, 0, [0, 0, -x * 2]);
        box(head, 0.075, 0.13, 0.022, mat("#62433c"), x, 0.405, 0.073, [0, 0, -x * 2]);
        box(head, 0.058, 0.067, 0.025, black(), x * 0.64, 0.185, 0.172);
        box(
          head,
          0.016,
          0.021,
          0.026,
          mat("#cbe2ab"),
          x * 0.64 - 0.01,
          0.198,
          0.175,
        );
      }
      box(head, 0.23, 0.11, 0.145, cream(), 0, 0.055, 0.19);
      box(head, 0.06, 0.04, 0.055, black(), 0, 0.11, 0.255);
      const tail = joint(body, "tail", 0, 0.36, -0.15);
      tail.rotation.x = -0.42;
      box(tail, 0.14, 0.14, 0.22, surface, 0, -0.03, -0.11);
      box(tail, 0.17, 0.16, 0.18, surface, 0, -0.03, -0.28);
      box(tail, 0.13, 0.12, 0.13, cream(), 0, -0.025, -0.42);
      break;
    }
    case "radio": {
      box(g, 0.75, 0.41, 0.25, surface, 0, 0.25, 0);
      for (const x of [-0.27, 0.27])
        box(g, 0.09, 0.053, 0.2, black(), x, 0.032, 0);
      box(g, 0.045, 0.17, 0.06, mat("#52634d"), -0.23, 0.53, 0);
      box(g, 0.045, 0.17, 0.06, mat("#52634d"), 0.23, 0.53, 0);
      box(g, 0.5, 0.043, 0.06, mat("#52634d"), 0, 0.595, 0);
      const speaker = joint(g, "speaker", -0.11, 0.26, 0.14);
      box(speaker, 0.36, 0.21, 0.025, mat("#435646"), 0, 0, 0);
      for (let i = 0; i < 9; i++)
        box(
          speaker,
          0.33,
          0.009,
          0.01,
          mat("#b0b796"),
          0,
          -0.09 + i * 0.022,
          0.018,
        );
      box(g, 0.22, 0.075, 0.02, mat("#395747"), 0.225, 0.34, 0.145);
      label(g, "/assets/items/radio-label.png", 0.19, 0.06, 0.225, 0.34, 0.158);
      cylinder(g, 0.057, 0.057, 0.028, mat("#667961"), 0.215, 0.205, 0.16, [
        Math.PI / 2,
        0,
        0,
      ]);
      box(g, 0.009, 0.033, 0.012, cream(), 0.215, 0.225, 0.18);
      const antenna = joint(g, "antenna", 0.207, 0.428, -0.065);
      antenna.rotation.z = -0.24;
      cylinder(
        antenna,
        0.008,
        0.008,
        0.53,
        mat("#aebcab", null, { metalness: 0.8 }),
        0,
        0.265,
        0,
      );
      sphere(antenna, 0.021, mat("#b0bead"), 0, 0.53, 0);
      const indicator = joint(g, "indicator", -0.29, 0.397, 0.143);
      sphere(
        indicator,
        0.019,
        mat("#8fe087", null, { emissive: "#73d065", emissiveIntensity: 0.6 }),
        0,
        0,
        0,
      );
      break;
    }
    default:
      box(g, 0.5, 0.5, 0.5, mat("#ffffff"));
  }

  // Normalize the longest dimension and place the exact geometry bounds on y = 0.
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 1 / Math.max(size.x, size.y, size.z, 0.001);
  const center = bounds.getCenter(new THREE.Vector3());
  const wrapped = new THREE.Group();
  g.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  g.scale.setScalar(scale);
  wrapped.add(g);
  wrapped.name = `item:${id}`;
  wrapped.userData.itemId = id;
  wrapped.userData.assetShared = true;
  return wrapped;
}

/** Returns a fresh transform hierarchy; geometry, materials and textures are shared. */
export function createItemModel(id) {
  if (!templates.has(id)) templates.set(id, buildModel(id));
  return templates.get(id).clone(true);
}

/** Only call for a complete game teardown; never dispose a single item's shared assets. */
export function disposeItemAssets() {
  for (const texture of textures.values()) texture.dispose();
  for (const material of materials.values()) material.dispose();
  for (const geo of geometries.values()) geo.dispose();
  textures.clear();
  materials.clear();
  geometries.clear();
  templates.clear();
}
