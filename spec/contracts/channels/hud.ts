/** Settings of the `hud` module. It owns no channels. Spec: spec/modules/hud.md */
import { z } from 'zod';
import type { SettingsSection } from '../module';

export const HudSettings = z.object({
  notifyOnNeedsYou: z.boolean().default(true),
  notifyOnDone: z.boolean().default(true),
  /** Usage percentage from which bars turn to the warning tone. */
  warnAt: z.number().int().min(1).max(99).default(60),
  /** Usage percentage from which bars turn to the danger tone. */
  dangerAt: z.number().int().min(1).max(100).default(85),
  showRecap: z.boolean().default(true),
});
export type HudSettings = z.infer<typeof HudSettings>;

export const hudSection: SettingsSection<HudSettings> = {
  moduleId: 'hud',
  title: 'HUD',
  schema: HudSettings,
  defaults: HudSettings.parse({}),
};
