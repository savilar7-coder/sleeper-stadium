import { $, DPR } from "./core.js";
import { sfx } from "./sfx.js";
import { kitNum } from "./stadium-mascots.js";
const YPX = 9;
const ROUTES = [
  [[0, 16], [0, 30]],
  [[0, 5], [-7, 12], [-12, 18]],
  [[0, 8], [8, 8], [12, 9]],
  [[0, 11], [0, 8]],
  [[0, 6], [6, 14], [6, 24]],
  [[0, 3], [-10, 5]]
];
const DRIVES = ["off", "def", "off", "def"];
const EDGE = 30;
const OPEN_PX = 34;
const TUNE = { offStart: 58, defStart: 65, toGo: 12, sackMs: 3e3, coverMs: 900, incRunoff: 5, yacMin: 3, yacRange: 8, cpuOpenCatch: 0.65, cpuYac: 1, meOpenCatch: 0.55, youPick: 0.25, youCatch: 0.3 };
const CLOCK = 45, RUNOFF = { catch: 8, inc: 2, sack: 5 };
const TOP_Y = -107 * YPX;
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
const kitOf = (t) => {
  const n = kitNum(t);
  return n == null ? null : FB_KITS[n % FB_KITS.length];
};
const hex = (s) => parseInt(s.slice(1), 16);
const calm = () => !!window.__calm;
const NUM_FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const surname = (n) => {
  const w = String(n).split(" ").filter((x) => !/^(jr|sr|ii|iii|iv|v)\.?$/i.test(x));
  return w[w.length - 1] || n;
};
const yds = (g) => `${g > 0 ? "+" : "\u2212"}${Math.abs(g)} yard${Math.abs(g) === 1 ? "" : "s"}`;
class MiniGameScene extends Phaser.Scene {
  constructor() {
    super("minigame");
  }
  init(data) {
    this.me = data.me;
    this.opp = data.opp;
    this.L = data.league;
    this.done = data.onExit;
  }
  create() {
    this.Z = Phaser.Math.Clamp(this.scale.height / this.scale.width / 1.6, 1, 1.3);
    this.W = this.scale.width / (DPR * this.Z);
    this.H = this.scale.height / (DPR * this.Z);
    this.RES = this.sys.renderer && this.sys.renderer.type === Phaser.WEBGL ? DPR * this.Z : 1;
    this.cameras.main.setZoom(DPR * this.Z).setBackgroundColor("#2b5c2a").setBounds(0, -140 * YPX, this.W, 168 * YPX);
    this.drawField();
    this.T = { ...TUNE, ...window.__mgTune || {} };
    this.runoff = { ...RUNOFF, inc: this.T.incRunoff };
    this.score = { me: 0, opp: 0 };
    this.di = -1;
    this.hudTxt = "";
    this.hail = this.hailUsed = false;
    this.setSlow(1);
    {
      const pm = this.me.projPre || this.me.proj || 0, po = this.opp.projPre || this.opp.proj || 0, gap = Math.abs(pm - po), spread0 = Math.min(10.5, Math.round(gap / 3 * 2) / 2), spread = spread0 < 1 ? 0 : spread0;
      const fav = spread === 0 ? null : pm > po ? this.me : this.opp;
      this.line = { fav, spread, txt: fav ? `${fav.name} \u2212${spread.toFixed(1)}` : "Pick'em", boost: fav === this.opp ? Phaser.Math.Clamp(gap / 60, 0, 0.3) : 0 };
    }
    this.stats = {};
    this.tally = { picks: 0, sacks: 0, downs: 0, clock: 0 };
    this.hud = $("mg-hud");
    this.hud.hidden = false;
    this.msg = $("mg-msg");
    $("mg-end").hidden = true;
    this.msg.hidden = false;
    $("mg-exit").hidden = false;
    const bx = $("mg-exit");
    bx.mgScene = this;
    if (!bx.dataset.confirm) {
      bx.dataset.confirm = "1";
      const label = bx.textContent;
      bx.addEventListener("click", (e) => {
        const sc = bx.mgScene;
        if (!sc || sc.state === "end" || bx.dataset.armed === "1") {
          bx.dataset.armed = "";
          bx.textContent = label;
          return;
        }
        e.stopImmediatePropagation();
        bx.dataset.armed = "1";
        bx.textContent = "Leave the game? Tap again";
        clearTimeout(bx.mgT);
        bx.mgT = setTimeout(() => {
          bx.dataset.armed = "";
          bx.textContent = label;
        }, 3e3);
      }, true);
    }
    bx.dataset.armed = "";
    bx.textContent = "\u2715 Back to stadium";
    this.hud.classList.remove("mg-over");
    const sh = $("mg-share");
    if (!sh.dataset.on) {
      sh.dataset.on = "1";
      sh.addEventListener("click", () => {
        const text = sh.dataset.text || "", done = (t) => {
          sh.textContent = t;
          setTimeout(() => {
            sh.textContent = "\u{1F4F8} Share";
          }, 1500);
        };
        const url = location.origin + location.pathname + location.search + "#drill";
        if (navigator.share) navigator.share({ title: "2-Minute Drill", text, url }).catch(() => {
        });
        else if (navigator.clipboard) navigator.clipboard.writeText(`${text} ${url}`).then(() => done("Copied!"), () => done("Could not copy"));
        else done("Could not copy");
      });
    }
    const ex = $("mg-end-exit");
    if (!ex.dataset.on) {
      ex.dataset.on = "1";
      ex.addEventListener("click", () => window.__stadium && window.__stadium.exitGame());
    }
    this.ball = this.add.image(0, 0, "football").setDepth(5e3).setVisible(false).setScale(1.3);
    this.ballShadow = this.add.ellipse(0, 0, 14, 6, 0, 0.3).setDepth(900).setVisible(false);
    this.aimG = this.add.graphics().setDepth(4e3);
    this.input.on("pointerdown", (p) => this.tap(this.cameras.main.getWorldPoint(p.x, p.y)));
    this.input.keyboard && this.input.keyboard.on("keydown-ESC", () => {
      const x = $(this.state === "end" ? "mg-end-exit" : "mg-exit");
      if (x) x.click();
    });
    this.nextDrive();
  }
  drawField() {
    const g = this.add.graphics().setDepth(-10), W = this.W;
    for (let y = -10; y < 110; y += 5) {
      g.fillStyle((y + 10) / 5 % 2 ? 4164154 : 4889155);
      g.fillRect(0, -(y + 5) * YPX, W, 5 * YPX);
    }
    g.fillStyle(3878698);
    g.fillRect(0, -140 * YPX, W, 30 * YPX);
    for (let y = -139 * YPX; y < -111 * YPX; y += 8) for (let x = 4 + (y % 16 ? 4 : 0); x < W; x += 8) {
      g.fillStyle([9071178, 5916214, 13214247, 7023146][x * 7 + y * 3 & 3], 0.8);
      g.fillRect(x, y, 4, 4);
    }
    g.fillStyle(7032618);
    g.fillRect(0, -110 * YPX - 4, W, 4);
    g.fillStyle(16777215, 0.8);
    for (let y = 0; y <= 100; y += 10) {
      g.fillRect(0, -y * YPX - 1, W, 2);
      const n = y <= 50 ? y : 100 - y;
      if (n) {
        this.add.text(10, -y * YPX - 18, String(n), { fontFamily: NUM_FONT, fontStyle: "bold", fontSize: "14px", color: "#ffffff" }).setAlpha(0.6).setResolution(this.RES);
      }
    }
    this.ezG = this.add.graphics().setDepth(-9);
    const big = { fontFamily: "Pixelify Sans", fontSize: "24px", fontStyle: "bold", color: "#ffffff", stroke: "#000000", strokeThickness: 3 };
    this.ezTop = this.add.text(W / 2, -105 * YPX, "", big).setOrigin(0.5).setResolution(this.RES).setDepth(-8);
    this.ezBot = this.add.text(W / 2, 5 * YPX, "", big).setOrigin(0.5).setResolution(this.RES).setDepth(-8);
    this.losLine = this.add.rectangle(W / 2, 0, W, 3, 7268351).setDepth(-5);
    this.firstLine = this.add.rectangle(W / 2, 0, W, 3, 16767050).setDepth(-5);
  }
  endZones() {
    const off = this.kind === "off" ? this.me : this.opp, def = this.kind === "off" ? this.opp : this.me, W = this.W;
    const paint = (t, y, txt, fallback) => {
      const k = kitOf(t);
      this.ezG.fillStyle(k ? hex(k[2]) : fallback);
      this.ezG.fillRect(0, y, W, 10 * YPX);
      const name = String(t.name || "").toUpperCase().slice(0, 22), fs = Math.max(12, Math.min(26, Math.floor(W * 0.9 / (Math.max(4, name.length) * 0.66))));
      txt.setText(name).setFontSize(fs).setColor(k ? k[5] : "#c9a227");
    };
    this.ezG.clear();
    paint(def, -110 * YPX, this.ezTop, 2365299);
    paint(off, 0, this.ezBot, 12075055);
  }
  startDrive(kind) {
    this.kind = kind;
    this.los = kind === "off" ? this.T.offStart : this.T.defStart;
    this.down = 1;
    this.toGo = this.T.toGo;
    this.clock = CLOCK;
    this.hail = false;
    this.setSlow(1);
    this.state = "pre";
    this.endZones();
    this.say(`${kind === "off" ? "\u{1F3C8} Your ball!" : "\u{1F6E1} Defense!"}${this.di === 0 ? ` \xB7 Line: ${this.line.txt}` : ""}`);
    this.firstPlay = true;
    this.updateHud();
    this.setupPlay();
  }
  ptsOf(team, i, pid) {
    const got = (team.starters_points || [])[i] || 0, r = (x) => Math.round(x * 10) / 10;
    return got ? { pts: r(got), proj: false } : this.played(team, pid) ? { pts: 0, proj: false } : { pts: r((this.L.proj || {})[pid] || 0), proj: true };
  }
  played(team, pid) {
    const G = this.L.games || {}, P = this.L.players || {};
    if (!Object.keys(G).length) return (team.points || 0) > 0;
    const st = G[P[pid] ? P[pid][2] : pid];
    return st === "in_game" || st === "complete";
  }
  names(team) {
    const P = this.L.players, out = [];
    (team.starters || []).forEach((pid, i) => {
      const p = P[pid];
      if (p && ["WR", "TE", "RB"].includes(p[1])) out.push({ name: surname(p[0]), pid, ...this.ptsOf(team, i, pid) });
    });
    while (out.length < 4) out.push({ name: ["Red", "Blue", "Gold", "Green"][out.length], pid: null, pts: 0 });
    return out.slice(0, 4);
  }
  qbOf(team) {
    const P = this.L.players, i = (team.starters || []).findIndex((pid) => P[pid] && P[pid][1] === "QB");
    return i < 0 ? { name: "QB", pts: 0 } : { name: surname(P[team.starters[i]][0]), pts: this.ptsOf(team, i, team.starters[i]).pts };
  }
  setupPlay() {
    for (const o of this.objs || []) o.destroy();
    this.objs = [];
    this.state = "pre";
    this.ball.setVisible(false);
    this.aimG.clear();
    this.playId = (this.playId || 0) + 1;
    if (!this.firstPlay && !this.hail) this.say("Set\u2026");
    const off = this.kind === "off" ? this.me : this.opp, def = this.kind === "off" ? this.opp : this.me;
    const W = this.W, y0 = -this.los * YPX, xs = [0.14, 0.38, 0.62, 0.86].map((f) => Phaser.Math.Clamp(f * W, EDGE, W - EDGE));
    const glow = this.sys.renderer && this.sys.renderer.type === Phaser.WEBGL;
    const make = (team, x, y, label, facing) => {
      const s = this.add.sprite(x, y, `team-${team.roster_id}-`, `${facing}0`).setOrigin(0.5, 1).setScale(1.3).setDepth(1e3 + y);
      if (team === this.opp) {
        if (glow) {
          try {
            s.preFX.addGlow(16777215, 2, 0, false, 0.1, 3);
          } catch {
            s.setTint(14543103);
          }
        } else s.setTint(14543103);
      }
      const t = this.add.text(x, y - 44, label, { fontFamily: NUM_FONT, fontStyle: "bold", fontSize: "11px", color: "#fff", backgroundColor: "rgba(20,20,20,0.6)", padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setResolution(this.RES).setDepth(9e3).setVisible(!!label);
      this.objs.push(s, t);
      return { s, t, team, x, y, vx: 0, vy: 0 };
    };
    const qb = this.qbOf(off);
    this.qb = make(off, W / 2, y0 + 4 * YPX, qb.name, "up");
    this.qb.pts = qb.pts;
    const routes = this.hail ? ROUTES.map(() => [[0, 100 - this.los + 6]]) : Phaser.Utils.Array.Shuffle(ROUTES.slice());
    const who = this.names(off), hot = Math.max(...who.map((n) => n.pts));
    this.recv = who.map((n, i) => {
      const r = make(off, xs[i], y0, `${n.name}${n.pid ? ` ${n.proj ? this.W >= 400 ? "proj " : "~" : ""}${n.pts.toFixed(1)}` : ""}${hot > 0 && n.pts === hot ? " \u{1F525}" : ""}`, "up");
      r.name = n.name;
      r.pts = n.pts;
      r.tagUp = i % 2 ? 15 : 0;
      const flip = xs[i] > W / 2 ? -1 : 1;
      r.path = routes[i].map(([dx, dy]) => ({ x: Phaser.Math.Clamp(xs[i] + dx * YPX * flip, EDGE, W - EDGE), y: Math.max(TOP_Y, y0 - dy * YPX) }));
      r.speed = (5.6 + Phaser.Math.Clamp(n.pts / 30, 0, 1) * 1.6) * YPX;
      r.ring = this.add.ellipse(xs[i], y0 + 2, 26, 10, 10265519, 0.4).setStrokeStyle(3, 10265519).setAlpha(0.7).setDepth(2e3 + y0);
      r.open = null;
      r.wasOpen = null;
      this.objs.push(r.ring);
      return r;
    });
    this.defs = this.recv.map((r) => {
      const d = make(def, r.x + (Math.random() - 0.5) * 20, y0 - (5 + Math.random() * 3) * YPX, "", "down");
      d.man = r;
      d.speed = (5.2 + Math.random()) * YPX;
      d.lag = 0.5 + Math.random() * 0.4 + (this.kind === "off" ? this.line.boost : 0);
      d.trail = this.hail ? 30 + Math.random() * 20 : 18 + Math.random() * 10;
      return d;
    });
    const safety = make(def, W / 2, y0 - (this.hail ? 30 : 16) * YPX, "", "down");
    safety.speed = 5.4 * YPX;
    this.defs.push(safety);
    this.you = this.kind === "def" ? this.defs[1] : null;
    if (this.you) {
      this.you.t.setText("YOU").setColor("#ffe08a").setVisible(true);
      this.you.man = null;
      this.you.goal = { x: this.you.s.x, y: this.you.s.y };
      this.you.speed = 7.5 * YPX;
    }
    this.losLine.y = y0;
    this.firstLine.setAlpha(1).y = -(this.los + this.toGo) * YPX;
    const hb = Math.ceil((this.hud.getBoundingClientRect().bottom || 0) / this.Z + 4);
    this.cameras.main.setBounds(0, -110 * YPX - hb, W, 138 * YPX + hb);
    this.cameras.main.centerOn(W / 2, y0 - this.H * 0.28);
    this.updateHud();
    if (this.hail) {
      this.banner("HAIL MARY", "#ffffff");
      this.say("\u{1F64F} Last play of the drive! Throw it up.");
    }
    const id = this.playId;
    this.time.delayedCall(700, () => {
      if (this.playId === id) this.snap();
    });
  }
  snap() {
    if (this.state !== "pre") return;
    this.state = "live";
    this.t0 = this.time.now;
    sfx.jump && sfx.jump();
    if (this.hail) {
    } else if (this.firstPlay) this.say(this.kind === "off" ? "Hut! \u{1F3C8} Wait for a green ring, then tap that receiver." : "Hut! \u{1F6E1} Tap where your defender should run.");
    else this.say("Hut!");
    this.firstPlay = false;
    if (this.kind === "def") this.aiThrowAt = this.time.now + 1300 + Math.random() * 1300;
  }
  cover(r) {
    let c = 999, who = null;
    for (const d of this.defs) {
      const dd = Phaser.Math.Distance.Between(r.s.x, r.s.y, d.s.x, d.s.y);
      if (dd < c) {
        c = dd;
        who = d;
      }
    }
    return { c, who };
  }
  tap(w) {
    if (this.state === "pre") {
      this.snap();
      if (this.kind === "off") return;
    }
    if (this.state !== "live" && !(this.kind === "def" && (this.state === "aim" || this.state === "air"))) return;
    if (this.kind === "off") {
      let best = null, bd = 1e9;
      for (const r of this.recv) {
        const d = Phaser.Math.Distance.Between(w.x, w.y, r.s.x, r.s.y - 16);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      if (best) this.aim(best);
    } else if (this.you) this.you.goal = { x: w.x, y: Math.max(TOP_Y, w.y + 10) };
  }
  aim(r) {
    this.state = "aim";
    this.target = r;
    r.openAtTap = r.open;
    this.time.delayedCall(150, () => {
      this.aimG.clear();
      if (this.state === "aim") this.throwTo(r);
    });
  }
  leadPoint(r, t) {
    let x = r.s.x, y = r.s.y, rem = r.speed * t;
    for (const w of r.path) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d >= rem) return { x: x + (w.x - x) * (rem / (d || 1)), y: y + (w.y - y) * (rem / (d || 1)) };
      x = w.x;
      y = w.y;
      rem -= d;
    }
    return { x, y };
  }
  throwTo(r) {
    this.state = "air";
    this.target = r;
    const from = { x: this.qb.s.x, y: this.qb.s.y - 24 };
    let to = { x: r.s.x, y: r.s.y }, dist = 0, t = 0.35;
    for (let k = 0; k < 2; k++) {
      dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
      t = 0.35 + dist / (290 + (this.qb.pts || 0) * 3);
      to = this.leadPoint(r, t);
    }
    if (this.hail && !calm()) this.setSlow(0.4);
    to = { x: Phaser.Math.Clamp(to.x, 10, this.W - 10), y: to.y - 16 };
    this.ball.setVisible(true).setPosition(from.x, from.y);
    this.ballShadow.setVisible(true);
    const st = { k: 0 };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: t * 1e3,
      ease: "Linear",
      onUpdate: () => {
        const h = Math.sin(Math.PI * st.k);
        this.ball.x = from.x + (to.x - from.x) * st.k;
        this.ball.y = from.y + (to.y - from.y) * st.k - h * (20 + dist * 0.15);
        this.ball.angle = st.k * 720;
        this.ball.setScale(1.3 + h * 0.4);
        this.ballShadow.setPosition(this.ball.x, from.y + 20 + (to.y - from.y) * st.k).setScale(1 - h * 0.4).setAlpha(1 - h * 0.5);
      },
      onComplete: () => {
        this.ballShadow.setVisible(false);
        this.arrive(r, to);
      }
    });
  }
  arrive(r, at) {
    this.state = "over";
    this.setSlow(1);
    if (this.hail) {
      this.hail = false;
      const roll2 = Math.random();
      if (roll2 < 0.25) {
        const s = this.stats[r.name] || (this.stats[r.name] = { c: 0, td: 0, y: 0 });
        s.c++;
        s.y += 100 - this.los;
        return this.endPlay(100 - this.los, `${r.name} comes down with it!`, "catch", r);
      }
      if (roll2 < 0.45) return this.turnover("Picked off in the end zone. \u{1F631}");
      return this.endPlay(0, "Batted down. So close!", "inc");
    }
    const dRecv = Phaser.Math.Distance.Between(at.x, at.y + 16, r.s.x, r.s.y), mine = this.kind === "off";
    if (dRecv > 40) return this.endPlay(0, "Overthrown. Incomplete.", "inc");
    const open = r.openAtTap !== false && this.cover(r).c > 20, youOn = this.you && Phaser.Math.Distance.Between(at.x, at.y + 16, this.you.s.x, this.you.s.y) < 40, roll = Math.random();
    const pPick = youOn ? this.T.youPick : open ? 0 : 0.15, pCatch = youOn ? this.T.youCatch : open ? (mine ? this.T.meOpenCatch : this.T.cpuOpenCatch) + Math.min(0.2, r.pts / 100) : 0.35;
    if (roll < pPick) {
      if (mine) this.tally.picks++;
      return this.turnover(mine ? "Intercepted! \u{1F631} He was covered." : "INTERCEPTION! \u{1F64C}");
    }
    if (roll >= pPick + pCatch) return this.endPlay(0, open ? mine ? "Dropped! Incomplete." : "Dropped! Lucky break." : mine ? "Broken up. Incomplete." : "Pass broken up! \u{1F6E1}", "inc");
    const yac = (open ? this.T.yacMin + Math.random() * this.T.yacRange : Math.random() * 3) * (mine ? 1 : this.T.cpuYac);
    const gain = Math.round(-r.s.y / YPX - this.los + yac);
    if (mine) {
      const s = this.stats[r.name] || (this.stats[r.name] = { c: 0, td: 0, y: 0 });
      s.c++;
      s.y += gain;
    }
    const text = `${r.name} catches it${yac > 7 ? " and breaks free" : ""}!`;
    if (calm()) return this.endPlay(gain, text, "catch", r);
    this.burst(r.s.x, r.s.y - 20, 16777215, 6);
    this.tweens.add({ targets: r.s, scale: 1.5, duration: 60, yoyo: true });
    this.time.delayedCall(60, () => this.endPlay(gain, text, "catch", r));
  }
  endPlay(gain, text, how, r) {
    this.hail = false;
    this.setSlow(1);
    this.state = "over";
    this.ball.setVisible(false);
    this.aimG.clear();
    const mine = this.kind === "off";
    this.clock = Math.max(0, this.clock - (this.runoff[how] || 0));
    this.los = Math.max(1, this.los + gain);
    if (how === "sack" && mine) this.tally.sacks++;
    if (this.los >= 100) {
      this.score[mine ? "me" : "opp"] += 7;
      if (mine && r && this.stats[r.name]) this.stats[r.name].td++;
      this.say(`${text} TOUCHDOWN ${mine ? this.me.name : this.opp.name}! \u{1F389}`);
      sfx.cheer && sfx.cheer();
      this.touchdown();
      this.updateHud();
      return this.time.delayedCall(2400, () => this.nextDrive());
    }
    if (gain >= this.toGo) {
      this.down = 1;
      this.toGo = Math.min(10, 100 - this.los);
      this.say(`${text} ${yds(gain)}. First down!`);
      this.flashFirst();
    } else {
      this.down++;
      this.toGo -= gain;
      this.say(`${text}${gain ? ` ${yds(gain)}.` : ""}`);
    }
    this.updateHud();
    if (this.down > 4) {
      if (mine) this.tally.downs++;
      this.say(`${text} Turnover on downs.`);
      return this.time.delayedCall(1800, () => this.nextDrive());
    }
    if (this.clock <= 0 && mine && !this.hailUsed && this.di === DRIVES.lastIndexOf("off") && this.score.me <= this.score.opp) {
      this.hail = this.hailUsed = true;
      this.say(`${text} \u23F1 Last play of the drive!`);
      return this.time.delayedCall(1500, () => this.setupPlay());
    }
    if (this.clock <= 0) {
      if (mine) this.tally.clock++;
      this.say(`${text} \u23F1 Clock's out!`);
      return this.time.delayedCall(1800, () => this.nextDrive());
    }
    this.time.delayedCall(1500, () => this.setupPlay());
  }
  turnover(text) {
    this.hail = false;
    this.setSlow(1);
    this.state = "over";
    this.ball.setVisible(false);
    this.aimG.clear();
    this.say(text);
    sfx.pop && sfx.pop();
    if (!calm() && this.kind === "off") this.flashView(15680580, 0.25);
    this.updateHud();
    this.time.delayedCall(2e3, () => this.nextDrive());
  }
  nextDrive() {
    this.di++;
    if (this.di >= DRIVES.length) return this.finish();
    this.startDrive(DRIVES[this.di]);
  }
  view() {
    const c = this.cameras.main;
    return { x: c.scrollX + c.width / 2, y: c.scrollY + c.height / 2 };
  }
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.5, p = this.add.rectangle(x, y, 3, 3, color).setDepth(9500);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, duration: 320, ease: "Quad.easeOut", onComplete: () => p.destroy() });
    }
  }
  flashView(color, alpha) {
    const v = this.view(), f = this.add.rectangle(v.x, v.y, this.W, this.H, color, alpha).setDepth(9800);
    this.tweens.add({ targets: f, alpha: 0, duration: 350, onComplete: () => f.destroy() });
  }
  flashFirst() {
    this.firstLine.y = -(this.los + this.toGo) * YPX;
    this.tweens.add({ targets: this.firstLine, alpha: 0.15, duration: 110, yoyo: true, repeat: 2, onComplete: () => this.firstLine.setAlpha(1) });
  }
  setSlow(k) {
    this.slow = k;
    this.tweens.timeScale = k;
    this.time.timeScale = k;
  }
  banner(txt, color) {
    const v = this.view(), cy = v.y - this.H * 0.12;
    const b = this.add.text(v.x, cy - this.H * 0.4, txt, { fontFamily: "Pixelify Sans", fontSize: "40px", fontStyle: "bold", color, stroke: "#2b1d12", strokeThickness: 6 }).setOrigin(0.5).setResolution(this.RES).setDepth(9900);
    if (calm()) {
      b.y = cy;
      this.time.delayedCall(1450, () => b.destroy());
      return;
    }
    this.tweens.add({ targets: b, y: cy, duration: 400, ease: "Back.easeOut", onComplete: () => this.tweens.add({ targets: b, alpha: 0, delay: 1200, duration: 250, onComplete: () => b.destroy() }) });
  }
  touchdown() {
    const v = this.view();
    if (!calm()) {
      this.cameras.main.shake(250, 8e-3);
      for (let i = 0; i < 36; i++) {
        const x = v.x + (Math.random() - 0.5) * this.W, p = this.add.rectangle(x, v.y - this.H / 2 - Math.random() * 40, 4, 3, Math.random() < 0.7 ? 16767050 : 13214247).setDepth(9700);
        this.tweens.add({ targets: p, y: p.y + this.H * (0.6 + Math.random() * 0.3), x: x + (Math.random() - 0.5) * 40, angle: 360 * (Math.random() < 0.5 ? -1 : 1), duration: 1300 + Math.random() * 800, ease: "Sine.easeIn", onComplete: () => p.destroy() });
      }
    }
    this.banner("TOUCHDOWN", "#ffd84a");
  }
  finish() {
    for (const o of this.objs || []) o.destroy();
    this.objs = [];
    this.state = "end";
    this.updateHud();
    const { me, opp } = this.score, win = me > opp, tie = me === opp, margin = me - opp;
    $("mg-end-title").textContent = `${win ? "\u{1F3C6}" : tie ? "\u{1F91D}" : "\u{1F624}"} ${this.me.name} ${me} \u2013 ${opp} ${this.opp.name}${win ? "" : " \u2014 run it back"}`;
    const top = Object.entries(this.stats).sort((a, b) => b[1].td - a[1].td || b[1].c - a[1].c || b[1].y - a[1].y)[0];
    $("mg-end-stat").textContent = top ? `\u2B50 ${top[0]}: ${top[1].c} catch${top[1].c === 1 ? "" : "es"}, ${top[1].td} TD` : "No catches yet \u2014 tap a receiver in a green ring";
    const T = this.tally, why = win || tie ? "" : T.picks ? `${T.picks} pick${T.picks > 1 ? "s" : ""} \u2014 throw to green rings` : T.sacks >= 2 ? `${T.sacks} sacks \u2014 get it out before the rush (4 s)` : T.downs ? "Stalled on 4th down \u2014 the green ring is your first read" : T.clock ? "The clock ran out \u2014 quick throws to open men" : "Their offense scored \u2014 tap to cut off the open receiver";
    const w = $("mg-end-why");
    w.textContent = why;
    w.hidden = !why;
    const VL = this.line, edge = VL.fav === this.me ? margin - VL.spread : VL.fav === this.opp ? margin + VL.spread : margin;
    const ats = VL.fav === this.opp && win ? "Upset! \u{1F436}" : edge > 0 ? "Covered \u2705" : edge === 0 ? "Push" : "Didn't cover";
    $("mg-end-line").textContent = `Line: ${VL.txt} \xB7 ${ats}`;
    const key = `mg-best-${this.L.id}-${this.opp.roster_id}`, sign = (n) => `${n > 0 ? "+" : n < 0 ? "\u2212" : "\xB1"}${Math.abs(n)}`;
    let best = null;
    try {
      const v = localStorage.getItem(key);
      best = v === null ? null : Number(v);
    } catch {
      best = null;
    }
    const isNew = best === null || margin > best;
    if (isNew) {
      best = margin;
      try {
        localStorage.setItem(key, String(margin));
      } catch {
      }
    }
    $("mg-end-best").textContent = `Your best vs ${this.opp.name}: ${sign(best)}${isNew && margin > 0 ? " \xB7 new best!" : ""}`;
    this.msg.hidden = true;
    $("mg-exit").hidden = true;
    $("mg-end").hidden = false;
    const again = $("mg-again");
    if (again) again.focus({ preventScroll: true });
    this.hud.classList.add("mg-over");
    const oppWho = !this.L.espn && this.opp.owner && this.opp.owner !== "open slot" ? `@${this.opp.owner}` : this.opp.name;
    $("mg-share").dataset.text = tie ? `Tied ${oppWho}'s starters ${me}\u2013${opp} in the 2-Minute Drill. Break it \u{1F447}` : win ? `I beat ${oppWho}'s starters ${me}\u2013${opp} in the 2-Minute Drill${top ? ` (${$("mg-end-stat").textContent.replace(/^⭐ /, "")})` : ""}. Bet you can't \u{1F447}` : `${oppWho}'s starters got me ${opp}\u2013${me} in the 2-Minute Drill. Run it back? \u{1F447}`;
    if (win) sfx.cheer && sfx.cheer();
  }
  say(t) {
    this.msg.textContent = t;
  }
  updateHud() {
    const ord = ["", "1st", "2nd", "3rd", "4th"][Math.min(4, this.down)] || "4th", c = Math.ceil(this.clock || 0);
    $("mg-score").textContent = `${this.me.name} ${this.score.me} \u2013 ${this.score.opp} ${this.opp.name}`;
    const t = this.state === "end" ? "Final" : this.los >= 100 ? `\u{1F389} Touchdown \xB7 drive ${this.di + 1}/${DRIVES.length}` : `\u23F1 ${Math.floor(c / 60)}:${String(c % 60).padStart(2, "0")} \xB7 ${this.kind === "off" ? "\u{1F3C8} Offense" : "\u{1F6E1} Defense"} \xB7 ${ord} & ${this.toGo >= 100 - this.los ? "goal" : this.toGo} \xB7 ${this.los <= 50 ? `own ${this.los}` : `opp ${100 - this.los}`} \xB7 drive ${this.di + 1}/${DRIVES.length}`;
    if (t !== this.hudTxt) {
      this.hudTxt = t;
      $("mg-down").textContent = t;
    }
  }
  update(time, delta) {
    if (this.state !== "live" && this.state !== "air" && this.state !== "aim") return;
    const dt = delta / 1e3 * (this.slow || 1);
    this.clock = Math.max(0, this.clock - dt);
    const move = (o, tx, ty, sp) => {
      tx = Phaser.Math.Clamp(tx, EDGE, this.W - EDGE);
      const dx = tx - o.s.x, dy = ty - o.s.y, d = Math.hypot(dx, dy);
      const v = Math.min(d, sp * dt);
      o.vx = d ? dx / d * sp : 0;
      o.vy = d ? dy / d * sp : 0;
      if (d > 1) {
        o.s.x += dx / d * v;
        o.s.y += dy / d * v;
      } else {
        o.vx = 0;
        o.vy = 0;
      }
      const dir = Math.abs(dx) > Math.abs(dy) ? dx < 0 ? "left" : "right" : dy < 0 ? "up" : "down";
      o.s.setTexture(`team-${o.team.roster_id}-`, `${d > 1 ? dir : o === this.qb || this.recv.includes(o) ? "up" : "down"}${d > 1 ? Math.floor(time / 120) % 4 : 0}`).setDepth(1e3 + o.s.y);
      o.t.setPosition(Phaser.Math.Clamp(o.s.x, o.t.width / 2 + 2, this.W - o.t.width / 2 - 2), o.s.y - 44 - (o.tagUp || 0));
    };
    for (const r of this.recv) {
      const w = r.path[0];
      if (w) {
        move(r, w.x, w.y, r.speed);
        if (Phaser.Math.Distance.Between(r.s.x, r.s.y, w.x, w.y) < 3 && r.path.length > 1) r.path.shift();
      } else move(r, r.s.x, r.s.y, 0);
    }
    for (const d of this.defs) {
      if (d === this.you) {
        move(d, d.goal.x, d.goal.y, d.speed);
        continue;
      }
      const target = d.man || this.recv.reduce((a, b) => b.s.y < a.s.y ? b : a);
      const lagX = target.s.x - target.vx * d.lag, lagY = Math.max(TOP_Y, target.s.y - target.vy * d.lag - (d.man ? d.trail : 50));
      move(d, lagX, lagY, d.speed);
    }
    for (const r of this.recv) {
      r.open = this.cover(r).c > OPEN_PX && !(this.state === "live" && this.time.now - this.t0 < this.T.coverMs);
      const col = r.open ? 4906624 : 15680580;
      r.ring.setPosition(r.s.x, r.s.y + 2).setFillStyle(col, 0.3).setStrokeStyle(3, col).setDepth(2e3 + r.s.y);
      if (r.open !== r.wasOpen) {
        r.wasOpen = r.open;
        r.t.setBackgroundColor(r.open ? "#166534" : "#991b1b");
      }
    }
    if (this.state === "aim" && this.target) {
      const g = this.aimG, x0 = this.qb.s.x, y0 = this.qb.s.y - 24, x1 = this.target.s.x, y1 = this.target.s.y - 16, n = Math.max(2, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 8));
      g.clear().fillStyle(16777215, 0.9);
      for (let i = 0; i <= n; i++) g.fillCircle(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, 1.5);
    }
    if (this.state === "live") {
      move(this.qb, this.qb.s.x, this.qb.s.y, 0);
      if (this.kind === "off" && time - this.t0 > (this.hail ? 5500 : this.T.sackMs)) return this.endPlay(-5, "Sacked!", "sack");
      if (this.kind === "def" && time > this.aiThrowAt) {
        let best = this.recv[0], bo = -1;
        for (const r of this.recv) {
          const o = this.cover(r).c;
          if (o > bo) {
            bo = o;
            best = r;
          }
        }
        this.aim(Math.random() < 0.6 ? best : Phaser.Utils.Array.GetRandom(this.recv));
      }
    }
    this.updateHud();
  }
}
export {
  MiniGameScene
};
