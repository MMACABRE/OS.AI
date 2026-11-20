import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RepoSync, SkillInfo } from '@hsos/contracts/channels/skills';
import { zAbsPath } from '@hsos/contracts/schemas';
import { ToastProvider } from '@hsos/ui-kit';
import { HudPanel } from '../../src/modules/hud/panel/HudPanel';
import { HudDepsContext } from '../../src/modules/hud/panel/hud-context';
import { useHudData } from '../../src/modules/hud/panel/hud-data';
import { createFakeBus } from '../fakes/fake-bus';
import { sourceClassNames } from '../ui-kit/css-composes';

class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
});

const initial = useHudData.getState();
afterEach(() => {
  cleanup();
  useHudData.setState(initial, true);
});

const skill = (name: string): SkillInfo => ({
  name,
  description: `The ${name} skill`,
  source: 'user',
  plugin: null,
  file: zAbsPath.parse(`C:\\Users\\x\\.agents\\skills\\${name}\\SKILL.md`),
  isFavourite: false,
  state: 'on' as SkillInfo['state'],
  stateSource: 'default',
  stateLock: null,
});

const inSync: RepoSync = {
  state: 'in-sync',
  changed: [],
  added: [],
  removed: [],
  ahead: 0,
  behind: 0,
  isOffline: false,
  error: null,
  checkedAt: 1 as RepoSync['checkedAt'],
};

function renderHud() {
  const deps = {
    bus: createFakeBus(),
    log: { log: vi.fn() },
    openPanel: () => undefined,
    setSetting: () => Promise.resolve(true),
    hasCommand: () => false,
    runCommand: () => undefined,
  };
  return render(
    <ToastProvider>
      <HudDepsContext.Provider value={deps}>
        <HudPanel
          panelId={'panel-000001' as never}
          state={{ collapsed: [] }}
          setState={() => undefined}
          isFocused={false}
        />
      </HudDepsContext.Provider>
    </ToastProvider>,
  );
}

describe('OWNER-1 the skills repo row sits above the skills search', () => {
  it('OWNER-1 the Skills section holds the repo row before the search field, and no "Skills repo" section title exists', () => {
    useHudData.setState({
      skills: { kind: 'ready', value: [skill('caveman'), skill('grilling')] },
      repoSync: { kind: 'ready', value: inSync },
    });
    const { container } = renderHud();
    const section = screen.getByRole('region', { name: 'Skills' });
    const repoRow = [...section.querySelectorAll('div')].find((element) =>
      sourceClassNames(element).includes('repoRow'),
    );
    const search = screen.getByRole('textbox', { name: 'Search skills' });
    expect(repoRow).toBeDefined();
    expect(section.contains(repoRow as HTMLElement)).toBe(true);
    expect(section.contains(search)).toBe(true);
    expect(
      (repoRow as HTMLElement).compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Skills repo' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Skills repo$/ })).toBeNull();
    const titles = [...container.querySelectorAll('section')].map((element) =>
      element.getAttribute('aria-label'),
    );
    expect(titles).toEqual(['Sessions', 'Usage', 'Skills']);
  });

  it('OWNER-1 the repo row is above the search also when the repo is not configured', () => {
    useHudData.setState({
      skills: { kind: 'ready', value: [skill('caveman')] },
      repoSync: { kind: 'ready', value: { ...inSync, state: 'not-configured' } },
    });
    renderHud();
    const section = screen.getByRole('region', { name: 'Skills' });
    const note = screen.getByText('Skills repo not found');
    const search = screen.getByRole('textbox', { name: 'Search skills' });
    expect(section.contains(note)).toBe(true);
    expect(note.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
