import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { SettingsSection } from '@hsos/contracts/module';
import { createSettingsStore } from '../../src/modules/settings/service/settings-store';
import { createFakeClock } from '../fakes/fake-clock';

const silent = { log: () => undefined };

const terminalSection: SettingsSection<{ fontSize: number; shell: string }> = {
  moduleId: 'terminal',
  title: 'Terminal',
  schema: z.object({ fontSize: z.number().min(6).max(40), shell: z.string() }),
  defaults: { fontSize: 16, shell: 'pwsh' },
};
const filesSection: SettingsSection<{ a: number; b: number }> = {
  moduleId: 'files',
  title: 'Files',
  schema: z.object({ a: z.number(), b: z.number() }),
  defaults: { a: 1, b: 2 },
};

let dir = '';
let file = '';
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hsos-settings-'));
  file = join(dir, 'settings.json');
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeStore() {
  return createSettingsStore({ file, clock: createFakeClock(1_700_000_000_000), log: silent });
}
const write = (value: unknown) =>
  writeFile(file, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');

describe('settings store', () => {
  it('SET-2 stored { a: 5 } over defaults { a: 1, b: 2 } reads { a: 5, b: 2 }', async () => {
    await write({ version: 1, values: { files: { a: 5 } } });
    const store = makeStore();
    const reader = store.register(filesSection);
    await store.load();
    expect(reader.get()).toEqual({ a: 5, b: 2 });
    expect(store.getSection('files')).toEqual({ a: 5, b: 2 });
    expect(store.getProblems()).toEqual([]);
  });

  it('SET-2 before load, and for a module with no section, the reader gives defaults and getSection gives null', () => {
    const store = makeStore();
    const reader = store.register(filesSection);
    expect(reader.get()).toEqual({ a: 1, b: 2 });
    expect(store.getSection('terminal')).toBeNull();
  });

  it('SET-3 a stored fontSize "big" gives the default and one problem at values.terminal.fontSize', async () => {
    await write({ version: 1, values: { terminal: { fontSize: 'big', shell: 'cmd' } } });
    const store = makeStore();
    const reader = store.register(terminalSection);
    await store.load();

    expect(reader.get()).toEqual({ fontSize: 16, shell: 'cmd' });
    const problems = store.getProblems();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe('values.terminal.fontSize');
    expect(problems[0]?.file).toBe(file);
  });

  it('SET-4 an unknown key stays on disk after setValue on another key, with one "Unknown setting" problem', async () => {
    await write({ version: 1, values: { terminal: { unknownKey: 'keep me' } } });
    const store = makeStore();
    store.register(terminalSection);
    await store.load();
    expect(store.getProblems().map((problem) => [problem.path, problem.message])).toEqual([
      ['values.terminal.unknownKey', 'Unknown setting'],
    ]);

    const result = await store.setValue('terminal', 'fontSize', 20);

    expect(result.ok).toBe(true);
    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, values: { terminal: { unknownKey: 'keep me', fontSize: 20 } } });
    expect(store.getProblems()).toHaveLength(1);
    expect(store.getProblems()[0]?.message).toBe('Unknown setting');
  });

  it('SET-4 values of a module that registered no section are kept on disk and reported', async () => {
    await write({ version: 1, values: { ghost: { x: 1 }, files: { a: 3 } } });
    const store = makeStore();
    store.register(filesSection);
    await store.load();
    expect(store.getProblems().map((problem) => [problem.path, problem.message])).toEqual([
      ['values.ghost.x', 'Unknown setting'],
    ]);
    await store.setValue('files', 'b', 9);
    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, values: { ghost: { x: 1 }, files: { a: 3, b: 9 } } });
  });

  it('SET-5 a file with { not json is not loaded: defaults, bytes unchanged, one problem', async () => {
    await write('{ not json');
    const store = makeStore();
    const reader = store.register(terminalSection);
    await store.load();

    expect(reader.get()).toEqual({ fontSize: 16, shell: 'pwsh' });
    expect(await readFile(file, 'utf8')).toBe('{ not json');
    expect(store.getProblems()).toHaveLength(1);
    expect(store.getProblems()[0]?.path).toBe('');
  });

  it('SET-5 setValue on an invalid file copies it to settings.json.invalid-* and writes a valid file', async () => {
    await write('{ not json');
    const store = makeStore();
    store.register(terminalSection);
    await store.load();

    const result = await store.setValue('terminal', 'fontSize', 22);

    expect(result.ok).toBe(true);
    const copies = (await readdir(dir)).filter((name) => name.startsWith('settings.json.invalid-'));
    expect(copies).toHaveLength(1);
    expect(await readFile(join(dir, copies[0] ?? ''), 'utf8')).toBe('{ not json');
    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, values: { terminal: { fontSize: 22 } } });
    expect(store.getProblems()).toEqual([]);
  });

  it('SET-5 a file with version 2 is not loaded, its bytes stay, and it is reported', async () => {
    const text = JSON.stringify({ version: 2, values: { terminal: { fontSize: 30 } } });
    await write(text);
    const store = makeStore();
    const reader = store.register(terminalSection);
    await store.load();

    expect(reader.get()).toEqual({ fontSize: 16, shell: 'pwsh' });
    expect(await readFile(file, 'utf8')).toBe(text);
    expect(store.getProblems()).toHaveLength(1);
  });

  it('SET-6 a value over max returns SET_INVALID and the file is unchanged', async () => {
    const text = JSON.stringify({ version: 1, values: { terminal: { fontSize: 20 } } });
    await write(text);
    const store = makeStore();
    const reader = store.register(terminalSection);
    await store.load();

    const result = await store.setValue('terminal', 'fontSize', 400);

    expect(result.ok ? null : result.error.code).toBe('SET_INVALID');
    expect(await readFile(file, 'utf8')).toBe(text);
    expect(reader.get().fontSize).toBe(20);
  });

  it('SET-6 setValue of a key nobody declared returns SET_INVALID', async () => {
    const store = makeStore();
    store.register(terminalSection);
    await store.load();
    const result = await store.setValue('terminal', 'nope', 1);
    expect(result.ok ? null : result.error.code).toBe('SET_INVALID');
  });

  it('SET-7 setValue keeps the old content as settings.json.bak and fires the reader listener once', async () => {
    const old = JSON.stringify({ version: 1, values: { terminal: { fontSize: 20 } } });
    await write(old);
    const store = makeStore();
    const reader = store.register(terminalSection);
    await store.load();
    const heard: number[] = [];
    reader.onChange((value) => void heard.push(value.fontSize));

    const result = await store.setValue('terminal', 'fontSize', 24);

    expect(result.ok).toBe(true);
    expect(await readFile(join(dir, 'settings.json.bak'), 'utf8')).toBe(old);
    expect(heard).toEqual([24]);
    expect(reader.get().fontSize).toBe(24);
  });

  it('SET-7 setValue also emits sectionChanged', async () => {
    const store = makeStore();
    store.register(terminalSection);
    await store.load();
    const heard: unknown[] = [];
    store.onSectionChanged((moduleId, value) => void heard.push([moduleId, value]));
    await store.setValue('terminal', 'shell', 'cmd');
    expect(heard).toEqual([['terminal', { fontSize: 16, shell: 'cmd' }]]);
  });

  it('SET-1 a missing file is created as { "version": 1, "values": {} }', async () => {
    const store = makeStore();
    store.register(terminalSection);
    await store.load();
    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, values: {} });
  });

  it('SET-7 a value equal to the default is removed from the file', async () => {
    await write({ version: 1, values: { terminal: { fontSize: 20 } } });
    const store = makeStore();
    store.register(terminalSection);
    await store.load();
    await store.setValue('terminal', 'fontSize', 16);
    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, values: {} });
  });

  it('SET-1 registering the same module twice returns the first reader', () => {
    const store = makeStore();
    expect(store.register(filesSection)).toBe(store.register(filesSection));
  });
});
