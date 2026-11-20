import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import { newId, toAbsPath } from '@hsos/contracts/ids';
import type { PanelId } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';
import { createBus } from '../../src/modules/shell/bus/create-bus';
import type { BusClient } from '../../src/modules/shell/bus/create-bus';
import { createLoopbackTransport } from '../../src/modules/shell/bus/transport';
import type { Peer } from '../../src/modules/shell/bus/transport';
import { registerSystemChannels } from '../../src/main/system/system-channels';
import type { ShellApi, SystemDeps, WindowApi } from '../../src/main/system/system-channels';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';

type LogEntry = { level: string; event: string; data: unknown };

function fakeShell() {
  const calls = { openExternal: [] as string[], openPath: [] as string[], trash: [] as string[] };
  let trashFails = false;
  const shell: ShellApi = {
    openExternal: (url) => {
      calls.openExternal.push(url);
      return Promise.resolve();
    },
    openPath: (path) => {
      calls.openPath.push(path);
      return Promise.resolve('');
    },
    showItemInFolder: () => undefined,
    trashItem: (path) => {
      calls.trash.push(path);
      return trashFails ? Promise.reject(new Error('locked')) : Promise.resolve();
    },
  };
  return {
    shell,
    calls,
    failTrash: () => {
      trashFails = true;
    },
  };
}

function fakeWindow(focused: boolean) {
  const log: string[] = [];
  let minimized = true;
  const state = { focused };
  const window: WindowApi = {
    isFocused: () => state.focused,
    isMinimized: () => minimized,
    isMaximized: () => false,
    minimize: () => void log.push('minimize'),
    maximize: () => void log.push('maximize'),
    unmaximize: () => void log.push('unmaximize'),
    restore: () => {
      minimized = false;
      log.push('restore');
    },
    focus: () => void log.push('focus'),
    close: () => void log.push('close'),
  };
  return { window, log, state };
}

function setup(overrides: Partial<SystemDeps> = {}) {
  const records: LogEntry[] = [];
  const log: Logger = { log: (level, event, data) => void records.push({ level, event, data }) };
  const bus = createFakeBus(createFakeClock());
  const fake = fakeShell();
  const win = fakeWindow(false);
  const notifications: { title: string; body: string; click: () => void }[] = [];
  registerSystemChannels({
    bus,
    log,
    shell: fake.shell,
    window: () => win.window,
    pickFolder: () => Promise.resolve(null),
    writeClipboard: () => undefined,
    showNotification: (title, body, click) => void notifications.push({ title, body, click }),
    ...overrides,
  });
  return { bus, records, fake, win, notifications };
}

/** A main bus that sees every call as coming from `peer`, and a bus for that peer to call with. */
function peerSetup(peer: Exclude<Peer, 'main'>, token: string) {
  const clock = createFakeClock();
  const records: LogEntry[] = [];
  const log: Logger = { log: (level, event, data) => void records.push({ level, event, data }) };
  const [mainSide, peerSide] = createLoopbackTransport('main', peer);
  const main = createBus({ process: 'main', transport: mainSide, clock, log });
  const caller: BusClient = createBus({
    process: peer === 'ui' ? 'ui' : peer,
    transport: peerSide,
    clock,
    log: { log: () => undefined },
  });
  const fake = fakeShell();
  registerSystemChannels({
    bus: main,
    log,
    shell: fake.shell,
    window: () => null,
    pickFolder: () => Promise.resolve(null),
    writeClipboard: () => undefined,
    showNotification: () => undefined,
    launchToken: token,
  });
  return { caller, records, clock };
}

const code = (result: { ok: boolean; error?: { code: string } }) => (result.ok ? null : result.error?.code);

describe('system channels', () => {
  it('SHELL-21 openExternal refuses http and file URLs and opens https', async () => {
    const { bus, fake } = setup();
    const http = await bus.call(shellChannels.openExternal, { url: 'http://x.test' });
    const file = await bus.call(shellChannels.openExternal, { url: 'file:///C:/x' });
    expect(code(http)).toBe('BAD_REQUEST');
    expect(code(file)).toBe('BAD_REQUEST');
    expect(fake.calls.openExternal).toEqual([]);

    const https = await bus.call(shellChannels.openExternal, { url: 'https://x.test' });
    expect(https.ok).toBe(true);
    expect(fake.calls.openExternal).toEqual(['https://x.test']);
  });

  it('SHELL-26 getLaunchToken: ui gets BAD_REQUEST, link-service gets the token, the token is never logged', async () => {
    const token = 'f'.repeat(64);
    const fromUi = peerSetup('ui', token);
    const fromLink = peerSetup('link-service', token);

    const refused = await fromUi.caller.call(shellChannels.getLaunchToken, {});
    const granted = await fromLink.caller.call(shellChannels.getLaunchToken, {});

    expect(code(refused)).toBe('BAD_REQUEST');
    expect(granted.ok ? granted.value.token : null).toBe(token);
    expect(JSON.stringify([...fromUi.records, ...fromLink.records])).not.toContain(token);
  });

  it('SHELL-26 without a given token, main creates one of 32 random bytes, hex encoded, and it differs per launch', async () => {
    const tokens: string[] = [];
    for (let launch = 0; launch < 2; launch += 1) {
      const bus = createFakeBus();
      tokens.push(
        registerSystemChannels({
          bus,
          log: { log: () => undefined },
          shell: fakeShell().shell,
          window: () => null,
          pickFolder: () => Promise.resolve(null),
          writeClipboard: () => undefined,
          showNotification: () => undefined,
        }),
      );
    }
    for (const token of tokens) expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('SHELL-27 openPath refuses exe and ps1 without calling the shell, and opens a PDF', async () => {
    const { bus, fake } = setup();
    const exe = await bus.call(shellChannels.openPath, { path: toAbsPath('C:\\a\\run.exe') });
    const script = await bus.call(shellChannels.openPath, { path: toAbsPath('C:\\a\\x.ps1') });
    expect(code(exe)).toBe('BAD_REQUEST');
    expect(code(script)).toBe('BAD_REQUEST');
    expect(fake.calls.openPath).toEqual([]);

    const pdf = await bus.call(shellChannels.openPath, { path: toAbsPath('C:\\a\\doc.PDF') });
    expect(pdf.ok).toBe(true);
    expect(fake.calls.openPath).toEqual(['C:\\a\\doc.PDF']);
  });

  it('SHELL-27 every extension of the contract list opens, and a file without extension does not', async () => {
    const { bus, fake } = setup();
    const allowed = [
      'pdf',
      'mp4',
      'webm',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'webp',
      'svg',
      'html',
      'htm',
      'txt',
      'md',
    ];
    for (const extension of allowed) {
      const result = await bus.call(shellChannels.openPath, { path: toAbsPath(`C:\\a\\file.${extension}`) });
      expect(result.ok).toBe(true);
    }
    expect(fake.calls.openPath).toHaveLength(allowed.length);
    const bare = await bus.call(shellChannels.openPath, { path: toAbsPath('C:\\a\\Makefile') });
    expect(code(bare)).toBe('BAD_REQUEST');
  });

  it('SHELL-22 a failing trashItem returns FILE_WRITE_FAILED', async () => {
    const { bus, fake } = setup();
    fake.failTrash();
    const result = await bus.call(shellChannels.trashItem, { path: toAbsPath('C:\\a\\old.txt') });
    expect(code(result)).toBe('FILE_WRITE_FAILED');
  });

  it('SHELL-22 a working trashItem moves the item to the shell trash', async () => {
    const { bus, fake } = setup();
    const result = await bus.call(shellChannels.trashItem, { path: toAbsPath('C:\\a\\old.txt') });
    expect(result.ok).toBe(true);
    expect(fake.calls.trash).toEqual(['C:\\a\\old.txt']);
  });

  it('SHELL-23 notify does nothing while the window is focused', async () => {
    const { bus, win, notifications } = setup();
    win.state.focused = true;
    const result = await bus.call(shellChannels.notify, {
      title: 'Done',
      body: 'Build ok',
      focusPanel: null,
    });
    expect(result.ok).toBe(true);
    expect(notifications).toEqual([]);
  });

  it('SHELL-23 notify shows a notification when unfocused; clicking restores, focuses and requests the panel', async () => {
    const { bus, win, notifications } = setup();
    const panelId = newId<PanelId>(() => 0.3);
    const requested: string[] = [];
    bus.on(workspaceChannels.focusPanelRequested, (payload) => void requested.push(payload.panelId));

    await bus.call(shellChannels.notify, { title: 'Done', body: 'Build ok', focusPanel: panelId });
    expect(notifications.map((item) => [item.title, item.body])).toEqual([['Done', 'Build ok']]);
    expect(win.log).toEqual([]);

    notifications[0]?.click();

    expect(win.log).toEqual(['restore', 'focus']);
    expect(requested).toEqual([panelId]);
  });

  it('SHELL-23 clicking a notification with no panel focuses the window and requests nothing', async () => {
    const { bus, win, notifications } = setup();
    const requested: string[] = [];
    bus.on(workspaceChannels.focusPanelRequested, (payload) => void requested.push(payload.panelId));
    await bus.call(shellChannels.notify, { title: 'Done', body: 'Build ok', focusPanel: null });
    notifications[0]?.click();
    expect(win.log).toEqual(['restore', 'focus']);
    expect(requested).toEqual([]);
  });
});

describe('openFolder', () => {
  let dir = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hsos-folder-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('SHELL-30 openFolder opens a folder, and refuses a file and a missing path without calling the shell again', async () => {
    const { bus, fake } = setup();
    const file = join(dir, 'notepad.exe');
    await writeFile(file, 'x', 'utf8');

    const folder = await bus.call(shellChannels.openFolder, { path: toAbsPath(dir) });
    const notAFolder = await bus.call(shellChannels.openFolder, { path: toAbsPath(file) });
    const missing = await bus.call(shellChannels.openFolder, { path: toAbsPath(join(dir, 'missing')) });

    expect(folder.ok).toBe(true);
    expect(code(notAFolder)).toBe('BAD_REQUEST');
    expect(code(missing)).toBe('BAD_REQUEST');
    expect(fake.calls.openPath).toEqual([dir]);
  });
});
