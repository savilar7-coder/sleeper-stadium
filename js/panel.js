import { $, panelOpen, setPanelOpen } from "./core.js";
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null) e.append(k instanceof Node ? k : String(k));
  return e;
}
let closing = null;
function openPanel(title, build, wide = false) {
  clearTimeout(closing);
  $("panel").classList.remove("closing");
  setPanelOpen(true);
  $("panel").classList.toggle("wide", wide);
  $("panel-title").textContent = title;
  const body = $("panel-body");
  body.replaceChildren(el("div", { class: "empty" }, "Loading\u2026"));
  $("panel").hidden = false;
  build().then((nodes) => body.replaceChildren(...[nodes].flat(Infinity).filter((n) => n != null))).catch((err) => body.replaceChildren(el("div", { class: "empty" }, `Could not load: ${err.message}`)));
}
function closePanel() {
  setPanelOpen(false);
  const p = $("panel");
  if (p.hidden) return;
  if (window.__calm) {
    p.hidden = true;
    return;
  }
  p.classList.add("closing");
  clearTimeout(closing);
  closing = setTimeout(() => {
    p.hidden = true;
    p.classList.remove("closing");
  }, 170);
}
$("panel-close").addEventListener("click", closePanel);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && panelOpen) closePanel();
});
export {
  closePanel,
  el,
  openPanel
};
