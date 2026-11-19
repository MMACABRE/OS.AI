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
import { appearanceSection } from '@hsos/contracts/channels/settings';
import { skillsSection } from '@hsos/contracts/channels/skills';
import { terminalSection } from '@hsos/contracts/channels/terminal';
import { TOKEN_NAMES } from '@hsos/contracts/theme';
import phosphor from '../../../resources/themes/phosphor.json';
import type { ModuleFixtures } from '../demo-transport';
import { HOME } from './world';

const SECTIONS = [
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
];

const tokens: Record<string, string> = Object.fromEntries(
  TOKEN_NAMES.map((name) => [name, (phosphor.tokens as Record<string, string>)[name] ?? '']),
);
const PHOSPHOR = { name: 'Phosphor', kind: 'dark', tokens };
const settingsDir = `${HOME}\\AppData\\Roaming\\HSOS`;

/** The `settings` channels: every section at its defaults (the vault set), Phosphor active, no problems. */
export const settingsFixtures: ModuleFixtures = {
  requests: {
    'settings.getSection': (payload: { moduleId: string }) => {
      const section = SECTIONS.find((item) => item.moduleId === payload.moduleId);
      const defaults = (section?.defaults ?? {}) as Record<string, unknown>;
      return payload.moduleId === 'settings' ? { ...defaults, vaultPath: `${HOME}\\notes\\vault` } : defaults;
    },
    'settings.setValue': {},
    'settings.getProblems': [],
    'settings.listThemes': [
      { name: 'Phosphor', kind: 'dark', file: `${settingsDir}\\themes\\phosphor.json`, isBuiltIn: true },
      {
        name: 'Phosphor copy',
        kind: 'dark',
        file: `${settingsDir}\\themes\\phosphor-copy.json`,
        isBuiltIn: false,
      },
    ],
    'settings.getActiveTheme': PHOSPHOR,
    'settings.saveTheme': (payload: { theme: { name: string; kind: string } }) => ({
      name: payload.theme.name,
      kind: payload.theme.kind,
      file: `${settingsDir}\\themes\\${payload.theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      isBuiltIn: false,
    }),
    'settings.getKeybindings': {},
    'settings.setKeybinding': {},
    'settings.openFolder': {},
  },
};
