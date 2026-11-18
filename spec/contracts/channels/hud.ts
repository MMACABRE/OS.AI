/** Settings of the `hud` module. It owns no channels. Spec: spec/modules/hud.md */
import { z } from 'zod';
import type { SettingsSection } from '../module';

/** One word the quick bar may send to Claude: never a space, a quote or a shell character (HUD-68). */
const zQuickWord = z.string().regex(/^\/?[a-z][a-z0-9:._[\]-]{0,60}$/);

export const HudSettings = z.object({
  notifyOnNeedsYou: z.boolean().default(true),
  notifyOnDone: z.boolean().default(true),
  /** Usage percentage from which bars turn to the warning tone. */
  warnAt: z.number().int().min(1).max(99).default(60),
  /** Usage percentage from which bars turn to the danger tone. */
  dangerAt: z.number().int().min(1).max(100).default(85),
  showRecap: z.boolean().default(true),
  /** Say aloud when a session finishes or needs the owner (HUD-13). */
  speakAlerts: z.boolean().default(true),
  /** Add the first sentence of Claude's last message to a "Finished" alert (HUD-14). */
  speakSummary: z.boolean().default(true),
  /** A voice name from `shell.listVoices`; empty means the Windows default voice. */
  speakVoice: z.string().max(200).default(''),
  /** -10 to 10; 0 is normal speed. */
  speakRate: z.number().int().min(-10).max(10).default(1),
  /** Models in the quick bar's model menu; each is sent as `/model <name>` (HUD-62). */
  quickModels: z.array(zQuickWord).max(20).default(['default', 'opus', 'sonnet', 'haiku', 'fable']),
  /** Effort levels in the model menu; each is sent as `/effort <level>` (HUD-62). */
  quickEfforts: z.array(zQuickWord).max(10).default(['low', 'medium', 'high', 'xhigh', 'max']),
  /** Slash commands under "More" (HUD-67). */
  quickCommands: z
    .array(zQuickWord.refine((s) => s.startsWith('/'), 'Starts with /'))
    .max(30)
    .default(['/status', '/memory', '/mcp', '/agents', '/hooks', '/permissions', '/config', '/doctor']),
});
export type HudSettings = z.infer<typeof HudSettings>;

export const hudSection: SettingsSection<HudSettings> = {
  moduleId: 'hud',
  title: 'HUD',
  schema: HudSettings,
  defaults: HudSettings.parse({}),
};
