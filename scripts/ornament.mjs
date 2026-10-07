// Generates the "billet to blade" ASCII ornament and writes it into site/index.html
// between the <!-- ornament:wide --> and <!-- ornament:narrow --> markers.
//
// The bar is modelled as a height field and lit from the upper left, then each
// character cell is mapped to an ink density. Left to right: a rough, pitted
// billet; a drawn-out section with hammer facets; a clean blade with a grind
// line; and a point that continues as a trail of code glyphs.
//
// Usage: node scripts/ornament.mjs            (updates site/index.html)
//        node scripts/ornament.mjs --print 150 (prints one width to stdout)

import { readFileSync, writeFileSync } from "node:fs";

const CELL = 0.6;            // monospace advance / line height (line-height: 1)
const WORLD_H = 0.25;         // scene height in units of scene width
const RAMP = " .:-=+*#%@";   // light to dark ink

// Deterministic PRNG and smooth value noise.
function prng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
const rnd = prng(20260911);
const LATTICE = Array.from({ length: 4096 }, () => rnd());
const hash = (i, j) => LATTICE[(((i * 73856093) ^ (j * 19349663)) >>> 0) % 4096];
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), xf), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), xf), yf);
}
const fbm = (x, y) => 0.55 * noise(x, y) + 0.3 * noise(x * 2.1, y * 2.1) + 0.15 * noise(x * 4.3, y * 4.3);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Geometry, in scene units (x: 0..1, y: 0..WORLD_H, y grows downward).
const X0 = 0.02, BILLET = 0.28, DRAWN = 0.42, TIP = 0.82;
const CY = WORLD_H / 2;
const H_BILLET = 0.085, H_BLADE = 0.034;

const roughness = (x) => clamp(1 - (x - X0) / (DRAWN + 0.04 - X0)) ** 1.4;

// Top (spine) and bottom (edge) of the silhouette at x.
function bounds(x) {
  if (x < X0 || x > TIP) return null;
  let half;
  if (x < BILLET) half = H_BILLET;
  else if (x < DRAWN) half = lerp(H_BILLET, H_BLADE, smooth((x - BILLET) / (DRAWN - BILLET)));
  else half = H_BLADE;
  let top = CY - half, bot = CY + half;
  // Ragged, slightly swollen billet end.
  const r = roughness(x);
  top += (fbm(x * 60, 1.3) - 0.5) * 0.02 * r;
  bot += (fbm(x * 60, 7.9) - 0.5) * 0.02 * r;
  if (x < X0 + 0.012) {
    const t = (x - X0) / 0.012;
    const pinch = (1 - Math.sqrt(1 - (1 - t) ** 2)) * 0.012;
    top += pinch; bot -= pinch;
  }
  // Blade point: the edge sweeps up to meet a slightly dropping spine.
  const P = 0.72;
  if (x > P) {
    const t = (x - P) / (TIP - P);
    bot = lerp(bot, CY - H_BLADE * 0.35, 1 - Math.sqrt(1 - t * t));
    top = lerp(top, CY - H_BLADE * 0.35, t ** 3);
  }
  return bot > top ? [top, bot] : null;
}

// Surface height at (x, y) inside the silhouette.
function height(x, y) {
  const b = bounds(x);
  if (!b) return null;
  const [top, bot] = b;
  if (y < top || y > bot) return null;
  const u = ((y - top) / (bot - top)) * 2 - 1; // -1 spine .. 1 edge
  const r = roughness(x);
  let z;
  if (x < DRAWN) {
    // Rounded rectangle cross-section.
    z = Math.sqrt(clamp(1 - Math.abs(u) ** 2.5)) * 0.05;
    // Hammer facets: shallow dents along the drawn-out section.
    const f = clamp((x - BILLET + 0.04) / 0.08) * clamp((DRAWN - x) / 0.05);
    z += Math.cos((x - BILLET) * 2 * Math.PI / 0.026) * 0.004 * f;
    // Scale and pitting on the raw billet.
    z += (fbm(x * 90, y * 90) - 0.5) * 0.012 * r;
  } else {
    // Blade: flat upper face, then a grind bevel down to the edge.
    const g = 0.15;
    z = u < g ? 0.03 - (u + 1) * 0.002 : lerp(0.028, 0.002, (u - g) / (1 - g));
  }
  return z;
}

const L = (() => { const v = [-0.4, -0.75, 0.55]; const n = Math.hypot(...v); return v.map((c) => c / n); })();

// Ink density 0..1 for one sample point, or -1 for background.
function ink(x, y) {
  const z = height(x, y);
  if (z === null) return -1;
  const e = 0.0015;
  const zx = (height(x + e, y) ?? z) - (height(x - e, y) ?? z);
  const zy = (height(x, y + e) ?? z) - (height(x, y - e) ?? z);
  let n = [-zx / (2 * e), -zy / (2 * e), 1];
  const len = Math.hypot(...n); n = n.map((c) => c / len);
  const diffuse = clamp(n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const h = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(...h);
  const spec = clamp((n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl) ** 40;
  const light = clamp(0.15 + 0.85 * diffuse + 0.6 * spec);
  // Raw metal is darker and mottled; the finished blade is lighter and even.
  const r = roughness(x);
  const tone = 0.4 + 0.18 * r + (fbm(x * 40, y * 40) - 0.5) * 0.35 * r;
  let d = clamp(tone + (1 - light) * 1.05 - 0.38);
  // Grind line and cutting edge read as crisp ink lines.
  if (x > DRAWN - 0.01) {
    const [top, bot] = bounds(x);
    const u = ((y - top) / (bot - top)) * 2 - 1;
    if (Math.abs(u - 0.15) < 0.09) d = Math.max(d, 0.62);
    if (u > 0.82) d = Math.max(d, 0.8);
  }
  return d;
}

function render(cols) {
  const rows = Math.round(WORLD_H * CELL * cols);
  const cw = 1 / cols, ch = WORLD_H / rows;
  const S = 4; // supersamples per axis
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const line = [];
    for (let c = 0; c < cols; c++) {
      let sum = 0, hits = 0;
      for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
        const d = ink((c + (i + 0.5) / S) * cw, (r + (j + 0.5) / S) * ch);
        if (d >= 0) { sum += d; hits++; }
      }
      const cover = hits / (S * S);
      let v = hits ? (sum / hits) * (0.35 + 0.65 * cover) : 0;
      if (cover > 0.15 && cover < 0.95) v = Math.max(v, 0.42); // crisp outline
      else if (cover > 0 && cover <= 0.15) v = 0.12;
      line.push(RAMP[Math.min(RAMP.length - 1, Math.round(v * (RAMP.length - 1)))]);
    }
    grid.push(line);
  }
  // Loose scale flakes around the billet.
  const flake = prng(7);
  for (let k = 0; k < cols * 0.18; k++) {
    const x = X0 + flake() * (BILLET - X0 + 0.06), y = CY + (flake() - 0.5) * WORLD_H * 0.95;
    const c = Math.floor(x * cols), r = Math.floor((y / WORLD_H) * rows);
    const b = bounds(x);
    if (r < 0 || r >= rows || !b) continue;
    const gap = Math.min(Math.abs(y - b[0]), Math.abs(y - b[1]));
    if (y > b[0] - 0.004 && y < b[1] + 0.004) continue;
    if (gap < 0.018 && grid[r][c] === " ") grid[r][c] = flake() < 0.7 ? "." : ":";
  }
  // The point continues as code. Ember-coloured, marked with \u0001...\u0002.
  const glyphs = ["<", "/", ">", " ", "{", "}", " ", ";", " ", "0", "1", " ", "=", ">", " ", "[", "]", " ", "(", ")"];
  const tipRow = Math.round(((CY - H_BLADE * 0.35) / WORLD_H) * rows - 0.5);
  let c = Math.ceil(TIP * cols) + 1, gap = 0, g = 0;
  const trail = [];
  while (c < cols - 1 && g < glyphs.length) {
    if (glyphs[g] !== " ") trail.push([c, glyphs[g]]);
    c += 1 + (glyphs[g] === " " ? Math.floor(gap) : 0);
    if (glyphs[g] === " ") gap += cols / 60;
    g++;
  }
  for (const [tc, ch2] of trail) grid[tipRow][tc] = "\u0001" + ch2 + "\u0002";
  return grid.map((l) => l.join("").replace(/\s+$/, "")).join("\n");
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (s) => esc(s).replace(/\u0001([^\u0002]*)\u0002/g, '<span class="code">$1</span>').replace(/<\/span><span class="code">/g, "");

const args = process.argv.slice(2);
if (args[0] === "--print") {
  console.log(render(Number(args[1]) || 150).replace(/[\u0001\u0002]/g, ""));
} else {
  const file = new URL("../site/index.html", import.meta.url);
  let html = readFileSync(file, "utf8");
  for (const [name, cols] of [["wide", 150], ["narrow", 64]]) {
    const re = new RegExp(`(<!-- ornament:${name} -->)[\\s\\S]*?(<!-- /ornament:${name} -->)`);
    if (!re.test(html)) throw new Error(`marker ornament:${name} not found`);
    html = html.replace(re, `$1${toHtml(render(cols))}$2`);
  }
  writeFileSync(file, html);
  console.log("ornament written to site/index.html");
}
