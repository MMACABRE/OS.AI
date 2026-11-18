import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SettingsProblem, ThemeSummary } from '@hsos/contracts/channels/settings';
import { toAbsPath } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import { ThemeFile, TOKEN_NAMES } from '@hsos/contracts/theme';
import type { ResolvedTheme, TokenName } from '@hsos/contracts/theme';
import { readJson, writeJsonAtomic } from './atomic-json';

export const PHOSPHOR = 'Phosphor';
const KNOWN_TOKENS: ReadonlySet<string> = new Set(TOKEN_NAMES);
const UNSAFE_VALUE = /url\(|;|\{|\}/i;

type LoadedTheme = { readonly theme: ThemeFile; readonly file: string; readonly isBuiltIn: boolean };

/**
 * Overlays `theme` on Phosphor's tokens (SET-12). An unknown token name or a value containing `url(`,
 * `;`, `{` or `}` is ignored and reported (SET-14).
 */
export function resolveTheme(
  phosphor: ThemeFile,
  theme: ThemeFile,
  file: string,
): { theme: ResolvedTheme; problems: SettingsProblem[] } {
  const problems: SettingsProblem[] = [];
  const tokens: Record<string, string> = {};
  for (const name of TOKEN_NAMES) tokens[name] = phosphor.tokens[name] ?? '';
  for (const [name, value] of Object.entries(theme.tokens)) {
    const path = `tokens.${name}`;
    if (!KNOWN_TOKENS.has(name)) problems.push({ file: toAbsPath(file), path, message: 'Unknown token' });
    else if (UNSAFE_VALUE.test(value))
      problems.push({ file: toAbsPath(file), path, message: 'The value may not contain url(, ;, { or }' });
    else tokens[name] = value;
  }
  return {
    theme: { name: theme.name, kind: theme.kind, tokens: tokens as Record<TokenName, string> },
    problems,
  };
}

/** `My Theme 2` becomes `my-theme-2` (SET-16). */
export function themeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'theme'
  );
}

export type ThemeStore = {
  /** Copies the built-in themes into themesDir (overwriting) and reads every theme. */
  load(): Promise<void>;
  list(): ThemeSummary[];
  /** The theme named by the `theme` setting, or Phosphor with a problem (SET-11). */
  active(themeName: string): ResolvedTheme;
  problems(themeName: string): SettingsProblem[];
  save(theme: ThemeFile): Promise<Result<ThemeSummary>>;
};

export type ThemeStoreOptions = {
  readonly themesDir: string;
  /** `resources/themes`, the built-in themes shipped with the app. */
  readonly builtInDir: string;
  readonly log: Logger;
};

/** Themes in main: built-ins, the owner's files, resolution and saving. SET-11, SET-12, SET-14, SET-16. Card 018. */
export function createThemeStore(options: ThemeStoreOptions): ThemeStore {
  let themes: LoadedTheme[] = [];
  let fileProblems: SettingsProblem[] = [];
  let builtInNames = new Set<string>([PHOSPHOR]);
  const phosphor = (): LoadedTheme | undefined => themes.find((loaded) => loaded.theme.name === PHOSPHOR);

  const readDir = async (dir: string): Promise<{ loaded: LoadedTheme[]; problems: SettingsProblem[] }> => {
    const names = await readdir(dir).catch(() => [] as string[]);
    const loaded: LoadedTheme[] = [];
    const problems: SettingsProblem[] = [];
    for (const name of names.filter((entry) => entry.toLowerCase().endsWith('.json')).sort()) {
      const file = join(dir, name);
      const read = await readJson(file, ThemeFile);
      if (read.kind === 'ok') loaded.push({ theme: read.value, file, isBuiltIn: false });
      else if (read.kind === 'invalid')
        problems.push({ file: toAbsPath(file), path: '', message: read.reason });
    }
    return { loaded, problems };
  };

  const summary = (loaded: LoadedTheme): ThemeSummary => ({
    name: loaded.theme.name,
    kind: loaded.theme.kind,
    file: toAbsPath(loaded.file),
    isBuiltIn: loaded.isBuiltIn,
  });

  const pick = (themeName: string): { loaded: LoadedTheme | undefined; missing: boolean } => {
    const found = themes.find((loaded) => loaded.theme.name === themeName);
    return found === undefined ? { loaded: phosphor(), missing: true } : { loaded: found, missing: false };
  };

  const resolveActive = (themeName: string) => {
    const { loaded, missing } = pick(themeName);
    const base = phosphor()?.theme;
    const problems = [...fileProblems];
    if (missing)
      problems.push({
        file: toAbsPath(options.themesDir),
        path: '',
        message: `No theme is named "${themeName}". Phosphor is used.`,
      });
    if (base === undefined || loaded === undefined)
      return {
        theme: { name: PHOSPHOR, kind: 'dark' as const, tokens: {} as Record<TokenName, string> },
        problems,
      };
    const resolved = resolveTheme(base, loaded.theme, loaded.file);
    return { theme: resolved.theme, problems: [...problems, ...resolved.problems] };
  };

  return {
    async load() {
      await mkdir(options.themesDir, { recursive: true }).catch(() => undefined);
      const builtIn = await readDir(options.builtInDir);
      builtInNames = new Set([PHOSPHOR, ...builtIn.loaded.map((loaded) => loaded.theme.name)]);
      for (const loaded of builtIn.loaded) {
        const target = join(options.themesDir, `${themeSlug(loaded.theme.name)}.json`);
        await copyFile(loaded.file, target).catch(() =>
          options.log.log('warn', 'settings.builtin_theme_copy_failed', { name: loaded.theme.name }),
        );
      }
      const owned = await readDir(options.themesDir);
      themes = owned.loaded.map((loaded) => ({ ...loaded, isBuiltIn: builtInNames.has(loaded.theme.name) }));
      // A theme only in resources (copy failed) still counts.
      for (const loaded of builtIn.loaded)
        if (!themes.some((theme) => theme.theme.name === loaded.theme.name))
          themes.push({ ...loaded, isBuiltIn: true });
      fileProblems = [...builtIn.problems, ...owned.problems];
    },
    list: () => themes.map(summary),
    active: (themeName) => resolveActive(themeName).theme,
    problems: (themeName) => resolveActive(themeName).problems,
    async save(theme) {
      if (builtInNames.has(theme.name))
        return err('SET_INVALID', `"${theme.name}" is a built-in theme. Save the copy under another name.`);
      const file = join(options.themesDir, `${themeSlug(theme.name)}.json`);
      try {
        await writeJsonAtomic(file, theme);
      } catch {
        return err('FILE_WRITE_FAILED', 'The theme could not be saved.');
      }
      const loaded: LoadedTheme = { theme, file, isBuiltIn: false };
      themes = [...themes.filter((existing) => existing.theme.name !== theme.name), loaded];
      return ok(summary(loaded));
    },
  };
}
