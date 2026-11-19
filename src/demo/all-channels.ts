import type { EventChannel, RequestChannel } from '@hsos/contracts/bus';
import { activityChannels } from '@hsos/contracts/channels/activity';
import { browserChannels } from '@hsos/contracts/channels/browser';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import { dashboardChannels } from '@hsos/contracts/channels/dashboard';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import { filesChannels } from '@hsos/contracts/channels/files';
import { gitChannels } from '@hsos/contracts/channels/git';
import { graphChannels } from '@hsos/contracts/channels/graph';
import { historyChannels } from '@hsos/contracts/channels/history';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';

const MAPS: readonly Record<string, RequestChannel<unknown, unknown> | EventChannel<unknown>>[] = [
  activityChannels,
  browserChannels,
  claudeLinkChannels,
  dashboardChannels,
  diagnosticsChannels,
  filesChannels,
  gitChannels,
  graphChannels,
  historyChannels,
  reviewChannels,
  sessionsChannels,
  settingsChannels,
  shellChannels,
  skillsChannels,
  terminalChannels,
  workspaceChannels,
] as readonly Record<string, RequestChannel<unknown, unknown> | EventChannel<unknown>>[];

/** Every request channel declared in the contracts, by name. */
export const REQUEST_CHANNELS: ReadonlyMap<string, RequestChannel<unknown, unknown>> = new Map(
  MAPS.flatMap((map) => Object.values(map))
    .filter((channel): channel is RequestChannel<unknown, unknown> => channel.kind === 'request')
    .map((channel) => [channel.name, channel]),
);

/** Every event channel declared in the contracts, by name. */
export const EVENT_CHANNELS: ReadonlyMap<string, EventChannel<unknown>> = new Map(
  MAPS.flatMap((map) => Object.values(map))
    .filter((channel): channel is EventChannel<unknown> => channel.kind === 'event')
    .map((channel) => [channel.name, channel]),
);
