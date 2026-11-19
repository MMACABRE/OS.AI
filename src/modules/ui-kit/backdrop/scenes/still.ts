import { packRgb } from './types';
import type { SceneConfig, SceneFactory } from './types';

/** The `still` scene: a flat `color.bg.app`. Unknown scene names draw it (UI-30). */
export const createStillScene: SceneFactory = (initial: SceneConfig) => {
  let colour = packRgb(...initial.background);
  return {
    width: 16,
    height: 10,
    step() {},
    render(out) {
      out.fill(colour);
    },
    stir() {},
    puff() {},
    setSources() {},
    configure(config) {
      colour = packRgb(...config.background);
    },
  };
};
