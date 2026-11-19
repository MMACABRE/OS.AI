import { packRgb } from './types';
import type { Rgb, Scene, SceneConfig, SceneFactory, SceneSource } from './types';

/*
 * The Phosphor scene (spec/reference/art/background.md): a grid of 5 by 5 pixel glyphs with a drifting
 * base pattern, rising steam, steam sources, 420 dust motes and a barrel bend. Ported from the approved
 * preview in design-round/dashboard/phosphor.html; colours come from the theme, and no pixel is brighter
 * than 0.6 of color.accent (UI-34).
 */

/** Cells across and down; each cell is `PITCH` canvas pixels, holding one 5 by 5 glyph. */
export const GRID_W = 120;
export const GRID_H = 75;
/** 5 pixel glyphs on a 6 pixel pitch, as in the approved preview: one dark pixel between glyphs. */
export const PITCH = 6;
export const DUST_COUNT = 420;
/** UI-34: the brightest a pixel may be, as a share of `color.accent` (relative luminance). */
export const BRIGHTNESS_CAP = 0.6;

const CELLS = GRID_W * GRID_H;
const WIDTH = GRID_W * PITCH;
const HEIGHT = GRID_H * PITCH;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const glyph = (rows: readonly string[]): readonly number[] =>
  rows.flatMap((row, y) => [...row].flatMap((char, x) => (char === '#' ? [y * WIDTH + x] : [])));

const GLYPHS = {
  dot: glyph(['.....', '.....', '..#..', '.....', '.....']),
  colon: glyph(['.....', '..#..', '.....', '..#..', '.....']),
  tick: glyph(['..#..', '..#..', '.....', '.....', '.....']),
  plus: glyph(['..#..', '..#..', '#####', '..#..', '..#..']),
  x: glyph(['#...#', '.#.#.', '..#..', '.#.#.', '#...#']),
  slash: glyph(['....#', '...#.', '..#..', '.#...', '#....']),
  back: glyph(['#....', '.#...', '..#..', '...#.', '....#']),
  pipe: glyph(['..#..', '..#..', '..#..', '..#..', '..#..']),
  dash: glyph(['.....', '.....', '#####', '.....', '.....']),
  eq: glyph(['.....', '#####', '.....', '#####', '.....']),
  rbr: glyph(['.##..', '..#..', '..#..', '..#..', '.##..']),
  lbr: glyph(['..##.', '..#..', '..#..', '..#..', '..##.']),
  hash: glyph(['.#.#.', '#####', '.#.#.', '#####', '.#.#.']),
  star: glyph(['..#..', '#.#.#', '.###.', '#.#.#', '..#..']),
} as const;
type GlyphName = keyof typeof GLYPHS;

const BASE_SET: readonly GlyphName[] = [
  'dot', 'dot', 'dot', 'dot', 'colon', 'tick', 'plus', 'x', 'eq', 'rbr', 'lbr', 'slash', 'back', 'pipe', 'dash',
];
const FLOW_GLYPHS: readonly GlyphName[] = ['dash', 'back', 'pipe', 'slash'];

// sRGB to linear light and back, for the brightness cap.
const TO_LINEAR = new Float32Array(256);
for (let value = 0; value < 256; value++) {
  const c = value / 255;
  TO_LINEAR[value] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
const toSrgb = (linear: number): number => {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.floor(c * 255)));
};
const byte = (value: number): number => Math.max(0, Math.min(255, value | 0));

/** Relative luminance of an sRGB colour (WCAG). */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * (TO_LINEAR[byte(r)] ?? 0) + 0.7152 * (TO_LINEAR[byte(g)] ?? 0) + 0.0722 * (TO_LINEAR[byte(b)] ?? 0);
}

/** The highest luminance a pixel may have: that of 0.6 of `color.accent` per channel (UI-34). */
export function brightnessLimit(accent: Rgb): number {
  return luminance(accent[0] * BRIGHTNESS_CAP, accent[1] * BRIGHTNESS_CAP, accent[2] * BRIGHTNESS_CAP);
}

/** A dust mote; `tint` is an index into the palette, or -1 for neutral dust. */
type Mote = { x: number; y: number; vx: number; vy: number; alpha: number; glyph: GlyphName; tint: number };

export const createPhosphorDustScene: SceneFactory = (initial: SceneConfig): Scene => {
  let config = initial;
  let limit = brightnessLimit(config.accent);
  let background = packRgb(...config.background);
  let barrelMap = new Int32Array(0);

  const vx = new Float32Array(CELLS);
  const vy = new Float32Array(CELLS);
  let ir = new Float32Array(CELLS);
  let ig = new Float32Array(CELLS);
  let ib = new Float32Array(CELLS);
  let tr = new Float32Array(CELLS);
  let tg = new Float32Array(CELLS);
  let tb = new Float32Array(CELLS);
  const baseGlyph: GlyphName[] = [];
  const baseAlpha = new Float32Array(CELLS);
  const baseR = new Uint8Array(CELLS);
  const baseG = new Uint8Array(CELLS);
  const baseB = new Uint8Array(CELLS);
  const threshold = new Float32Array(CELLS);
  const frame = new Uint32Array(WIDTH * HEIGHT);
  const pick = (): GlyphName => BASE_SET[(Math.random() * BASE_SET.length) | 0] ?? 'dot';
  for (let i = 0; i < CELLS; i++) {
    const x = i % GRID_W;
    const y = (i / GRID_W) | 0;
    threshold[i] = ((BAYER[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;
    baseGlyph.push(pick());
  }

  let sources: readonly SceneSource[] = [];
  let parallaxX = 0;
  let parallaxY = 0;
  let time = 0;

  const ring = (): readonly Rgb[] => {
    const palette = config.palette.length > 0 ? config.palette : [config.accent];
    return [...palette, palette[0] ?? config.accent];
  };

  // The base pattern slides and its colour bands walk the palette, so the field never sits still.
  const computeBase = (t: number) => {
    const colours = ring();
    const ou = t * 0.0009 - parallaxX;
    const ov = -t * 0.0006 - parallaxY;
    const oc = t * 0.0015;
    for (let y = 0; y < GRID_H; y++)
      for (let x = 0; x < GRID_W; x++) {
        const i = y * GRID_W + x;
        const u = x / GRID_W;
        const v = y / GRID_H;
        const su = u + ou;
        const sv = v + ov;
        let n =
          0.5 +
          0.22 * Math.sin(su * 9 + Math.sin(sv * 5) * 2) +
          0.18 * Math.sin(sv * 13 - su * 4 + t * 0.004) +
          0.12 * Math.sin((su + sv) * 23);
        n *= 0.25 + 0.9 * u ** 1.3 * (0.4 + 0.6 * v);
        baseAlpha[i] = n > (threshold[i] ?? 0) ? 0.32 : 0;
        const along = ((((u * 0.6 + v * 0.4 + oc) % 1) + 1) % 1) * (colours.length - 1);
        const k = along | 0;
        const f = along - k;
        const a = colours[k] ?? config.accent;
        const b = colours[k + 1] ?? a;
        baseR[i] = a[0] + (b[0] - a[0]) * f;
        baseG[i] = a[1] + (b[1] - a[1]) * f;
        baseB[i] = a[2] + (b[2] - a[2]) * f;
      }
  };

  const motes: Mote[] = Array.from({ length: DUST_COUNT }, () => {
    const r = Math.random();
    return {
      x: Math.random() * GRID_W,
      y: Math.random() * GRID_H,
      vx: 0,
      vy: 0,
      alpha: 0.25 + Math.random() * 0.4,
      glyph: r < 0.55 ? 'dot' : r < 0.8 ? 'tick' : r < 0.95 ? 'plus' : 'star',
      // Most dust is neutral; the rest is structure, live or knowledge, as in the preview.
      tint: Math.random() < 0.7 ? -1 : ([0, 4, 3][(Math.random() * 3) | 0] ?? 0),
    };
  });

  const near = (cx: number, cy: number, radius: number, apply: (index: number, falloff: number) => void) => {
    const x0 = Math.max(1, Math.floor(cx - radius));
    const x1 = Math.min(GRID_W - 2, Math.ceil(cx + radius));
    const y0 = Math.max(1, Math.floor(cy - radius));
    const y1 = Math.min(GRID_H - 2, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d < 1) apply(y * GRID_W + x, 1 - d);
      }
  };

  // One glyph, blended over the background by `alpha`, capped in brightness (UI-34).
  const put = (origin: number, offsets: readonly number[], r: number, g: number, b: number, alpha: number) => {
    const [br, bg, bb] = config.background;
    let pr = br + (r - br) * alpha;
    let pg = bg + (g - bg) * alpha;
    let pb = bb + (b - bb) * alpha;
    const lum = luminance(pr, pg, pb);
    if (lum > limit) {
      const f = (limit / lum) * 0.999;
      pr = toSrgb((TO_LINEAR[byte(pr)] ?? 0) * f);
      pg = toSrgb((TO_LINEAR[byte(pg)] ?? 0) * f);
      pb = toSrgb((TO_LINEAR[byte(pb)] ?? 0) * f);
    }
    const colour = packRgb(byte(pr), byte(pg), byte(pb));
    for (const offset of offsets) frame[origin + offset] = colour;
  };

  // The barrel bend (UI-34): each output pixel reads from further out, so the corners curve away.
  const buildBarrel = () => {
    barrelMap = new Int32Array(WIDTH * HEIGHT);
    const k = config.barrelPx / 2;
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const nx = (x / WIDTH) * 2 - 1;
        const ny = (y / HEIGHT) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const sx = Math.round(x + k * nx * r2);
        const sy = Math.round(y + k * ny * r2);
        barrelMap[y * WIDTH + x] = sx < 0 || sy < 0 || sx >= WIDTH || sy >= HEIGHT ? -1 : sy * WIDTH + sx;
      }
  };

  computeBase(0);
  buildBarrel();

  return {
    width: WIDTH,
    height: HEIGHT,
    configure(next) {
      const barrelChanged = next.barrelPx !== config.barrelPx;
      config = next;
      limit = brightnessLimit(config.accent);
      background = packRgb(...config.background);
      if (barrelChanged) buildBarrel();
    },
    setSources(next) {
      sources = next;
    },
    stir(x, y, dx, dy) {
      // A 10 px parallax shifts the base pattern against the pointer (background.md "Input").
      parallaxX = (x - 0.5) * (10 / (GRID_W * 12));
      parallaxY = (y - 0.5) * (10 / (GRID_H * 12));
      const cx = x * GRID_W;
      const cy = y * GRID_H;
      const pushX = dx * GRID_W * 0.35;
      const pushY = dy * GRID_H * 0.35;
      const radius = 5;
      near(cx, cy, radius, (i, f) => {
        vx[i] = (vx[i] ?? 0) + pushX * f;
        vy[i] = (vy[i] ?? 0) + pushY * f;
      });
      for (const mote of motes) {
        const d = Math.hypot(mote.x - cx, mote.y - cy);
        if (d < radius) {
          const f = 1 - d / radius;
          mote.vx += pushX * 0.12 * f;
          mote.vy += pushY * 0.12 * f;
        }
      }
    },
    puff(x, y) {
      const cx = x * GRID_W;
      const cy = y * GRID_H;
      for (const mote of motes) {
        const dx = mote.x - cx;
        const dy = mote.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 9) {
          const f = (1 - d / 9) * 0.9;
          mote.vx += (dx / d) * f;
          mote.vy += (dy / d) * f - 0.1;
        }
      }
      const [dr, dg, db] = config.dust;
      near(cx, cy, 6, (i, f) => {
        ir[i] = (ir[i] ?? 0) + dr * 1.1 * f;
        ig[i] = (ig[i] ?? 0) + dg * 1.1 * f;
        ib[i] = (ib[i] ?? 0) + db * 1.1 * f;
        vx[i] = (vx[i] ?? 0) + (Math.random() - 0.5) * 0.6;
        vy[i] = (vy[i] ?? 0) - 0.3 * f;
      });
    },
    step() {
      time++;
      if (time % 2 === 0) computeBase(time);
      // Each source pours steam of its colour into the field (UI-35).
      for (const source of sources) {
        const amount = 0.07 * Math.max(0, Math.min(1, source.strength));
        const [sr, sg, sb] = source.colour;
        near(source.x * GRID_W, source.y * GRID_H, 4, (i, f) => {
          ir[i] = (ir[i] ?? 0) + sr * amount * f;
          ig[i] = (ig[i] ?? 0) + sg * amount * f;
          ib[i] = (ib[i] ?? 0) + sb * amount * f;
        });
      }
      for (let y = 1; y < GRID_H - 1; y++)
        for (let x = 1; x < GRID_W - 1; x++) {
          const i = y * GRID_W + x;
          // Turbulence plus a slow rise.
          const turnX = Math.sin(y * 0.21 + time * 0.011) * 0.5 + Math.sin((x * 0.9 + y) * 0.05 - time * 0.007) * 0.5;
          const turnY = Math.cos(x * 0.17 - time * 0.009) * 0.5 + Math.cos((x - y * 0.8) * 0.06 + time * 0.006) * 0.5;
          const fx0 = (vx[i] ?? 0) * 0.92 + turnX * 0.01;
          const fy0 = (vy[i] ?? 0) * 0.92 + turnY * 0.01 - 0.004;
          vx[i] = fx0;
          vy[i] = fy0;
          const sx = Math.max(0, Math.min(GRID_W - 1.001, x - fx0 * 1.2));
          const sy = Math.max(0, Math.min(GRID_H - 1.001, y - fy0 * 1.2 + 0.18));
          const x0 = sx | 0;
          const y0 = sy | 0;
          const fx = sx - x0;
          const fy = sy - y0;
          const j = y0 * GRID_W + x0;
          const w00 = (1 - fx) * (1 - fy);
          const w10 = fx * (1 - fy);
          const w01 = (1 - fx) * fy;
          const w11 = fx * fy;
          const sample = (a: Float32Array) =>
            ((a[j] ?? 0) * w00 + (a[j + 1] ?? 0) * w10 + (a[j + GRID_W] ?? 0) * w01 + (a[j + GRID_W + 1] ?? 0) * w11) *
            0.935;
          tr[i] = sample(ir);
          tg[i] = sample(ig);
          tb[i] = sample(ib);
        }
      [ir, tr] = [tr, ir];
      [ig, tg] = [tg, ig];
      [ib, tb] = [tb, ib];
      // The field twinkles.
      for (let k = 0; k < 40; k++) baseGlyph[(Math.random() * CELLS) | 0] = pick();
      for (const mote of motes) {
        const i = Math.min(CELLS - 1, Math.max(0, (mote.y | 0) * GRID_W + (mote.x | 0)));
        mote.vx = mote.vx * 0.94 + (vx[i] ?? 0) * 0.06 + (Math.random() - 0.5) * 0.006;
        mote.vy = mote.vy * 0.94 + (vy[i] ?? 0) * 0.06 + (Math.random() - 0.5) * 0.006 - 0.0012;
        mote.x += mote.vx;
        mote.y += mote.vy;
        if (mote.x < 0) mote.x += GRID_W;
        if (mote.x >= GRID_W) mote.x -= GRID_W;
        if (mote.y < 0) mote.y += GRID_H;
        if (mote.y >= GRID_H) mote.y -= GRID_H;
      }
    },
    render(out) {
      frame.fill(background);
      for (let y = 1; y < GRID_H - 1; y++)
        for (let x = 1; x < GRID_W - 1; x++) {
          const i = y * GRID_W + x;
          const origin = y * PITCH * WIDTH + x * PITCH;
          const r = ir[i] ?? 0;
          const g = ig[i] ?? 0;
          const b = ib[i] ?? 0;
          const max = Math.max(r, g, b);
          const lum = max / 255;
          if (lum > (threshold[i] ?? 0) * 0.6) {
            // Steam: the glyph follows density, or the flow where it is stirred.
            const flowX = vx[i] ?? 0;
            const flowY = vy[i] ?? 0;
            let name: GlyphName;
            if (Math.hypot(flowX, flowY) > 0.22) {
              const quarter = ((Math.round(Math.atan2(flowY, flowX) / (Math.PI / 4)) % 4) + 4) % 4;
              name = FLOW_GLYPHS[quarter] ?? 'dash';
            } else
              name =
                lum < 0.3 ? 'dot' : lum < 0.5 ? ((x + y) % 2 ? 'plus' : 'colon') : lum < 0.8 ? ((x + y) % 2 ? 'x' : 'eq') : 'hash';
            const k = Math.min(1, 0.4 + lum) / (max || 1);
            put(origin, GLYPHS[name], r * k * 255, g * k * 255, b * k * 255, 1);
          } else if ((baseAlpha[i] ?? 0) > 0)
            put(origin, GLYPHS[baseGlyph[i] ?? 'dot'], baseR[i] ?? 0, baseG[i] ?? 0, baseB[i] ?? 0, baseAlpha[i] ?? 0);
        }
      for (const mote of motes) {
        const origin = ((mote.y * PITCH) | 0) * WIDTH + ((mote.x * PITCH) | 0);
        const colour = mote.tint < 0 ? config.dust : (config.palette[mote.tint % config.palette.length] ?? config.dust);
        if (origin >= 0 && origin < frame.length - WIDTH * 5 - 5)
          put(origin, GLYPHS[mote.glyph], colour[0], colour[1], colour[2], mote.alpha);
      }
      for (let p = 0; p < out.length; p++) {
        const from = barrelMap[p] ?? -1;
        out[p] = from < 0 ? background : (frame[from] ?? background);
      }
    },
  };
};
