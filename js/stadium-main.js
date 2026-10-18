import { $, DPR } from "./core.js";
import { closePanel, el, openPanel } from "./panel.js";
import { sfx } from "./sfx.js";
import { LOOKS, StadiumScene } from "./stadium-scene.js";
import { MiniGameScene } from "./minigame-scene.js";
const API = "https://api.sleeper.app/v1";
const POS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const get = async (url) => {
  const r = await fetch(url, { cache: "no-store" });
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
async function load(leagueId) {
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
  const [users, rosters, matchups, picks, tx1, tx2, players, proj, champs, picked, blimpFile] = await Promise.all([
    get(`${API}/league/${leagueId}/users`),
    get(`${API}/league/${leagueId}/rosters`),
    get(`${API}/league/${leagueId}/matchups/${week}`),
    get(`${API}/league/${leagueId}/traded_picks`).catch(() => []),
    get(`${API}/league/${leagueId}/transactions/${week}`).catch(() => []),
    get(`${API}/league/${leagueId}/transactions/${Math.max(1, week - 1)}`).catch(() => []),
    get("sleeper-players.json").catch(() => get("/api/sleeper/players")).catch(() => ({})),
    weekProjections(season, week),
    champions(lg),
    get("stadium-avatars.json").catch(() => ({})),
    get("stadium-blimp.json").catch(() => null)
  ]);
  const byUser = Object.fromEntries(users.map((u) => [u.user_id, u]));
  const byRoster = Object.fromEntries(matchups.map((m) => [m.roster_id, m]));
  const teams = rosters.map((r) => {
    const u = byUser[r.owner_id] || {}, m = byRoster[r.roster_id] || {}, s = r.settings || {};
    return {
      roster_id: r.roster_id,
      owner_id: r.owner_id,
      owner: u.display_name || "open slot",
      name: u.metadata && u.metadata.team_name || u.display_name || `Team ${r.roster_id}`,
      wins: s.wins || 0,
      losses: s.losses || 0,
      ties: s.ties || 0,
      fpts: (s.fpts || 0) + (s.fpts_decimal || 0) / 100,
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
  const local = JSON.parse(store("st-looks") || "{}");
  for (const t of teams) t.look = local[t.roster_id] || picked[t.roster_id] || guessLook(t);
  const groups = {};
  for (const t of teams) (groups[t.matchup_id || `bye-${t.roster_id}`] = groups[t.matchup_id || `bye-${t.roster_id}`] || []).push(t);
  const slots = (lg.roster_positions || []).filter((p) => !["BN", "TAXI", "IR"].includes(p));
  return {
    id: leagueId,
    name: lg.name,
    season,
    week,
    slots,
    rounds: lg.settings && lg.settings.draft_rounds || 3,
    teams,
    pairs: Object.values(groups),
    players,
    proj,
    picks,
    news: [...tx1, ...tx2].filter((x) => x.status === "complete").sort((a, b) => b.status_updated - a.status_updated),
    champs,
    blimp: (blimpFile || {}).message || ""
  };
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
function hud() {
  const m = mine(), opp = m && L.teams.find((t) => t.matchup_id && t.matchup_id === m.matchup_id && t !== m);
  $("st-league").textContent = `${L.name} \xB7 week ${L.week}`;
  $("st-score").textContent = m ? `\u{1F451} ${m.name} ${fmt(m.points)}${opp ? `  \u2013  ${fmt(opp.points)} ${opp.name}` : ""}` : 'Tap "Who are you?" to pick your team';
  $("st-score").className = m && opp ? m.points >= opp.points ? "up" : "down" : "";
  $("st-proj").textContent = m && opp ? `projected ${fmt(m.proj)} \u2013 ${fmt(opp.proj)}` : "";
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
function teamPanel(rid) {
  const t = L.teams.find((x) => x.roster_id === rid);
  const bench = t.players.filter((p) => !t.starters.includes(p) && !t.taxi.includes(p) && !t.reserve.includes(p));
  const pk = picksOf(rid);
  openPanel(`${t.mine ? "\u{1F451} " : ""}${t.name}`, async () => [
    t.mine ? el("button", { type: "button", class: "st-wide st-ghost st-who" }, "\u{1F64B} Not you? Pick your team") : null,
    el("p", { class: "small" }, `${t.owner} \xB7 ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""} \xB7 ${fmt(t.fpts)} PF \xB7 week ${L.week}: ${fmt(t.points)} (proj ${fmt(t.proj)})`),
    el("h3", {}, "Starters"),
    rosterTable(t.starters, t, true),
    bench.length ? [el("h3", {}, "Bench"), rosterTable(bench, t, false)] : null,
    t.taxi.length ? [el("h3", {}, "Taxi squad"), rosterTable(t.taxi, t, false)] : null,
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
  const src = p && p[1] === "DEF" ? `https://sleepercdn.com/images/team_logos/nfl/${String(pid).toLowerCase()}.png` : `https://sleepercdn.com/content/nfl/players/thumb/${pid}.jpg`;
  const img = el("img", { class: "mu-face", src, alt: "", loading: "lazy" });
  img.onerror = () => {
    img.style.visibility = "hidden";
  };
  return img;
};
function matchup(rid) {
  const me = L.teams.find((t) => t.roster_id === rid) || mine() || L.teams[0];
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
      el("div", { class: "mu-who" }, el("b", {}, p[0]), el("small", {}, `${p[2] || ""}${proj != null ? ` \xB7 proj ${fmt(proj)}` : ""}`)),
      el("div", { class: "mu-pts" }, pts == null ? "\u2013" : fmt(pts))
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
    el("div", { class: "mu-rows" }, rows),
    el("p", { class: "small" }, `Week ${L.week} \xB7 points refresh every minute during games \xB7 projections from Sleeper (half PPR).`)
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
  const m = NAME_LOOKS.find(([re]) => re.test(t.name));
  return m ? m[1] : LOOKS[t.roster_id * 7 % LOOKS.length];
}
const ALL_LOOKS = [
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
      const b = el("button", { type: "button", class: `look${look === t.look ? " on" : ""}`, title: look }, el("span", { class: "look-face", style: `background-image:url(assets/chars/${look}.png)` }));
      b.onclick = async () => {
        t.look = look;
        let shared = false;
        try {
          const r = await fetch("/api/stadium/avatars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [rid]: look }) });
          shared = r.ok;
        } catch {
        }
        if (!shared) {
          const mine2 = JSON.parse(store("st-looks") || "{}");
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
  for (const id of ["st-hud", "zoom-ctl", "jump-btn", "play-btn", "prompt"]) $(id).style.display = "none";
  game.scene.sleep("stadium");
  if (game.scene.getScene("minigame")) game.scene.stop("minigame");
  game.scene.start("minigame", { me, opp, league: L });
}
function exitGame() {
  game.scene.stop("minigame");
  $("mg-hud").hidden = true;
  for (const id of ["st-hud", "zoom-ctl", "jump-btn", "play-btn"]) $(id).style.display = "";
  game.scene.wake("stadium");
}
function standings() {
  const rows = [...L.teams].sort((a, b) => b.wins - a.wins || b.fpts - a.fpts);
  const power = [...L.teams].sort((a, b) => b.fpts - a.fpts).map((t) => t.roster_id);
  openPanel(`\u{1F3C6} ${L.name}`, async () => [
    el(
      "table",
      {},
      el("tr", {}, el("th", {}, "#"), el("th", {}, "Team"), el("th", {}, "W-L"), el("th", { class: "num" }, "PF"), el("th", { class: "num" }, "Power")),
      rows.map((t, i) => el(
        "tr",
        t.mine ? { class: "mine" } : {},
        el("td", {}, String(i + 1)),
        el("td", {}, `${t.mine ? "\u{1F451} " : ""}${t.name}`),
        el("td", {}, `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`),
        el("td", { class: "num" }, fmt(t.fpts)),
        el("td", { class: "num" }, `#${power.indexOf(t.roster_id) + 1}`)
      ))
    ),
    el("p", { class: "small" }, "Power = rank by points scored this season. Top 6 make the playoffs (from week 15)."),
    L.champs.length ? [el("h3", {}, "Champions"), el("div", { class: "chips" }, L.champs.map((c) => el("span", { class: "chip gold" }, `\u{1F3C6} ${c.season}: ${c.team}`)))] : null
  ]);
}
function news() {
  const name = (rid) => (L.teams.find((t) => t.roster_id === rid) || {}).name || `Team ${rid}`;
  const rows = L.news.slice(0, 40).map((x) => {
    const adds = Object.entries(x.adds || {}), drops = Object.entries(x.drops || {});
    if (x.type === "trade") {
      const parts = (x.roster_ids || []).map((rid) => {
        const got = adds.filter(([, r]) => r === rid).map(([pid]) => pname(pid));
        const gotPicks = (x.draft_picks || []).filter((pk) => pk.owner_id === rid).map((pk) => `${pk.season} R${pk.round}`);
        return `${name(rid)} gets ${[...got, ...gotPicks].join(", ") || "nothing"}`;
      });
      return el("div", { class: "need publish" }, el("b", {}, "\u{1F91D} Trade"), el("span", {}, parts.join(" \xB7 ")));
    }
    const who = name((x.roster_ids || [])[0]);
    const what = [...adds.map(([pid]) => `+ ${pname(pid)}`), ...drops.map(([pid]) => `\u2212 ${pname(pid)}`)].join("  ");
    return el("div", { class: "need" }, el("b", {}, `${x.type === "waiver" ? "\u{1F4CB} Waiver" : "\u{1F193} Free agent"} \xB7 ${who}`), el("span", {}, what));
  });
  openPanel("\u{1F4F0} League news", async () => [
    rows.length ? el("div", { class: "needs" }, rows) : el("div", { class: "empty" }, "Quiet week."),
    el("p", { class: "small" }, `Weeks ${Math.max(1, L.week - 1)}\u2013${L.week}.`)
  ]);
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
      el("p", { class: "small" }, "Values are a rough guide: this season's projection (half PPR) adjusted for age, picks by round and year. Not advice. Send real offers in the Sleeper app.")
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
    }))
  ]);
}
function setMine(rid) {
  store(`st-me-${L.id}`, String(rid));
  for (const t of L.teams) t.mine = t.roster_id === rid;
  hud();
  if (game) game.scene.getScene("stadium").scene.restart({ league: L });
}
async function gameStatus() {
  try {
    const games = await get(`https://api.sleeper.com/schedule/nfl/regular/${L.season}`), map = {};
    for (const g of games || []) if (String(g.week) === String(L.week)) {
      map[g.home] = g.status;
      map[g.away] = g.status;
    }
    L.games = map;
  } catch {
  }
}
function liveProj(t) {
  const G = L.games || {};
  return (t.starters || []).reduce((n, pid, i) => {
    const pre = L.proj[pid] || 0, got = (t.starters_points || [])[i] || 0;
    const team = L.players[pid] ? L.players[pid][2] : pid, st = G[team];
    if (st === "complete") return n + got;
    if (st === "in_game") return n + got + Math.max(0, pre - got) * 0.5;
    return n + (got || pre);
  }, 0);
}
function updateProj() {
  for (const t of L.teams) t.proj = liveProj(t);
}
async function refreshPoints() {
  if (!L || document.hidden) return;
  try {
    for (const x of await get(`${API}/league/${L.id}/matchups/${L.week}`)) {
      const t = L.teams.find((y) => y.roster_id === x.roster_id);
      if (t) Object.assign(t, { points: x.points || 0, starters_points: x.starters_points || [], players_points: x.players_points || {} });
    }
    await gameStatus();
    updateProj();
    const s = game && game.scene.getScene("stadium");
    if (s && s.refreshScores) s.refreshScores();
    hud();
  } catch {
  }
}
function askLeague() {
  for (const id of ["jump-btn", "zoom-ctl", "play-btn"]) {
    const e = document.getElementById(id);
    if (e) e.style.display = "none";
  }
  $("st-league").textContent = "Sleeper Stadium";
  $("st-score").textContent = "Paste your Sleeper league ID to open your stadium";
  const box = document.createElement("form");
  box.style.cssText = "display:flex;gap:6px;justify-content:center;margin-top:6px";
  box.innerHTML = '<input id="lg-id" inputmode="numeric" placeholder="League ID" style="font:16px sans-serif;padding:6px 8px;width:220px"><button type="submit" style="font:16px sans-serif;padding:6px 12px">Open</button>';
  box.onsubmit = (e) => {
    e.preventDefault();
    const v = (document.getElementById("lg-id").value || "").replace(/[^0-9]/g, "");
    if (v) location.search = `?league=${v}`;
  };
  $("st-proj").replaceChildren(box);
}
(async function main() {
  const leagueId = (q.get("league") || store("st-league-id") || "").replace(/[^0-9]/g, "");
  if (!leagueId) {
    askLeague();
    return;
  }
  store("st-league-id", leagueId);
  try {
    L = await load(leagueId);
  } catch (err) {
    $("st-league").textContent = `Could not load the league from Sleeper (${err.message}). Try again in a minute.`;
    return;
  }
  const saved = Number(store(`st-me-${L.id}`));
  for (const t of L.teams) t.mine = t.roster_id === saved;
  try {
    await Promise.race([document.fonts.load('13px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
  }
  await gameStatus();
  updateProj();
  hud();
  game = new Phaser.Game({
    type: (navigator.maxTouchPoints || 0) > 0 ? Phaser.AUTO : Phaser.CANVAS,
    parent: "game",
    pixelArt: true,
    roundPixels: true,
    backgroundColor: "#20262e",
    scale: { mode: Phaser.Scale.NONE, width: Math.round(window.innerWidth * DPR), height: Math.round(window.innerHeight * DPR), zoom: 1 / DPR },
    physics: { default: "arcade", arcade: { debug: false } }
  });
  game.scene.add("stadium", StadiumScene, true, { league: L });
  game.scene.add("minigame", MiniGameScene, false);
  window.__village = game;
  window.__league = L;
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
  $("st-table").addEventListener("click", standings);
  $("st-news").addEventListener("click", news);
  $("st-trade").addEventListener("click", () => tradeMaker(null));
  const fold = (on) => {
    $("st-hud").classList.toggle("mini", on);
    $("st-fold").textContent = on ? "\u25BE" : "\u25B4";
    store("st-fold", on ? "1" : "0");
  };
  fold(store("st-fold") === "1");
  $("st-fold").addEventListener("click", () => fold(!$("st-hud").classList.contains("mini")));
  $("st-mine").addEventListener("click", () => {
    const m = mine();
    if (m) teamPanel(m.roster_id);
    else whoAreYou();
  });
  if (!mine() && !navigator.webdriver) setTimeout(whoAreYou, 600);
  setInterval(refreshPoints, 6e4);
  window.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
  $("play-btn").addEventListener("click", playGame);
  $("mg-exit").addEventListener("click", exitGame);
  $("mg-again").addEventListener("click", playGame);
  window.__stadium = { teamPanel, standings, news, tradeMaker, whoAreYou, setMine, matchup, playGame, exitGame, lookPicker };
})();
