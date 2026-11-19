import type { DemoEmitter, ModuleFixtures } from '../demo-transport';
import { bytesFromDataUrl, createTerminalReplay, parseReplay } from '../terminal-replay';
import replayUrl from './terminal-claude.bin?inline';
import { ago, HOUR, HSOS, MIN, p, TERMINALS } from './world';

const replay = createTerminalReplay(parseReplay(bytesFromDataUrl(replayUrl)));

const info = (id: string, launch: string | null, startedAt: number, cwd: string = HSOS.path) => ({
  id,
  projectId: HSOS.id,
  cwd,
  shellPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  worktree: null,
  launch,
  startedAt,
  cols: 120,
  rows: 32,
  state: 'running' as const,
  exitCode: null,
});

export const TERMINAL_INFOS = [
  info(TERMINALS.main, 'claude', ago(2 * HOUR)),
  info(TERMINALS.review, 'claude', ago(50 * MIN)),
  info(TERMINALS.shell, null, ago(25 * MIN), p('src')),
];

/**
 * The `terminal` channels: three running terminals; each replays the recorded Claude session once attached,
 * and typed keys are echoed (card 026 step 3).
 */
export const terminalFixtures: ModuleFixtures = {
  requests: {
    'terminal.list': TERMINAL_INFOS,
    'terminal.create': (payload: { cwd: string; launch: string | null }) => ({
      ...info('term00000009', payload.launch, ago(0), payload.cwd),
    }),
    'terminal.attach': (payload: { id: string }, demo: DemoEmitter) => {
      const found = TERMINAL_INFOS.find((terminal) => terminal.id === payload.id) ?? TERMINAL_INFOS[0];
      return { info: found, replay: new Uint8Array(0), lastSeq: replay.attach(demo, payload.id) };
    },
    'terminal.write': (payload: { id: string; data: string }, demo: DemoEmitter) => {
      replay.write(demo, payload.id, payload.data);
      return {};
    },
    'terminal.getLastOwnerInput': { at: ago(3 * MIN) },
    'terminal.resize': {},
    'terminal.ack': {},
    'terminal.kill': (payload: { id: string }) => {
      replay.stop(payload.id);
      return {};
    },
    'terminal.isBusy': true,
    'terminal.storeScrollback': {},
    'terminal.takeScrollback': null,
    'terminal.hostInfo': { elevated: false },
    'terminal.setExtraEnv': {},
  },
};
