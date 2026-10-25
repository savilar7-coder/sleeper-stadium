import { DPR, TILE, panelOpen, setVillageZoom, villageZoom } from "./core.js";
import { sfx } from "./sfx.js";
class World extends Phaser.Scene {
  jumpPass(pl, z) {
    if (z === this.ghostZone) {
      const b = pl.body, inside = b.right > z.x - z.width / 2 && b.left < z.x + z.width / 2 && b.bottom > z.y - z.height / 2 && b.top < z.y + z.height / 2;
      if (inside) return false;
      this.ghostZone = null;
    }
    return !((this.airH || 0) > 10 && z.height <= 20);
  }
  addBlocker(x, y, w, h) {
    const z = this.add.zone(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(z, true);
    this.blockers.add(z);
  }
  label(x, y, text, color = "#fff4d6", style = {}) {
    return this.keepReadable(this.add.text(x, y, text, {
      fontFamily: "Pixelify Sans, Segoe UI, sans-serif",
      fontSize: `${Math.round(13 * DPR)}px`,
      color,
      backgroundColor: "rgba(52,34,20,0.92)",
      padding: { x: Math.round(5 * DPR), y: Math.round(2 * DPR) },
      stroke: "#1d140c",
      strokeThickness: Math.round(2 * DPR),
      resolution: 1,
      ...style
    }).setOrigin(0.5, 1).setDepth(1e5));
  }
  keepReadable(t) {
    (this.uiTexts = this.uiTexts || []).push(t);
    return t.setScale(this.uiScale || 1);
  }
  applyUiScale() {
    this.uiScale = 1 / this.cameras.main.zoom;
    this.uiTexts = (this.uiTexts || []).filter((t) => t.active);
    for (const t of this.uiTexts) t.setScale(this.uiScale);
    const k = DPR * this.uiScale;
    const far = this.logicalZoom() < 0.75;
    if (this.npcs) for (const n of this.npcs.values()) {
      n.dot.setScale(1.6 * k).setX(n.bubble.x - n.bubble.displayWidth / 2 - 7 * k);
      n.bubble.setVisible(!far || n.working);
      n.dot.setVisible(!far || n.working);
    }
  }
  walkTo(x, y) {
    if (panelOpen || this.entering) return;
    this.route = this.pathTo(this.player, { x, y });
    this.target = this.route.shift();
  }
  logicalZoom() {
    return villageZoom || this.cameras.main.zoom / DPR;
  }
  bubble(x, y, text, style = {}) {
    return this.keepReadable(this.add.text(x, y, text, {
      fontFamily: "Pixelify Sans, Segoe UI, sans-serif",
      fontSize: `${Math.round(11 * DPR)}px`,
      color: "#2b1d12",
      backgroundColor: "rgba(255,250,236,0.96)",
      padding: { x: Math.round(5 * DPR), y: Math.round(2 * DPR) },
      resolution: 1,
      ...style
    }).setOrigin(0.5, 1).setDepth(1e5));
  }
  setZoom(z) {
    const b = this.cameras.main.getBounds(), minCam = Math.max(this.scale.width / b.width, this.scale.height / b.height, 0.4 * DPR);
    setVillageZoom(Phaser.Math.Clamp(z, minCam / DPR, 3.5));
    this.cameras.main.setZoom(villageZoom * DPR);
    if (this.player) this.cameras.main.centerOn(this.player.x, this.player.y);
    this.applyUiScale();
  }
  jump() {
    if (this.jumping || this.entering || panelOpen) return;
    this.jumping = true;
    sfx.jump();
    const st = { h: 0 }, calm = !!window.__calm, H = calm ? 14 : 36;
    const set = () => {
      this.airH = st.h;
      this.player.setOrigin(0.5, 1 + st.h / this.player.height);
      this.player.body.setOffset(9, this.player.height - 8 + st.h);
    };
    this.tweens.add({ targets: st, h: H, duration: calm ? 170 : 320, ease: "Sine.easeOut", onUpdate: set, onComplete: () => {
      this.tweens.add({ targets: st, h: H * 0.92, duration: calm ? 0 : 140, yoyo: true, ease: "Sine.easeInOut", onUpdate: set, onComplete: () => {
        this.tweens.add({ targets: st, h: 0, duration: calm ? 170 : 280, ease: "Quad.easeIn", onUpdate: set, onComplete: () => {
          this.player.setOrigin(0.5, 1);
          this.player.body.setOffset(9, this.player.height - 8);
          this.jumping = false;
          this.airH = 0;
          const b = this.player.body;
          this.ghostZone = (this.blockers ? this.blockers.getChildren() : []).find((z) => z.height <= 20 && b.right > z.x - z.width / 2 && b.left < z.x + z.width / 2 && b.bottom > z.y - z.height / 2 && b.top < z.y + z.height / 2) || null;
          if (calm) return;
          if (this.feel) {
            this.feel.sqx = 1.16;
            this.feel.sqy = 0.84;
          }
          for (const side of [-1, 1]) {
            const d = this.add.circle(this.player.x + side * 6, this.player.y - 2, 3, 15326400, 0.7).setDepth(this.player.y - 1);
            this.tweens.add({ targets: d, x: d.x + side * 10, y: d.y - 3, scale: 2.2, alpha: 0, duration: 420, onComplete: () => d.destroy() });
          }
        } });
      } });
    } });
  }
  pop(x, y, text, color = "#ffe08a") {
    const t = this.label(x, y, text, color).setDepth(100002);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, delay: 3e3, duration: 1500, onComplete: () => t.destroy() });
  }
  buildWalkGrid() {
    const { mapW, mapH } = this.grid;
    const free = new Uint8Array(mapW * mapH).fill(1);
    for (const z of this.blockers.getChildren()) {
      const x0 = Math.floor((z.x - z.width / 2 + 2) / TILE), x1 = Math.floor((z.x + z.width / 2 - 2) / TILE);
      const y0 = Math.floor((z.y - z.height / 2 + 2) / TILE), y1 = Math.floor((z.y + z.height / 2 - 2) / TILE);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < mapW && y < mapH) free[y * mapW + x] = 0;
    }
    this.free = free;
  }
  findPath(from, goal) {
    const { mapW, mapH } = this.grid, free = this.free;
    if (!free) return null;
    const tileOf = (p) => [Phaser.Math.Clamp(Math.floor(p.x / TILE), 0, mapW - 1), Phaser.Math.Clamp(Math.floor((p.y - 4) / TILE), 0, mapH - 1)];
    const [sx, sy] = tileOf(from);
    let [gx, gy] = tileOf(goal);
    if (!free[gy * mapW + gx]) {
      for (let d = 1; d < 4 && !free[gy * mapW + gx]; d++) if (gy + 1 < mapH) gy++;
      if (!free[gy * mapW + gx]) return null;
    }
    const start = sy * mapW + sx, end = gy * mapW + gx;
    const prev = new Int32Array(mapW * mapH).fill(-1);
    const q = [start];
    prev[start] = start;
    for (let h = 0; h < q.length && prev[end] < 0; h++) {
      const c = q[h], cx = c % mapW, cy = (c - cx) / mapW;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, n = ny * mapW + nx;
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH || prev[n] >= 0 || !free[n] && n !== end) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    if (prev[end] < 0) return null;
    const cells = [];
    for (let c = end; c !== start; c = prev[c]) cells.push(c);
    cells.reverse();
    const pts = [];
    let lastDir = null;
    let prevCell = start;
    for (const c of cells) {
      const dir = c - prevCell;
      if (dir !== lastDir && prevCell !== start) pts.push(prevCell);
      lastDir = dir;
      prevCell = c;
    }
    const out = pts.map((c) => ({ x: c % mapW * TILE + 16, y: Math.floor(c / mapW) * TILE + 22 }));
    out.push(goal);
    return out;
  }
}
export {
  World
};
