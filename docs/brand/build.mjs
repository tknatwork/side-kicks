#!/usr/bin/env node
/**
 * Builds the Side-Kicks logo: a cut-paper sneaker seen from the side (a "side
 * kick") pasted on a card, beside marker lettering whose hyphen is a paper strip.
 *
 * Nothing here is traced from a drawing. Every scissor snip and marker wobble
 * comes from a PRNG seeded by the shape's own name, so the hand-made look is
 * reproducible and one shape can be reworked without re-rolling the others.
 * Change SEED to get a different "hand".
 *
 * Usage:  node docs/brand/build.mjs          SVGs only
 *         node docs/brand/build.mjs --png    + PNGs and a Finder folder .icns
 *                                            (macOS; renders with Google Chrome)
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const SEED = "side-kicks";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const C = {
  card: "#F4ECDD",
  ink: "#231D17",
  inkOnDark: "#F4ECDD",
  red: "#E2462C",
  yellow: "#F2B43C",
  blue: "#2E5BCF",
  cream: "#FFF7E8",
  tape: "#EADBB4",
  shadow: "#3B2412",
  kraftBack: "#BF8A4F",
  kraftFront: "#D7A766",
};

// ---------- randomness ----------

/** mulberry32, seeded from a string hash of SEED + key. */
function rngFor(key) {
  let h = 1779033703;
  for (const ch of `${SEED}:${key}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const span = (rng, lo, hi) => lo + (hi - lo) * rng();
const jit = (rng, amt) => (rng() * 2 - 1) * amt;

/** Smooth noise in [-1, 1] from three detuned sines: reads as a hand drifting, not as jitter. */
function drift(rng) {
  const waves = [1, 2.3, 4.1].map((f) => ({ f: f * span(rng, 0.7, 1.3), p: span(rng, 0, 2 * Math.PI) }));
  return (t) => waves.reduce((sum, w, i) => sum + Math.sin(t * w.f + w.p) / (i + 1), 0) / 1.834;
}

// ---------- geometry ----------

/** Catmull-Rom through `pts` → dense polyline. */
function spline(pts, closed, steps = 14) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([0, 1].map((k) =>
        0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t
          + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t)));
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Points along a polyline, `gap()` apart (called afresh for every step). Starts at line[0]; the end is not included. */
function walk(line, gap) {
  const out = [line[0]];
  let want = gap();
  let [px, py] = line[0];
  for (let i = 1; i < line.length; i++) {
    const [bx, by] = line[i];
    let d = Math.hypot(bx - px, by - py);
    while (d >= want) {
      const t = want / d;
      px += (bx - px) * t;
      py += (by - py) * t;
      out.push([px, py]);
      d -= want;
      want = gap();
    }
    want -= d;
    [px, py] = [bx, by];
  }
  return out;
}

/** Local → canvas: rotate (degrees) and scale about `pivot`, then move the pivot to (x, y). */
function place(pts, { x = 0, y = 0, s = 1, r = 0, pivot = [0, 0] }) {
  const cos = Math.cos((r * Math.PI) / 180);
  const sin = Math.sin((r * Math.PI) / 180);
  return pts.map(([px, py]) => {
    const [lx, ly] = [(px - pivot[0]) * s, (py - pivot[1]) * s];
    return [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
  });
}

const fmt = (n) => +n.toFixed(1);
const pt = ([x, y]) => `${fmt(x)} ${fmt(y)}`;
const poly = (pts) => `M${pts.map(pt).join("L")}Z`;

// ---------- materials ----------

/**
 * A paper piece cut with scissors: the outline becomes short straight snips plus a little
 * hand jitter. Smooth shapes facet on their curves; straight shapes keep their corners.
 */
function cut(shape, rng, { snip = [8, 18], wiggle = 0.8 } = {}) {
  const gap = () => span(rng, ...snip);
  let pts;
  if (shape.smooth) {
    const line = spline(shape.pts, true);
    pts = walk([...line, line[0]], gap);
    const [a, b] = [pts.at(-1), pts[0]];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < snip[0] * 0.5) pts.pop();
  } else {
    pts = shape.pts.flatMap((a, i) => walk([a, shape.pts[(i + 1) % shape.pts.length]], gap));
  }
  return pts.map(([x, y]) => [x + jit(rng, wiggle), y + jit(rng, wiggle)]);
}

/** Paper on paper: a hard offset shadow under the piece, like a flatbed scan of a collage. */
function paper(pts, fill, { lift = [3, 4], shade = 0.2, opacity } = {}) {
  const under = pts.map(([x, y]) => [x + lift[0], y + lift[1]]);
  const alpha = opacity ? ` fill-opacity="${opacity}"` : "";
  return `<path d="${poly(under)}" fill="${C.shadow}" fill-opacity="${shade}"/><path d="${poly(pts)}" fill="${fill}"${alpha}/>`;
}

/** A felt-marker line: the centreline drifts and the nib width breathes along the stroke. */
function marker(pts, rng, { width = 19, wobble = 1.6 } = {}) {
  const line = walk(spline(pts, false, 24), () => 1.5);
  const end = pts.at(-1);
  if (Math.hypot(line.at(-1)[0] - end[0], line.at(-1)[1] - end[1]) > 0.5) line.push(end);
  const [dx, dy, dw] = [drift(rng), drift(rng), drift(rng)];
  const c = line.map(([x, y], i) => [x + dx(i / 30) * wobble, y + dy(i / 30) * wobble]);
  const half = c.map((_, i) => (width / 2) * (1 + 0.13 * dw(i / 22)));
  const left = [];
  const right = [];
  c.forEach(([x, y], i) => {
    const [ax, ay] = c[Math.max(0, i - 1)];
    const [bx, by] = c[Math.min(c.length - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    left.push([x + nx * half[i], y + ny * half[i]]);
    right.push([x - nx * half[i], y - ny * half[i]]);
  });
  // Round caps: both arcs run counter-clockwise on screen (sweep 0), matching the outline.
  const [r0, r1] = [fmt(half[0]), fmt(half.at(-1))];
  return `M${left.map(pt).join("L")}A${r1} ${r1} 0 0 0 ${pt(right.at(-1))}`
    + `L${right.slice(0, -1).reverse().map(pt).join("L")}A${r0} ${r0} 0 0 0 ${pt(left[0])}Z`;
}

/** A blob of ink (the dot of an i, a fleck in the card stock). */
function dab([cx, cy], r, rng) {
  const pts = Array.from({ length: 7 }, (_, k) => {
    const a = (k / 7) * 2 * Math.PI + jit(rng, 0.2);
    const rr = r * span(rng, 0.85, 1.12);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  return poly(spline(pts, true, 6));
}

/** Masking tape: dispenser-straight long edges, torn ends. Centred on the origin. */
function tape(len, wid, rng) {
  const [hl, hw] = [len / 2, wid / 2];
  const torn = (x, from, to) => Array.from({ length: 5 }, (_, i) => [x + jit(rng, 3), from + ((to - from) * (i + 1)) / 6]);
  return {
    smooth: false,
    pts: [[-hl, -hw], [hl, -hw], ...torn(hl, -hw, hw), [hl, hw], [-hl, hw], ...torn(-hl, hw, -hw)],
  };
}

/** Rounded rectangle as a polygon (scissors take corners in three snips). Centred on the origin. */
function card(w, h, r) {
  const [hw, hh] = [w / 2, h / 2];
  const corner = (cx, cy, from) => [0, 0.5, 1].map((k) => {
    const a = from + (k * Math.PI) / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  return {
    smooth: false,
    pts: [
      ...corner(hw - r, -hh + r, -Math.PI / 2),
      ...corner(hw - r, hh - r, 0),
      ...corner(-hw + r, hh - r, Math.PI / 2),
      ...corner(-hw + r, -hh + r, Math.PI),
    ],
  };
}

// ---------- the sneaker ----------
// Local frame: toe to the right, heel at x≈0, ground at y≈152, tongue tip at y≈6.

const SHOE = {
  pivot: [108, 79],
  tab: { smooth: true, pts: [[10, 46], [6, 22], [12, 12], [26, 14], [30, 38]] },
  upper: {
    smooth: true,
    pts: [[10, 128], [2, 100], [4, 64], [14, 38], [28, 28], [46, 40], [64, 48], [82, 38], [92, 18], [102, 6],
      [116, 8], [124, 22], [160, 50], [200, 72], [240, 86], [272, 96], [292, 110], [298, 126], [280, 131],
      [150, 131], [40, 131]],
  },
  bolt: { smooth: false, pts: [[62, 90], [128, 72], [124, 86], [200, 74], [136, 110], [140, 97], [66, 108]] },
  heel: { smooth: true, pts: [[2, 128], [0, 98], [6, 66], [20, 54], [40, 66], [50, 98], [52, 128]] },
  toe: { smooth: true, pts: [[226, 100], [256, 94], [282, 104], [298, 120], [294, 132], [232, 132], [220, 116]] },
  sole: {
    smooth: true,
    pts: [[8, 124], [0, 136], [8, 149], [80, 152], [200, 152], [258, 149], [286, 142], [296, 130], [290, 122],
      [250, 126], [150, 127], [40, 125]],
  },
  // Where the laces cross the lace line, which runs from the tongue (126, 24) down to the toe cap (228, 94).
  laces: [0.2, 0.44, 0.68],
  stitch: [[56, 118], [222, 118]],
  foxing: [[14, 138], [288, 138]],
  speed: [
    [[-22, 56], [-44, 58], [-64, 64]],
    [[-20, 88], [-52, 90], [-82, 96]],
    [[-22, 120], [-42, 122], [-58, 126]],
  ],
};

/** The pasted-up sneaker plus its speed lines, placed with `frame` (pivot is the shoe's middle). */
function sneaker(frame, ink, key) {
  const at = (pts) => place(pts, { ...frame, pivot: SHOE.pivot });
  const rng = (part) => rngFor(`${key}:${part}`);
  const s = frame.s;
  const lift = [2.4 * s, 3.2 * s];
  const piece = (name, fill) => paper(at(cut(SHOE[name], rng(name))), fill, { lift });

  const speed = SHOE.speed.map((line, i) =>
    `<path d="${marker(at(line), rng(`speed${i}`), { width: 7 * s, wobble: 1.2 * s })}" fill="${ink}"/>`).join("");

  const [a, b] = [[126, 24], [228, 94]];
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const laces = SHOE.laces.map((t, i) => {
    const centre = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const strip = place(cut(card(30, 9, 2), rng(`lace${i}`), { snip: [6, 10], wiggle: 0.5 }), { r: angle + 90 });
    return paper(at(strip.map(([x, y]) => [x + centre[0], y + centre[1]])), C.cream, { lift, shade: 0.25 });
  }).join("");

  const dashes = walk(SHOE.stitch, () => 6.5)
    .filter((_, i) => i % 2 === 0)
    .map((p, i) => `<path d="${marker(at([p, [p[0] + 6, p[1]]]), rng(`stitch${i}`), { width: 2.6 * s, wobble: 0.3 })}" fill="${C.cream}"/>`)
    .join("");

  return [
    `<g id="speed-lines">${speed}</g>`,
    `<g id="sneaker">`,
    piece("tab", C.blue),
    piece("upper", C.red),
    piece("bolt", C.blue),
    piece("heel", C.yellow),
    piece("toe", C.yellow),
    laces,
    dashes,
    piece("sole", C.ink),
    `<path d="${marker(at(SHOE.foxing), rng("foxing"), { width: 3.4 * s, wobble: 0.6 })}" fill="${C.cream}"/>`,
    `</g>`,
  ].join("");
}

// ---------- the lettering ----------
// Skeletons in an x-height-100 box: baseline y = 0, x-height y = -100, ascender y = -145.

const GLYPHS = {
  s: { w: 62, strokes: [[[58, -84], [44, -98], [24, -100], [8, -88], [10, -66], [32, -52], [54, -38], [60, -16], [46, -2], [22, 0], [4, -14]]] },
  i: { w: 12, strokes: [[[6, -96], [6, 0]]], dot: [6, -138] },
  d: { w: 64, strokes: [[[62, -145], [62, 0]], [[62, -78], [44, -100], [20, -96], [4, -66], [6, -28], [24, -2], [46, -4], [62, -24]]] },
  e: { w: 64, strokes: [[[6, -52], [34, -54], [60, -52], [54, -84], [32, -100], [8, -86], [2, -52], [10, -18], [32, 0], [56, -10]]] },
  k: { w: 62, strokes: [[[6, -145], [6, 0]], [[58, -100], [8, -44]], [[26, -62], [62, 0]]] },
  c: { w: 62, strokes: [[[60, -80], [42, -100], [18, -94], [2, -60], [6, -24], [26, 0], [48, -2], [62, -18]]] },
  "-": { w: 40 },
};
const TRACKING = 34;

function wordmarkWidth(text) {
  return [...text].reduce((sum, ch) => sum + GLYPHS[ch].w + TRACKING, -TRACKING);
}

/** Marker lettering; the hyphen is a strip of red paper. (x, baseline) is the left end of the baseline. */
function wordmark(text, { x, baseline, size = 1, ink }) {
  let cursor = x;
  const out = [...text].map((ch, i) => {
    const g = GLYPHS[ch];
    const rng = rngFor(`letter${i}:${ch}`);
    const frame = {
      x: cursor + (g.w / 2) * size,
      y: baseline + (-50 + jit(rng, 4)) * size,
      s: size * span(rng, 0.97, 1.04),
      r: jit(rng, 3.5),
      pivot: [g.w / 2, -50],
    };
    cursor += (g.w + TRACKING) * size;
    if (ch === "-") {
      const strip = cut(card(g.w + 6, 19, 2), rng, { snip: [7, 14], wiggle: 0.6 }).map(([px, py]) => [px + g.w / 2, py - 48]);
      return paper(place(strip, { ...frame, r: jit(rng, 7) }), C.red, { lift: [2.5 * size, 3 * size] });
    }
    const strokes = g.strokes.map((stroke) => marker(place(stroke, frame), rng, { width: 19 * size, wobble: 1.6 * size }));
    if (g.dot) strokes.push(dab(place([g.dot], frame)[0], 12.5 * size, rng));
    return `<path d="${strokes.join("")}" fill="${ink}"/>`;
  });
  return `<g id="wordmark">${out.join("")}</g>`;
}

// ---------- compositions ----------

/** The mark on a 512 × 512 canvas: a taped-up card with the sneaker kicking across it, TKN sticker top-right. */
function mark() {
  const rng = rngFor("card");
  const sheet = place(cut(card(404, 404, 14), rng, { snip: [16, 38], wiggle: 0.9 }), { x: 256, y: 266, r: -3 });
  const flecks = Array.from({ length: 70 }, () => {
    const p = place([[span(rng, -180, 180), span(rng, -180, 180)]], { x: 256, y: 266, r: -3 })[0];
    return `<path d="${dab(p, span(rng, 0.6, 1.6), rng)}" fill="${C.ink}" fill-opacity="${fmt(span(rng, 0.1, 0.22))}"/>`;
  }).join("");
  const strip = place(cut(tape(132, 36, rng), rng, { snip: [24, 44], wiggle: 0.4 }), { x: 258, y: 70, r: 4 });
  return [
    `<g id="card">${paper(sheet, C.card, { lift: [5, 7], shade: 0.22 })}${flecks}</g>`,
    sneaker({ x: 249, y: 262, s: 1, r: -15 }, C.ink, "mark"),
    `<g id="tape">${paper(strip, C.tape, { lift: [1, 1.5], shade: 0.12, opacity: 0.82 })}</g>`,
    brandSticker({ x: 412, y: 100, width: 146, r: 8 }),
  ].join("");
}

/** Tushar's TKN logo: white on black, cropped 3:2 around the letters from the square master. */
const BRAND = { file: "tkn-logo.jpg", width: 600, height: 400 };

/**
 * The TKN logo as a die-cut sticker. The logo is embedded untouched; only its mounting is
 * hand-made — rounded corners and a scissor-cut cream border with a paper shadow.
 */
function brandSticker({ x, y, width, r }) {
  const rng = rngFor("brand-sticker");
  const k = width / 250; // border and shadow are tuned for a 250-wide sticker
  const [w, h] = [width, (width * BRAND.height) / BRAND.width];
  const [radius, border] = [h * 0.12, 12 * k];
  const backing = place(cut(card(w + 2 * border, h + 2 * border, radius + border), rng, { snip: [12, 26], wiggle: 0.9 }),
    { x, y, r });
  const data = readFileSync(path.join(OUT, BRAND.file)).toString("base64");
  return [
    `<g id="brand-sticker">`,
    `<defs><clipPath id="tkn-clip"><rect width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(radius)}"/></clipPath></defs>`,
    paper(backing, C.cream, { lift: [4 * k, 6 * k], shade: 0.26 }),
    `<g transform="translate(${fmt(x)} ${fmt(y)}) rotate(${r}) translate(${fmt(-w / 2)} ${fmt(-h / 2)})">`,
    `<image width="${fmt(w)}" height="${fmt(h)}" clip-path="url(#tkn-clip)" xlink:href="data:image/jpeg;base64,${data}"/>`,
    `</g></g>`,
  ].join("");
}

/** A kraft-paper folder for the Finder, 1024 × 1024: the sneaker on the front, the brand sticker top-right. */
function folder() {
  const rng = rngFor("folder");
  const back = { smooth: false, pts: [[112, 206], [384, 206], [430, 258], [912, 258], [912, 858], [112, 858]] };
  const front = { smooth: false, pts: [[-400, -262], [400, -262], [400, 262], [-400, 262]] };
  const frontPts = place(cut(front, rng, { snip: [22, 48], wiggle: 1.2 }), { x: 512, y: 600, r: -1.2 });
  return [
    `<g id="folder">`,
    paper(cut(back, rng, { snip: [22, 48], wiggle: 1.2 }), C.kraftBack, { lift: [8, 11], shade: 0.24 }),
    paper(frontPts, C.kraftFront, { lift: [6, 9], shade: 0.22 }),
    `</g>`,
    sneaker({ x: 536, y: 584, s: 1.7, r: -12 }, C.ink, "folder"),
    brandSticker({ x: 800, y: 300, width: 250, r: 7 }),
  ].join("");
}

function svg(w, h, body, title = "Side-Kicks") {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
}

const LOCKUP = { width: 1280, height: 800 }; // 16:10

/** Mark on the left, lettering on the right, centred on the 16:10 canvas. */
function lockup(ink) {
  const markSize = 340;
  const size = 0.92;
  // Ink extents of the layout drawn from the origin (measured from a render): the card sits ~27 in
  // from its 512 box, the TKN sticker tops out at ~24, and the lettering overhangs its skeleton by half a nib.
  const [left, right] = [27, markSize + 36 + wordmarkWidth("side-kicks") * size + 10];
  const [top, bottom] = [24, 322];
  const dx = fmt((LOCKUP.width - (right - left)) / 2 - left);
  const dy = fmt((LOCKUP.height - (bottom - top)) / 2 - top);
  const body = `<g transform="translate(${dx} ${dy})">`
    + `<g transform="scale(${markSize / 512})">${mark()}</g>`
    + wordmark("side-kicks", { x: markSize + 36, baseline: 236, size, ink })
    + `</g>`;
  return svg(LOCKUP.width, LOCKUP.height, body);
}

/** The folder art centred on the same 16:10 canvas, filling 80% of its height. */
function folderWide() {
  const [left, right, top, bottom] = [106, 948, 192, 879]; // ink box of folder() on its 1024 canvas
  const s = (LOCKUP.height * 0.8) / (bottom - top);
  const dx = fmt(LOCKUP.width / 2 - ((left + right) / 2) * s);
  const dy = fmt(LOCKUP.height / 2 - ((top + bottom) / 2) * s);
  return svg(LOCKUP.width, LOCKUP.height,
    `<g transform="translate(${dx} ${dy}) scale(${+s.toFixed(4)})">${folder()}</g>`, "Side-Kicks folder");
}

// ---------- output ----------

const files = {
  "side-kicks-logo.svg": lockup(C.ink),
  "side-kicks-logo-dark.svg": lockup(C.inkOnDark),
  "side-kicks-mark.svg": svg(512, 512, mark()),
  "side-kicks-folder.svg": svg(1024, 1024, folder(), "Side-Kicks folder"),
  "side-kicks-folder-16x10.svg": folderWide(),
};
for (const [name, body] of Object.entries(files)) writeFileSync(path.join(OUT, name), body);
console.log(`wrote ${Object.keys(files).join(", ")}`);

if (process.argv.includes("--png")) {
  const render = (name, w, h, scale, png) => execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, `--screenshot=${path.join(OUT, png)}`,
    pathToFileURL(path.join(OUT, name)).href,
  ], { stdio: "ignore" });
  render("side-kicks-logo.svg", LOCKUP.width, LOCKUP.height, 2, "side-kicks-logo.png");
  render("side-kicks-mark.svg", 512, 512, 2, "side-kicks-mark.png");
  render("side-kicks-folder.svg", 1024, 1024, 1, "side-kicks-folder.png");
  render("side-kicks-folder-16x10.svg", LOCKUP.width, LOCKUP.height, 2, "side-kicks-folder-16x10.png");

  // Finder icon: every size iconutil expects, scaled down from the 1024 render.
  const set = path.join(mkdtempSync(path.join(os.tmpdir(), "side-kicks-")), "folder.iconset");
  mkdirSync(set);
  for (const px of [16, 32, 128, 256, 512]) {
    for (const [scale, suffix] of [[1, ""], [2, "@2x"]]) {
      execFileSync("sips", ["-z", `${px * scale}`, `${px * scale}`, path.join(OUT, "side-kicks-folder.png"),
        "--out", path.join(set, `icon_${px}x${px}${suffix}.png`)], { stdio: "ignore" });
    }
  }
  execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(OUT, "side-kicks-folder.icns")]);
  rmSync(path.dirname(set), { recursive: true, force: true });
  console.log("wrote side-kicks-logo.png, side-kicks-mark.png, side-kicks-folder.png, side-kicks-folder-16x10.png, side-kicks-folder.icns");
}
