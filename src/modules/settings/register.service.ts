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

/** main side of settings: the channels over the store (SET-1 to SET-7, card 016). */
export function register(ctx: ServiceContext): void {
  const store = ctx.contributions(settingsStorePoint)[0];
  if (store === undefined) throw new Error('settings: main did not provide the settings store.');
  for (const section of CONTRACT_SECTIONS) store.register(section);

  ctx.bus.handle(settingsChannels.getSection, ({ moduleId }) => {
    const value = store.getSection(moduleId);
    return value === null ? err('NOT_FOUND', `No settings section for ${moduleId}.`) : ok(value);
  });
  ctx.bus.handle(settingsChannels.setValue, ({ moduleId, key, value }) =>
    store.setValue(moduleId, key, value),
  );
  ctx.bus.handle(settingsChannels.getProblems, () => ok(store.getProblems()));
  store.onSectionChanged((moduleId, value) =>
    ctx.bus.emit(settingsChannels.sectionChanged, { moduleId, value }),
  );
  store.onProblemsChanged((problems) => ctx.bus.emit(settingsChannels.problemsChanged, problems));
}
