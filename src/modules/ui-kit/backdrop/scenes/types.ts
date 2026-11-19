/** An sRGB colour, each channel 0 to 255. */
export type Rgb = readonly [number, number, number];

/** What a scene reads from the theme (UI-30, UI-34). Colours come from tokens, never from the scene. */
export type SceneConfig = {
  /** `color.bg.app`: the colour behind everything. */
  readonly background: Rgb;
  /** `color.accent`: a scene never draws a pixel brighter than 0.6 of it (UI-34). */
  readonly accent: Rgb;
  /** The colour jobs the scene walks through: structure, brand, memory, knowledge, live. */
  readonly palette: readonly Rgb[];
  /** Neutral dust, usually `color.text.secondary`. */
  readonly dust: Rgb;
  /** `crt.barrel` converted to canvas pixels at the corners. */
  readonly barrelPx: number;
};

/** A steam source of UI-35: a centre in window fractions (0 to 1), its colour and strength (0 to 1). */
export type SceneSource = {
  readonly x: number;
  readonly y: number;
  readonly colour: Rgb;
  readonly strength: number;
};

/** A background scene. It draws into a pixel buffer, so it runs in the worker or in a test alike. */
export type Scene = {
  readonly width: number;
  readonly height: number;
  /** Advances the scene by one frame. */
  step(): void;
  /** Writes the current frame into `out` (`width * height` pixels, 0xAABBGGRR as in `ImageData`). */
  render(out: Uint32Array): void;
  /** The pointer moved to (`x`, `y`) in window fractions, by (`dx`, `dy`) since the last move. */
  stir(x: number, y: number, dx: number, dy: number): void;
  /** A click on empty space at (`x`, `y`) in window fractions (UI-33). */
  puff(x: number, y: number): void;
  setSources(sources: readonly SceneSource[]): void;
  configure(config: SceneConfig): void;
};

export type SceneFactory = (config: SceneConfig) => Scene;

/** Packs a colour for a `Uint32Array` view over `ImageData` (little-endian RGBA). */
export function packRgb(r: number, g: number, b: number): number {
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

/** `#RRGGBB` or `#RGB` to a colour; anything else gives `fallback`. */
export function parseHex(value: string | undefined, fallback: Rgb): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((value ?? '').trim());
  if (match === null) return fallback;
  const hex = match[1] ?? '';
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}
