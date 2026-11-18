import { KeybindingsFile } from '@hsos/contracts/channels/settings';
import type { SettingsProblem } from '@hsos/contracts/channels/settings';
import { toAbsPath } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';
import type { Result } from '@hsos/contracts/result';
import { readJson, writeJsonAtomic } from './atomic-json';

type Bindings = Record<string, string | null>;

const EMPTY: KeybindingsFile = { version: 1, bindings: {} };
/** SET-19: `Ctrl+Alt+Shift+` modifiers in that order and a key name; a chord is two parts separated by a space. */
const KEY_PART = /^(Ctrl\+)?(Alt\+)?(Shift\+)?([^\s+]+|\+)$/;

/** Whether a key string has the SET-19 shape. The renderer normalises spelling and case. */
export function isKeyString(key: string): boolean {
  const parts = key.trim().split(/\s+/);
  return parts.length >= 1 && parts.length <= 2 && parts.every((part) => KEY_PART.test(part));
}

export type KeybindingsStore = {
  load(): Promise<void>;
  /** The file's overrides: a key, or null meaning no key (SET-18). */
  get(): Bindings;
  set(commandId: string, key: string | null): Promise<Result<Record<string, never>>>;
  problems(): SettingsProblem[];
  onChange(listener: (bindings: Bindings) => void): () => void;
};

/**
 * keybindings.json in main: read, validate, write atomically, report problems (SET-18 to SET-20, card 019).
 * A file that cannot be read is left untouched and gives no overrides until `set` replaces it.
 */
export function createKeybindingsStore(options: {
  readonly file: string;
  readonly log: Logger;
}): KeybindingsStore {
  const file = toAbsPath(options.file);
  let stored: KeybindingsFile = EMPTY;
  let problems: SettingsProblem[] = [];
  const listeners = new Set<(bindings: Bindings) => void>();

  const publish = (next: KeybindingsFile) => {
    const changed = JSON.stringify(next.bindings) !== JSON.stringify(stored.bindings);
    stored = next;
    if (changed) for (const listener of listeners) listener(stored.bindings);
  };

  return {
    async load() {
      const read = await readJson(file, KeybindingsFile);
      if (read.kind === 'missing') {
        problems = [];
        publish(EMPTY);
        await writeJsonAtomic(file, EMPTY).catch(() =>
          options.log.log('warn', 'settings.keybindings_create_failed'),
        );
        return;
      }
      if (read.kind === 'invalid') {
        problems = [{ file, path: '', message: read.reason }];
        publish(EMPTY);
        return;
      }
      problems = Object.entries(read.value.bindings)
        .filter(([, key]) => key !== null && !isKeyString(key))
        .map(([commandId]) => ({
          file,
          path: `bindings.${commandId}`,
          message: 'Not a key in the form Ctrl+Shift+P',
        }));
      publish(read.value);
    },
    get: () => stored.bindings,
    async set(commandId, key) {
      if (key !== null && !isKeyString(key)) return err('SET_INVALID', 'Use a key in the form Ctrl+Shift+P.');
      const next: KeybindingsFile = { version: 1, bindings: { ...stored.bindings, [commandId]: key } };
      try {
        await writeJsonAtomic(file, next);
      } catch {
        return err('FILE_WRITE_FAILED', 'Key bindings could not be saved.');
      }
      problems = problems.filter((problem) => problem.path !== '');
      publish(next);
      return ok({});
    },
    problems: () => problems,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
