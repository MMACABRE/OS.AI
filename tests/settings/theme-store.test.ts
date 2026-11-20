import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeFile, TOKEN_NAMES } from '@hsos/contracts/theme';
import { createThemeStore, resolveTheme, themeSlug } from '../../src/modules/settings/service/theme-store';

const silent = { log: () => undefined };
const builtInDir = resolve(import.meta.dirname, '../../resources/themes');
const phosphorPath = join(builtInDir, 'phosphor.json');

let themesDir = '';
beforeEach(async () => {
  themesDir = await mkdtemp(join(tmpdir(), 'hsos-themes-'));
});
afterEach(async () => {
  await rm(themesDir, { recursive: true, force: true });
});

async function phosphorFile(): Promise<ThemeFile> {
  return ThemeFile.parse(JSON.parse(await readFile(phosphorPath, 'utf8')));
}

function makeStore() {
  return createThemeStore({ themesDir, builtInDir, log: silent });
}

async function putTheme(file: string, name: string, tokens: Record<string, string>) {
  await writeFile(join(themesDir, file), JSON.stringify({ version: 1, name, kind: 'dark', tokens }), 'utf8');
}

describe('theme store', () => {
  it('SET-11 theme "Nope" makes Phosphor active and records one problem', async () => {
    const store = makeStore();
    await store.load();
    const phosphor = await phosphorFile();

    const active = store.active('Nope');

    expect(active.name).toBe('Phosphor');
    for (const name of TOKEN_NAMES) expect(active.tokens[name]).toBe(phosphor.tokens[name]);
    expect(store.problems('Nope')).toHaveLength(1);
    expect(store.problems('Phosphor')).toEqual([]);
  });

  it('SET-12 a theme setting only color.accent has its own accent and every other token equals Phosphor', async () => {
    await putTheme('mine.json', 'Mine', { 'color.accent': '#123456' });
    const store = makeStore();
    await store.load();
    const phosphor = await phosphorFile();

    const active = store.active('Mine');

    expect(active.name).toBe('Mine');
    expect(active.tokens['color.accent']).toBe('#123456');
    for (const name of TOKEN_NAMES)
      if (name !== 'color.accent') expect(active.tokens[name]).toBe(phosphor.tokens[name]);
    expect(store.problems('Mine')).toEqual([]);
  });

  it('SET-12 resolveTheme overlays a theme on Phosphor and keeps the theme kind', async () => {
    const phosphor = await phosphorFile();
    const light = ThemeFile.parse({
      version: 1,
      name: 'L',
      kind: 'light',
      tokens: { 'color.bg.app': '#FFFFFF' },
    });
    const { theme, problems } = resolveTheme(phosphor, light, 'C:\\themes\\l.json');
    expect(theme.kind).toBe('light');
    expect(theme.tokens['color.bg.app']).toBe('#FFFFFF');
    expect(theme.tokens['color.bg.panel']).toBe(phosphor.tokens['color.bg.panel']);
    expect(problems).toEqual([]);
  });

  it('SET-14 a token value "red; background: url(x)" keeps Phosphor value and records one problem', async () => {
    await putTheme('evil.json', 'Evil', { 'color.accent': 'red; background: url(x)' });
    const store = makeStore();
    await store.load();
    const phosphor = await phosphorFile();

    const active = store.active('Evil');

    expect(active.tokens['color.accent']).toBe(phosphor.tokens['color.accent']);
    const problems = store.problems('Evil');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe('tokens.color.accent');
  });

  it('SET-14 values with url(, a brace or a semicolon are each refused, and an unknown token name is ignored with a problem', async () => {
    const phosphor = await phosphorFile();
    const theme = ThemeFile.parse({
      version: 1,
      name: 'T',
      kind: 'dark',
      tokens: {
        'color.bg.app': 'url(x)',
        'color.bg.panel': '}',
        'color.bg.raised': '{',
        'color.bg.overlay': 'a;b',
        'color.not.a.token': '#000000',
      },
    });
    const { theme: resolved, problems } = resolveTheme(phosphor, theme, 'C:\\t.json');
    for (const name of ['color.bg.app', 'color.bg.panel', 'color.bg.raised', 'color.bg.overlay'] as const)
      expect(resolved.tokens[name]).toBe(phosphor.tokens[name]);
    expect(Object.keys(resolved.tokens)).not.toContain('color.not.a.token');
    expect(problems).toHaveLength(5);
  });

  it('SET-16 saving a theme named "Phosphor" returns SET_INVALID and writes no file', async () => {
    const store = makeStore();
    await store.load();
    const before = await readdir(themesDir);
    const phosphorBefore = await readFile(join(themesDir, 'phosphor.json'), 'utf8');

    const result = await store.save(
      ThemeFile.parse({ version: 1, name: 'Phosphor', kind: 'dark', tokens: { 'color.accent': '#000000' } }),
    );

    expect(result.ok ? null : result.error.code).toBe('SET_INVALID');
    expect(await readdir(themesDir)).toEqual(before);
    expect(await readFile(join(themesDir, 'phosphor.json'), 'utf8')).toBe(phosphorBefore);
  });

  it('SET-16 saving "My Theme 2" writes my-theme-2.json and lists it as not built in', async () => {
    const store = makeStore();
    await store.load();

    const result = await store.save(
      ThemeFile.parse({
        version: 1,
        name: 'My Theme 2',
        kind: 'dark',
        tokens: { 'color.accent': '#ABCDEF' },
      }),
    );

    expect(result.ok).toBe(true);
    expect(await readdir(themesDir)).toContain('my-theme-2.json');
    const saved: unknown = JSON.parse(await readFile(join(themesDir, 'my-theme-2.json'), 'utf8'));
    expect(saved).toEqual({
      version: 1,
      name: 'My Theme 2',
      kind: 'dark',
      tokens: { 'color.accent': '#ABCDEF' },
    });
    expect(store.list().find((item) => item.name === 'My Theme 2')?.isBuiltIn).toBe(false);
    expect(store.list().find((item) => item.name === 'Phosphor')?.isBuiltIn).toBe(true);
    expect(store.active('My Theme 2').tokens['color.accent']).toBe('#ABCDEF');
  });

  it('SET-16 themeSlug lower-cases and replaces runs of other characters with a dash', () => {
    expect(themeSlug('My Theme 2')).toBe('my-theme-2');
    expect(themeSlug('A  &&  B')).toBe('a-b');
  });

  it('SET-12 load copies phosphor.json into themesDir, overwriting an edited copy', async () => {
    const store = makeStore();
    await store.load();
    const original = await readFile(phosphorPath, 'utf8');
    expect(await readFile(join(themesDir, 'phosphor.json'), 'utf8')).toBe(original);

    await putTheme('phosphor.json', 'Phosphor', { 'color.accent': '#000000' });
    await store.load();

    expect(await readFile(join(themesDir, 'phosphor.json'), 'utf8')).toBe(original);
    expect(store.active('Phosphor').tokens['color.accent']).toBe(
      (await phosphorFile()).tokens['color.accent'],
    );
  });

  it('SET-11 a theme file that is not valid is reported as a problem and does not break the others', async () => {
    await writeFile(join(themesDir, 'broken.json'), '{ not json', 'utf8');
    await putTheme('ok.json', 'Fine', {});
    const store = makeStore();
    await store.load();
    expect(
      store
        .list()
        .map((item) => item.name)
        .sort(),
    ).toEqual(['Fine', 'Phosphor']);
    expect(store.problems('Fine').length).toBeGreaterThanOrEqual(1);
  });

  it('SET-13 the test-light fixture is a light theme that overlays Phosphor', async () => {
    await cp(
      resolve(import.meta.dirname, '../fixtures/themes/test-light.json'),
      join(themesDir, 'test-light.json'),
    );
    const store = makeStore();
    await store.load();
    const active = store.active('test-light');
    expect(active.kind).toBe('light');
    expect(active.tokens['color.bg.app']).toBe('#F4F1EA');
  });
});
