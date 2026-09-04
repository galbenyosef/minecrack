export const BLOCKS = new Set([
  "grass",
  "dirt",
  "stone",
  "sand",
  "wood",
  "leaves",
  "ore",
  "lucky",
]);
export const RECIPES = {
  pickaxe: { wood: 4, stone: 3 },
  chocolatine: { wood: 3 },
  furry: { cuir: 5 },
  lucky: { ore: 8, stone: 4 },
};
export class Inventory {
  constructor(creative = false) {
    this.counts = creative
      ? {
          pickaxe: 1,
          grass: 99,
          stone: 99,
          lucky: 30,
          chocolatine: 20,
          wood: 99,
          ore: 50,
        }
      : { pickaxe: 1, grass: 12, dirt: 8, chocolatine: 3 };
    this.slots = [
      "pickaxe",
      "grass",
      "dirt",
      "chocolatine",
      null,
      null,
      null,
      null,
      null,
    ];
    this.selected = 0;
  }
  add(id, n = 1) {
    if (n <= 0) return;
    this.counts[id] = (this.counts[id] || 0) + n;
    if (!this.slots.includes(id)) {
      const i = this.slots.indexOf(null);
      if (i >= 0) this.slots[i] = id;
    }
  }
  remove(id, n = 1) {
    if (!Number.isInteger(n) || n <= 0 || (this.counts[id] || 0) < n)
      return false;
    this.counts[id] -= n;
    return true;
  }
  get active() {
    return this.slots[this.selected];
  }
  get hotbar() {
    return this.slots.map((id) =>
      id ? { id, count: this.counts[id] || 0 } : null,
    );
  }
  canCraft(id) {
    const recipe = RECIPES[id];
    return (
      !!recipe &&
      Object.entries(recipe).every(([k, v]) => (this.counts[k] || 0) >= v)
    );
  }
  craft(id) {
    if (!this.canCraft(id)) return false;
    for (const [k, v] of Object.entries(RECIPES[id])) this.remove(k, v);
    this.add(id);
    return true;
  }
  serialize() {
    return {
      counts: { ...this.counts },
      slots: [...this.slots],
      selected: this.selected,
    };
  }
  restore(data, allowed) {
    if (!data || !data.counts || !Array.isArray(data.slots)) return false;
    const entries = Object.entries(data.counts).filter(
      ([id, n]) =>
        allowed.has(id) && Number.isInteger(n) && n >= 0 && n <= 999999,
    );
    this.counts = Object.fromEntries(entries);
    this.slots = Array.from({ length: 9 }, (_, i) =>
      allowed.has(data.slots[i]) ? data.slots[i] : null,
    );
    this.selected = Math.max(0, Math.min(8, Number(data.selected) || 0));
    return true;
  }
}
