/** Channels and file schemas owned by the `settings` module. Spec: spec/modules/settings.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zEmpty, zModuleId } from '../schemas';
import { ThemeFile } from '../theme';

/** settings.json on disk. `values` holds one object per module id. */
export const SettingsFile = z.object({
  version: z.literal(1),
  values: z.record(z.string(), z.record(z.string(), z.unknown())),
});
export type SettingsFile = z.infer<typeof SettingsFile>;

/** keybindings.json on disk. Maps a command id to a key, or to null to remove its default key. */
export const KeybindingsFile = z.object({
  version: z.literal(1),
  bindings: z.record(z.string(), z.string().nullable()),
});
export type KeybindingsFile = z.infer<typeof KeybindingsFile>;

/** One thing wrong with a settings, keybindings or theme file (P-32). */
export const SettingsProblem = z.object({
  file: zAbsPath,
  /** Dotted path inside the file, for example `values.terminal.fontSize`. Empty for a parse error. */
  path: z.string(),
  message: z.string(),
});
export type SettingsProblem = z.infer<typeof SettingsProblem>;

/** The `settings` module's own section: appearance and general options. */
export const AppearanceSettings = z.object({
  theme: z.string().default('Phosphor'),
  /** Multiplies every px size. 1 means 100 percent. */
  uiScale: z.number().min(0.8).max(1.5).default(1),
  reduceMotion: z.enum(['system', 'on', 'off']).default('system'),
  /** The vault folder shown in the graph, or null for none. */
  vaultPath: zAbsPath.nullable().default(null),
});
export type AppearanceSettings = z.infer<typeof AppearanceSettings>;

export const appearanceSection: SettingsSection<AppearanceSettings> = {
  moduleId: 'settings',
  title: 'Appearance',
  schema: AppearanceSettings,
  defaults: { theme: 'Phosphor', uiScale: 1, reduceMotion: 'system', vaultPath: null },
};

export const ThemeSummary = z.object({
  name: z.string(),
  kind: z.enum(['dark', 'light']),
  file: zAbsPath,
  isBuiltIn: z.boolean(),
});
export type ThemeSummary = z.infer<typeof ThemeSummary>;

const ResolvedThemeSchema = z.object({
  name: z.string(),
  kind: z.enum(['dark', 'light']),
  tokens: z.record(z.string(), z.string()),
});

export const settingsChannels = {
  /** Current validated values for one module, with defaults filled in. */
  getSection: request(
    'settings.getSection',
    'main',
    z.object({ moduleId: zModuleId }),
    z.record(z.string(), z.unknown()),
  ),
  /** Sets one key. The value is validated against the section schema before writing (SET-6). */
  setValue: request(
    'settings.setValue',
    'main',
    z.object({ moduleId: zModuleId, key: z.string(), value: z.unknown() }),
    zEmpty,
  ),
  sectionChanged: event(
    'settings.sectionChanged',
    'main',
    z.object({ moduleId: zModuleId, value: z.record(z.string(), z.unknown()) }),
  ),

  getProblems: request('settings.getProblems', 'main', zEmpty, z.array(SettingsProblem)),
  problemsChanged: event('settings.problemsChanged', 'main', z.array(SettingsProblem)),

  listThemes: request('settings.listThemes', 'main', zEmpty, z.array(ThemeSummary)),
  getActiveTheme: request('settings.getActiveTheme', 'main', zEmpty, ResolvedThemeSchema),
  activeThemeChanged: event('settings.activeThemeChanged', 'main', ResolvedThemeSchema),
  /** Writes a theme file under themesDir. Built-in themes are never overwritten (SET-16). */
  saveTheme: request('settings.saveTheme', 'main', z.object({ theme: ThemeFile }), ThemeSummary),

  getKeybindings: request('settings.getKeybindings', 'main', zEmpty, z.record(z.string(), z.string().nullable())),
  setKeybinding: request(
    'settings.setKeybinding',
    'main',
    z.object({ commandId: z.string(), key: z.string().nullable() }),
    zEmpty,
  ),
  keybindingsChanged: event(
    'settings.keybindingsChanged',
    'main',
    z.record(z.string(), z.string().nullable()),
  ),

  /** Opens the settings folder in Explorer. */
  openFolder: request('settings.openFolder', 'main', zEmpty, zEmpty),
} as const;
