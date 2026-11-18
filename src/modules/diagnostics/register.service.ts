import { z } from 'zod';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import type { ServiceContext, SettingsSection } from '@hsos/contracts/module';
import { ok } from '@hsos/contracts/result';
import { cleanCrashReports } from './service/crash-reports';
import { createFileLogger, readRecent } from './service/file-logger';

export type DiagnosticsSettings = { readonly debug: boolean };

/** The `diagnostics` settings section (spec/modules/diagnostics.md, "Settings section"). */
export const diagnosticsSettings: SettingsSection<DiagnosticsSettings> = {
  moduleId: 'diagnostics',
  title: 'Diagnostics',
  schema: z.object({ debug: z.boolean() }),
  defaults: { debug: false },
};

/**
 * Main side of diagnostics: writes the renderer's records to `ui.log` and answers `getRecent`
 * from the log files (DIAG-1 to DIAG-6, card 012), and clears old crash files at start (DIAG-10, card 013).
 */
export function register(ctx: ServiceContext): void {
  void cleanCrashReports(ctx.paths.crashDir, ctx.clock.now()).then((removed) => {
    if (removed > 0) ctx.log.log('info', 'diagnostics.crash_files_removed', { removed });
  });
  const settings = ctx.registerSettings(diagnosticsSettings);
  const uiLog = createFileLogger({
    process: 'ui',
    logsDir: ctx.paths.logsDir,
    clock: ctx.clock,
    debug: () => settings.get().debug,
  });
  ctx.onStop(() => uiLog.close());

  ctx.bus.handle(diagnosticsChannels.write, (record) => {
    if (record.process === 'ui') uiLog.write(record);
    else ctx.log.log('warn', 'diagnostics.write_refused', { process: record.process });
    return ok({});
  });
  ctx.bus.handle(diagnosticsChannels.getRecent, async ({ process, lines }) => {
    if (process === 'ui') await uiLog.flush();
    return ok(await readRecent(ctx.paths.logsDir, process, lines));
  });
}
