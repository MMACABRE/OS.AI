import { createPhosphorDustScene } from './phosphor-dust';
import { createStillScene } from './still';
import type { SceneFactory } from './types';

/** Scenes by `backdrop.scene` name (UI-30). */
export const SCENES: Readonly<Record<string, SceneFactory>> = {
  still: createStillScene,
  'phosphor-dust': createPhosphorDustScene,
};

/** The scene for a token value; an unknown name draws `still` (UI-30). */
export function sceneFor(name: string): { readonly name: string; readonly create: SceneFactory } {
  const create = Object.hasOwn(SCENES, name) ? SCENES[name] : undefined;
  return create === undefined ? { name: 'still', create: createStillScene } : { name, create };
}
