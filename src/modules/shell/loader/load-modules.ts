import type { ModuleId } from '@hsos/contracts/ids';
import type { Logger } from '@hsos/contracts/module';

/** One entry of a process's `module-list.ts`. */
export type ModuleEntry<Context> = {
  readonly id: ModuleId;
  readonly module: { register(ctx: Context): void };
};

/**
 * Calls each module's `register` in list order with its own context. A `register` that throws is
 * logged at `error` and that module is skipped; the others still load (SHELL-20, P-12).
 * Returns the ids that registered.
 */
export function loadModules<Context>(
  list: readonly ModuleEntry<Context>[],
  makeContext: (id: ModuleId) => Context,
  log: Logger,
): ModuleId[] {
  const loaded: ModuleId[] = [];
  for (const entry of list) {
    try {
      entry.module.register(makeContext(entry.id));
      loaded.push(entry.id);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      log.log('error', 'shell.module_register_failed', {
        module: entry.id,
        message: failure.message,
        stack: failure.stack,
      });
    }
  }
  return loaded;
}
