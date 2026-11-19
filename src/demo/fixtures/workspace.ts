import type { ModuleFixtures } from '../demo-transport';
import { ago, DAY, HOUR, HSOS, PROJECTS, VAULT } from './world';

/** The `workspace` channels: the hsos project is open, the vault and an old folder are recent. */
export const workspaceFixtures: ModuleFixtures = {
  requests: {
    'workspace.getCurrentProject': HSOS,
    'workspace.openProject': (payload: { path: string }) =>
      PROJECTS.find((project) => project.path === payload.path) ?? HSOS,
    'workspace.listRecentProjects': [
      { path: HSOS.path, name: HSOS.name, lastOpened: ago(5 * 60_000), exists: true },
      { path: VAULT.path, name: VAULT.name, lastOpened: ago(3 * HOUR), exists: true },
      {
        path: 'C:\\Users\\owner\\code\\old-site',
        name: 'old-site',
        lastOpened: ago(40 * DAY),
        exists: false,
      },
    ],
    // No saved layout: the frame draws its default Code page (WS-12).
    'workspace.loadWorkspace': null,
    'workspace.saveWorkspace': {},
    'workspace.closeProject': {},
    'workspace.forgetRecentProject': {},
    'workspace.requestOpenPanel': {},
    'workspace.listOpenPanels': [],
  },
};
