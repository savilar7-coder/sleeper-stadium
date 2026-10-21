import { $, DPR, SPEED, TILE, panelOpen, rng, setVillageZoom, villageZoom } from "./core.js";
import { makeTextures, preloadArt } from "./art.js";
import { makeDecorTextures, preloadDecor, shadowFor } from "./decor.js";
import { el, openPanel } from "./panel.js";
import { drivePlayer, setupTouch } from "./touch.js";
import { sfx } from "./sfx.js";
import { World } from "./world.js";
let ROW = 5;
const sweatActive = (L) => {
  if (/[?&]sweat=1/.test(location.search)) return true;
  const st = Object.values(L && L.games || {}), left = st.filter((x) => x !== "complete").length / 2;
  return st.length > 0 && left > 0 && left <= 2;
};
const RAVENS = ["#241773", "#241773", "#2e1f8f", "#000000", "#9e7c0c", "#c9a227"];
let MAP_W = 22;
const TEAM_END_ZONES = true;
let MAP_H = 49;
const FIELD = { x0: 4, x1: 17, y0: 4, y1: 44 };
const LOOKS = [
  "Knight",
  "Samurai",
  "NinjaBlue",
  "NinjaRed",
  "FighterRed",
  "FighterWhite",
  "GladiatorBlue",
  "RedGladiator",
  "KnightGold",
  "SamuraiBlue",
  "NinjaFire",
  "NinjaGreen",
  "MonkeyBoxerBlue",
  "MonkeyBoxerRed",
  "LionBoy",
  "RobotGreen",
  "NinjaYellow",
  "Hunter",
  "CamouflageGreen",
  "Eskimo"
];
const FB_KITS = [
  ["#c8102e", "#ffffff", "#c8102e", "#e8435a", "#8a0b20", "#ffffff", "#f4f1ea"],
  ["#0b2265", "#a5acaf", "#0b2265", "#25408f", "#06153f", "#ffffff", "#a5acaf"],
  ["#203731", "#ffb612", "#203731", "#2f5447", "#14231f", "#ffb612", "#f4f1ea"],
  ["#fb4f14", "#ffffff", "#fb4f14", "#ff7a45", "#b8380c", "#ffffff", "#f4f1ea"],
  ["#006778", "#101820", "#006778", "#14899e", "#004450", "#ffffff", "#f4f1ea"],
  ["#0085ca", "#ffffff", "#0085ca", "#33a4dd", "#005b8a", "#ffffff", "#f4f1ea"],
  ["#773141", "#ffb612", "#773141", "#9a4458", "#4f202b", "#ffb612", "#ffb612"],
  ["#101820", "#a5acaf", "#101820", "#2a3440", "#05090d", "#a5acaf", "#a5acaf"],
  ["#4f2683", "#ffc62f", "#4f2683", "#6b3fa8", "#33175a", "#ffc62f", "#f4f1ea"],
  ["#69be28", "#002244", "#002244", "#123a63", "#00142a", "#69be28", "#a5acaf"],
  ["#e31837", "#ffb81c", "#e31837", "#f04a63", "#9e0f25", "#ffb81c", "#f4f1ea"],
  ["#002c5f", "#ff8200", "#002c5f", "#16467f", "#001a3a", "#ff8200", "#f4f1ea"]
];
;
const shade = (hex, f) => "#" + [1, 3, 5].map((i) => {
  const v = parseInt(hex.slice(i, i + 2), 16), t = f > 0 ? 255 : 0;
  return Math.round(v + (t - v) * Math.abs(f)).toString(16).padStart(2, "0");
}).join("");
class StadiumScene extends World {
  constructor() {
    super("stadium");
  }
  init(data) {
    this.league = data.league;
    const rows = (this.league.pairs || []).length || 6;
    ROW = sweatActive(this.league) ? 7 : 6;
    const wide = window.innerWidth >= 600 && !/[?&]wide=0/.test(location.search);
    MAP_W = wide ? Phaser.Math.Clamp(Math.round(27 * window.innerWidth / window.innerHeight), 22, 30) : 22;
    FIELD.x1 = MAP_W - 5;
    FIELD.y1 = Math.max(44, FIELD.y0 + 7 + (rows - 1) * ROW + 8);
    MAP_H = FIELD.y1 + 5;
  }
  preload() {
    preloadArt(this, true);
    preloadDecor(this, true);
    for (const t of this.league.teams) if (!["Dumpster", "Steeler", "Raven", "Shorty"].includes(t.look) && !/^FB\d+$/.test(t.look) && !this.textures.exists(`a-ch-${t.look}`)) this.load.image(`a-ch-${t.look}`, `assets/chars/${t.look}.png`);
  }
  create() {
    this.uiTexts = [];
    this.uiScale = 1;
    makeTextures(this);
    makeDecorTextures(this);
    this.makeFootballer();
    const W = MAP_W * TILE, H = MAP_H * TILE;
    this.physics.world.setBounds(0, 0, W, H);
    this.cameras.main.setBounds(0, 0, W, H).setBackgroundColor("#20262e");
    this.paintStadium(W, H);
    this.walkable = (tx, ty) => tx >= FIELD.x0 - 1 && tx <= FIELD.x1 + 1 && ty >= FIELD.y0 - 1 && ty <= FIELD.y1 + 1;
    this.blockers = this.physics.add.staticGroup();
    for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; ) {
      if (this.walkable(tx, ty)) {
        tx++;
        continue;
      }
      const s0 = tx;
      while (tx < MAP_W && !this.walkable(tx, ty)) tx++;
      this.addBlocker(s0 * TILE, ty * TILE, (tx - s0) * TILE, TILE);
    }
    this.doors = [];
    this.npcs = new Map();
    this.teamSprites = new Map();
    this.placeTeams();
    this.addLife();
    this.addProps();
    this.nightLights(W, H);
    this.player = this.physics.add.sprite(((FIELD.x0 + FIELD.x1 + 1) / 2 + 3.2) * TILE, (FIELD.y0 + 10.2) * TILE, "playerup0").setOrigin(0.5, 1);
    this.player.body.setSize(14, 8).setOffset(9, 24);
    this.player.setScale(1.5);
    this.youRing = this.add.ellipse(0, 0, 44, 16, 16767050, 0.35).setStrokeStyle(2, 16767050, 0.9);
    this.youTag = this.label(0, 0, "\u25C0 YOU", "#1d140c").setStyle({ backgroundColor: "#ffd84a" }).setFontSize(Math.round(15 * DPR));
    const picked = this.league.teams.some((t) => t.mine);
    this.youRing.setVisible(picked);
    this.youTag.setVisible(picked).setDepth(99990);
    this.facing = "up";
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.blockers);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.spawnOffY = window.innerWidth < 600 ? 0 : 40;
    this.cameras.main.setFollowOffset(3.2 * TILE, this.spawnOffY);
    this.spawnOffset = true;
    const fitZoom = () => this.setZoom(villageZoom || this.fitZoom());
    fitZoom();
    this.scale.on("resize", fitZoom);
    this.events.once("shutdown", () => this.scale.off("resize", fitZoom));
    this.keys = this.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT");
    this.input.keyboard.on("keydown-SPACE", () => this.jump());
    this.input.keyboard.on("keydown-E", () => {
      if (!panelOpen && this.near) this.near.open();
    });
    this.events.once("shutdown", () => {
      this.input.keyboard.off("keydown-E");
      this.input.keyboard.off("keydown-SPACE");
    });
    setupTouch(this, (w) => {
      const door = this.doors.find((d) => Phaser.Math.Distance.Between(w.x, w.y, d.x, d.y - 30) < 60);
      this.route = this.pathTo(this.player, door ? { x: door.x, y: door.y, door } : { x: w.x, y: w.y });
      this.target = this.route.shift();
    });
    let lastTap = 0, lastXY = null;
    this.input.on("pointerup", (p) => {
      if (panelOpen || p.getDuration() > 300) return;
      const now = this.time.now, near = lastXY && Math.hypot(p.x - lastXY.x, p.y - lastXY.y) < 40 * DPR;
      if (now - lastTap < 320 && near) {
        lastTap = 0;
        const fit = this.fitZoom();
        this.setZoom(this.logicalZoom() < fit * 1.4 ? fit * 2 : fit);
        return;
      }
      lastTap = now;
      lastXY = { x: p.x, y: p.y };
    });
    this.grid = { mapW: MAP_W, mapH: MAP_H };
    this.buildWalkGrid();
    this.ambient = { shadows: new Map() };
    this.near = null;
    this.promptKey = "";
  }
  pathTo(from, goal) {
    return this.findPath(from, goal) || [goal];
  }
  fitZoom() {
    if (window.innerWidth < 600) return 0.86;
    return Math.min(window.innerWidth / (MAP_W * TILE), window.innerHeight / (19 * TILE));
  }
  setZoom(z) {
    const W = MAP_W * TILE, H = MAP_H * TILE, fitAll = Math.min(this.scale.width / W, this.scale.height / H);
    const allRows = window.innerHeight / ((ROW * Math.max(1, this.rows || 1) + 10) * TILE);
    const least = window.innerWidth < 600 ? fitAll / DPR : Math.max(fitAll / DPR, Math.min(this.fitZoom() * 0.75, allRows));
    this.applyZoom(Phaser.Math.Clamp(z, Math.max(0.3, least), 2.5));
    if (this.zoomSettle) this.zoomSettle.remove();
    if (this.zoomTween) this.zoomTween.stop();
    this.zoomSettle = this.time.delayedCall(160, () => {
      const target = Math.max(0.5, Math.round(villageZoom * DPR * 2)) / (2 * DPR), o = { z: villageZoom };
      if (Math.abs(target - villageZoom) < 2e-3) return;
      this.zoomTween = this.tweens.add({ targets: o, z: target, duration: 140, ease: "Sine.easeOut", onUpdate: () => this.applyZoom(o.z) });
    });
  }
  applyZoom(z) {
    const cam = this.cameras.main, W = MAP_W * TILE, H = MAP_H * TILE;
    setVillageZoom(z);
    cam.setZoom(z * DPR);
    const inset = window.innerWidth < 600 ? Math.round(100 * DPR) : 0;
    cam.setViewport(0, 0, this.scale.width, this.scale.height - inset);
    const vw = this.scale.width / cam.zoom, vh = (this.scale.height - inset) / cam.zoom;
    cam.setBounds(Math.min(0, (W - vw) / 2), Math.min(0, (H - vh) / 2), Math.max(W, vw), Math.max(H, vh));
    this.applyUiScale();
  }
  applyUiScale() {
    const fieldPx = (FIELD.x1 - FIELD.x0 + 3) * TILE * this.logicalZoom(), phonePx = 17 * TILE * 0.86;
    this.uiScale = 1 / this.cameras.main.zoom * Math.min(1, Math.max(0.6, fieldPx / phonePx));
    this.uiTexts = (this.uiTexts || []).filter((t) => t.active);
    for (const t of this.uiTexts) t.setScale(this.uiScale);
  }
  paintStadium(W, H) {
    if (this.textures.exists("ground")) this.textures.remove("ground");
    const ct = this.textures.createCanvas("ground", W, H), g = ct.getContext(), r = rng(2023), T = TILE;
    const rr = (x, y, w, h, rad) => {
      g.beginPath();
      g.roundRect(x, y, w, h, Math.min(rad, w / 2, h / 2));
    };
    const fx = (FIELD.x0 - 1) * T, fy = (FIELD.y0 - 1) * T, fw = (FIELD.x1 - FIELD.x0 + 3) * T, fh = (FIELD.y1 - FIELD.y0 + 3) * T;
    g.fillStyle = "#20262e";
    g.fillRect(0, 0, W, H);
    const tiers = 9, outer = 6, inner = fx - 14;
    for (let k = 0; k <= tiers; k++) {
      const inset = outer + (inner - outer) * k / tiers, shade2 = 0.55 + 0.45 * (k / tiers);
      const c = Math.round(64 * shade2), c2 = Math.round(72 * shade2), c3 = Math.round(84 * shade2);
      g.fillStyle = `rgb(${c},${c2},${c3})`;
      rr(inset, inset, W - inset * 2, H - inset * 2, (W - inset * 2) / 2);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.07)";
      g.lineWidth = 1;
      rr(inset + 3, inset + 3, W - inset * 2 - 6, H - inset * 2 - 6, (W - inset * 2 - 6) / 2);
      g.stroke();
    }
    g.fillStyle = "#14181d";
    rr(0, 0, W, H, W / 2);
    g.lineWidth = 8;
    g.strokeStyle = "#14181d";
    g.stroke();
    const fan = ["#d9e1e8", "#e8a33d", "#3d6fb6", "#c94a4a", "#4f9a5a", "#f2e6c9", "#1d1d22", "#ffb612"];
    const skins = ["#f1c6a4", "#e3b08a", "#c98d68", "#8d5a3b", "#5c3a26"], hairs = ["#1d140c", "#3a2a1e", "#6b4423", "#c9a227", "#2a2420", "#8a8f98"];
    const inBowl = (x, y, inset) => {
      g.beginPath();
      g.roundRect(inset, inset, W - inset * 2, H - inset * 2, (W - inset * 2) / 2);
      return g.isPointInPath(x, y);
    };
    for (let y = 10; y < H - 10; y += 12) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(0, y + 10, W, 2);
      for (let x = 6; x < W - 6; x += 8) {
        if (!inBowl(x, y, outer + 8) || inBowl(x, y, inner - 4)) continue;
        const aisle = Math.floor((x + (y > H / 2 ? 0 : 4)) / 8) % 9 === 0;
        if (aisle) {
          g.fillStyle = "#8a9099";
          g.fillRect(x, y, 7, 12);
          g.fillStyle = "#6e747d";
          g.fillRect(x, y + 5, 7, 1);
          g.fillRect(x, y + 10, 7, 1);
          continue;
        }
        if (r() < 0.12) {
          g.fillStyle = x < W / 2 ? "#2e1f8f" : "#3a4250";
          g.fillRect(x + 1, y + 6, 6, 5);
          continue;
        }
        const near = !inBowl(x, y, (outer + inner) / 2);
        g.globalAlpha = near ? 1 : 0.78;
        const shirt = x < W / 2 ? RAVENS[Math.floor(r() * RAVENS.length)] : fan[Math.floor(r() * fan.length)];
        g.fillStyle = hairs[Math.floor(r() * hairs.length)];
        g.fillRect(x + 2, y, 4, 2);
        g.fillStyle = skins[Math.floor(r() * skins.length)];
        g.fillRect(x + 2, y + 2, 4, 3);
        g.fillStyle = shirt;
        g.fillRect(x + 1, y + 5, 6, 5);
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(x + 6, y + 5, 1, 5);
        if (r() < 0.14) {
          g.fillStyle = shirt;
          g.fillRect(x + 2, y - 1, 4, 2);
          g.fillRect(x + 5, y + 1, 2, 1);
        } else if (r() < 0.25) {
          g.fillStyle = "rgba(244,241,234,0.85)";
          g.fillRect(x + 1, y + 7, 6, 1);
        }
        if (r() < 0.08) {
          g.fillStyle = "#ffd84a";
          g.fillRect(x + 6, y - 3, 2, 4);
        }
        g.globalAlpha = 1;
      }
    }
    for (const [lx, ly] of [[14, 14], [W - 34, 14], [14, H - 50], [W - 34, H - 50]]) {
      g.fillStyle = "#3a3f47";
      g.fillRect(lx + 8, ly + 14, 4, 30);
      g.fillStyle = "#1d1d22";
      g.fillRect(lx, ly, 20, 14);
      g.fillStyle = "#fff6c8";
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillRect(lx + 2 + i * 6, ly + 2 + j * 6, 4, 4);
    }
    {
      const kitOf0 = (t) => {
        const m = t && /^FB(\d+)$/.exec(t.look || "");
        return m ? FB_KITS[Number(m[1]) % FB_KITS.length] : null;
      };
      const top2 = [...this.league.teams || []].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts).slice(0, 2).map(kitOf0);
      const cols = TEAM_END_ZONES && top2[0] && top2[1] ? [top2[0][2], top2[0][5], top2[1][2], top2[1][5]] : ["#241773", "#c9a227", "#241773", "#e8e2d0"];
      const ring = (d) => {
        g.roundRect(fx - d, fy - d, fw + 2 * d, fh + 2 * d, (fw + 2 * d) / 2.6);
      };
      g.save();
      g.beginPath();
      ring(26);
      ring(15);
      g.clip("evenodd");
      g.fillStyle = "#0d0f13";
      g.fillRect(fx - 30, fy - 30, fw + 60, fh + 60);
      g.beginPath();
      ring(24);
      ring(17);
      g.clip("evenodd");
      for (let y = fy - 30, i = 0; y < fy + fh + 30; y += 56, i++) {
        g.fillStyle = cols[i % 4];
        g.fillRect(fx - 30, y, fw + 60, 54);
      }
      for (let y = fy - 30; y < fy + fh + 30; y += 2) {
        g.fillStyle = "rgba(0,0,0,0.28)";
        g.fillRect(fx - 30, y, fw + 60, 1);
      }
      for (let x = fx - 30; x < fx + fw + 30; x += 2) {
        g.fillStyle = "rgba(0,0,0,0.18)";
        g.fillRect(x, fy - 30, 1, fh + 60);
      }
      g.restore();
      g.strokeStyle = "rgba(255,255,255,0.18)";
      g.lineWidth = 1;
      g.beginPath();
      ring(26);
      g.stroke();
    }
    g.fillStyle = "#5a3424";
    rr(fx - 14, fy - 14, fw + 28, fh + 28, (fw + 28) / 2.6);
    g.fill();
    g.fillStyle = "#b45a3c";
    rr(fx - 10, fy - 10, fw + 20, fh + 20, (fw + 20) / 2.6);
    g.fill();
    g.save();
    rr(fx, fy, fw, fh, fw / 2.6);
    g.clip();
    const ez = 2 * T, band = (fh - 2 * ez) / 20;
    for (let i = -2; i * band < fh; i++) {
      g.fillStyle = (i + 20) % 2 ? "#3f8a3a" : "#4b9c44";
      g.fillRect(fx, fy + ez + i * band, fw, Math.ceil(band));
    }
    for (let x = 0; x < fw; x += 2 * T) {
      g.fillStyle = "rgba(255,255,255,0.035)";
      g.fillRect(fx + x, fy, T, fh);
    }
    for (let i = 0; i < fw * fh / 90; i++) {
      g.fillStyle = r() < 0.5 ? "rgba(20,60,20,0.22)" : "rgba(170,230,140,0.12)";
      g.fillRect(fx + Math.floor(r() * fw / 2) * 2, fy + Math.floor(r() * fh / 2) * 2, 2, 2);
    }
    const kitOf = (t) => {
      const m = t && /^FB(\d+)$/.exec(t.look || "");
      return m ? FB_KITS[Number(m[1]) % FB_KITS.length] : null;
    };
    const table = [...this.league.teams || []].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
    const k1 = TEAM_END_ZONES ? kitOf(table[0]) : null, k2 = TEAM_END_ZONES ? kitOf(table[1]) : null;
    const endZone = (y, kit, fallback) => {
      g.fillStyle = kit ? kit[2] : fallback;
      g.fillRect(fx, y, fw, ez);
      if (!kit) return;
      g.save();
      g.beginPath();
      g.rect(fx, y, fw, ez);
      g.clip();
      g.strokeStyle = kit[3];
      g.globalAlpha = 0.7;
      g.lineWidth = 6;
      for (let x = fx - ez; x < fx + fw + ez; x += 22) {
        g.beginPath();
        g.moveTo(x, y + ez);
        g.lineTo(x + ez, y);
        g.stroke();
      }
      g.restore();
    };
    endZone(fy, k1, "#241773");
    endZone(fy + fh - ez, k2, "#b8402f");
    const sh = g.createLinearGradient(fx, 0, fx + 46, 0);
    sh.addColorStop(0, "rgba(0,0,0,0.32)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh;
    g.fillRect(fx, fy, 46, fh);
    const sh2 = g.createLinearGradient(fx + fw, 0, fx + fw - 30, 0);
    sh2.addColorStop(0, "rgba(0,0,0,0.22)");
    sh2.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh2;
    g.fillRect(fx + fw - 30, fy, 30, fh);
    const sh3 = g.createLinearGradient(0, fy, 0, fy + 70);
    sh3.addColorStop(0, "rgba(0,0,0,0.3)");
    sh3.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sh3;
    g.fillRect(fx, fy, fw, 70);
    g.restore();
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    rr(fx + 2, fy + 2, fw - 4, fh - 4, (fw - 4) / 2.6);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.font = '600 18px "Pixelify Sans", sans-serif';
    g.textAlign = "left";
    for (let i = 1; i <= 9; i++) {
      const y = fy + ez + (fh - 2 * ez) * i / 10;
      g.fillRect(fx + 4, y - 1, fw - 8, 3);
      g.font = '600 22px "Pixelify Sans", sans-serif';
      const num = String(i <= 5 ? i * 10 : (10 - i) * 10);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillText(num, fx + 10, y - 4);
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillText(num, fx + 8, y - 6);
      g.fillStyle = "rgba(255,255,255,0.35)";
    }
    {
      const top = fy + ez, len = fh - 2 * ez;
      g.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 1; i < 100; i++) {
        if (i % 10 === 0) continue;
        const y = top + len * i / 100;
        for (const hx of [fx + 10, fx + fw - 18]) g.fillRect(hx, y, 8, 2);
      }
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.fillRect(fx + 4, top, 3, len);
      g.fillRect(fx + fw - 7, top, 3, len);
      const cy = top + len / 2, cx = fx + fw / 2;
      const ini = (this.league.name || "").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
      g.globalAlpha = k1 ? 0.5 : 0.22;
      g.fillStyle = k1 ? k1[2] : "#241773";
      g.beginPath();
      g.arc(cx, cy, 70, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = k1 ? k1[5] : "#c9a227";
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx, cy, 64, 0, Math.PI * 2);
      g.stroke();
      if (k1) {
        g.strokeStyle = "rgba(255,255,255,0.7)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(cx, cy, 72, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = k1 ? 0.75 : 0.3;
      g.fillStyle = k1 ? k1[5] : "#ffd84a";
      g.textAlign = "center";
      g.font = `600 ${k1 && ini.length > 2 ? 38 : 46}px "Pixelify Sans", sans-serif`;
      g.fillText(k1 ? ini || "FF" : "D", cx, cy + 16);
      g.globalAlpha = 1;
    }
    for (const y of [fy + 6, fy + fh - 12]) {
      g.fillStyle = "#f2c230";
      g.fillRect(fx + fw / 2 - 46, y, 92, 6);
      g.fillRect(fx + fw / 2 - 48, y - 2, 6, 10);
      g.fillRect(fx + fw / 2 + 42, y - 2, 6, 10);
    }
    const name = (this.league.name || "").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
    g.font = '600 34px "Pixelify Sans", sans-serif';
    g.textAlign = "center";
    const fillPlain = g.fillText;
    g.lineJoin = "round";
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowOffsetY = 3;
    g.fillText = (t, x, y) => {
      g.strokeStyle = k1 ? k1[4] : "#0d0a24";
      g.lineWidth = 6;
      g.strokeText(t, x, y);
      g.shadowColor = "transparent";
      fillPlain.call(g, t, x, y);
      g.shadowColor = "rgba(0,0,0,0.55)";
    };
    g.fillStyle = k1 ? k1[5] : "#c9a227";
    {
      const nm = (this.league.name || "STADIUM").toUpperCase().slice(0, 30);
      let fs = 34;
      while (fs > 14 && g.measureText(nm).width > fw - 36) {
        fs -= 2;
        g.font = `600 ${fs}px "Pixelify Sans", sans-serif`;
      }
      g.fillText(nm, fx + fw / 2, fy + 58);
      g.font = '600 34px "Pixelify Sans", sans-serif';
    }
    g.fillStyle = "rgba(255,255,255,0.92)";
    g.fillText(`${name || "FF"} \xB7 WEEK ${this.league.week}`, fx + fw / 2, fy + fh - 22);
    delete g.fillText;
    g.shadowColor = "transparent";
    g.shadowOffsetY = 0;
    ct.refresh();
    this.add.image(0, 0, "ground").setOrigin(0).setDepth(-10);
  }
  makeDumpster() {
    if (this.textures.exists("a-ch-Dumpster")) return;
    const ct = this.textures.createCanvas("a-ch-Dumpster", 64, 112), c = ct.getContext();
    const draw = (ox, oy, open, wheel, stink) => {
      const g = [...Array(16)].map(() => Array(16).fill(null)), px = (x, y, col) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col;
      };
      const rect = (x, y, w, h, col) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col);
      };
      const M = "#9aa1aa", ML = "#d3d8de", MD = "#5f666f", RIM = "#7c838c", FLY = "#1d1d22";
      const b = wheel;
      rect(3, 6 + b, 10, 9 - b, M);
      rect(4, 15, 8, 1, MD);
      rect(3, 6 + b, 1, 9 - b, ML);
      rect(4, 6 + b, 1, 9 - b, "#b9bfc7");
      rect(11, 6 + b, 1, 9 - b, MD);
      rect(12, 6 + b, 1, 9 - b, "#4a5058");
      for (const x of [6, 9]) rect(x, 7 + b, 1, 7 - b, MD);
      rect(3, 9 + b, 10, 1, RIM);
      rect(3, 12, 10, 1, RIM);
      const ly = open ? 4 - open + b : 4 + b;
      if (open) {
        px(4, 5 + b, "#e8c040");
        px(5, 5 + b, "#e8c040");
        px(7, 5 + b, "#c84a3a");
        px(8, 5 + b, "#d0d0d8");
        px(10, 5 + b, "#7a5a3a");
        px(11, 5 + b, "#6aa84f");
      }
      rect(2, ly, 12, 2, RIM);
      rect(3, ly, 10, 1, ML);
      rect(4, ly - 1, 8, 1, M);
      px(13, ly + 1, MD);
      rect(7, ly - 2, 2, 1, MD);
      px(6, ly - 2, MD);
      px(9, ly - 2, MD);
      if (stink) for (const [x, y] of [[1, 2 + stink % 2], [14, 1 + (stink + 1) % 2], [12, 3 + stink % 2]]) px(x, y, FLY);
      const out = g.map((r) => r.slice());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== FLY)) out[y][x] = "#1d140c";
      out.forEach((r, y) => r.forEach((col, x) => {
        if (col) {
          c.fillStyle = col;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
      }));
    };
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) draw(col * 16, row * 16, row % 2 ? 1 : 0, row % 2, row + 1);
      draw(col * 16, 64, 2, 0, 1);
    }
    draw(16, 96, 2, 0, 2);
    ct.refresh();
  }
  makeSteeler() {
    if (this.textures.exists("a-ch-Steeler")) return;
    const ct = this.textures.createCanvas("a-ch-Steeler", 64, 112), c = ct.getContext();
    const K = "#16161a", KL = "#3a3a42", GOLD = "#ffb612", GD = "#c88a00", SK = "#c98d68", MASK = "#9aa1aa", WH = "#f4f1ea";
    const draw = (ox, oy, dir, f, pose) => {
      const g = [...Array(16)].map(() => Array(16).fill(null)), px = (x, y, col) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col;
      };
      const rect = (x, y, w, h, col) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col);
      };
      const step = [0, 1, 0, -1][f], bob = f % 2, cx = 7.5, cy = 6.5 + bob, R = 6.6;
      const l = step > 0 ? 1 : 0, r = step < 0 ? 1 : 0;
      rect(5, 12 + bob, 2, 2 - l - bob, GOLD);
      rect(9, 12 + bob, 2, 2 - r - bob, GD);
      rect(4, 14 - l, 3, 1, K);
      rect(9, 14 - r, 3, 1, K);
      for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy);
        if (d <= R) px(x, y, d > R - 1.3 ? K : dir === "up" ? K : WH);
      }
      if (dir === "up") {
        for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy);
          if (d > R - 2.3 && d <= R - 1.3) px(x, y, GOLD);
        }
      } else {
        const star = (sx, sy, col, colD) => {
          px(sx, sy - 1, col);
          px(sx - 1, sy, col);
          px(sx, sy, col);
          px(sx + 1, sy, colD);
          px(sx, sy + 1, colD);
        };
        const oyS = Math.round(cy) - 7;
        if (dir === "down") {
          star(6, oyS + 5, GOLD, GD);
          star(9, oyS + 7, "#d2302f", "#9e1f1f");
          star(6, oyS + 9, "#2f5fb3", "#1f3f7a");
          rect(4, oyS + 7, 1, 1, K);
        } else {
          star(8, oyS + 5, GOLD, GD);
          star(10, oyS + 7, "#d2302f", "#9e1f1f");
          star(8, oyS + 9, "#2f5fb3", "#1f3f7a");
        }
        px(4, oyS + 4, "#ffffff");
      }
      if (pose === "G") {
        rect(0, 6 + bob, 2, 1, K);
        rect(14, 6 + bob, 2, 1, K);
      } else if (pose === "item") {
        rect(1, 1, 1, 4, K);
        rect(14, 1, 1, 4, K);
        px(1, 0, GOLD);
        px(14, 0, GOLD);
      }
      const out = g.map((rw) => rw.slice());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== K)) out[y][x] = "#1d140c";
      const fin = dir === "left" ? out.map((rw) => rw.slice().reverse()) : out;
      fin.forEach((rw, y) => rw.forEach((col, x) => {
        if (col) {
          c.fillStyle = col;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
      }));
    };
    ["down", "up", "left", "right"].forEach((dir, col) => {
      for (let row = 0; row < 4; row++) draw(col * 16, row * 16, dir, row);
      draw(col * 16, 64, dir, 0, "G");
    });
    draw(16, 96, "down", 0, "item");
    ct.refresh();
  }
  makeRaven() {
    if (this.textures.exists("a-ch-Raven")) return;
    const ct = this.textures.createCanvas("a-ch-Raven", 64, 112), c = ct.getContext();
    const B = "#17141c", BL = "#2c2536", P = "#4b2a7a", PL = "#7350a8", EYE = "#ffb612", BEAK = "#4a4752", BEAKL = "#6e6b78";
    const draw = (ox, oy, dir, f, pose) => {
      const g = [...Array(16)].map(() => Array(16).fill(null)), px = (x, y, col) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col;
      };
      const rect = (x, y, w, h, col) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col);
      };
      const hop = f % 2, y0 = -hop;
      if (dir === "right" || dir === "left") {
        rect(5, 13, 1, 2 - hop, BEAK);
        rect(8, 13, 1, 2 - hop, BEAK);
        rect(1, 9 + y0, 4, 2, B);
        px(0, 10 + y0, B);
        px(1, 9 + y0, BL);
        rect(4, 6 + y0, 8, 7, B);
        rect(5, 6 + y0, 6, 1, BL);
        rect(5, 8 + y0, 6, 3, P);
        rect(6, 8 + y0, 4, 1, PL);
        px(10, 10 + y0, B);
        rect(9, 2 + y0, 4, 5, B);
        px(10, 2 + y0, BL);
        px(11, 2 + y0, BL);
        px(11, 4 + y0, EYE);
        rect(13, 4 + y0, 2, 2, BEAK);
        px(15, 5 + y0, BEAK);
        px(13, 4 + y0, BEAKL);
        if (pose === "G") {
          rect(3, 4 + y0, 6, 2, P);
          rect(2, 3 + y0, 3, 1, B);
        }
      } else if (dir === "down") {
        rect(5, 13, 1, 2 - hop, BEAK);
        rect(10, 13, 1, 2 - hop, BEAK);
        rect(4, 14, 2, 1, BEAK);
        rect(10, 14, 2, 1, BEAK);
        rect(4, 6 + y0, 8, 7, B);
        rect(5, 6 + y0, 6, 1, BL);
        rect(6, 9 + y0, 4, 3, BL);
        rect(3, 7 + y0, 1, 5, P);
        rect(12, 7 + y0, 1, 5, P);
        px(3, 7 + y0, PL);
        px(12, 7 + y0, PL);
        rect(5, 1 + y0, 6, 6, B);
        px(6, 1 + y0, BL);
        px(7, 1 + y0, BL);
        px(6, 3 + y0, EYE);
        px(9, 3 + y0, EYE);
        rect(7, 4 + y0, 2, 2, BEAK);
        px(7, 4 + y0, BEAKL);
        px(7, 6 + y0, BEAK);
      } else {
        rect(5, 13, 1, 2 - hop, BEAK);
        rect(10, 13, 1, 2 - hop, BEAK);
        rect(4, 6 + y0, 8, 7, B);
        rect(4, 7 + y0, 3, 5, P);
        rect(9, 7 + y0, 3, 5, P);
        px(4, 7 + y0, PL);
        px(9, 7 + y0, PL);
        rect(6, 12 + y0, 4, 2, B);
        px(5, 13 + y0, B);
        px(10, 13 + y0, B);
        rect(5, 1 + y0, 6, 6, B);
        rect(6, 1 + y0, 3, 1, BL);
      }
      if (pose === "G" && !(dir === "right" || dir === "left")) {
        rect(0, 6 + y0, 4, 2, P);
        rect(12, 6 + y0, 4, 2, P);
        px(0, 6 + y0, PL);
        px(15, 6 + y0, PL);
      }
      if (pose === "item") {
        rect(1, 2 + y0, 2, 5, P);
        rect(13, 2 + y0, 2, 5, P);
      }
      const out = g.map((rw) => rw.slice());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) out[y][x] = "#0a0810";
      const fin = dir === "left" ? out.map((rw) => rw.slice().reverse()) : out;
      fin.forEach((rw, y) => rw.forEach((col, x) => {
        if (col) {
          c.fillStyle = col;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
      }));
    };
    ["down", "up", "left", "right"].forEach((dir, col) => {
      for (let row = 0; row < 4; row++) draw(col * 16, row * 16, dir, row);
      draw(col * 16, 64, dir, 0, "G");
    });
    draw(16, 96, "down", 0, "item");
    ct.refresh();
  }
  makeShorty() {
    if (this.textures.exists("a-ch-Shorty")) return;
    const ct = this.textures.createCanvas("a-ch-Shorty", 64, 112), c = ct.getContext();
    const N = "#0b162a", NL = "#23365a", O = "#c83803", OL = "#e8642e", SK = "#e3b08a", SKD = "#c08a66", H = "#3a2a1e", P = "#8a8f98", SH = "#1d1d22";
    const draw = (ox, oy, dir, f, pose) => {
      const g = [...Array(16)].map(() => Array(16).fill(null)), px = (x, y, col) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col;
      };
      const rect = (x, y, w, h, col) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col);
      };
      const side = dir === "right" || dir === "left", step = [0, 1, 0, -1][f], bob = f % 2;
      if (side) {
        px(6 + step, 14, P);
        px(8 - step, 14, P);
        rect(6 + step, 15, 2, 1, SH);
        rect(8 - step, 15, 2, 1, SH);
      } else {
        const l = step > 0 ? 1 : 0, r = step < 0 ? 1 : 0;
        rect(6, 14, 1, 1 - l, P);
        rect(9, 14, 1, 1 - r, P);
        rect(5, 15 - l, 2, 1, SH);
        rect(9, 15 - r, 2, 1, SH);
      }
      const jy = 11 + bob;
      rect(side ? 5 : 4, jy, side ? 6 : 8, 3 - bob, N);
      rect(side ? 5 : 4, jy, side ? 6 : 8, 1, NL);
      rect(side ? 5 : 4, jy + 1, side ? 6 : 8, 1, O);
      if (!side && dir === "down") px(7, jy + 2 - bob, OL);
      if (pose === "G") {
        rect(2, jy, 2, 1, N);
        rect(12, jy, 2, 1, N);
        px(1, jy, SK);
        px(14, jy, SK);
      } else if (pose === "item") {
        rect(3, jy - 3, 1, 3, N);
        rect(12, jy - 3, 1, 3, N);
        px(3, jy - 4, SK);
        px(12, jy - 4, SK);
      } else if (side) {
        px(7 - step, jy + 1, NL);
        px(7 - step, jy + 2, SK);
      } else {
        px(3, jy + Math.max(0, step), N);
        px(12, jy + Math.max(0, -step), N);
        px(3, jy + 1 + Math.max(0, step), SK);
        px(12, jy + 1 + Math.max(0, -step), SK);
      }
      const hy = 6 + bob;
      rect(5, hy, 6, 5, SK);
      rect(10, hy + 1, 1, 4, SKD);
      rect(5, hy, 6, 2, N);
      rect(6, hy, 3, 1, NL);
      px(7, hy - 1, O);
      if (dir === "down") {
        rect(4, hy + 2, 8, 1, N);
        px(6, hy + 3, "#1d140c");
        px(9, hy + 3, "#1d140c");
        px(7, hy + 4, SKD);
        px(8, hy + 4, SKD);
      } else if (side) {
        rect(9, hy + 2, 3, 1, N);
        px(9, hy + 3, "#1d140c");
        px(11, hy + 3, SK);
        rect(5, hy + 2, 2, 2, H);
      } else rect(5, hy + 2, 6, 2, H);
      const out = g.map((rw) => rw.slice());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx])) out[y][x] = "#1d140c";
      const fin = dir === "left" ? out.map((rw) => rw.slice().reverse()) : out;
      fin.forEach((rw, y) => rw.forEach((col, x) => {
        if (col) {
          c.fillStyle = col;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
      }));
    };
    ["down", "up", "left", "right"].forEach((dir, col) => {
      for (let row = 0; row < 4; row++) draw(col * 16, row * 16, dir, row);
      draw(col * 16, 64, dir, 0, "G");
    });
    draw(16, 96, "down", 0, "item");
    ct.refresh();
  }
  placeTeams() {
    this.makeDumpster();
    this.makeSteeler();
    this.makeRaven();
    this.makeShorty();
    for (const t of this.league.teams) if (/^FB\d+$/.test(t.look)) this.makeTeamFootballer(t.look);
    const L = this.league, T = TILE, pairs = [...L.pairs].sort((a, b) => (b.some((t) => t.mine) ? 1 : 0) - (a.some((t) => t.mine) ? 1 : 0));
    const mid = (FIELD.x0 + FIELD.x1 + 1) / 2 * T, half = Math.min((FIELD.x1 - FIELD.x0 - 4) / 2, 7) * T, xs = [mid - half, mid + half];
    this.boards = [];
    const pct = (t) => (t.wins + t.ties / 2) / Math.max(1, t.wins + t.losses + t.ties);
    const assBowl = pairs.filter((p) => p.length === 2 && !L.preseason).sort((a, b) => pct(a[0]) + pct(a[1]) - (pct(b[0]) + pct(b[1])) || a[0].fpts + a[1].fpts - (b[0].fpts + b[1].fpts))[0];
    pairs.forEach((pair, row) => {
      const y = (FIELD.y0 + 7 + row * ROW) * T;
      pair.forEach((t, side) => {
        const x = xs[side], key = `team-${t.roster_id}-`;
        this.makeChar(key, t.look);
        const s = this.add.sprite(x, y, `${key}${side === 0 ? "right" : "left"}0`).setOrigin(0.5, 1).setDepth(y).setScale(1.5);
        if (t.gold) {
          s.setTint(16769126, 16769126, 16756736, 16756736);
          const halo = this.add.image(x, y - 22, "soft-glow").setScale(2.4, 1.8).setTint(16762938).setAlpha(1).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 3);
          this.tweens.add({ targets: halo, alpha: 0.45, duration: 900, yoyo: true, repeat: -1 });
        }
        if (t.mine) this.add.image(x, y - 2, "soft-glow").setScale(1.4, 0.7).setTint(16767050).setBlendMode(Phaser.BlendModes.ADD).setDepth(y - 2);
        const tag = this.label(x, y - 54, "", t.mine ? "#ffe08a" : "#fff4d6").setFontSize(Math.round(18 * DPR));
        this.addBlocker(x - 7, y - 8, 14, 8);
        this.teamSprites.set(t.roster_id, { s, tag, t, side, key });
        this.doors.push({ x, y: y + 14, id: `team-${t.roster_id}`, name: t.name, verb: "Scout", open: () => window.__stadium ? window.__stadium.teamPanel(t.roster_id) : this.teamPanel(t.roster_id) });
      });
      if (pair.length === 2 && !L.preseason) {
        const board = this.label(mid, y + 4, "", "#ffffff").setOrigin(0.5, 0).setFontSize(Math.round(19 * DPR));
        board.setStyle({ backgroundColor: "rgba(24,30,38,0.92)", align: "center", fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', fontStyle: "bold" });
        const bar = this.add.graphics().setDepth(1e5);
        const projTxt = this.label(mid, y, "", "#9aa3ad").setOrigin(0.5, 0).setFontSize(Math.round(11 * DPR));
        projTxt.setStyle({ backgroundColor: "rgba(24,30,38,0.92)", fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif' });
        this.boards.push({ board, bar, projTxt, a: pair[0], b: pair[1] });
        if (pair === assBowl) for (const t of pair) {
          const x = this.teamSprites.get(t.roster_id), d = x.side === 0 ? -1 : 1;
          (this.thrones = this.thrones || new Set()).add(t.roster_id);
          this.add.image(x.s.x + d * 12, y + 6, this.throneTex()).setOrigin(0.5, 1).setFlipX(x.side === 1).setDepth(y - 1);
        }
        if (pair === assBowl) {
          const sign = this.label(mid, y + 60, "\u{1F6BD} ASS BOWL", "#ffd84a").setOrigin(0.5, 0).setFontSize(Math.round(16 * DPR));
          this.boards[this.boards.length - 1].sign = sign;
          sign.setStyle({ backgroundColor: "rgba(92,52,20,0.95)", fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', fontStyle: "bold" });
          this.tweens.add({ targets: sign, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        }
        this.doors.push({ x: mid, y: y + 16, id: `board-${row}`, name: "the matchup", verb: "Watch", open: () => window.__stadium && window.__stadium.matchup(pair[0].roster_id) });
      }
    });
    this.rows = pairs.length;
    if (L.preseason) {
      const sign = this.label(mid, (FIELD.y0 + 7) * T + 4, "\u23F3 Live scores start in week 1", "#ffd84a").setOrigin(0.5, 0).setFontSize(Math.round(15 * DPR));
      sign.setStyle({ backgroundColor: "rgba(24,30,38,0.92)", fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', fontStyle: "bold" });
    }
    this.refreshScores();
  }
  refreshScores() {
    for (const { tag, t } of this.teamSprites.values()) {
      const opp = this.league.teams.find((o) => o.matchup_id && o.matchup_id === t.matchup_id && o.roster_id !== t.roster_id);
      const nm = t.name.length > 22 ? `${t.name.slice(0, 21)}\u2026` : t.name, len = nm.length + (t.mine ? 2 : 0);
      tag.setFontSize(Math.round((len <= 13 ? 18 : len <= 17 ? 15 : 13) * DPR));
      tag.setText(`${t.mine ? "\u{1F451} " : ""}${t.gold ? "\u{1F3C6} " : ""}${nm}`).setColor(t.mine ? "#ffe08a" : opp && t.points > opp.points ? "#b9f5a8" : "#fff4d6");
    }
    for (const { board, a, b } of this.boards || []) {
      board.setText(`${a.points.toFixed(1)}  :  ${b.points.toFixed(1)}`);
    }
    this.updateMoods();
    this.updatePodiums();
    const prev = this.prevPts || {}, prevSP = this.prevSP || {};
    for (const { s, t } of this.teamSprites.values()) {
      if (prev[t.roster_id] != null && t.points > prev[t.roster_id] + 0.05) {
        const jump = t.points - prev[t.roster_id];
        if (jump >= 4) {
          const was = prevSP[t.roster_id] || [], now = t.starters_points || [];
          let best = -1, bestUp = 0;
          now.forEach((pts, i) => {
            const up = pts - (was[i] || 0);
            if (up > bestUp) {
              bestUp = up;
              best = i;
            }
          });
          const pid = best >= 0 ? (t.starters || [])[best] : null, who = pid && this.league.players[pid] ? this.league.players[pid][0] : "";
          this.touchdown(t, jump, who);
        }
        this.celebrate(s, t);
      }
      prev[t.roster_id] = t.points;
      prevSP[t.roster_id] = (t.starters_points || []).slice();
    }
    this.prevPts = prev;
    this.prevSP = prevSP;
    this.updateProps();
    this.updateJumbo();
    this.applyUiScale();
  }
  touchdown(t, jump, who) {
    const q = this.tdQueue = this.tdQueue || [];
    q.push({ text: `\u{1F3C8} ${jump >= 5.5 ? "TOUCHDOWN" : "BIG PLAY"}`, who, sub: `+${jump.toFixed(1)} \xB7 ${t.name}`, mine: t.mine });
    const ts = this.teamSprites && this.teamSprites.get(t.roster_id);
    this.tdCheer = { left: ts ? ts.side === 0 : true, y: ts ? ts.s.y : 0, start: this.time.now, until: this.time.now + 3600 };
    if (ts) this.scoringMoment(ts, t);
    if (t.mine) window.dispatchEvent(new CustomEvent("stadium:mytd", { detail: { who, team: t.name } }));
    if (q.length === 1) this.nextTd();
  }
  scoringMoment(S, t) {
    const now = this.time.now, opp = [...this.teamSprites.values()].find((o) => o !== S && o.t.matchup_id && o.t.matchup_id === t.matchup_id);
    S.cel = now + 1500;
    if (opp) {
      opp.slump = now + 2600;
      if (!opp.t.gold) {
        opp.s.setTint(10134456);
        this.time.delayedCall(2600, () => opp.s.clearTint());
      }
      this.pop(opp.s.x + (opp.side === 0 ? -30 : 30), opp.s.y - 40, "\u{1F629}", "#fff4d6");
    }
    const ball = this.add.image(S.s.x, S.s.y - 70, "football").setDepth(99990).setScale(1.4).setAlpha(0);
    this.tweens.add({ targets: ball, alpha: 1, y: S.s.y - 4, delay: 650, duration: 240, ease: "Quad.easeIn", onComplete: () => {
      this.tweens.add({ targets: ball, x: ball.x + (S.side === 0 ? 46 : -46), y: ball.y - 26, angle: 720, alpha: 0, duration: 700, ease: "Quad.easeOut", onComplete: () => ball.destroy() });
    } });
    this.nudgeCamera(S.s.x, S.s.y - 30, t.mine);
  }
  nudgeCamera(x, y, shake) {
    const cam = this.cameras.main;
    if (panelOpen || this.target || this.stick && this.stick.active || this.nudging) return;
    this.nudging = true;
    const off = () => this.spawnOffset ? 3.2 * TILE : 0;
    this.endNudge = () => {
      if (!this.nudging) return;
      this.nudging = false;
      cam.panEffect.reset();
      cam.startFollow(this.player, true, 0.1, 0.1);
      cam.setFollowOffset(off(), this.spawnOffset ? this.spawnOffY : 0);
    };
    cam.stopFollow();
    cam.pan(x, y, 450, "Sine.easeInOut", false, (c, k) => {
      if (k < 1 || !this.nudging) return;
      if (shake) cam.shake(220, 4e-3);
      this.time.delayedCall(1300, () => {
        if (this.nudging) cam.pan(this.player.x + off(), this.player.y, 450, "Sine.easeInOut", false, (c2, k2) => {
          if (k2 === 1) this.endNudge();
        });
      });
    });
  }
  nextTd() {
    const q = this.tdQueue || [], item = q[0];
    if (!item) return;
    const el2 = document.createElement("div");
    el2.className = "td-banner" + (item.mine ? " mine" : "") + (window.__calm ? " calm" : "");
    el2.innerHTML = `<b></b><i></i><span></span>`;
    el2.querySelector("b").textContent = item.text;
    el2.querySelector("i").textContent = item.who || "";
    el2.querySelector("span").textContent = item.sub;
    document.body.appendChild(el2);
    sfx.cheer && sfx.cheer();
    setTimeout(() => {
      el2.remove();
      q.shift();
      this.nextTd();
    }, 3200);
  }
  celebrate(s, t) {
    sfx.pop && sfx.pop();
    this.tweens.add({ targets: s, y: s.y - 26, duration: 180, yoyo: true, repeat: 2, ease: "Quad.easeOut" });
    for (let i = 0; i < 26; i++) {
      const c = this.add.rectangle(s.x, s.y - 40, 4, 4, Phaser.Utils.Array.GetRandom([16767050, 16735581, 7268351, 10354554, 16777215])).setDepth(100001);
      const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 70;
      this.tweens.add({ targets: c, x: s.x + Math.cos(a) * v, y: s.y - 40 + Math.sin(a) * v + 40, angle: 360, alpha: 0, duration: 1100 + Math.random() * 500, onComplete: () => c.destroy() });
      this.tweens.add({ targets: c, scaleX: 0.15, duration: 140 + Math.random() * 120, yoyo: true, repeat: 5 });
    }
    const b = (this.boards || []).find((x) => x.a === t || x.b === t);
    if (b) this.tweens.add({ targets: b.board, scale: b.board.scale * 1.25, duration: 160, yoyo: true, repeat: 1 });
    this.pop(s.x, s.y - 70, `+${(t.points - (this.prevPts[t.roster_id] || 0)).toFixed(1)}`, "#b9f5a8");
  }
  makeFootballer() {
    const draw = (dir, f, pose) => this.footballerGrid(dir, f, pose, {});
    const put = (key, grid) => {
      if (this.textures.exists(key)) this.textures.remove(key);
      const ct = this.textures.createCanvas(key, 32, 32), c = ct.getContext();
      grid.forEach((rw, y) => rw.forEach((col, x) => {
        if (col) {
          c.fillStyle = col;
          c.fillRect(x * 2, y * 2, 2, 2);
        }
      }));
      ct.refresh();
    };
    for (const dir of ["down", "up", "left", "right"]) {
      for (let f = 0; f < 4; f++) put(`player${dir}${f}`, draw(dir, f));
      put(`player${dir}G`, draw(dir, 0, "G"));
    }
    put("player0", draw("down", 0));
    put("player1", draw("down", 2));
    put("playeritem", draw("down", 0, "item"));
  }
  makeTeamFootballer(look) {
    const key = `a-ch-${look}`;
    if (this.textures.exists(key)) return;
    const [H, HS, J, JL, JD, N, PA] = FB_KITS[(Number(look.slice(2)) || 0) % FB_KITS.length];
    const C = { K: H, KL: JL, GOLD: HS, GL: N, PUR: J, PL: JL, PD: JD, WH: PA, WD: PA === "#f4f1ea" ? "#cfcac0" : PA };
    const ct = this.textures.createCanvas(key, 64, 112), c = ct.getContext();
    const put = (ox, oy, grid) => grid.forEach((rw, y) => rw.forEach((col, x) => {
      if (col) {
        c.fillStyle = col;
        c.fillRect(ox + x, oy + y, 1, 1);
      }
    }));
    ["down", "up", "left", "right"].forEach((dir, col) => {
      for (let row = 0; row < 4; row++) put(col * 16, row * 16, this.footballerGrid(dir, row, null, C));
      put(col * 16, 64, this.footballerGrid(dir, 0, "G", C));
    });
    put(16, 96, this.footballerGrid("down", 0, "item", C));
    ct.refresh();
  }
  footballerGrid(dir, f, pose, C) {
    const { K = "#141018", KL = "#33293f", GOLD = "#c9a227", GL = "#ffd84a", PUR = "#3b2390", PL = "#5a3dbd", PD = "#241773", WH = "#f4f1ea", WD = "#cfcac0" } = C;
    const SK = "#c98d68", MASK = "#9aa1aa", BALL = "#8a4a22", CLEAT = "#141018";
    {
      const g = [...Array(16)].map(() => Array(16).fill(null)), px = (x, y, col) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y][x] = col;
      };
      const rect = (x, y, w, h, col) => {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, col);
      };
      const side = dir === "right" || dir === "left", step = [0, 1, 0, -1][f] || 0, bob = f % 2;
      if (side) {
        rect(6 + step, 12, 2, 2, WH);
        rect(8 - step, 12, 2, 2, WD);
        rect(6 + step, 14, 3, 1, CLEAT);
        rect(8 - step, 14, 3, 1, CLEAT);
      } else {
        const l = step > 0 ? 1 : 0, r = step < 0 ? 1 : 0;
        rect(5, 12, 3, 2 - l, WH);
        rect(8, 12, 3, 2 - r, WD);
        rect(7, 12, 1, 2, "#9a958c");
        rect(5, 14 - l, 3, 1, CLEAT);
        rect(8, 14 - r, 3, 1, CLEAT);
      }
      const jy = 8 + bob, jh = 4 - bob;
      rect(side ? 5 : 3, jy, side ? 6 : 10, jh, PUR);
      rect(side ? 5 : 3, jy, side ? 6 : 10, 1, PL);
      rect(side ? 10 : 12, jy + 1, 1, jh - 1, PD);
      if (side) {
        px(6 + step, 12, PUR);
        px(8 - step, 12, PD);
      } else {
        px(5, 12, PUR);
        px(10, 12, PD);
      }
      rect(side ? 5 : 4, jy + jh - 1, side ? 5 : 8, 1, PD);
      if (!side) {
        rect(3, jy, 2, 1, GOLD);
        rect(11, jy, 2, 1, GOLD);
        rect(6, jy + 1, 3, 1, GL);
        px(6, jy + 2, GL);
        px(8, jy + 2, GL);
        if (jh > 3) rect(6, jy + 3, 3, 1, GL);
      } else rect(6, jy + 1, 2, 2, GL);
      if (pose === "G") {
        rect(1, jy, 2, 1, PUR);
        rect(13, jy, 2, 1, PUR);
        px(0, jy, SK);
        px(15, jy, SK);
      } else if (pose === "item") {
        rect(2, jy - 4, 1, 4, PUR);
        rect(13, jy - 4, 1, 4, PUR);
        px(2, jy - 5, SK);
        rect(12, jy - 7, 3, 2, BALL);
        px(13, jy - 7, WH);
      } else if (side) {
        rect(8, jy + 1, 3, 2, BALL);
        px(9, jy + 1, WH);
        rect(7 - step, jy, 2, 3, PL);
        px(7 - step, jy + 3, SK);
      } else {
        rect(2, jy + Math.max(0, step), 1, 3, PL);
        rect(13, jy + Math.max(0, -step), 1, 3, PL);
        px(2, jy + 3 + Math.max(0, step), SK);
        rect(12, jy + 2, 2, 2, BALL);
      }
      const hy = 1 + bob;
      rect(4, hy, 8, 7, K);
      rect(5, hy, 6, 1, KL);
      px(4, hy, null);
      px(11, hy, null);
      rect(7, hy, 2, side ? 4 : dir === "up" ? 7 : 3, GOLD);
      px(5, hy + 1, shade(K, 0.65));
      px(5, hy + 2, shade(K, 0.35));
      px(6, hy + 1, shade(K, 0.35));
      if (side) rect(4, hy + 6, 5, 1, shade(K, -0.4));
      else {
        rect(11, hy + 1, 1, 5, shade(K, -0.35));
        px(4, hy + 6, shade(K, -0.35));
        px(11, hy + 6, shade(K, -0.35));
      }
      if (dir === "up") {
        rect(4, hy + 6, 8, 1, shade(K, -0.35));
        px(7, hy + 6, GOLD);
        px(8, hy + 6, GOLD);
      }
      if (dir === "down") {
        rect(5, hy + 3, 6, 3, SK);
        px(6, hy + 4, CLEAT);
        px(9, hy + 4, CLEAT);
        rect(5, hy + 5, 6, 1, MASK);
        rect(7, hy + 3, 1, 3, MASK);
        rect(5, hy + 6, 6, 1, MASK);
      } else if (side) {
        rect(9, hy + 3, 3, 3, SK);
        px(10, hy + 4, CLEAT);
        rect(11, hy + 3, 2, 1, MASK);
        rect(12, hy + 3, 1, 4, MASK);
        rect(10, hy + 6, 3, 1, MASK);
        px(6, hy + 4, PUR);
      }
      const out = g.map((rw) => rw.slice());
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[y + dy] && g[y + dy][x + dx] && g[y + dy][x + dx] !== "#1d140c")) out[y][x] = "#1d140c";
      return dir === "left" ? out.map((rw) => rw.slice().reverse()) : out;
    }
  }
  addProps() {
    const T = TILE, F = FIELD, W = MAP_W * T, mid = (F.x0 + F.x1 + 1) / 2 * T, L = this.league;
    const sans = { fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', fontStyle: "bold" };
    const px = (key, w, h, fn) => {
      if (this.textures.exists(key)) return;
      const ct = this.textures.createCanvas(key, w * 2, h * 2), c = ct.getContext();
      fn((col, x, y, ww = 1, hh = 1) => {
        c.fillStyle = col;
        c.fillRect(x * 2, y * 2, ww * 2, hh * 2);
      });
      ct.refresh();
    };
    this.spot = {
      beam: this.add.triangle(0, 0, 0, 0, 60, 0, 30, 150, 16774080, 0.16).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(99990).setVisible(false),
      pool: this.add.image(0, 0, "soft-glow").setScale(1.8, 0.8).setTint(16773296).setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    };
    const ticker = document.getElementById("st-ticker"), tickText = ticker && ticker.firstElementChild;
    this.jumbo = { setText: () => {
    }, setAll: (pages) => {
      if (!tickText) return;
      const s = pages.map((p) => p.replace("\n", ":  ").replace(/\n/g, "  \xB7  ")).join("      \u2B29      ");
      if (tickText.textContent === s) return;
      tickText.textContent = s;
      ticker.hidden = false;
      tickText.style.animationDuration = `${Math.max(14, s.length * 0.16)}s`;
    } };
    this.jumboPage = 0;
    this.time.addEvent({ delay: 5e3, loop: true, callback: () => {
      this.jumboPage++;
      this.updateJumbo();
    } });
    const ty = (F.y0 + 4) * T;
    px("trophy", 12, 14, (p) => {
      p("#9e7c0c", 2, 0, 8, 1);
      p("#e7b84a", 1, 1, 10, 5);
      p("#ffe08a", 2, 1, 2, 4);
      p("#e7b84a", 0, 2, 1, 2);
      p("#e7b84a", 11, 2, 1, 2);
      p("#c9a227", 4, 6, 4, 2);
      p("#c9a227", 5, 8, 2, 2);
      p("#5a3a22", 3, 10, 6, 2);
      p("#3a2614", 2, 12, 8, 2);
    });
    const champs = (L.champs || []).slice(0, 3);
    this.add.image(mid - 70, ty, "trophy").setOrigin(0.5, 1).setScale(1.5).setDepth(ty);
    this.add.text(mid - 48, ty - 22, champs.length ? champs.map((c) => `\u{1F3C6} ${c.season}  ${c.team}`).join("\n") : "\u{1F3C6} Champions: first title still up for grabs", { ...sans, fontSize: "13px", color: "#ffe08a", backgroundColor: "rgba(30,22,10,0.85)", padding: { x: 6, y: 4 } }).setOrigin(0, 1).setDepth(ty + 1);
    px("bench", 20, 8, (p) => {
      p("#7a5232", 0, 0, 20, 2);
      p("#5a3a22", 0, 2, 20, 1);
      p("#3a2614", 1, 3, 2, 5);
      p("#3a2614", 17, 3, 2, 5);
    });
    px("ref", 12, 18, (p) => {
      p("#f4f1ea", 3, 0, 6, 2);
      p("#1d1d22", 3, 1, 6, 1);
      p("#e3b08a", 3, 2, 6, 4);
      p("#1d1d22", 4, 3, 1, 1);
      p("#1d1d22", 7, 3, 1, 1);
      for (let i = 0; i < 8; i++) p(i % 2 ? "#1d1d22" : "#f4f1ea", 2 + i, 6, 1, 6);
      p("#1d1d22", 3, 12, 6, 3);
      p("#1d1d22", 3, 15, 2, 3);
      p("#1d1d22", 7, 15, 2, 3);
    });
    px("flag-y", 6, 6, (p) => {
      p("#ffd400", 0, 0, 6, 6);
      p("#c9a800", 0, 4, 6, 2);
    });
    this.bench = this.add.image(0, 0, "bench").setOrigin(0.5, 1).setVisible(false);
    this.benchTag = this.add.text(0, 0, "", { ...sans, fontSize: "12px", color: "#ffd0c0", backgroundColor: "rgba(60,20,16,0.9)", padding: { x: 4, y: 2 } }).setOrigin(0.5, 0).setVisible(false).setDepth(99980);
    this.refs = [];
    px("blimp", 40, 16, (p) => {
      p("#9aa1aa", 4, 2, 32, 12);
      p("#b9bfc7", 2, 4, 36, 8);
      p("#d3d8de", 6, 3, 26, 3);
      p("#6e747d", 4, 11, 32, 2);
      p("#241773", 14, 6, 14, 4);
      p("#c9a227", 15, 7, 12, 2);
      p("#5f666f", 0, 5, 3, 6);
      p("#5f666f", 37, 6, 3, 4);
      p("#3a3f47", 16, 14, 8, 2);
    });
    const msg = L.blimp || `${L.name} \xB7 week ${L.week}`;
    const blimp = this.add.container(-260, (F.y1 - 1.6) * T).setDepth(100003);
    const bannerTxt = this.add.text(-46, 4, ` ${msg} `, { ...sans, fontSize: "14px", color: "#1d140c", backgroundColor: "#fff4d6", padding: { x: 4, y: 2 } }).setOrigin(1, 0.5);
    blimp.add([bannerTxt, this.add.image(0, 0, "blimp").setScale(1.6)]);
    const fly = () => {
      blimp.x = -60;
      this.tweens.add({ targets: blimp, x: W + 80 + bannerTxt.width, duration: 26e3, ease: "Linear", onComplete: fly });
    };
    fly();
    this.tweens.add({ targets: blimp, y: blimp.y + 6, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const gx = (F.x1 - 1.2) * T, gy = (F.y1 - 0.6) * T;
    px("grill", 14, 12, (p) => {
      p("#1d1d22", 1, 0, 12, 5);
      p("#3a3f47", 2, 1, 10, 1);
      p("#c84a3a", 3, 2, 2, 1);
      p("#e8642e", 7, 2, 3, 1);
      p("#1d1d22", 2, 5, 2, 7);
      p("#1d1d22", 10, 5, 2, 7);
    });
    px("cooler", 12, 9, (p) => {
      p("#2f6fbf", 0, 2, 12, 7);
      p("#f4f1ea", 0, 0, 12, 2);
      p("#1f4a86", 0, 6, 12, 1);
      p("#f4f1ea", 4, 4, 4, 1);
    });
    for (const [dx, k] of [[0, "grill"], [34, "grill"], [62, "cooler"]]) {
      const im = this.add.image(gx + dx, gy, k).setOrigin(0.5, 1).setDepth(gy);
      if (k === "grill" && this.anims.exists("smoke-puff")) this.time.addEvent({ delay: 1300 + dx * 10, loop: true, callback: () => {
        const s = this.add.sprite(im.x + Phaser.Math.Between(-4, 4), im.y - 24, "a-smoke").setAlpha(0.55).setDepth(gy + 1);
        s.play("smoke-puff");
        this.tweens.add({ targets: s, y: s.y - 30, alpha: 0, duration: 1500, onComplete: () => s.destroy() });
      } });
    }
    this.add.text(gx + 30, gy + 4, "\u{1F356} tailgate", { ...sans, fontSize: "11px", color: "#fff4d6" }).setOrigin(0.5, 0).setDepth(gy + 2);
    const rowsY = [...this.teamSprites.values()].map((x) => x.s.y).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const band = (k) => rowsY[k] != null ? rowsY[k] + 62 : null;
    const fl = (F.x0 - 0.55) * T, fr = (F.x1 + 1.55) * T;
    for (const [k, x] of [[0, fl], [2, fl], [0, fr], [2, fr]]) {
      const y = band(k);
      if (y != null) this.add.image(x, y, "bench").setOrigin(0.5, 1).setAngle(90).setDepth(y);
    }
    px("gatorade", 10, 12, (p) => {
      p("#e8642e", 1, 2, 8, 9);
      p("#ff8a4a", 1, 2, 2, 9);
      p("#f4f1ea", 0, 0, 10, 2);
      p("#1d1d22", 4, 6, 2, 2);
    });
    if (band(1) != null) this.add.image(fl, band(1), "gatorade").setOrigin(0.5, 1).setDepth(band(1));
    px("chain", 4, 26, (p) => {
      p("#1d1d22", 1, 4, 2, 22);
      p("#ff7a1a", 0, 0, 4, 4);
      p("#ffffff", 1, 1, 2, 2);
    });
    px("down", 8, 30, (p) => {
      p("#1d1d22", 3, 8, 2, 22);
      p("#ff7a1a", 0, 0, 8, 8);
      p("#1d1d22", 3, 2, 2, 4);
    });
    if (band(3) != null) {
      const y = band(3);
      this.add.image(fr, y - 40, "chain").setOrigin(0.5, 1).setDepth(y - 40);
      this.add.image(fr, y + 10, "chain").setOrigin(0.5, 1).setDepth(y + 10);
      this.add.image(fr - 2, y - 14, "down").setOrigin(0.5, 1).setDepth(y - 14);
    }
    const cheer = (key, up) => px(key, 10, 16, (p) => {
      p("#3a2a1e", 3, 0, 4, 2);
      p("#e3b08a", 3, 2, 4, 3);
      p("#241773", 2, 5, 6, 4);
      p("#c9a227", 2, 9, 6, 3);
      p("#e3b08a", 3, 12, 1, 3);
      p("#e3b08a", 6, 12, 1, 3);
      p("#f4f1ea", 3, 15, 1, 1);
      p("#f4f1ea", 6, 15, 1, 1);
      if (up) {
        p("#ffd84a", 0, 1, 2, 3);
        p("#ffd84a", 8, 1, 2, 3);
        p("#241773", 1, 4, 1, 2);
        p("#241773", 8, 4, 1, 2);
      } else {
        p("#ffd84a", 0, 8, 2, 3);
        p("#ffd84a", 8, 8, 2, 3);
      }
    });
    cheer("cheer-u", true);
    cheer("cheer-d", false);
    const cy = (F.y1 + 0.35) * T;
    this.cheer = [0, 1, 2, 3].map((i) => this.add.image(mid - 120 + i * 80, cy, "cheer-d").setOrigin(0.5, 1).setScale(1.3).setDepth(cy));
    this.time.addEvent({ delay: 380, loop: true, callback: () => {
      if (window.__calm) return;
      this.cheer.forEach((c, i) => c.setTexture((Math.floor(this.time.now / 380) + i) % 2 ? "cheer-u" : "cheer-d"));
    } });
    for (const [bx, by, ang] of [[0, 0, 0.9], [W, 0, Math.PI - 0.9], [0, MAP_H * T, -0.9], [W, MAP_H * T, Math.PI + 0.9]]) {
      const beam = this.add.triangle(bx, by, 0, 0, 900, -110, 900, 110, 16774856, 0.06).setOrigin(0, 0.5).setRotation(ang).setBlendMode(Phaser.BlendModes.ADD).setDepth(99980);
      if (!window.__calm) this.tweens.add({ targets: beam, alpha: { from: 0.05, to: 0.09 }, duration: 2200 + Math.random() * 900, yoyo: true, repeat: -1 });
    }
    this.updateProps();
    this.updateJumbo();
  }
  updateProps() {
    if (!this.spot) return;
    const teams = [...this.teamSprites.values()];
    const top = teams.filter((x) => x.t.points > 0).sort((a, b) => b.t.points - a.t.points)[0];
    this.spot.beam.setVisible(!!top);
    this.spot.pool.setVisible(!!top);
    if (top) {
      this.spot.beam.setPosition(top.s.x, top.s.y);
      this.spot.pool.setPosition(top.s.x, top.s.y - 2).setDepth(top.s.y - 3);
    }
    this.spotId = top ? top.t.roster_id : null;
    const benchPts = (t) => (t.players || []).filter((p) => !(t.starters || []).includes(p)).reduce((n, p) => n + ((t.players_points || {})[p] || 0), 0);
    const shame = teams.map((x) => ({ ...x, b: benchPts(x.t) })).filter((x) => x.b >= 5).sort((a, b) => b.b - a.b)[0];
    this.bench.setVisible(!!shame);
    this.benchTag.setVisible(!!shame);
    if (shame) {
      const bx = shame.s.x;
      this.bench.setPosition(bx, shame.s.y + 24).setDepth(shame.s.y + 24);
      this.benchTag.setOrigin(0.5, 1).setPosition(bx, shame.s.y - 80).setText(`\u{1FA91} ${shame.b.toFixed(1)} on the bench`);
    }
    for (const r of this.refs) {
      r.ref.destroy();
      r.ev.remove();
    }
    this.refs = teams.filter((x) => x.t.points < 0).map((x) => {
      const rx = x.s.x + (x.side === 0 ? 30 : -30), ry = x.s.y + 4;
      const ref = this.add.image(rx, ry, "ref").setOrigin(0.5, 1).setScale(1.3).setDepth(ry);
      const ev = this.time.addEvent({ delay: 2600, loop: true, callback: () => {
        const f = this.add.image(rx, ry - 30, "flag-y").setDepth(100001);
        this.tweens.add({ targets: f, x: x.s.x, y: x.s.y - 6, angle: 400, duration: 600, ease: "Quad.easeOut", onComplete: () => this.tweens.add({ targets: f, alpha: 0, delay: 900, duration: 300, onComplete: () => f.destroy() }) });
      } });
      return { ref, ev };
    });
  }
  updateJumbo() {
    if (!this.jumbo) return;
    const L = this.league, pairs = (this.boards || []).map(({ a, b }) => ({ a, b, d: Math.abs(a.points - b.points) }));
    const live = pairs.filter((p) => p.a.points > 0 || p.b.points > 0);
    const name = (t) => t.name.length > 16 ? `${t.name.slice(0, 15)}\u2026` : t.name;
    const pages = [];
    const st = [...L.teams].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts).slice(0, 3);
    pages.push(`STANDINGS
${st.map((t, i) => `${i + 1}. ${name(t)}  ${t.wins}-${t.losses}`).join("\n")}`);
    if (live.length) {
      const lead = (p) => p.a.points >= p.b.points ? [p.a, p.b] : [p.b, p.a];
      const blow = [...live].sort((x, y) => y.d - x.d)[0], close = live.filter((p) => p.a.points > 0 && p.b.points > 0).sort((x, y) => x.d - y.d)[0];
      const [bw, bl] = lead(blow);
      pages.push(`BIGGEST BLOWOUT
${name(bw)} ${bw.points.toFixed(1)}
over ${name(bl)} ${bl.points.toFixed(1)}`);
      if (close) {
        const [cw, cl] = lead(close);
        pages.push(`CLOSEST GAME
${name(cw)} ${cw.points.toFixed(1)}
${name(cl)} ${cl.points.toFixed(1)}`);
      }
    }
    if (this.spotId != null) {
      const t = L.teams.find((x) => x.roster_id === this.spotId);
      if (t) pages.push(`\u{1F526} TOP SCORER
${name(t)}
${t.points.toFixed(1)} pts`);
    }
    this.jumbo.setAll(pages);
  }
  updateMoods() {
    const live = [...this.teamSprites.values()].filter((x) => x.t.points > 0);
    this.moods = this.moods || new Map();
    const want = new Map();
    if (live.length >= this.teamSprites.size / 2) {
      const by = [...live].sort((a, b) => b.t.points - a.t.points);
      by.slice(0, 2).forEach((x) => want.set(x.t.roster_id, "\u{1F525}"));
      by.slice(-2).forEach((x) => {
        if (!want.has(x.t.roster_id)) want.set(x.t.roster_id, "\u{1F327}\uFE0F");
      });
    }
    for (const [id, m] of this.moods) if (want.get(id) !== m.icon) {
      m.txt.destroy();
      this.moods.delete(id);
    }
    for (const [id, icon] of want) {
      if (this.moods.has(id)) continue;
      const txt = this.add.text(0, 0, icon, { fontSize: `${Math.round((icon === "\u{1F525}" ? 30 : 24) * DPR)}px` }).setOrigin(0.5, 1).setResolution(1).setScale(1 / DPR);
      this.moods.set(id, { icon, txt });
    }
  }
  pixTex(key, w, h, draw, U = 3) {
    if (this.textures.exists(key)) return key;
    const ct = this.textures.createCanvas(key, w * U, h * U), c = ct.getContext();
    draw((col, x, y, ww = 1, hh = 1) => {
      c.fillStyle = col;
      c.fillRect(x * U, y * U, ww * U, hh * U);
    });
    ct.refresh();
    return key;
  }
  throneTex() {
    return this.pixTex("st-throne2", 20, 22, (r) => {
      const O = "#4b525c", W = "#f4f6f8", S = "#cfd6de", G = "#ffd84a";
      r(O, 0, 0, 8, 13);
      r(W, 1, 2, 6, 10);
      r(S, 5, 2, 2, 10);
      r(O, 0, 0, 8, 2);
      r(W, 1, 1, 6, 1);
      r(G, 6, 4, 2, 1);
      r(O, 4, 11, 16, 3);
      r(G, 5, 11, 14, 1);
      r(W, 5, 12, 14, 1);
      r(O, 6, 14, 13, 4);
      r(W, 7, 14, 11, 3);
      r(S, 14, 14, 4, 3);
      r(O, 9, 18, 8, 4);
      r(W, 10, 18, 6, 3);
      r(S, 14, 18, 2, 3);
      r(O, 8, 21, 10, 1);
    }, 4);
  }
  podiumTex() {
    return this.pixTex("st-podium", 20, 9, (r) => {
      const O = "#6b5a3a", M = "#efe6d2", D = "#cbbf9f", G = "#ffd84a";
      r(O, 0, 0, 20, 9);
      r(M, 1, 1, 18, 7);
      r(D, 1, 6, 18, 2);
      for (const x of [3, 7, 12, 16]) r(D, x, 2, 1, 4);
      r(G, 9, 2, 2, 3);
    });
  }
  updatePodiums() {
    this.podiums = this.podiums || new Map();
    const pairs = (this.boards || []).filter(({ a, b }) => a.points + b.points > 0);
    const top = pairs.sort((p, q) => q.a.points + q.b.points - (p.a.points + p.b.points))[0];
    const want = new Set(top ? [top.a.roster_id, top.b.roster_id] : []);
    for (const [id, x] of this.teamSprites) {
      if (x.baseY == null) x.baseY = x.s.y;
      const on = want.has(id);
      if (on && !this.podiums.has(id)) this.podiums.set(id, this.add.image(x.s.x, x.baseY + 4, this.podiumTex()).setOrigin(0.5, 1).setDepth(x.baseY - 1));
      if (!on && this.podiums.has(id)) {
        this.podiums.get(id).destroy();
        this.podiums.delete(id);
      }
      if (x.tagY == null) x.tagY = x.tag.y;
      const lift = on ? 22 : this.thrones && this.thrones.has(id) ? 30 : 0;
      if (!this.tweens.isTweening(x.s)) x.s.y = x.baseY - lift;
      x.tag.y = x.tagY - lift;
    }
  }
  placeMoods(time) {
    for (const [id, m] of this.moods || []) {
      const x = this.teamSprites.get(id);
      if (!x) continue;
      const out = x.side === 0 ? -1 : 1, fire = m.icon === "\u{1F525}";
      m.txt.setPosition(x.s.x + out * 30, x.s.y - (fire ? 2 : 22) + Math.sin(time / (fire ? 120 : 500) + id) * (fire ? 1.5 : 3)).setDepth(x.s.y + 1);
      if (fire) m.txt.setScale((1 + Math.sin(time / 90 + id) * 0.08) / DPR);
    }
  }
  nightLights(W, H) {
    const h = (new Date()).getHours(), q = location.search;
    if (!/[?&]night=1/.test(q) && (/[?&]night=0/.test(q) || h >= 6 && h < 18)) return;
    const T = TILE;
    this.add.rectangle(0, 0, W, H, 461862, 0.62).setOrigin(0).setDepth(-4.5);
    for (let y = FIELD.y0 + 3; y < FIELD.y1; y += 7) {
      this.add.image((FIELD.x0 + FIELD.x1 + 1) / 2 * T, y * T, "soft-glow").setScale(9, 5).setTint(16773320).setAlpha(0.32).setBlendMode(Phaser.BlendModes.ADD).setDepth(-4.4);
    }
    const towers = [];
    for (let y = FIELD.y0 + 6; y < FIELD.y1; y += 12) towers.push([FIELD.x0 - 1.6, y], [FIELD.x1 + 2.6, y]);
    for (const [tx, ty] of towers) {
      const x = tx * T, y = ty * T, g = this.add.graphics().setDepth(y + 200);
      g.fillStyle(3817287, 1).fillRect(x - 2, y - 70, 4, 70);
      g.fillStyle(1908002, 1).fillRect(x - 13, y - 84, 26, 16);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) g.fillStyle(16776166, 1).fillRect(x - 11 + i * 8, y - 82 + j * 7, 6, 5);
      const glow = this.add.image(x, y - 76, "soft-glow").setScale(2.6, 1.6).setTint(16773824).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 201);
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }
  addLife() {
    const T = TILE, r = rng(77);
    if (!this.textures.exists("football")) {
      const ct = this.textures.createCanvas("football", 16, 10), c = ct.getContext();
      c.fillStyle = "#3a1f10";
      c.fillRect(2, 1, 12, 8);
      c.fillRect(0, 3, 16, 4);
      c.fillStyle = "#8a4a22";
      c.fillRect(3, 2, 10, 6);
      c.fillRect(1, 4, 14, 2);
      c.fillStyle = "#ffffff";
      c.fillRect(5, 4, 6, 1);
      c.fillRect(6, 3, 1, 3);
      c.fillRect(8, 3, 1, 3);
      c.fillRect(10, 3, 1, 3);
      ct.refresh();
    }
    const fanTex = (key, skin, hair, shirt, up, extra, hat = "", hatCol = shirt, stripe = false) => {
      if (this.textures.exists(key)) return key;
      const ct = this.textures.createCanvas(key, 12, 18), c = ct.getContext(), p = (col, x, y, w = 1, h = 1) => {
        c.fillStyle = col;
        c.fillRect(x, y, w, h);
      };
      if (extra === "sign" && up) {
        p("#f4f1ea", 0, 0, 12, 5);
        p("#c84a3a", 2, 1, 3, 1);
        p("#241773", 6, 1, 4, 1);
        p("#1d1d22", 2, 3, 8, 1);
      }
      p(hair, 4, 5, 4, 2);
      p(skin, 4, 7, 4, 3);
      p("#1d140c", 5, 8);
      p("#1d140c", 7, 8);
      if (hat === "cap") {
        p(hatCol, 4, 4, 4, 2);
        p(hatCol, 7, 6, 2, 1);
        p("rgba(255,255,255,0.25)", 4, 4, 4, 1);
      }
      if (hat === "beanie") {
        p(hatCol, 4, 4, 4, 3);
        p("#f4f1ea", 4, 6, 4, 1);
        p("#f4f1ea", 5, 3, 2, 1);
      }
      p(shirt, 3, 10, 6, 6);
      p("rgba(255,255,255,0.18)", 3, 10, 6, 1);
      p("rgba(0,0,0,0.25)", 8, 11, 1, 5);
      if (stripe) {
        p("#f4f1ea", 3, 12, 6, 1);
        p("#f4f1ea", 5, 13, 2, 2);
      }
      if (!up && extra === "drink") {
        p("#e8e2d0", 9, 11, 2, 3);
        p("#c84a3a", 9, 11, 2, 1);
      }
      if (!up && extra === "popcorn") {
        p("#c84a3a", 1, 12, 3, 3);
        p("#f4f1ea", 2, 12, 1, 3);
        p("#fff4c2", 1, 11, 3, 1);
      }
      if (up) {
        p(shirt, 2, 6, 1, 4);
        p(shirt, 9, 6, 1, 4);
        p(skin, 2, 5);
        p(skin, 9, 5);
        if (extra === "finger") {
          p("#ffd84a", 9, 0, 3, 5);
          p("#ffd84a", 10, -1, 1, 2);
        }
      } else {
        p(shirt, 2, 11, 1, 3);
        p(shirt, 9, 11, 1, 3);
        p(skin, 2, 14);
        p(skin, 9, 14);
      }
      p("#1d1d22", 4, 16, 1, 2);
      p("#1d1d22", 7, 16, 1, 2);
      ct.refresh();
      return key;
    };
    const shirtsR = ["#241773", "#241773", "#2e1f8f", "#1d1d22", "#c9a227"], shirtsO = ["#e8a33d", "#3d6fb6", "#c94a4a", "#4f9a5a", "#f2e6c9", "#d9e1e8", "#ffb612"];
    const skinsL = ["#f1c6a4", "#e3b08a", "#c98d68", "#8d5a3b"], hairsL = ["#1d140c", "#3a2a1e", "#6b4423", "#c9a227"];
    this.fans = [];
    const me = this.league.teams.find((t) => t.mine), mineS = me && this.teamSprites.get(me.roster_id);
    const oppS = mineS && [...this.teamSprites.values()].find((o) => o !== mineS && o.t.matchup_id && o.t.matchup_id === me.matchup_id);
    const kit = (S) => {
      const m = S && /^FB(\d+)$/.exec(S.t.look);
      return m ? FB_KITS[Number(m[1]) % FB_KITS.length] : null;
    };
    const shirts = (S) => {
      const c = kit(S);
      return c ? [c[2], c[2], c[3], c[4], c[5]] : null;
    };
    const standL = mineS ? shirts(mineS.side === 0 ? mineS : oppS) : null, standR = mineS ? shirts(mineS.side === 1 ? mineS : oppS) : null;
    const fx0 = (FIELD.x0 - 1) * T - 22, fx1 = (FIELD.x1 + 2) * T + 22;
    const BW = MAP_W * T, BH = MAP_H * T, bi = 18, br = (BW - 2 * bi) / 2;
    const inBowl = (x, y) => {
      const cy = Phaser.Math.Clamp(y, bi + br, BH - bi - br);
      return Math.hypot(x - BW / 2, y - cy) <= br;
    };
    const seats = this.add.graphics().setDepth(-6);
    for (let y = (FIELD.y0 - 1) * T; y < (FIELD.y1 + 2) * T; y += 14) for (const x0 of [fx0 - 30, fx0 - 18, fx1 + 4, fx1 + 16]) {
      if (!inBowl(x0, y) || !inBowl(x0, y - 40)) continue;
      const ravens = x0 < (FIELD.x0 + FIELD.x1) / 2 * T;
      seats.fillStyle(ravens ? 2365299 : 3818064, 1).fillRect(x0 - 6, y - 7, 12, 5).fillStyle(0, 0.3).fillRect(x0 - 6, y - 3, 12, 1);
      if (r() < 0.12) continue;
      const skin = skinsL[Math.floor(r() * skinsL.length)], hair = hairsL[Math.floor(r() * hairsL.length)];
      const pool = ravens ? standL || shirtsR : standR || shirtsO, shirt = pool[Math.floor(r() * pool.length)];
      const roll = r(), extra = roll < 0.1 ? "finger" : roll < 0.16 ? "sign" : roll < 0.24 ? "drink" : roll < 0.29 ? "popcorn" : "";
      const hr = r(), hat = hr < 0.18 ? "cap" : hr < 0.27 ? "beanie" : "", hatCol = ravens && !standL ? r() < 0.5 ? "#241773" : "#c9a227" : pool[Math.floor(r() * pool.length)];
      const stripe = r() < 0.3, keep = extra === "finger" || extra === "sign";
      const id = `fan-${skin}-${hair}-${shirt}-${extra}-${hat}-${hatCol}-${stripe}`;
      const down = fanTex(`${id}-d`, skin, hair, shirt, false, extra, hat, hatCol, stripe), up = fanTex(`${id}-u`, skin, hair, shirt, true, extra, hat, hatCol, stripe);
      const front = x0 === fx0 - 18 || x0 === fx1 + 4;
      const s = this.add.image(x0, y, keep ? up : down).setOrigin(0.5, 1).setDepth(-5).setScale(front ? 1.45 : 1);
      this.fans.push({ s, up, down, keep, y, ph: r() * 6.28 });
    }
    if (mineS && kit(mineS)) {
      const c = kit(mineS), nm = me.name.toUpperCase().slice(0, 18), left = mineS.side === 0;
      this.add.text(left ? (FIELD.x0 - 0.5) * T : (FIELD.x1 + 1.5) * T, mineS.s.y - 30, ` GO ${nm}! `, { fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', fontStyle: "bold", fontSize: "12px", color: c[5], backgroundColor: c[2], padding: { x: 3, y: 2 } }).setOrigin(0.5).setAngle(left ? -90 : 90).setDepth(-3);
    }
    this.time.addEvent({ delay: 1800, loop: true, callback: () => {
      if (window.__calm) return;
      const now = this.time.now, free = [...this.teamSprites.values()].filter((S2) => !(S2.cel > now) && !(S2.act > now));
      const S = free[Math.floor(Math.random() * free.length)];
      if (!S) return;
      const b = (this.boards || []).find((o) => o.a === S.t || o.b === S.t), pa = b ? this.winChance(b.a, b.b) : 0.5, win = b ? b.a === S.t ? pa : 1 - pa : 0.5;
      if (win > 0.8) {
        S.act = now + 1400;
        S.actType = "dance";
      } else if (win < 0.2) {
        S.act = S.slump = now + 2e3;
        S.actType = "slump";
      } else if (Math.random() < 0.5) {
        S.act = now + 700;
        S.actType = "stretch";
        this.tweens.add({ targets: S.s, scaleY: 1.75, scaleX: 1.35, duration: 220, hold: 200, yoyo: true });
      } else {
        S.act = now + 1600;
        S.actType = "juggle";
        const ball = this.add.image(S.s.x, S.s.y - 46, "football").setDepth(99990);
        this.tweens.add({ targets: ball, y: S.s.y - 92, angle: 360, duration: 380, yoyo: true, repeat: 1, ease: "Quad.easeOut", onComplete: () => ball.destroy() });
      }
    } });
    this.time.addEvent({ delay: 350, loop: true, callback: () => {
      if (window.__calm || !this.fans.length) return;
      const f = this.fans[Math.floor(Math.random() * this.fans.length)];
      const fl = this.add.star(f.s.x + 3, f.s.y - 12, 4, 1, 4, 16777215).setDepth(-4).setAlpha(0.95);
      this.tweens.add({ targets: fl, scale: 1.8, alpha: 0, duration: 260, onComplete: () => fl.destroy() });
    } });
    const corners = [[FIELD.x0 - 1, FIELD.y0 - 1, "a-flag-blue"], [FIELD.x1 + 2, FIELD.y0 - 1, "a-flag-blue"], [FIELD.x0 - 1, FIELD.y1 + 2, "a-flag-red"], [FIELD.x1 + 2, FIELD.y1 + 2, "a-flag-red"]];
    for (const [x, y, k] of corners) if (this.textures.exists(k)) {
      const f = this.add.sprite(x * T, y * T, k).setScale(2).setOrigin(0.2, 1).setDepth(y * T);
      if (this.anims.exists(`${k}-go`)) f.play(`${k}-go`);
    }
    this.time.addEvent({ delay: 1400, loop: true, callback: () => {
      const pairs = (this.boards || []).filter(() => Math.random() < 0.35);
      for (const { a, b } of pairs) {
        const sa = this.teamSprites.get(a.roster_id), sb = this.teamSprites.get(b.roster_id);
        if (!sa || !sb) continue;
        const [from, to] = Math.random() < 0.5 ? [sa.s, sb.s] : [sb.s, sa.s];
        const ball = this.add.image(from.x, from.y - 30, "football").setDepth(99990).setScale(1.2);
        const shadow = this.add.image(from.x, from.y - 4, "soft-shadow").setScale(0.5, 0.5).setDepth(from.y - 1);
        const st = { k: 0 };
        this.tweens.add({
          targets: st,
          k: 1,
          duration: 900,
          ease: "Sine.easeInOut",
          onUpdate: () => {
            const h = Math.sin(Math.PI * st.k);
            ball.x = from.x + (to.x - from.x) * st.k;
            ball.y = from.y - 30 + (to.y - from.y) * st.k - h * 70;
            ball.angle = st.k * 540;
            ball.setScale(1.2 + h * 0.5);
            shadow.setPosition(ball.x, from.y - 4 + (to.y - from.y) * st.k).setScale(0.5 - h * 0.2, 0.5 - h * 0.2).setAlpha(1 - h * 0.5);
          },
          onComplete: () => {
            ball.destroy();
            shadow.destroy();
            this.tweens.add({ targets: to, scaleX: 2.3, scaleY: 1.75, duration: 90, yoyo: true, ease: "Quad.easeOut" });
          }
        });
      }
    } });
  }
  teamPanel(rid) {
    const t = this.league.teams.find((x) => x.roster_id === rid), P = this.league.players;
    const row = (pid, pts) => {
      const p = P[pid] || [pid, "", ""];
      return el("tr", {}, el("td", {}, p[1] || ""), el("td", {}, p[0]), el("td", { class: "small" }, p[2] || ""), el("td", { class: "num" }, pts == null ? "\u2013" : Number(pts).toFixed(1)));
    };
    const bench = (t.players || []).filter((p) => !(t.starters || []).includes(p));
    openPanel(`${t.mine ? "\u{1F451} " : ""}${t.name}`, async () => [
      el("p", { class: "small" }, `${t.owner} \xB7 ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""} \xB7 ${t.fpts.toFixed(1)} points for \xB7 week ${this.league.week}: ${t.points.toFixed(1)}`),
      el("h3", {}, "Starters"),
      el("table", {}, (t.starters || []).map((pid, i) => row(pid, (t.starters_points || [])[i]))),
      bench.length ? [el("h3", {}, "Bench"), el("table", {}, bench.map((pid) => row(pid, (t.players_points || {})[pid])))] : null
    ]);
  }
  winChance(a, b) {
    const remA = Math.max(0, a.proj - a.points), remB = Math.max(0, b.proj - b.points), diff = a.proj - b.proj;
    if (remA + remB < 0.5) return a.points === b.points ? 0.5 : a.points > b.points ? 1 : 0;
    const sigma = 6 + 0.32 * (remA + remB);
    return 1 / (1 + Math.exp(-1.702 * diff / sigma));
  }
  sweatOn() {
    return sweatActive(this.league);
  }
  playersLeft(t) {
    const G = this.league.games || {}, P = this.league.players || {};
    return (t.starters || []).filter((pid) => pid && pid !== "0" && G[P[pid] ? P[pid][2] : pid] !== "complete").map((pid) => P[pid] ? String(P[pid][0]).split(" ").slice(-1)[0] : pid);
  }
  sweatLine(a, b) {
    const la = this.playersLeft(a), lb = this.playersLeft(b);
    if (!la.length && !lb.length) return { text: "FINAL", done: true };
    const [lead, trail, lt, ll] = a.points >= b.points ? [a, b, lb, la] : [b, a, la, lb];
    const gap = (lead.points - trail.points).toFixed(1), names = (n) => n.length > 2 ? `${n.slice(0, 2).join(", ")} +${n.length - 2}` : n.join(", ");
    const short = (n) => {
      n = String(n || "");
      return n.length > 16 ? `${n.slice(0, 15)}\u2026` : n;
    }, who = short(trail.name);
    if (!lt.length) return { text: `\u2705 ${short(lead.name)} wins`, done: true };
    return { text: `${who} needs ${gap} \xB7 ${names(lt)} left${ll.length ? ` vs ${ll.length}` : ""}`, done: false };
  }
  drawBars() {
    const now = this.time.now, sweat = this.sweatOn();
    for (const o of this.boards || []) {
      const { board, bar, projTxt, a, b } = o, A = this.teamSprites.get(a.roster_id), B = this.teamSprites.get(b.roster_id);
      if (!A || !B) continue;
      const pa = this.winChance(a, b), k = Math.abs(pa - 0.5) * 2, lead = pa > 0.5 ? A : pa < 0.5 ? B : null;
      const tug = Math.sin(now / 260 + a.roster_id) * 0.04;
      for (const [S, dir] of [[A, -1], [B, 1]]) {
        if (S.cel > now) {
          S.s.setRotation(-dir * Math.PI * 2 * Math.min(1, (1500 - (S.cel - now)) / 600));
          continue;
        }
        if (this.thrones && this.thrones.has(S.t.roster_id)) {
          S.s.setRotation(0);
          continue;
        }
        let back = S === lead ? 0.1 + 0.14 * k : S === (lead === A ? B : A) ? -0.05 - 0.06 * k : 0.08;
        if (S.slump > now) back = -0.3;
        S.s.setRotation(dir * (back + tug));
      }
      const hy = A.s.y - 20, x1 = A.s.x + 12, x2 = B.s.x - 12, len = x2 - x1;
      const kx = x1 + len * Phaser.Math.Clamp(1 - pa, 0.2, 0.8) + Math.sin(now / 260 + a.roster_id) * 2;
      bar.clear();
      for (let i = 0; i < len; i += 2) {
        const x = x1 + i, sag = Math.sin(i / len * Math.PI) * 3;
        bar.fillStyle(3810836, 1).fillRect(x, hy + sag - 3, 2, 6);
        bar.fillStyle(Math.floor(i / 4) % 2 ? 13935452 : 10251832, 1).fillRect(x, hy + sag - 2, 2, 4);
      }
      bar.fillStyle(1905676, 1).fillRect(kx - 6, hy - 6, 12, 12).fillRect(kx - 5, hy + 5, 10, 12);
      bar.fillStyle(13777466, 1).fillRect(kx - 5, hy - 5, 10, 10).fillRect(kx - 4, hy + 5, 8, 11);
      bar.fillStyle(16747146, 1).fillRect(kx - 4, hy - 4, 3, 3);
      bar.setDepth(Math.min(A.s.depth, B.s.depth) - 1);
      if (!o.pct) o.pct = this.add.text(0, 0, "", { fontFamily: 'system-ui, "Segoe UI", Arial, sans-serif', fontStyle: "bold", color: "#9dff7a", stroke: "#0f141a" }).setOrigin(0.5, 0).setResolution(1);
      const pct = Math.round(Math.max(pa, 1 - pa) * 100), t = lead ? `${pct}%` : "50 / 50";
      if (o.pct.text !== t) o.pct.setText(t);
      const fs = Math.round(15 * DPR / Math.max(0.5, this.cameras.main.zoom / DPR));
      o.pct.setFontSize(Math.round(14 * DPR)).setStroke("#0f141a", Math.round(5 * DPR)).setScale(board.scaleX).setOrigin(0.5, 1).setPosition(kx, hy - 8).setDepth(board.depth + 1);
      const sw = sweat ? this.sweatLine(a, b) : null, pt = sw ? sw.text : `proj ${a.proj.toFixed(1)} \u2013 ${b.proj.toFixed(1)}`;
      if (projTxt.text !== pt) projTxt.setText(pt);
      projTxt.setColor(sw && !sw.done ? "#ffd84a" : "#9aa3ad");
      if (o.sweatStyle !== !!sw) {
        o.sweatStyle = !!sw;
        projTxt.setFontSize(Math.round((sw ? 13 : 11) * DPR)).setStroke("#0f141a", sw ? Math.round(3 * DPR) : 0);
      }
      const dim = sw && sw.done && !a.mine && !b.mine ? 0.7 : 1;
      for (const g of [A.s, B.s, board, bar, o.pct, projTxt]) if (g && g.alpha !== dim) g.setAlpha(dim);
      const r = board.getBounds();
      projTxt.setPosition(r.centerX, r.bottom + 1).setDepth(board.depth);
      if (o.sign) {
        const pr = projTxt.getBounds();
        o.sign.setPosition(pr.centerX, pr.bottom + 4);
      }
    }
  }
  update(time, delta) {
    this.drawBars();
    this.placeMoods(time);
    const k = this.keys;
    let vx = 0, vy = 0;
    if (!panelOpen) {
      if (k.LEFT.isDown || k.A.isDown) vx -= 1;
      if (k.RIGHT.isDown || k.D.isDown) vx += 1;
      if (k.UP.isDown || k.W.isDown) vy -= 1;
      if (k.DOWN.isDown || k.S.isDown) vy += 1;
    }
    if (!vx && !vy && !panelOpen && this.stick && this.stick.active) {
      vx = this.stick.vx;
      vy = this.stick.vy;
    }
    if (this.spawnOffset && (vx || vy || this.target)) {
      this.spawnOffset = false;
      this.cameras.main.setFollowOffset(0, 0);
    }
    if ((vx || vy) && this.nudging) this.endNudge();
    if (vx || vy || panelOpen) {
      this.target = null;
      this.route = null;
    } else if (this.target) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.player.y;
      if (Math.hypot(dx, dy) < 6 || this.target.door && Math.hypot(dx, dy) < 30) {
        const d = this.target.door;
        this.target = this.route && this.route.shift() || null;
        if (d) d.open();
      } else {
        vx = Math.abs(dx) > 4 ? Math.sign(dx) * Math.min(1, Math.abs(dx) / 20) : 0;
        vy = Math.abs(dy) > 4 ? Math.sign(dy) * Math.min(1, Math.abs(dy) / 20) : 0;
      }
    }
    drivePlayer(this, vx, vy, SPEED, delta);
    for (const S of this.teamSprites.values()) {
      const { s, t, side, key: key2 } = S, dance = S.act > time && S.actType === "dance";
      const opp = this.league.teams.find((o) => o.matchup_id && o.matchup_id === t.matchup_id && o.roster_id !== t.roster_id);
      const hop = dance ? 7 : opp && t.points > opp.points ? 3 : 1.2;
      s.setOrigin(0.5, 1 + Math.abs(Math.sin(time / (dance ? 120 : 260) + t.roster_id)) * hop / 32);
      const face = dance ? Math.floor(time / 160) % 2 ? "left" : "right" : side === 0 ? "right" : "left";
      s.setTexture(`${key2}${face}${Math.floor(time / 300 + t.roster_id) % 2}`);
      shadowFor(this, s);
    }
    shadowFor(this, this.player);
    if (this.youRing) {
      const P = this.player, t = this.time.now;
      this.youRing.setPosition(P.x, P.y - 2).setDepth(P.y - 3).setScale(1 + Math.sin(t / 300) * 0.08);
      this.youTag.setOrigin(0, 0.5).setPosition(P.x + 20 + Math.abs(Math.sin(t / 260)) * 4, P.y - 30);
    }
    const midX = (FIELD.x0 + FIELD.x1 + 1) / 2 * TILE, ch = this.tdCheer && time < this.tdCheer.until ? this.tdCheer : null;
    for (const f of this.fans || []) {
      const wave = Math.max(0, Math.sin(time / 420 - f.y / 90)) ** 6 * 7, bob = Math.abs(Math.sin(time / 280 + f.ph)) * 1.5;
      let jump = ch && f.s.x < midX === ch.left ? Math.abs(Math.sin(time / 95 + f.ph)) * 4 : 0;
      if (ch && f.s.x < midX === ch.left) {
        const k2 = (time - ch.start - Math.abs(f.y - ch.y) * 1.4) / 450;
        if (k2 > 0 && k2 < 1) jump += Math.sin(k2 * Math.PI) * 12;
      }
      f.s.y = f.y + 12 - wave - bob - jump;
      if (!f.keep) f.s.setTexture(wave > 3.5 || jump > 0 ? f.up : f.down);
    }
    let best = null, bestD = 44;
    for (const d of this.doors) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    this.near = best;
    const key = best && !panelOpen ? best.name : "";
    if (key !== this.promptKey) {
      this.promptKey = key;
      const p = $("prompt");
      const touch = (navigator.maxTouchPoints || 0) > 0;
      if (key) {
        p.replaceChildren(touch ? "\u{1F446} Tap: " : el("kbd", {}, "E"), `${best.verb} ${key}`);
        p.hidden = false;
        p.onclick = () => {
          if (this.near) this.near.open();
        };
      } else {
        p.hidden = true;
        p.onclick = null;
      }
    }
  }
}
export {
  LOOKS,
  StadiumScene
};
