const TAU = Math.PI * 2,
  clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const EFFECTS = {
  horse: {
    name: "天马行空",
    sub: "踏墨而来 · 一跃千里",
    kind: "teleport",
    color: "#252d29",
    duration: 1700,
  },
  elephant: {
    name: "横扫千军",
    sub: "笔锋所至 · 千军尽退",
    kind: "slash",
    color: "#272c26",
    duration: 1700,
  },
  dash: {
    name: "火炮轰天",
    sub: "一声炮响 · 墨染山河",
    kind: "blast",
    color: "#9e332b",
    duration: 1950,
  },
  retreat: {
    name: "偷天换日",
    sub: "朱印一落 · 易旗换阵",
    kind: "seal",
    color: "#a0362b",
    duration: 1750,
  },
  swap: {
    name: "乾坤挪移",
    sub: "阴阳轮转 · 乾坤易位",
    kind: "vortex",
    color: "#283730",
    duration: 1800,
  },
  revive: {
    name: "起死回生",
    sub: "墨莲再绽 · 枯木逢春",
    kind: "lotus",
    color: "#455242",
    duration: 1900,
  },
};
// Native Canvas implementation: cached irregular ink stamps, short one-shot animation, no idle rendering.
export class InkEffects {
  constructor(canvas, title) {
    this.canvas = canvas;
    this.title = title;
    this.ctx = canvas.getContext("2d");
    this.active = null;
    this.raf = 0;
    this.stamps = [];
    for (let seed = 0; seed < 6; seed++) this.stamps.push(this.stamp(seed));
    this.resize = () => {
      this.cancel();
    };
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancel();
    });
  }
  stamp(seed) {
    const c = document.createElement("canvas");
    c.width = c.height = 160;
    const x = c.getContext("2d");
    let n = seed + 1;
    const rand = () => {
      n = (n * 1664525 + 1013904223) >>> 0;
      return n / 4294967296;
    };
    x.fillStyle = "#202723";
    x.beginPath();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU,
        r = 47 + rand() * 20;
      const px = 80 + Math.cos(a) * r,
        py = 80 + Math.sin(a) * r;
      if (!i) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    for (let i = 0; i < 95; i++) {
      x.globalAlpha = 0.14 + rand() * 0.35;
      x.beginPath();
      const a = rand() * TAU,
        r = 45 + rand() * 30;
      x.arc(80 + Math.cos(a) * r, 80 + Math.sin(a) * r, rand() * 5 + 1, 0, TAU);
      x.fill();
    }
    x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 35; i++) {
      x.globalAlpha = rand() * 0.25;
      x.beginPath();
      x.arc(rand() * 160, rand() * 160, rand() * 8 + 1, 0, TAU);
      x.fill();
    }
    return c;
  }
  cancel() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.hidden = true;
    this.canvas.classList.remove("active");
    this.title.classList.remove("active");
    document.body.classList.remove("ink-impact");
    if (this.ctx)
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const done = this.active?.done;
    this.active = null;
    done?.(false);
  }
  play(
    id,
    {
      source,
      target,
      side = "r",
      preview = false,
      sound = true,
      revivedPiece,
    } = {},
  ) {
    this.cancel();
    const spec = EFFECTS[id];
    if (!spec || !this.ctx || document.hidden) return Promise.resolve(false);
    const w = window.innerWidth,
      h = window.innerHeight,
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvas.hidden = false;
    this.canvas.classList.add("active");
    this.canvas.dataset.effect = id;
    this.title.replaceChildren();
    const tag = document.createElement("small"),
      name = document.createElement("strong"),
      sub = document.createElement("span");
    tag.textContent = preview
      ? "水墨特效预览"
      : (side === "r" ? "红方" : "黑方") + " · 奇谋施展";
    name.textContent = spec.name;
    sub.textContent = spec.sub;
    this.title.append(tag, name, sub);
    if (id === "revive" && revivedPiece) {
      const badge = document.createElement("span"),
        glyph = document.createElement("b"),
        label = document.createElement("em");
      badge.className = "revived-piece " + (side === "r" ? "red" : "black");
      glyph.textContent = revivedPiece;
      label.textContent = "复活棋子：" + revivedPiece;
      badge.append(glyph, label);
      this.title.append(badge);
    }
    this.title.className = "screen-skill-title active " + id;
    this.title.style.setProperty("--effect-color", spec.color);
    this.title.setAttribute(
      "aria-label",
      tag.textContent +
        " " +
        spec.name +
        (revivedPiece ? " 复活棋子 " + revivedPiece : ""),
    );
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && (id === "dash" || id === "elephant"))
      document.body.classList.add("ink-impact");
    if (sound) this.audio(spec.kind);
    const fit = (p) => ({
      x: Math.max(w * 0.08, Math.min(w * 0.92, p.x)),
      y: Math.max(h * 0.08, Math.min(h * 0.92, p.y)),
    });
    const origin = target ? fit(target) : { x: w * 0.5, y: h * 0.55 },
      start = source ? fit(source) : { x: w * 0.28, y: h * 0.65 };
    let seed = 1234 + id.length;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = w < 650 ? 75 : 135,
      particles = Array.from({ length: count }, (_, i) => ({
        angle: rand() * TAU,
        speed: 80 + rand() * Math.min(w, h) * 0.8,
        size: 3 + rand() * 15,
        delay: rand() * 0.12,
        stamp: i % 6,
      }));
    return new Promise((done) => {
      const began = performance.now();
      this.active = { done, id };
      const draw = (now) => {
        if (this.active?.id !== id) return;
        const duration = reduced ? 550 : spec.duration,
          t = clamp((now - began) / duration);
        this.frame(spec, t, w, h, origin, start, particles, reduced);
        if (t < 1) this.raf = requestAnimationFrame(draw);
        else {
          this.raf = 0;
          this.active = null;
          this.cancel();
          done(true);
        }
      };
      this.raf = requestAnimationFrame(draw);
    });
  }
  ink(x, y, size, alpha, stamp = 0, rotation = 0) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(alpha);
    c.translate(x, y);
    c.rotate(rotation);
    c.drawImage(this.stamps[stamp % 6], -size / 2, -size / 2, size, size);
    c.restore();
  }
  stroke(points, width, color, alpha) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = clamp(alpha);
    c.strokeStyle = color;
    c.lineCap = "round";
    c.lineJoin = "round";
    for (let layer = 0; layer < 7; layer++) {
      c.lineWidth = width * (1 - layer * 0.12);
      c.globalAlpha = clamp(alpha * (layer === 0 ? 0.2 : 0.17));
      c.beginPath();
      points.forEach(([x, y], i) => {
        const px = x + Math.sin(i * 2.3 + layer) * width * 0.08,
          py = y + Math.cos(i + layer) * width * 0.08;
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      });
      c.stroke();
    }
    c.restore();
  }
  ring(x, y, r, alpha, color = "#27392f", rotate = 0) {
    const pts = [];
    for (let i = 0; i <= 70; i++) {
      const a = (i / 70) * TAU + rotate,
        rr = r * (1 + 0.035 * Math.sin(i * 2.1));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    this.stroke(pts, Math.max(2, r * 0.045), color, alpha);
  }
  frame(spec, t, w, h, o, start, particles, reduced) {
    const c = this.ctx;
    c.clearRect(0, 0, w, h);
    const fade = Math.sin(Math.PI * t),
      out = 1 - ease((t - 0.62) / 0.38);
    c.fillStyle = "rgba(233,226,204," + fade * (reduced ? 0.08 : 0.21) + ")";
    c.fillRect(0, 0, w, h);
    if (reduced) {
      this.ring(o.x, o.y, 70, 0.4 * out, spec.color);
      return;
    }
    const spread = ease(t / 0.7),
      radius = Math.min(w, h) * 0.64;
    // Edge washes make the effect unmistakably cover the entire screen, without opaque white flashes.
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU + 0.2,
        x = w / 2 + Math.cos(a) * w * 0.56,
        y = h / 2 + Math.sin(a) * h * 0.58;
      this.ink(x, y, Math.max(w, h) * 0.48, fade * 0.1, j, j);
    }
    if (spec.kind === "blast") {
      this.ink(o.x, o.y, 130 + spread * radius * 2.6, 0.48 * out, 2, t * 0.2);
      this.ring(o.x, o.y, 30 + spread * radius, 0.8 * out, spec.color);
      this.ring(o.x, o.y, 10 + ease(t / 0.45) * radius * 0.72, 0.45 * out);
      for (const p of particles) {
        const q = clamp((t - p.delay) / 0.75),
          r = ease(q) * p.speed;
        this.ink(
          o.x + Math.cos(p.angle) * r,
          o.y + Math.sin(p.angle) * r,
          p.size * (1 + q * 2),
          out * 0.75,
          p.stamp,
          p.angle,
        );
      }
    } else if (spec.kind === "slash") {
      for (let k = 0; k < 3; k++) {
        const q = ease((t - k * 0.075) / 0.4),
          x1 = -w * 0.15,
          y1 = h * (0.7 - k * 0.15),
          x2 = w * 1.15,
          y2 = h * (0.1 + k * 0.1);
        this.stroke(
          [
            [x1, y1],
            [x1 + (x2 - x1) * q, y1 + (y2 - y1) * q],
          ],
          Math.min(w, h) * (0.09 - k * 0.013),
          k === 1 ? spec.color : "#26302a",
          out * 0.8,
        );
        for (let j = 0; j < 12; j++)
          this.ink(
            (w * j) / 11,
            h * (0.65 - j * 0.035),
            22 + j * 3,
            out * 0.5,
            j,
            j,
          );
      }
    } else if (spec.kind === "teleport") {
      const pts = Array.from({ length: 35 }, (_, i) => {
        const q = (i / 34) * ease(t / 0.5);
        return [
          start.x + (o.x - start.x) * q,
          start.y + (o.y - start.y) * q + Math.sin(q * Math.PI) * h * 0.16,
        ];
      });
      this.stroke(pts, 22, spec.color, out * 0.8);
      for (const point of [start, o]) {
        this.ring(
          point.x,
          point.y,
          35 + spread * 110,
          out * 0.8,
          spec.color,
          t * 4,
        );
        this.ink(point.x, point.y, 120 + spread * 80, out * 0.25, 1, t);
      }
    } else if (spec.kind === "vortex") {
      for (let k = 0; k < 3; k++) {
        const pts = Array.from({ length: 110 }, (_, j) => {
          const a = (j / 109) * TAU * 1.8 + t * 7 + (k * TAU) / 3,
            r = ((radius * j) / 109) * spread;
          return [o.x + Math.cos(a) * r, o.y + Math.sin(a) * r * 0.65];
        });
        this.stroke(pts, 13 + k * 4, spec.color, out * 0.55);
      }
      this.ring(o.x, o.y, radius * 0.65 * spread, out * 0.65);
    } else if (spec.kind === "seal") {
      this.ink(o.x, o.y, 140 + spread * 330, out * 0.28, 4, 0.2);
      c.save();
      c.translate(w * 0.5, h * 0.45);
      c.rotate(-0.1);
      const size = Math.min(w, h) * 0.34 * (0.7 + ease(t / 0.3) * 0.3);
      c.globalAlpha = out * 0.8;
      c.strokeStyle = spec.color;
      c.lineWidth = 8;
      c.strokeRect(-size / 2, -size / 2, size, size);
      c.lineWidth = 2;
      c.strokeRect(-size / 2 + 13, -size / 2 + 13, size - 26, size - 26);
      c.fillStyle = spec.color;
      c.font = "bold " + size * 0.68 + "px InkBrush, serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("易", 0, 4);
      c.restore();
      this.ring(o.x, o.y, 30 + spread * radius, 0.6 * out, spec.color);
    } else if (spec.kind === "lotus") {
      this.ring(o.x, o.y, 20 + spread * radius * 0.6, 0.7 * out, spec.color);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + t * 0.5,
          pts = [];
        for (let j = 0; j <= 30; j++) {
          const q = j / 30,
            b = a + Math.sin(q * Math.PI) * 0.55,
            r = Math.sin(q * Math.PI) * radius * 0.47 * spread;
          pts.push([o.x + Math.cos(b) * r, o.y + Math.sin(b) * r]);
        }
        this.stroke(pts, 8, spec.color, out * 0.65);
      }
      for (const p of particles.slice(0, 60)) {
        const r = p.speed * spread;
        this.ink(
          o.x + Math.cos(p.angle) * r,
          o.y + Math.sin(p.angle) * r - t * 100,
          p.size * 0.7,
          out * 0.5,
          p.stamp,
          p.angle,
        );
      }
    }
  }
  audio(kind) {
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      const a = new A(),
        o = a.createOscillator(),
        g = a.createGain();
      o.type = kind === "blast" ? "triangle" : "sine";
      o.frequency.setValueAtTime(
        kind === "blast" ? 90 : kind === "lotus" ? 230 : 430,
        a.currentTime,
      );
      o.frequency.exponentialRampToValueAtTime(
        kind === "lotus" ? 750 : 45,
        a.currentTime + 0.6,
      );
      g.gain.setValueAtTime(0.1, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.7);
      o.connect(g);
      g.connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.72);
      o.onended = () => a.close();
    } catch {}
  }
}
