import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { ok } from '@hsos/contracts/result';
import type { SettingsSection } from '@hsos/contracts/module';
import { createRemoteSettingsReader } from '../../src/modules/settings/service/remote-settings';
import { createSettingsStore } from '../../src/modules/settings/service/settings-store';
import { watchSettingsFiles } from '../../src/modules/settings/service/settings-watcher';
import type { SettingsFileKind } from '../../src/modules/settings/service/settings-watcher';
import { systemClock } from '../../src/modules/shell/system-clock';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';

const silent = { log: () => undefined };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const terminalSection: SettingsSection<{ fontSize: number }> = {
  moduleId: 'terminal',
  title: 'Terminal',
  schema: z.object({ fontSize: z.number().min(6).max(40) }),
  defaults: { fontSize: 16 },
};
const filesSection: SettingsSection<{ tabSize: number }> = {
  moduleId: 'files',
  title: 'Files',
  schema: z.object({ tabSize: z.number() }),
  defaults: { tabSize: 2 },
};

async function until(condition: () => boolean, limitMs = 3_000): Promise<number> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > limitMs) throw new Error('condition not met in time');
    await sleep(10);
  }
  return Date.now() - start;
}

let root = '';
let settingsFile = '';
let keybindingsFile = '';
let themesDir = '';
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'hsos-live-'));
  await mkdir(join(root, 'settings'), { recursive: true });
  settingsFile = join(root, 'settings', 'settings.json');
  keybindingsFile = join(root, 'settings', 'keybindings.json');
  themesDir = join(root, 'themes');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function watch(onChange: (kind: SettingsFileKind) => void) {
  return watchSettingsFiles({
    settingsFile,
    keybindingsFile,
    themesDir,
    clock: systemClock,
    log: silent,
    onChange,
  });
}

describe('live reload', () => {
  it('SET-8 rewriting settings.json calls onChange(settings) once; after store.load() the reader listener fires within 1 000 ms', async () => {
    await writeFile(settingsFile, JSON.stringify({ version: 1, values: {} }), 'utf8');
    const store = createSettingsStore({ file: settingsFile, clock: systemClock, log: silent });
    const reader = store.register(terminalSection);
    await store.load();
    const changes: SettingsFileKind[] = [];
    const heard: number[] = [];
    reader.onChange((value) => void heard.push(value.fontSize));
    const stop = watch((kind) => {
      changes.push(kind);
      if (kind === 'settings') void store.load();
    });

    const written = Date.now();
    await writeFile(
      settingsFile,
      JSON.stringify({ version: 1, values: { terminal: { fontSize: 30 } } }),
      'utf8',
    );
    await until(() => heard.length > 0);
    const took = Date.now() - written;
    await sleep(400);
    stop();

    expect(changes).toEqual(['settings']);
    expect(heard).toEqual([30]);
    expect(reader.get().fontSize).toBe(30);
    expect(took).toBeLessThan(1_000);
  });

  it('SET-8 several writes within 200 ms give one onChange', async () => {
    await writeFile(settingsFile, '{}', 'utf8');
    const changes: SettingsFileKind[] = [];
    const stop = watch((kind) => void changes.push(kind));

    for (let write = 0; write < 4; write += 1) {
      await writeFile(settingsFile, JSON.stringify({ version: 1, values: { n: write } }), 'utf8');
      await sleep(40);
    }
    await sleep(600);
    stop();

    expect(changes).toEqual(['settings']);
  });

  it('SET-8 keybindings.json and a .json file in the themes folder report their own kinds', async () => {
    const changes: SettingsFileKind[] = [];
    const stop = watch((kind) => void changes.push(kind));
    await sleep(50);

    await writeFile(keybindingsFile, '{}', 'utf8');
    await until(() => changes.includes('keybindings'));
    await writeFile(join(themesDir, 'mine.json'), '{}', 'utf8');
    await until(() => changes.includes('themes'));
    await writeFile(join(themesDir, 'notes.txt'), 'not a theme', 'utf8');
    await sleep(500);
    stop();

    expect(changes).toEqual(['keybindings', 'themes']);
  });

  it('SET-8 after stopping the watcher no change is reported', async () => {
    const changes: SettingsFileKind[] = [];
    const stop = watch((kind) => void changes.push(kind));
    stop();
    await writeFile(settingsFile, '{}', 'utf8');
    await sleep(500);
    expect(changes).toEqual([]);
  });

  it('SET-9 when only the first section changes on disk only its listener fires', async () => {
    await writeFile(settingsFile, JSON.stringify({ version: 1, values: {} }), 'utf8');
    const store = createSettingsStore({ file: settingsFile, clock: createFakeClock(), log: silent });
    const first = store.register(terminalSection);
    const second = store.register(filesSection);
    await store.load();
    const firstHeard: number[] = [];
    const secondHeard: number[] = [];
    first.onChange((value) => void firstHeard.push(value.fontSize));
    second.onChange((value) => void secondHeard.push(value.tabSize));

    await writeFile(
      settingsFile,
      JSON.stringify({ version: 1, values: { terminal: { fontSize: 22 } } }),
      'utf8',
    );
    await store.load();

    expect(firstHeard).toEqual([22]);
    expect(secondHeard).toEqual([]);
  });

  it('SET-9 reloading an unchanged file notifies nobody', async () => {
    await writeFile(
      settingsFile,
      JSON.stringify({ version: 1, values: { terminal: { fontSize: 22 } } }),
      'utf8',
    );
    const store = createSettingsStore({ file: settingsFile, clock: createFakeClock(), log: silent });
    const reader = store.register(terminalSection);
    await store.load();
    const heard: number[] = [];
    reader.onChange((value) => void heard.push(value.fontSize));
    await store.load();
    expect(heard).toEqual([]);
  });
});

describe('remote settings reader', () => {
  it('SET-10 returns the defaults, then the getSection value, then follows sectionChanged for its own module only', async () => {
    const bus = createFakeBus();
    bus.handle(settingsChannels.getSection, ({ moduleId }) =>
      ok(moduleId === 'terminal' ? { fontSize: 20 } : {}),
    );
    const reader = createRemoteSettingsReader(bus, terminalSection, silent);
    const heard: number[] = [];
    reader.onChange((value) => void heard.push(value.fontSize));
    expect(reader.get()).toEqual({ fontSize: 16 });

    await sleep(10);
    expect(reader.get()).toEqual({ fontSize: 20 });

    bus.emit(settingsChannels.sectionChanged, { moduleId: 'files', value: { fontSize: 99 } });
    expect(reader.get()).toEqual({ fontSize: 20 });
    bus.emit(settingsChannels.sectionChanged, { moduleId: 'terminal', value: { fontSize: 24 } });
    expect(reader.get()).toEqual({ fontSize: 24 });
    expect(heard).toEqual([20, 24]);
  });

  it('SET-10 ignores a value that fails the schema and keeps the previous one', async () => {
    const bus = createFakeBus();
    bus.handle(settingsChannels.getSection, () => ok({ fontSize: 20 }));
    const warnings: string[] = [];
    const reader = createRemoteSettingsReader(bus, terminalSection, {
      log: (level, event) => void warnings.push(`${level}:${event}`),
    });
    await sleep(10);

    bus.emit(settingsChannels.sectionChanged, { moduleId: 'terminal', value: { fontSize: 'huge' } });
    bus.emit(settingsChannels.sectionChanged, { moduleId: 'terminal', value: { fontSize: 400 } });

    expect(reader.get()).toEqual({ fontSize: 20 });
    expect(warnings).toEqual(['warn:settings.remote_value_invalid', 'warn:settings.remote_value_invalid']);
  });

  it('SET-10 a getSection failure keeps the defaults', async () => {
    const bus = createFakeBus();
    const reader = createRemoteSettingsReader(bus, terminalSection, silent);
    await sleep(10);
    expect(reader.get()).toEqual({ fontSize: 16 });
  });
});
