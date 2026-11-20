import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveBindings } from '../../src/modules/ui-kit/keys/key-dispatcher';
import { keyFromEvent, normalizeBinding } from '../../src/modules/ui-kit/keys/parse-key';
import type { KeyPress } from '../../src/modules/ui-kit/keys/parse-key';
import { createKeybindingsStore, isKeyString } from '../../src/modules/settings/service/keybindings-store';

const silent = { log: () => undefined };

const press = (overrides: Partial<KeyPress>): KeyPress => ({
  key: '',
  code: '',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...overrides,
});

describe('resolve bindings', () => {
  it('SET-18 a command with default Ctrl+B whose override is null has no key', () => {
    const resolved = resolveBindings([{ id: 'files.toggle', defaultKey: 'Ctrl+B' }], {
      'files.toggle': null,
    });

    expect(resolved.byCommand.get('files.toggle')).toBeNull();
    expect(resolved.byKey.has('Ctrl+B')).toBe(false);
    expect(resolved.conflicts).toEqual([]);
  });

  it('SET-18 an override replaces the default key and a command without an override keeps its default', () => {
    const resolved = resolveBindings(
      [
        { id: 'a.one', defaultKey: 'Ctrl+B' },
        { id: 'a.two', defaultKey: 'Ctrl+J' },
      ],
      { 'a.one': 'ctrl+shift+k' },
    );
    expect(resolved.byCommand.get('a.one')).toBe('Ctrl+Shift+K');
    expect(resolved.byCommand.get('a.two')).toBe('Ctrl+J');
    expect(resolved.byKey.get('Ctrl+Shift+K')).toBe('a.one');
    expect(resolved.byKey.has('Ctrl+B')).toBe(false);
  });

  it('SET-20 two commands on Ctrl+B: the later one holds the key and one conflict names both', () => {
    const resolved = resolveBindings(
      [
        { id: 'first.cmd', defaultKey: 'Ctrl+B' },
        { id: 'second.cmd', defaultKey: 'Ctrl+B' },
      ],
      {},
    );

    expect(resolved.byKey.get('Ctrl+B')).toBe('second.cmd');
    expect(resolved.byCommand.get('second.cmd')).toBe('Ctrl+B');
    expect(resolved.byCommand.get('first.cmd')).toBeNull();
    expect(resolved.conflicts).toEqual([{ key: 'Ctrl+B', winner: 'second.cmd', loser: 'first.cmd' }]);
  });

  it('SET-19 an override that is not a key lists the command as invalid and leaves it without a key', () => {
    const resolved = resolveBindings([{ id: 'a.one', defaultKey: 'Ctrl+B' }], { 'a.one': 'Ctrl+' });
    expect(resolved.invalid).toEqual(['a.one']);
    expect(resolved.byCommand.get('a.one')).toBeNull();
  });
});

describe('key names', () => {
  it('SET-19 keyFromEvent gives Ctrl+Shift+P for code KeyP with Ctrl and Shift', () => {
    expect(keyFromEvent(press({ key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true }))).toBe(
      'Ctrl+Shift+P',
    );
  });

  it('SET-19 keyFromEvent gives Ctrl+, for Comma, and the modifier order is Ctrl, Alt, Shift', () => {
    expect(keyFromEvent(press({ key: ',', code: 'Comma', ctrlKey: true }))).toBe('Ctrl+,');
    expect(keyFromEvent(press({ key: 'x', code: 'KeyX', shiftKey: true, altKey: true, ctrlKey: true }))).toBe(
      'Ctrl+Alt+Shift+X',
    );
  });

  it('SET-19 keyFromEvent gives null for a lone Shift and for a press with the Windows key', () => {
    expect(keyFromEvent(press({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }))).toBeNull();
    expect(keyFromEvent(press({ key: 'Control', code: 'ControlLeft', ctrlKey: true }))).toBeNull();
    expect(keyFromEvent(press({ key: 'p', code: 'KeyP', metaKey: true }))).toBeNull();
  });

  it('SET-19 normalizeBinding writes ctrl+shift+p as Ctrl+Shift+P and a chord as two parts', () => {
    expect(normalizeBinding('ctrl+shift+p')).toBe('Ctrl+Shift+P');
    expect(normalizeBinding('ctrl+k ctrl+t')).toBe('Ctrl+K Ctrl+T');
  });

  it('SET-19 normalizeBinding refuses a malformed binding', () => {
    expect(normalizeBinding('Ctrl+')).toBeNull();
    expect(normalizeBinding('Hyper+K')).toBeNull();
    expect(normalizeBinding('Ctrl+K Ctrl+T Ctrl+U')).toBeNull();
    expect(normalizeBinding('Ctrl+Ctrl+K')).toBeNull();
  });
});

describe('keybindings store', () => {
  let dir = '';
  let file = '';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'hsos-keys-'));
    file = join(dir, 'keybindings.json');
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('SET-19 isKeyString accepts a key and a chord and refuses other shapes', () => {
    expect(isKeyString('Ctrl+Shift+P')).toBe(true);
    expect(isKeyString('Ctrl+K Ctrl+T')).toBe(true);
    expect(isKeyString('F2')).toBe(true);
    expect(isKeyString('Ctrl+')).toBe(false);
    expect(isKeyString('Ctrl+K Ctrl+T Ctrl+U')).toBe(false);
  });

  it('SET-19 the store reports a malformed key as a problem at bindings.<command>', async () => {
    await writeFile(
      file,
      JSON.stringify({ version: 1, bindings: { 'a.good': 'Ctrl+J', 'a.bad': 'Ctrl+', 'a.none': null } }),
      'utf8',
    );
    const store = createKeybindingsStore({ file, log: silent });
    await store.load();

    expect(store.problems().map((problem) => problem.path)).toEqual(['bindings.a.bad']);
    expect(store.get()).toEqual({ 'a.good': 'Ctrl+J', 'a.bad': 'Ctrl+', 'a.none': null });
  });

  it('SET-19 set refuses a malformed key with SET_INVALID and writes nothing', async () => {
    const store = createKeybindingsStore({ file, log: silent });
    await store.load();
    const before = await readFile(file, 'utf8');

    const result = await store.set('a.one', 'Ctrl+K Ctrl+T Ctrl+U');

    expect(result.ok ? null : result.error.code).toBe('SET_INVALID');
    expect(await readFile(file, 'utf8')).toBe(before);
  });

  it('SET-18 set stores a key or null in the file, keeps the old file as .bak and tells listeners', async () => {
    const store = createKeybindingsStore({ file, log: silent });
    await store.load();
    const heard: unknown[] = [];
    store.onChange((bindings) => void heard.push(bindings));

    expect((await store.set('a.one', 'Ctrl+J')).ok).toBe(true);
    expect((await store.set('a.two', null)).ok).toBe(true);

    const onDisk: unknown = JSON.parse(await readFile(file, 'utf8'));
    expect(onDisk).toEqual({ version: 1, bindings: { 'a.one': 'Ctrl+J', 'a.two': null } });
    expect(JSON.parse(await readFile(`${file}.bak`, 'utf8'))).toEqual({
      version: 1,
      bindings: { 'a.one': 'Ctrl+J' },
    });
    expect(heard).toEqual([{ 'a.one': 'Ctrl+J' }, { 'a.one': 'Ctrl+J', 'a.two': null }]);
  });

  it('SET-18 a missing file is created as { version: 1, bindings: {} }', async () => {
    const store = createKeybindingsStore({ file, log: silent });
    await store.load();
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ version: 1, bindings: {} });
    expect(store.get()).toEqual({});
  });

  it('SET-18 a file that is not valid JSON gives no overrides and one problem, and is left as it is', async () => {
    await writeFile(file, '{ nope', 'utf8');
    const store = createKeybindingsStore({ file, log: silent });
    await store.load();
    expect(store.get()).toEqual({});
    expect(store.problems()).toHaveLength(1);
    expect(await readFile(file, 'utf8')).toBe('{ nope');
  });
});
