import { $, DPR } from "./core.js";
import { sfx } from "./sfx.js";
const YPX = 9;
const ROUTES = [
  [[0, 16], [0, 30]],
  [[0, 5], [-7, 12], [-12, 18]],
  [[0, 8], [8, 8], [12, 9]],
  [[0, 11], [0, 8]],
  [[0, 6], [6, 14], [6, 24]],
  [[0, 3], [-10, 5]]
];
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
    this.W = this.scale.width / DPR;
    this.H = this.scale.height / DPR;
    this.cameras.main.setZoom(DPR).setBackgroundColor("#2b5c2a");
    this.drawField();
    this.score = { me: 0, opp: 0 };
    this.drives = [];
    this.hud = $("mg-hud");
    this.hud.hidden = false;
    this.msg = $("mg-msg");
    this.ball = this.add.image(0, 0, "football").setDepth(5e3).setVisible(false).setScale(1.3);
    this.ballShadow = this.add.ellipse(0, 0, 14, 6, 0, 0.3).setDepth(900).setVisible(false);
    this.input.on("pointerdown", (p) => this.tap(this.cameras.main.getWorldPoint(p.x, p.y)));
    this.startDrive("off");
  }
  drawField() {
    const g = this.add.graphics().setDepth(-10), W = this.W;
    for (let y = -10; y < 110; y += 5) {
      g.fillStyle((y + 10) / 5 % 2 ? 4164154 : 4889155);
      g.fillRect(0, -(y + 5) * YPX, W, 5 * YPX);
    }
    g.fillStyle(2365299);
    g.fillRect(0, -110 * YPX, W, 10 * YPX);
    g.fillStyle(12075055);
    g.fillRect(0, 0, W, 10 * YPX);
    g.fillStyle(16777215, 0.8);
    for (let y = 0; y <= 100; y += 10) {
      g.fillRect(0, -y * YPX - 1, W, 2);
      const n = y <= 50 ? y : 100 - y;
      if (n) {
        this.add.text(10, -y * YPX - 18, String(n), { fontFamily: "Pixelify Sans", fontSize: "14px", color: "#ffffff" }).setAlpha(0.6).setResolution(DPR);
      }
    }
    this.add.text(W / 2, -105 * YPX, "TOUCHDOWN", { fontFamily: "Pixelify Sans", fontSize: "22px", color: "#c9a227" }).setOrigin(0.5).setResolution(DPR);
    this.losLine = this.add.rectangle(W / 2, 0, W, 3, 7268351).setDepth(-5);
    this.firstLine = this.add.rectangle(W / 2, 0, W, 3, 16767050).setDepth(-5);
  }
  startDrive(kind) {
    this.kind = kind;
    this.los = 25;
    this.down = 1;
    this.toGo = 10;
    this.drives.push(kind);
    this.say(kind === "off" ? `\u{1F3C8} Your ball! Tap an open receiver to throw.` : `\u{1F6E1} Defense! Tap where your defender should run.`);
    this.time.delayedCall(900, () => this.setupPlay());
  }
  names(team) {
    const P = this.L.players, out = [];
    for (const pid of team.starters || []) {
      const p = P[pid];
      if (p && ["WR", "TE", "RB"].includes(p[1])) out.push(p[0].split(" ").slice(-1)[0]);
    }
    while (out.length < 4) out.push(["Red", "Blue", "Gold", "Green"][out.length]);
    return out.slice(0, 4);
  }
  qbName(team) {
    const P = this.L.players, q = (team.starters || []).find((pid) => P[pid] && P[pid][1] === "QB");
    return q ? P[q][0].split(" ").slice(-1)[0] : "QB";
  }
  setupPlay() {
    for (const o of this.objs || []) o.destroy();
    this.objs = [];
    this.state = "pre";
    this.ball.setVisible(false);
    const off = this.kind === "off" ? this.me : this.opp, def = this.kind === "off" ? this.opp : this.me;
    const W = this.W, y0 = -this.los * YPX, xs = [0.14, 0.38, 0.62, 0.86].map((f) => f * W);
    const make = (team, x, y, label, facing) => {
      const s = this.add.sprite(x, y, `team-${team.roster_id}-${facing}0`).setOrigin(0.5, 1).setScale(1.3).setDepth(1e3 + y);
      const t = this.add.text(x, y - 40, label, { fontFamily: "Pixelify Sans", fontSize: "12px", color: "#fff", backgroundColor: "rgba(20,20,20,0.6)", padding: { x: 3, y: 1 } }).setOrigin(0.5, 1).setResolution(DPR).setDepth(9e3);
      this.objs.push(s, t);
      return { s, t, team, x, y, vx: 0, vy: 0 };
    };
    this.qb = make(off, W / 2, y0 + 4 * YPX, this.qbName(off), "up");
    const routes = Phaser.Utils.Array.Shuffle(ROUTES.slice());
    this.recv = this.names(off).map((n, i) => {
      const r = make(off, xs[i], y0, n, "up");
      const flip = xs[i] > W / 2 ? -1 : 1;
      r.path = routes[i].map(([dx, dy]) => ({ x: xs[i] + dx * YPX * flip, y: y0 - dy * YPX }));
      r.speed = (5.6 + Math.random() * 1.6) * YPX;
      return r;
    });
    this.defs = this.recv.map((r, i) => {
      const d = make(def, r.x + (Math.random() - 0.5) * 20, y0 - (5 + Math.random() * 3) * YPX, "", "down");
      d.man = r;
      d.speed = (5.2 + Math.random()) * YPX;
      d.lag = 0.25 + Math.random() * 0.25;
      return d;
    });
    const safety = make(def, W / 2, y0 - 16 * YPX, "", "down");
    safety.speed = 5.4 * YPX;
    this.defs.push(safety);
    this.you = this.kind === "def" ? this.defs[1] : null;
    if (this.you) {
      this.you.t.setText("YOU").setColor("#ffe08a");
      this.you.man = null;
      this.you.goal = { x: this.you.s.x, y: this.you.s.y };
      this.you.speed = 6.6 * YPX;
    }
    this.losLine.y = y0;
    this.firstLine.y = -(this.los + this.toGo) * YPX;
    this.cameras.main.centerOn(W / 2, y0 - this.H * 0.18);
    this.updateHud();
    this.time.delayedCall(700, () => {
      this.state = "live";
      this.t0 = this.time.now;
      sfx.jump && sfx.jump();
      if (this.kind === "def") this.aiThrowAt = this.time.now + 1300 + Math.random() * 1300;
    });
  }
  tap(w) {
    if (this.state !== "live") return;
    if (this.kind === "off") {
      let best = null, bd = 70;
      for (const r of this.recv) {
        const d = Phaser.Math.Distance.Between(w.x, w.y, r.s.x, r.s.y - 16);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      if (best) this.throwTo(best);
    } else if (this.you) this.you.goal = { x: w.x, y: w.y + 10 };
  }
  throwTo(r) {
    this.state = "air";
    this.target = r;
    const from = { x: this.qb.s.x, y: this.qb.s.y - 24 }, dist = Phaser.Math.Distance.Between(from.x, from.y, r.s.x, r.s.y), t = 0.35 + dist / 330;
    const to = { x: Phaser.Math.Clamp(r.s.x + r.vx * t, 10, this.W - 10), y: r.s.y + r.vy * t - 16 };
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
    const dRecv = Phaser.Math.Distance.Between(at.x, at.y + 16, r.s.x, r.s.y);
    let close = 999, who = null;
    for (const d of this.defs) {
      const dd = Phaser.Math.Distance.Between(at.x, at.y + 16, d.s.x, d.s.y);
      if (dd < close) {
        close = dd;
        who = d;
      }
    }
    const youClose = this.you && who === this.you;
    if (dRecv > 34) return this.endPlay(0, "Overthrown. Incomplete.");
    if (close < 15 && Math.random() < (youClose ? 0.55 : 0.3)) return this.turnover(this.kind === "off" ? "Intercepted! \u{1F631}" : "INTERCEPTION! \u{1F64C} Your ball.");
    if (close < 26 && Math.random() < (this.kind === "def" ? youClose ? 0.85 : 0.5 : 0.6)) return this.endPlay(0, this.kind === "off" ? "Broken up. Incomplete." : "Pass broken up! \u{1F6E1}");
    const open = close > 60 ? 6 + Math.random() * 12 : Math.random() * 5;
    const caught = -(at.y + 16) / YPX - this.los;
    this.endPlay(Math.round(caught + open), `${r.t.text} catches it${open > 6 ? " and breaks free" : ""}!`);
  }
  endPlay(gain, text) {
    this.state = "over";
    this.ball.setVisible(false);
    const mine = this.kind === "off";
    this.los += gain;
    if (this.los >= 100) {
      this.score[mine ? "me" : "opp"] += 7;
      this.say(`${text} TOUCHDOWN ${mine ? this.me.name : this.opp.name}! \u{1F389}`);
      sfx.cheer && sfx.cheer();
      return this.time.delayedCall(2200, () => this.nextDrive());
    }
    if (gain >= this.toGo) {
      this.down = 1;
      this.toGo = Math.min(10, 100 - this.los);
      this.say(`${text} +${gain} yards. First down!`);
    } else {
      this.down++;
      this.toGo -= gain;
      this.say(`${text}${gain ? ` +${gain} yards.` : ""}`);
    }
    if (this.down > 4) {
      this.say(`${text} Turnover on downs.`);
      return this.time.delayedCall(1800, () => this.nextDrive());
    }
    this.time.delayedCall(1500, () => this.setupPlay());
  }
  turnover(text) {
    this.state = "over";
    this.ball.setVisible(false);
    this.say(text);
    sfx.pop && sfx.pop();
    this.time.delayedCall(2e3, () => this.nextDrive());
  }
  nextDrive() {
    if (this.drives.length >= 4) return this.finish();
    this.startDrive(this.kind === "off" ? "def" : "off");
  }
  finish() {
    for (const o of this.objs || []) o.destroy();
    this.state = "end";
    const { me, opp } = this.score, win = me > opp, tie = me === opp;
    this.say(`${tie ? "\u{1F91D} Tie" : win ? "\u{1F3C6} You win" : "\u{1F624} They win"}  ${this.me.name} ${me} \u2013 ${opp} ${this.opp.name}. Tap \u21BB to play again.`);
    if (win) sfx.cheer && sfx.cheer();
    this.updateHud();
  }
  say(t) {
    this.msg.textContent = t;
  }
  updateHud() {
    const ord = ["", "1st", "2nd", "3rd", "4th"][Math.min(4, this.down)] || "4th";
    $("mg-score").textContent = `${this.me.name} ${this.score.me} \u2013 ${this.score.opp} ${this.opp.name}`;
    $("mg-down").textContent = this.state === "end" ? "Final" : `${this.kind === "off" ? "\u{1F3C8} Offense" : "\u{1F6E1} Defense"} \xB7 ${ord} & ${this.toGo >= 100 - this.los ? "goal" : this.toGo} \xB7 ball on ${this.los <= 50 ? `own ${this.los}` : `opp ${100 - this.los}`} \xB7 drive ${this.drives.length}/4`;
  }
  update(time, delta) {
    if (this.state !== "live" && this.state !== "air") return;
    const dt = delta / 1e3;
    const move = (o, tx, ty, sp) => {
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
      o.s.setTexture(`team-${o.team.roster_id}-${d > 1 ? dir : o === this.qb || this.recv.includes(o) ? "up" : "down"}${d > 1 ? Math.floor(time / 120) % 4 : 0}`).setDepth(1e3 + o.s.y);
      o.t.setPosition(o.s.x, o.s.y - 40);
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
      const lagX = target.s.x - target.vx * d.lag, lagY = target.s.y - target.vy * d.lag - (d.man ? 10 : 50);
      move(d, lagX, lagY, d.speed);
    }
    if (this.state === "live") {
      move(this.qb, this.qb.s.x, this.qb.s.y, 0);
      if (this.kind === "off" && time - this.t0 > 4200) return this.endPlay(-5, "Sacked! ");
      if (this.kind === "def" && time > this.aiThrowAt) {
        let best = this.recv[0], bo = -1;
        for (const r of this.recv) {
          const o = Math.min(...this.defs.map((d) => Phaser.Math.Distance.Between(r.s.x, r.s.y, d.s.x, d.s.y)));
          if (o > bo) {
            bo = o;
            best = r;
          }
        }
        this.throwTo(best);
      }
    }
    this.updateHud();
  }
}
export {
  MiniGameScene
};
