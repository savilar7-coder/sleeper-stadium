const sfx = (() => {
  let ctx = null, muted = false;
  try {
    muted = localStorage.getItem("pv-muted") === "1";
  } catch {
  }
  const ac = () => {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) ctx = new C();
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  const note = (freq, at, dur, type = "triangle", vol = 0.1) => {
    const c = ac();
    if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const noise = (at, dur, vol = 0.06) => {
    const c = ac();
    if (!c || muted) return;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1400;
    g.gain.value = vol;
    src.buffer = b;
    src.connect(f).connect(g).connect(c.destination);
    src.start(c.currentTime + at);
  };
  return {
    unlock: () => ac(),
    context: () => ac(),
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem("pv-muted", muted ? "1" : "0");
      } catch {
      }
      return muted;
    },
    chime() {
      note(784, 0, 0.25);
      note(1175, 0.12, 0.45);
    },
    jump() {
      note(392, 0, 0.09, "square", 0.035);
      note(587, 0.05, 0.12, "square", 0.03);
    },
    ding() {
      note(1568, 0, 0.7, "sine", 0.12);
      note(2093, 0.06, 0.6, "sine", 0.06);
    },
    mail() {
      note(523, 0, 0.1, "square", 0.035);
      note(659, 0.08, 0.12, "square", 0.035);
    },
    door() {
      note(196, 0, 0.1, "square", 0.03);
      note(147, 0.07, 0.14, "square", 0.03);
    },
    pop() {
      noise(0, 0.3, 0.07);
    },
    hit() {
      noise(0, 0.07, 0.12);
      note(180, 0, 0.06, "square", 0.05);
    },
    cheer() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.08, 0.4, "triangle", 0.08));
    }
  };
})();
window.addEventListener("pointerdown", () => sfx.unlock(), { passive: true });
window.addEventListener("keydown", () => sfx.unlock());
window.addEventListener("touchend", () => sfx.unlock(), { passive: true });
export {
  sfx
};
