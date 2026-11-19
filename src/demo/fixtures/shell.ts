import type { ModuleFixtures } from '../demo-transport';
import { ago, HOUR, MIN, NOW } from './world';

const ready = (service: string) => ({ service, state: 'ready', recentDeaths: 0, needsManualRestart: false });

/** The `shell` channels in demo mode: every service ready, system actions answer and do nothing. */
export const shellFixtures: ModuleFixtures = {
  requests: {
    'shell.uiReady': {},
    'shell.getServiceStatus': [ready('pty-host'), ready('workspace-service'), ready('link-service')],
    'shell.restartService': {},
    'shell.windowAction': {},
    'shell.pickFolder': null,
    'shell.trashItem': {},
    'shell.openExternal': {},
    'shell.openPath': {},
    'shell.openFolder': {},
    'shell.revealInExplorer': {},
    'shell.notify': {},
    'shell.getLaunchToken': { token: 'demo-token-not-a-secret-0123456789abcdef' },
    'shell.speak': {},
    'shell.listVoices': ['Microsoft Aria', 'Microsoft Guy', 'Microsoft Jenny'],
    'shell.writeClipboard': {},
  },
};

const record = (minutesAgo: number, level: 'info' | 'warn' | 'error', module: string, event: string) => ({
  time: ago(minutesAgo * MIN),
  process: 'main',
  module,
  level,
  event,
});

/** The `diagnostics` channels in demo mode. */
export const diagnosticsFixtures: ModuleFixtures = {
  requests: {
    'diagnostics.write': {},
    'diagnostics.getRecent': [
      record(42, 'info', 'shell', 'service_ready'),
      record(31, 'warn', 'settings', 'settings.reload_failed'),
      record(4, 'info', 'diagnostics', 'diagnostics.crash_files_removed'),
    ],
    'diagnostics.getHealth': [
      { process: 'main', pid: 11_204, memoryMb: 142.6, uptimeMs: NOW - ago(2 * HOUR) },
      { process: 'pty-host', pid: 11_388, memoryMb: 58.1, uptimeMs: 2 * HOUR },
      { process: 'workspace-service', pid: 11_392, memoryMb: 96.4, uptimeMs: 2 * HOUR },
      { process: 'link-service', pid: 11_400, memoryMb: 41.9, uptimeMs: 2 * HOUR },
      { process: 'ui', pid: 11_512, memoryMb: 231.7, uptimeMs: 2 * HOUR },
    ],
    'diagnostics.openLogFolder': {},
  },
};

/** The `dashboard` channels: no saved file, so the dashboard draws its default layout. */
export const dashboardFixtures: ModuleFixtures = {
  requests: {
    'dashboard.load': null,
    'dashboard.save': {},
  },
};
