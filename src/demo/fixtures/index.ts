import type { ModuleFixtures } from '../demo-transport';
import { activityFixtures } from './activity';
import { browserFixtures } from './browser';
import { claudeLinkFixtures } from './claude-link';
import { filesFixtures } from './files';
import { gitFixtures } from './git';
import { graphFixtures } from './graph';
import { historyFixtures } from './history';
import { reviewFixtures } from './review';
import { sessionsFixtures } from './sessions';
import { settingsFixtures } from './settings';
import { dashboardFixtures, diagnosticsFixtures, shellFixtures } from './shell';
import { skillsFixtures } from './skills';
import { terminalFixtures } from './terminal';
import { workspaceFixtures } from './workspace';

/** Every module's fixtures (card 026). Channels not listed in any file are filled from their schema. */
export const ALL_FIXTURES: readonly ModuleFixtures[] = [
  workspaceFixtures,
  terminalFixtures,
  claudeLinkFixtures,
  sessionsFixtures,
  skillsFixtures,
  gitFixtures,
  filesFixtures,
  graphFixtures,
  activityFixtures,
  historyFixtures,
  reviewFixtures,
  settingsFixtures,
  shellFixtures,
  diagnosticsFixtures,
  dashboardFixtures,
  browserFixtures,
];
