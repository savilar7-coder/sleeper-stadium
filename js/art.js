import { TILE, hash } from "./core.js";
const CHAR = {
  player: "Boy"
};
const CHAR_POOL = ["Villager4", "Villager5", "Inspector", "Samurai", "Villager"];
const LOOKS = {};
const HOUSES = {
  lodge: [400, 224, 64, 80],
  red: [192, 0, 64, 48],
  shop: [256, 0, 48, 48],
  green: [304, 0, 64, 48],
  orange: [0, 0, 64, 48],
  beige: [64, 0, 64, 48],
  orange2: [128, 0, 64, 48],
  clay: [368, 0, 48, 48],
  wood: [416, 0, 48, 48],
  brown: [464, 0, 64, 64]
};
const HOUSE_FOR = {};
const BUILDING_FOR = {};
const ANIMALS = ["Cat", "Chicken", "Pig", "Cow", "Horse", "Donkey", "Dog", "Frog"];
const FOLK = ["OldMan", "OldMan2", "OldMan3", "Villager6", "ManGreen", "Sultan", "Knight"];
const HOUSE_POOL = ["orange", "beige", "orange2", "clay", "wood", "brown"];
function preloadArt(scene, lite = false) {
  scene.load.image("a-floor", "assets/TilesetFloor.png");
  scene.load.image("a-nature", "assets/TilesetNature.png");
  if (!lite) {
    scene.load.spritesheet("pk-mill", "assets/park/mill.png", { frameWidth: 64, frameHeight: 64 });
    scene.load.spritesheet("pk-boat", "assets/park/boat.png", { frameWidth: 40, frameHeight: 32 });
    scene.load.image("a-house", "assets/TilesetHouse.png");
    for (const a of ANIMALS) scene.load.image(`a-an-${a}`, `assets/animals/${a}.png`);
  }
  for (const c of new Set([...Object.values(CHAR), ...CHAR_POOL, ...lite ? [] : FOLK])) scene.load.image(`a-ch-${c}`, `assets/chars/${c}.png`);
  scene.load.image("a-int", "assets/interior/Element.png");
  scene.load.spritesheet("a-smoke", "assets/fx/Smoke.png", { frameWidth: 32, frameHeight: 32 });
}
function makeTextures(scene) {
  const cut = (key, src, sx, sy, sw, sh, scale = 2, cw = sw * scale, ch = sh * scale) => {
    if (scene.textures.exists(key) || !scene.textures.exists(src)) return;
    const img = scene.textures.get(src).getSourceImage();
    const ct = scene.textures.createCanvas(key, cw, ch);
    const ctx = ct.getContext();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, sw, sh, Math.round((cw - sw * scale) / 2), ch - sh * scale, sw * scale, sh * scale);
    ct.refresh();
  };
  [[0, 192], [32, 192], [48, 192]].forEach(([x, y], v) => cut(`grass${v}`, "a-floor", x, y, 16, 16));
  cut("path", "a-floor", 80, 176, 16, 16);
  [[0, 0], [32, 0], [256, 0], [224, 0]].forEach(([x, y], v) => cut(`tree${v}`, "a-nature", x, y, 32, 32));
  cut("tree", "a-nature", 0, 0, 32, 32);
  cut("flower", "a-nature", 0, 176, 16, 16, 2);
  cut("bush", "a-nature", 0, 160, 16, 16, 2);
  for (const [id, L] of Object.entries(LOOKS)) {
    const key = `a-ch-look-${id}`;
    if (scene.textures.exists(key) || !scene.textures.exists(`a-ch-${L.base}`)) continue;
    const img = scene.textures.get(`a-ch-${L.base}`).getSourceImage(), ct = scene.textures.createCanvas(key, img.width, img.height), c = ct.getContext();
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height), px = d.data, hex = (i) => `#${[px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    for (let i = 0; i < px.length; i += 4) {
      const to = px[i + 3] && L.map[hex(i)];
      if (to) {
        px[i] = parseInt(to.slice(1, 3), 16);
        px[i + 1] = parseInt(to.slice(3, 5), 16);
        px[i + 2] = parseInt(to.slice(5, 7), 16);
      }
    }
    c.putImageData(d, 0, 0);
    ct.refresh();
  }
  for (const [id, rec] of [["claude", false], ["claude-tiktok", true]]) {
    const key = `a-ch-look-spark-${id}`;
    if (scene.textures.exists(key)) continue;
    const ct = scene.textures.createCanvas(key, 64, 112), c = ct.getContext();
    for (let col = 0; col < 4; col++) for (let row = 0; row < 7; row++) {
      const ox = col * 16 + 8, oy = row * 16 + 9, turn = row % 4 * 0.12 + col * 0.05, big = row === 4 || row === 6 && col === 1 ? 1.12 : 1;
      const rays = 8;
      for (const [w, col2] of [[4, "#1d140c"], [2, "#d97757"]]) {
        c.strokeStyle = col2;
        c.lineWidth = w;
        c.lineCap = "round";
        for (let i = 0; i < rays; i++) {
          const ang = turn + i / rays * Math.PI * 2, len = (i % 2 ? 5.4 : 6.6) * big;
          c.beginPath();
          c.moveTo(ox + Math.cos(ang) * 1.2, oy + Math.sin(ang) * 1.2);
          c.lineTo(ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
          c.stroke();
        }
      }
      c.fillStyle = "#d97757";
      c.beginPath();
      c.arc(ox, oy, 2.2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#f0a07e";
      c.fillRect(ox - 2, oy - 3, 2, 1);
      if (rec) {
        c.fillStyle = "#1d140c";
        c.fillRect(ox + 3, oy - 8, 4, 4);
        c.fillStyle = "#e0394c";
        c.fillRect(ox + 4, oy - 7, 2, 2);
      }
    }
    ct.refresh();
  }
  const charName = (key) => {
    const m = /^(?:npc|person)-(.+)-$/.exec(key);
    const id = m ? m[1] : key;
    if (id === "claude" || id === "claude-tiktok") return `look-spark-${id}`;
    if (LOOKS[id]) return `look-${id}`;
    return CHAR[id] || CHAR_POOL[hash(id) % CHAR_POOL.length];
  };
  const frames = (key, who) => {
    ["down", "up", "left", "right"].forEach((dir, col) => [0, 1, 2, 3].forEach((row) => cut(`${key}${dir}${row}`, `a-ch-${who}`, col * 16, row * 16, 16, 16)));
    cut(`${key}0`, `a-ch-${who}`, 0, 0, 16, 16);
    cut(`${key}1`, `a-ch-${who}`, 0, 16, 16, 16);
    ["down", "up", "left", "right"].forEach((dir, col) => cut(`${key}${dir}G`, `a-ch-${who}`, col * 16, 64, 16, 16));
    cut(`${key}item`, `a-ch-${who}`, 16, 96, 16, 16);
  };
  frames("player", CHAR.player);
  scene.makePerson = (key) => frames(key, charName(key));
  scene.makeChar = (key, who) => frames(key, who);
  for (const [k, x, y, w, h] of [
    ["plant", 0, 112, 16, 32],
    ["drawer", 16, 112, 16, 32],
    ["bigshelf", 128, 112, 32, 32],
    ["table", 32, 160, 48, 16],
    ["pic", 128, 160, 16, 16],
    ["pot", 0, 160, 16, 16]
  ]) cut(`f-${k}`, "a-int", x, y, w, h);
  if (!scene.textures.exists("wood-floor")) {
    const ct = scene.textures.createCanvas("wood-floor", TILE, TILE), c = ct.getContext();
    c.fillStyle = "#c08a55";
    c.fillRect(0, 0, TILE, TILE);
    c.fillStyle = "#b07a48";
    for (let y = 0; y < TILE; y += 8) c.fillRect(0, y + 7, TILE, 1);
    c.fillStyle = "#a06c3c";
    c.fillRect(10, 0, 1, 8);
    c.fillRect(26, 8, 1, 8);
    c.fillRect(6, 16, 1, 8);
    c.fillRect(20, 24, 1, 8);
    c.fillStyle = "rgba(255,255,255,0.06)";
    c.fillRect(0, 0, TILE, 2);
    ct.refresh();
  }
  if (!scene.anims.exists("smoke-puff")) scene.anims.create({ key: "smoke-puff", frames: scene.anims.generateFrameNumbers("a-smoke", { start: 0, end: 5 }), frameRate: 4 });
  for (const a of ANIMALS) {
    cut(`an-${a}0`, `a-an-${a}`, 0, 0, 16, 16);
    cut(`an-${a}1`, `a-an-${a}`, 16, 0, 16, 16);
  }
  scene.makeHouse = (key) => {
    const name = HOUSE_FOR[key] || HOUSE_POOL[hash(key) % HOUSE_POOL.length];
    const [x, y, w, h] = HOUSES[name];
    if (scene.textures.exists(key)) return h * 2;
    const H = h * 2 + 64;
    cut(key, "a-house", x, y, w, h, 2, 128, H);
    const kind = BUILDING_FOR[key];
    if (!kind) return h * 2;
    const c = scene.textures.get(key).getContext();
    const ox = Math.round((64 - w) / 2), oy = H / 2 - h;
    const px = (col, px0, py0, pw = 1, ph = 1) => {
      c.fillStyle = col;
      c.fillRect((ox + px0) * 2, (oy + py0) * 2, pw * 2, ph * 2);
    };
    drawJob(px, kind, w, h);
    scene.textures.get(key).refresh();
    return h * 2;
  };
  const tex = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const ctex = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const ct = scene.textures.createCanvas(key, w, h), c = ct.getContext();
    draw((col, x, y, ww = 1, hh = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, ww * 2, hh * 2);
    });
    ct.refresh();
  };
  const ink = "#1d140c";
  ctex("shopsign", 36, 30, (px) => {
    px(ink, 0, 0, 17, 3);
    px("#8a5a2b", 1, 1, 15, 1);
    px(ink, 0, 0, 2, 5);
    px("#8a5a2b", 0, 1, 1, 3);
    px(ink, 14, 2, 3, 5);
    px("#6b4423", 15, 3, 1, 3);
    px(ink, 3, 3, 1, 2);
    px(ink, 13, 3, 1, 2);
    px(ink, 2, 4, 15, 11);
    px("#8a5a2b", 3, 5, 13, 9);
    px("#c08a4a", 3, 5, 13, 1);
    px("#a8743a", 3, 6, 13, 1);
    px("#7a4f26", 3, 9, 13, 1);
    px("#6b4423", 3, 13, 13, 1);
    for (const [x, y] of [[4, 6], [14, 6], [4, 12], [14, 12]]) px("#e8d6a8", x, y);
  });
  ctex("sign", 28, 30, (px) => {
    px(ink, 5, 7, 4, 8);
    px("#8a5a2b", 6, 7, 2, 8);
    px("#6b4423", 7, 7, 1, 8);
    px(ink, 0, 0, 14, 8);
    px("#c89a5a", 1, 1, 12, 6);
    px("#e2b878", 1, 1, 12, 1);
    px("#b0824a", 1, 4, 12, 1);
    px("#a8743a", 1, 6, 12, 1);
    for (const [x, y] of [[1, 1], [12, 1], [1, 6], [12, 6]]) px("#6b4423", x, y);
  });
}
function drawJob(px, kind, w, h) {
  const ink = "#2b1d12", wood = "#8a5a2b", cream = "#f6f1eb", gold = "#e8b84a", red = "#c8423a", blue = "#4f86c6", glass = "#9fd6f2", brick = "#b8402f", grey = "#7f8aa3";
  const cx = Math.floor(w / 2), wallY = h - 22;
  const awning = (col, half) => {
    px(ink, cx - half, wallY - 2, half * 2, 1);
    for (let i = 0; i < half; i++) px(i % 2 ? cream : col, cx - half + i * 2, wallY - 1, 2, 4);
    px(ink, cx - half, wallY + 3, half * 2, 1);
    px(ink, cx - half, wallY - 2, 1, 6);
    px(ink, cx + half - 1, wallY - 2, 1, 6);
  };
  const chimney = (x, y0, hh, col = brick) => {
    px(ink, x, y0, 6, hh);
    px(col, x + 1, y0 + 1, 4, hh - 2);
    px("#d9604a", x + 1, y0 + 1, 1, hh - 2);
    px(ink, x - 1, y0 - 1, 8, 2);
    px("#9a9a8e", x, y0 - 1, 6, 1);
  };
  const pole = (x, y0, hh) => {
    px(ink, x, y0, 2, hh);
    px("#a6713a", x, y0 + 1, 1, hh - 2);
  };
  if (kind === "observatory") {
    px(ink, cx - 9, -10, 18, 12);
    px(grey, cx - 8, -9, 16, 10);
    px("#a7b2c8", cx - 7, -9, 8, 3);
    px("#5b6480", cx - 8, -1, 16, 2);
    px(ink, cx - 10, 2, 20, 1);
    px(ink, cx + 3, -18, 3, 9);
    px("#c9a43a", cx + 4, -17, 1, 7);
    px(ink, cx + 5, -21, 5, 4);
    px(glass, cx + 6, -20, 2, 2);
    px(ink, cx + 1, -12, 3, 3);
    px(ink, 3, wallY + 3, 7, 7);
    px("#1d2a4a", 4, wallY + 4, 5, 5);
    px("#fff6c8", 5, wallY + 5, 1, 1);
    px("#fff6c8", 7, wallY + 7, 1, 1);
  } else if (kind === "library") {
    px(ink, cx - 5, -14, 10, 16);
    px(cream, cx - 4, -13, 8, 14);
    px("#d9cfb8", cx + 3, -13, 1, 14);
    for (let i = 0; i < 5; i++) px(ink, cx - 6 + i, -19 + i, 12 - i * 2, 1);
    px(ink, cx - 1, -21, 2, 2);
    px(gold, cx - 1, -21, 1, 1);
    px(ink, cx - 3, -11, 6, 8);
    px("#4a3320", cx - 2, -10, 4, 6);
    px("#efe2c0", cx - 1, -9, 2, 4);
    px("#d9c79c", cx - 1, -9, 1, 4);
    px(ink, 5, wallY + 1, 11, 12);
    px(cream, 6, wallY + 2, 9, 10);
    px(ink, 6, wallY + 5, 9, 1);
    px(ink, 6, wallY + 8, 9, 1);
    for (let i = 0; i < 8; i++) px([red, blue, gold, "#5f9e4a"][i % 4], 6 + i % 4 * 2 + (i > 3 ? 1 : 0), wallY + (i < 4 ? 3 : 6), 1, 2);
    px(ink, w - 13, wallY + 4, 8, 8);
    px("#efe2c0", w - 12, wallY + 5, 6, 6);
    px("#d9c79c", w - 12, wallY + 5, 1, 6);
    px("#d9c79c", w - 7, wallY + 5, 1, 6);
    px(ink, w - 10, wallY + 6, 3, 1);
    px(ink, w - 10, wallY + 8, 2, 1);
  } else if (kind === "shop" || kind === "print-shop") {
    px(ink, cx - 11, -11, 22, 10);
    px("#d77a35", cx - 10, -10, 20, 8);
    px("#f0a060", cx - 10, -10, 20, 1);
    px(cream, cx - 8, -8, 5, 1);
    px(cream, cx - 2, -8, 7, 1);
    px(cream, cx - 8, -5, 9, 1);
    px(cream, cx + 2, -5, 3, 1);
    px(ink, cx - 9, -1, 2, 2);
    px(ink, cx + 7, -1, 2, 2);
    awning(red, 12);
    px(ink, w - 15, wallY + 5, 9, 8);
    px(cream, w - 14, wallY + 6, 7, 6);
    px("#6fb35b", w - 13, wallY + 9, 2, 2);
    px("#e86a8a", w - 10, wallY + 9, 2, 2);
    px(gold, w - 12, wallY + 7, 2, 1);
  } else if (kind === "post-office") {
    pole(cx + 10, -23, 25);
    for (let i = 0; i < 5; i++) px(i ? blue : cream, cx + 12, -22 + i, 6 - i, 1);
    px(ink, cx + 12, -17, 2, 1);
    px(ink, cx - 9, -8, 16, 10);
    px(cream, cx - 8, -7, 14, 8);
    px(ink, cx - 8, -7, 7, 1);
    px(ink, cx - 1, -6, 7, 1);
    px(ink, cx - 2, -5, 2, 1);
    px(ink, cx - 4, -6, 2, 1);
    px(ink, cx + 2, -6, 1, 1);
    px(red, cx - 7, -2, 3, 2);
    awning(blue, 11);
    px(ink, 4, h - 14, 8, 14);
    px(red, 5, h - 13, 6, 12);
    px("#e2665c", 5, h - 13, 6, 2);
    px(ink, 6, h - 9, 4, 1);
  } else if (kind === "office") {
    chimney(cx - 12, -8, 10);
    px(ink, 5, wallY + 2, 12, 9);
    px(glass, 6, wallY + 3, 10, 7);
    px(ink, 11, wallY + 3, 1, 7);
    px("#fff6c8", 7, wallY + 6, 3, 2);
    px(ink, 6, wallY + 8, 10, 1);
    px(ink, cx + 7, wallY + 4, 7, 5);
    px(gold, cx + 8, wallY + 5, 5, 3);
    px(ink, cx + 9, wallY + 6, 3, 1);
  } else if (kind === "pinboard-studio" || kind === "studio-pin") {
    px(ink, cx - 7, 3, 14, 9);
    px(glass, cx - 6, 4, 12, 7);
    px("#ffffff", cx - 5, 5, 4, 1);
    px(ink, cx, 4, 1, 7);
    px(ink, cx - 6, 7, 12, 1);
    pole(cx + 11, -12, 14);
    for (let i = 0; i < 4; i++) px("#e86a8a", cx + 13, -11 + i, 5 - i, 1);
    px(ink, 4, wallY + 2, 13, 10);
    px("#c99a62", 5, wallY + 3, 11, 8);
    px(cream, 6, wallY + 4, 3, 3);
    px(cream, 10, wallY + 5, 4, 3);
    px(cream, 7, wallY + 8, 3, 2);
    px(red, 7, wallY + 4);
    px(blue, 12, wallY + 5);
    px("#3ba84a", 8, wallY + 8);
    px(ink, w - 10, wallY + 8, 4, 4);
    px(red, w - 9, wallY + 9, 2, 2);
  } else if (kind === "studio") {
    px(ink, cx - 5, -12, 10, 2);
    px(ink, cx - 7, -10, 14, 8);
    px(ink, cx - 5, -2, 10, 2);
    px("#3a3f4b", cx - 4, -11, 8, 1);
    px("#3a3f4b", cx - 6, -9, 12, 6);
    px("#3a3f4b", cx - 4, -3, 8, 1);
    for (const [x, y] of [[cx - 4, -8], [cx + 2, -8], [cx - 4, -4], [cx + 2, -4]]) px(cream, x, y, 2, 2);
    px(gold, cx - 1, -6, 2, 2);
    pole(cx + 10, -20, 22);
    px(ink, cx + 7, -21, 8, 1);
    px(red, cx + 10, -23, 2, 2);
    px(ink, 4, wallY + 3, 10, 8);
    px("#2f2f2f", 5, wallY + 4, 8, 6);
    for (let i = 0; i < 4; i++) px(i % 2 ? cream : "#2f2f2f", 5 + i * 2, wallY + 4, 2, 2);
    px(ink, w - 12, wallY + 2, 6, 6);
    px("#fff6c8", w - 11, wallY + 3, 4, 4);
    px(gold, w - 10, wallY + 4, 2, 2);
  } else if (kind === "newsstand" || kind === "bank") {
    pole(cx - 1, -16, 18);
    px(ink, cx, -21, 2, 1);
    px(ink, cx - 1, -20, 5, 1);
    px(ink, cx - 2, -19, 8, 1);
    px(ink, cx - 2, -18, 9, 2);
    px(ink, cx - 2, -16, 8, 1);
    px(ink, cx - 1, -15, 5, 1);
    px("#9aa3ad", cx, -19, 5, 1);
    px("#c9d1d9", cx, -18, 7, 1);
    px("#9aa3ad", cx, -17, 6, 1);
    px("#6b7480", cx, -16, 5, 1);
    px(ink, 3, h - 12, 10, 12);
    px(wood, 4, h - 11, 8, 10);
    px(cream, 5, h - 10, 6, 3);
    px(ink, 6, h - 9, 4, 1);
    px(cream, 5, h - 6, 6, 3);
    px(ink, 6, h - 5, 3, 1);
    px(ink, 2, wallY - 1, 12, 4);
    px(red, 3, wallY, 10, 2);
    px(cream, 5, wallY, 6, 1);
  } else if (kind === "town-hall") {
    px(ink, cx - 7, -22, 14, 26);
    px(cream, cx - 6, -21, 12, 24);
    px("#d9cfb8", cx + 4, -21, 2, 24);
    for (let i = 0; i < 6; i++) px(ink, cx - 8 + i, -28 + i, 16 - i * 2, 1);
    px(ink, cx - 1, -30, 2, 2);
    px(gold, cx - 1, -30, 1, 1);
    px(ink, cx - 5, -18, 10, 10);
    px(cream, cx - 4, -17, 8, 8);
    px(ink, cx - 1, -14, 2, 2);
    px(ink, cx, -16, 1, 3);
    px(ink, cx, -13, 3, 1);
    px(ink, cx - 2, -6, 4, 6);
    px("#4a3320", cx - 1, -5, 2, 4);
    px(gold, cx - 1, -4, 2, 1);
    px("#9a9a8e", cx - 10, h - 2, 20, 2);
    px("#b8b8aa", cx - 10, h - 2, 20, 1);
  } else {
    chimney(cx + 7, -12, 14);
    px(ink, 5, wallY + 3, 1, 9);
    px("#9aa3ad", 3, wallY + 2, 5, 3);
    px(ink, 10, wallY + 3, 1, 9);
    px("#9aa3ad", 9, wallY + 2, 3, 2);
    px(ink, w - 14, h - 7, 11, 7);
    px(wood, w - 13, h - 6, 9, 5);
    px("#c99a62", w - 12, h - 5, 2, 2);
    px("#c99a62", w - 8, h - 5, 2, 2);
    px("#c99a62", w - 10, h - 3, 2, 1);
  }
}
export {
  ANIMALS,
  BUILDING_FOR,
  CHAR,
  CHAR_POOL,
  HOUSES,
  HOUSE_FOR,
  HOUSE_POOL,
  makeTextures,
  preloadArt
};
