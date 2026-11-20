import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { RecentProject } from '@hsos/contracts/channels/workspace';
import type { PanelDefinition } from '@hsos/contracts/module';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { AppFrame } from '../../src/modules/workspace/panel/AppFrame';
import { usePageStore } from '../../src/modules/workspace/panel/page-store';
import { WelcomeView } from '../../src/modules/workspace/panel/WelcomeView';
import { abs, PROJECT } from '../fakes/fixtures';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

const DAY = 86_400_000;

const recent = (name: string, exists: boolean, ageMs: number) =>
  RecentProject.parse({ path: `C:\\code\\${name}`, name, lastOpened: Date.now() - ageMs, exists });

function setup(projects: readonly RecentProject[], picked: string | null = null) {
  const bus = createStubBus();
  bus.answer(workspaceChannels.listRecentProjects, () => ok([...projects]));
  bus.answer(workspaceChannels.openProject, () => ok(PROJECT));
  bus.answer(workspaceChannels.forgetRecentProject, () => ok({}));
  bus.answer(shellChannels.pickFolder, () => ok(picked === null ? null : abs('.')));
  render(
    <ToastProvider>
      <WelcomeView bus={bus} />
    </ToastProvider>,
  );
  return bus;
}

describe('welcome view (card 036 part 1)', () => {
  it('WS-5 a missing project is muted with a disabled row and "Remove from list"; the other shows its age', async () => {
    setup([recent('alive', true, 3 * DAY), recent('gone', false, 10 * DAY)]);
    const alive = (await screen.findByText('alive')).closest('li') as HTMLElement;
    const gone = screen.getByText('gone').closest('li') as HTMLElement;
    expect(gone.hasAttribute('data-missing')).toBe(true);
    expect((within(gone).getByRole('button', { name: /gone/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(gone).getByRole('button', { name: 'Remove from list' })).toBeTruthy();
    expect(within(alive).getByText('3 days ago')).toBeTruthy();
    expect(within(alive).queryByRole('button', { name: 'Remove from list' })).toBeNull();
    expect(alive.hasAttribute('data-missing')).toBe(false);
  });

  it('WS-5b Enter on a focused recent project opens it', async () => {
    const bus = setup([recent('alive', true, DAY)]);
    const row = await screen.findByRole('button', { name: /alive/ });
    row.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(bus.payloadsOf(workspaceChannels.openProject)).toEqual([{ path: 'C:\\code\\alive' }]),
    );
  });

  it('WS-5c "Open folder" opens the folder the picker returns, and nothing when it returns null', async () => {
    const bus = setup([], 'picked');
    await userEvent.click(await screen.findByRole('button', { name: 'Open folder' }));
    await waitFor(() => expect(bus.payloadsOf(workspaceChannels.openProject)).toEqual([{ path: abs('.') }]));
    cleanup();
    const none = setup([], null);
    await userEvent.click(await screen.findByRole('button', { name: 'Open folder' }));
    await waitFor(() => expect(none.payloadsOf(shellChannels.pickFolder)).toHaveLength(1));
    expect(none.payloadsOf(workspaceChannels.openProject)).toHaveLength(0);
  });
});

describe('welcome on the Dashboard (card 036 part 1)', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    };
  });

  beforeEach(() => {
    usePageStore.setState(usePageStore.getInitialState(), true);
  });

  const screens: PanelDefinition<unknown> = {
    type: 'dashboard.screens',
    kind: 'dock',
    title: 'Dashboard',
    icon: 'file',
    stateSchema: z.unknown(),
    initialState: {},
    allowMultiple: false,
    component: () => <div data-testid="widget-screens" />,
  };

  const frame = (project: boolean) => {
    const bus = createStubBus();
    bus.answer(workspaceChannels.getCurrentProject, () => ok(project ? PROJECT : null));
    bus.answer(workspaceChannels.listRecentProjects, () => ok([]));
    render(
      <ToastProvider>
        <AppFrame
          bus={bus}
          registry={{
            panels: new Map([['dashboard.screens', screens]]),
            statusItems: new Map(),
            commands: new Map(),
            setPanelOpener: () => undefined,
          }}
          log={{ log: () => undefined }}
          keyFor={() => null}
          message=""
        />
      </ToastProvider>,
    );
  };

  it('WS-44 with no project open the Dashboard shows the welcome view instead of the widget screens', async () => {
    usePageStore.getState().show('dashboard');
    frame(false);
    expect(await screen.findByRole('button', { name: 'Open folder' })).toBeTruthy();
    expect(screen.queryByTestId('widget-screens')).toBeNull();
  });

  it('WS-44 with a project open the Dashboard shows the widget screens', async () => {
    usePageStore.getState().show('dashboard');
    frame(true);
    expect(await screen.findByTestId('widget-screens')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open folder' })).toBeNull();
  });
});
