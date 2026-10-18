import { $, DPR, panelOpen } from "./core.js";
const pageZoomed = () => window.visualViewport && window.visualViewport.scale > 1.02;
document.addEventListener("gesturestart", (e) => {
  if (!pageZoomed()) e.preventDefault();
});
document.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener("touchmove", (e) => {
  if (!pageZoomed() && (e.touches.length > 1 || e.scale && e.scale !== 1)) e.preventDefault();
}, { passive: false });
function unzoomPage() {
  const vv = window.visualViewport;
  if (!vv || vv.scale <= 1.01) return;
  const meta = document.querySelector("meta[name=viewport]");
  const good = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
  meta.setAttribute("content", "width=device-width, initial-scale=1.0001, maximum-scale=1.0001, user-scalable=no");
  setTimeout(() => meta.setAttribute("content", good), 60);
}
unzoomPage();
function zoomHint() {
  const zoomed = pageZoomed();
  const h = document.getElementById("zoom-hint");
  if (h) h.hidden = !zoomed;
  document.documentElement.classList.toggle("page-zoomed", zoomed);
  const g = window.__village;
  if (g && g.input && g.input.touch) g.input.touch.capture = !zoomed;
  if (g && g.scale) g.scale.refresh();
}
setTimeout(() => {
  if (!pageZoomed()) return;
  let last = 0;
  try {
    last = Number(sessionStorage.getItem("pv-unzoom") || 0);
  } catch {
  }
  if (Date.now() - last < 2e4) return;
  try {
    sessionStorage.setItem("pv-unzoom", String(Date.now()));
  } catch {
  }
  const u = new URL(location.href);
  u.searchParams.set("fit", String(Date.now() % 1e5));
  location.replace(u.toString());
}, 700);
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => {
  setTimeout(unzoomPage, 300);
  setTimeout(zoomHint, 350);
});
setTimeout(zoomHint, 1500);
function setupTouch(scene, onTap) {
  scene.input.addPointer(1);
  const stick = $("stick"), knob = $("stick-knob");
  const st = { id: null, x0: 0, y0: 0, t0: 0, active: false, vx: 0, vy: 0, pinch: null };
  scene.stick = st;
  const downs = () => scene.input.manager.pointers.filter((p) => p.isDown);
  const reset = () => {
    st.id = null;
    st.active = false;
    st.vx = 0;
    st.vy = 0;
    stick.hidden = true;
    knob.style.transform = "";
  };
  scene.input.on("pointerdown", (p) => {
    if (panelOpen) return;
    const d = downs();
    if (d.length >= 2) {
      reset();
      st.pinch = { d: Phaser.Math.Distance.Between(d[0].x, d[0].y, d[1].x, d[1].y) || 1, z: scene.logicalZoom ? scene.logicalZoom() : scene.cameras.main.zoom };
      return;
    }
    if (scene.aimCapture && scene.aimCapture(p)) return;
    st.id = p.id;
    st.x0 = p.x / DPR;
    st.y0 = p.y / DPR;
    st.t0 = scene.time.now;
    st.active = false;
  });
  scene.input.on("pointermove", (p) => {
    if (st.pinch) {
      const d = downs();
      if (d.length >= 2) scene.setZoom(st.pinch.z * Phaser.Math.Distance.Between(d[0].x, d[0].y, d[1].x, d[1].y) / st.pinch.d);
      return;
    }
    if (p.id !== st.id || !p.isDown) return;
    const dx = p.x / DPR - st.x0, dy = p.y / DPR - st.y0, dist = Math.hypot(dx, dy);
    if (!st.active && dist > 12) {
      st.active = true;
      scene.target = null;
      scene.route = null;
      stick.style.left = `${st.x0}px`;
      stick.style.top = `${st.y0}px`;
      stick.hidden = false;
    }
    if (st.active) {
      const m = Math.min(dist, 44), ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
      st.vx = ux * m / 44;
      st.vy = uy * m / 44;
      knob.style.transform = `translate(${ux * m}px, ${uy * m}px)`;
    }
  });
  scene.input.on("pointerup", (p) => {
    if (st.pinch) {
      if (downs().length < 2) st.pinch = null;
      return;
    }
    if (p.id !== st.id) return;
    const title = document.getElementById("title");
    if (!st.active && scene.time.now - st.t0 < 350 && !panelOpen && !(title && !title.hidden)) onTap(scene.cameras.main.getWorldPoint(p.x, p.y));
    reset();
  });
  scene.input.on("wheel", (p, objs, dx, dy) => scene.setZoom((scene.logicalZoom ? scene.logicalZoom() : scene.cameras.main.zoom) * (dy > 0 ? 0.9 : 1.1)));
  const cancel = () => {
    st.pinch = null;
    reset();
  };
  window.addEventListener("touchcancel", cancel);
  window.addEventListener("blur", cancel);
  document.addEventListener("visibilitychange", cancel);
  scene.events.once("shutdown", () => {
    window.removeEventListener("touchcancel", cancel);
    window.removeEventListener("blur", cancel);
    document.removeEventListener("visibilitychange", cancel);
  });
  scene.events.on("sleep", reset);
  scene.events.once("shutdown", () => {
    reset();
    scene.events.off("sleep", reset);
  });
}
function drivePlayer(scene, vx, vy, max, delta) {
  const m = Math.min(1, Math.hypot(vx, vy)), len = Math.hypot(vx, vy) || 1;
  const wx = vx / len * m * max, wy = vy / len * m * max;
  const v = scene.vel || (scene.vel = { x: 0, y: 0 });
  const k = Math.min(1, delta / 1e3 * (m ? 9 : 14));
  v.x += (wx - v.x) * k;
  v.y += (wy - v.y) * k;
  if (!m && Math.hypot(v.x, v.y) < 8) {
    v.x = 0;
    v.y = 0;
  }
  scene.player.setVelocity(v.x, v.y);
  const speed = Math.hypot(v.x, v.y);
  const G = scene.gait || (scene.gait = { age: 0, moving: false, stopAge: 999, shown: scene.facing, turnLeft: 0 });
  const moving = speed > 10;
  if (moving && !G.moving) {
    G.age = 0;
    scene.walkTimer = 115;
  }
  if (!moving && G.moving) G.stopAge = 0;
  G.moving = moving;
  G.age += delta;
  G.stopAge += delta;
  if (moving) {
    if (m) scene.facing = Math.abs(vx) >= Math.abs(vy) ? vx < 0 ? "left" : "right" : vy < 0 ? "up" : "down";
    scene.walkTimer = (scene.walkTimer || 0) + delta * Math.min(1.15, Math.max(0.45, speed / max));
  } else scene.walkTimer = 0;
  const OPP = { left: "right", right: "left", up: "down", down: "up" };
  if (G.shown !== scene.facing) {
    if (OPP[G.shown] === scene.facing && !window.__calm && moving) {
      G.turnLeft = 70;
      G.via = G.shown === "left" || G.shown === "right" ? "down" : "right";
    }
    G.shown = scene.facing;
  }
  if (G.turnLeft > 0) G.turnLeft -= delta;
  const face = G.turnLeft > 0 ? G.via : scene.facing;
  scene.player.setTexture(moving ? `player${face}${Math.floor(scene.walkTimer / 115) % 4}` : `player${face}0`);
  scene.player.setDepth(scene.player.y);
}
export {
  drivePlayer,
  setupTouch
};
