import { createContext, useContext } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { Logger } from '@hsos/contracts/module';

/** What the HUD's components need from the module's context. `register` provides it. */
export type HudDeps = {
  readonly bus: Bus;
  readonly log: Logger;
  openPanel(type: string, state?: unknown): void;
  /** Writes one key of the `hud` settings section (SET-6). */
  setSetting(key: string, value: unknown): Promise<boolean>;
  /** True when a command id is registered, for parts that appear only when another module is present. */
  hasCommand(id: string): boolean;
  runCommand(id: string): void;
};

export const HudDepsContext = createContext<HudDeps | null>(null);

export function useHudDeps(): HudDeps {
  const deps = useContext(HudDepsContext);
  if (deps === null) throw new Error('The HUD is rendered outside its provider.');
  return deps;
}
