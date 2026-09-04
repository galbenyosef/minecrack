/** Hold-to-use timing and effects. The game owns inventory and health changes. */
export const ITEM_USES = Object.freeze({
  chocolatine: Object.freeze({ id: "chocolatine", duration: 1.25, kind: "eat", hunger: 32, health: 22, bites: 5 }),
  cb12: Object.freeze({ id: "cb12", duration: 1.6, kind: "eat", hunger: 65, health: 35, bites: 5 }),
  impots: Object.freeze({ id: "impots", duration: 0.9, kind: "read", buffDuration: 18, bites: 0 }),
});

export const getItemUse = (id) => Object.hasOwn(ITEM_USES, id) ? ITEM_USES[id] : null;
const validCount = (count) => Number.isFinite(count) && count > 0;

/**
 * begin() explicitly starts one use. update() never starts another by itself.
 * On completion, consume the item in the game before beginning the next one;
 * the id/count latch prevents repeat transactions on a stale inventory count.
 */
export class ItemUse {
  constructor() {
    this.cancel();
  }
  begin(id, { count = 0, canUse = true } = {}) {
    const descriptor = getItemUse(id);
    if (!descriptor || !validCount(count) || !canUse) {
      this.cancel();
      return false;
    }
    if (this.active && this.id === id) return true;
    if (this.completed?.id === id && this.completed.count === count) return false;
    this.id = id;
    this.kind = descriptor.kind;
    this.duration = descriptor.duration;
    this.count = count;
    this.elapsed = 0;
    this.progress = 0;
    this.bites = 0;
    this.active = true;
    this.completed = null;
    return true;
  }
  cancel() {
    this.id = null;
    this.kind = null;
    this.count = 0;
    this.duration = 0;
    this.elapsed = 0;
    this.progress = 0;
    this.bites = 0;
    this.active = false;
    this.completed = null;
  }
  update(dt, { held = true, id = this.id, count = this.count, canUse = true } = {}) {
    const idle = () => ({ completedId: null, progress: 0, active: false, justBite: false, kind: null, id: null });
    if (!held || !canUse || !validCount(count) || (this.active && id !== this.id)) {
      this.cancel();
      return idle();
    }
    if (!this.active) return idle();
    this.count = count;
    this.elapsed += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    if (this.duration - this.elapsed < 1e-9) this.elapsed = this.duration;
    this.progress = Math.min(1, this.elapsed / this.duration);
    const descriptor = getItemUse(this.id);
    const bites = Math.floor(this.progress * descriptor.bites + 1e-9);
    const justBite = bites > this.bites;
    this.bites = bites;
    const finished = this.progress >= 1;
    const result = {
      completedId: finished ? this.id : null,
      progress: this.progress,
      active: !finished,
      justBite,
      kind: this.kind,
      id: this.id,
    };
    if (finished) {
      this.completed = { id: this.id, count };
      this.active = false;
    }
    return result;
  }
}
