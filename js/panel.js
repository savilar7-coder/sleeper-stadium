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
let opener = null;
function openPanel(title, build, wide = false) {
  if (!panelOpen) opener = document.activeElement;
  document.querySelectorAll(".st-toast").forEach((x) => x.remove());
  clearTimeout(closing);
  $("panel").classList.remove("closing");
  setPanelOpen(true);
  $("panel").classList.toggle("wide", wide);
  $("panel-title").textContent = title;
  const body = $("panel-body");
  body.replaceChildren(el("div", { class: "empty" }, "Loading\u2026"));
  $("panel").hidden = false;
  $("panel-close").focus({ preventScroll: true });
  build().then((nodes) => body.replaceChildren(...[nodes].flat(Infinity).filter((n) => n != null))).catch((err) => body.replaceChildren(el("div", { class: "empty" }, `Could not load: ${err.message}`)));
}
function closePanel() {
  setPanelOpen(false);
  const p = $("panel");
  if (p.hidden) return;
  if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  opener = null;
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
window.addEventListener("keydown", (e) => {
  if (e.key !== "Tab" || !panelOpen) return;
  const f = [...$("panel").querySelectorAll('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!$("panel").contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
    return;
  }
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
export {
  closePanel,
  el,
  openPanel
};
