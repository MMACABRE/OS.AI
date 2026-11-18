import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import type { Unsubscribe } from '@hsos/contracts/bus';
import type { Clock, Logger } from '@hsos/contracts/module';

export type SettingsFileKind = 'settings' | 'keybindings' | 'themes';

/** Changes closer together than this are one change (SET-8). */
export const QUIET_MS = 200;

export type SettingsWatcherOptions = {
  readonly settingsFile: string;
  readonly keybindingsFile: string;
  readonly themesDir: string;
  readonly clock: Clock;
  readonly log: Logger;
  /** Called once per kind after 200 ms without further changes. The caller re-reads the files (P-16). */
  onChange(kind: SettingsFileKind): void;
};

/**
 * Watches settings.json, keybindings.json and the themes folder (SET-8). Folders are watched rather
 * than files, because an atomic write replaces the file. The event data is only a trigger; the caller
 * re-reads the state. Returns a function that stops watching.
 */
export function watchSettingsFiles(options: SettingsWatcherOptions): Unsubscribe {
  const timers = new Map<SettingsFileKind, Unsubscribe>();
  const watchers: FSWatcher[] = [];
  const trigger = (kind: SettingsFileKind) => {
    timers.get(kind)?.();
    timers.set(
      kind,
      options.clock.after(QUIET_MS, () => {
        timers.delete(kind);
        options.onChange(kind);
      }),
    );
  };
  const watchFolder = (folder: string, match: (name: string) => SettingsFileKind | null) => {
    try {
      mkdirSync(folder, { recursive: true });
      const watcher = watch(folder, (_event, name) => {
        const kind = match(typeof name === 'string' ? name : '');
        if (kind !== null) trigger(kind);
      });
      watcher.on('error', (error) =>
        options.log.log('warn', 'settings.watch_failed', { folder, message: error.message }),
      );
      watchers.push(watcher);
    } catch (error) {
      options.log.log('warn', 'settings.watch_failed', {
        folder,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const settingsName = basename(options.settingsFile).toLowerCase();
  const keybindingsName = basename(options.keybindingsFile).toLowerCase();
  const sameFolder = dirname(options.settingsFile) === dirname(options.keybindingsFile);
  const byName = (name: string): SettingsFileKind | null => {
    const lower = name.toLowerCase();
    if (lower === settingsName) return 'settings';
    if (lower === keybindingsName) return 'keybindings';
    return null;
  };
  watchFolder(dirname(options.settingsFile), byName);
  if (!sameFolder) watchFolder(dirname(options.keybindingsFile), byName);
  watchFolder(options.themesDir, (name) => (name.toLowerCase().endsWith('.json') ? 'themes' : null));

  return () => {
    for (const watcher of watchers) watcher.close();
    for (const cancel of timers.values()) cancel();
    timers.clear();
  };
}
