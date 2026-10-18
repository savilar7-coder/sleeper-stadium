import { TILE } from "./core.js";
import { el, openPanel } from "./panel.js";
import { decorateMarketTrends } from "./market-trends.js";
function season() {
  const q = new URLSearchParams(location.search).get("season");
  if (["winter", "spring", "summer", "autumn"].includes(q)) return q;
  const m = (new Date()).getMonth() + 1;
  return m >= 9 && m <= 11 ? "autumn" : m === 12 || m <= 2 ? "winter" : m <= 5 ? "spring" : "summer";
}
function halloween() {
  if (new URLSearchParams(location.search).get("season") === "halloween") return true;
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return m === 10 && day >= 20 || m === 11 && day === 1;
}
const GROW = { east: 18, south: 14 };
function sectorLayout(MARGIN, PLOT, townW, townH, mapH, mapW) {
  const pathX = MARGIN + 2 * PLOT - 1, dy0 = MARGIN + townH + 2;
  return {
    pathX,
    market: { x0: pathX - 7, x1: pathX + 7, y0: 3, y1: 9 },
    exitRow: MARGIN + PLOT - 1,
    desert: { x0: MARGIN - 8, x1: mapW - 2, y0: dy0, y1: mapH - 2 },
    gate: { x0: MARGIN - 8, x1: MARGIN + townW, y0: dy0, y1: dy0 + 9 },
    hills: { x0: MARGIN + townW + 25, x1: mapW - 2, y0: MARGIN + 2, y1: dy0 - 1 },
    riverEnd: dy0 - 1,
    marketPath: (tx, ty) => tx === pathX && ty >= 10 && ty <= MARGIN - 1,
    desertPath: (tx, ty) => tx === pathX && ty >= MARGIN + townH && ty <= MARGIN + townH + 1
  };
}
function shiftLayout(M, dx, dy) {
  const p = ([x, y, ...rest]) => [x + dx, y + dy, ...rest];
  return {
    ...M,
    tiers: M.tiers.map((t) => ({ ...t, x0: t.x0 + dx, x1: t.x1 + dx, y0: t.y0 + dy, y1: t.y1 + dy })),
    stairs: M.stairs.map(p),
    trail: M.trail.map(p),
    stations: Object.fromEntries(Object.entries(M.stations).map(([k, v]) => [k, p(v)])),
    pines: M.pines.map(p),
    flag: p(M.flag),
    sign: p(M.sign)
  };
}
function preloadSectors(scene) {
  scene.load.image("a-desert", "assets/TilesetDesert.png");
  scene.load.image("a-relief", "assets/TilesetRelief.png");
  scene.load.image("a-aa", "assets/AdventureAwaits.png");
  for (const c of loreSprites()) if (!scene.textures.exists(`a-ch-${c}`)) scene.load.image(`a-ch-${c}`, `assets/chars/${c}.png`);
  scene.load.spritesheet("a-fire", "assets/anim/fire.png", { frameWidth: 12, frameHeight: 12 });
  scene.load.spritesheet("a-snow", "assets/anim/snow.png", { frameWidth: 8, frameHeight: 8 });
}
function makeSectorTextures(scene) {
  const cut = (key, src, sx, sy, sw, sh) => {
    if (scene.textures.exists(key)) return;
    const ct = scene.textures.createCanvas(key, sw * 2, sh * 2), c = ct.getContext();
    c.imageSmoothingEnabled = false;
    c.drawImage(scene.textures.get(src).getSourceImage(), sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);
    ct.refresh();
  };
  const D = "a-desert";
  cut("m-pine", "a-nature", 32, 0, 32, 32);
  cut("m-snowpine", "a-nature", 128, 0, 32, 32);
  cut("m-rock", "a-nature", 192, 96, 48, 32);
  cut("s-hut", D, 0, 0, 48, 48);
  cut("s-tower", D, 48, 0, 48, 80);
  cut("s-adobe", D, 96, 0, 64, 48);
  cut("s-palms", D, 160, 64, 64, 48);
  cut("s-palm", D, 160, 160, 32, 32);
  cut("s-stall-red", D, 32, 160, 32, 32);
  cut("s-stall-yel", D, 64, 160, 32, 32);
  cut("s-fountain", D, 128, 112, 32, 32);
  cut("s-well", D, 0, 48, 32, 32);
  cut("s-oasis", D, 272, 112, 48, 48);
  cut("s-fruit1", D, 96, 176, 16, 16);
  cut("s-fruit2", D, 112, 176, 16, 16);
  cut("s-tumble", D, 128, 144, 16, 16);
  cut("s-shrub", D, 128, 160, 32, 32);
  cut("s-skull", D, 272, 176, 16, 16);
  cut("s-bones", D, 304, 176, 16, 16);
  if (!scene.anims.exists("a-fire-go")) scene.anims.create({ key: "a-fire-go", frames: scene.anims.generateFrameNumbers("a-fire", { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
  if (!scene.textures.exists("s-saguaro")) {
    const ct = scene.textures.createCanvas("s-saguaro", 32, 64), c = ct.getContext();
    const px = (col, x, y, w = 1, h = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, w * 2, h * 2);
    };
    const ink = "#1f2a14", g = "#4f8a3a", gl = "#6fae4c", gd = "#3b6a2c";
    px(ink, 5, 1, 6, 30);
    px(g, 6, 2, 4, 28);
    px(gl, 7, 2, 1, 28);
    px(gd, 9, 3, 1, 27);
    px(ink, 0, 8, 6, 5);
    px(ink, 0, 3, 4, 7);
    px(g, 1, 4, 2, 8);
    px(g, 2, 9, 4, 3);
    px(gl, 1, 4, 1, 7);
    px(ink, 10, 12, 6, 5);
    px(ink, 12, 6, 4, 8);
    px(g, 13, 7, 2, 8);
    px(g, 10, 13, 4, 3);
    px(gd, 14, 7, 1, 8);
    px("#f6e7a0", 7, 1, 2, 1);
    px("#e85a7a", 7, 0, 2, 1);
    px("rgba(0,0,0,0.25)", 3, 31, 10, 1);
    ct.refresh();
  }
  if (!scene.textures.exists("a-leaf-autumn")) {
    const src = scene.textures.get("a-leaf").getSourceImage();
    const cv = document.createElement("canvas");
    cv.width = src.width;
    cv.height = src.height;
    const c = cv.getContext("2d");
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(232,120,40,0.75)";
    c.fillRect(0, 0, cv.width, cv.height);
    scene.textures.addSpriteSheet("a-leaf-autumn", cv, { frameWidth: 6, frameHeight: 7 });
  }
}
function paintAuto(gc, img, isOn, mapW, mapH, set) {
  const on = (x, y) => x >= 0 && y >= 0 && x < mapW && y < mapH && isOn(x, y);
  const pick = (v, h, d, outer, edgeV, edgeH, inner) => !v && !h ? outer : !v ? edgeV : !h ? edgeH : !d ? inner : set.C;
  for (let ty = 0; ty < mapH; ty++) for (let tx = 0; tx < mapW; tx++) {
    if (!isOn(tx, ty)) continue;
    const u = on(tx, ty - 1), dn = on(tx, ty + 1), l = on(tx - 1, ty), r = on(tx + 1, ty);
    const q = [
      [0, 0, pick(u, l, on(tx - 1, ty - 1), set.TL, set.T, set.L, set.C)],
      [8, 0, pick(u, r, on(tx + 1, ty - 1), set.TR, set.T, set.R, set.C)],
      [0, 8, pick(dn, l, on(tx - 1, ty + 1), set.BL, set.B, set.L, set.C)],
      [8, 8, pick(dn, r, on(tx + 1, ty + 1), set.BR, set.B, set.R, set.C)]
    ];
    for (const [qx, qy, [sx, sy]] of q) gc.drawImage(img, sx + qx, sy + qy, 8, 8, tx * TILE + qx * 2, ty * TILE + qy * 2, 16, 16);
  }
}
function paintDesert(scene, gc, S, mapW, mapH, r) {
  const img = scene.textures.get("a-floor").getSourceImage(), d = S.desert, g = S.gate || d;
  const base = [[0, 80], [0, 80], [0, 80], [16, 80], [32, 80], [48, 80], [64, 80]];
  for (const R of [d, S.hills].filter(Boolean)) for (let ty = R.y0; ty <= R.y1; ty++) for (let tx = R.x0; tx <= R.x1; tx++) {
    const [sx, sy] = base[Math.floor(r() * base.length)];
    gc.drawImage(img, sx, sy, 16, 16, tx * TILE, ty * TILE, 32, 32);
  }
  const midRow = d.y0 + 4;
  const trail = (tx, ty) => tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1 && (tx === S.pathX && ty <= midRow || ty === midRow && tx >= g.x0 + 2 && tx <= g.x1 - 2 || ty === midRow + 1 && tx >= g.x0 + 2 && tx <= g.x1 - 2);
  const det = scene.textures.get("a-detail").getSourceImage();
  for (let x = d.x0 * TILE; x < (d.x1 + 1) * TILE; x += 10 + r() * 14) {
    const [sx, sy] = [[0, 32], [16, 32], [32, 32], [48, 32]][Math.floor(r() * 4)];
    gc.drawImage(det, sx, sy, 16, 16, x, d.y0 * TILE - 22 + r() * 30, 32, 32);
  }
  paintAuto(gc, img, trail, mapW, mapH, { TL: [0, 0], T: [16, 0], TR: [32, 0], L: [0, 16], C: [16, 16], R: [32, 16], BL: [0, 32], B: [16, 32], BR: [32, 32] });
}
function seasonizeTexture(scene, key) {
  const s = season();
  if (s === "summer" || !scene.textures.exists(key) || scene.textures.get(key).__seasoned) return;
  const tex = scene.textures.get(key), img = tex.getSourceImage();
  if (!img.getContext) return;
  const c = img.getContext("2d"), copy = document.createElement("canvas");
  copy.width = img.width;
  copy.height = img.height;
  copy.getContext("2d").drawImage(img, 0, 0);
  paintSeason(c, img.width, img.height, s);
  c.save();
  c.globalCompositeOperation = "destination-in";
  c.drawImage(copy, 0, 0);
  c.restore();
  tex.__seasoned = true;
  if (tex.refresh) tex.refresh();
}
function paintSeason(gc, w, h, s) {
  if (s === "summer") return;
  gc.save();
  if (s === "autumn") {
    gc.globalCompositeOperation = "multiply";
    gc.fillStyle = "#ffd3a2";
  } else if (s === "spring") {
    gc.globalCompositeOperation = "multiply";
    gc.fillStyle = "#f3fff0";
  } else {
    gc.globalCompositeOperation = "screen";
    gc.fillStyle = "rgba(210,225,240,0.55)";
  }
  gc.fillRect(0, 0, w, h);
  gc.restore();
}
function decorateSectors(scene, S, r) {
  const T = TILE, put = (key, x, y, block = true, depth) => {
    const im = scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth ?? y);
    if (block) scene.addBlocker(x - im.width / 2 + 4, y - Math.min(18, im.height * 0.35), im.width - 8, Math.min(16, im.height * 0.3));
    return im;
  };
  const lamp = (x, y) => {
    put("d-lamp", x, y);
    (scene.lamps = scene.lamps || []).push(scene.add.image(x, y - 48, "soft-glow").setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99992));
  };
  const m = S.market, mx = (m.x0 + m.x1 + 1) / 2 * T, my = (m.y0 + m.y1 + 1) / 2 * T;
  put("s-fountain", mx, my + 20);
  const stalls = [["s-stall-red", -5.2, -1.6], ["s-stall-yel", -2.6, -2.4], ["s-stall-yel", 2.6, -2.4], ["s-stall-red", 5.2, -1.6], ["tool-stall-off", -5.4, 1.8], ["tool-stall-off", 5.4, 1.8]];
  const vendors = ["Sultan", "OldMan3", "Villager6", "OldMan", "ManGreen", "OldMan2"];
  scene.vendors = [];
  stalls.forEach(([key, dx, dy], i) => {
    const sx = mx + dx * T, sy = my + dy * T;
    if (scene.textures.exists(key)) put(key, sx, sy);
    const vk = `vendor${i}-`;
    scene.makeChar(vk, vendors[i]);
    const vx = sx + (dx < 0 ? 42 : -42), vy = sy + 10;
    scene.vendors.push(scene.add.sprite(vx, vy, `${vk}down0`).setOrigin(0.5, 1).setDepth(vy));
    scene.addBlocker(vx - 7, vy - 8, 14, 8);
    put(i % 2 ? "s-fruit1" : "s-fruit2", sx + (dx < 0 ? -30 : 30), sy + 14, false);
  });
  for (const [dx, dy] of [[-6.6, 3.2], [6.6, 3.2]]) lamp(mx + dx * T, my + dy * T);
  put("d-barrel", mx - 3.4 * T, my + 3.4 * T);
  put("d-jar", mx + 3.4 * T, my + 3.4 * T, false);
  put("d-bench", mx + 1.9 * T, my + 3.5 * T);
  scene.add.image(S.pathX * T + 16, (m.y1 + 1) * T + 40, "sign").setOrigin(0.5, 1).setDepth((m.y1 + 1) * T + 40);
  scene.marketLabel = scene.label(S.pathX * T + 16, (m.y1 + 1) * T + 14, "\u{1F9FA} Market", "#ffe08a");
  scene.marketSpot = { x: S.pathX * T + 16, y: (m.y1 + 1) * T + 4 };
  decorateMarketTrends(scene);
  const d = S.gate || S.desert, dx0 = d.x0 * T, dx1 = (d.x1 + 1) * T, dy0 = d.y0 * T, dy1 = (d.y1 + 1) * T;
  const signY = dy0 + 46;
  scene.add.image(S.pathX * T + 60, signY, "sign").setOrigin(0.5, 1).setDepth(signY);
  scene.label(S.pathX * T + 60, signY - 26, "\u{1F335} Desert", "#ffe08a");
  put("s-tower", dx0 + 4 * T, dy0 + 5 * T);
  put("s-hut", dx0 + 7.5 * T, dy0 + 3.4 * T);
  put("s-adobe", dx1 - 6 * T, dy0 + 3.6 * T);
  put("s-hut", dx1 - 2.6 * T, dy0 + 8.4 * T);
  put("s-well", dx1 - 9 * T, dy0 + 8.6 * T);
  const ox = dx0 + 12 * T, oy = dy0 + 9.2 * T;
  put("s-oasis", ox, oy, false);
  scene.addBlocker(ox - 40, oy - 90, 80, 80);
  put("s-palms", ox - 76, oy - 30);
  put("s-palm", ox + 70, oy - 10);
  put("s-palm", ox + 40, oy - 92);
  for (let i = 0; i < 14; i++) {
    const x = dx0 + (1 + r() * (d.x1 - d.x0 - 1)) * T, y = dy0 + (1.4 + r() * (d.y1 - d.y0 - 1)) * T;
    if (Math.abs(y / T - (d.y0 + 4.5)) < 1.2 || Math.abs(x / T - S.pathX - 0.5) < 1.5) continue;
    const k = ["s-saguaro", "s-saguaro", "s-saguaro", "s-shrub", "s-palm", "s-skull", "s-bones"][Math.floor(r() * 7)];
    put(k, x, y, k !== "s-skull" && k !== "s-bones");
  }
  scene.tumbleweeds = [0, 1, 2].map((i) => ({
    s: scene.add.image(dx0 - 40, dy0 + (2 + i * 2.6) * T, "s-tumble").setDepth(dy0 + (2 + i * 2.6) * T),
    v: 40 + r() * 30,
    wait: i * 4e3,
    y: dy0 + (2 + i * 2.6) * T,
    x0: dx0 - 40,
    x1: (S.desert.x1 + 1) * T + 40
  }));
  const cf = scene.meadow ? { x: scene.meadow.x + scene.meadow.w * 0.72, y: scene.meadow.y + scene.meadow.h * 0.55 } : null;
  if (cf) {
    for (let a = 0; a < 7; a++) scene.add.circle(cf.x + Math.cos(a / 7 * 6.28) * 16, cf.y - 6 + Math.sin(a / 7 * 6.28) * 7, 4, 9079434).setStrokeStyle(1, 3881787).setDepth(cf.y - 8);
    scene.add.rectangle(cf.x, cf.y - 6, 26, 5, 7029795).setAngle(20).setDepth(cf.y - 7);
    scene.add.rectangle(cf.x, cf.y - 6, 26, 5, 6175519).setAngle(-20).setDepth(cf.y - 7);
    scene.campfire = scene.add.sprite(cf.x, cf.y - 4, "a-fire").setScale(3).setOrigin(0.5, 1).setDepth(cf.y).play("a-fire-go");
    scene.campGlow = scene.add.image(cf.x, cf.y - 16, "soft-glow").setScale(2.6).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99992);
    scene.addBlocker(cf.x - 18, cf.y - 14, 36, 14);
  }
}
function updateSectors(scene, time, delta) {
  const dt = delta / 1e3;
  for (const t of scene.tumbleweeds || []) {
    if (t.wait > 0) {
      t.wait -= delta;
      continue;
    }
    t.s.x += t.v * dt;
    t.s.y = t.y + Math.abs(Math.sin(time / 180)) * -8;
    t.s.rotation += t.v * dt / 14;
    if (t.s.x > t.x1) {
      t.s.x = t.x0;
      t.wait = 3e3 + Math.random() * 6e3;
    }
  }
  if (scene.campGlow) scene.campGlow.setAlpha(scene.night ? 0.55 + 0.12 * Math.sin(time / 90) * Math.sin(time / 37) : 0.08);
  if (scene.vendors && time > (scene.nextVendorLook || 0)) {
    scene.nextVendorLook = time + 1800;
    const v = scene.vendors[Math.floor(Math.random() * scene.vendors.length)];
    const key = v.texture.key.replace(/(down|left|right|up)\d$/, "");
    v.setTexture(`${key}${["down", "left", "right"][Math.floor(Math.random() * 3)]}0`);
  }
}
let LORE = [];
async function loadLore(url = "/api/lore") {
  try {
    LORE = (await (await fetch(url, { cache: "no-store" })).json()).philosophers || [];
  } catch {
    LORE = [];
  }
  return LORE;
}
function loreSprites() {
  return [...new Set(LORE.map((p) => p.sprite).filter(Boolean))];
}
const MOUNTAIN = {
  tiers: [{ x0: 2, x1: 17, y0: 4, y1: 10, base: 80 }, { x0: 4, x1: 14, y0: 2, y1: 7, base: 80 }, { x0: 6, x1: 11, y0: 0, y1: 4, base: 0 }],
  stairs: [[13, 10], [8, 7], [9, 4]],
  trail: [
    [13, 9],
    [13, 8],
    ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16].map((x) => [x, 8]),
    [16, 7],
    [16, 6],
    [8, 6],
    [8, 5],
    ...[6, 7, 9, 10, 11, 12, 13].map((x) => [x, 5]),
    [13, 4],
    [9, 3],
    [9, 2]
  ],
  stations: { epictetus: [4, 9], dostoevsky: [9, 9], seneca: [15, 9], jung: [16, 5], marcus: [6, 6], nietzsche: [11, 6], camus: [13, 3, -34], plato: [9, 1] },
  pines: [
    [2.6, 6.2, "m-pine"],
    [3.4, 5, "m-pine"],
    [16.4, 9.2, "m-rock"],
    [12.2, 9.9, "m-pine"],
    [5.2, 3.6, "m-pine"],
    [7.2, 3.2, "m-snowpine"],
    [10.6, 2.6, "m-snowpine"],
    [15.6, 7.4, "m-pine"]
  ],
  flag: [10.4, 1.2],
  sign: [14.625, 12.25]
};
function mountainWalk(tx, ty, M = MOUNTAIN) {
  if (M.stairs.some(([x, y]) => x === tx && y === ty)) return true;
  const t = [...M.tiers].reverse().find((r) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1);
  if (!t) return false;
  return ty !== t.y1 && tx !== t.x0 && tx !== t.x1;
}
function paintMountain(scene, gc, mapW, mapH, M = MOUNTAIN) {
  const relief = scene.textures.get("a-relief").getSourceImage();
  for (const t of M.tiers) {
    for (let ty = t.y0; ty <= t.y1; ty++) for (let tx = t.x0; tx <= t.x1; tx++) {
      const row = ty === t.y1 ? 32 : ty === t.y0 ? 0 : 16, col = tx === t.x0 ? 16 : tx === t.x1 ? 48 : 32;
      gc.drawImage(relief, col, t.base + row, 16, 16, tx * TILE, ty * TILE, 32, 32);
    }
    if (t.base === 80) {
      grassTop(scene, gc, t);
      cliffFace(scene, gc, t);
    } else snowTop(gc, t);
    cliffShadow(gc, t);
  }
  const floor = scene.textures.get("a-floor").getSourceImage();
  const trail = new Set(M.trail.map(([x, y]) => `${x},${y}`)), onTrail = (tx, ty) => trail.has(`${tx},${ty}`);
  paintAuto(gc, floor, onTrail, mapW, mapH, { TL: [0, 0], T: [16, 0], TR: [32, 0], L: [0, 16], C: [16, 16], R: [32, 16], BL: [0, 32], B: [16, 32], BR: [32, 32] });
  for (const [x, y] of M.stairs) paintStairs(gc, x, y, M.tiers.some((t) => t.base === 0 && t.y1 === y && x >= t.x0 && x <= t.x1));
}
function paintStairs(gc, x, y, snow) {
  const X = x * TILE, Y = y * TILE, P = (col, px, py, w, h) => {
    gc.fillStyle = col;
    gc.fillRect(X + px * 2, Y + py * 2, w * 2, h * 2);
  };
  const C = snow ? ["#2d3340", "#9aa6b8", "#e9eef6", "#5c6675", "#c4cedc"] : ["#2a211a", "#9b9282", "#d9cfba", "#5a5146", "#b9b09d"];
  P(C[0], 0, 0, 16, 16);
  for (let i = 0; i < 4; i++) {
    P(C[1], 2, i * 4, 12, 4);
    P(C[2], 2, i * 4, 12, 1);
    P(C[3], 2, i * 4 + 3, 12, 1);
    P(C[4], 3, i * 4 + 1, 10, 1);
  }
  P(C[3], 2, 0, 1, 16);
  P(C[1], 13, 0, 1, 16);
}
function cliffShadow(gc, t) {
  const g = gc.createLinearGradient(0, (t.y1 + 1) * TILE, 0, (t.y1 + 1) * TILE + 14);
  g.addColorStop(0, "rgba(20,14,30,0.34)");
  g.addColorStop(1, "rgba(20,14,30,0)");
  gc.fillStyle = g;
  gc.fillRect(t.x0 * TILE, (t.y1 + 1) * TILE, (t.x1 - t.x0 + 1) * TILE, 14);
}
function snowTop(gc, t) {
  const X = t.x0 * TILE, Y = t.y0 * TILE, W = (t.x1 - t.x0 + 1) * TILE, H = (t.y1 - t.y0) * TILE;
  gc.fillStyle = "#eef2f8";
  gc.fillRect(X, Y, W, H);
  let seed = 7;
  const r = () => {
    seed = seed * 16807 % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < W * H / 260; i++) {
    const x = X + Math.floor(r() * W / 2) * 2, y = Y + Math.floor(r() * H / 2) * 2, w = 4 + Math.floor(r() * 5) * 2;
    gc.fillStyle = r() < 0.7 ? "#dde6f1" : "#ffffff";
    gc.fillRect(x, y, w, 2);
    if (r() < 0.4) {
      gc.fillStyle = "#cfdae8";
      gc.fillRect(x + 2, y + 2, w - 2, 2);
    }
  }
  for (let i = 0; i < W * H / 3e3; i++) {
    gc.fillStyle = "#ffffff";
    const x = X + Math.floor(r() * W / 2) * 2, y = Y + Math.floor(r() * H / 2) * 2;
    gc.fillRect(x, y - 2, 2, 6);
    gc.fillRect(x - 2, y, 6, 2);
  }
  gc.fillStyle = "rgba(120,140,175,0.55)";
  gc.fillRect(X, Y, W, 4);
  gc.fillRect(X, Y, 4, H);
  gc.fillRect(X + W - 4, Y, 4, H);
  gc.fillStyle = "#5f6f8a";
  gc.fillRect(X, Y, W, 2);
  gc.fillRect(X, Y, 2, H);
  gc.fillRect(X + W - 2, Y, 2, H);
  gc.fillStyle = "rgba(255,255,255,0.7)";
  gc.fillRect(X + 2, Y + H - 3, W - 4, 3);
}
function cliffFace(scene, gc, t) {
  if (!scene.textures.exists("a-aa")) return;
  const aa = scene.textures.get("a-aa").getSourceImage(), W = (t.x1 - t.x0 + 1) * TILE;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = TILE + 8;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  for (let tx = t.x0; tx <= t.x1; tx++) {
    const col = tx === t.x0 ? 112 : tx === t.x1 ? 144 : 128, x = (tx - t.x0) * TILE;
    c.drawImage(aa, col, 272, 16, 16, x, 0, TILE, TILE);
    c.drawImage(aa, col, 288, 16, 4, x, TILE, TILE, 8);
    c.drawImage(aa, col, 260, 16, 6, x, -2, TILE, 12);
  }
  paintSeason(c, W, TILE + 8, season());
  gc.drawImage(cv, t.x0 * TILE, t.y1 * TILE);
}
function grassTop(scene, gc, t) {
  const W = (t.x1 - t.x0 + 1) * TILE, H = (t.y1 - t.y0) * TILE;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const g = [0, 1, 2].map((v) => scene.textures.get(`grass${v}`).getSourceImage());
  for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) c.drawImage(g[(x * 7 + y * 13) % 5 === 0 ? 1 + (x + y) / TILE % 2 : 0], x, y);
  paintSeason(c, W, H, season());
  if (t.tint) {
    c.save();
    c.globalCompositeOperation = "multiply";
    c.fillStyle = t.tint;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
  c.fillStyle = "rgba(30,48,20,0.55)";
  c.fillRect(0, 0, W, 4);
  c.fillRect(0, 0, 4, H);
  c.fillRect(W - 4, 0, 4, H);
  c.fillStyle = "#1d2a14";
  c.fillRect(0, 0, W, 2);
  c.fillRect(0, 0, 2, H);
  c.fillRect(W - 2, 0, 2, H);
  c.fillStyle = "rgba(255,240,190,0.22)";
  c.fillRect(2, H - 3, W - 4, 3);
  gc.drawImage(cv, t.x0 * TILE, t.y0 * TILE);
}
const PROP_FOR = { seneca: "letters", epictetus: "lamp", dostoevsky: "candle", jung: "mandala", marcus: "brazier", nietzsche: "lantern", camus: "boulder", plato: "torch" };
const FLAME = { lamp: [8, 5], candle: [11, 3], lantern: [8, 7], brazier: [8, 6], torch: [8, 1] };
function makePropTextures(scene) {
  const ink = "#1d140c";
  const draw = (key, w, h, fn) => {
    if (scene.textures.exists(key)) return;
    const ct = scene.textures.createCanvas(key, w * 2, h * 2), c = ct.getContext();
    fn((col, x, y, ww = 1, hh = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, ww * 2, hh * 2);
    });
    ct.refresh();
  };
  draw("pp-letters", 16, 16, (px) => {
    px(ink, 2, 9, 12, 6);
    px("#efe2c0", 3, 10, 10, 4);
    px("#d9c79c", 3, 13, 10, 1);
    px(ink, 3, 6, 10, 4);
    px("#f6ecd2", 4, 7, 8, 2);
    px("#b8323a", 7, 8, 2, 2);
    px("#e2575e", 7, 8, 1, 1);
    px(ink, 11, 1, 1, 7);
    px("#f3f3f3", 12, 1, 2, 4);
    px("#cfcfcf", 12, 4, 1, 2);
  });
  draw("pp-lamp", 16, 16, (px) => {
    px(ink, 3, 9, 11, 5);
    px("#b8683a", 4, 10, 9, 3);
    px("#d98b55", 5, 10, 5, 1);
    px(ink, 12, 8, 3, 3);
    px("#b8683a", 13, 9, 1, 1);
    px(ink, 7, 7, 3, 2);
    px("#5a3a22", 8, 8, 1, 1);
    px(ink, 2, 11, 2, 2);
    px("#8c4f2a", 4, 12, 9, 1);
  });
  draw("pp-candle", 16, 16, (px) => {
    px(ink, 0, 10, 16, 5);
    px("#f4ead2", 1, 11, 6, 3);
    px("#e9dbb8", 9, 11, 6, 3);
    px("#7a2f2f", 7, 11, 2, 3);
    px("#b9a982", 2, 12, 4, 1);
    px("#b9a982", 10, 12, 4, 1);
    px(ink, 10, 4, 3, 7);
    px("#f3ead8", 11, 5, 1, 5);
  });
  draw("pp-mandala", 24, 12, (px) => {
    px(ink, 4, 1, 16, 10);
    px(ink, 2, 3, 20, 6);
    px("#9a9a8e", 4, 2, 16, 8);
    px("#9a9a8e", 3, 4, 18, 4);
    px("#b8b8aa", 5, 2, 14, 2);
    px("#5d5d54", 11, 3, 2, 6);
    px("#5d5d54", 7, 5, 10, 2);
    px("#c9a04a", 11, 5, 2, 2);
    px("#5d5d54", 8, 3, 1, 1);
    px("#5d5d54", 15, 3, 1, 1);
    px("#5d5d54", 8, 8, 1, 1);
    px("#5d5d54", 15, 8, 1, 1);
  });
  draw("pp-brazier", 16, 16, (px) => {
    px(ink, 3, 6, 10, 4);
    px("#a8722e", 4, 7, 8, 2);
    px("#d6a24c", 4, 7, 8, 1);
    px(ink, 4, 10, 2, 5);
    px(ink, 10, 10, 2, 5);
    px(ink, 7, 10, 2, 4);
    px("#7a5220", 5, 10, 1, 4);
    px("#7a5220", 11, 10, 0.5, 4);
  });
  draw("pp-lantern", 16, 16, (px) => {
    px(ink, 6, 1, 4, 2);
    px(ink, 4, 3, 8, 11);
    px("#3c3a36", 5, 4, 6, 1);
    px("#ffe9a0", 5, 5, 6, 7);
    px("#ffd05a", 6, 7, 4, 4);
    px(ink, 7, 5, 2, 7);
    px("#3c3a36", 5, 12, 6, 1);
    px(ink, 3, 14, 10, 1);
  });
  draw("pp-boulder", 22, 18, (px) => {
    px(ink, 5, 1, 12, 16);
    px(ink, 2, 4, 18, 11);
    px(ink, 1, 7, 20, 6);
    px("#8b7f73", 3, 3, 16, 13);
    px("#8b7f73", 2, 7, 18, 6);
    px("#a89d90", 5, 3, 8, 4);
    px("#a89d90", 3, 7, 4, 3);
    px("#6c6258", 13, 11, 6, 4);
    px("#6c6258", 6, 14, 10, 2);
    px("#c3b9ab", 7, 4, 3, 1);
  });
  draw("pp-torch", 16, 16, (px) => {
    px(ink, 6, 3, 4, 3);
    px("#5e3b1f", 7, 4, 2, 1);
    px(ink, 7, 6, 2, 9);
    px("#7a4e28", 7, 6, 1, 9);
    px(ink, 5, 14, 6, 2);
  });
  draw("z-torch", 10, 22, (px) => {
    px(ink, 3, 8, 4, 14);
    px("#7a4e28", 4, 9, 1, 12);
    px("#5e3b1f", 5, 9, 1, 12);
    px(ink, 1, 21, 8, 1);
    px(ink, 1, 4, 8, 5);
    px("#6b6b6b", 2, 5, 6, 3);
    px("#9a9a9a", 2, 5, 6, 1);
    px("#3d3d3d", 2, 7, 6, 1);
    px("#b85c1c", 3, 8, 4, 1);
    px("#4a2a12", 2, 9, 1, 1);
    px("#4a2a12", 7, 9, 1, 1);
  });
  draw("z-plinth", 26, 7, (px) => {
    px(INK, 1, 2, 24, 5);
    px("#b9b4a4", 2, 3, 22, 2);
    px("#d9d4c4", 2, 3, 22, 1);
    px("#7d7868", 2, 5, 22, 1);
    px(INK, 4, 0, 18, 2);
    px("#a8a394", 5, 1, 16, 1);
  });
  draw("z-shrine", 24, 30, (px) => {
    const stone = "#9a9a90", light = "#bdbdb2", dark = "#6b6b63", slate = "#5a6675", snow = "#eef2f8";
    px(ink, 1, 25, 22, 5);
    px(stone, 2, 26, 20, 3);
    px(light, 2, 26, 20, 1);
    px(dark, 2, 28, 20, 1);
    px(ink, 5, 13, 14, 13);
    px(stone, 6, 14, 12, 11);
    px(light, 6, 14, 1, 11);
    px(dark, 17, 14, 1, 11);
    px(ink, 8, 15, 8, 10);
    px("#2b2a28", 9, 16, 6, 8);
    px("#ffcf6a", 11, 21, 2, 2);
    px("#fff3c0", 11, 20, 2, 1);
    px("#5a4a2a", 9, 24, 6, 1);
    for (let i = 0; i < 6; i++) px(ink, 8 - i, 7 + i, 8 + i * 2, 1);
    for (let i = 1; i < 6; i++) px(slate, 9 - i, 7 + i, 6 + i * 2, 1);
    px(ink, 1, 13, 22, 1);
    px(dark, 2, 12, 20, 1);
    px(snow, 8, 7, 8, 1);
    px(snow, 7, 8, 10, 1);
    px("#dde6f1", 6, 9, 12, 1);
    px(snow, 4, 10, 2, 1);
    px(snow, 18, 10, 2, 1);
    px(ink, 11, 4, 2, 3);
    px("#c9a04a", 11, 5, 2, 1);
    px(ink, 3, 22, 4, 4);
    px("#e8862a", 4, 23, 2, 2);
    px("#4f8a3a", 5, 22, 1, 1);
    px(ink, 17, 23, 3, 3);
    px("#b8323a", 18, 24, 1, 1);
    px("#e2575e", 18, 24, 1, 1);
  });
}
function placeTorch(scene, x, y) {
  const im = scene.add.image(x, y, "z-torch").setOrigin(0.5, 1).setDepth(y);
  const fire = scene.add.sprite(x, y - im.height + 12, "a-fire").setScale(1.5).setOrigin(0.5, 1).setDepth(y + 1).play({ key: "a-fire-go", startFrame: Math.floor(Math.random() * 8) });
  const glow = scene.add.image(x, y - im.height + 2, "soft-glow").setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDepth(99992);
  scene.addBlocker(x - 5, y - 6, 10, 6);
  return { im, fire, glow };
}
function placeProp(scene, p, x, y) {
  const kind = PROP_FOR[p.prop] ? PROP_FOR[p.prop] : p.prop || PROP_FOR[p.id];
  if (!kind || !scene.textures.exists(`pp-${kind}`)) return;
  const flat = kind === "mandala";
  const im = scene.add.image(x, y, `pp-${kind}`).setOrigin(0.5, 1).setDepth(flat ? -4 : y);
  const f = FLAME[kind];
  if (f) {
    const fx = x - im.width / 2 + f[0] * 2, fy = y - im.height + f[1] * 2;
    scene.add.sprite(fx, fy + 4, "a-fire").setScale(kind === "candle" ? 0.9 : kind === "brazier" ? 1.6 : 1.2).setOrigin(0.5, 1).setDepth(y + 1).play({ key: "a-fire-go", startFrame: Math.floor(Math.random() * 8) });
    scene.add.image(fx, fy, "soft-glow").setScale(kind === "brazier" ? 1.3 : 0.9).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setDepth(99992);
  }
  if (kind === "boulder") scene.addBlocker(x - 18, y - 10, 36, 10);
}
const INK = "#141b1b";
const PHIL_LOOK = {
  seneca: { overlay: {
    down: (px) => {
      for (let i = 0; i < 6; i++) px("#f2eaf1", 2 + i, 8 + i, 3, 1);
      for (let i = 0; i < 5; i++) px("#d9cfd8", 3 + i, 9 + i, 1, 1);
      px("#b8323a", 4, 10, 1, 1);
      px("#b8323a", 5, 11, 1, 1);
      px("#dcd6d2", 5, 10, 1, 1);
      px("#dcd6d2", 10, 10, 1, 1);
      px("#dcd6d2", 6, 11, 4, 1);
    },
    up: (px) => {
      for (let i = 0; i < 6; i++) px("#f2eaf1", 11 - i, 8 + i, 3, 1);
    },
    left: (px) => {
      px("#f2eaf1", 4, 9, 3, 1);
      px("#f2eaf1", 4, 10, 3, 1);
      px("#d9cfd8", 5, 11, 2, 1);
      px("#dcd6d2", 3, 11, 2, 1);
    },
    right: (px) => {
      px("#f2eaf1", 9, 9, 3, 1);
      px("#f2eaf1", 9, 10, 3, 1);
      px("#d9cfd8", 9, 11, 2, 1);
      px("#dcd6d2", 11, 11, 2, 1);
    }
  } },
  epictetus: { overlay: {
    down: (px) => {
      px("#c9b58a", 2, 11, 12, 1);
      px("#c9b58a", 2, 12, 12, 2);
      px("#9c8a62", 2, 13, 12, 1);
      px("#c9b58a", 4, 14, 8, 1);
      px("#7a6a48", 3, 14, 1, 1);
      px("#7a6a48", 12, 14, 1, 1);
      px(INK, 14, 6, 1, 1);
      px(INK, 14, 15, 1, 1);
      px("#a6713a", 14, 7, 1, 8);
      px(INK, 15, 6, 1, 10);
    },
    up: (px) => {
      px("#c9b58a", 2, 11, 12, 1);
      px("#c9b58a", 2, 12, 12, 2);
      px("#9c8a62", 2, 13, 12, 1);
      px("#c9b58a", 4, 14, 8, 1);
    },
    left: (px) => {
      px("#c9b58a", 4, 12, 8, 1);
      px("#c9b58a", 4, 13, 8, 1);
      px("#9c8a62", 5, 14, 6, 1);
      px(INK, 2, 6, 1, 1);
      px(INK, 2, 15, 1, 1);
      px("#a6713a", 2, 7, 1, 8);
      px(INK, 1, 6, 1, 10);
    },
    right: (px) => {
      px("#c9b58a", 4, 12, 8, 1);
      px("#c9b58a", 4, 13, 8, 1);
      px("#9c8a62", 5, 14, 6, 1);
      px(INK, 13, 6, 1, 1);
      px(INK, 13, 15, 1, 1);
      px("#a6713a", 13, 7, 1, 8);
      px(INK, 14, 6, 1, 10);
    }
  } },
  dostoevsky: { swap: { "#8f3e56": "#3b3645", "#c8966b": "#55505e" }, overlay: {
    down: (px) => {
      px("#4a3222", 4, 10, 8, 1);
      px("#4a3222", 4, 11, 8, 1);
      px("#6b4a30", 5, 10, 1, 1);
      px("#6b4a30", 10, 10, 1, 1);
      px("#4a3222", 5, 12, 6, 1);
      px("#3a2618", 6, 13, 4, 1);
    },
    up: () => {
    },
    left: (px) => {
      px("#4a3222", 3, 10, 5, 1);
      px("#4a3222", 3, 11, 5, 1);
      px("#4a3222", 4, 12, 3, 1);
    },
    right: (px) => {
      px("#4a3222", 8, 10, 5, 1);
      px("#4a3222", 8, 11, 5, 1);
      px("#4a3222", 9, 12, 3, 1);
    }
  } },
  jung: { overlay: {
    down: (px) => {
      const ring = (x) => {
        px("#f1c471", x, 7, 3, 1);
        px("#f1c471", x, 9, 3, 1);
        px("#f1c471", x, 8, 1, 1);
        px("#f1c471", x + 2, 8, 1, 1);
        px("#e3f1f5", x + 1, 8, 1, 1);
      };
      ring(3);
      ring(9);
      px("#f1c471", 6, 8, 3, 1);
    },
    up: () => {
    },
    left: (px) => {
      px("#f1c471", 2, 7, 3, 1);
      px("#f1c471", 2, 9, 3, 1);
      px("#f1c471", 2, 8, 1, 1);
      px("#e3f1f5", 3, 8, 1, 1);
      px("#f1c471", 4, 8, 1, 1);
      px("#f1c471", 5, 7, 4, 1);
    },
    right: (px) => {
      px("#f1c471", 11, 7, 3, 1);
      px("#f1c471", 11, 9, 3, 1);
      px("#f1c471", 13, 8, 1, 1);
      px("#e3f1f5", 12, 8, 1, 1);
      px("#f1c471", 11, 8, 1, 1);
      px("#f1c471", 7, 7, 4, 1);
    }
  } },
  marcus: { overlay: {
    down: (px) => {
      for (const [x, y] of [[2, 4], [3, 3], [5, 2], [7, 2], [9, 2], [11, 2], [12, 3], [13, 4]]) px("#4f8a3a", x, y, 1, 1);
      for (const [x, y] of [[4, 3], [6, 3], [8, 3], [10, 3]]) px("#8fc15a", x, y, 1, 1);
      px("#c9a227", 7, 3, 1, 1);
    },
    up: (px) => {
      for (const [x, y] of [[2, 4], [3, 3], [5, 2], [7, 2], [9, 2], [11, 2], [12, 3], [13, 4]]) px("#4f8a3a", x, y, 1, 1);
      for (const [x, y] of [[4, 3], [6, 3], [8, 3], [10, 3]]) px("#8fc15a", x, y, 1, 1);
    },
    left: (px) => {
      for (const [x, y] of [[3, 4], [4, 3], [6, 2], [8, 2], [10, 2], [11, 3]]) px("#4f8a3a", x, y, 1, 1);
      for (const [x, y] of [[5, 3], [7, 3], [9, 3]]) px("#8fc15a", x, y, 1, 1);
    },
    right: (px) => {
      for (const [x, y] of [[4, 3], [5, 2], [7, 2], [9, 2], [11, 3], [12, 4]]) px("#4f8a3a", x, y, 1, 1);
      for (const [x, y] of [[6, 3], [8, 3], [10, 3]]) px("#8fc15a", x, y, 1, 1);
    }
  } },
  nietzsche: { overlay: {
    down: (px) => {
      px("#4a2f1c", 4, 10, 8, 2);
      px("#8a6a4a", 5, 10, 2, 1);
      px("#8a6a4a", 9, 10, 2, 1);
      px("#4a2f1c", 3, 11, 1, 2);
      px("#4a2f1c", 12, 11, 1, 2);
      px("#2b1d12", 7, 11, 2, 1);
    },
    up: () => {
    },
    left: (px) => {
      px("#4a2f1c", 2, 10, 5, 2);
      px("#8a6a4a", 3, 10, 2, 1);
      px("#4a2f1c", 1, 11, 1, 2);
    },
    right: (px) => {
      px("#4a2f1c", 9, 10, 5, 2);
      px("#8a6a4a", 11, 10, 2, 1);
      px("#4a2f1c", 14, 11, 1, 2);
    }
  } },
  camus: { swap: { "#8d977f": "#b59a6a", "#5f7160": "#8a7250", "#f2eaf1": "#2b2622" }, overlay: {
    down: (px) => {
      px("#f2eaf1", 10, 10, 2, 1);
      px("#ff8a3a", 12, 10, 1, 1);
    },
    up: () => {
    },
    left: (px) => {
      px("#f2eaf1", 2, 10, 2, 1);
      px("#ff8a3a", 1, 10, 1, 1);
    },
    right: (px) => {
      px("#f2eaf1", 12, 10, 2, 1);
      px("#ff8a3a", 14, 10, 1, 1);
    }
  } },
  plato: { swap: { "#5f7160": "#b9b4a4", "#4e484a": "#7d7868", "#fce2ca": "#d9d4c4" }, overlay: {
    down: (px) => {
      for (const [x, y] of [[3, 3], [5, 2], [7, 2], [9, 2], [11, 2], [12, 3]]) px("#7d7868", x, y, 1, 1);
    },
    up: () => {
    },
    left: (px) => {
      for (const [x, y] of [[4, 3], [6, 2], [8, 2], [10, 2]]) px("#7d7868", x, y, 1, 1);
    },
    right: (px) => {
      for (const [x, y] of [[5, 2], [7, 2], [9, 2], [11, 3]]) px("#7d7868", x, y, 1, 1);
    }
  } }
};
function applyLook(scene, key, id) {
  const look = PHIL_LOOK[id];
  if (!look || scene.textures.get(`${key}down0`).looked) return;
  const swap = look.swap && Object.entries(look.swap).map(([a, b]) => [a, b].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))));
  const frames = [];
  for (const dir of ["down", "up", "left", "right"]) for (const f of ["0", "1", "2", "3", "G"]) frames.push([dir, `${key}${dir}${f}`]);
  frames.push(["up", `${key}item`]);
  for (const [dir, k] of frames) {
    if (!scene.textures.exists(k)) continue;
    const t = scene.textures.get(k), c = t.getContext(), w = t.width, h = t.height;
    if (swap) {
      const im = c.getImageData(0, 0, w, h), d = im.data;
      for (let i = 0; i < d.length; i += 4) for (const [[r, g, b], [R, G, B]] of swap) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) {
        d[i] = R;
        d[i + 1] = G;
        d[i + 2] = B;
        break;
      }
      c.putImageData(im, 0, 0);
    }
    const fn = look.overlay && look.overlay[dir];
    if (fn) fn((col, x, y, ww = 1, hh = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, ww * 2, hh * 2);
    });
    t.refresh();
    t.looked = true;
  }
}
function updatePhilosophers(scene, time) {
  for (const ph of scene.philosophers || []) {
    const s = ph.s;
    if (!s.active) continue;
    if (ph.p.id === "plato") {
      if (time > (ph.next || 0)) {
        ph.next = time + 2500 + Math.random() * 3e3;
        const g = scene.add.image(s.x + (Math.random() - 0.5) * 20, s.y - 20 - Math.random() * 24, "soft-glow").setScale(0.12).setTint(16777215).setBlendMode(Phaser.BlendModes.ADD).setDepth(s.y + 1);
        scene.tweens.add({ targets: g, scale: 0.3, alpha: 0, duration: 700, onComplete: () => g.destroy() });
      }
      continue;
    }
    if (ph.beat && time < ph.beat.until) {
      ph.beat.tick && ph.beat.tick(time);
      continue;
    }
    if (ph.beat) {
      ph.beat = null;
      s.setTexture(`${ph.key}down0`);
      s.y = ph.baseY;
    }
    if (ph.facing || time < (ph.next || 0)) continue;
    ph.next = time + 2200 + Math.random() * 3800;
    const reads = ph.p.id === "seneca" || ph.p.id === "dostoevsky" || ph.p.id === "jung";
    const v = Math.random();
    if (v < 0.3) {
      s.setTexture(`${ph.key}downG`);
      ph.beat = { until: time + 650 };
    } else if (v < 0.55) {
      s.setTexture(`${ph.key}${Math.random() < 0.5 ? "left" : "right"}0`);
      ph.beat = { until: time + 900 };
    } else if (v < 0.8 && reads) {
      s.setTexture(`${ph.key}item`);
      ph.beat = { until: time + 1400 };
    } else {
      const y0 = ph.baseY;
      ph.beat = { until: time + 700, tick: (t) => {
        s.y = y0 + (Math.sin((t - time) / 700 * Math.PI * 2) > 0 ? 1 : 0) * 2;
      } };
    }
  }
}
function decorateMountain(scene, opts = {}) {
  makePropTextures(scene);
  const T = TILE, put = (key, x, y, block = true) => {
    const im = scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    if (block) scene.addBlocker(x - im.width / 2 + 6, y - 14, im.width - 12, 12);
    return im;
  };
  const M = opts.layout || MOUNTAIN;
  for (const [x, y, k] of M.pines) put(k, x * T, y * T);
  const fx = M.flag[0] * T, fy = M.flag[1] * T;
  scene.add.rectangle(fx, fy + 30, 3, 46, 6175519).setOrigin(0.5, 1).setDepth(fy + 30);
  scene.add.sprite(fx + 9, fy - 8, "a-flag-red").setScale(2).setDepth(fy + 31).play("a-flag-red-go");
  const sx = M.sign[0] * T, sy = M.sign[1] * T;
  scene.add.image(sx, sy, "sign").setOrigin(0.5, 1).setDepth(sy);
  scene.label(sx, sy - 26, "\u26F0 Philosophers' Trail", "#ffe08a");
  scene.philosophers = [];
  for (const p of LORE) {
    const st = M.stations[p.id];
    if (!st || !scene.textures.exists(`a-ch-${p.sprite}`)) continue;
    const key = `phil-${p.id}-`;
    scene.makeChar(key, p.sprite);
    applyLook(scene, key, p.id);
    const x = st[0] * T + 16, y = st[1] * T + 28;
    const sc = opts.philScale || 1.5;
    const s = scene.add.sprite(x, y, `${key}down0`).setOrigin(0.5, 1).setDepth(y).setScale(sc);
    s.baseScale = sc;
    if (p.id === "plato" && scene.textures.exists("z-plinth")) scene.add.image(x, y + 4, "z-plinth").setOrigin(0.5, 1).setDepth(y - 1);
    scene.label(x, y - 52 * sc / 1.5 - (opts.stagger ? LORE.indexOf(p) % 2 * 22 : 0), `\u{1F4DC} ${p.name}`, "#ffe08a");
    scene.addBlocker(x - 9, y - 8, 18, 8);
    scene.philosophers.push({ s, key, p, baseY: y });
    placeProp(scene, p, x + (st[2] || 28) * sc / 1.5, y);
    scene.doors.push({ x, y: y + 14, id: `phil-${p.id}`, name: p.name, verb: "Talk to", open: () => opts.onTalk ? opts.onTalk(p) : openPanel(`\u{1F4DC} ${p.name}`, async () => philosopherPanel(p)) });
  }
}
function philosopherPanel(p) {
  const lore = (p.lore || "").trim();
  return [
    el("p", { class: "small" }, p.title || ""),
    el("blockquote", { class: "quote" }, `\u201C${p.quote}\u201D`),
    el("p", { class: "small" }, `\u2014 ${p.source}`),
    el("h3", {}, "Lore"),
    lore ? el("p", { class: "lore" }, lore) : el("div", { class: "empty" }, 'No lore yet. Write their story in pixel-village/lore/philosophers.json (the "lore" field), or tell Claude what to write.')
  ];
}
export {
  GROW,
  MOUNTAIN,
  decorateMountain,
  decorateSectors,
  halloween,
  loadLore,
  loreSprites,
  makeSectorTextures,
  mountainWalk,
  paintAuto,
  paintDesert,
  paintMountain,
  paintSeason,
  paintStairs,
  philosopherPanel,
  placeTorch,
  preloadSectors,
  season,
  seasonizeTexture,
  sectorLayout,
  shiftLayout,
  updatePhilosophers,
  updateSectors
};
