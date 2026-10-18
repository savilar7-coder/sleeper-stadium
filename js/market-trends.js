import { el, openPanel } from "./panel.js";
const SECTIONS = [
  { key: "repos", vendor: 0, dx: 30, dy: 34, stall: "s-stall-red", sign: "\u{1F419} Trending repos", title: "\u{1F419} Trending on GitHub (this week)", door: "the repo stall", icon: "\u{1F525}", blurb: "New repos from the last 7 days in AI agents, Claude, LLM tools, Phaser and automation." },
  { key: "skills", vendor: 1, dx: 30, dy: 34, stall: "s-stall-yel", sign: "\u{1F4DC} Skills", title: "\u{1F4DC} Claude Code skills and plugins", door: "the skill scrolls", icon: "\u{1F4DC}", blurb: "Skills, plugins and agent-skill packs that started rising in the last 30 days." },
  { key: "tools", vendor: 4, dx: 26, dy: 8, stall: "tool-stall-off", sign: "\u{1F527} Tools", title: "\u{1F527} MCP servers and dev tools", door: "the toolsmith", icon: "\u{1F527}", blurb: "MCP servers and tools that are new and rising (last 30 days)." }
];
const kilo = (n) => n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}k` : String(n || 0);
const shortName = (s, n = 26) => s.length > n ? `${s.slice(0, n - 1)}\u2026` : s;
function listPanel(sec, data) {
  const items = data[sec.key] || [];
  const nodes = [el("div", { class: "small" }, sec.blurb)];
  if (!items.length) {
    nodes.push(el("div", { class: "empty" }, "Nothing on the table yet. The daily run has not brought anything in."));
    return nodes;
  }
  nodes.push(el("div", { class: "needs" }, items.map((i) => el(
    "div",
    { class: "sub" },
    el(
      "div",
      { class: "sub-top" },
      el("b", {}, el("a", { href: i.url, target: "_blank", rel: "noopener noreferrer" }, i.name)),
      el("span", { class: "tag" }, `\u2605 ${kilo(i.stars)}`)
    ),
    el("div", {}, i.description),
    el("small", {}, i.why)
  ))));
  nodes.push(el("div", { class: "small" }, `From GitHub's public search, updated ${data.updated ? data.updated.slice(0, 10) : "?"}. Links open on github.com.`));
  return nodes;
}
function decorateMarketTrends(scene) {
  const data = { repos: [], skills: [], tools: [], updated: null };
  const total = () => data.repos.length + data.skills.length + data.tools.length;
  const T = scene.textures;
  const lbl = scene.marketLabel;
  let base = lbl ? lbl.text : "";
  if (lbl) {
    const orig = lbl.setText.bind(lbl);
    lbl.setText = (t) => {
      base = String(t);
      return orig(total() ? base.replace(/^🧺 Market/, `\u{1F9FA} Market \xB7 \u{1F525} ${total()} trending`) : base);
    };
  }
  scene.buildWalkGrid();
  const live = [];
  for (const sec of SECTIONS) {
    const v = scene.vendors && scene.vendors[sec.vendor];
    if (!v) continue;
    const dir = v.x < scene.marketSpot.x ? 1 : -1;
    const sx = v.x - dir * 42, sy = v.y - 10;
    const img = T.exists(sec.stall) ? T.get(sec.stall).getSourceImage() : null;
    const signY = sy - (img ? img.height : 70) + 6;
    const sign = scene.label(sx, signY, sec.sign, "#cfe8ff");
    sign.setDepth(sy + 1);
    const bubble = scene.bubble(v.x, v.y - 52, "").setVisible(false);
    scene.doors.push({
      x: v.x + dir * sec.dx,
      y: v.y + sec.dy,
      id: `market-${sec.key}`,
      name: sec.door,
      verb: "Browse",
      open: () => openPanel(sec.title, async () => listPanel(sec, data), true)
    });
    live.push({ sec, bubble, i: 0, sign });
  }
  const tick = () => {
    for (const b of live) {
      const items = data[b.sec.key];
      if (!items.length || !b.bubble.active) {
        b.bubble.setVisible(false);
        continue;
      }
      const it = items[b.i % Math.min(items.length, 5)];
      b.bubble.setText(`${b.sec.icon} ${shortName(it.name)} \u2605${kilo(it.stars)}`).setVisible(true);
      b.i += 1;
    }
  };
  const load = async () => {
    try {
      const r = await fetch("/api/market", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      for (const k of ["repos", "skills", "tools"]) data[k] = Array.isArray(d[k]) ? d[k] : [];
      data.updated = typeof d.updated === "string" ? d.updated : null;
      if (lbl) lbl.setText(base);
      tick();
    } catch {
    }
  };
  load();
  live.forEach((b, n) => {
    b.i = n;
  });
  const timers = [
    scene.time.addEvent({ delay: 4200, loop: true, callback: tick }),
    scene.time.addEvent({ delay: 30 * 60 * 1e3, loop: true, callback: load })
  ];
  scene.events.once("shutdown", () => timers.forEach((t) => t.remove()));
}
export {
  decorateMarketTrends
};
