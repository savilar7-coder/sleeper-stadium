const TILE = 32;
const PLOT = 12;
const MARGIN = 16;
const POLL_MS = 5e3;
const SPEED = 240;
const DPR = Math.max(1, Math.min(window.__DPR_MAX || 2, Math.round((window.devicePixelRatio || 1) * 4) / 4));
const STATUS = {
  working: { color: 13666842, label: "working" },
  attention: { color: 12597547, label: "needs attention" },
  queued: { color: 3895222, label: "task queued" },
  idle: { color: 9079434, label: "idle" }
};
const $ = (id) => document.getElementById(id);
let latest = null;
let latestWeather = null;
async function loadWeather() {
  try {
    latestWeather = await (await fetch("/api/weather", { cache: "no-store" })).json();
  } catch {
  }
}
let panelOpen = false;
function hash(str) {
  let h = 2166136261;
  for (const c of str) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) % 1e4 / 1e4;
  };
}
function hueColor(name, sat, light) {
  return Phaser.Display.Color.HSLToColor(hash(name) % 360 / 360, sat, light).color;
}
const money = (n) => (Number(n) < 0 ? "\u2212$" : "$") + Math.abs(Number(n) || 0).toFixed(2);
let villageZoom = null;
function setLatest(v) {
  latest = v;
}
function setPanelOpen(v) {
  panelOpen = v;
}
function setVillageZoom(v) {
  villageZoom = v;
}
export {
  $,
  DPR,
  MARGIN,
  PLOT,
  POLL_MS,
  SPEED,
  STATUS,
  TILE,
  hash,
  hueColor,
  latest,
  latestWeather,
  loadWeather,
  money,
  panelOpen,
  rng,
  setLatest,
  setPanelOpen,
  setVillageZoom,
  villageZoom
};
