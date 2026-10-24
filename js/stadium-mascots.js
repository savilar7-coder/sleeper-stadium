const E = "#141018";
const HEADS = {
  Bear: [
    { B: "#8a5a34", b: "#5e3b20", m: "#d9b48a", n: E, e: E },
    [".BB......BB.", ".BmBBBBBBmB.", "..BBBBBBBB..", "..BeBBBBeB..", "..BBmmmmBB..", "..BbmnnmbB..", "...BmmmmB...", "....BBBB...."]
  ],
  Eagle: [
    { W: "#f4f1ea", w: "#cfcac0", y: "#f2b51b", Y: "#c98a10", e: E, B: "#5e3b20" },
    ["...WWWWWW...", "..WWWWWWWW..", ".wWeWWWWeWw.", ".wWWyyyyWWw.", "..WWyYYyWW..", "..BWWyyWWB..", "..BBWYYWBB..", "...BBBBBB..."]
  ],
  Tiger: [
    { O: "#f07a1a", S: E, w: "#f4f1ea", p: "#e58a9a", e: "#2a8a2a" },
    [".OO......OO.", ".OpOSOOSOpO.", "..OOSOOSOO..", ".SOeOOOOeOS.", "..OwwOOwwO..", ".SOwwppwwOS.", "..OOwwwwOO..", "....OOOO...."]
  ],
  Shark: [
    { G: "#7f97a8", g: "#5d7385", w: "#f4f1ea", r: "#a3202e", e: E },
    [".....GG.....", "....GGGG....", "..GGGGGGGG..", ".GeGGGGGGeG.", ".GGGGGGGGGG.", ".GrwrwrwrwG.", ".GwwwwwwwwG.", "..GgggggggG."]
  ],
  Bull: [
    { B: "#6b3a1e", h: "#f4f1ea", m: "#c98d68", n: E, r: "#d4af37", e: E },
    ["hh........hh", ".hhBBBBBBhh.", "..BBBBBBBB..", "..BeBBBBeB..", "..BBBBBBBB..", "..BmmmmmmB..", "..BmnmmnmB..", "...BmrrmB..."]
  ],
  Wolf: [
    { G: "#8c8f98", d: "#5a5d66", w: "#e6e6ea", n: E, e: "#f2c230" },
    [".G........G.", ".GG......GG.", ".GdGGGGGGdG.", ".GGeGGGGeGG.", "..GGwwwwGG..", "..GwwnnwwG..", "...GwwwwG...", "....GGGG...."]
  ],
  Ram: [
    { C: "#e8dcc0", h: "#a07a4a", H: "#7a5530", m: "#c9b89a", e: E, n: "#7a5530" },
    ["hhh......hhh", "hHhCCCCCChHh", "hh.CCCCCC.hh", ".hhCeCCeChh.", "...CCCCCC...", "...CmmmmC...", "...CmnnmC...", "....CmmC...."]
  ],
  Gator: [
    { G: "#3f8a3a", g: "#2a6328", w: "#f4f1ea", e: "#f2c230", n: E, p: "#c94a4a" },
    ["..ggg..ggg..", "..GeG..GeG..", "..GGGGGGGG..", "...GGGGGG...", "...GnGGnG...", "...wGwGwG...", "...pppppp...", "...GwGwGw..."]
  ],
  Panther: [
    { P: "#26222e", p: "#3d3848", e: "#7ad65a", n: "#e58a9a", w: "#cfcac0" },
    [".PP......PP.", ".PnP....PnP.", "..PPPPPPPP..", "..PePPPPeP..", "..PPPPPPPP..", "..PpwnnwpP..", "...PpwwpP...", "....PPPP...."]
  ],
  Lion: [
    { Y: "#e2a73a", M: "#a3521c", m: "#c9752a", w: "#f4e3b0", n: "#5a3418", e: E },
    ["..MMMMMMMM..", ".MMmMMMMmMM.", "MMYYYYYYYYMM", "MMYeYYYYeYMM", "MmYYwwwwYYmM", ".MYYwnnwYYM.", ".MMYwwwwYMM.", "..MMMMMMMM.."]
  ],
  Duck: [
    { G: "#1f7a3a", g: "#2fa04e", y: "#f2b51b", Y: "#c98a10", e: E, w: "#f4f1ea" },
    ["....GGGG....", "...GgGGGG...", "..GGGGGGGG..", "..GweGGewG..", "..GGGGGGGG..", "..yyyyyyyy..", "...YYYYYY...", "....GGGG...."]
  ],
  Bronco: [
    { B: "#8a4a22", b: "#5a2e14", k: "k", w: "#f4f1ea", n: E, e: E },
    ["..b.kkkk.b..", "..BbkkkkbB..", "..BBBkkBBB..", "..BeBwwBeB..", "...BBwwBB...", "...BBwwBB...", "...BnBBnB...", "....BBBB...."]
  ],
  Raven: [
    { R: "#2a2433", r: "#4a3f5c", y: "#f2b51b", e: "#ff4040" },
    ["....RR.R....", "...RRRRR....", "..RRRRRRRR..", "..RrRRRRrR..", "..ReRRRReR..", "..RRRyyRRR..", "...RRyyRR...", "....RyyR...."]
  ],
  Goat: [
    { C: "#f4f1ea", w: "#cfcac0", h: "#8a8a8a", e: "#c98a10", p: "#e58a9a", b: "#cfcac0" },
    [".h........h.", "..h......h..", "CC.CCCCCC.CC", ".CCeCCCCeCC.", "...CCCCCC...", "...CCppCC...", "....CwwC....", ".....bb....."]
  ],
  Ghost: [
    { W: "#eef2f7", w: "#c7cfdb", E },
    ["....WWWW....", "...WWWWWW...", "..WWWWWWWW..", "..WEEWWEEW..", "..WEEWWEEW..", "..WWWEEWWW..", "..WWWEEWWW..", "..WwWwWwWw.."]
  ],
  "Hot Dog": [
    { B: "#e0a050", r: "#c8452f", y: "#f2d21b", e: E, w: "#f4f1ea" },
    ["...rrrrrr...", ".BBrrrrrrBB.", ".BByryryrBB.", ".BBrerrerBB.", ".BBrrrrrrBB.", ".BBrrwwrrBB.", "..BBrrrrBB..", "...BBBBBB..."]
  ],
  Pirate: [
    { S: "#c98d68", k: "k", g: "g", P: E, B: "#3b2414", e: E },
    ["...kkkkkk...", "..kkgkkkkk..", ".kkkkkkkkkkg", "..SPPSSeSS..", "..SPPSSSSS..", "..SSSSSSSS..", "..BBSBBSBB..", "...BBBBBB..."]
  ],
  Viking: [
    { S: "#e0a77a", M: "#9aa1aa", m: "#6e747c", h: "#f4f1ea", R: "#c25a1c", e: E },
    ["h..........h", "h..MMMMMM..h", ".hMMmMMmMMh.", "..MMMMMMMM..", "..SeSSSSeS..", "..RSSSSSSR..", "..RRRSSRRR..", "...RRRRRR..."]
  ],
  Cowboy: [
    { S: "#c98d68", H: "#7a4a24", h: "#5a3418", g: "g", e: E, m: "#3b2414" },
    ["....HHHH....", "...HHHHHH...", "...gggggg...", "HHHHHHHHHHHH", "...SeSSeS...", "...SSSSSS...", "...SmmmmS...", "....SSSS...."]
  ],
  Robot: [
    { M: "#aab2bc", m: "#6e7884", r: "#ff3b3b", L: "#4fd8ff", k: "k" },
    [".....r......", ".....m......", "..MMMMMMMM..", ".mMLLMMLLMm.", ".mMLLMMLLMm.", "..MMMMMMMM..", "..MmkmkmkM..", "..mmmmmmmm.."]
  ],
  Skeleton: [
    { W: "#f4f1ea", w: "#cfcac0", E },
    ["...WWWWWW...", "..WWWWWWWW..", "..WEEWWEEW..", "..WEEWWEEW..", "..WWWEEWWW..", "...WWWWWW...", "...wEwEwE...", "....wwww...."]
  ],
  Alien: [
    { A: "#7ad65a", a: "#4fa83a", E, l: "#c6f7a8" },
    ["l..........l", ".a........a.", "..AAAAAAAA..", ".AEEAAAAEEA.", ".AEEEAAEEEA.", "..AAAAAAAA..", "...AAaaAA...", "....AAAA...."]
  ],
  Clown: [
    { S: "#f4f1ea", r: "#e3262e", b: "#2e7de0", y: "#f2c230", e: E },
    [".yy......bb.", "yyy.SSSS.bbb", ".y.SSSSSS.b.", "...SebbeS...", "...SSrrSS...", "...rSrrSr...", "....rrrr....", ".....SS....."]
  ]
};
const MASCOT_NAMES = Object.keys(HEADS);
const MASCOT_LOOKS = MASCOT_NAMES.map((n) => "M" + n.replace(/ /g, ""));
const byLook = Object.fromEntries(MASCOT_NAMES.map((n) => ["M" + n.replace(/ /g, ""), n]));
const isMascot = (look) => !!byLook[look];
const mascotName = (look) => byLook[look] || "";
const kitNum = (t) => {
  if (!t) return null;
  const m = /^FB(\d+)$/.exec(t.look || "");
  return m ? Number(m[1]) : isMascot(t.look) ? t.roster_id * 5 % 12 : null;
};
const mascotFur = (look) => Object.values(HEADS[byLook[look]][0])[0];
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255);
};
const shade = (hex, f) => "#" + [1, 3, 5].map((i) => {
  const v = parseInt(hex.slice(i, i + 2), 16), t = f > 0 ? 255 : 0;
  return Math.round(v + (t - v) * Math.abs(f)).toString(16).padStart(2, "0");
}).join("");
const BACK = { Pirate: "k", Viking: "M", Cowboy: "H", Clown: "y" };
const FLAT = ["Robot", "Ghost", "Skeleton", "Alien", "Clown", "Hot Dog", "Shark"];
function mascotHead(look, dir, H, HS) {
  const name = byLook[look], [pal, art] = HEADS[name], fur = Object.values(pal)[0];
  const rows = art.map((r) => [...r]), fk = Object.keys(pal)[0];
  rows.forEach((r, y) => r.forEach((ch, x) => {
    if (ch === "e" && art[y + 1] && art[y + 1][x] === fk && !(art[y - 1] && art[y - 1][x] === "e")) rows[y + 1][x] = "e";
  }));
  const col = (ch) => {
    const c = pal[ch];
    return c === "k" ? H : c === "g" ? HS : c;
  };
  const back = BACK[name] ? col(BACK[name]) : fur, furKey = Object.keys(pal)[0];
  const side = dir === "right" || dir === "left";
  const dark = lum(fur) < 60;
  let g = rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === ".") return null;
    if (dir === "up") return y >= 2 && !"hHkgMyr".includes(ch) ? back : col(ch);
    if (side && ch === "e" && x < 6) return pal[furKey];
    return col(ch);
  }));
  const snout = (y) => side && !FLAT.includes(name) && y >= 4 && y <= 6;
  if (side) g = g.map((rw, y) => snout(y) ? [null, null, ...rw.slice(0, 10)] : [null, ...rw.slice(0, 11)]);
  return g.map((rw, y) => rw.map((c, x) => {
    if (!c) return c;
    const up = y > 0 && g[y - 1][x], right = g[y][x + 1];
    if (y === 7 || y < 7 && !g[y + 1][x] && y >= 5) return shade(c, dark && c === fur ? 0.3 : -0.38);
    if (c === fur && !up) return shade(c, dark ? 0.5 : 0.28);
    if (dark && c === fur && (!g[y][x - 1] || !right)) return shade(c, 0.3);
    if (c === fur && !right && x > 5) return shade(c, -0.22);
    const ax = side ? x - (snout(y) ? 2 : 1) : x, ch = rows[y][ax];
    if (dir !== "up" && ch === "E" && rows[y][ax - 1] !== "E" && !(y > 0 && rows[y - 1][ax] === "E") && rows[y + 1] && rows[y + 1][ax] === "E") return "#ffffff";
    return c;
  }));
}
const faces = {};
function mascotFace(look) {
  if (faces[look]) return faces[look];
  const cv = document.createElement("canvas");
  cv.width = cv.height = 16;
  const c = cv.getContext("2d");
  mascotHead(look, "down", "#5a6270", "#c9a227").forEach((rw, y) => rw.forEach((col, x) => {
    if (col) {
      c.fillStyle = col;
      c.fillRect(2 + x, 4 + y, 1, 1);
    }
  }));
  return faces[look] = cv.toDataURL();
}
export {
  MASCOT_LOOKS,
  MASCOT_NAMES,
  isMascot,
  kitNum,
  mascotFace,
  mascotFur,
  mascotHead,
  mascotName
};
