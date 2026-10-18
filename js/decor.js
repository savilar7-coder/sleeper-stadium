import { TILE } from "./core.js";
import { halloween, season, seasonizeTexture } from "./sectors.js";
function preloadDecor(scene) {
  scene.load.image("a-detail", "assets/TilesetFloorDetail.png");
  scene.load.image("a-water", "assets/TilesetWater.png");
  const sheet = (key, file, w, h) => scene.load.spritesheet(key, `assets/anim/${file}`, { frameWidth: w, frameHeight: h });
  sheet("a-ripple", "ripple.png", 16, 16);
  sheet("a-flag-red", "flag-red.png", 16, 16);
  sheet("a-flag-blue", "flag-blue.png", 16, 16);
  sheet("a-plant", "plant.png", 16, 16);
  sheet("a-leaf", "leaf.png", 6, 7);
  sheet("a-leaf-pink", "leaf-pink.png", 6, 7);
  sheet("a-mill", "watermill.png", 34, 36);
}
function makeDecorTextures(scene) {
  const cut = (key, src, sx, sy, sw, sh) => {
    if (scene.textures.exists(key)) return;
    const ct = scene.textures.createCanvas(key, sw * 2, sh * 2), c = ct.getContext();
    c.imageSmoothingEnabled = false;
    c.drawImage(scene.textures.get(src).getSourceImage(), sx, sy, sw, sh, 0, 0, sw * 2, sh * 2);
    ct.refresh();
  };
  [[160, 144], [64, 176], [80, 176], [64, 224]].forEach(([x, y], i) => cut(`d-bush${i}`, "a-nature", x, y, 16, 16));
  const st = { autumn: [144, 288, 48, 48], spring: [0, 288, 48, 48], winter: [96, 288, 48, 48] }[season()];
  if (st && !scene.textures.exists("d-smalltree")) {
    const ct = scene.textures.createCanvas("d-smalltree", 68, 68), c = ct.getContext();
    c.imageSmoothingEnabled = false;
    c.drawImage(scene.textures.get("a-nature").getSourceImage(), st[0], st[1], st[2], st[3], 0, 0, 68, 68);
    ct.refresh();
  } else cut("d-smalltree", "a-nature", 96, 128, 32, 32);
  [[0, 176], [16, 176], [48, 176], [96, 176]].forEach(([x, y], i) => cut(`d-flw${i}`, "a-nature", x, y, 16, 16));
  cut("d-stump", "a-nature", 192, 208, 16, 16);
  cut("d-barrel", "a-int", 0, 0, 16, 16);
  cut("d-pot", "a-int", 16, 0, 16, 16);
  cut("d-jar", "a-int", 48, 0, 16, 16);
  cut("d-lamp", "a-int", 96, 48, 16, 32);
  cut("d-bench", "a-int", 176, 16, 48, 16);
  cut("d-fence", "a-int", 176, 32, 48, 32);
  cut("d-line", "a-int", 224, 32, 32, 32);
  cut("d-pond", "a-water", 0, 96, 48, 48);
  cut("d-lily", "a-water", 176, 48, 16, 16);
  for (const k of ["d-pond", "d-lily", "d-bush0", "d-bush1", "d-bush2", "d-bush3"]) seasonizeTexture(scene, k);
  for (const [key, frames, rate] of [["a-ripple", 4, 5], ["a-flag-red", 4, 6], ["a-flag-blue", 4, 6], ["a-plant", 4, 3]]) {
    if (!scene.anims.exists(`${key}-go`)) scene.anims.create({ key: `${key}-go`, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: frames - 1 }), frameRate: rate, repeat: -1 });
  }
  const lighten = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${Math.min(255, (n >> 16) + 60)},${Math.min(255, (n >> 8 & 255) + 60)},${Math.min(255, (n & 255) + 60)})`;
  };
  for (const [k, col] of [["bf0", "#f6d04d"], ["bf1", "#f2f2f2"], ["bf2", "#7ec8f0"], ["bf3", "#f39ab5"]]) {
    for (const open of [0, 1, 2]) {
      const key = `${k}-${open}`;
      if (scene.textures.exists(key)) continue;
      const ct = scene.textures.createCanvas(key, 18, 14), c = ct.getContext();
      const px = (cc, x, y, w = 1, h = 1) => {
        c.fillStyle = cc;
        c.fillRect(x * 2, y * 2, w * 2, h * 2);
      };
      const ink = "#1d140c", hi = lighten(col);
      if (open === 1) {
        for (const x0 of [0, 5]) {
          px(ink, x0, 0, 4, 1);
          px(ink, x0, 4, 4, 1);
          px(ink, x0, 1, 1, 3);
          px(ink, x0 + 3, 1, 1, 3);
          px(col, x0 + 1, 1, 2, 3);
          px(hi, x0 + (x0 ? 1 : 2), 1, 1, 1);
        }
        px(ink, 4, 1, 1, 5);
      } else if (open === 2) {
        for (const x0 of [1, 5]) {
          px(ink, x0, 0, 3, 1);
          px(ink, x0, 4, 3, 1);
          px(ink, x0, 1, 1, 3);
          px(ink, x0 + 2, 1, 1, 3);
          px(col, x0 + 1, 1, 1, 3);
          px(hi, x0 + 1, 1, 1, 1);
        }
        px(ink, 4, 1, 1, 5);
      } else {
        px(ink, 3, 0, 3, 1);
        px(ink, 3, 5, 3, 1);
        px(ink, 3, 1, 1, 4);
        px(ink, 5, 1, 1, 4);
        px(col, 4, 1, 1, 4);
        px(hi, 4, 1, 1, 1);
        px(ink, 4, 5, 1, 1);
      }
      ct.refresh();
    }
  }
  if (!scene.textures.exists("spark0")) {
    for (const [key, cross] of [["spark0", false], ["spark1", true]]) {
      const ct2 = scene.textures.createCanvas(key, 10, 10), c2 = ct2.getContext();
      c2.fillStyle = "#ffffff";
      c2.fillRect(4, 4, 2, 2);
      if (cross) {
        c2.fillStyle = "#cfeeff";
        c2.fillRect(4, 2, 2, 2);
        c2.fillRect(4, 6, 2, 2);
        c2.fillRect(2, 4, 2, 2);
        c2.fillRect(6, 4, 2, 2);
      }
      ct2.refresh();
    }
    const ct = scene.textures.createCanvas("mote", 4, 4), c = ct.getContext();
    c.fillStyle = "#e9dcc0";
    c.fillRect(0, 0, 4, 4);
    c.fillStyle = "#fff6dc";
    c.fillRect(0, 0, 2, 2);
    ct.refresh();
  }
  if (!scene.textures.exists("soft-shadow")) {
    const ct = scene.textures.createCanvas("soft-shadow", 32, 12), c = ct.getContext();
    const g = c.createRadialGradient(16, 6, 1, 16, 6, 16);
    g.addColorStop(0, "rgba(0,0,0,0.32)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.save();
    c.scale(1, 12 / 32);
    c.fillStyle = g;
    c.beginPath();
    c.arc(16, 16, 16, 0, Math.PI * 2);
    c.fill();
    c.restore();
    ct.refresh();
  }
  if (!scene.textures.exists("soft-glow")) {
    const ct = scene.textures.createCanvas("soft-glow", 64, 64), c = ct.getContext();
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, "rgba(255,214,140,0.95)");
    g.addColorStop(0.35, "rgba(255,190,100,0.45)");
    g.addColorStop(1, "rgba(255,170,80,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    ct.refresh();
  }
  if (!scene.textures.exists("cloud-shadow")) {
    const ct = scene.textures.createCanvas("cloud-shadow", 256, 128), c = ct.getContext();
    for (const [x, y, rr] of [[80, 64, 56], [140, 52, 64], [190, 70, 48], [120, 80, 50]]) {
      const g = c.createRadialGradient(x, y, 4, x, y, rr);
      g.addColorStop(0, "rgba(10,20,10,0.16)");
      g.addColorStop(1, "rgba(10,20,10,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, rr, 0, Math.PI * 2);
      c.fill();
    }
    ct.refresh();
  }
  for (const f of [0, 1]) {
    const key = `bird${f}`;
    if (scene.textures.exists(key)) continue;
    const ct = scene.textures.createCanvas(key, 14, 12), c = ct.getContext();
    const px = (col, x, y, w = 1, h = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, w * 2, h * 2);
    };
    px("#2b1d12", 1, 2, 5, 3);
    px("#6b4e9a", 2, 2, 3, 2);
    px("#2b1d12", 4, 1, 2, 1);
    px("#f2c14e", 6, 2, 1, 1);
    px("#2b1d12", 0, 3, 1, 1);
    px("#f2c14e", 2, 5, 1, 1);
    px("#f2c14e", 4, 5, 1, 1);
    if (f) {
      px("#2b1d12", 1, 0, 2, 2);
      px("#2b1d12", 4, 0, 1, 1);
    } else px("#8a6ab8", 1, 2, 3, 1);
    ct.refresh();
  }
  if (!scene.textures.exists("bell")) {
    const ct = scene.textures.createCanvas("bell", 16, 20), c = ct.getContext();
    const px = (col, x, y, w = 1, h = 1) => {
      c.fillStyle = col;
      c.fillRect(x * 2, y * 2, w * 2, h * 2);
    };
    px("#2b1d12", 3, 0, 2, 2);
    px("#2b1d12", 2, 2, 4, 5);
    px("#e8b84a", 3, 2, 2, 4);
    px("#fff2b0", 3, 2, 1, 2);
    px("#2b1d12", 1, 7, 6, 1);
    px("#b8861f", 2, 7, 4, 1);
    px("#2b1d12", 3, 8, 2, 2);
    ct.refresh();
  }
  if (halloween()) makeHalloweenTextures(scene);
}
function perchBird(scene, x, y) {
  const s = scene.add.image(x, y, "bird0").setOrigin(0.5, 1).setDepth(99e3).setFlipX(Math.random() < 0.5);
  (scene.birds = scene.birds || []).push({ s, x, y, nextHop: 0, away: 0 });
}
function makeHalloweenTextures(scene) {
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
  const pumpkin = (face, eye) => (px) => {
    const half = [4, 6, 7, 8, 8, 8, 8, 8, 8, 7, 6, 4];
    half.forEach((hw, i) => px(ink, 8 - hw, 2 + i, hw * 2, 1));
    half.forEach((hw, i) => {
      if (i > 0 && i < 11) px("#e8862a", 9 - hw, 2 + i, hw * 2 - 2, 1);
    });
    for (const x of [3, 8]) px("#f6a94a", x, 4, 1, 8);
    for (const x of [5, 10, 12]) px("#b85c1c", x, 4, 1, 8);
    px("#f6a94a", 4, 3, 8, 1);
    px("#b85c1c", 3, 12, 10, 1);
    px(ink, 7, 0, 2, 2);
    px("#4f8a3a", 7, 0, 1, 2);
    px("#3b6a2c", 8, 1, 1, 1);
    px(face, 4, 5, 1, 1);
    px(face, 3, 6, 3, 1);
    px(face, 11, 5, 1, 1);
    px(face, 10, 6, 3, 1);
    if (eye) {
      px(eye, 4, 6, 1, 1);
      px(eye, 11, 6, 1, 1);
    }
    px(face, 7, 8, 2, 1);
    px(face, 3, 9, 10, 1);
    for (const x of [4, 7, 10]) px(face, x, 10, 2, 1);
  };
  draw("h-pumpkin", 16, 14, pumpkin("#2a1208"));
  draw("h-pumpkin-lit", 16, 14, pumpkin("#ffd45a", "#fff6c0"));
  const bat = (up) => (px) => {
    const rows = up ? ["k....kk....k", "kk...kk...kk", ".kk..kk..kk.", "..kkkkkkkk..", "....kkkk...."] : ["....kkkk....", "..kkkkkkkk..", ".kk..kk..kk.", "kk...kk...kk", "k....kk....k"];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "k") px("#1c1226", x, y);
    }));
    px("#ff6a4a", 5, up ? 2 : 1);
    px("#ff6a4a", 6, up ? 2 : 1);
  };
  draw("h-bat0", 12, 5, bat(true));
  draw("h-bat1", 12, 5, bat(false));
  draw("h-scarecrow", 16, 30, (px) => {
    px(ink, 6, 11, 4, 19);
    px("#7a4e28", 7, 12, 1, 17);
    px("#5e3b1f", 8, 12, 1, 17);
    px(ink, 0, 11, 16, 3);
    px("#7a4e28", 1, 12, 14, 1);
    px("#e2c45a", 0, 10, 2, 1);
    px("#e2c45a", 14, 10, 2, 1);
    px("#c9a43a", 0, 14, 2, 1);
    px("#c9a43a", 14, 14, 1, 1);
    px(ink, 3, 13, 10, 10);
    px("#8a3b2f", 4, 14, 8, 8);
    px("#b85a3a", 4, 16, 8, 1);
    px("#b85a3a", 4, 19, 8, 1);
    px("#b85a3a", 6, 14, 1, 8);
    px("#b85a3a", 9, 14, 1, 8);
    px("#e2c45a", 4, 22, 8, 2);
    px("#c9a43a", 5, 24, 6, 1);
    px(ink, 4, 3, 8, 8);
    px("#e2c7a0", 5, 4, 6, 6);
    px("#cfae82", 10, 4, 1, 6);
    px(ink, 6, 6, 1, 1);
    px(ink, 9, 6, 1, 1);
    px(ink, 6, 8, 4, 1);
    px(ink, 7, 9, 1, 1);
    px(ink, 1, 3, 14, 2);
    px("#c99a3a", 2, 3, 12, 1);
    px(ink, 4, 0, 8, 3);
    px("#c99a3a", 5, 1, 6, 2);
    px("#e2c45a", 5, 1, 6, 1);
    px("#b8323a", 5, 2, 6, 1);
  });
}
function putPumpkin(scene, x, y, flip = false) {
  if (!scene.textures.exists("h-pumpkin")) return null;
  const s = scene.add.image(x, y, "h-pumpkin").setOrigin(0.5, 1).setDepth(y).setFlipX(flip);
  const g = scene.add.image(x, y - 12, "soft-glow").setScale(0.8).setTint(16752704).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99992);
  (scene.pumpkins = scene.pumpkins || []).push({ s, g, ph: Math.random() * 6.28 });
  return s;
}
function putScarecrow(scene, x, y) {
  if (!scene.textures.exists("h-scarecrow")) return null;
  const s = scene.add.image(x, y, "h-scarecrow").setOrigin(0.5, 1).setDepth(y);
  scene.addBlocker(x - 6, y - 8, 12, 8);
  return s;
}
function paintRoads(scene, gc, isRoad, mapW, mapH) {
  const img = scene.textures.get("a-floor").getSourceImage();
  const T = {
    TL: [0, 112],
    T: [16, 112],
    TR: [32, 112],
    L: [0, 128],
    C: [16, 128],
    R: [32, 128],
    BL: [0, 144],
    B: [16, 144],
    BR: [32, 144],
    iTL: [96, 144],
    iTR: [80, 144],
    iBL: [96, 128],
    iBR: [80, 128]
  };
  const rd = (x, y) => x >= 0 && y >= 0 && x < mapW && y < mapH && isRoad(x, y);
  const pick = (v, h, d, outer, edgeV, edgeH, inner) => !v && !h ? outer : !v ? edgeV : !h ? edgeH : !d ? inner : T.C;
  for (let ty = 0; ty < mapH; ty++) for (let tx = 0; tx < mapW; tx++) {
    if (!isRoad(tx, ty)) continue;
    const u = rd(tx, ty - 1), dn = rd(tx, ty + 1), l = rd(tx - 1, ty), r = rd(tx + 1, ty);
    const quarters = [
      [0, 0, pick(u, l, rd(tx - 1, ty - 1), T.TL, T.T, T.L, T.iTL)],
      [8, 0, pick(u, r, rd(tx + 1, ty - 1), T.TR, T.T, T.R, T.iTR)],
      [0, 8, pick(dn, l, rd(tx - 1, ty + 1), T.BL, T.B, T.L, T.iBL)],
      [8, 8, pick(dn, r, rd(tx + 1, ty + 1), T.BR, T.B, T.R, T.iBR)]
    ];
    for (const [qx, qy, [sx, sy]] of quarters) gc.drawImage(img, sx + qx, sy + qy, 8, 8, tx * TILE + qx * 2, ty * TILE + qy * 2, 16, 16);
  }
}
function paintGrassDetail(scene, gc, isRoad, box, r) {
  const img = scene.textures.get("a-detail").getSourceImage();
  const bits = [[0, 32], [16, 32], [32, 32], [48, 32], [0, 32], [48, 32], [96, 32], [64, 32]];
  for (let ty = box.y0; ty <= box.y1; ty++) for (let tx = box.x0; tx <= box.x1; tx++) {
    if (isRoad(tx, ty) || r() > 0.16) continue;
    const [sx, sy] = bits[Math.floor(r() * bits.length)];
    gc.drawImage(img, sx, sy, 16, 16, tx * TILE + Math.floor(r() * 10) - 2, ty * TILE + Math.floor(r() * 10) - 2, 32, 32);
  }
}
function sceneryLayout(MARGIN, PLOT, townW, townH) {
  return {
    riverX: MARGIN + townW + 2,
    exitRow: MARGIN + PLOT - 1,
    meadow: { x0: MARGIN - 13, x1: MARGIN - 3, y0: MARGIN + PLOT + 1, y1: MARGIN + PLOT + 10 }
  };
}
function paintWater(scene, gc, isWater, mapW, mapH) {
  const img = scene.textures.get("a-water").getSourceImage();
  const T = {
    TL: [0, 96],
    T: [16, 96],
    TR: [32, 96],
    L: [0, 112],
    C: [16, 112],
    R: [32, 112],
    BL: [0, 128],
    B: [16, 128],
    BR: [32, 128],
    iTL: [16, 112],
    iTR: [16, 112],
    iBL: [16, 112],
    iBR: [16, 112]
  };
  const wt = (x, y) => x < 0 || y < 0 || x >= mapW || y >= mapH ? x >= 0 && x < mapW && isWater(x, Math.max(0, Math.min(mapH - 1, y))) : isWater(x, y);
  const pick = (v, h, d, outer, edgeV, edgeH, inner) => !v && !h ? outer : !v ? edgeV : !h ? edgeH : !d ? inner : T.C;
  for (let ty = 0; ty < mapH; ty++) for (let tx = 0; tx < mapW; tx++) {
    if (!isWater(tx, ty)) continue;
    const u = wt(tx, ty - 1), dn = wt(tx, ty + 1), l = wt(tx - 1, ty), r = wt(tx + 1, ty);
    const q = [
      [0, 0, pick(u, l, wt(tx - 1, ty - 1), T.TL, T.T, T.L, T.iTL)],
      [8, 0, pick(u, r, wt(tx + 1, ty - 1), T.TR, T.T, T.R, T.iTR)],
      [0, 8, pick(dn, l, wt(tx - 1, ty + 1), T.BL, T.B, T.L, T.iBL)],
      [8, 8, pick(dn, r, wt(tx + 1, ty + 1), T.BR, T.B, T.R, T.iBR)]
    ];
    for (const [qx, qy, [sx, sy]] of q) gc.drawImage(img, sx + qx, sy + qy, 8, 8, tx * TILE + qx * 2, ty * TILE + qy * 2, 16, 16);
  }
}
function paintBridge(scene, gc, riverX, exitRow) {
  const img = scene.textures.get("a-water").getSourceImage();
  gc.drawImage(img, 0, 192, 48, 32, riverX * TILE - 16, exitRow * TILE + 16 - 32, 128, 64);
}
function decorateScenery(scene, L) {
  const T = TILE;
  if (!scene.anims.exists("a-mill-go")) scene.anims.create({ key: "a-mill-go", frames: scene.anims.generateFrameNumbers("a-mill", { start: 0, end: 2 }), frameRate: 5, repeat: -1 });
  const H = scene.sectors ? scene.sectors.riverEnd + 1 : scene.grid ? scene.grid.mapH : 50;
  for (let i = 0; i < 14; i++) {
    const y = (2 + Math.random() * (H - 4)) * T;
    if (Math.abs(y / T - L.exitRow) < 1.5) continue;
    const x = L.riverX * T + 24 + Math.random() * 48;
    if (i % 3 === 0) scene.add.image(x, y, "d-lily").setDepth(-8);
    else scene.add.sprite(x, y, "a-ripple").setScale(2).setAlpha(0.7).setDepth(-8).play({ key: "a-ripple-go", startFrame: i % 4 });
  }
  if (!scene.textures.exists("glint")) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(15398911, 0.75).fillRect(0, 0, 6, 2);
    g.generateTexture("glint", 6, 2);
    g.destroy();
  }
  scene.glints = [];
  for (let i = 0; i < 12; i++) scene.glints.push({ s: scene.add.image(L.riverX * T + 12 + Math.random() * 72, Math.random() * H * T, "glint").setDepth(-7).setAlpha(0.5), v: 14 + Math.random() * 14, ph: Math.random() * 6.28, box: { y0: 0, y1: H * T, x0: L.riverX * T + 8 } });
  const my = (L.exitRow + 4) * T;
  scene.add.sprite(L.riverX * T + 6, my, "a-mill").setScale(2).setOrigin(0.5, 1).setDepth(my).play("a-mill-go");
  const m = L.meadow, mx0 = m.x0 * T, mx1 = (m.x1 + 1) * T, my0 = m.y0 * T, my1 = (m.y1 + 1) * T;
  for (let x = mx0 + 48; x <= mx1 - 48; x += 96) {
    scene.add.image(x, my0 + 40, "d-fence").setOrigin(0.5, 1).setDepth(my0 + 40);
    scene.add.image(x, my1, "d-fence").setOrigin(0.5, 1).setDepth(my1);
  }
  if (halloween()) {
    putScarecrow(scene, mx0 + 40, my0 + 112);
    putPumpkin(scene, mx0 + 64, my0 + 112);
  }
  return { x: mx0 + 24, y: my0 + 56, w: mx1 - mx0 - 48, h: my1 - my0 - 80 };
}
const LOT_PROPS = {
  mailer: "sacks",
  scout: "maptable",
  writer: "crates",
  editor: "goods",
  closer: "easel",
  analyst: "papers",
  hq: "board"
};
function propFor(id, tool) {
  return LOT_PROPS[id] || { mailbox: "sacks", telescope: "maptable", workbench: "crates", stall: "goods", pinboard: "easel", newsstand: "papers" }[tool] || null;
}
function makeLotProp(scene, name) {
  const key = `lp-${name}`;
  if (scene.textures.exists(key)) return key;
  const ink = "#2b1d12", cream = "#f6f1eb", wood = "#a87a48", woodD = "#5e3b1f";
  const size = { sacks: [22, 14], crates: [22, 18], goods: [16, 12], easel: [16, 24], papers: [18, 11], maptable: [22, 16], books: [16, 13], board: [22, 22] }[name];
  const ct = scene.textures.createCanvas(key, size[0] * 2, size[1] * 2), c = ct.getContext();
  const px = (col, x, y, w = 1, h = 1) => {
    c.fillStyle = col;
    c.fillRect(x * 2, y * 2, w * 2, h * 2);
  };
  if (name === "sacks") {
    px(ink, 1, 5, 10, 9);
    px("#c9a86a", 2, 6, 8, 7);
    px("#a88a52", 2, 11, 8, 2);
    px(ink, 4, 3, 4, 3);
    px("#c9a86a", 5, 4, 2, 2);
    px(ink, 3, 6, 6, 1);
    px(ink, 11, 6, 10, 8);
    px("#c9a86a", 12, 7, 8, 6);
    px("#a88a52", 12, 11, 8, 2);
    px(ink, 14, 4, 4, 3);
    px("#c9a86a", 15, 5, 2, 2);
    px(ink, 13, 7, 6, 1);
    px(ink, 15, 1, 5, 4);
    px(cream, 16, 2, 3, 2);
    px("#c8423a", 17, 3, 1, 1);
  } else if (name === "crates") {
    const crate = (x, y) => {
      px(ink, x, y, 9, 8);
      px(wood, x + 1, y + 1, 7, 6);
      px(woodD, x + 1, y + 1, 7, 1);
      px(woodD, x + 1, y + 4, 7, 1);
      px(woodD, x + 4, y + 1, 1, 6);
    };
    crate(1, 10);
    crate(11, 10);
    crate(6, 2);
    px(ink, 0, 17, 22, 1);
    px(woodD, 1, 17, 20, 1);
  } else if (name === "goods") {
    px(ink, 1, 5, 10, 7);
    px(wood, 2, 6, 8, 5);
    px(woodD, 2, 8, 8, 1);
    px("#c8423a", 3, 3, 2, 2);
    px("#e8b84a", 6, 2, 2, 3);
    px("#6fb35b", 4, 4, 2, 2);
    px("#c8423a", 8, 4, 2, 1);
    px(ink, 11, 3, 5, 9);
    px("#4f86c6", 12, 4, 3, 7);
    px("#9fc0e6", 12, 4, 1, 7);
  } else if (name === "easel") {
    px(ink, 2, 10, 2, 14);
    px(ink, 12, 10, 2, 14);
    px(ink, 7, 18, 2, 6);
    px(woodD, 3, 11, 1, 12);
    px(woodD, 13, 11, 1, 12);
    px(ink, 1, 2, 14, 13);
    px(cream, 2, 3, 12, 11);
    px("#9fd6f2", 3, 4, 10, 4);
    px("#6fb35b", 3, 8, 10, 3);
    px("#e86a8a", 6, 6, 3, 3);
    px(ink, 1, 15, 14, 1);
    px(woodD, 2, 15, 12, 1);
  } else if (name === "papers") {
    px(ink, 1, 2, 16, 9);
    px(cream, 2, 3, 14, 7);
    px("#d9d2c0", 2, 6, 14, 1);
    px("#d9d2c0", 2, 9, 14, 1);
    px(ink, 4, 4, 6, 1);
    px(ink, 4, 7, 4, 1);
    px(ink, 11, 4, 3, 2);
    px(woodD, 8, 2, 1, 9);
    px(woodD, 1, 6, 16, 1);
  } else if (name === "maptable") {
    px(ink, 1, 6, 20, 5);
    px(wood, 2, 7, 18, 3);
    px(ink, 3, 11, 2, 5);
    px(ink, 17, 11, 2, 5);
    px(woodD, 4, 11, 1, 5);
    px(woodD, 18, 11, 1, 5);
    px(ink, 3, 1, 14, 7);
    px(cream, 4, 2, 12, 5);
    px("#6fb35b", 5, 3, 4, 2);
    px("#4f86c6", 10, 4, 4, 2);
    px("#c8423a", 13, 2, 1, 1);
    px("#c8423a", 14, 3, 1, 1);
    px("#c8423a", 12, 3, 1, 1);
  } else if (name === "books") {
    px(ink, 1, 8, 9, 5);
    px("#c8423a", 2, 9, 7, 1);
    px("#4f86c6", 2, 10, 7, 1);
    px("#e8b84a", 2, 11, 7, 1);
    px(cream, 3, 9, 1, 3);
    px(ink, 2, 4, 7, 4);
    px("#5f9e4a", 3, 5, 5, 2);
    px(ink, 10, 6, 6, 7);
    px("#efe2c0", 11, 7, 4, 5);
    px("#d9c79c", 11, 7, 1, 5);
    px(ink, 12, 8, 2, 1);
    px(ink, 12, 10, 2, 1);
  } else if (name === "board") {
    px(ink, 2, 10, 2, 12);
    px(ink, 18, 10, 2, 12);
    px(woodD, 3, 11, 1, 10);
    px(woodD, 19, 11, 1, 10);
    px(ink, 0, 0, 22, 12);
    px("#c99a62", 1, 1, 20, 10);
    px(cream, 2, 2, 5, 4);
    px(cream, 9, 3, 6, 3);
    px(cream, 16, 2, 4, 5);
    px(cream, 3, 7, 6, 3);
    px("#c8423a", 3, 2);
    px("#4f86c6", 11, 3);
    px("#3ba84a", 17, 2);
  }
  ct.refresh();
  return key;
}
function decorateLot(scene, lot, px, py, r, vacantIndex) {
  const T = TILE, put = (key, x, y, block = false) => {
    const im = scene.add.image(x, y, key).setOrigin(0.5, 1).setDepth(y);
    if (block) scene.addBlocker(x - im.width / 2 + 3, y - 10, im.width - 6, 9);
    return im;
  };
  const lamp = (x, y) => {
    put("d-lamp", x, y, true);
    (scene.lamps = scene.lamps || []).push(scene.add.image(x, y - 48, "soft-glow").setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99992));
    if (halloween() && r() < 0.55) putPumpkin(scene, x + 22, y + 2, r() < 0.5);
  };
  const flowers = (x0, y0, n) => {
    for (let i = 0; i < n; i++) put(`d-flw${Math.floor(r() * 4)}`, x0 + i % 3 * 18 + r() * 6, y0 + Math.floor(i / 3) * 16 + r() * 4);
  };
  if (lot.expansion) {
    const g = scene.add.graphics().setDepth(-6), x0 = px + 0.5 * T, x1 = px + 8.5 * T, y0 = py + 0.7 * T, y1 = py + 8.6 * T, w = 4;
    const seg = (ax, ay, bx, by) => {
      g.lineStyle(w + 2, 7037523, 1).lineBetween(ax, ay, bx, by);
      g.lineStyle(w, 13616300, 1).lineBetween(ax, ay, bx, by);
    };
    seg(x0, y0, x1, y0);
    seg(x0, y0, x0, y1);
    seg(x1, y0, x1, y1);
    seg(x0, y1, px + 3.8 * T, y1);
    seg(px + 6.2 * T, y1, x1, y1);
    lamp(px + 7.3 * T, py + 7.9 * T);
    return;
  }
  if (lot.kind === "vacant") {
    if (vacantIndex === 0) {
      const cx = px + 4.6 * T, cy = py + 5.3 * T;
      put("d-pond", cx, cy, false);
      scene.pondSpot = { x: cx - 92, y: cy - 46, w: 30, h: 34 };
      scene.addBlocker(cx - 40, cy - 84, 80, 72);
      put("d-lily", cx - 18, cy - 46);
      put("d-lily", cx + 16, cy - 30);
      for (const [dx, dy] of [[-6, -60], [14, -52], [-20, -32]]) {
        scene.add.sprite(cx + dx, cy + dy, "a-ripple").setScale(2).setDepth(cy - 70).setAlpha(0.8).play({ key: "a-ripple-go", startFrame: Math.floor(r() * 4) });
      }
      put("d-bench", px + 4.8 * T, py + 7.5 * T, true);
      lamp(px + 7.3 * T, py + 7.9 * T);
      put("d-bush1", px + 7.2 * T, py + 2.2 * T);
    } else {
      put("d-line", px + 5.4 * T, py + 3.4 * T, true);
      put("d-fence", px + 3.9 * T, py + 1.9 * T, true);
      put("d-fence", px + 6.3 * T, py + 1.9 * T, true);
      put("d-stump", px + 6.8 * T, py + 5.6 * T, true);
      put("d-barrel", px + 3.4 * T, py + 6.9 * T, true);
      lamp(px + 7.3 * T, py + 7.9 * T);
    }
    return;
  }
  if (lot.kind === "hq") lamp(px + 1.2 * T, py + 9 * T);
  else lamp(px + 1.4 * T, py + 7.9 * T);
  const tree = r() < 0.5 ? put("d-smalltree", px + 7.3 * T, py + 3.3 * T, true) : put(`d-bush${Math.floor(r() * 3)}`, px + 7.45 * T, py + 2.8 * T, true);
  (scene.sway = scene.sway || []).push(tree);
  if (scene.textures.exists("bird0") && r() < 0.6) perchBird(scene, px + 3 * T + 40 + Math.floor(r() * 48), py + 6 * T - 84);
  r();
  if (lot.kind === "hq") {
    for (const [x, key] of [[px + 2.7 * T, "a-flag-red"], [px + 7.3 * T, "a-flag-blue"]]) {
      const pole = scene.add.rectangle(x - 9, py + 6.2 * T, 3, 46, 6175519).setOrigin(0.5, 1).setDepth(py + 6.2 * T);
      scene.add.sprite(x, pole.y - 40, key).setScale(2).setDepth(pole.depth + 1).play("a-flag-go".replace("a-flag", key));
    }
    put("d-bench", px + 7.4 * T, py + 8.5 * T, true);
    scene.makeChar("guard-", "Knight");
    const gy = py + 6.75 * T;
    scene.guard = scene.add.sprite(px + 6.45 * T, gy, "guard-down0").setOrigin(0.5, 1).setDepth(gy);
    scene.addBlocker(scene.guard.x - 7, gy - 8, 14, 8);
  } else if (r() < 0.4) put("d-barrel", px + 2.75 * T, py + 5.75 * T, true);
  if (r() < 0.3) {
    r();
    r();
    r();
  }
}
function startAmbient(scene, box) {
  const W = box.w, H = box.h, X = box.x, Y = box.y;
  scene.ambient = { butterflies: [], fireflies: [], clouds: [], leaves: [], shadows: new Map(), nextLeaf: 0, motes: [], sparkles: [], gust: 0, gustAt: 6e3, gustEnd: 0, flock: null, nextFlock: 2e4 };
  const A = scene.ambient;
  for (let i = 0; i < 7; i++) {
    const s = scene.add.sprite(X + Math.random() * W, Y + Math.random() * H, `bf${i % 4}-1`).setDepth(99e3);
    A.butterflies.push({ s, k: `bf${i % 4}`, vx: 0, vy: 0, t: Math.random() * 1e3, home: { x: s.x, y: s.y }, ph: Math.random() * 6.28 });
  }
  for (let i = 0; i < 26; i++) {
    const s = scene.add.image(X + Math.random() * W, Y + Math.random() * H, "soft-glow").setScale(0.22).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(99993);
    A.fireflies.push({ s, ph: Math.random() * 6.28, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8 });
  }
  for (let i = 0; i < 3; i++) {
    const s = scene.add.image(X - 300 + Math.random() * (W + 300), Y + Math.random() * H, "cloud-shadow").setScale(2.4).setDepth(99980);
    A.clouds.push({ s, v: 6 + Math.random() * 5 });
  }
  for (let i = 0; i < 10; i++) A.motes.push({ s: scene.add.image(-99, -99, "mote").setDepth(99984).setVisible(false), life: 0, vx: 0, vy: 0, ph: 0 });
  if (scene.glints && scene.glints.length) for (let i = 0; i < 10; i++) A.sparkles.push({ s: scene.add.image(-99, -99, "spark0").setDepth(-6).setVisible(false), t: -Math.random() * 2e3, dur: 900, box: scene.glints[0].box });
  if (scene.textures.exists("bird1") && scene.sys.settings.key === "village") A.flock = { s: [0, 1, 2].map(() => scene.add.image(-99, -99, "bird1").setDepth(99986).setAlpha(0.9).setVisible(false)), t: 0, on: false };
  A.bats = halloween() ? [0, 1, 2].map((i) => ({ s: scene.add.image(-100, -100, "h-bat0").setScale(2).setDepth(99986).setVisible(false), wait: 1500 + i * 5e3, t: 0 })) : [];
}
function shadowFor(scene, sprite, w = 1) {
  const A = scene.ambient;
  if (!A || !sprite || !sprite.active) return;
  let sh = A.shadows.get(sprite);
  if (!sh) {
    sh = scene.add.image(sprite.x, sprite.y, "soft-shadow").setScale(w, 1);
    A.shadows.set(sprite, sh);
  }
  const air = Math.max(0, (sprite.originY - 1) * 32), k = Math.max(0.45, 1 - air / 40);
  sh.setPosition(sprite.x, sprite.y - 2).setDepth(sprite.y - 1).setScale(w * k, k).setAlpha(0.6 + 0.4 * k).setVisible(sprite.visible && sprite.alpha > 0.3);
}
function updateAmbient(scene, time, delta, box) {
  const A = scene.ambient;
  if (!A) return;
  const dt = Math.min(delta, 100) / 1e3, night = !!scene.night, calm = !!window.__calm, low = !!(scene.feel && scene.feel.lowFx);
  const cam = scene.cameras.main.worldView;
  const near = (x, y, m = 160) => x > cam.x - m && x < cam.right + m && y > cam.y - m && y < cam.bottom + m;
  for (const [sprite, sh] of A.shadows) if (!sprite.active) {
    sh.destroy();
    A.shadows.delete(sprite);
  }
  if (!calm) {
    if (time > A.gustAt) {
      A.gustAt = time + 9e3 + Math.random() * 8e3;
      A.gustEnd = time + 3500;
      A.gustStart = time;
    }
    A.gust = time < A.gustEnd ? Math.sin(Math.PI * (time - A.gustStart) / 3500) : 0;
  } else A.gust = 0;
  for (const b of A.butterflies) {
    b.s.setVisible(!night && near(b.s.x, b.s.y, 40));
    if (night) continue;
    if (!near(b.s.x, b.s.y, 200)) continue;
    b.t += delta;
    b.ph += dt * 5;
    if (Math.random() < 0.02) {
      b.vx = (Math.random() - 0.5) * 50;
      b.vy = (Math.random() - 0.5) * 36;
    }
    b.vx += (b.home.x - b.s.x) * 2e-3 + A.gust * 1.2;
    b.vy += (b.home.y - b.s.y) * 2e-3;
    const slow = calm ? 0.25 : 1;
    b.s.x += b.vx * dt * slow;
    b.s.y += (b.vy * dt + Math.sin(b.t / 140) * 0.55) * slow;
    const f = Math.floor(b.t / 85) % 4;
    b.s.setTexture(`${b.k}-${[1, 2, 0, 2][f]}`).setFlipX(b.vx < 0);
  }
  for (const f of A.fireflies) {
    f.ph += dt * 2.2;
    if (!night) {
      f.s.setAlpha(0);
      continue;
    }
    if (!near(f.s.x, f.s.y, 120)) continue;
    f.s.setAlpha(0.3 + 0.6 * Math.max(0, Math.sin(f.ph) * 0.7 + Math.sin(f.ph * 0.37 + 1.3) * 0.3));
    f.s.setScale(0.2 + 0.05 * Math.max(0, Math.sin(f.ph)));
    f.s.x += f.vx * dt + Math.sin(f.ph * 0.7) * 0.25;
    f.s.y += f.vy * dt + Math.cos(f.ph * 0.5) * 0.25;
    if (f.s.x < box.x || f.s.x > box.x + box.w) f.vx *= -1;
    if (f.s.y < box.y || f.s.y > box.y + box.h) f.vy *= -1;
  }
  for (const g of scene.glints || []) {
    g.ph += dt * 1.6;
    g.s.y += g.v * dt;
    g.s.x += Math.sin(g.ph) * 0.15;
    g.s.setAlpha(0.25 + 0.35 * Math.max(0, Math.sin(g.ph)));
    if (g.s.y > g.box.y1) {
      g.s.y = g.box.y0;
      g.s.x = g.box.x0 + 4 + Math.random() * 72;
    }
  }
  if (!calm && !low) for (const sp of A.sparkles) {
    sp.t += delta;
    if (sp.t < 0) {
      sp.s.setVisible(false);
      continue;
    }
    if (sp.t > sp.dur) {
      const bx = sp.box, y0 = Math.max(bx.y0, cam.y), y1 = Math.min(bx.y1, cam.bottom);
      sp.t = -400 - Math.random() * 1600;
      sp.dur = 700 + Math.random() * 500;
      if (y1 > y0 && cam.right > bx.x0 && cam.x < bx.x0 + 90) sp.s.setPosition(bx.x0 + 4 + Math.random() * 84, y0 + Math.random() * (y1 - y0));
      else sp.s.setPosition(-99, -99);
      continue;
    }
    const u = sp.t / sp.dur;
    sp.s.setVisible(sp.s.x > 0).setTexture(u > 0.3 && u < 0.7 ? "spark1" : "spark0").setAlpha(u < 0.15 || u > 0.85 ? 0.5 : 0.95);
  }
  for (const c of A.clouds) {
    c.s.setVisible(!night);
    c.s.x += c.v * dt;
    if (c.s.x - 320 > box.x + box.w) {
      c.s.x = box.x - 320;
      c.s.y = box.y + Math.random() * box.h;
    }
  }
  const se = season(), snow = se === "winter";
  if ((!night || snow) && !A.noLeaves && time > A.nextLeaf) {
    A.nextLeaf = time + (snow ? 90 : se === "autumn" ? 500 : 1400) + Math.random() * (snow ? 120 : 900);
    const key = snow ? "a-snow" : se === "autumn" ? Math.random() < 0.8 ? "a-leaf-autumn" : "a-leaf" : se === "spring" ? "a-leaf-pink" : "a-leaf";
    const s = scene.add.sprite(cam.x + Math.random() * cam.width, cam.y - 10, key, 0).setScale(2).setDepth(99985);
    A.leaves.push({ s, vx: snow ? -6 + Math.random() * 12 : 10 + Math.random() * 18, vy: snow ? 30 + Math.random() * 25 : 26 + Math.random() * 20, life: 0, f: Math.floor(Math.random() * 7), n: snow ? 7 : 12 });
  }
  A.leaves = A.leaves.filter((l) => {
    l.life += delta;
    l.s.x += (l.vx + Math.sin(l.life / 300) * 20 + A.gust * 60) * dt;
    l.s.y += l.vy * dt;
    l.s.setFrame((l.f + Math.floor(l.life / 160)) % l.n).setAlpha(Math.max(0, 1 - l.life / 6e3));
    if (l.life > 6e3) {
      l.s.destroy();
      return false;
    }
    return true;
  });
  if (!calm && !low) {
    if (A.gust > 0.15 && Math.random() < 0.25) {
      const m = A.motes.find((q) => q.life <= 0);
      if (m) {
        m.life = 1800 + Math.random() * 800;
        m.max = m.life;
        m.vx = 90 + Math.random() * 70;
        m.vy = (Math.random() - 0.3) * 16;
        m.ph = Math.random() * 6.28;
        m.s.setPosition(cam.x - 8, cam.y + Math.random() * cam.height).setVisible(true);
      }
    }
    for (const m of A.motes) {
      if (m.life <= 0) continue;
      m.life -= delta;
      m.ph += dt * 6;
      m.s.x += m.vx * dt;
      m.s.y += (m.vy + Math.sin(m.ph) * 22) * dt;
      m.s.setAlpha(Math.max(0, Math.min(1, m.life / 500, (m.max - m.life) / 300) * 0.7));
      if (m.life <= 0) m.s.setVisible(false);
    }
  }
  for (const t of scene.sway || []) {
    if (!t.active) continue;
    if (calm) {
      if (t.angle) t.setAngle(0);
      continue;
    }
    if (!near(t.x, t.y, 120)) continue;
    const lean = (Math.sin(time / 1100 + t.x * 0.031) * 0.55 + Math.sin(time / 430 + t.x * 0.07) * 0.2) * (1 + A.gust * 1.8) + A.gust * 0.9;
    const a = Math.round(lean / 0.6) * 0.6;
    if (t.angle !== a) t.setAngle(a);
  }
  const pl = scene.player;
  for (const b of scene.birds || []) {
    if (Array.isArray(b.s) || !b.s.setTexture) continue;
    const st = b.state || "perch";
    if (st === "perch") {
      if (pl && Math.hypot(pl.x - b.x, pl.y - b.y) < 100 && !scene.tweens.isTweening(b.s)) {
        if (calm) {
          b.state = "gone";
          b.wait = 12e3;
          b.s.setVisible(false);
          continue;
        }
        b.state = "out";
        b.t = 0;
        b.dir = pl.x < b.x ? 1 : -1;
        b.dur = 1700;
        b.s.setFlipX(b.dir < 0).setY(b.y);
        continue;
      }
      if (time > b.nextHop) {
        b.nextHop = time + 1500 + Math.random() * 4e3;
        const dx = (Math.random() - 0.5) * 16;
        b.s.setFlipX(dx > 0);
        scene.tweens.add({ targets: b.s, x: b.s.x + dx, y: b.y - 5, duration: 120, yoyo: true, onComplete: () => b.s.setY(b.y) });
      }
    } else if (st === "out") {
      b.t += delta;
      const u = Math.min(1, b.t / b.dur), e = 1 - (1 - u) * (1 - u);
      b.s.setPosition(b.x + b.dir * 150 * e, b.y - 14 * Math.min(1, u * 8) - 150 * e + Math.sin(u * 9) * 3).setTexture(`bird${Math.floor(b.t / 70) % 2}`).setAlpha(u > 0.75 ? (1 - u) * 4 : 1);
      if (u >= 1) {
        b.state = "gone";
        b.wait = 11e3 + Math.random() * 1e4;
        b.s.setVisible(false).setTexture("bird0").setAlpha(1);
      }
    } else if (st === "gone") {
      b.wait -= delta;
      if (b.wait <= 0 && !(pl && Math.hypot(pl.x - b.x, pl.y - b.y) < 190)) {
        if (calm || !near(b.x, b.y, 60)) {
          b.state = "perch";
          b.s.setPosition(b.x, b.y).setVisible(true).setTexture("bird0").setAlpha(1);
          b.nextHop = time + 1500;
        } else {
          b.state = "in";
          b.t = 0;
          b.dir = Math.random() < 0.5 ? 1 : -1;
          b.dur = 2e3;
          b.s.setVisible(true).setFlipX(b.dir > 0);
        }
      }
    } else if (st === "in") {
      b.t += delta;
      const u = Math.min(1, b.t / b.dur), e = u * u * (3 - 2 * u), fromX = b.x + b.dir * 150, fromY = b.y - 130;
      const flap = u < 0.85 ? Math.floor(b.t / (u > 0.6 ? 60 : 110)) % 2 : 0;
      b.s.setPosition(fromX + (b.x - fromX) * e, fromY + (b.y - fromY) * e - Math.sin(u * Math.PI) * 22 + (u > 0.85 ? -Math.sin((u - 0.85) / 0.15 * Math.PI) * 4 : 0)).setTexture(`bird${flap}`).setAlpha(Math.min(1, u * 5));
      if (u >= 1) {
        b.state = "perch";
        b.s.setPosition(b.x, b.y).setTexture("bird0").setAlpha(1);
        b.nextHop = time + 1200;
      }
    }
  }
  const F = A.flock;
  if (F && !calm && !low && !night) {
    if (!F.on && time > A.nextFlock) {
      F.on = true;
      F.t = 0;
      F.dir = Math.random() < 0.5 ? 1 : -1;
      F.y0 = cam.y + cam.height * (0.12 + Math.random() * 0.3);
      F.x0 = F.dir > 0 ? cam.x - 30 : cam.right + 30;
      F.len = cam.width + 60;
      F.v = 55 + Math.random() * 25;
    }
    if (F.on) {
      F.t += delta;
      const d = F.v * F.t / 1e3;
      F.s.forEach((bd, i) => bd.setVisible(true).setFlipX(F.dir < 0).setTexture(`bird${Math.floor(F.t / 150 + i) % 2}`).setPosition(F.x0 + F.dir * (d - Math.abs(i - 1) * 14), F.y0 + Math.sin(F.t / 700 + i * 0.8) * 8 + Math.abs(i - 1) * 8));
      if (d > F.len + 40) {
        F.on = false;
        F.s.forEach((bd) => bd.setVisible(false));
        A.nextFlock = time + 3e4 + Math.random() * 3e4;
      }
    }
  } else if (F && F.on) {
    F.on = false;
    F.s.forEach((bd) => bd.setVisible(false));
  }
  if (scene.guard && time > (A.nextLook || 0)) {
    A.nextLook = time + 2500 + Math.random() * 3e3;
    scene.guard.setTexture(`guard-${["down", "left", "right", "down"][Math.floor(Math.random() * 4)]}0`);
  }
  for (const g of scene.lamps || []) {
    if (!night) {
      g.setAlpha(0);
      continue;
    }
    if (!near(g.x, g.y, 140)) continue;
    if (g._bs === void 0) {
      g._bs = g.scaleX;
      g._ph = g.x * 0.013 + g.y * 7e-3;
    }
    const q = g._ph, dip = Math.max(0, Math.sin(time / 1700 + q * 5) - 0.93) * 4;
    const fl = calm ? 0 : Math.sin(time / 310 + q) * 0.045 + Math.sin(time / 97 + q * 3) * 0.025 - dip * 0.35;
    g.setAlpha(0.74 + fl);
    g.setScale(g._bs * (1 + fl * 0.35));
  }
  if (scene.pumpkins && night !== A.pumpkinNight) {
    A.pumpkinNight = night;
    for (const p of scene.pumpkins) p.s.setTexture(night ? "h-pumpkin-lit" : "h-pumpkin");
  }
  for (const p of scene.pumpkins || []) p.g.setAlpha(night ? 0.42 + 0.1 * Math.sin(time / 110 + p.ph) * Math.sin(time / 47 + p.ph) : 0);
  for (const b of A.bats) {
    if (!night) {
      b.s.setVisible(false);
      b.wait = Math.max(b.wait, 1500);
      continue;
    }
    if (b.wait > 0) {
      b.wait -= delta;
      if (b.wait > 0) continue;
      const cam2 = scene.cameras.main.worldView;
      b.t = 0;
      b.dir = Math.random() < 0.5 ? 1 : -1;
      b.x0 = b.dir > 0 ? cam2.x - 30 : cam2.right + 30;
      b.len = cam2.width + 60;
      b.y = cam2.y + cam2.height * (0.08 + Math.random() * 0.5);
      b.v = 90 + Math.random() * 60;
      b.s.setVisible(true).setFlipX(b.dir < 0);
    }
    b.t += delta;
    const d = b.v * b.t / 1e3;
    b.s.setPosition(b.x0 + d * b.dir, b.y + Math.sin(b.t / 230) * 16 + Math.sin(b.t / 83) * 5).setTexture(`h-bat${Math.floor(b.t / 110) % 2}`);
    if (d > b.len) {
      b.s.setVisible(false);
      b.wait = 6e3 + Math.random() * 1e4;
    }
  }
}
export {
  decorateLot,
  decorateScenery,
  makeDecorTextures,
  makeLotProp,
  paintBridge,
  paintGrassDetail,
  paintRoads,
  paintWater,
  preloadDecor,
  propFor,
  putPumpkin,
  putScarecrow,
  sceneryLayout,
  shadowFor,
  startAmbient,
  updateAmbient
};
