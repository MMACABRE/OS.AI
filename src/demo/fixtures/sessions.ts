import type { ModuleFixtures } from '../demo-transport';
import { ago, DAY, HSOS, MIN, SESSIONS, TERMINALS, VAULT } from './world';

const item = (
  sessionId: string,
  title: string,
  cwd: string,
  lastActiveAgo: number,
  messages: number,
  state: 'running' | 'ended' | 'interrupted' | 'untracked',
  liveTerminalId: string | null = null,
  note = '',
) => ({
  sessionId,
  title,
  cwd,
  startedAt: ago(lastActiveAgo + 40 * MIN),
  lastActiveAt: ago(lastActiveAgo),
  messages,
  state,
  liveTerminalId,
  hasOriginal: true,
  hasBackup: state !== 'untracked',
  note,
});

/** Recent sessions across both projects, live ones first. */
export const SESSION_LIST = [
  item(SESSIONS.dust.id, SESSIONS.dust.title, HSOS.path, 40_000, 48, 'running', TERMINALS.main),
  item(SESSIONS.ribbon.id, SESSIONS.ribbon.title, HSOS.path, 4 * MIN, 21, 'running', TERMINALS.review),
  item(SESSIONS.notes.id, SESSIONS.notes.title, VAULT.path, 90_000, 33, 'running'),
  item(SESSIONS.release.id, SESSIONS.release.title, HSOS.path, 18 * MIN, 12, 'ended'),
  item(
    '5e4d3c2b-1a09-4f8e-9d7c-6b5a49382716',
    'Spike the dock layout round trip',
    HSOS.path,
    2 * DAY,
    64,
    'ended',
    null,
    'Kept for the toJSON notes.',
  ),
  item(
    '7a6b5c4d-3e2f-4109-8a7b-6c5d4e3f2a1b',
    'Bus between processes',
    HSOS.path,
    3 * DAY,
    91,
    'interrupted',
  ),
  item(
    '1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9',
    'Weekly review of the vault',
    VAULT.path,
    6 * DAY,
    27,
    'ended',
  ),
  item('c0ffee12-3456-4789-abcd-ef0123456789', 'Untitled session', HSOS.path, 9 * DAY, 4, 'untracked'),
];

const transcript = [
  { role: 'user', text: 'the dust behind the terminal is too bright when steam rises. can you cap it?' },
  { role: 'assistant', text: "I'll look at how the scene picks pixel brightness before changing anything." },
  { role: 'tool', text: 'Read src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts (214 lines)' },
  {
    role: 'assistant',
    text: 'The steam pass adds glow without a ceiling, so two sources can push a pixel past 0.6 of the accent.',
  },
  { role: 'tool', text: 'Update phosphor-dust.ts: 3 additions, 1 removal' },
  { role: 'tool', text: 'Bash npm run check: typecheck ok, lint ok, 214 tests passed' },
  {
    role: 'assistant',
    text: 'Done. No pixel can pass the cap now, so muted text keeps 4.7:1 at the glass floor.',
  },
] as const;

/** The `sessions` channels. */
export const sessionsFixtures: ModuleFixtures = {
  requests: {
    'sessions.list': SESSION_LIST,
    'sessions.getResumeOffer': {
      sessionId: SESSIONS.release.id,
      title: SESSIONS.release.title,
      cwd: HSOS.path,
      hasOriginal: true,
    },
    'sessions.bind': {},
    'sessions.restoreTranscript': {
      path: `C:\\Users\\owner\\.claude\\projects\\hsos\\${SESSIONS.release.id}.jsonl`,
    },
    'sessions.readTranscript': {
      items: transcript.map((entry, index) => ({
        index,
        role: entry.role,
        time: ago((transcript.length - index) * 2 * MIN),
        text: entry.text,
      })),
      total: transcript.length,
    },
    'sessions.rename': { title: 'Cap dust brightness', writtenToTranscript: true },
    'sessions.setNote': {},
    'sessions.trash': (payload: { sessionIds: string[] }) => ({ trashed: payload.sessionIds, failed: [] }),
  },
  events: [],
};
