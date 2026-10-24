const BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons";
const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DEF" };
const PRO = { 1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WAS", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU" };
const SLOT = { 0: "QB", 2: "RB", 3: "RB/WR", 4: "WR", 5: "WR/TE", 6: "TE", 7: "OP", 23: "FLEX", 16: "DEF", 17: "K" };
const ORDER = [0, 7, 2, 4, 3, 5, 6, 23, 16, 17];
const isEspn = (id) => /^espn-\d+$/.test(String(id));
async function espnLeague(id, season) {
  const n = String(id).replace(/^espn-/, "");
  const r = await fetch(`${BASE}/${season}/segments/0/leagues/${n}?view=mSettings&view=mTeam&view=mRoster&view=mMatchupScore&view=mStatus`, { cache: "no-store" });
  if (r.status === 401) throw new Error("private");
  if (!r.ok) throw new Error(`${r.status} ESPN`);
  const d = await r.json();
  const week = d.scoringPeriodId || (d.status || {}).latestScoringPeriod || 1, period = (d.status || {}).currentMatchupPeriod || week;
  const stat = (p, source, split, sp) => ((p.stats || []).find((s) => s.statSourceId === source && s.statSplitTypeId === split && s.scoringPeriodId === sp) || {}).appliedTotal;
  const members = Object.fromEntries((d.members || []).map((m) => [m.id, m]));
  const players = {}, proj = {};
  const games = (d.schedule || []).filter((m) => m.matchupPeriodId === period);
  const where = {};
  for (const m of games) for (const side of ["home", "away"]) if (m[side]) where[m[side].teamId] = { matchup_id: m.id, points: m[side].totalPointsLive ?? m[side].totalPoints ?? 0 };
  const teams = (d.teams || []).map((t) => {
    const entries = (t.roster || {}).entries || [], o = (t.record || {}).overall || {}, owner = members[t.primaryOwner || (t.owners || [])[0]] || {};
    const pts = {};
    for (const e of entries) {
      const p = (e.playerPoolEntry || {}).player || {}, pid = `e${e.playerId}`;
      players[pid] = [p.fullName || "Unknown", POS[p.defaultPositionId] || "", PRO[p.proTeamId] || "", null, stat(p, 1, 0, 0) || 0];
      proj[pid] = stat(p, 1, 1, week) || 0;
      pts[pid] = stat(p, 0, 1, week) || 0;
    }
    const starters = entries.filter((e) => e.lineupSlotId !== 20 && e.lineupSlotId !== 21).sort((a, b) => ORDER.indexOf(a.lineupSlotId) - ORDER.indexOf(b.lineupSlotId)).map((e) => `e${e.playerId}`);
    const w = where[t.id] || {};
    return {
      roster_id: t.id,
      owner_id: null,
      owner: owner.displayName || [owner.firstName, owner.lastName].filter(Boolean).join(" ") || "ESPN manager",
      name: t.name || [t.location, t.nickname].filter(Boolean).join(" ") || `Team ${t.id}`,
      wins: o.wins || 0,
      losses: o.losses || 0,
      ties: o.ties || 0,
      fpts: o.pointsFor || 0,
      fpts_against: o.pointsAgainst || 0,
      points: w.points || 0,
      matchup_id: w.matchup_id || null,
      starters,
      starters_points: starters.map((pid) => pts[pid] || 0),
      players: entries.map((e) => `e${e.playerId}`),
      players_points: pts,
      taxi: [],
      reserve: entries.filter((e) => e.lineupSlotId === 21).map((e) => `e${e.playerId}`),
      look: null,
      mine: false,
      proj: 0
    };
  });
  const counts = ((d.settings || {}).rosterSettings || {}).lineupSlotCounts || {};
  const slots = ORDER.flatMap((k) => Array(counts[k] || 0).fill(SLOT[k]));
  const past = {};
  for (const m of d.schedule || []) if (m.matchupPeriodId < period) {
    for (const side of ["home", "away"]) if (m[side]) (past[m.matchupPeriodId] = past[m.matchupPeriodId] || []).push({ roster_id: m[side].teamId, points: m[side].totalPoints || 0, matchup_id: m.id });
  }
  return { settings: {
    playoff_teams: ((d.settings || {}).scheduleSettings || {}).playoffTeamCount,
    playoff_week_start: (((d.settings || {}).scheduleSettings || {}).matchupPeriodCount || 14) + 1
    /* round 13 */
  }, name: (d.settings || {}).name || "ESPN League", season: String(d.seasonId || season), week, teams, players, proj, slots, past };
}
export {
  espnLeague,
  isEspn
};
