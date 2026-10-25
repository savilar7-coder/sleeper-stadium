import { $, DPR } from "./core.js";
import { closePanel, el, openPanel } from "./panel.js";
import { sfx } from "./sfx.js";
import { espnLeague, espnLive, isEspn } from "./stadium-espn.js";
import { MASCOT_LOOKS, isMascot, mascotFace } from "./stadium-mascots.js";
window.__calm = /[?&]calm=1/.test(location.search) || !/[?&]calm=0/.test(location.search) && matchMedia("(prefers-reduced-motion: reduce)").matches;
if (window.__calm) document.body.classList.add("calm");
window.__tv = /[?&]tv=1/.test(location.search);
if (window.__tv) document.body.classList.add("tv");
const phaserReady = new Promise((ok, no) => {
  if (window.Phaser) {
    ok();
    return;
  }
  const tag = document.getElementById("phaser-js");
  if (!tag) {
    no(new Error("Phaser missing"));
    return;
  }
  tag.addEventListener("load", ok);
  tag.addEventListener("error", () => no(new Error("Phaser did not load")));
});
const scenes = phaserReady.then(() => Promise.all([import("./stadium-scene.js"), import("./minigame-scene.js")]));
scenes.catch(() => {
});
let LOOKS = [];
const API = "https://api.sleeper.app/v1";
const POS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const early = (url) => {
  const e = window.__early, p = e && e[url];
  if (p) delete e[url];
  return p;
};
const get = async (url) => {
  const r = await (early(url) || fetch(url, { cache: "no-store" }));
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};
const q = new URLSearchParams(location.search);
const store = (k, v) => {
  try {
    if (v === void 0) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    return null;
  }
  return v;
};
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);
let game = null, L = null;
const INJ_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
const INJ_ST = { Questionable: "Q", Doubtful: "D", Out: "O", "Injured Reserve": "IR", IR: "IR", PUP: "IR", QUESTIONABLE: "Q", DOUBTFUL: "D", OUT: "O", INJURY_RESERVE: "IR" };
const INJ_LONG = { Q: "Questionable", D: "Doubtful", O: "Out", IR: "IR" };
const injNorm = (s) => String(s || "").toLowerCase().replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "").replace(/[^a-z]/g, "");
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const injPart = (p) => String(p || "").split(" - ")[0].toLowerCase();
let injAt = 0, injBusy = false;
function injBaseline() {
  L.inj = L.inj || {};
  for (const [pid, p] of Object.entries(L.players || {})) {
    const x = p && p[5];
    if (x && INJ_ST[x[0]] && !L.inj[pid]) L.inj[pid] = { st: INJ_ST[x[0]], part: injPart(x[1]), at: null, fresh: false };
  }
}
async function fetchInjuries(force) {
  if (!L || injBusy || !force && Date.now() - injAt < 9 * 6e4) return;
  injBusy = true;
  try {
    let d = null;
    try {
      const c = JSON.parse(sessionStorage.getItem("st-inj-feed") || "null");
      if (c && Date.now() - c.at < 9 * 6e4) d = c.d;
    } catch {
    }
    if (!d) {
      const r = await fetch(INJ_URL);
      if (!r.ok) throw new Error(r.status);
      const raw = await r.json();
      d = [];
      for (const tm of raw.injuries || []) for (const i of tm.injuries || []) {
        const a = i.athlete || {}, eid = (((a.headshot || {}).href || "").match(/\/(\d+)\.png/) || [])[1] || null;
        d.push({ n: a.displayName || `${a.firstName || ""} ${a.lastName || ""}`.trim(), tm: ((a.team || {}).abbreviation || "").replace("WSH", "WAS"), eid, st: i.status, part: (i.details || {}).type || "", date: i.date || null });
      }
      try {
        sessionStorage.setItem("st-inj-feed", JSON.stringify({ at: Date.now(), d }));
      } catch {
      }
    }
    injAt = Date.now();
    applyInjuries(d);
  } catch {
  } finally {
    injBusy = false;
  }
}
function applyInjuries(d) {
  const P = L.players || {}, idx = {};
  if (!L.espn) {
    for (const [pid, p] of Object.entries(P)) if (p && p[2]) idx[`${injNorm(p[0])}|${p[2]}`] = pid;
  }
  const pidOf = (x) => L.espn ? x.eid ? `e${x.eid}` : null : idx[`${injNorm(x.n)}|${x.tm}`];
  const seenK = `st-inj-seen-${L.id}`;
  let seen = {};
  try {
    seen = JSON.parse(store(seenK) || "{}") || {};
  } catch {
    seen = {};
  }
  const today = dayStr(), inj = {}, active = new Set(), was = L.inj || {};
  for (const x of d) {
    const pid = pidOf(x);
    if (!pid || !P[pid]) continue;
    const st = INJ_ST[x.st];
    if (!st) {
      if (x.st === "Active") active.add(pid);
      continue;
    }
    const day = x.date ? dayStr(new Date(x.date)) : null, changed = seen[pid] != null && seen[pid] !== st, old = was[pid];
    const fresh = day === today || changed || !!(old && old.fresh);
    const ts = x.date ? Date.parse(x.date) : changed ? Date.now() : old && old.st === st ? old.ts : null;
    const worse = (a, b) => ["Q", "D", "O", "IR"].indexOf(a) > ["Q", "D", "O", "IR"].indexOf(b);
    inj[pid] = { st, part: injPart(x.part), at: day, fresh, ts, up: changed && !worse(st, seen[pid]) && seen[pid] != null ? true : old && old.st === st ? !!old.up : false };
  }
  for (const [pid, v] of Object.entries(was)) if (!inj[pid] && !active.has(pid)) inj[pid] = v;
  L.inj = inj;
  const now = {};
  for (const [pid, v] of Object.entries(inj)) now[pid] = v.st;
  store(seenK, JSON.stringify(now));
  const s = game && game.scene.getScene("stadium");
  if (s && s.sys.isActive() && s.injuriesChanged) s.injuriesChanged();
  injBadge();
  if (!$("panel").hidden && /^🚑/.test($("panel-title").textContent)) injuriesBox();
  if (!$("panel").hidden && /⚔️/.test($("panel-title").textContent)) {
    const m = mine();
    const rid = window.__muRid != null ? window.__muRid : m && m.roster_id;
    if (rid != null) matchup(rid);
  }
}
const hurt = (t) => (t.starters || []).map((pid, i) => pid && pid !== "0" && L.inj && L.inj[pid] ? { pid, i, ...L.inj[pid] } : null).filter(Boolean);
const oppOf = (t) => L.teams.find((o) => o.matchup_id && o.matchup_id === t.matchup_id && o !== t);
const slotRole = (t, i) => {
  const lab = (x) => String(x || "").replace("SUPER_FLEX", "SF").replace("REC_FLEX", "FLX"), all = (L.slots || []).map(lab), me = all[i];
  if (!me) return "";
  const total = all.filter((x) => x === me).length;
  return total > 1 ? `${me}${all.slice(0, i + 1).filter((x) => x === me).length}` : me;
};
const newInjuries = () => L.teams.flatMap((t) => hurt(t).filter((h) => h.fresh).map((h) => ({ ...h, t, opp: oppOf(t), role: slotRole(t, h.i) }))).sort((a, b) => (b.ts || 0) - (a.ts || 0));
const injKey = (h) => `${h.pid}:${h.st}`;
const injLast = (pid) => L.players[pid] ? String(L.players[pid][0]).split(" ").slice(-1)[0] : pid;
const ago = (ts) => {
  if (!ts) return "";
  const d = Date.now() - ts;
  if (d < 9e4) return "just now";
  if (d < 36e5) return `${Math.round(d / 6e4)} min ago`;
  if (d < 864e5) return `${Math.round(d / 36e5)} h ago`;
  return new Date(ts).toLocaleDateString("en-US", { weekday: "short" });
};
const injLine = (h) => `${h.up ? `${injLast(h.pid)} upgraded to ${INJ_LONG[h.st] || h.st}` : `${injLast(h.pid)} went down`}`;
const injHits = (h) => `${INJ_LONG[h.st] || h.st}${h.part ? ` \xB7 ${h.part}` : ""} \xB7 that's ${h.t.name}${/s$/i.test(h.t.name) ? "\u2019" : "\u2019s"} ${h.role || "starter"}${h.opp ? ` (vs ${h.opp.name})` : ""}`;
function injViewed(set) {
  const k = `st-inj-viewed-${L.id}`;
  if (set) {
    try {
      store(k, JSON.stringify([...set].slice(-200)));
    } catch {
    }
    return set;
  }
  try {
    return new Set(JSON.parse(store(k) || "[]"));
  } catch {
    return new Set();
  }
}
function injBadge() {
  const b = $("inj-btn");
  if (!b) return;
  const seen = injViewed(), n = newInjuries().filter((h) => !seen.has(injKey(h))).length;
  b.replaceChildren("\u{1F691} Injuries", n ? el("b", { class: "n" }, String(n)) : "");
  b.classList.toggle("new", n > 0);
}
function injuriesBox() {
  const rows = newInjuries(), seen = injViewed();
  for (const h of rows) seen.add(injKey(h));
  injViewed(seen);
  injBadge();
  openPanel("\u{1F691} Injuries", async () => [
    rows.length ? el("div", { class: "needs" }, rows.map((h) => el(
      "div",
      { class: `need${h.up ? "" : " failed"}` },
      el("b", {}, `\u{1F691} ${injLine(h)}`, el("small", { style: "font-weight:400;color:#8a7a5c" }, h.ts ? ` \xB7 ${ago(h.ts)}` : "")),
      el("span", {}, injHits(h))
    ))) : el("div", { class: "empty" }, "No new injuries today."),
    el("p", { class: "small" }, `${rows.length ? "New since you last looked. The \u{1F691} on a board marks the team it hits." : "When a starter goes down during the games it shows here within minutes, and the \u{1F691} on the board marks the team it hits."} ${injAt ? `Checked ${ago(injAt)}` : "Checking the injury report\u2026"}${Object.values(L.games || {}).includes("in_game") ? " \xB7 every 10 min while games are on." : "."}`)
  ]);
}
async function weekProjections(season, week) {
  const key = `st-proj-${season}-${week}`;
  try {
    const c = JSON.parse(sessionStorage.getItem(key) || "null");
    if (c && Date.now() - c.at < 30 * 6e4) return c.p;
  } catch {
  }
  const p = {};
  try {
    for (const r of await get(`https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular&${POS.map((x) => `position%5B%5D=${x}`).join("&")}`)) {
      if (r.player_id && r.stats && r.stats.pts_half_ppr != null) p[r.player_id] = r.stats.pts_half_ppr;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), p }));
    } catch {
    }
  } catch {
  }
  return p;
}
async function champions(lg) {
  const key = `st-champs-${lg.league_id}`;
  try {
    const kept = JSON.parse(store(key) || "null");
    if (kept && kept.length) return kept;
  } catch {
  }
  const out = [];
  let id = lg.previous_league_id;
  if (id && id !== "0") await new Promise((r) => {
    const t0 = Date.now(), k = () => {
      const s = game && game.scene && game.scene.getScene("stadium");
      if (s && s.teamSprites && s.teamSprites.size || Date.now() - t0 > 5e3) r();
      else setTimeout(k, 250);
    };
    k();
  });
  for (let i = 0; id && id !== "0" && i < 6; i++) {
    try {
      const [old, bracket, rosters, users] = await Promise.all([get(`${API}/league/${id}`), get(`${API}/league/${id}/winners_bracket`), get(`${API}/league/${id}/rosters`), get(`${API}/league/${id}/users`)]);
      const final = (bracket || []).find((m) => m.p === 1);
      const r = final && rosters.find((x) => x.roster_id === final.w), u = r && users.find((x) => x.user_id === r.owner_id);
      if (u) out.push({ season: old.season, team: u.metadata && u.metadata.team_name || u.display_name, owner: u.display_name });
      id = old.previous_league_id;
    } catch {
      break;
    }
  }
  if (out.length) store(key, JSON.stringify(out));
  return out;
}
async function loadEspn(leagueId) {
  const state = await get(`${API}/state/nfl`), season = state.league_season || state.season;
  const [lg, sched, blimpFile] = await Promise.all([espnLeague(leagueId, season), get(`${SCHEDULE}/${season}`).catch(() => null), get("stadium-blimp.json").catch(() => null)]);
  LOOKS = (await scenes)[0].LOOKS;
  for (const t of lg.teams) t.projPre = t.proj = t.starters.reduce((n, pid) => n + (lg.proj[pid] || 0), 0);
  applyLooks(lg.teams, {});
  const groups = {};
  for (const t of lg.teams) (groups[t.matchup_id || `bye-${t.roster_id}`] = groups[t.matchup_id || `bye-${t.roster_id}`] || []).push(t);
  return {
    id: leagueId,
    ...lg,
    rounds: 3,
    pairs: Object.values(groups),
    preseason: false,
    picks: [],
    news: [],
    champs: [],
    games: gamesOf(sched, lg.week),
    gameDates: datesOf(sched, lg.week),
    blimp: blimpOf(blimpFile),
    espn: true
  };
}
function applyLooks(teams, picked) {
  let local = {};
  try {
    local = JSON.parse(store("st-looks") || "{}") || {};
  } catch {
  }
  const okLook = (v) => ALL_LOOKS.includes(v) || ["Raven", "Dumpster", "Steeler", "Shorty"].includes(v) || /^FB\d+$/.test(v);
  const urlLooks = Object.fromEntries((new URLSearchParams(location.search).get("looks") || (window.__pass || {}).looks || "").split(",").map((p) => p.split(".")).filter((p) => p.length === 2 && /^\d+$/.test(p[0]) && okLook(p[1])));
  for (const t of teams) t.look = urlLooks[t.roster_id] || local[t.roster_id] || picked[t.roster_id] || guessLook(t);
  const gold = new Set((new URLSearchParams(location.search).get("gold") || (window.__pass || {}).gold || "").split(",").filter((x) => /^\d+$/.test(x)).map(Number));
  for (const t of teams) t.gold = gold.has(t.roster_id);
}
const blimpOf = (blimpFile) => (new URLSearchParams(location.search).get("blimp") || (window.__pass || {}).blimp || (blimpFile || {}).message || "").slice(0, 60);
async function load(leagueId) {
  if (isEspn(leagueId)) return loadEspn(leagueId);
  let [state, lg] = await Promise.all([get(`${API}/state/nfl`), get(`${API}/league/${leagueId}`)]);
  const season = state.league_season || state.season, week = Math.max(1, state.display_week || state.week || 1);
  if (lg && String(lg.season) !== String(season)) {
    let next = null;
    try {
      const members = await get(`${API}/league/${leagueId}/users`);
      for (const m of (members || []).slice(0, 4)) {
        const mine2 = await get(`${API}/user/${m.user_id}/leagues/nfl/${season}`);
        next = (mine2 || []).find((x) => x.previous_league_id === String(leagueId));
        if (next) break;
      }
    } catch {
    }
    if (!next) throw new Error(`that league ID is from the ${lg.season} season. Sleeper gives every league a new ID each season: copy this season's ID (League > Settings > League ID)`);
    leagueId = next.league_id;
    lg = next;
    try {
      const u = new URL(location.href);
      if (u.searchParams.get("league")) {
        u.searchParams.set("league", leagueId);
        history.replaceState(null, "", u);
      }
      store("st-league-id", leagueId);
    } catch {
    }
  }
  const champsP = champions(lg);
  const projP = weekProjections(season, week);
  const [users, rosters, matchups, picks, tx1, tx2, players, proj0, sched, picked, blimpFile] = await Promise.all([
    get(`${API}/league/${leagueId}/users`),
    get(`${API}/league/${leagueId}/rosters`),
    get(`${API}/league/${leagueId}/matchups/${week}`),
    get(`${API}/league/${leagueId}/traded_picks`).catch(() => []),
    get(`${API}/league/${leagueId}/transactions/${week}`).catch(() => []),
    week > 1 ? get(`${API}/league/${leagueId}/transactions/${week - 1}`).catch(() => []) : Promise.resolve([]),
    (window.__players || fetch("sleeper-players.json").then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })).catch(() => get("/api/sleeper/players")).catch(() => ({})),
    Promise.race([projP, new Promise((r) => setTimeout(() => r(null), 300))]),
    get(`${SCHEDULE}/${season}`).catch(() => null),
    get("stadium-avatars.json").catch(() => ({})),
    get("stadium-blimp.json").catch(() => null)
  ]);
  const proj = proj0 || {};
  const champs = await Promise.race([champsP, new Promise((r) => setTimeout(r, 0, null))]);
  LOOKS = (await scenes)[0].LOOKS;
  const byUser = Object.fromEntries(users.map((u) => [u.user_id, u]));
  const byRoster = Object.fromEntries(matchups.map((m) => [m.roster_id, m]));
  const teams = rosters.map((r) => {
    const u = byUser[r.owner_id] || {}, m = byRoster[r.roster_id] || {}, s = r.settings || {};
    return {
      roster_id: r.roster_id,
      owner_id: r.owner_id,
      owner: u.display_name || "open slot",
      name: (u.metadata && u.metadata.team_name || u.display_name || `Team ${r.roster_id}`).trim() || `Team ${r.roster_id}`,
      wins: s.wins || 0,
      losses: s.losses || 0,
      ties: s.ties || 0,
      fpts: (s.fpts || 0) + (s.fpts_decimal || 0) / 100,
      fpts_against: (s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100,
      points: m.points || 0,
      matchup_id: m.matchup_id || null,
      starters: m.starters || r.starters || [],
      starters_points: m.starters_points || [],
      players: r.players || [],
      players_points: m.players_points || {},
      taxi: r.taxi || [],
      reserve: r.reserve || [],
      look: null,
      mine: false,
      proj: 0
    };
  });
  for (const t of teams) t.projPre = t.proj = t.starters.reduce((n, pid) => n + (proj[pid] || 0), 0);
  applyLooks(teams, picked || {});
  const groups = {};
  for (const t of teams) (groups[t.matchup_id || `bye-${t.roster_id}`] = groups[t.matchup_id || `bye-${t.roster_id}`] || []).push(t);
  const preseason = teams.length > 1 && !teams.some((t) => t.matchup_id);
  if (preseason) {
    for (const k of Object.keys(groups)) delete groups[k];
    teams.forEach((t, i) => (groups[`pre-${i >> 1}`] = groups[`pre-${i >> 1}`] || []).push(t));
  }
  const slots = (lg.roster_positions || []).filter((p) => !["BN", "TAXI", "IR"].includes(p));
  const out = {
    id: leagueId,
    name: lg.name,
    prevId: lg.previous_league_id,
    settings: lg.settings || {},
    season,
    week,
    slots,
    rounds: lg.settings && lg.settings.draft_rounds || 3,
    teams,
    pairs: Object.values(groups),
    preseason,
    players,
    proj,
    picks,
    claims: [...tx1, ...tx2].filter((x) => x.type === "waiver"),
    news: [...tx1, ...tx2].filter((x) => x.status === "complete").sort((a, b) => b.status_updated - a.status_updated),
    champs: champs || [],
    games: gamesOf(sched, week),
    gameDates: datesOf(sched, week),
    blimp: blimpOf(blimpFile)
  };
  if (!champs) champsP.then((c) => {
    out.champs = c;
    fillChamps();
  });
  if (proj0 === null) projP.then((pp) => {
    Object.assign(proj, pp);
    out.poOdds = null;
    for (const t of out.teams) t.projPre = (t.starters || []).reduce((n, pid) => n + (pp[pid] || 0), 0);
    if (L === out) {
      updateProj();
      hud();
      const sc = game && game.scene.getScene("stadium");
      if (sc) sc.prevOdds = {};
      if (sc && sc.refreshScores && sc.sys.isActive()) sc.refreshScores();
    }
  });
  return out;
}
function fillChamps() {
  const s = game && game.scene.getScene("stadium"), c = L && L.champs.slice(0, 3);
  if (!s || !s.children || !c || !c.length) return;
  const t = s.children.list.find((o) => o.type === "Text" && /^🏆 Champions: first title/.test(o.text));
  if (t) t.setText(c.map((x) => `\u{1F3C6} ${x.season}  ${x.team}`).join("\n"));
}
function playerValue(pid) {
  const p = L.players[pid];
  if (!p) return 0;
  const [, pos, , age, sp] = p;
  if (pos === "K" || pos === "DEF") return Math.round((sp || 0) * 0.15);
  const peak = { QB: [25, 32, 0.06], RB: [22, 26, 0.13], WR: [23, 28, 0.08], TE: [24, 29, 0.08] }[pos] || [24, 28, 0.08];
  let f = 1;
  if (age) {
    if (age < peak[0]) f += 0.04 * (peak[0] - age);
    else if (age > peak[1]) f -= peak[2] * (age - peak[1]);
  }
  const w = { QB: 0.55, RB: 1, WR: 1, TE: 0.85 }[pos] || 1;
  return Math.max(0, Math.round((sp || 0) * Math.max(0.15, f) * w));
}
const PICK = [0, 150, 55, 20, 8, 4];
function pickValue(pk) {
  const ahead = Math.max(0, Number(pk.season) - Number(L.season) - 1);
  return Math.round((PICK[pk.round] || 3) * 0.85 ** ahead);
}
function picksOf(rid) {
  const out = [];
  for (let s = Number(L.season) + 1; s <= Number(L.season) + 3; s++) for (let rd = 1; rd <= L.rounds; rd++) for (const t of L.teams) {
    const traded = L.picks.find((x) => Number(x.season) === s && x.round === rd && x.roster_id === t.roster_id);
    const owner = traded ? traded.owner_id : t.roster_id;
    if (owner === rid) out.push({ season: String(s), round: rd, from: t.roster_id, label: `${s} round ${rd}${t.roster_id !== rid ? ` (from ${t.name})` : ""}` });
  }
  return out;
}
const mine = () => L.teams.find((t) => t.mine);
const toPlay = (t) => (t.starters || []).filter((pid) => {
  const G = L.games || {}, st = G[L.players[pid] ? L.players[pid][2] : pid];
  return pid && pid !== "0" && (Object.keys(G).length ? st && st !== "complete" : true);
}).length;
let sinceTxt;
function rails() {
  for (const id of ["st-rail-l", "st-rail-r"]) if (!document.getElementById(id)) document.body.appendChild(Object.assign(document.createElement("aside"), { id }));
  const rows = [...L.teams].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts), po = L.settings && L.settings.playoff_teams || 6;
  const card = el("div", { class: "rail-card" }, el("b", {}, "\u{1F3C6} Standings"), rows.map((t, i) => [
    el("div", { class: `rail-row${t.mine ? " mine" : ""}` }, el("span", {}, `${i + 1}. ${t.mine ? "\u{1F451} " : ""}${t.name}`), el("span", {}, `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`)),
    i + 1 === po && i + 1 < rows.length ? el("div", { class: "rail-cut" }, "playoff line") : null
  ]));
  document.getElementById("st-rail-l").replaceChildren(card);
}
function winOdds(m, opp) {
  const remA = Math.max(0, m.proj - m.points), remB = Math.max(0, opp.proj - opp.points);
  return remA + remB < 0.5 ? m.points === opp.points ? 0.5 : m.points > opp.points ? 1 : 0 : 1 / (1 + Math.exp(-1.702 * (m.proj - opp.proj) / (6 + 0.15 * (remA + remB))));
}
function tvLine() {
  const G = L.games || {};
  const live = Object.values(G).filter((s) => s === "in_game").length / 2;
  if (live >= 1) return `\u{1F534} LIVE \xB7 ${Math.round(live)} NFL game${live >= 2 ? "s" : ""} on \xB7 scores every minute`;
  const next = Object.keys(G).filter((k) => G[k] === "pre_game").map((k) => (L.gameDates || {})[k]).filter(Boolean).sort()[0];
  return next ? `\u{1F3C8} Next kickoff: ${(new Date(`${next}T12:00:00`)).toLocaleDateString("en-US", { weekday: "long" })}` : "\u{1F3C1} Week final";
}
function hud() {
  rails();
  const m = mine(), opp = m && L.teams.find((t) => t.matchup_id && t.matchup_id === m.matchup_id && t !== m);
  $("st-league").textContent = window.__tv ? `${L.name} \xB7 week ${L.week} \xB7 stadium.lamaisonwebstudio.com` : `${L.name} \xB7 week ${L.week}${canSwitch ? " \u25BE" : ""}`;
  $("st-score").textContent = m ? `\u{1F451} ${m.name} ${fmt(m.points)}${opp ? `  \u2013  ${fmt(opp.points)} ${opp.name}` : ""}` : window.__tv ? tvLine() : Object.values(L.games || {}).includes("in_game") ? "\u{1F534} Live now \xB7 tap any player \xB7 \u{1F451} My team = yours" : "\u{1F451} Tap My team to walk on the field as you";
  $("st-score").className = m && opp ? m.points >= opp.points ? "up" : "down" : "";
  const win = m && opp ? winOdds(m, opp) : null;
  if (m && opp) {
    const k = `st-last-${L.id}-${L.week}-${m.roster_id}`;
    if (sinceTxt === void 0) {
      let was = null;
      try {
        was = JSON.parse(store(k) || "null");
      } catch {
      }
      sinceTxt = was && (m.points - was.a > 0.05 || opp.points - was.b > 0.05) ? `Since ${new Date(was.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: +${fmt(Math.max(0, m.points - was.a))} you, +${fmt(Math.max(0, opp.points - was.b))} them` : "";
      if (sinceTxt) setTimeout(() => {
        sinceTxt = "";
        hud();
      }, 12e3);
    }
    store(k, JSON.stringify({ a: m.points, b: opp.points, t: Date.now() }));
  }
  const left = m && opp && L.games && Object.keys(L.games).length ? ` \xB7 ${toPlay(m)} v ${toPlay(opp)} to play` : "";
  $("st-proj").textContent = m && opp ? sinceTxt || `projected ${fmt(m.proj)} \u2013 ${fmt(opp.proj)} \xB7 ${Math.round(win * 100)}% to win${left}` : "";
}
const pname = (pid) => L.players[pid] ? L.players[pid][0] : pid;
function rosterTable(pids, t, withPts) {
  return el(
    "table",
    {},
    el("tr", {}, el("th", {}, "Pos"), el("th", {}, "Player"), el("th", {}, "Age"), el("th", { class: "num" }, "Proj"), withPts ? el("th", { class: "num" }, "Pts") : null),
    pids.map((pid, i) => {
      const p = L.players[pid] || [pid, "", "", null, 0];
      const pts = withPts ? t.starters_points[i] ?? t.players_points[pid] : null;
      return el(
        "tr",
        {},
        el("td", {}, p[1]),
        el("td", {}, p[0], el("span", { class: "small" }, ` ${p[2] || ""}`)),
        el("td", {}, p[3] || ""),
        el("td", { class: "num" }, L.proj[pid] != null ? fmt(L.proj[pid]) : "\u2013"),
        withPts ? el("td", { class: "num" }, pts == null ? "\u2013" : fmt(pts)) : null
      );
    })
  );
}
const POS_COL = { QB: "#c8463c", RB: "#2f8f4e", WR: "#2f6fb8", TE: "#d77a35", K: "#7a6a52", DEF: "#4b4f58" };
const posBadge = (pos) => el("span", { class: "tp-pos", style: `background:${POS_COL[pos] || "#7b4fa0"}` }, pos || "?");
function rosterCards(pids, t, withPts) {
  return el("div", { class: "tp-list" }, pids.map((pid, i) => {
    const p = L.players[pid] || [pid && pid !== "0" ? "Unknown" : "Empty", "", "", null, 0];
    const pts = withPts ? t.starters_points[i] ?? t.players_points[pid] : null, proj = L.proj[pid];
    return el(
      "div",
      { class: "tp-card" },
      pid && pid !== "0" ? face(pid) : el("span", { class: "mu-face" }),
      posBadge(p[1]),
      el("div", { class: "mu-who" }, el("b", {}, p[0]), el("small", {}, [p[2], p[3] ? `age ${p[3]}` : "", proj != null ? `proj ${fmt(proj)}` : ""].filter(Boolean).join(" \xB7 "))),
      withPts ? el("span", { class: "mu-pts" }, pts == null ? "\u2013" : fmt(pts)) : null
    );
  }));
}
let myLeaguesP = null, canSwitch = false;
const RECENT = "st-recent", demoLink = () => /[?&]sample=1/.test(location.search) || window.__tv;
const recents = () => {
  try {
    const r = JSON.parse(store(RECENT) || "[]");
    return Array.isArray(r) ? r.filter((x) => x && x.id && x.name) : [];
  } catch {
    return [];
  }
};
const rememberLeague = () => {
  if (!L || demoLink()) return;
  store(RECENT, JSON.stringify([{ id: String(L.id), name: L.name, app: L.espn ? "espn" : "sleeper" }, ...recents().filter((x) => String(x.id) !== String(L.id))].slice(0, 8)));
};
const myLeagues = () => {
  if (!L || demoLink()) return Promise.resolve([]);
  const uid = store("st-user-id");
  const fromUser = uid && !L.espn ? get(`${API}/user/${uid}/leagues/nfl/${L.season}`).then((x) => Array.isArray(x) ? x : []).catch(() => []) : Promise.resolve([]);
  return myLeaguesP || (myLeaguesP = fromUser.then((sl) => {
    const out = sl.map((l) => ({ id: String(l.league_id), name: l.name, sub: `${l.total_rosters || ""} teams` }));
    for (const r of recents()) if (!out.some((x) => x.id === String(r.id))) out.push({ id: String(r.id), name: r.name, sub: r.app === "espn" ? "ESPN \xB7 opened on this phone" : "opened on this phone" });
    if (!out.some((x) => x.id === String(L.id))) out.unshift({ id: String(L.id), name: L.name, sub: "" });
    return out;
  }));
};
function switchLeague() {
  openPanel("\u{1F500} Your leagues", async () => {
    const lgs = await myLeagues();
    return [
      el("p", {}, "Pick a league. Your team in each one is remembered."),
      el("div", { class: "who" }, lgs.map((l) => {
        const here = l.id === String(L.id), b = el("button", { type: "button", class: "who-btn" }, el("b", {}, `${here ? "\u2713 " : ""}${l.name}`), el("span", {}, here ? "open now" : l.sub));
        b.onclick = () => {
          if (here) {
            closePanel();
            return;
          }
          location.href = `${location.pathname}?league=${encodeURIComponent(l.id)}`;
        };
        return b;
      }))
    ];
  });
}
async function leagueSwitcher() {
  if ((await myLeagues()).length < 2) return;
  canSwitch = true;
  const e = $("st-league");
  e.style.cursor = "pointer";
  e.setAttribute("role", "button");
  e.title = "Switch league";
  e.addEventListener("click", (ev) => {
    ev.stopPropagation();
    switchLeague();
  });
  hud();
  const sw = el("button", { id: "st-switch", type: "button", "aria-label": "Switch league", title: "Switch league" }, "\u{1F500}");
  sw.onclick = (ev) => {
    ev.stopPropagation();
    switchLeague();
  };
  $("st-hud").appendChild(sw);
  $("st-hud").classList.add("can-switch");
}
function teamPanel(rid) {
  const t = L.teams.find((x) => x.roster_id === rid);
  const bench = t.players.filter((p) => !t.starters.includes(p) && !t.taxi.includes(p) && !t.reserve.includes(p));
  const pk = picksOf(rid);
  openPanel(`${t.mine ? "\u{1F451} " : ""}${t.name}`, async () => [
    t.mine && canSwitch ? (() => {
      const b = el("button", { type: "button", class: "st-wide st-ghost" }, "\u{1F500} Switch league");
      b.onclick = () => switchLeague();
      return b;
    })() : null,
    t.mine ? el("button", { type: "button", class: "st-wide st-ghost st-who" }, "\u{1F64B} Not you? Pick your team") : null,
    el(
      "div",
      { class: "tp-head" },
      el("div", { class: "tp-score" }, el("small", {}, `Week ${L.week}`), el("b", {}, fmt(t.points)), el("small", {}, `proj ${fmt(t.proj)}`)),
      el(
        "div",
        { class: "tp-stats" },
        el("span", {}, el("b", {}, `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`), "record"),
        el("span", {}, el("b", {}, `#${[...L.teams].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts).indexOf(t) + 1}`), "rank"),
        el("span", {}, el("b", {}, fmt(t.fpts)), "points for")
      ),
      el("small", { class: "tp-owner" }, t.owner)
    ),
    el("h3", {}, "Starters"),
    rosterCards(t.starters, t, true),
    bench.length ? el("details", { class: "tp-more" }, el("summary", {}, `Bench (${bench.length})`), rosterCards(bench, t, false)) : null,
    t.taxi.length ? el("details", { class: "tp-more" }, el("summary", {}, `Taxi squad (${t.taxi.length})`), rosterCards(t.taxi, t, false)) : null,
    el("h3", {}, "Draft picks"),
    pk.length ? el("div", { class: "chips" }, pk.map((p) => el("span", { class: "chip" }, p.label))) : el("div", { class: "empty" }, "No picks in the next three drafts."),
    t.mine ? el("button", { type: "button", class: "st-wide" }, "\u{1F501} Make a trade") : el("button", { type: "button", class: "st-wide" }, `\u{1F501} Trade with ${t.name}`),
    el("button", { type: "button", class: "st-wide st-ghost st-look" }, "\u{1F3AD} Change look")
  ]);
  setTimeout(() => {
    const q1 = (sel) => document.querySelector(`#panel-body ${sel}`);
    const tradeBtn = q1(".st-wide:not(.st-ghost)"), lookBtn = q1(".st-look"), whoBtn = q1(".st-who");
    if (tradeBtn) tradeBtn.onclick = () => tradeMaker(t.mine ? null : rid);
    if (lookBtn) lookBtn.onclick = () => lookPicker(rid);
    if (whoBtn) whoBtn.onclick = whoAreYou;
  }, 0);
}
const face = (pid) => {
  const p = L.players[pid];
  const espnId = /^e-?\d+$/.test(String(pid)) && String(pid).slice(1);
  const src = espnId ? p && p[1] === "DEF" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${(p[2] === "WAS" ? "wsh" : p[2]).toLowerCase()}.png` : `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${espnId}.png&w=96&h=70&cb=1` : p && p[1] === "DEF" ? `https://sleepercdn.com/images/team_logos/nfl/${String(pid).toLowerCase()}.png` : `https://sleepercdn.com/content/nfl/players/thumb/${pid}.jpg`;
  const img = el("img", { class: "mu-face", src, alt: "", loading: "lazy" });
  img.onerror = () => {
    img.style.visibility = "hidden";
  };
  return img;
};
function lineupFlag(t, i) {
  const pid = (t.starters || [])[i];
  if (!pid || pid === "0") return "EMPTY";
  const P = L.players[pid], team = P && P[2], G = L.games || {}, st = team && G[team];
  if (Object.keys(G).length && team && !st) return "BYE";
  if (!team) return "NO TEAM";
  if (st === "pre_game" && !L.proj[pid] && !(t.starters_points || [])[i]) return "NO PROJ";
  return "";
}
function matchup(rid) {
  const me = L.teams.find((t) => t.roster_id === rid) || mine() || L.teams[0];
  window.__muRid = me.roster_id;
  const opp = L.teams.find((t) => t.matchup_id && t.matchup_id === me.matchup_id && t !== me);
  if (!opp) {
    teamPanel(me.roster_id);
    return;
  }
  const side = (t, i, cls) => {
    const pid = t.starters[i], p = L.players[pid] || [pid ? "Unknown" : "Empty", "", "", null, 0];
    const pts = t.starters_points[i], proj = L.proj[pid];
    return el(
      "div",
      { class: `mu-side ${cls}` },
      pid && pid !== "0" ? face(pid) : el("span", { class: "mu-face" }),
      el(
        "div",
        { class: "mu-who" },
        el("b", {}, p[0]),
        el("small", {}, `${p[2] || ""}${proj != null ? ` \xB7 proj ${fmt(proj)}` : ""}`),
        (() => {
          const f = lineupFlag(t, i);
          return f ? el("small", { style: "color:#b23a2a;font-weight:700" }, ` \u26A0\uFE0F ${f}`) : null;
        })(),
        (() => {
          const j = L.inj && pid && L.inj[pid];
          return j ? el("small", { style: "color:#b23a2a;font-weight:700", title: INJ_LONG[j.st] }, ` \u{1F691} ${j.st}${j.part ? ` (${j.part})` : ""}`) : null;
        })()
      ),
      (() => {
        const tm = p[2], st = (L.games || {})[tm], d = (L.gameDates || {})[tm];
        if (!pts && st === "pre_game" && d) return el("div", { class: "mu-pts", style: "font-size:13px;color:#8a7a5c" }, (new Date(`${d}T12:00:00`)).toLocaleDateString("en-US", { weekday: "short" }));
        if (!pts && pid && pid !== "0" && tm && !st && Object.keys(L.games || {}).length) return el("div", { class: "mu-pts", style: "font-size:13px;color:#8a7a5c" }, "BYE");
        if (st === "in_game") return el("div", { class: "mu-pts" }, pts == null ? "\u2013" : fmt(pts), el("small", { style: "display:block;font-size:11px;color:#2e7d32;font-weight:700" }, "\u25CF LIVE"));
        return el("div", { class: "mu-pts" }, pts == null ? "\u2013" : fmt(pts));
      })()
    );
  };
  const rows = L.slots.map((slot, i) => el("div", { class: "mu-row" }, side(me, i, "left"), el("div", { class: "mu-slot" }, slot.replace("SUPER_FLEX", "SF").replace("REC_FLEX", "FLX")), side(opp, i, "right")));
  const lead = me.points === opp.points ? "" : me.points > opp.points ? "left" : "right";
  openPanel(`\u2694\uFE0F ${me.name} vs ${opp.name}`, async () => [
    el(
      "div",
      { class: "mu-head" },
      el("div", { class: `mu-team ${lead === "left" ? "lead" : ""}` }, el("b", {}, fmt(me.points)), el("small", {}, `proj ${fmt(me.proj)}`), el("span", {}, me.name)),
      el("div", { class: "mu-vs" }, "VS"),
      el("div", { class: `mu-team ${lead === "right" ? "lead" : ""}` }, el("b", {}, fmt(opp.points)), el("small", {}, `proj ${fmt(opp.proj)}`), el("span", {}, opp.name))
    ),
    await (async () => {
      const h = await headToHead(me, opp);
      if (!h.length) return null;
      const won = h.filter((g) => g.a > g.b).length, lost = h.filter((g) => g.a < g.b).length;
      return el("p", { class: "small", style: "text-align:center;margin:6px 0" }, `This season: ${me.name} ${won}\u2013${lost} vs ${opp.name} \xB7 ${h.map((g) => `wk ${g.w}: ${fmt(g.a)}\u2013${fmt(g.b)}`).join(" \xB7 ")}`);
    })(),
    !L.espn && L.prevId && L.prevId !== "0" && me.owner_id && opp.owner_id ? (() => {
      const b = el("button", { type: "button", style: "display:block;margin:4px auto;border:1px dashed #9e7c0c;background:none;border-radius:8px;padding:4px 10px;font-weight:600;cursor:pointer" }, "\u{1F4DC} All-time record");
      b.onclick = async () => {
        b.disabled = true;
        b.textContent = "Looking back\u2026";
        try {
          const g = await allTime(me, opp), w = g.filter((x) => x.a > x.b).length, l = g.filter((x) => x.a < x.b).length, yrs = [...new Set(g.map((x) => x.s))].sort();
          const big = g.reduce((m, x) => x.a - x.b > (m ? m.a - m.b : 0) ? x : m, null);
          b.replaceWith(el("p", { class: "small", style: "text-align:center;margin:4px 0;font-weight:700" }, g.length ? `All-time${yrs.length > 1 ? ` (${yrs[0]}\u2013${yrs[yrs.length - 1]})` : ""}: ${me.name} ${w}\u2013${l} vs ${opp.name}${big ? ` \xB7 biggest win ${fmt(big.a)}\u2013${fmt(big.b)} (${big.s})` : ""}` : "They have never played each other."));
        } catch {
          b.textContent = "Could not look back right now";
        }
      };
      return b;
    })() : null,
    el("div", { class: "mu-rows" }, rows),
    me.mine ? (() => {
      const b = el("button", { type: "button", class: "mu-play", style: "display:block;width:100%;margin:8px 0 0;min-height:44px;padding:10px;border-radius:10px;border:2px solid #1d140c;background:#2e7d32;color:#fff;font-weight:700;font-size:15px;cursor:pointer" }, "\u{1F3C8} Play this matchup \xB7 2-Minute Drill");
      b.onclick = () => playGame();
      return b;
    })() : null,
    (() => {
      const b = el("button", { type: "button", class: "mu-share" }, "\u{1F4F8} Share this matchup");
      b.onclick = () => matchupCard(me, opp);
      return b;
    })(),
    el("p", { class: "small" }, `Week ${L.week} \xB7 points refresh every minute during games \xB7 projections from ${L.espn ? "ESPN (your league's scoring)" : "Sleeper (half PPR)"}.`)
  ], true);
}
const NAME_LOOKS = [
  [/bird|raven|crow|eagle|hawk|falcon/i, "Tengu"],
  [/bear/i, "CaveLion"],
  [/lion|cat|tiger/i, "LionBoy"],
  [/llama|goat|sheep/i, "EggBoy"],
  [/devil|demon|chaos|mayhem/i, "DemonRed"],
  [/bite|bone|skull/i, "SkeletonDemon"],
  [/tear|ghost/i, "Spirit"],
  [/ninja/i, "NinjaBlue"],
  [/robot|bot/i, "RobotGreen"],
  [/monkey|ape/i, "MonkeyBoxerRed"]
];
function guessLook(t) {
  if (q.get("fb") !== "0") return `FB${t.roster_id * 5 % 12}`;
  const m = NAME_LOOKS.find(([re]) => re.test(t.name));
  return m ? m[1] : LOOKS[t.roster_id * 7 % LOOKS.length];
}
const ALL_LOOKS = [
  ...MASCOT_LOOKS,
  "Boy",
  "CamouflageGreen",
  "CamouflageRed",
  "CaveLion",
  "Cavegirl",
  "Caveman",
  "Child",
  "DemonGreen",
  "DemonRed",
  "EggBoy",
  "EggGirl",
  "Eskimo",
  "FighterRed",
  "FighterWhite",
  "GladiatorBlue",
  "GoldStatue",
  "GreenPig",
  "Hunter",
  "Inspector",
  "Knight",
  "KnightGold",
  "Lion",
  "LionBoy",
  "MaskFrog",
  "MaskRacoon",
  "Master",
  "Monk",
  "Monk2",
  "Monkey",
  "MonkeyBoxerBlue",
  "MonkeyBoxerRed",
  "NinjaBlue",
  "NinjaDark",
  "NinjaFire",
  "NinjaGreen",
  "NinjaMageBlack",
  "NinjaMageOrange",
  "NinjaRed",
  "NinjaYellow",
  "Noble",
  "OldMan",
  "OldMan2",
  "OldWoman",
  "Pig",
  "Princess",
  "RedGladiator",
  "RobotGreen",
  "RobotGrey",
  "Samurai",
  "SamuraiBlue",
  "Shaman",
  "Skeleton",
  "SkeletonDemon",
  "SorcererBlack",
  "SorcererOrange",
  "Spirit",
  "Statue",
  "Sultan",
  "Sultan2",
  "Tengu",
  "Vampire",
  "Villager",
  "Villager2",
  "Villager3",
  "Woman"
];
function lookPicker(rid) {
  const t = L.teams.find((x) => x.roster_id === rid);
  openPanel(`\u{1F3AD} Look for ${t.name}`, async () => [
    el("p", { class: "small" }, "Pick a character. Saved for the whole league when you are on the village (commissioner); otherwise only on this phone."),
    el("div", { class: "looks" }, ALL_LOOKS.map((look) => {
      const b = el("button", { type: "button", class: `look${look === t.look ? " on" : ""}`, title: look }, el("span", { class: "look-face", style: isMascot(look) ? `background-image:url(${mascotFace(look)});background-size:48px 48px` : `background-image:url(assets/chars/${look}.png)` }));
      b.onclick = async () => {
        t.look = look;
        let shared = false;
        try {
          const r = await fetch("/api/stadium/avatars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [rid]: look }) });
          shared = r.ok;
        } catch {
        }
        if (!shared) {
          let mine2 = {};
          try {
            mine2 = JSON.parse(store("st-looks") || "{}") || {};
          } catch {
          }
          mine2[rid] = look;
          store("st-looks", JSON.stringify(mine2));
        }
        closePanel();
        game.scene.getScene("stadium").scene.restart({ league: L });
      };
      return b;
    }))
  ]);
}
function playGame() {
  const me = mine();
  if (!me) {
    whoAreYou();
    return;
  }
  const opp = L.teams.find((t) => t.matchup_id && t.matchup_id === me.matchup_id && t !== me) || L.teams.find((t) => t !== me);
  closePanel();
  for (const id of ["st-hud", "zoom-ctl", "jump-btn", "share-btn", "inj-btn", "play-btn", "prompt"]) $(id).style.display = "none";
  for (const id of ["drill-tease", "recap-ready"]) {
    const e = document.getElementById(id);
    if (e) e.remove();
  }
  for (const id of ["st-rail-l", "st-rail-r", "st-ticker", "gh-star", "tip-pill", "share-lg"]) {
    const e = document.getElementById(id);
    if (e) e.style.visibility = "hidden";
  }
  game.scene.sleep("stadium");
  if (game.scene.getScene("minigame")) game.scene.stop("minigame");
  game.scene.start("minigame", { me, opp, league: L });
}
function exitGame() {
  game.scene.stop("minigame");
  $("mg-hud").hidden = true;
  for (const id of ["st-hud", "zoom-ctl", "jump-btn", "share-btn", "inj-btn", "play-btn", "prompt"]) $(id).style.display = "";
  for (const id of ["st-rail-l", "st-rail-r", "st-ticker", "gh-star", "tip-pill", "share-lg"]) {
    const e = document.getElementById(id);
    if (e) e.style.visibility = "";
  }
  game.scene.wake("stadium");
}
function pastWeeks() {
  if (!L.pastWeeks) {
    const weeks = [];
    for (let w = 1; w < Number(L.week); w++) weeks.push(w);
    if (L.espn) weeks.splice(0, weeks.length, ...Object.keys(L.past || {}).map(Number).sort((a, b) => a - b));
    L.pastWeeks = (L.espn ? Promise.resolve(weeks.map((w) => L.past[w] || [])) : Promise.all(weeks.map((w) => get(`${API}/league/${L.id}/matchups/${w}`).catch(() => [])))).then((all) => ({ weeks, all }));
  }
  return L.pastWeeks;
}
async function allPlay() {
  const { all } = await pastWeeks(), rec = {};
  for (const ms of all) {
    const scored = (ms || []).filter((m) => m.points > 0);
    for (const m of scored) {
      const r = rec[m.roster_id] = rec[m.roster_id] || { w: 0, l: 0, g: 0 };
      r.g++;
      for (const o of scored) if (o !== m) {
        if (m.points > o.points) r.w++;
        else if (m.points < o.points) r.l++;
      }
    }
  }
  return L.teams.map((t) => {
    const r = rec[t.roster_id] || { w: 0, l: 0, g: 0 }, exp = r.w + r.l ? r.w / (r.w + r.l) * r.g : 0;
    return { t, w: r.w, l: r.l, luck: t.wins - exp };
  }).filter((x) => x.w + x.l).sort((a, b) => b.w / (b.w + b.l) - a.w / (a.w + a.l));
}
async function pastSeason(id) {
  const k = `st-season-${id}`;
  try {
    const c = JSON.parse(store(k) || "null");
    if (c) return c;
  } catch {
  }
  const [lg, rosters] = await Promise.all([get(`${API}/league/${id}`), get(`${API}/league/${id}/rosters`)]);
  const owner = Object.fromEntries((rosters || []).map((r) => [r.roster_id, r.owner_id]));
  let holes = false;
  const reg = (lg.settings && lg.settings.playoff_week_start || 15) - 1;
  const weeks = await Promise.all(Array.from({ length: reg }, (_, i) => get(`${API}/league/${id}/matchups/${i + 1}`).catch(() => {
    holes = true;
    return [];
  })));
  const out = { season: lg.season, prev: lg.previous_league_id, games: [] };
  weeks.forEach((ms, i) => {
    const g = {};
    for (const m of ms || []) if (m.matchup_id && m.points > 0) (g[m.matchup_id] = g[m.matchup_id] || []).push(m);
    for (const pr of Object.values(g)) if (pr.length === 2) out.games.push([i + 1, owner[pr[0].roster_id], pr[0].points, owner[pr[1].roster_id], pr[1].points]);
  });
  if (lg.status === "complete" && !holes) store(k, JSON.stringify(out));
  return out;
}
async function allTime(a, b) {
  const games = (await headToHead(a, b)).map((g) => ({ s: L.season, a: g.a, b: g.b }));
  let id = L.prevId;
  for (let i = 0; id && id !== "0" && i < 3; i++) {
    let ps;
    try {
      ps = await pastSeason(id);
    } catch {
      break;
    }
    for (const [, o1, p1, o2, p2] of ps.games) {
      if (o1 === a.owner_id && o2 === b.owner_id) games.push({ s: ps.season, a: p1, b: p2 });
      else if (o1 === b.owner_id && o2 === a.owner_id) games.push({ s: ps.season, a: p2, b: p1 });
    }
    id = ps.prev;
  }
  return games;
}
async function headToHead(a, b) {
  const { weeks, all } = await pastWeeks(), games = [];
  all.forEach((ms, i) => {
    const x = (ms || []).find((m) => m.roster_id === a.roster_id), y = (ms || []).find((m) => m.roster_id === b.roster_id);
    if (x && y && x.matchup_id && x.matchup_id === y.matchup_id && (x.points || y.points)) games.push({ w: weeks[i], a: x.points || 0, b: y.points || 0 });
  });
  return games.reverse();
}
async function playoffOdds() {
  if (L.espn || L.preseason || /[?&]sample=1/.test(location.search)) return null;
  if (L.poOdds) return L.poOdds;
  const po = L.settings && L.settings.playoff_teams || 6, last = (L.settings && L.settings.playoff_week_start || 15) - 1;
  if (Number(L.week) > last) return null;
  const { all } = await pastWeeks(), scores = {};
  for (const ms of all) for (const m of ms || []) if (m.points > 0) (scores[m.roster_id] = scores[m.roster_id] || []).push(m.points);
  const stat = {};
  for (const t of L.teams) {
    const xs = scores[t.roster_id] || [], n = xs.length, mu = n ? xs.reduce((a, b) => a + b, 0) / n : 100;
    stat[t.roster_id] = { mu, sd: n > 1 ? Math.max(12, Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1))) : 20 };
  }
  const weeks = [];
  for (let w = Number(L.week); w <= last; w++) weeks.push(w);
  const sched = await Promise.all(weeks.map((w) => w === Number(L.week) ? Promise.resolve(L.teams.map((t) => ({ roster_id: t.roster_id, matchup_id: t.matchup_id, points: t.points }))) : get(`${API}/league/${L.id}/matchups/${w}`).catch(() => [])));
  const games = sched.map((ms) => Object.values((ms || []).reduce((g, m) => {
    if (m.matchup_id) (g[m.matchup_id] = g[m.matchup_id] || []).push(m.roster_id);
    return g;
  }, {})).filter((p) => p.length === 2));
  const med = !!(L.settings && L.settings.league_average_match), per = med ? 2 : 1;
  if (L.teams.every((t) => t.wins + t.losses + t.ties >= Number(L.week) * per)) games[0] = [];
  if (games.length > 1 && games.slice(1).every((g) => !g.length)) return null;
  let seed = [...`${L.id}|${L.week}|${L.teams.map((t) => t.points.toFixed(1)).join(",")}`].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const rnd = () => {
    seed = seed + 1831565813 >>> 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const gauss = () => {
    let u = 0, v = 0;
    while (!u) u = rnd();
    while (!v) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const N = 2e3, made = {};
  for (const t of L.teams) made[t.roster_id] = 0;
  for (let k = 0; k < N; k++) {
    const w = {}, pf = {};
    for (const t of L.teams) {
      w[t.roster_id] = t.wins + t.ties / 2;
      pf[t.roster_id] = t.fpts;
    }
    games.forEach((gs, i) => {
      const wk = {};
      for (const [a, b] of gs) {
        const sc = (rid) => {
          const t = L.teams.find((x2) => x2.roster_id === rid), st = stat[rid];
          const x = st.mu + st.sd * gauss();
          return i === 0 && t && t.proj > 0 ? t.points + Math.max(0, t.proj - t.points) * (x / Math.max(1, st.mu)) : x;
        };
        const sa = sc(a), sb = sc(b);
        wk[a] = sa;
        wk[b] = sb;
        pf[a] += sa;
        pf[b] += sb;
        if (sa > sb || sa === sb && rnd() < 0.5) w[a]++;
        else w[b]++;
      }
      if (med) {
        const r = Object.keys(wk).sort((x, y) => wk[y] - wk[x]);
        r.slice(0, Math.floor(r.length / 2)).forEach((rid) => {
          w[rid]++;
        });
      }
    });
    L.teams.map((t) => t.roster_id).sort((x, y) => w[y] - w[x] || pf[y] - pf[x]).slice(0, po).forEach((rid) => {
      made[rid]++;
    });
  }
  const odds = {};
  for (const rid of Object.keys(made)) odds[rid] = made[rid] / N;
  let prev = null;
  try {
    prev = JSON.parse(store(`st-po-${L.id}`) || "null");
  } catch {
  }
  const before = prev && prev.week < Number(L.week) ? prev.odds : prev && prev.week === Number(L.week) ? prev.before : null;
  try {
    store(`st-po-${L.id}`, JSON.stringify({ week: Number(L.week), odds, before }));
  } catch {
  }
  return L.poOdds = { odds, before };
}
async function trophies() {
  if (L.trophies) return L.trophies;
  const { weeks, all } = await pastWeeks();
  const name = (rid) => (L.teams.find((t) => t.roster_id === rid) || {}).name || `Team ${rid}`;
  let hi = null;
  const lows = {}, run = {}, best = {};
  all.forEach((ms, i) => {
    const scored = (ms || []).filter((m) => m.points > 0);
    if (!scored.length) return;
    for (const m of scored) if (!hi || m.points > hi.p) hi = { rid: m.roster_id, p: m.points, w: weeks[i] };
    const low = scored.reduce((a, b) => b.points < a.points ? b : a);
    lows[low.roster_id] = (lows[low.roster_id] || 0) + 1;
    const g = {};
    for (const m of scored) if (m.matchup_id) (g[m.matchup_id] = g[m.matchup_id] || []).push(m);
    for (const p of Object.values(g)) if (p.length === 2) for (const [x, y] of [[p[0], p[1]], [p[1], p[0]]]) {
      run[x.roster_id] = x.points > y.points ? (run[x.roster_id] || 0) + 1 : 0;
      best[x.roster_id] = Math.max(best[x.roster_id] || 0, run[x.roster_id]);
    }
  });
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0], lw = top(lows), bs = top(best);
  L.trophies = [
    hi && `\u{1F3C6} Highest week: ${name(hi.rid)} \xB7 ${fmt(hi.p)} (week ${hi.w})`,
    lw && lw[1] > 1 && `\u{1F6BD} Most last-place weeks: ${name(+lw[0])} \xB7 ${lw[1]}\xD7`,
    bs && bs[1] > 1 && `\u{1F525} Longest win streak: ${name(+bs[0])} \xB7 ${bs[1]} in a row`
  ].filter(Boolean);
  return L.trophies;
}
function standings() {
  const rows = [...L.teams].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
  const power = [...L.teams].sort((a, b) => b.fpts - a.fpts).map((t) => t.roster_id);
  const po = L.settings && L.settings.playoff_teams || 6, poWeek = L.settings && L.settings.playoff_week_start || 15;
  openPanel(`\u{1F3C6} ${L.name}`, async () => {
    const tr = await trophies(), PO = await playoffOdds(), pod = PO && PO.odds;
    const oddsCell = (t) => {
      const o = pod[t.roster_id] || 0, was = PO.before && PO.before[t.roster_id], d = was != null ? Math.round((o - was) * 100) : 0;
      return `${o >= 0.995 ? ">99" : o < 5e-3 ? "<1" : Math.round(o * 100)}%${d ? ` ${d > 0 ? "\u25B2" : "\u25BC"}${Math.abs(d)}` : ""}`;
    };
    return [
      el(
        "table",
        { class: "standings" },
        el("tr", {}, el("th", {}, "#"), el("th", {}, "Team"), el("th", { style: "white-space:nowrap" }, "W-L"), el("th", { class: "num" }, "PF"), el("th", { class: "num" }, "PA"), pod ? el("th", { class: "num" }, "Playoffs") : null),
        rows.map((t, i) => [
          el(
            "tr",
            t.mine ? { class: "mine" } : {},
            el("td", {}, String(i + 1)),
            el("td", { class: "tm-name", title: t.name }, `${t.mine ? "\u{1F451} " : ""}${t.name}`),
            el("td", {}, `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`),
            el("td", { class: "num" }, fmt(t.fpts)),
            el("td", { class: "num" }, t.fpts_against != null ? fmt(t.fpts_against) : "\u2013"),
            pod ? el("td", { class: "num" }, oddsCell(t)) : null
          ),
          i + 1 === po && i + 1 < rows.length ? el("tr", {}, el("td", { colspan: pod ? "6" : "5", style: "padding:1px 0;border-top:3px dashed #c9a227;font-size:11px;color:#7a5f08;text-align:center" }, "\u2014 playoff line \u2014")) : null
        ])
      ),
      el("p", { class: "small" }, `Top ${po} make the playoffs (from week ${poWeek}). PF / PA = points for / against.${pod && rows.some((t, i) => i >= po && rows.slice(0, po).some((u) => (pod[t.roster_id] || 0) > (pod[u.roster_id] || 0))) ? " A team below the line can have better odds: they weigh points scored and the schedule left, not only W-L." : ""}${pod ? " Playoffs = 2,000 simulated rest-of-seasons from this season's scores (\u25B2\u25BC vs last week)." : ""}`),
      await (async () => {
        const ap = await allPlay();
        if (!ap.length) return null;
        const luck = (x) => Math.abs(x.luck) < 0.5 ? "even" : `${x.luck > 0 ? "+" : "\u2212"}${Math.abs(x.luck).toFixed(1)} wins`;
        return [
          el("h3", {}, "All-play (vs everyone, every week)"),
          el(
            "table",
            {},
            el("tr", {}, el("th", {}, "Team"), el("th", {}, "All-play"), el("th", { class: "num" }, "Luck")),
            ap.map((x) => el("tr", x.t.mine ? { class: "mine" } : {}, el("td", {}, x.t.name), el("td", { style: "white-space:nowrap" }, `${x.w}-${x.l}`), el("td", { class: "num", style: "white-space:nowrap" }, `${x.luck >= 0.5 ? "\u{1F340} " : x.luck <= -0.5 ? "\u{1F494} " : ""}${luck(x)}`)))
          ),
          el("p", { class: "small" }, "Luck = real wins minus the wins your all-play record would give you.")
        ];
      })(),
      tr.length ? [el("h3", {}, "Season trophies"), el("div", { class: "chips" }, tr.map((x) => el("span", { class: "chip" }, x)))] : null,
      L.champs.length ? [el("h3", {}, "Champions"), el("div", { class: "chips" }, L.champs.map((c) => el("span", { class: "chip gold" }, `\u{1F3C6} ${c.season}: ${c.team}`)))] : null
    ];
  });
}
async function tradeLedger() {
  const weeks = [];
  for (let w = 1; w <= Number(L.week); w++) weeks.push(w);
  const tx = (await Promise.all(weeks.map((w) => get(`${API}/league/${L.id}/transactions/${w}`).catch(() => [])))).flat().filter((x) => x.type === "trade" && x.status === "complete");
  const { all } = await pastWeeks(), byWeek = {};
  all.forEach((ms, i) => {
    const m = byWeek[i + 1] = {};
    for (const t of ms || []) m[t.roster_id] = t.players_points || {};
  });
  const cur = byWeek[Number(L.week)] = {};
  for (const t of L.teams) cur[t.roster_id] = t.players_points || {};
  const since = (pid, w0, rid) => Object.entries(byWeek).reduce((n, [w, m]) => n + (Number(w) >= w0 ? (m[rid] || {})[pid] || 0 : 0), 0);
  const name = (rid) => (L.teams.find((t) => t.roster_id === rid) || {}).name || `Team ${rid}`;
  return tx.sort((a, b) => b.status_updated - a.status_updated).map((x) => {
    const w0 = x.leg || 1, sides = (x.roster_ids || []).map((rid) => {
      const got = Object.entries(x.adds || {}).filter(([, r]) => r === rid).map(([pid]) => pid);
      const picks = (x.draft_picks || []).filter((pk) => pk.owner_id === rid).map((pk) => `${pk.season} R${pk.round}`);
      return { rid, got, picks, pts: got.reduce((n, pid) => n + since(pid, w0, rid), 0) };
    }).sort((a, b) => b.pts - a.pts);
    return el(
      "div",
      { class: "need" },
      el("b", {}, `Week ${w0}: ${sides.map((sd) => `${name(sd.rid)} +${fmt(sd.pts)}`).join(" \xB7 ")}`),
      el("span", {}, sides.map((sd) => `${name(sd.rid)} got ${[...sd.got.map(pname), ...sd.picks].join(", ") || "nothing"}`).join(" | "))
    );
  });
}
function news() {
  const name = (rid) => (L.teams.find((t) => t.roster_id === rid) || {}).name || `Team ${rid}`;
  const trades = L.news.filter((x) => x.type === "trade"), moves = L.news.filter((x) => x.type !== "trade");
  const when = (x) => {
    const t = x.status_updated || x.created;
    if (!t) return "";
    const d = new Date(t);
    return ` \xB7 ${Date.now() - t < 6 * 864e5 ? d.toLocaleDateString("en-US", { weekday: "short" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };
  const rows = [...trades, ...moves].slice(0, 60).map((x) => {
    const adds = Object.entries(x.adds || {}), drops = Object.entries(x.drops || {});
    if (x.type === "trade") {
      const parts = (x.roster_ids || []).map((rid) => {
        const got = adds.filter(([, r]) => r === rid).map(([pid]) => pname(pid));
        const gotPicks = (x.draft_picks || []).filter((pk) => pk.owner_id === rid).map((pk) => `${pk.season} R${pk.round}`);
        return `${name(rid)} gets ${[...got, ...gotPicks].join(", ") || "nothing"}`;
      });
      return el("div", { class: "need publish" }, el("b", {}, `\u{1F91D} Trade${when(x)}`), el("span", {}, parts.join(" \xB7 ")));
    }
    const who = name((x.roster_ids || [])[0]);
    const what = [...adds.map(([pid]) => `+ ${pname(pid)}`), ...drops.map(([pid]) => `\u2212 ${pname(pid)}`)].join("  ");
    return el("div", { class: "need" }, el("b", {}, `${x.type === "waiver" ? "\u{1F4CB} Waiver" : "\u{1F193} Free agent"} \xB7 ${who}`, el("small", { style: "font-weight:400;color:#8a7a5c" }, when(x))), el("span", {}, what));
  });
  const won = (L.claims || []).filter((x) => x.status === "complete" && x.adds), lost = (L.claims || []).filter((x) => x.status === "failed" && x.adds);
  const faab = won.some((x) => x.settings && x.settings.waiver_bid != null);
  const board = won.map((x) => {
    const pid = Object.keys(x.adds)[0], rid = x.adds[pid], by = {};
    for (const f of lost) if (f.adds[pid] != null) {
      const r = (f.roster_ids || [])[0];
      if (r != null && r !== rid) by[r] = Math.max(by[r] || 0, (f.settings || {}).waiver_bid || 0);
    }
    const losers = Object.entries(by).map(([r, b]) => ({ rid: Number(r), bid: b })).sort((p, q2) => q2.bid - p.bid);
    return { pid, rid, bid: (x.settings || {}).waiver_bid, losers };
  }).sort((a, b) => (b.bid || 0) - (a.bid || 0) || b.losers.length - a.losers.length).filter((x) => faab ? x.bid > 0 : x.losers.length > 0).slice(0, 5);
  const meRid = (mine() || {}).roster_id, budget = L.settings && L.settings.waiver_budget;
  const waiverBoard = board.length ? [
    el("h3", {}, faab ? `\u{1F4B0} Waiver board${budget ? ` (budget $${budget})` : ""}` : "\u{1F4CB} Contested waivers"),
    el("div", { class: "needs" }, board.map((x) => el(
      "div",
      { class: `need${x.losers.some((l) => l.rid === meRid) ? " publish" : ""}` },
      el("b", {}, `${faab ? `$${x.bid} ` : ""}${pname(x.pid)} \u2192 ${name(x.rid)}`),
      el("span", {}, x.losers.length ? `beat ${x.losers.map((l) => `${l.rid === meRid ? "you" : name(l.rid)}${faab ? ` $${l.bid}` : ""}`).join(", ")}` : "no other claims")
    )))
  ] : null;
  const shown = trades.length + 10, more = rows.length > shown ? rows.splice(shown) : [];
  const moreBtn = more.length ? (() => {
    const b = el("button", { type: "button", style: "display:block;margin:8px auto;border:1px dashed #9e7c0c;background:none;border-radius:8px;padding:4px 10px;font-weight:600;cursor:pointer" }, `Show all ${more.length + 10} moves`);
    b.onclick = () => b.replaceWith(el("div", { class: "needs" }, more));
    return b;
  })() : null;
  const ledgerBtn = L.espn ? null : (() => {
    const b = el("button", { type: "button", style: "display:block;margin:8px auto;border:1px dashed #9e7c0c;background:none;border-radius:8px;padding:4px 10px;font-weight:600;cursor:pointer;min-height:44px" }, "\u{1F4D2} Season trade ledger");
    b.onclick = async () => {
      b.disabled = true;
      b.textContent = "Adding up every trade\u2026";
      try {
        const rows2 = await tradeLedger();
        b.replaceWith(el(
          "div",
          {},
          el("h3", {}, "\u{1F4D2} Trade ledger"),
          rows2.length ? el("div", { class: "needs" }, rows2) : el("div", { class: "empty" }, "No trades yet this season."),
          el("p", { class: "small" }, "Real fantasy points scored for each side since the week of the trade (players only; picks count once they become players).")
        ));
      } catch {
        b.textContent = "Could not add them up right now";
      }
    };
    return b;
  })();
  openPanel("\u{1F4F0} League news", async () => [waiverBoard, ledgerBtn, L.news.length ? el("p", { class: "small" }, `${trades.length} trade${trades.length === 1 ? "" : "s"} \xB7 ${moves.length} waiver / free-agent move${moves.length === 1 ? "" : "s"} (last 2 weeks)`) : null, rows.length ? el("div", { class: "needs" }, rows) : el("div", { class: "empty" }, L.espn ? "ESPN trades and waivers aren\u2019t shown here yet." : "Quiet week."), moreBtn]);
}
function tradeMaker(partnerId) {
  const me = mine();
  if (!me) {
    whoAreYou();
    return;
  }
  const others = L.teams.filter((t) => t !== me);
  let partner = L.teams.find((t) => t.roster_id === partnerId) || others[0];
  const give = new Set(), get_ = new Set();
  const side = (t, set) => {
    const items = [
      ...t.players.map((pid) => ({ k: `p:${pid}`, label: `${(L.players[pid] || [])[1] || ""} ${pname(pid)}`, v: playerValue(pid), age: (L.players[pid] || [])[3] })),
      ...picksOf(t.roster_id).map((pk) => ({ k: `k:${pk.season}:${pk.round}:${pk.from}`, label: `\u{1F4DC} ${pk.label}`, v: pickValue(pk) }))
    ].sort((a, b) => b.v - a.v);
    return el("div", { class: "tm-list" }, items.map((it) => {
      const b = el("button", { type: "button", class: `tm-item${set.has(it.k) ? " on" : ""}` }, el("span", {}, it.label, it.age ? el("small", {}, ` ${it.age}`) : null), el("b", {}, String(it.v)));
      b.onclick = () => {
        if (set.has(it.k)) set.delete(it.k);
        else set.add(it.k);
        render();
      };
      return b;
    }));
  };
  const total = (set) => [...set].reduce((n, k) => n + (k.startsWith("p:") ? playerValue(k.slice(2)) : pickValue({ season: k.split(":")[1], round: Number(k.split(":")[2]) })), 0);
  const labelOf = (k) => k.startsWith("p:") ? pname(k.slice(2)) : `${k.split(":")[1]} round ${k.split(":")[2]}`;
  function render() {
    const a = total(give), b = total(get_), diff = b - a, sum = Math.max(1, a + b);
    const verdict = !a && !b ? "Pick players or picks on both sides." : Math.abs(diff) <= sum * 0.1 ? "\u2696\uFE0F Looks fair" : diff > 0 ? "\u{1F4C8} You win this on paper" : "\u{1F4C9} You give more than you get";
    const body = $("panel-body");
    const sel = el("select", { class: "tm-pick" }, others.map((t) => el("option", t === partner ? { value: t.roster_id, selected: "" } : { value: t.roster_id }, t.name)));
    sel.onchange = () => {
      partner = L.teams.find((t) => t.roster_id === Number(sel.value));
      get_.clear();
      render();
    };
    const share = el("button", { type: "button", class: "st-wide" }, "\u{1F4E4} Share this offer");
    share.onclick = () => shareOffer(me, partner, [...give].map(labelOf), [...get_].map(labelOf), a, b);
    body.replaceChildren(
      el("div", { class: "tm-head" }, el("span", {}, "Trade with"), sel),
      el("div", { class: "tm-bar" }, el("i", { style: `width:${a / sum * 100}%` }), el("em", {}, `${a} you give \xB7 you get ${b}`)),
      el("div", { class: "tm-verdict" }, verdict),
      el(
        "div",
        { class: "tm-cols" },
        el("div", {}, el("h3", {}, `You give (${me.name})`), side(me, give)),
        el("div", {}, el("h3", {}, `You get (${partner.name})`), side(partner, get_))
      ),
      share,
      el("p", { class: "small" }, `Values are a rough guide: this season's projection (half PPR) adjusted for age, picks by round and year. Not advice. Send real offers in the ${L.espn ? "ESPN" : "Sleeper"} app.`)
    );
  }
  openPanel("\u{1F501} Trade maker", async () => [el("div", {}, "Loading\u2026")], true);
  setTimeout(render, 0);
}
function shareOffer(me, partner, give, get_, a, b) {
  const cv = document.createElement("canvas"), c = cv.getContext("2d"), W = 1080, rows = Math.max(give.length, get_.length, 1), H = 380 + rows * 56;
  cv.width = W;
  cv.height = H;
  c.fillStyle = "#1d2a22";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#3f8a3a";
  c.fillRect(30, 30, W - 60, H - 60);
  c.strokeStyle = "#fff";
  c.lineWidth = 4;
  c.strokeRect(30, 30, W - 60, H - 60);
  const font = '"Pixelify Sans", "Segoe UI", sans-serif';
  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.font = `600 54px ${font}`;
  c.fillText("Trade offer", W / 2, 110);
  c.font = `30px ${font}`;
  c.fillText(`${L.name}`, W / 2, 155);
  c.textAlign = "left";
  c.font = `600 34px ${font}`;
  c.fillStyle = "#ffe08a";
  c.fillText(`${me.name} gives`, 70, 230);
  c.fillText(`${partner.name} gives`, W / 2 + 20, 230);
  c.font = `30px ${font}`;
  c.fillStyle = "#fff";
  give.forEach((s, i) => c.fillText(`\u2022 ${s}`, 70, 290 + i * 56));
  get_.forEach((s, i) => c.fillText(`\u2022 ${s}`, W / 2 + 20, 290 + i * 56));
  c.font = `24px ${font}`;
  c.fillStyle = "#cfe8c8";
  c.textAlign = "center";
  c.fillText(`rough value ${a} vs ${b} \xB7 made in the Dynasty Stadium`, W / 2, H - 60);
  cv.toBlob(async (blob) => {
    const file = new File([blob], "trade-offer.png", { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Trade offer" });
        return;
      }
    } catch {
      return;
    }
    el("a", { href: URL.createObjectURL(blob), download: "trade-offer.png" }).click();
  });
}
const passParams = () => {
  const q2 = new URLSearchParams(location.search), out = [];
  for (const k of ["blimp", "looks", "gold"]) if (q2.get(k)) out.push(`${k}=${encodeURIComponent(q2.get(k))}`);
  return out;
};
const stadiumLink = () => {
  const base = `${location.host}${location.pathname.replace(/index\.html$/, "")}`;
  if (/[?&]sample=1/.test(location.search)) return base;
  const q2 = [...L.id && !/dynasty-stadium/.test(location.host) ? [`league=${L.id}`] : [], ...passParams()];
  return q2.length ? `${base}?${q2.join("&")}` : base;
};
function toast(text) {
  document.querySelectorAll(".st-toast").forEach((x) => x.remove());
  const t = el("div", { class: "st-toast" }, text);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function sharePicture(cv, name, title) {
  cv.toBlob(async (blob) => {
    const file = new File([blob], name, { type: "image/png" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text: `${title} \xB7 https://${stadiumLink()}` });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    el("a", { href: URL.createObjectURL(blob), download: name }).click();
    let copied = false;
    try {
      await navigator.clipboard.writeText(`https://${stadiumLink()}`);
      copied = true;
    } catch {
    }
    toast(`\u{1F4F8} Picture saved${copied ? " \xB7 link copied" : ""}. Paste it in your league chat!`);
  });
}
let shareAfterPick = false, playAfterPick = 0;
function playWhenReady(tries = 0) {
  const s = game && game.scene.getScene("stadium");
  if (s && s.sys.isActive() && game.scene.getScene("minigame") && s.textures.exists("football")) playGame();
  else if (tries < 60) setTimeout(() => playWhenReady(tries + 1), 300);
}
function shareMine() {
  count("share");
  const m = mine();
  if (!m) {
    shareAfterPick = true;
    whoAreYou();
    return;
  }
  const opp = L.teams.find((t) => t.matchup_id && t.matchup_id === m.matchup_id && t !== m);
  if (opp) {
    matchupCard(m, opp);
    return;
  }
  const url = `https://${stadiumLink()}`;
  if (navigator.share) {
    navigator.share({ title: L.name, url }).catch(() => {
    });
    return;
  }
  navigator.clipboard.writeText(url).then(() => toast("\u{1F517} Stadium link copied. Paste it in your league chat!"), () => prompt("Copy this link:", url));
}
const handle = (t) => !L.espn && t.owner && t.owner !== "open slot" ? `@${t.owner}` : t.name;
function matchupCard(me, opp) {
  const W = 1080, H = 1080, cv = el("canvas", { width: W, height: H }), c = cv.getContext("2d"), font = 'system-ui, "Segoe UI", Arial, sans-serif';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2e1f8f");
  g.addColorStop(1, "#0b0a1a");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const fit = (t, px, max) => {
    c.font = `bold ${px}px ${font}`;
    let w = t;
    while (c.measureText(w).width > max && w.length > 4) w = w.slice(0, -1);
    return w === t ? t : `${w.trim()}\u2026`;
  };
  const best = (t) => {
    let k = -1;
    t.starters.forEach((pid2, i) => {
      if (k < 0 || (t.starters_points[i] || 0) > (t.starters_points[k] || 0)) k = i;
    });
    const pid = t.starters[k];
    return pid && L.players[pid] && (t.starters_points[k] || 0) > 0 ? `${L.players[pid][0]} ${fmt(t.starters_points[k])}` : "";
  };
  c.textAlign = "center";
  c.fillStyle = "#ffd84a";
  c.font = `900 30px ${font}`;
  c.fillText("\u{1F3DF}\uFE0F SLEEPER STADIUM", W / 2, 62);
  c.fillStyle = "#c9a227";
  c.font = `bold 28px ${font}`;
  c.fillText(`${L.name} \xB7 WEEK ${L.week}`.toUpperCase().slice(0, 44), W / 2, 104);
  const sc = game && game.scene.getScene("stadium");
  [[me, 280, "right"], [opp, W - 280, "left"]].forEach(([t, x, dir]) => {
    const fr = sc && sc.textures.exists(`team-${t.roster_id}-`) ? sc.textures.getFrame(`team-${t.roster_id}-`, `${dir}0`) : null;
    if (fr) {
      c.imageSmoothingEnabled = false;
      c.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, x - 96, 130, 192, 192);
    }
    c.fillStyle = "#fff4d6";
    c.fillText(fit(t.name, 42, 470), x, 370);
    c.fillStyle = "#b9b3d9";
    c.font = `bold 26px ${font}`;
    if (handle(t)[0] === "@") c.fillText(fit(handle(t), 26, 440), x, 408);
    c.fillStyle = "#ffd84a";
    c.font = `900 130px ${font}`;
    c.fillText(fmt(t.points), x, 540);
    c.fillStyle = "#b9b3d9";
    c.font = `bold 28px ${font}`;
    c.fillText(`proj ${fmt(t.proj)}`, x, 588);
    const bp = best(t);
    c.fillStyle = "#9dff7a";
    c.fillText(fit(bp ? `\u2B50 ${bp}` : "kickoff pending", 26, 440), x, 636);
  });
  c.fillStyle = "#e0394c";
  c.font = `900 64px ${font}`;
  c.fillText("VS", W / 2, 500);
  const d = me.points - opp.points, done = (me.starters || []).concat(opp.starters || []).every((pid) => {
    const st = (L.games || {})[L.players[pid] ? L.players[pid][2] : pid];
    return !pid || pid === "0" || !st || st === "complete";
  }) && Object.keys(L.games || {}).length;
  const who = fit(handle(opp), 60, 560), pct = Math.round(winOdds(me, opp) * 100);
  const head = !me.points && !opp.points ? "WHO YOU GOT? \u{1F447}" : done ? d >= 0 ? `BEAT ${who} BY ${fmt(d)} \u{1F60E}` : `LOST TO ${who} BY ${fmt(-d)} \u{1F624}` : `${d >= 0 ? "UP" : "DOWN"} ${fmt(Math.abs(d))} ${d >= 0 ? "ON" : "TO"} ${who}`;
  const hit = newInjuries().find((h) => h.t === me || h.t === opp), hitShort = hit && (hit.t.name.length > 14 ? `${hit.t.name.slice(0, 13)}\u2026` : hit.t.name);
  const sub = !me.points && !opp.points ? `${pct}% to win \xB7 kickoff soon` : done ? "FINAL" : hit && !hit.up ? `${injLast(hit.pid).toUpperCase()} WENT DOWN \xB7 ${hitShort.toUpperCase()} ${hit.t.points < (hit.t === me ? opp : me).points ? `NEEDS ${fmt((hit.t === me ? opp : me).points - hit.t.points)}` : `UP ${fmt(hit.t.points - (hit.t === me ? opp : me).points)}`}` : `${pct}% TO WIN \xB7 ${toPlay(me)} v ${toPlay(opp)} TO PLAY`;
  let hp = 84;
  c.font = `900 ${hp}px ${font}`;
  while (c.measureText(head).width > W - 80 && hp > 24) {
    hp -= 4;
    c.font = `900 ${hp}px ${font}`;
  }
  c.fillStyle = d >= 0 || !me.points ? "#fff4d6" : "#ffb4a8";
  c.fillText(head, W / 2, 770);
  c.fillStyle = hit && !hit.up && me.points + opp.points ? "#ffb4a8" : "#9dff7a";
  let sp = 44;
  c.font = `900 ${sp}px ${font}`;
  while (c.measureText(sub).width > W - 80 && sp > 24) {
    sp -= 2;
    c.font = `900 ${sp}px ${font}`;
  }
  c.fillText(sub, W / 2, 836);
  c.fillStyle = "#c9a227";
  c.font = `bold 30px ${font}`;
  c.fillText("\u25B6 WATCH IT LIVE", W / 2, H - 120);
  c.fillStyle = "#e8e2ff";
  c.font = `bold 44px ${font}`;
  c.fillText(location.host, W / 2, H - 62);
  sharePicture(cv, `week-${L.week}-matchup.png`, `${me.name} ${fmt(me.points)} \u2013 ${fmt(opp.points)} ${opp.name}, live in the ${L.name} stadium \u{1F3DF}\uFE0F`);
}
const bubbleUp = () => !!(window.__bubbleUp && window.__bubbleUp());
function drillTeaser() {
  if (window.__tv) return;
  const sc = game && game.scene.getScene("stadium");
  if (bubbleUp() || document.querySelector(".td-banner") || $("panel").hidden === false || sc && Date.now() - (sc.lastBannerAt || 0) < 1e4) {
    setTimeout(drillTeaser, 5e3);
    return;
  }
  if (!mine() || store("st-drill-seen") || document.getElementById("recap-ready") || game && game.scene.isActive("minigame")) return;
  store("st-drill-seen", "1");
  const b = el(
    "div",
    { id: "drill-tease", style: "position:fixed;left:50%;bottom:calc(108px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(320px,calc(100vw - 32px));background:#1d140c;color:#fff4d6;border:2px solid #4ade80;border-radius:10px;padding:10px 12px;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 4px 14px #0008" },
    el("b", {}, "\u{1F3C8} New: play your matchup."),
    " Your starters vs theirs in a 1-minute 2-Minute Drill. ",
    el("button", { type: "button", class: "dt-go", style: "margin-left:4px;border:0;background:#4ade80;border-radius:6px;font-weight:700;padding:3px 9px" }, "Play"),
    el("button", { type: "button", class: "dt-x", "aria-label": "Close", style: "margin-left:4px;border:0;background:none;color:#fff4d6;font-size:16px" }, "\xD7")
  );
  b.querySelector(".dt-go").onclick = () => {
    b.remove();
    playGame();
  };
  b.querySelector(".dt-x").onclick = () => b.remove();
  b.setAttribute("role", "status");
  document.body.appendChild(b);
  if (!window.__calm) setTimeout(() => b.remove(), 12e3);
}
async function weekDigest() {
  const me = mine();
  if (!me || window.__tv || L.preseason) return;
  const k = `st-snap-${L.id}`, rank = (t) => [...L.teams].sort((a, b2) => b2.wins - a.wins || b2.fpts - a.fpts).indexOf(t) + 1;
  let snap = null;
  try {
    snap = JSON.parse(store(k) || "null");
  } catch {
  }
  const PO = await playoffOdds().catch(() => null), odds = PO && PO.odds ? PO.odds[me.roster_id] : null;
  const now = { week: Number(L.week), rid: me.roster_id, w: me.wins, l: me.losses, rank: rank(me), odds };
  if (document.getElementById("recap-ready") || bubbleUp()) return;
  store(k, JSON.stringify(now));
  if (!snap || snap.rid !== me.roster_id || snap.week >= now.week) return;
  const opp = L.teams.find((t) => t.matchup_id && t.matchup_id === me.matchup_id && t !== me);
  const bits = [
    `${snap.w}\u2013${snap.l} \u2192 ${now.w}\u2013${now.l}`,
    snap.rank !== now.rank ? `${now.rank < snap.rank ? "up" : "down"} to ${now.rank}${["th", "st", "nd", "rd"][now.rank % 10 > 3 || [11, 12, 13].includes(now.rank % 100) ? 0 : now.rank % 10]}` : `still ${now.rank}${["th", "st", "nd", "rd"][now.rank % 10 > 3 || [11, 12, 13].includes(now.rank % 100) ? 0 : now.rank % 10]}`,
    odds != null && snap.odds != null ? `playoffs ${Math.round(odds * 100)}% (${odds >= snap.odds ? "+" : "\u2212"}${Math.abs(Math.round((odds - snap.odds) * 100))} since wk ${snap.week})` : odds != null ? `playoffs ${Math.round(odds * 100)}%` : null,
    opp ? `this week: ${opp.name}` : null
  ].filter(Boolean);
  const b = el(
    "div",
    { id: "recap-ready", style: "position:fixed;left:50%;bottom:calc(108px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(320px,calc(100vw - 32px));background:#1d140c;color:#fff4d6;border:2px solid #ffd84a;border-radius:10px;padding:10px 12px;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 4px 14px #0008" },
    el("b", {}, `\u{1F4C5} Week ${now.week}, ${me.name}: `),
    bits.join(" \xB7 "),
    " ",
    el("button", { type: "button", class: "rr-x", "aria-label": "Close", style: "margin-left:4px;border:0;background:none;color:#fff4d6;font-size:16px" }, "\xD7")
  );
  b.querySelector(".rr-x").onclick = () => b.remove();
  b.setAttribute("role", "status");
  document.body.appendChild(b);
  if (!window.__calm) setTimeout(() => b.remove(), 12e3);
}
function recapReady() {
  if (window.__tv) return;
  const G = Object.values(L.games || {}), k = `st-recap-${L.id}-${L.week}`;
  if (document.getElementById("recap-ready")) return;
  if (bubbleUp()) {
    setTimeout(recapReady, 6e3);
    return;
  }
  if (!G.length || G.some((s) => s !== "complete") || store(k) || game && game.scene.isActive("minigame")) return;
  store(k, "1");
  const b = el(
    "div",
    { id: "recap-ready", style: "position:fixed;left:50%;bottom:calc(108px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;width:min(320px,calc(100vw - 32px));background:#1d140c;color:#fff4d6;border:2px solid #ffd84a;border-radius:12px;padding:10px 12px;font:14px system-ui,sans-serif;box-shadow:0 6px 18px #0008" },
    el("b", {}, `\u{1F4F8} Week ${L.week} is final.`),
    " Your recap card is ready for the group chat. ",
    el("button", { type: "button", class: "rr-go", style: "margin-left:4px;border:0;background:#ffd84a;border-radius:6px;font-weight:700;padding:3px 9px" }, "Make it"),
    el("button", { type: "button", class: "rr-x", "aria-label": "Close", style: "margin-left:4px;border:0;background:none;color:#fff4d6;font-size:16px" }, "\xD7")
  );
  b.querySelector(".rr-go").onclick = () => {
    b.remove();
    recap();
  };
  b.querySelector(".rr-x").onclick = () => b.remove();
  b.setAttribute("role", "status");
  document.body.appendChild(b);
  if (!window.__calm) setTimeout(() => b.remove(), 15e3);
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") for (const id of ["recap-ready", "drill-tease"]) {
    const n = document.getElementById(id);
    if (n) n.remove();
  }
});
function awardsList() {
  const pct = (t) => {
    const g = t.wins + t.losses + t.ties;
    return g ? (t.wins + t.ties / 2) / g : 0.5;
  };
  const pairs = Object.values(L.teams.reduce((m, t) => {
    if (t.matchup_id) (m[t.matchup_id] = m[t.matchup_id] || []).push(t);
    return m;
  }, {})).filter((p) => p.length === 2 && p[0].points > 0 && p[1].points > 0);
  const live = pairs.flat();
  const scored = L.teams.filter((t) => t.points > 0);
  if (!scored.length) return [];
  const top = [...scored].sort((a, b) => b.points - a.points)[0], low = live.length ? [...live].sort((a, b) => a.points - b.points)[0] : null;
  const gap = (p) => Math.abs(p[0].points - p[1].points), byGap = [...pairs].sort((a, b) => gap(b) - gap(a));
  const over = (t) => (t.starters || []).every((pid) => {
    const st = (L.games || {})[L.players[pid] ? L.players[pid][2] : pid];
    return !pid || pid === "0" || !st || st === "complete";
  }) && Object.keys(L.games || {}).length;
  const lead = (p) => p[0].points >= p[1].points ? p : [p[1], p[0]], decided = pairs.filter((p) => gap(p) > 0.05 && over(p[0]) && over(p[1])).map(lead);
  const all2 = Object.values(L.teams.reduce((m, t) => {
    if (t.matchup_id) (m[t.matchup_id] = m[t.matchup_id] || []).push(t);
    return m;
  }, {})).filter((p) => p.length === 2);
  const ass = [...all2].sort((a, b) => pct(a[0]) + pct(a[1]) - (pct(b[0]) + pct(b[1])) || a[0].fpts + a[1].fpts - (b[0].fpts + b[1].fpts))[0];
  const bench = (t) => Object.entries(t.players_points || {}).filter(([pid]) => !(t.starters || []).includes(pid)).reduce((n, [, v]) => n + (v || 0), 0);
  const shame = [...scored].sort((a, b) => bench(b) - bench(a))[0];
  let mvp = null;
  for (const t of scored) (t.starters || []).forEach((pid, i) => {
    const v = (t.starters_points || [])[i] || 0;
    if (pid && pid !== "0" && (!mvp || v > mvp.v)) mvp = { pid, v, t };
  });
  const unlucky = [...decided].sort((a, b) => b[1].points - a[1].points)[0], lucky = [...decided].sort((a, b) => a[0].points - b[0].points)[0];
  const blow = byGap[0], close = byGap[byGap.length - 1];
  return [
    ["\u{1F525} Top score", top.name, fmt(top.points)],
    mvp && mvp.v > 0 ? ["\u2B50 MVP", `${pname(mvp.pid)} (${mvp.t.name})`, fmt(mvp.v)] : null,
    blow ? ["\u{1F4A5} Biggest blowout", `${lead(blow)[0].name} over ${lead(blow)[1].name}`, `by ${fmt(gap(blow))}`] : null,
    close && close !== blow ? ["\u{1F62C} Closest game", `${lead(close)[0].name} over ${lead(close)[1].name}`, `by ${fmt(gap(close))}`] : null,
    unlucky ? ["\u{1F494} Unluckiest", unlucky[1].name, `lost \xB7 ${fmt(unlucky[1].points)}`] : null,
    lucky && !(blow && lucky.includes(lead(blow)[0])) ? ["\u{1F340} Luckiest win", lucky[0].name, `won \xB7 ${fmt(lucky[0].points)}`] : null,
    ass && (ass[0].points || ass[1].points) ? ["\u{1F6BD} ASS Bowl", `${lead(ass)[0].name} vs ${lead(ass)[1].name}`, `${fmt(lead(ass)[0].points)} \u2013 ${fmt(lead(ass)[1].points)}`] : null,
    ["\u{1FA91} Bench of shame", shame.name, `${fmt(bench(shame))} on the bench`],
    low ? ["\u{1F327}\uFE0F Lowest score", low.name, fmt(low.points)] : null
  ].filter(Boolean);
}
function passPerks() {
  const q2 = new URLSearchParams(location.search), P = window.__pass || {};
  const blimp = q2.get("blimp") || P.blimp || "", looks = (q2.get("looks") || P.looks || "").split(",").filter((x) => /^\d+\./.test(x));
  const gold = (q2.get("gold") || P.gold || "").split(",").map(Number).filter(Boolean), byId = (rid) => (L.teams.find((t) => t.roster_id === rid) || {}).name;
  const row = (icon, what, now) => el("tr", {}, el("td", { style: "font-size:20px;padding:6px 4px;vertical-align:top" }, icon), el("td", { style: "padding:6px 4px" }, el("b", {}, what), el("div", { style: "font-size:13px;color:#5a4a33" }, now)));
  openPanel(`\u2605 ${L.name} \xB7 League Pass`, async () => [
    el("table", {}, [
      row("\u{1F6E0}\uFE0F", "You ask, I build", "Your requests first, one built every week"),
      row("\u{1F602}", "Your league's inside jokes on the field", "Tanking, trade addict, Canc\xFAn, yours"),
      row("\u{1F388}", "Blimp text, football mascots, golden jersey for the commish", [blimp ? `Blimp: "${blimp}"` : "Blimp: reply to your League Pass email", looks.length ? `${looks.length} team${looks.length > 1 ? "s" : ""} dressed up` : null, gold.length ? `Gold: ${gold.map(byId).filter(Boolean).join(", ")}` : null].filter(Boolean).join(" \xB7 ")),
      row("\u{1F6AB}", "No tip asks on your league, ever", "Your league never sees a tip or beer ask"),
      row("\u{1F504}", "Every update all season, the day it ships", "New features land on your link automatically"),
      el("tr", {}, el("td", { style: "font-size:20px;padding:6px 4px;vertical-align:top" }, "\u{1F52D}"), el("td", { style: "padding:6px 4px" }, el("b", {}, "See what's coming: "), el("a", { href: "https://lamaisonwebstudio.com/stadium/make/#ideas", target: "_blank", rel: "noopener", style: "color:#7a4b00;font-weight:700" }, "ideas list")))
    ]),
    (() => {
      const b = el("button", { type: "button", class: "mu-share" }, "\u{1F517} Send it to your league chat");
      b.onclick = () => {
        closePanel();
        $("share-btn") && $("share-btn").click();
      };
      return b;
    })(),
    el("p", { style: "font-size:13px;color:#5a4a33" }, "Everyone with this link sees the same stadium. Want a change? Reply to your League Pass email.")
  ]);
}
window.__passPerks = passPerks;
window.__playoffOdds = playoffOdds;
function awards() {
  const list = awardsList(), final = Object.values(L.games || {}).length && Object.values(L.games).every((s) => s === "complete");
  openPanel(`\u{1F3C5} Week ${L.week} awards${final ? "" : " (so far)"}`, async () => [
    list.length ? el("div", { class: "aw-list" }, list.map(([k, who, n]) => el(
      "div",
      { class: "aw-row" },
      el("div", { class: "aw-top" }, el("b", {}, k), el("span", { class: "aw-n" }, n)),
      el("div", { class: "aw-who" }, who)
    ))) : el("p", {}, "No points yet this week. Awards show up once the games start."),
    list.length ? (() => {
      const b = el("button", { type: "button", class: "mu-share" }, "\u{1F4F8} Share as a picture");
      b.onclick = () => recap();
      return b;
    })() : null,
    el("p", { class: "small" }, final ? "Final for the week." : "Live: they change as the games go.")
  ]);
}
function recap() {
  if (!awardsList().length) return;
  const W = 1080, H = 1350, cv = el("canvas", { width: W, height: H }), c = cv.getContext("2d"), font = 'system-ui, "Segoe UI", Arial, sans-serif';
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2e1f8f");
  g.addColorStop(1, "#0b0a1a");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.textAlign = "center";
  c.fillStyle = "#c9a227";
  c.font = `bold 34px ${font}`;
  c.fillText(`${L.name}`.toUpperCase().slice(0, 34), W / 2, 110);
  c.fillStyle = "#ffd84a";
  c.font = `900 96px ${font}`;
  const fin = Object.values(L.games || {}).length && Object.values(L.games).every((x) => x === "complete");
  c.fillText(`WEEK ${L.week} AWARDS`, W / 2, 220);
  if (!fin) {
    c.fillStyle = "#9dff7a";
    c.font = `bold 34px ${font}`;
    c.fillText("SO FAR \xB7 GAMES STILL ON", W / 2, 262);
  }
  const all = awardsList(), roast = ["\u{1F6BD}", "\u{1FA91}", "\u{1F494}"], rows = [...all.filter((r) => roast.some((e) => r[0].startsWith(e))), ...all.filter((r) => !roast.some((e) => r[0].startsWith(e)))].slice(0, 8);
  const RH = Math.min(112, Math.floor(880 / Math.max(1, rows.length)));
  rows.forEach(([k, who, n], i) => {
    const y = 290 + i * RH;
    c.fillStyle = "rgba(255,255,255,0.08)";
    c.beginPath();
    c.roundRect(70, y, W - 140, RH - 14, 20);
    c.fill();
    c.textAlign = "left";
    c.fillStyle = "#c9a227";
    c.font = `bold 26px ${font}`;
    c.fillText(k, 110, y + 36);
    c.font = `bold 36px ${font}`;
    const room = W - 220 - c.measureText(n).width - 40;
    c.textAlign = "right";
    c.fillStyle = "#9dff7a";
    c.fillText(n, W - 110, y + 80);
    c.textAlign = "left";
    c.fillStyle = "#fff4d6";
    c.font = `bold 40px ${font}`;
    let w = who;
    while (c.measureText(`${w}\u2026`).width > room && w.length > 4) w = w.slice(0, -1);
    c.fillText(w === who ? w : `${w.trim()}\u2026`, 110, y + 80);
  });
  c.textAlign = "center";
  c.fillStyle = "#c9a227";
  c.font = `bold 30px ${font}`;
  c.fillText("\u25B6 WATCH IT LIVE", W / 2, H - 120);
  c.fillStyle = "#e8e2ff";
  c.font = `bold 44px ${font}`;
  c.fillText(location.host, W / 2, H - 62);
  sharePicture(cv, `week-${L.week}-awards.png`, `${L.name} week ${L.week} awards \u{1F3C5}`);
}
function whoAreYou() {
  openPanel("\u{1F44B} Who are you?", async () => [
    el("p", {}, "Pick your team: you'll walk the field as your own player, with your matchup on top."),
    el("div", { class: "who" }, [...L.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => {
      const b = el("button", { type: "button", class: "who-btn" }, el("b", {}, t.name), el("span", {}, t.owner));
      b.onclick = () => {
        setMine(t.roster_id);
        closePanel();
      };
      return b;
    })),
    typeof askLeague === "function" ? (() => {
      const b = el("button", { type: "button", class: "st-wide st-ghost" }, "Not in this league? Open yours");
      b.onclick = () => {
        location.href = `${location.pathname}?new=1`;
      };
      return b;
    })() : null
  ]);
}
function setMine(rid) {
  store(`st-me-${L.id}`, String(rid));
  if (!/[?&]sample=1/.test(location.search)) store("st-league-id", String(L.id));
  for (const t of L.teams) t.mine = t.roster_id === rid;
  hud();
  if (game) game.scene.getScene("stadium").scene.restart({ league: L });
  if (shareAfterPick) {
    shareAfterPick = false;
    setTimeout(shareMine, 700);
  }
  if (playAfterPick && Date.now() - playAfterPick < 6e4) setTimeout(playWhenReady, 600);
  playAfterPick = 0;
}
const SCHEDULE = "https://api.sleeper.com/schedule/nfl/regular";
function gamesOf(games, week) {
  const map = {};
  for (const g of games || []) if (String(g.week) === String(week)) {
    map[g.home] = g.status;
    map[g.away] = g.status;
  }
  return map;
}
function datesOf(games, week) {
  const map = {};
  for (const g of games || []) if (String(g.week) === String(week) && g.date) {
    map[g.home] = g.date;
    map[g.away] = g.date;
  }
  return map;
}
async function gameStatus() {
  try {
    const s = await get(`${SCHEDULE}/${L.season}`);
    L.games = gamesOf(s, L.week);
    L.gameDates = datesOf(s, L.week);
  } catch {
  }
}
const koSeen = {}, seenPre = new Set();
function leftShare(team) {
  if (/[?&]sample=1/.test(location.search)) return 0.5;
  const k = `st-ko-${L.id}-${L.season}-${L.week}`;
  if (!koSeen[k]) {
    try {
      koSeen[k] = JSON.parse(store(k) || "{}");
    } catch {
      koSeen[k] = {};
    }
  }
  const m = koSeen[k];
  if (!m[team]) {
    m[team] = Date.now() - (seenPre.has(team) ? 0 : 1.5 * 36e5);
    try {
      store(k, JSON.stringify(m));
    } catch {
    }
  }
  return Math.max(0.05, 1 - (Date.now() - m[team]) / (3 * 36e5));
}
function liveProj(t) {
  const G = L.games || {};
  return (t.starters || []).reduce((n, pid, i) => {
    const pre = L.proj[pid] || 0, got = (t.starters_points || [])[i] || 0;
    const team = L.players[pid] ? L.players[pid][2] : pid, st = G[team];
    if (st === "pre_game") seenPre.add(team);
    if (st === "complete") return n + got;
    if (st === "in_game") return n + got + Math.max(0, pre - got) * leftShare(team);
    return n + (got || pre);
  }, 0);
}
function updateProj() {
  for (const t of L.teams) t.proj = liveProj(t);
}
let refreshN = 0;
async function refreshPoints() {
  if (!L || document.hidden && !window.__tv) return;
  const n = ++refreshN;
  try {
    const full = L.espn && (!L.lineupCounts || n % 10 === 0);
    const r = L.espn ? await (full ? espnLeague(L.id, L.season) : espnLive(L.id, L.season, L.lineupCounts)) : null, fresh = r ? r.teams : await get(`${API}/league/${L.id}/matchups/${L.week}`);
    if (r && r.lineupCounts) L.lineupCounts = r.lineupCounts;
    if (n !== refreshN) return;
    if (r) {
      if (full) Object.assign(L.players, r.players);
      else for (const [k, v] of Object.entries(r.players)) if (!L.players[k]) L.players[k] = v;
      Object.assign(L.proj, r.proj);
    }
    for (const x of fresh) {
      const t = L.teams.find((y) => y.roster_id === x.roster_id);
      if (t) Object.assign(t, { starters: x.starters || t.starters, points: x.points || 0, starters_points: x.starters_points || [], players_points: x.players_points || {} });
      if (t && r) t.projPre = t.starters.reduce((s2, pid) => s2 + (L.proj[pid] || 0), 0);
    }
    await gameStatus();
    updateProj();
    if (r && full) injBaseline();
    const s = game && game.scene.getScene("stadium");
    if (s && s.refreshScores) s.refreshScores();
    hud();
    if (Object.values(L.games || {}).includes("in_game")) fetchInjuries(false);
  } catch {
  }
}
function count(what) {
  const site = { "savilar7-coder.github.io": "demo", "stadium.lamaisonwebstudio.com": "demo" }[location.hostname];
  if (!site) return;
  beacon(`${site}-${what}`);
}
function beacon(k) {
  if (!/^(dynasty-stadium\.pages\.dev|savilar7-coder\.github\.io|stadium\.lamaisonwebstudio\.com)$/.test(location.hostname)) return;
  const day = (new Date()).toISOString().slice(0, 10);
  try {
    if (store(`ev-${k}`) === day) return;
    store(`ev-${k}`, day);
    navigator.sendBeacon(`https://philosophers-trail.pages.dev/e?k=${k}`);
  } catch {
  }
}
async function countLeague(id) {
  if (window.__pass && /^P\d{1,3}$/.test(window.__pass.code)) beacon(`lg-${window.__pass.code.toLowerCase()}`);
  try {
    if (String(id) === DYNASTY) beacon("lg-mine");
  } catch {
  }
  try {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`stadium:${id}`)));
    const h = [...d.slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
    beacon(`lgd-${h}`);
  } catch {
  }
}
function askLeague(note) {
  for (const id of ["jump-btn", "zoom-ctl", "play-btn", "st-fold", "gh-star"]) {
    const e = document.getElementById(id);
    if (e) e.style.display = "none";
  }
  $("st-league").textContent = "Sleeper Stadium";
  $("st-score").textContent = "Your fantasy league as a live pixel football stadium";
  const btns = document.querySelector(".st-btns");
  if (btns) btns.style.display = "none";
  const hudL = document.getElementById("st-hud");
  if (hudL) {
    hudL.style.maxHeight = "calc(100vh - 16px)";
    hudL.style.maxHeight = "calc(100svh - 16px)";
    hudL.style.overflowY = "auto";
    hudL.style.touchAction = "pan-y";
    hudL.style.overscrollBehavior = "contain";
    hudL.style.webkitOverflowScrolling = "touch";
  }
  const fr = document.createElement("style");
  fr.textContent = ".lg-in:focus-visible,.lg-in+button:focus-visible{outline:3px solid #24292f;outline-offset:2px}";
  document.head.appendChild(fr);
  const box = document.createElement("form");
  box.style.cssText = "display:flex;gap:6px;justify-content:center;margin-top:6px";
  box.innerHTML = '<input id="lg-id" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Sleeper @username" enterkeyhint="go" class="lg-in" aria-label="Sleeper username, league ID, Sleeper or ESPN league link" style="font:16px sans-serif;padding:8px 10px;width:min(260px,58vw);border:2px solid #9e7c0c;border-radius:8px;background:#fff"><button type="submit" style="font:700 16px sans-serif;padding:8px 16px;background:#24292f;color:#fff;border:0;border-radius:8px;cursor:pointer">Open</button>';
  const msg = document.createElement("div");
  msg.style.cssText = "margin:6px auto 0;font:14px system-ui,sans-serif;color:#5a4a33;max-width:340px;text-align:center";
  const trust = document.createElement("div");
  trust.style.cssText = "margin:6px auto 0;font:13px system-ui,sans-serif;color:#7a6a50;text-align:center";
  trust.innerHTML = '<b style="font-size:14px;color:#5a4a33">Sleeper @username or a public ESPN league link</b><br><span style="color:#5a4a33">Reads the same public data your leaguemates see \xB7 no login \xB7 free &amp; open source \xB7 not affiliated with Sleeper</span>';
  const go = (id) => {
    try {
      sessionStorage.setItem("st-own", "1");
    } catch (x) {
    }
    location.search = `?league=${id}`;
  };
  box.onsubmit = async (e) => {
    e.preventDefault();
    const raw = (document.getElementById("lg-id").value || "").trim().replace(/^@/, "");
    if (raw && !/^\d+$/.test(raw) && !/[\/.]/.test(raw)) store("st-user-name", raw);
    if (!raw) {
      msg.textContent = "Type your Sleeper username (the @name on your profile) or a league ID.";
      return;
    }
    const espn = raw.match(/espn\.com\/.*leagueId=(\d+)/i) || raw.match(/^espn[\s:-]*(\d+)$/i);
    if (espn) {
      go(`espn-${espn[1]}`);
      return;
    }
    const link = raw.match(/leagues\/(\d+)/);
    if (link || /^\d+$/.test(raw)) {
      go(link ? link[1] : raw);
      return;
    }
    msg.textContent = "Looking up your leagues\u2026";
    try {
      const u = await get(`${API}/user/${encodeURIComponent(raw)}`);
      if (!u || !u.user_id) {
        msg.textContent = `No Sleeper user "${raw}". It's the @name on your Sleeper profile.`;
        return;
      }
      store("st-user-id", u.user_id);
      const st = await get(`${API}/state/nfl`);
      const lgs = await get(`${API}/user/${u.user_id}/leagues/nfl/${st.league_season || st.season}`) || [];
      if (!lgs.length) {
        msg.textContent = `${u.display_name || raw} has no leagues this season.`;
        return;
      }
      if (lgs.length === 1) {
        go(lgs[0].league_id);
        return;
      }
      msg.replaceChildren(Object.assign(document.createElement("div"), { textContent: "Pick your league:" }), ...lgs.map((l) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = l.name;
        b.onclick = () => go(l.league_id);
        b.style.cssText = "display:block;width:100%;margin:6px 0 0;font:600 15px sans-serif;padding:8px 10px;background:#fff8e6;border:1px solid #9e7c0c;border-radius:8px;text-align:left";
        return b;
      }));
    } catch (err) {
      msg.textContent = "Could not reach Sleeper. Try again in a minute.";
    }
  };
  const demo = document.createElement("button");
  demo.type = "button";
  demo.textContent = "No league? Try a sample league";
  demo.style.cssText = "display:block;margin:8px auto 0;font:600 14px sans-serif;padding:6px 12px;background:none;color:#5a4a33;border:1px dashed #9e7c0c;border-radius:8px;cursor:pointer";
  demo.onclick = () => {
    location.search = "?league=1&sample=1";
  };
  const look = document.createElement("img");
  look.src = "stadium.gif";
  look.alt = "A live league on the field";
  look.width = 300;
  look.height = 420;
  look.style.cssText = "display:block;margin:4px auto 0;width:min(440px,88vw,calc((100vh - 340px) * 300 / 420));width:min(440px,80vw,calc((100svh - 330px) * 300 / 420));height:auto;border-radius:12px;border:2px solid #9e7c0c;image-rendering:pixelated;cursor:pointer";
  look.title = "Open the sample league";
  look.onclick = demo.onclick;
  const tap = document.createElement("div");
  tap.style.cssText = "margin:12px auto 0;font:600 13px system-ui,sans-serif;color:#7a4b00;text-align:center;cursor:pointer";
  tap.innerHTML = "Live scores, touchdown alerts, win odds, the ASS Bowl, and play your matchup as a 2-minute mini game<br><u>No league? Tap the stadium for a sample</u>";
  tap.style.fontWeight = "400";
  tap.onclick = () => demo.onclick();
  const star = document.createElement("a");
  star.href = "https://github.com/savilar7-coder/sleeper-stadium";
  star.target = "_blank";
  star.rel = "noopener";
  star.style.cssText = "display:block;width:max-content;margin:10px auto 0;padding:7px 14px;border-radius:10px;background:#24292f;color:#fff;text-decoration:none;font:700 14px system-ui,sans-serif";
  star.textContent = "\u2B50 Star it on GitHub \xB7 free & open source";
  const by = document.createElement("p");
  by.style.cssText = "margin:8px auto 0;font:13px system-ui,sans-serif;color:#5a4a33;max-width:320px;text-align:center";
  by.innerHTML = 'Built by <a style="color:#7a4b00" href="https://lamaisonwebstudio.com/" target="_blank" rel="noopener">lamaisonwebstudio.com</a>. Podcast, Discord or business? <a style="color:#7a4b00" href="https://lamaisonwebstudio.com/stadium/#custom" target="_blank" rel="noopener">Let&#39;s build yours.</a>';
  if (note) {
    msg.textContent = note;
    msg.style.color = "#b23a2a";
    msg.style.fontWeight = "600";
  }
  $("st-proj").replaceChildren(box, trust, msg, tap, look, star, by);
  try {
    const last = store("st-user-name");
    if (last && !note) document.getElementById("lg-id").value = last;
  } catch (x) {
  }
}
(async function main() {
  {
    const day = (new Date()).toISOString().slice(0, 10), before = store("ev-demo-open"), first = store("st-first-day") || (before && before < day ? before : day);
    store("st-first-day", first);
    if (first < day) count("back");
  }
  count("open");
  const fontReady = Promise.race([document.fonts.load('13px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 2500))]);
  fontReady.catch(() => {
  });
  let own = "";
  try {
    own = sessionStorage.getItem("st-own") || "";
  } catch (x) {
  }
  const rawId = q.get("league") || (q.get("new") ? "" : store("st-league-id")) || "", leagueId = /^espn-\d+$/.test(rawId) ? rawId : rawId.replace(/[^0-9]/g, "");
  if (!leagueId) {
    askLeague();
    return;
  }
  if (!q.get("sample") && (own || store("st-me-" + leagueId) || !q.get("league"))) store("st-league-id", leagueId);
  try {
    L = await load(leagueId);
  } catch (err) {
    try {
      localStorage.removeItem("st-league-id");
    } catch (x) {
    }
    askLeague(err.message === "private" ? "That ESPN league is private. The commissioner can open it: ESPN League Settings > Basic Settings > Make league viewable to public." : /ESPN/.test(err.message) ? "No ESPN league with that ID. Paste the link from your ESPN league page." : /^404/.test(err.message) || err instanceof TypeError ? "No Sleeper league with that ID. Check it, or type your Sleeper username." : `Could not reach Sleeper (${err.message}). Try again in a minute.`);
    return;
  }
  injBaseline();
  count("league");
  if (L.espn) count("espn");
  countLeague(L.id);
  let saved = Number(store(`st-me-${L.id}`));
  const me = !saved && store("st-user-id") && L.teams.find((t) => t.owner_id === store("st-user-id"));
  if (me) {
    saved = me.roster_id;
    store(`st-me-${L.id}`, String(saved));
  }
  for (const t of L.teams) t.mine = t.roster_id === saved;
  rememberLeague();
  leagueSwitcher();
  try {
    await fontReady;
  } catch {
  }
  updateProj();
  hud();
  setTimeout(recapReady, 4e3);
  setTimeout(() => weekDigest().catch(() => {
  }), 2500);
  if (location.hash === "#drill") {
    history.replaceState(null, "", location.pathname + location.search);
    if (mine()) setTimeout(playWhenReady, 600);
    else {
      playAfterPick = Date.now();
      whoAreYou();
    }
  } else setTimeout(drillTeaser, 3e4);
  game = new Phaser.Game({
    type: (navigator.maxTouchPoints || 0) > 0 ? Phaser.AUTO : Phaser.CANVAS,
    parent: "game",
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#20262e",
    scale: { mode: Phaser.Scale.NONE, width: Math.round(window.innerWidth * DPR), height: Math.round(window.innerHeight * DPR), zoom: 1 / DPR },
    physics: { default: "arcade", arcade: { debug: false } },
    audio: { noAudio: true }
  });
  const [{ StadiumScene }, { MiniGameScene }] = await scenes;
  game.scene.add("stadium", StadiumScene, true, { league: L });
  game.scene.add("minigame", MiniGameScene, false);
  window.__village = game;
  window.__league = L;
  window.__hud = hud;
  if (/[?&]debug=1/.test(location.search)) {
    const box = el("pre", { id: "st-debug", style: "position:fixed;left:4px;bottom:120px;z-index:99;margin:0;padding:6px 8px;max-width:calc(100vw - 8px);background:rgba(0,0,0,.8);color:#9ef59e;font:11px/1.35 ui-monospace,Menlo,monospace;border-radius:6px;pointer-events:none;white-space:pre-wrap" });
    document.body.appendChild(box);
    const r = (n) => Math.round(n);
    setInterval(() => {
      const sc = game.scene.getScene("stadium"), cam = sc && sc.cameras && sc.cameras.main, vv = window.visualViewport, hb = $("st-hud").getBoundingClientRect();
      const cr = game.canvas.getBoundingClientRect(), k = cr.height / game.scale.height, mt = sc && sc.teamSprites && [...sc.teamSprites.values()].find((x) => x.t.mine);
      const css = (y) => cam ? r(cr.top + (y - cam.worldView.y) * cam.zoom * k) : "-";
      box.textContent = [
        `build round 71 \xB7 ${document.lastModified}`,
        `inner ${innerWidth}x${innerHeight} \xB7 dpr ${devicePixelRatio}`,
        `visualVp ${vv ? `${r(vv.width)}x${r(vv.height)} top ${r(vv.offsetTop)}` : "none"} \xB7 standalone ${!!(navigator.standalone || matchMedia("(display-mode: standalone)").matches)}`,
        `canvas css ${r(cr.width)}x${r(cr.height)} top ${r(cr.top)} \xB7 px ${game.scale.width}x${game.scale.height}`,
        `renderer ${game.renderer.type === Phaser.WEBGL ? "WEBGL" : "CANVAS"} \xB7 cam y ${cam ? r(cam.scrollY) : "-"} zoom ${cam ? cam.zoom.toFixed(2) : "-"}`,
        `header bottom ${r(hb.bottom)} \xB7 my tag top ${mt ? css(mt.tag.getBounds().top) : "no team"} \xB7 walker ${sc && sc.player && sc.player.visible ? `yes y ${css(sc.player.y)}` : "no"}`,
        `ua ${navigator.userAgent.slice(0, 90)}`
      ].join("\n");
    }, 1e3);
  }
  if (window.ResizeObserver) new ResizeObserver(() => {
    const s = game.scene.getScene("stadium");
    if (s && s.cameras && s.cameras.main && s.applyZoom && s.logicalZoom && s.sys.isActive()) s.applyZoom(s.logicalZoom());
  }).observe($("st-hud"));
  const fit = () => {
    game.scale.resize(Math.round(window.innerWidth * DPR), Math.round(window.innerHeight * DPR));
    game.scale.setZoom(1 / DPR);
  };
  window.addEventListener("resize", fit);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", fit);
  const scene = () => game.scene.getScene("stadium");
  $("zoom-in").addEventListener("click", () => {
    const s = scene();
    if (s) s.setZoom(s.logicalZoom() * 1.25);
  });
  $("zoom-out").addEventListener("click", () => {
    const s = scene();
    if (s) s.setZoom(s.logicalZoom() / 1.25);
  });
  $("jump-btn").textContent = "\u2694\uFE0F Matchup";
  $("jump-btn").hidden = false;
  $("jump-btn").addEventListener("click", () => {
    const m = mine();
    if (m) matchup(m.roster_id);
    else whoAreYou();
  });
  $("share-btn").hidden = false;
  $("share-btn").addEventListener("click", shareMine);
  if (!/[?&]sample=1/.test(location.search)) $("inj-btn").hidden = false;
  $("inj-btn").addEventListener("click", injuriesBox);
  injBadge();
  window.__injBadge = injBadge;
  $("st-table").addEventListener("click", standings);
  $("st-news").addEventListener("click", news);
  $("st-recap").addEventListener("click", awards);
  $("st-recap").textContent = "\u{1F3C5} Awards";
  $("st-trade").addEventListener("click", () => tradeMaker(null));
  const fold = (on) => {
    $("st-hud").classList.toggle("mini", on);
    $("st-fold").textContent = on ? "\u25BE" : "\u25B4";
    store("st-fold", on ? "1" : "0");
  };
  fold(store("st-fold") === "1" || store("st-fold") == null && window.innerWidth < 520 && !!mine());
  $("st-fold").addEventListener("click", () => fold(!$("st-hud").classList.contains("mini")));
  $("st-mine").addEventListener("click", () => {
    const m = mine();
    if (m) teamPanel(m.roster_id);
    else whoAreYou();
  });
  if (!mine() && !navigator.webdriver) setTimeout(() => {
    if ($("panel").hidden && !playAfterPick && !mine()) whoAreYou();
  }, 600);
  setInterval(refreshPoints, 6e4);
  setTimeout(() => fetchInjuries(true), 2500);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshPoints();
  });
  if (window.__tv) {
    document.body.appendChild(el("div", { id: "tv-cap" }, el("b", {}, "\u{1F3DF}\uFE0F A live pixel stadium for YOUR fantasy league"), el("span", {}, "Free \xB7 Sleeper or ESPN \xB7 stadium.lamaisonwebstudio.com")));
    let k = -1;
    const tour = () => {
      const s = game.scene.getScene("stadium");
      if (!s || !s.sys.isActive() || !s.boards || !s.boards.length) return;
      k++;
      let i = k % s.boards.length;
      if (k % 2 === 1) s.highlight();
      if (k % 3 === 0) {
        const close = s.boards.map((B, j) => ({ j, d: Math.abs(B.a.points - B.b.points), on: B.a.points || B.b.points })).filter((x) => x.on).sort((a, b) => a.d - b.d)[0];
        if (close) i = close.j;
      }
      s.focusBoard(i);
    };
    setTimeout(tour, /[?&]sample=1/.test(location.search) ? 9e3 : 2500);
    setInterval(tour, 12e3);
  }
  window.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
  $("play-btn").addEventListener("click", playGame);
  $("mg-exit").addEventListener("click", exitGame);
  $("mg-again").addEventListener("click", playGame);
  window.__stadium = { teamPanel, standings, news, tradeMaker, whoAreYou, setMine, matchup, playGame, exitGame, lookPicker, injuriesBox };
})();
