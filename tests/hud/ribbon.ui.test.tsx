import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';
import { zAbsPath, zProjectId, zTerminalId } from '@hsos/contracts/schemas';
import { createFakeBus } from '../fakes/fake-bus';
import { sessionForTerminal, useHudData } from '../../src/modules/hud/panel/hud-data';
import {
  createRibbon,
  elapsedSince,
  listedAgents,
  shortFolder,
} from '../../src/modules/hud/panel/ribbon/Ribbon';
import { visibleBackdropSources } from '../../src/modules/ui-kit/backdrop/sources';
import { sourceClassNames } from '../ui-kit/css-composes';
import { makeAgent, makeSession } from './hud-fixtures';

const t1 = zTerminalId.parse('terminal-001');
const t2 = zTerminalId.parse('terminal-002');
const initial = useHudData.getState();

class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
});

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
    () => [new DOMRect(10, 10, 100, 30)] as unknown as DOMRectList,
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(10, 10, 100, 30),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  useHudData.setState(initial, true);
});

const RibbonFor = createRibbon({ bus: createFakeBus(), openPanel: () => undefined });
const seed = (...sessions: ReturnType<typeof makeSession>[]) =>
  useHudData.setState({ sessions: new Map(sessions.map((session) => [session.sessionId, session])) });

const project: ProjectInfo = {
  id: zProjectId.parse('0123456789abcdef'),
  path: zAbsPath.parse('C:\\Users\\x\\code\\app'),
  name: 'app',
};
const repo: RepoStatus = {
  kind: 'repo',
  root: project.path,
  branch: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  files: [],
  operation: 'none',
  lastFetchAt: null,
  isOffline: false,
  remoteUrl: 'https://github.com/acme/app',
  webUrl: 'https://github.com/acme/app',
  busy: 'none',
};

const BRAND: [number, number, number] = [255, 0, 60];
const LIVE: [number, number, number] = [0, 240, 255];
const colourOf = (token: string) => (token === 'color.brand' ? BRAND : LIVE);

describe('HUD-80 the ribbon follows the session of a terminal', () => {
  it('HUD-80 a working session on t1 shows a ribbon inside [data-surface="ribbon"]; an ended one on t2 renders nothing', () => {
    seed(
      makeSession({ sessionId: 's1', terminalId: t1, activity: 'working' }),
      makeSession({ sessionId: 's2', terminalId: t2, activity: 'ended' }),
    );
    const first = render(<RibbonFor terminalId={t1} />);
    expect(first.container.querySelector('[data-surface="ribbon"]')).not.toBeNull();
    expect(first.container.querySelector('[data-activity="working"]')).not.toBeNull();
    first.unmount();
    const second = render(<RibbonFor terminalId={t2} />);
    expect(second.container.innerHTML).toBe('');
  });

  it('HUD-80 a working ribbon is a color.live steam source, and needs-you turns it to color.brand', () => {
    seed(makeSession({ terminalId: t1, activity: 'working' }));
    const { container } = render(<RibbonFor terminalId={t1} />);
    const viewport = { width: 1000, height: 1000 };
    const before = visibleBackdropSources(colourOf as never, viewport);
    expect(before).toHaveLength(1);
    expect(before[0]?.colour).toEqual(LIVE);

    act(() => seed(makeSession({ terminalId: t1, activity: 'needs-you' })));
    expect(container.querySelector('[data-activity="needs-you"]')).not.toBeNull();
    const after = visibleBackdropSources(colourOf as never, viewport);
    expect(after).toHaveLength(1);
    expect(after[0]?.colour).toEqual(BRAND);
  });

  it('HUD-80 the steam source leaves when the ribbon unmounts', () => {
    seed(makeSession({ terminalId: t1 }));
    const { unmount } = render(<RibbonFor terminalId={t1} />);
    expect(visibleBackdropSources(colourOf as never, { width: 1000, height: 1000 })).toHaveLength(1);
    unmount();
    expect(visibleBackdropSources(colourOf as never, { width: 1000, height: 1000 })).toHaveLength(0);
  });
});

describe('HUD-81 the parts of the first line', () => {
  it('HUD-81 reads mascot, title, model and effort, mode, folder, repo, context bar and 72% toned warn', () => {
    seed(makeSession({ terminalId: t1 }));
    useHudData.setState({ project, repo });
    const { container } = render(<RibbonFor terminalId={t1} />);
    const mascot = screen.getByRole('button', { name: 'Expand the ribbon' });
    const title = screen.getByRole('button', { name: 'Fix the ribbon' });
    const model = screen.getByText(
      (_, element) =>
        element !== null &&
        sourceClassNames(element).includes('model') &&
        element.textContent === 'Opus 5.5 · high',
    );
    const mode = screen.getByRole('button', { name: 'Plan' });
    const folder = screen.getByRole('button', { name: '~\\code\\app' });
    const repoButton = screen.getByRole('button', { name: /^acme\/app\s*main$/ });
    const bar = screen.getByRole('progressbar', { name: 'Context 72 percent' });
    const percent = screen.getByText('72%');
    const parts = [mascot, title, model, mode, folder, repoButton, bar, percent];
    for (let index = 1; index < parts.length; index += 1) {
      const earlier = parts[index - 1] as HTMLElement;
      const later = parts[index] as HTMLElement;
      expect(
        earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
        `part ${index}`,
      ).toBeTruthy();
    }
    expect(mascot.querySelector('[data-mascot]')).not.toBeNull();
    // 72 percent is in the warn band (70 to 90), on the bar and on the number.
    expect(sourceClassNames(bar.firstElementChild as Element)).toContain('warn');
    expect(sourceClassNames(percent.closest('span[class*="_warn_"]') as Element)).toContain('warn');
    expect(container.querySelector('[class*="_danger_"]')).toBeNull();
  });

  it('HUD-81 context 95 is toned danger, 40 is toned ok', () => {
    seed(makeSession({ terminalId: t1, contextUsedPercentage: 95 }));
    const first = render(<RibbonFor terminalId={t1} />);
    expect(sourceClassNames(screen.getByRole('progressbar').firstElementChild as Element)).toContain(
      'danger',
    );
    first.unmount();
    act(() => seed(makeSession({ terminalId: t1, contextUsedPercentage: 40 })));
    render(<RibbonFor terminalId={t1} />);
    expect(sourceClassNames(screen.getByRole('progressbar').firstElementChild as Element)).toContain('ok');
  });

  it('HUD-81 the repo is not shown when the session folder is outside the project', () => {
    seed(makeSession({ terminalId: t1, cwd: 'D:\\elsewhere\\thing' }));
    useHudData.setState({ project, repo });
    render(<RibbonFor terminalId={t1} />);
    expect(screen.queryByRole('button', { name: /acme\/app/ })).toBeNull();
  });
});

describe('HUD-82 the expanded ribbon lists subagents', () => {
  const NOW = 10_000_000;

  it('HUD-82 two running subagents and ones that ended 30 s and 90 s ago: three rows, the 30 s one with done', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    seed(
      makeSession({
        terminalId: t1,
        subagents: [
          makeAgent('run-a', null, NOW - 60_000),
          makeAgent('run-b', null, NOW - 5_000),
          makeAgent('end-30', NOW - 30_000, NOW - 90_000),
          makeAgent('end-90', NOW - 90_000, NOW - 150_000),
        ],
      }),
    );
    render(<RibbonFor terminalId={t1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand the ribbon' }));
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    const text = rows.map((row) => row.textContent ?? '');
    expect(text[0]).toContain('type-run-a');
    expect(text[0]).toContain('Haiku 4.5');
    expect(text[0]).toContain('Toolrun-a');
    expect(text[2]).toContain('type-end-30');
    expect(text[2]).toContain('done');
    expect(text.join(' ')).not.toContain('end-90');
  });

  it('HUD-82 with no subagents, the expanded ribbon says No subagents running.', () => {
    seed(makeSession({ terminalId: t1, subagents: [] }));
    render(<RibbonFor terminalId={t1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand the ribbon' }));
    expect(screen.getByText('No subagents running.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse the ribbon' }));
    expect(screen.queryByText('No subagents running.')).toBeNull();
  });
});

describe('HUD-83 the context number rolls', () => {
  it('HUD-83 context 41 to 42 gives only the changed digit the roll spans', () => {
    seed(makeSession({ terminalId: t1, contextUsedPercentage: 41 }));
    const { container } = render(<RibbonFor terminalId={t1} />);
    const rolling = () =>
      [...container.querySelectorAll('span')].filter((span) => {
        const names = sourceClassNames(span);
        return names.includes('in') || names.includes('out');
      });
    expect(rolling()).toHaveLength(0);
    act(() => seed(makeSession({ terminalId: t1, contextUsedPercentage: 42 })));
    expect(rolling().map((span) => span.textContent)).toEqual(['1', '2']);
    const cell = rolling()[0]?.parentElement as HTMLElement;
    expect(cell.parentElement?.firstElementChild).not.toBe(cell);
    expect(cell.textContent).toBe('12');
  });
});

describe('HUD-92 mini mascots', () => {
  it('HUD-92 seven running subagents give five mini mascots and +2', () => {
    const agents = Array.from({ length: 7 }, (_, index) => makeAgent(`a${index}`, null));
    seed(makeSession({ terminalId: t1, subagents: agents }));
    const { container } = render(<RibbonFor terminalId={t1} />);
    const minis = [...container.querySelectorAll('[data-mascot]')].filter((mascot) =>
      sourceClassNames(mascot).includes('small'),
    );
    expect(minis).toHaveLength(5);
    for (const mini of minis) expect(mini.getAttribute('data-mascot')).toBe('dancing');
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('HUD-92 three running subagents give three mini mascots and no +n', () => {
    const agents = Array.from({ length: 3 }, (_, index) => makeAgent(`a${index}`, null));
    seed(makeSession({ terminalId: t1, subagents: agents }));
    const { container } = render(<RibbonFor terminalId={t1} />);
    const minis = [...container.querySelectorAll('[data-mascot]')].filter((mascot) =>
      sourceClassNames(mascot).includes('small'),
    );
    expect(minis).toHaveLength(3);
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });
});

describe('ribbon helpers', () => {
  it('HUD-81 shortFolder puts ~ for the home folder and cuts the middle of a long path', () => {
    expect(shortFolder('C:\\Users\\x\\code\\app')).toBe('~\\code\\app');
    const long = shortFolder('C:\\Users\\name\\code\\a-very-long-project-folder-name\\src\\deep');
    expect(long).toHaveLength(32);
    expect(long).toContain('…');
    expect(long.startsWith('~\\code')).toBe(true);
    expect(long.endsWith('\\src\\deep')).toBe(true);
    expect(shortFolder('D:\\data')).toBe('D:\\data');
  });

  it('HUD-80 sessionForTerminal picks the newest session of the terminal that has not ended', () => {
    const older = makeSession({ sessionId: 's1', terminalId: t1, startedAt: 1_000 });
    const newer = makeSession({ sessionId: 's2', terminalId: t1, startedAt: 2_000 });
    const ended = makeSession({ sessionId: 's3', terminalId: t1, startedAt: 3_000, activity: 'ended' });
    const other = makeSession({ sessionId: 's4', terminalId: t2, startedAt: 4_000 });
    const sessions = new Map([older, newer, ended, other].map((session) => [session.sessionId, session]));
    expect(sessionForTerminal(sessions, t1)?.sessionId).toBe('s2');
    expect(sessionForTerminal(sessions, t2)?.sessionId).toBe('s4');
    expect(sessionForTerminal(sessions, zTerminalId.parse('terminal-009'))).toBeNull();
  });

  it('HUD-82 elapsedSince gives 42s, 12m and 3h 05m', () => {
    expect(elapsedSince(0, 42_000)).toBe('42s');
    expect(elapsedSince(0, 12 * 60_000)).toBe('12m');
    expect(elapsedSince(0, (3 * 60 + 5) * 60_000)).toBe('3h 05m');
  });

  it('HUD-82 listedAgents keeps running agents and those that ended under 60 s ago', () => {
    const now = 1_000_000;
    const listed = listedAgents(
      [
        makeAgent('run', null),
        makeAgent('e30', now - 30_000),
        makeAgent('e59', now - 59_999),
        makeAgent('e60', now - 60_000),
      ],
      now,
    ).map((agent) => agent.agentId);
    expect(listed).toEqual(['run', 'e30', 'e59']);
  });
});
