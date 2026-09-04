import { ITEMS } from "./items.js";
import { RECIPES } from "./inventory.js";
import "./style.css";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const HEX =
  '<svg viewBox="0 0 48 52" fill="none" aria-hidden="true"><path d="M24 3 44 14.5v23L24 49 4 37.5v-23Z" stroke="currentColor" stroke-width="3"/><path d="m14 18 10 6 10-6v16l-10 6-10-6Z" fill="currentColor" opacity=".2"/></svg>';
const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HEART =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 21-1.45-1.32C5.4 15.01 2 11.93 2 8.15 2 5.07 4.42 3 7.25 3c1.61 0 3.16.76 4.18 1.95L12 5.6l.57-.65C13.59 3.76 15.14 3 16.75 3 19.58 3 22 5.07 22 8.15c0 3.78-3.4 6.86-8.55 11.53Z" fill="currentColor" stroke="#35271f" stroke-width="1.6"/></svg>';
const FOOD =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 14 6 6m-1-1 2-1m-2 1-1 2" fill="none" stroke="#fff4d4" stroke-width="3.2" stroke-linecap="round"/><path d="M4.9 3.7c3.7-2.1 9.8 2.1 11.9 6.1 1.5 2.8.6 5.3-2 6.3-3.1 1.2-6.7-1.4-9.5-4.3C2.8 9.1 2.1 5.3 4.9 3.7Z" fill="currentColor" stroke="#533b26" stroke-width="1.5"/></svg>';
const SUN =
  '<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="5" fill="currentColor"/><path d="M14 1v4m0 18v4M1 14h4m18 0h4M5 5l3 3m12 12 3 3M5 23l3-3M20 8l3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const PICKAXE =
  '<svg class="tool-icon" viewBox="0 0 100 100" aria-hidden="true"><path d="m28 83 8 6 43-57-8-6z" fill="#8d5936" stroke="#352b22" stroke-width="3"/><path d="m17 29 9-9 25-3 22 9 12 23-2 18-12-26-22-10-23 3z" fill="#b4c2c5" stroke="#394744" stroke-width="3"/><path d="m25 26 24-4 18 7" fill="none" stroke="#edf1ea" stroke-width="3"/></svg>';
const BLOCKS = {
  grass: {
    id: "grass",
    name: "Herbe",
    description:
      "Un bloc de prairie. À poser pour construire et redessiner votre monde.",
    color: "#73a74d",
    kind: "Bloc",
  },
  dirt: {
    id: "dirt",
    name: "Terre",
    description:
      "Un matériau abondant pour construire, combler et prendre de la hauteur.",
    color: "#a5774c",
    kind: "Bloc",
  },
  stone: {
    id: "stone",
    name: "Roche",
    description:
      "La base de toute bonne construction. Sert aussi à fabriquer des outils.",
    color: "#9caaa2",
    kind: "Bloc",
  },
  wood: {
    id: "wood",
    name: "Bois",
    description:
      "Récolté sur les troncs. Un matériau essentiel pour vos constructions et votre artisanat.",
    color: "#a87543",
    kind: "Matériau",
  },
  sand: {
    id: "sand",
    name: "Sable",
    description: "Un bloc clair récolté au bord de l’eau.",
    color: "#dfcf92",
    kind: "Bloc",
  },
  ore: {
    id: "ore",
    name: "Minerai",
    description:
      "Une ressource précieuse. Attention : les agents de l’URSSAF s’y intéressent aussi.",
    color: "#729cab",
    kind: "Ressource",
  },
  lucky: {
    id: "lucky",
    name: "Lucky Block",
    description:
      "Seize surprises possibles. Détruisez-le pour découvrir ce que le hasard vous réserve.",
    color: "#f4c65b",
    kind: "Surprise",
  },
  leaves: {
    id: "leaves",
    name: "Feuillage",
    description: "Un peu de verdure pour vos constructions.",
    color: "#428853",
    kind: "Bloc",
  },
  water: {
    id: "water",
    name: "Eau",
    description: "L’eau des lacs et des rivières.",
    color: "#56acc7",
    kind: "Bloc",
  },
  pickaxe: {
    id: "pickaxe",
    name: "Pioche",
    description:
      "Un outil solide pour extraire les blocs plus rapidement. Clic gauche pour miner.",
    color: "#b4c2c5",
    kind: "Outil",
  },
};
const itemList = Array.isArray(ITEMS)
  ? ITEMS
  : Object.entries(ITEMS || {}).map(([id, item]) => ({ id, ...item }));
const itemMap = new Map(
  [...Object.values(BLOCKS), ...itemList].map((item) => [item.id, item]),
);
const recipes = Object.entries(RECIPES).map(([id, cost]) => ({
  id,
  name: itemMap.get(id)?.name || id,
  description: itemMap.get(id)?.description || "",
  cost,
  yield: 1,
}));
const getItem = (id) =>
  itemMap.get(id) || {
    id,
    name: id || "Emplacement vide",
    description: "",
    color: "#a1ae97",
    kind: "Objet",
  };
const quantity = (inventory, id) => {
  const value = inventory?.[id];
  return typeof value === "number" ? value : value?.count || 0;
};
const icon = (id, className = "") => {
  if (!id) return '<span class="empty-slot-mark"></span>';
  const data = getItem(id);
  const image = data.icon || data.iconUrl || data.image;
  if (image)
    return `<img class="item-icon ${className}" src="${escape(image)}" alt="" draggable="false" />`;
  if (id === "pickaxe") return PICKAXE;
  return `<span class="block-icon block-${escape(id)} ${className}" style="--block-color:${escape(data.color)}"><span>${id === "lucky" ? "?" : ""}</span></span>`;
};

export class GameUI {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.state = {
      health: 100,
      hunger: 100,
      hotbar: Array(9).fill(null),
      selected: 0,
      inventory: {},
      discovered: [],
      day: 1,
      time: 0,
      biome: "Prairie verdoyante",
      seed: "",
      mode: "survival",
      buffs: [],
      hasSave: false,
      actionHint: "",
      useProgress: 0,
      usingItem: false,
      canEat: null,
      controlMode: "paused",
      captureStatus: "pending",
      captureMessage: "",
    };
    this.overlayKind = null;
    this.inventoryTab = "inventory";
    this.inspectedId = null;
    this.volume = 0.35;
    this.disposed = false;
    this.hotbarSignature = "";
    this.inventorySignature = "";
    this.captureSignature = "";
    this.toasts = [];
    this.el = document.createElement("div");
    this.el.id = "minecrack-ui";
    this.el.innerHTML = `
      <div class="damage-vignette" aria-hidden="true"></div>
      <div class="game-hud">
        <header class="hud-brand">${HEX}<div><strong>MINECRACK</strong><span>SURVIE HEXAGONALE</span></div></header>
        <div class="compass" aria-hidden="true"><span>O</span><i>· · ·</i><strong>N</strong><i>· · ·</i><span>E</span><b></b></div>
        <div class="world-status"><div class="day-clock">${SUN}<span>Jour <b data-ui="day">1</b><i>·</i><span data-ui="clock">08:00</span></span></div><span class="biome" data-ui="biome">PRAIRIE VERDOYANTE</span></div>
        <aside class="objective"><span class="objective-diamond"></span><div><strong data-ui="objective-title">UN PEU DE CHANCE</strong><p data-ui="objective">Trouvez un Lucky Block.</p></div></aside>
        <div class="crosshair" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="target-info"><span data-ui="target"></span><div class="mining-track"><div data-ui="mining"></div></div></div>
        <div class="buffs" data-ui="buffs"></div>
        <div class="bottom-hud">
          <div class="air-meter" data-ui="air" hidden><span>OXYGÈNE</span><div><i></i></div></div>
          <div class="held-name" data-ui="held-name"></div>
          <div class="held-action" data-ui="action-feedback" hidden><span data-ui="action-hint"></span><div class="use-track" data-ui="use-track" role="progressbar" aria-label="Consommation" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><i data-ui="use-progress"></i></div></div>
          <div class="survival-bars"><div class="health-meter" role="meter" aria-label="Vie" aria-valuemin="0" aria-valuemax="100">${Array.from({ length: 10 }, () => `<span>${HEART}</span>`).join("")}</div><div class="hunger-meter" role="meter" aria-label="Faim" aria-valuemin="0" aria-valuemax="100">${Array.from({ length: 10 }, () => `<span>${FOOD}</span>`).join("")}</div></div>
          <div class="hotbar" aria-label="Inventaire rapide">${Array.from({ length: 9 }, (_, i) => `<button class="hotbar-slot" data-slot="${i}" tabindex="-1" aria-label="Emplacement ${i + 1}"><kbd>${i + 1}</kbd><span class="slot-icon"></span><span class="slot-count"></span></button>`).join("")}</div>
          <div class="fps-control-tip" data-ui="control-tip"><span><kbd>1–9</kbd> / molette</span><span><kbd>E</kbd> Curseur et inventaire</span></div>
        </div>
        <div class="quick-controls controls-left"><span><kbd>ZQSD / WASD</kbd>Se déplacer</span><span><kbd>ESPACE</kbd>Sauter</span></div>
        <div class="quick-controls controls-right"><span><kbd>E</kbd>Inventaire</span><span><kbd>ÉCHAP</kbd>Pause</span></div>
        <div class="debug-panel" hidden></div>
      </div>
      <div class="overlay-root" hidden></div>
      <div class="toast-stack" aria-live="polite" aria-atomic="false"></div>
      <div class="mobile-note">${HEX}<strong>Le grand air attendra votre clavier.</strong><p>Minecrack se joue avec un clavier et une souris sur ordinateur.</p></div>`;
    document.body.appendChild(this.el);
    document.getElementById("boot-loading")?.remove();
    this.hud = this.el.querySelector(".game-hud");
    this.overlay = this.el.querySelector(".overlay-root");
    this.nodes = Object.fromEntries(
      [...this.el.querySelectorAll("[data-ui]")].map((node) => [
        node.dataset.ui,
        node,
      ]),
    );
    this.slotNodes = [...this.el.querySelectorAll(".hotbar-slot")];
    this.healthNodes = [...this.el.querySelectorAll(".health-meter>span")];
    this.hungerNodes = [...this.el.querySelectorAll(".hunger-meter>span")];
    this.onClick = (event) => this.handleClick(event);
    this.onInput = (event) => this.handleInput(event);
    this.el.addEventListener("click", this.onClick);
    this.el.addEventListener("input", this.onInput);
    this.el.addEventListener("change", this.onInput);
    this.update(this.state);
  }

  update(next = {}) {
    if (this.disposed) return;
    this.state = { ...this.state, ...next };
    const s = this.state;
    this.el.dataset.controlMode = this.overlayKind ? "paused" : s.controlMode || "locked";
    this.nodes.day.textContent = String(s.day ?? 1);
    const minutes = Math.floor((8 * 60 + (s.time || 0) * 1.2) % 1440);
    this.nodes.clock.textContent =
      s.clock ||
      `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    this.nodes.biome.textContent =
      s.mode === "creative"
        ? "ATELIER CRÉATIF"
        : s.biome || "Prairie verdoyante";
    if (Number.isFinite(s.yaw)) {
      const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
      const heading = Math.round((-s.yaw * 180) / Math.PI / 45);
      const compass = this.el.querySelector(".compass");
      const index = ((heading % 8) + 8) % 8;
      compass.querySelector("strong").textContent = directions[index];
      const sides = compass.querySelectorAll("span");
      sides[0].textContent = directions[(index + 6) % 8];
      sides[1].textContent = directions[(index + 2) % 8];
    }
    this.nodes.objective.textContent = s.objective || "Trouvez un Lucky Block.";
    this.nodes["objective-title"].textContent =
      s.mode === "creative"
        ? "À VOUS DE JOUER"
        : s.objectiveTitle || "UN PEU DE CHANCE";
    this.nodes.target.textContent = s.targetName || "";
    this.nodes.mining.style.transform = `scaleX(${Math.max(0, Math.min(1, s.miningProgress || 0))})`;
    this.el
      .querySelector(".target-info")
      .classList.toggle("mining", (s.miningProgress || 0) > 0);
    const health = Math.max(0, Math.min(100, Number(s.health ?? 100)));
    const hunger = Math.max(0, Math.min(100, Number(s.hunger ?? 100)));
    const heldSlot = s.hotbar?.[s.selected];
    const heldId = typeof heldSlot === "string" ? heldSlot : heldSlot?.id;
    const edible = heldId === "chocolatine" || heldId === "cb12";
    const usingItem = Boolean(s.usingItem) && !this.overlayKind && s.controlMode !== "paused";
    const fullHunger = edible && s.canEat === false && hunger >= 99.9 && !usingItem;
    const actionHint = fullHunger
      ? "Faim pleine · Vous êtes rassasié"
      : s.actionHint || (edible ? (usingItem ? "Vous mangez… Maintenez le clic droit" : "Maintenir clic droit · Manger") : "");
    const useProgress = usingItem && Number.isFinite(s.useProgress) ? Math.max(0, Math.min(1, s.useProgress)) : 0;
    this.nodes["action-feedback"].hidden = !actionHint && !usingItem;
    this.nodes["action-feedback"].classList.toggle("action-unavailable", fullHunger);
    this.nodes["action-feedback"].classList.toggle("using-item", usingItem);
    this.nodes["action-hint"].textContent = actionHint;
    this.nodes["use-track"].hidden = !usingItem;
    this.nodes["use-track"].setAttribute("aria-label", edible ? "Consommation" : "Utilisation");
    this.nodes["use-track"].setAttribute("aria-valuenow", String(Math.round(useProgress * 100)));
    this.nodes["use-progress"].style.transform = `scaleX(${useProgress})`;
    this.healthNodes.forEach((node, i) => {
      node.style.opacity = health > i * 10 ? "1" : ".22";
      node.classList.toggle("half", health > i * 10 && health < (i + 1) * 10);
    });
    this.hungerNodes.forEach((node, i) => {
      node.style.opacity = hunger > i * 10 ? "1" : ".22";
    });
    this.el
      .querySelector(".health-meter")
      .setAttribute("aria-valuenow", String(Math.round(health)));
    this.el
      .querySelector(".hunger-meter")
      .setAttribute("aria-valuenow", String(Math.round(hunger)));
    this.el
      .querySelector(".health-meter")
      .classList.toggle("critical", health <= 25);
    this.nodes.air.hidden = s.air == null || s.air >= 99.9;
    this.nodes.air.querySelector("i").style.transform =
      `scaleX(${Math.max(0, Math.min(1, (s.air ?? 100) / 100))})`;
    const signature = JSON.stringify([s.hotbar, s.selected, s.inventory]);
    if (signature !== this.hotbarSignature) {
      this.hotbarSignature = signature;
      this.slotNodes.forEach((node, i) => {
        const slot = s.hotbar?.[i];
        const id = typeof slot === "string" ? slot : slot?.id;
        const count =
          typeof slot === "string"
            ? quantity(s.inventory, id)
            : (slot?.count ?? quantity(s.inventory, id));
        node.classList.toggle("selected", i === s.selected);
        node.setAttribute("aria-pressed", String(i === s.selected));
        node.setAttribute(
          "aria-label",
          `${i + 1} — ${id ? getItem(id).name : "Emplacement vide"}${count ? `, ${count}` : ""}`,
        );
        node.title = id ? getItem(id).name : "Emplacement vide";
        node.querySelector(".slot-icon").innerHTML = icon(id);
        node.querySelector(".slot-count").textContent =
          id && count > 1 ? (count >= 10000 ? "9999+" : count) : "";
      });
      const slot = s.hotbar?.[s.selected];
      this.nodes["held-name"].textContent = slot
        ? getItem(typeof slot === "string" ? slot : slot.id).name
        : "";
    }
    const buffs = (s.buffs || []).map((buff) =>
      typeof buff === "string"
        ? buff
        : `${buff.name || buff.label || buff.id}${buff.remaining != null ? ` · ${Math.ceil(buff.remaining)} s` : ""}`,
    );
    const buffText = buffs.join(" • ");
    if (this.nodes.buffs.textContent !== buffText)
      this.nodes.buffs.textContent = buffText;
    if (this.debugVisible) {
      const p = s.position || {};
      this.el.querySelector(".debug-panel").textContent =
        `MINECRACK / ${Math.round(s.fps || 0)} FPS\nX ${(p.x || 0).toFixed(1)}  Y ${(p.y || 0).toFixed(1)}  Z ${(p.z || 0).toFixed(1)}\nGraine ${s.seed || "—"}\n${s.mode === "creative" ? "Créatif" : "Survie"} · ${(s.discovered || []).length}/${itemList.length} découvertes`;
    }
    if (this.overlayKind === "inventory") {
      const invSignature = JSON.stringify([
        s.inventory,
        s.hotbar,
        s.selected,
        s.discovered,
        this.inventoryTab,
        this.inspectedId,
      ]);
      if (this.inventorySignature !== invSignature) {
        this.inventorySignature = invSignature;
        this.renderInventory(s);
      }
    }
    if (this.overlayKind === "capture") {
      const signature = JSON.stringify([s.captureStatus || "pending", s.captureMessage || ""]);
      if (signature !== this.captureSignature) this.renderCapture();
    }
  }

  setOverlay(kind, state = {}) {
    this.state = { ...this.state, ...state };
    this.overlayKind = kind === "start" ? "menu" : kind;
    this.el.dataset.controlMode = this.overlayKind ? "paused" : this.state.controlMode || "locked";
    this.el.dataset.overlay = this.overlayKind || "";
    this.hud.classList.toggle(
      "hud-hidden",
      this.overlayKind === "menu" ||
        this.overlayKind === "loading" ||
        this.overlayKind === "capture" ||
        this.overlayKind === "death",
    );
    this.hud.classList.toggle(
      "hud-muted",
      Boolean(this.overlayKind && !["menu", "loading", "death", "capture"].includes(this.overlayKind)),
    );
    this.hud.inert = Boolean(this.overlayKind);
    if (this.overlayKind) {
      this.nodes["use-track"].hidden = true;
      this.nodes["use-track"].setAttribute("aria-valuenow", "0");
      this.nodes["use-progress"].style.transform = "scaleX(0)";
    }
    this.overlay.hidden = !this.overlayKind;
    this.overlay.className = `overlay-root ${this.overlayKind ? `overlay-${this.overlayKind}` : ""}`;
    if (!this.overlayKind) {
      this.overlay.innerHTML = "";
      return;
    }
    if (this.overlayKind === "menu") this.renderMenu();
    else if (this.overlayKind === "pause") this.renderPause();
    else if (this.overlayKind === "capture") this.renderCapture();
    else if (this.overlayKind === "inventory") {
      this.inventorySignature = "";
      this.renderInventory(this.state);
    } else if (this.overlayKind === "death") this.renderDeath();
    else if (this.overlayKind === "loading")
      this.overlay.innerHTML = `<div class="loading-screen">${HEX}<span>LE MONDE PREND FORME</span><h2>Chaque hexagone compte.</h2><div class="loading-line"></div></div>`;
  }

  renderMenu() {
    const s = this.state;
    this.overlay.innerHTML = `
      <div class="menu-shade"></div>
      <header class="menu-top"><a class="small-brand" href="#" data-action="noop" aria-label="Minecrack">${HEX}<span>LE HASARD VOUS VA BIEN.</span></a><span class="edition">UN MONDE À SIX CÔTÉS.</span></header>
      <section class="main-menu" aria-label="Menu principal">
        <div class="menu-eyebrow"><span></span>SURVIE · EXPLORATION · CONSTRUCTION</div>
        <h1>MINECRACK<span aria-hidden="true">.</span></h1>
        <p class="menu-tagline">Tout un monde à construire.<br>Et quelques surprises à déterrer.</p>
        <div class="menu-actions">
          ${s.hasSave ? `<button class="button primary play-button" data-action="continue"><span>Continuer l’aventure</span>${ARROW}</button><button class="button secondary" data-action="play"><span>Nouvelle aventure</span><span class="button-hint">SURVIE</span></button>` : `<button class="button primary play-button" data-action="play"><span>Jouer</span>${ARROW}</button>`}
          <button class="button secondary creative-button" data-action="creative"><span>Atelier créatif</span><span class="button-hint">TOUT DÉBLOQUÉ</span></button>
        </div>
        <div class="world-options"><label for="world-seed">GRAINE DU MONDE</label><div class="seed-control"><input id="world-seed" maxlength="64" autocomplete="off" spellcheck="false" type="text" placeholder="Laissez le hasard décider" value="${escape(s.hasSave ? "" : s.seed || "")}"/><button data-action="random-seed" title="Choisir une graine aléatoire" aria-label="Choisir une graine aléatoire"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg></button></div></div>
        <label class="menu-volume"><span>SONS DU MONDE</span><input aria-label="Volume sonore" data-volume type="range" min="0" max="1" step="0.05" value="${this.volume}"/><output>${Math.round(this.volume * 100)} %</output></label>
      </section>
      <div class="menu-world-note"><span class="tiny-diamond"></span><p>Un Lucky Block. <strong>Seize possibilités.</strong></p></div>
      <footer class="menu-footer"><div class="menu-controls"><span><kbd>SOURIS</kbd>VUE FPS CAPTURÉE</span><span><kbd>ZQSD / WASD</kbd>SE DÉPLACER</span><span><kbd>CLIC G.</kbd>MINER / FRAPPER</span><span><kbd>CLIC D.</kbd>UTILISER / POSER</span><span><kbd>ESPACE</kbd>SAUTER</span><span><kbd>E</kbd>CURSEUR / INVENTAIRE</span></div><span class="local-note">VOTRE MONDE, SAUVEGARDÉ LOCALEMENT.</span></footer>`;
  }

  renderCapture() {
    const s = this.state;
    const states = {
      pending: { title: "Capturer la souris", description: "La partie reste en pause pendant la capture de la souris.", button: "Capture en cours…", busy: true },
      blocked: { title: "Ouvrir la fenêtre de jeu", description: "Ce navigateur n’a pas accepté la capture de la souris. Ouvrez la fenêtre de jeu pour utiliser les commandes FPS.", button: "Ouvrir la fenêtre de jeu" },
      launching: { title: "Ouverture de la fenêtre de jeu", description: "Votre partie est transférée dans la fenêtre de jeu.", button: "Ouverture en cours…", busy: true },
      opened: { title: "La fenêtre de jeu est ouverte", description: "Retrouvez votre partie dans la fenêtre de jeu. Cliquez dans cette fenêtre pour capturer la souris.", button: "Reprendre dans la fenêtre de jeu" },
      error: { title: "La fenêtre n’a pas pu s’ouvrir", description: "Réessayez l’ouverture de la fenêtre de jeu pour reprendre votre partie.", button: "Réessayer l’ouverture" },
    };
    const status = Object.hasOwn(states, s.captureStatus) ? s.captureStatus : "pending";
    const content = states[status];
    const isRefresh = Boolean(this.overlay.querySelector(".capture-panel"));
    this.captureSignature = JSON.stringify([s.captureStatus || "pending", s.captureMessage || ""]);
    this.overlay.innerHTML = `<section class="capture-panel game-panel ${isRefresh ? "panel-settled" : ""}" role="dialog" aria-modal="true" aria-labelledby="capture-title" aria-describedby="capture-description" aria-busy="${Boolean(content.busy)}" data-capture-status="${status}" tabindex="-1">
      <div class="capture-symbol ${content.busy ? "capture-busy" : ""}" aria-hidden="true"><svg viewBox="0 0 48 56" fill="none"><rect x="10" y="4" width="28" height="43" rx="14" stroke="currentColor" stroke-width="2"/><path d="M24 5v16M11 23h26" stroke="currentColor" stroke-width="2"/><path d="m18 52 6-5 6 5" stroke="currentColor" stroke-width="1.5"/></svg></div>
      <div class="panel-eyebrow">CONTRÔLES FPS</div><h2 id="capture-title">${content.title}</h2><p id="capture-description" class="capture-description">${content.description}</p>
      ${s.captureMessage ? `<p class="capture-message" role="status">${escape(s.captureMessage)}</p>` : ""}
      <div class="capture-actions"><button class="button primary" data-action="desktop" ${content.busy ? "disabled" : ""}><span>${content.button}</span>${content.busy ? '<span class="capture-loader" aria-hidden="true"></span>' : ARROW}</button>${!content.busy ? '<button class="button secondary" data-action="retry-capture">Réessayer la capture ici</button>' : ""}<button class="text-button" data-action="menu">Retour au menu</button></div>
      <p class="capture-footnote">La partie reste en pause dans cette fenêtre.</p>
    </section>`;
  }

  renderPause() {
    const s = this.state;
    this.overlay.innerHTML = `
      <section class="pause-panel game-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <div class="panel-eyebrow">LE MONDE PEUT ATTENDRE</div><h2 id="pause-title">Petite pause<span>.</span></h2><p class="panel-subtitle">Jour ${s.day || 1} <span>·</span> ${escape(s.biome || "Prairie verdoyante")}</p>
        <div class="pause-actions"><button class="button primary" data-action="resume"><span>Reprendre l’aventure</span>${ARROW}</button><button class="button secondary" data-action="save">Sauvegarder le monde<span class="button-hint">LOCAL</span></button><button class="button secondary" data-action="new-confirm">Nouvelle partie</button></div>
        <div class="new-game-confirm" hidden><p>Recommencer remplace la sauvegarde de ce monde.</p><label for="new-seed">Graine du nouveau monde</label><input id="new-seed" maxlength="64" placeholder="Aléatoire"/><div><button class="button danger" data-action="new-game">Recommencer</button><button class="text-button" data-action="new-cancel">Annuler</button></div></div>
        <div class="pause-settings"><label class="setting-row"><span>Volume sonore</span><input data-volume aria-label="Volume sonore" type="range" min="0" max="1" step="0.05" value="${this.volume}"/><output>${Math.round(this.volume * 100)} %</output></label><div class="radio-setting"><div><strong>La radio de Portal</strong><p>Mélodie originale par défaut.<br>Ajoutez votre propre fichier audio pour la radio.</p></div><label class="file-button">Choisir un fichier<input data-music type="file" accept="audio/*"/></label></div><div class="music-filename" aria-live="polite"></div></div>
        <p class="pause-control-help">La souris capturée oriente la vue FPS.<br><kbd>E</kbd> libère le curseur et ouvre l’inventaire.</p><details class="controls-help"><summary>Commandes du jeu</summary><dl><div><dt>Souris capturée</dt><dd>Regarder autour de soi</dd></div><div><dt>ZQSD / WASD</dt><dd>Se déplacer · mêmes positions physiques<br>AZERTY / QWERTY</dd></div><div><dt>Espace</dt><dd>Sauter</dd></div><div><dt>Ctrl</dt><dd>Courir</dd></div><div><dt>Shift</dt><dd>S’accroupir</dd></div><div><dt>Clic gauche</dt><dd>Miner / frapper</dd></div><div><dt>Clic droit</dt><dd>Utiliser / poser · maintenir pour manger</dd></div><div><dt>1–9 / molette</dt><dd>Choisir l’objet tenu</dd></div><div><dt>A / Q</dt><dd>Jeter l’objet · AZERTY / QWERTY</dd></div><div><dt>E</dt><dd>Inventaire et curseur</dd></div><div><dt>Échap</dt><dd>Pause / reprendre, même dans l’inventaire</dd></div><div><dt>F5</dt><dd>Changer de perspective</dd></div><div><dt>F1</dt><dd>Afficher / masquer le HUD</dd></div></dl></details><button class="text-button back-to-menu" data-action="menu">Retour au menu ${ARROW}</button><p class="pause-footnote"><kbd>ÉCHAP</kbd> pour reprendre <span>·</span> Graine : ${escape(s.seed || "—")}</p>
      </section>`;
  }

  renderInventory(state = this.state) {
    this.state = { ...this.state, ...state };
    const s = this.state;
    const ownedIds = Object.keys(s.inventory || {}).filter(
      (id) => quantity(s.inventory, id) > 0,
    );
    const known = new Set(s.discovered || []);
    const entries =
      this.inventoryTab === "collection" ? itemList : ownedIds.map(getItem);
    if (!this.inspectedId && entries.length) this.inspectedId = entries[0].id;
    const inspected = this.inspectedId ? getItem(this.inspectedId) : null;
    const inspectedCount = inspected ? quantity(s.inventory, inspected.id) : 0;
    const selected = (s.selected || 0) + 1;
    const oldScroll =
      this.overlay.querySelector(".inventory-scroll")?.scrollTop || 0;
    const isRefresh = Boolean(this.overlay.querySelector(".inventory-panel"));
    this.overlay.innerHTML = `
      <section class="inventory-panel game-panel ${isRefresh ? "panel-settled" : ""}" role="dialog" aria-modal="true" aria-labelledby="inventory-title">
        <header class="inventory-heading"><div><div class="panel-eyebrow">PRENEZ CE QU’IL VOUS FAUT</div><h2 id="inventory-title">Dans vos poches<span>.</span></h2></div><button class="close-button" data-action="resume" aria-label="Fermer l’inventaire"><span>Fermer</span><kbd>E / ÉCHAP</kbd><i>×</i></button></header>
        <nav class="inventory-tabs" aria-label="Catégories d’inventaire"><button data-tab="inventory" class="${this.inventoryTab === "inventory" ? "active" : ""}" aria-pressed="${this.inventoryTab === "inventory"}">Inventaire <span>${ownedIds.length}</span></button><button data-tab="collection" class="${this.inventoryTab === "collection" ? "active" : ""}" aria-pressed="${this.inventoryTab === "collection"}">Lucky collection <span>${known.size}/${itemList.length}</span></button><button data-tab="craft" class="${this.inventoryTab === "craft" ? "active" : ""}" aria-pressed="${this.inventoryTab === "craft"}">Artisanat</button></nav>
        ${
          this.inventoryTab === "craft"
            ? this.craftMarkup(s)
            : `<div class="inventory-body"><div class="inventory-scroll"><p class="inventory-instruction">${this.inventoryTab === "collection" ? "Les surprises du hasard. Les objets grisés restent à découvrir." : `Cliquez sur un objet pour l’équiper dans l’emplacement ${selected}.`}</p><div class="inventory-grid ${this.inventoryTab === "collection" ? "collection-grid" : ""}">${entries
                .map((item) => {
                  const count = quantity(s.inventory, item.id);
                  const discovered = known.has(item.id) || count > 0;
                  return `<button class="inventory-item ${this.inspectedId === item.id ? "inspected" : ""} ${this.inventoryTab === "collection" && !discovered ? "undiscovered" : ""}" data-item="${escape(item.id)}" aria-label="${escape(item.name)}, ${count} en inventaire"><span class="inventory-item-visual">${icon(item.id)}${count ? `<b>${count}</b>` : ""}${this.inventoryTab === "collection" && discovered ? '<span class="discovery-mark">✓</span>' : ""}</span><span class="inventory-item-name">${escape(item.name)}</span></button>`;
                })
                .join(
                  "",
                )}</div>${entries.length === 0 ? `<div class="empty-inventory"><span class="empty-hex">${HEX}</span><h3>La place ne manque pas.</h3><p>Minez du bois, de la roche et un peu de chance.<br>Vos découvertes apparaîtront ici.</p></div>` : ""}</div><aside class="item-inspector">${inspected ? `<div class="inspector-visual">${icon(inspected.id)}</div><span class="item-kind">${escape(inspected.kind || "OBJET LUCKY")}</span><h3>${escape(inspected.name)}</h3><p>${escape(inspected.description)}</p><div class="owned-count"><span>Dans l’inventaire</span><strong>${inspectedCount}</strong></div><button class="button ${inspectedCount ? "primary" : "secondary"} equip-button" data-action="equip" ${inspectedCount ? "" : "disabled"}>${inspectedCount ? `Équiper · emplacement ${selected}` : known.has(inspected.id) ? "Objet déjà découvert" : "À découvrir"}</button>` : `<div class="inspector-visual">${HEX}</div><p>Chaque aventure commence les poches vides.</p>`}</aside></div>`
        }
        <footer class="inventory-bottom"><div><span class="quickbar-label">VOTRE BARRE RAPIDE</span><p>Sélectionnez un emplacement, puis un objet.</p></div><div class="inventory-hotbar">${Array.from(
          { length: 9 },
          (_, i) => {
            const slot = s.hotbar?.[i];
            const id = typeof slot === "string" ? slot : slot?.id;
            return `<button class="mini-slot ${i === s.selected ? "selected" : ""}" data-slot="${i}" aria-label="Emplacement ${i + 1}${id ? `, ${escape(getItem(id).name)}` : ", vide"}" aria-pressed="${i === s.selected}"><kbd>${i + 1}</kbd>${icon(id)}</button>`;
          },
        ).join("")}</div></footer>
      </section>`;
    const scroll = this.overlay.querySelector(".inventory-scroll");
    if (scroll) scroll.scrollTop = oldScroll;
  }

  craftMarkup(s) {
    const list = s.recipes || recipes;
    return `<div class="craft-body"><p class="inventory-instruction">Le bon outil commence avec les bonnes ressources.</p><div class="recipe-list">${list
      .map((recipe) => {
        const cost = recipe.cost || recipe.ingredients || {};
        const canCraft = Object.entries(cost).every(
          ([id, count]) => quantity(s.inventory, id) >= count,
        );
        return `<article class="recipe"><div class="recipe-visual">${icon(recipe.id)}</div><div class="recipe-copy"><span class="item-kind">ARTISANAT</span><h3>${escape(recipe.name || getItem(recipe.id).name)}</h3><p>${escape(recipe.description || getItem(recipe.id).description)}</p><div class="recipe-cost">${Object.entries(
          cost,
        )
          .map(
            ([id, count]) =>
              `<span class="${quantity(s.inventory, id) >= count ? "available" : "missing"}">${icon(id)}${quantity(s.inventory, id)} / ${count} ${escape(getItem(id).name.toLowerCase())}</span>`,
          )
          .join(
            "",
          )}</div></div><button class="button ${canCraft ? "primary" : "secondary"}" data-craft="${escape(recipe.id)}" ${canCraft ? "" : "disabled"}>${canCraft ? "Fabriquer" : "Ressources manquantes"}</button></article>`;
      })
      .join("")}</div></div>`;
  }

  renderDeath() {
    const s = this.state;
    this.overlay.innerHTML = `<section class="death-panel" role="dialog" aria-modal="true" aria-labelledby="death-title"><div class="panel-eyebrow">L’AVENTURE N’EST PAS FINIE</div><h2 id="death-title">Retour à la terre<span>.</span></h2><p>Le monde a eu le dernier mot.<br>Pour cette fois.</p><div class="death-stats"><span>JOUR <b>${s.day || 1}</b></span><span>DÉCOUVERTES <b>${(s.discovered || []).length} / ${itemList.length}</b></span></div><button class="button primary" data-action="respawn"><span>Revenir dans le monde</span>${ARROW}</button><button class="text-button" data-action="menu">Retour au menu</button></section>`;
  }

  handleClick(event) {
    const button = event.target.closest("button,[data-action]");
    if (!button || button.disabled) return;
    const { action, slot, tab, item, craft } = button.dataset;
    if (slot != null) {
      if (button.classList.contains("hotbar-slot") && !this.overlayKind) return;
      this.state.selected = Number(slot);
      this.callbacks.onSelect?.(Number(slot));
      this.update(this.state);
      return;
    }
    if (tab) {
      this.inventoryTab = tab;
      this.inspectedId = null;
      this.renderInventory();
      return;
    }
    if (item) {
      this.inspectedId = item;
      if (
        this.inventoryTab === "inventory" &&
        quantity(this.state.inventory, item) > 0
      )
        this.callbacks.onAssign?.(item, this.state.selected || 0);
      this.renderInventory();
      return;
    }
    if (craft) {
      this.callbacks.onCraft?.(craft);
      return;
    }
    switch (action) {
      case "noop":
        event.preventDefault();
        break;
      case "play":
      case "creative":
      case "continue":
        this.callbacks.onPlay?.({
          mode:
            action === "creative"
              ? "creative"
              : action === "continue"
                ? this.state.mode || "survival"
                : "survival",
          seed: this.overlay.querySelector("#world-seed")?.value.trim() || "",
          continueSave: action === "continue",
        });
        break;
      case "random-seed": {
        const input = this.overlay.querySelector("#world-seed");
        if (input) input.value = String(Math.floor(Math.random() * 999999999));
        break;
      }
      case "resume":
        this.callbacks.onResume?.();
        break;
      case "desktop":
        this.callbacks.onDesktop?.();
        break;
      case "retry-capture":
        this.callbacks.onRetryCapture?.();
        break;
      case "save":
        this.callbacks.onSave?.();
        break;
      case "menu":
        this.callbacks.onMenu?.();
        break;
      case "respawn":
        (this.callbacks.onRespawn || this.callbacks.onResume)?.();
        break;
      case "new-confirm":
        this.overlay.querySelector(".new-game-confirm").hidden = false;
        button.hidden = true;
        break;
      case "new-cancel":
        this.overlay.querySelector(".new-game-confirm").hidden = true;
        this.overlay.querySelector('[data-action="new-confirm"]').hidden =
          false;
        break;
      case "new-game":
        this.callbacks.onNewGame?.(
          this.overlay.querySelector("#new-seed")?.value.trim() || "",
          this.state.mode || "survival",
        );
        break;
      case "equip":
        if (
          this.inspectedId &&
          quantity(this.state.inventory, this.inspectedId) > 0
        )
          this.callbacks.onAssign?.(this.inspectedId, this.state.selected || 0);
        break;
      default:
        break;
    }
  }

  handleInput(event) {
    if (event.target.hasAttribute("data-volume")) {
      this.volume = Number(event.target.value);
      const output = event.target.parentElement.querySelector("output");
      if (output) output.textContent = `${Math.round(this.volume * 100)} %`;
      this.callbacks.onVolume?.(this.volume);
    }
    if (event.type === "change" && event.target.hasAttribute("data-music")) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.callbacks.onMusicFile?.(file);
      const label = this.overlay.querySelector(".music-filename");
      if (label) label.textContent = `Radio : ${file.name}`;
    }
  }

  notify(
    text,
    { title = "", icon: toastIcon = "", tone = "info", duration = 4200 } = {},
  ) {
    if (this.disposed) return;
    const toast = document.createElement("div");
    toast.className = `game-toast toast-${tone}`;
    let visual = "";
    if (toastIcon)
      visual = itemMap.has(toastIcon)
        ? icon(toastIcon)
        : `<img class="item-icon" src="${escape(toastIcon)}" alt="" />`;
    toast.innerHTML = `${visual ? `<div class="toast-icon">${visual}</div>` : '<span class="toast-marker"></span>'}<div>${title ? `<strong>${escape(title)}</strong>` : ""}<p>${escape(text)}</p></div>`;
    this.el.querySelector(".toast-stack").appendChild(toast);
    this.toasts.push(toast);
    while (this.toasts.length > 3) this.toasts.shift()?.remove();
    const timer = setTimeout(() => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 300);
      this.toasts = this.toasts.filter((t) => t !== toast);
    }, duration);
    toast._timer = timer;
  }

  toggleDebug() {
    this.debugVisible = !this.debugVisible;
    this.el.querySelector(".debug-panel").hidden = !this.debugVisible;
    this.update();
    return this.debugVisible;
  }

  damageFlash() {
    const node = this.el.querySelector(".damage-vignette");
    node.classList.remove("flash");
    void node.offsetWidth;
    node.classList.add("flash");
  }

  dispose() {
    this.disposed = true;
    this.toasts.forEach((toast) => clearTimeout(toast._timer));
    this.el.removeEventListener("click", this.onClick);
    this.el.removeEventListener("input", this.onInput);
    this.el.removeEventListener("change", this.onInput);
    this.el.remove();
  }
}

export default GameUI;
