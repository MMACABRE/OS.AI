import type { ModuleFixtures } from '../demo-transport';
import { ago, HOME, HOUR, HSOS, MIN, NOW, p, SESSIONS, TERMINALS, VAULT } from './world';

const subagent = (
  agentId: string,
  agentType: string,
  description: string,
  startedAgo: number,
  tool: string | null,
) => ({
  agentId,
  agentType,
  model: 'Sonnet 5.5',
  description,
  startedAt: ago(startedAgo),
  endedAt: null,
  currentTool: tool,
});

const session = (
  base: { id: string; title: string },
  extra: Partial<Record<string, unknown>> & { activity: string; terminalId: string | null },
) => ({
  sessionId: base.id,
  cwd: HSOS.path,
  title: base.title,
  model: 'Opus 5.5',
  modelId: 'claude-opus-5-5',
  effort: 'high',
  permissionMode: 'acceptEdits',
  attentionReason: null,
  currentTool: null,
  startedAt: ago(2 * HOUR),
  lastResponseAt: ago(40_000),
  contextUsedPercentage: 34,
  contextTokens: 68_000,
  contextWindowSize: 200_000,
  costUsd: 1.84,
  lastMessage: null,
  subagents: [],
  ...extra,
});

/** Four sessions, one in each lively activity, two subagents working under the first. */
export const CLAUDE_SESSIONS = [
  session(SESSIONS.dust, {
    activity: 'working',
    terminalId: TERMINALS.main,
    currentTool: 'Bash(npm run check)',
    contextUsedPercentage: 41,
    contextTokens: 82_400,
    costUsd: 2.37,
    lastMessage: 'Clamping each channel after the steam is mixed in.',
    subagents: [
      subagent('agent-explore-1', 'Explore', 'Find every place the scene sets brightness', 6 * MIN, 'Grep'),
      subagent('agent-review-2', 'code-reviewer', 'Check the clamp keeps the steam visible', 2 * MIN, 'Read'),
    ],
  }),
  session(SESSIONS.ribbon, {
    activity: 'needs-you',
    terminalId: TERMINALS.review,
    attentionReason: 'Claude needs your permission to use Bash',
    startedAt: ago(50 * MIN),
    lastResponseAt: ago(4 * MIN),
    contextUsedPercentage: 22,
    contextTokens: 44_000,
    costUsd: 0.91,
    lastMessage: 'May I run npm run test -- ribbon?',
  }),
  session(SESSIONS.notes, {
    activity: 'background',
    terminalId: null,
    cwd: VAULT.path,
    model: 'Sonnet 5.5',
    modelId: 'claude-sonnet-5-5',
    effort: 'medium',
    currentTool: 'Edit(motion.md)',
    startedAt: ago(35 * MIN),
    lastResponseAt: ago(90_000),
    contextUsedPercentage: 63,
    contextTokens: 126_000,
    costUsd: 1.12,
    lastMessage: 'Adding wiki links between the motion notes.',
  }),
  session(SESSIONS.release, {
    activity: 'done',
    terminalId: null,
    model: 'Haiku 5.5',
    modelId: 'claude-haiku-5-5',
    effort: null,
    startedAt: ago(5 * HOUR),
    lastResponseAt: ago(18 * MIN),
    contextUsedPercentage: 12,
    contextTokens: 24_000,
    costUsd: 0.21,
    lastMessage: 'The release notes are in docs/release/stage-u.md.',
  }),
];

const event = (
  sessionId: string,
  minutesAgo: number,
  kind: string,
  label: string,
  path: string | null = null,
) => ({
  sessionId,
  agentId: null,
  time: ago(minutesAgo * MIN),
  kind,
  label,
  path,
});

/** The `claude-link` channels: the link is listening, usage is 58 % (5 h) and 21 % (7 d). */
export const claudeLinkFixtures: ModuleFixtures = {
  requests: {
    'link.getStatus': {
      isListening: true,
      port: 47_600,
      claudeFound: true,
      claudeVersion: '3.4.1',
      lastMessageAt: ago(20_000),
    },
    'link.listSessions': CLAUDE_SESSIONS,
    'link.getUsageLimits': {
      fiveHour: { usedPercentage: 58, resetsAt: NOW + 2 * HOUR + 14 * MIN },
      sevenDay: { usedPercentage: 21, resetsAt: NOW + 4 * 24 * HOUR },
      updatedAt: ago(30_000),
    },
    'link.markSeen': {},
    'link.getSessionEvents': (payload: { sessionId: string }) => [
      event(payload.sessionId, 42, 'prompt', 'the dust behind the terminal is too bright'),
      event(
        payload.sessionId,
        41,
        'tool',
        'Read phosphor-dust.ts',
        p('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts'),
      ),
      event(payload.sessionId, 40, 'subagent-start', 'Explore: find every brightness setting'),
      event(
        payload.sessionId,
        33,
        'file-edit',
        'Update phosphor-dust.ts',
        p('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts'),
      ),
      event(payload.sessionId, 31, 'tool-failed', 'Bash npm run check (1 lint error)'),
      event(
        payload.sessionId,
        29,
        'file-edit',
        'Update phosphor-dust.ts',
        p('src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts'),
      ),
      event(payload.sessionId, 27, 'tool', 'Bash npm run check'),
      event(payload.sessionId, 26, 'stop', 'Done: steam capped at 0.6 of the accent'),
    ],
    'link.getSetup': {
      mcpServers: [
        {
          name: 'hsos',
          scope: 'user',
          transport: 'http',
          target: 'http://127.0.0.1:47600/mcp',
          enabled: true,
          file: `${HOME}\\.claude.json`,
          lastUse: { at: ago(4 * MIN), count: 37, source: 'hsos' },
        },
        {
          name: 'github',
          scope: 'project',
          transport: 'stdio',
          target: 'npx @github/mcp',
          enabled: true,
          file: p('.mcp.json'),
          lastUse: { at: ago(3 * HOUR), count: 5, source: 'claude' },
        },
      ],
      plugins: [
        {
          id: 'mattpocock-skills',
          version: '1.3.1',
          scope: 'user',
          enabled: true,
          installedAt: ago(9 * 24 * HOUR),
          file: `${HOME}\\.claude\\settings.json`,
          lastUse: null,
        },
      ],
      skillUse: { hsluck: { at: ago(2 * HOUR), count: 12, source: 'claude' } },
      agents: [
        {
          name: 'code-reviewer',
          scope: 'user',
          file: `${HOME}\\.claude\\agents\\code-reviewer.md`,
          lastUse: { at: ago(2 * MIN), count: 9, source: 'claude' },
        },
      ],
      hooks: [{ event: 'Stop', handlers: 1, scope: 'user', file: `${HOME}\\.claude\\settings.json` }],
      permissions: [
        { rule: 'Bash(npm run check)', effect: 'allow', scope: 'project', file: p('.claude\\settings.json') },
        { rule: 'Bash(git push:*)', effect: 'ask', scope: 'user', file: `${HOME}\\.claude\\settings.json` },
      ],
      errors: [],
      readAt: ago(60_000),
    },
    'link.getLocalEndpoint': {
      port: 47_600,
      pluginDir: `${HOME}\\AppData\\Local\\HSOS\\link\\plugin`,
      sessionSettingsFile: `${HOME}\\AppData\\Local\\HSOS\\link\\session-settings.json`,
    },
  },
  events: [
    {
      channel: 'link.sessionEvent',
      everyMs: 9_000,
      payload: () => event(SESSIONS.dust.id, 0, 'tool', 'Bash npm run check'),
    },
  ],
};
