import { activitySection } from '@hsos/contracts/channels/activity';
import { browserSection } from '@hsos/contracts/channels/browser';
import { claudeLinkSection } from '@hsos/contracts/channels/claude-link';
import { cliSection } from '@hsos/contracts/channels/cli';
import { dashboardSection } from '@hsos/contracts/channels/dashboard';
import { filesSection } from '@hsos/contracts/channels/files';
import { gitSection } from '@hsos/contracts/channels/git';
import { graphSection } from '@hsos/contracts/channels/graph';
import { historySection } from '@hsos/contracts/channels/history';
import { hudSection } from '@hsos/contracts/channels/hud';
import { sessionsSection } from '@hsos/contracts/channels/sessions';
import { appearanceSection, settingsChannels } from '@hsos/contracts/channels/settings';
import { skillsSection } from '@hsos/contracts/channels/skills';
import { terminalSection } from '@hsos/contracts/channels/terminal';
import type { ExtensionPoint, ServiceContext, SettingsSection } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';
import type { SettingsStore } from './service/settings-store';
import type { ThemeStore } from './service/theme-store';
import { watchSettingsFiles } from './service/settings-watcher';
import type { SettingsFileKind } from './service/settings-watcher';

/**
 * main fills this with the settings store it created before any module registered, so every module's
 * `registerSettings` (diagnostics included) already reads from it. The settings module serves it on the bus.
 */
export const settingsStorePoint: ExtensionPoint<SettingsStore> = { id: 'settings.store' };

/**
 * Every section declared in the contracts. main validates all of them, because modules in utility
 * processes read theirs through `getSection` (SET-10) and a zod schema cannot cross the bus.
 */
export const CONTRACT_SECTIONS: readonly SettingsSection<unknown>[] = [
  appearanceSection,
  terminalSection,
  filesSection,
  historySection,
  gitSection,
  claudeLinkSection,
  skillsSection,
  hudSection,
  activitySection,
  browserSection,
  graphSection,
  cliSection,
  sessionsSection,
  dashboardSection,
] as readonly SettingsSection<unknown>[];

/** main fills this with the theme store, loaded before the window exists (SET-17). */
export const themeStorePoint: ExtensionPoint<ThemeStore> = { id: 'settings.themes' };

/**
 * main side of settings: the channels over the settings store (SET-1 to SET-7, card 016), live reload
 * (SET-8, card 017) and themes (SET-11 to SET-16, card 018).
 */
export function register(ctx: ServiceContext): void {
  const store = ctx.contributions(settingsStorePoint)[0];
  const themes = ctx.contributions(themeStorePoint)[0];
  if (store === undefined || themes === undefined)
    throw new Error('settings: main did not provide the settings and theme stores.');
  const appearance = store.register(appearanceSection);
  for (const section of CONTRACT_SECTIONS) store.register(section);

  const allProblems = () => [...store.getProblems(), ...themes.problems(appearance.get().theme)];
  let lastProblems = JSON.stringify(allProblems());
  const publishProblems = () => {
    const problems = allProblems();
    const text = JSON.stringify(problems);
    if (text === lastProblems) return;
    lastProblems = text;
    ctx.bus.emit(settingsChannels.problemsChanged, problems);
  };
  let lastTheme = JSON.stringify(themes.active(appearance.get().theme));
  const publishTheme = () => {
    const theme = themes.active(appearance.get().theme);
    const text = JSON.stringify(theme);
    if (text !== lastTheme) {
      lastTheme = text;
      ctx.bus.emit(settingsChannels.activeThemeChanged, theme);
    }
    publishProblems();
  };

  ctx.bus.handle(settingsChannels.getSection, ({ moduleId }) => {
    const value = store.getSection(moduleId);
    return value === null ? err('NOT_FOUND', `No settings section for ${moduleId}.`) : ok(value);
  });
  ctx.bus.handle(settingsChannels.setValue, ({ moduleId, key, value }) =>
    store.setValue(moduleId, key, value),
  );
  ctx.bus.handle(settingsChannels.getProblems, () => ok(allProblems()));
  store.onSectionChanged((moduleId, value) =>
    ctx.bus.emit(settingsChannels.sectionChanged, { moduleId, value }),
  );
  store.onProblemsChanged(publishProblems);
  appearance.onChange(publishTheme);

  ctx.bus.handle(settingsChannels.listThemes, () => ok(themes.list()));
  ctx.bus.handle(settingsChannels.getActiveTheme, () => ok(themes.active(appearance.get().theme)));
  ctx.bus.handle(settingsChannels.saveTheme, async ({ theme }) => {
    const saved = await themes.save(theme);
    if (saved.ok) publishTheme();
    return saved;
  });

  // SET-8: edits on disk apply within a second; the files are re-read, never the event data (P-16).
  const reload: Record<SettingsFileKind, () => Promise<void>> = {
    settings: () => store.load(),
    keybindings: () => Promise.resolve(),
    themes: () => themes.load().then(publishTheme),
  };
  const stopWatching = watchSettingsFiles({
    settingsFile: ctx.paths.settingsFile,
    keybindingsFile: ctx.paths.keybindingsFile,
    themesDir: ctx.paths.themesDir,
    clock: ctx.clock,
    log: ctx.log,
    onChange: (kind) =>
      void reload[kind]().catch((error: unknown) =>
        ctx.log.log('warn', 'settings.reload_failed', { kind, message: String(error) }),
      ),
  });
  ctx.onStop(() => {
    stopWatching();
    return Promise.resolve();
  });
}
