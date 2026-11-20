import { describe, expect, it } from 'vitest';
import {
  brightnessLimit,
  createPhosphorDustScene,
  luminance,
} from '../../src/modules/ui-kit/backdrop/scenes/phosphor-dust';
import type { Rgb, SceneConfig } from '../../src/modules/ui-kit/backdrop/scenes/types';

/** Phosphor's colours (resources/themes/phosphor.json). */
const PHOSPHOR: SceneConfig = {
  background: [0x0b, 0x0a, 0x09],
  accent: [0xf5, 0xff, 0x3b],
  palette: [
    [0xff, 0x7a, 0x3d],
    [0xff, 0x00, 0x3c],
    [0xff, 0x00, 0xff],
    [0xc7, 0x7d, 0xff],
    [0x00, 0xf0, 0xff],
  ],
  dust: [0xcd, 0xbf, 0xb3],
  barrelPx: 22,
};

describe('UI-34 the Phosphor scene never draws too bright', () => {
  it('UI-34 after 300 frames with three sources at strength 1 no pixel is above the brightness limit', () => {
    const scene = createPhosphorDustScene(PHOSPHOR);
    const sources = [
      { x: 0.2, y: 0.3, colour: PHOSPHOR.palette[0] as Rgb, strength: 1 },
      { x: 0.5, y: 0.5, colour: PHOSPHOR.palette[4] as Rgb, strength: 1 },
      { x: 0.8, y: 0.7, colour: PHOSPHOR.palette[1] as Rgb, strength: 1 },
    ];
    scene.setSources(sources);
    const limit = brightnessLimit(PHOSPHOR.accent);
    // 0.6 of the accent per channel: the spec gives 0.29 for Phosphor.
    expect(limit).toBeGreaterThan(0.28);
    expect(limit).toBeLessThan(0.3);
    const out = new Uint32Array(scene.width * scene.height);
    // luminance is a sum of one term per channel, so three 256-entry tables give it for any pixel.
    const red = Float64Array.from({ length: 256 }, (_, value) => luminance(value, 0, 0));
    const green = Float64Array.from({ length: 256 }, (_, value) => luminance(0, value, 0));
    const blue = Float64Array.from({ length: 256 }, (_, value) => luminance(0, 0, value));
    let brightest = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      scene.step();
      scene.render(out);
      for (const pixel of out) {
        const lum =
          (red[pixel & 0xff] ?? 0) + (green[(pixel >> 8) & 0xff] ?? 0) + (blue[(pixel >> 16) & 0xff] ?? 0);
        if (lum > brightest) brightest = lum;
      }
      if (brightest > limit)
        throw new Error(`frame ${frame}: a pixel has luminance ${brightest}, above ${limit}`);
    }
    expect(brightest).toBeGreaterThan(0.01);
  });
});
