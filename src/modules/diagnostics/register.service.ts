import { z } from 'zod';
import { diagnosticsChannels } from '@hsos/contracts/channels/diagnostics';
import type { ProcessName } from '@hsos/contracts/channels/diagnostics';
import type { ExtensionPoint, ServiceContext, SettingsSection } from '@hsos/contracts/module';
import { ok } from '@hsos/contracts/result';
import { cleanCrashReports, writeCrashReport } from './service/crash-reports';
import { createFileLogger, readRecent } from './service/file-logger';
import { toHealth } from './service/health';
import type { ProcessMetric } from './service/health';

export type DiagnosticsSettings = { readonly debug: boolean };

/** The `diagnostics` settings section (spec/modules/diagnostics.md, "Settings section"). */
export const diagnosticsSettings: SettingsSection<DiagnosticsSettings> = {
  moduleId: 'diagnostics',
  title: 'Diagnostics',
  schema: z.object({ debug: z.boolean() }),
  defaults: { debug: false },
};

/** A process death the supervisor reports (SHELL-10, DIAG-7). */
export type ProcessDeath = {
  readonly process: ProcessName;
  readonly exitCode: number;
  readonly appVersion: string;
};

/**
 * Filled by diagnostics in main; main's supervisor calls every reporter on each death (DIAG-7).
 * Declared here because the contracts have none (card 013 deviation); main reads it through its module list.
 */
export const processDeathReporters: ExtensionPoint<(death: ProcessDeath) => void> = {
  id: 'diagnostics.processDeathReporters',
};

/** Filled by main from Electron's process metrics; `getHealth` reads it at call time (DIAG-9). */
export const processMetricsSources: ExtensionPoint<() => readonly ProcessMetric[]> = {
  id: 'diagnostics.processMetricsSources',
};

/**
 * Main side of diagnostics: writes the renderer's records to `ui.log`, answers `getRecent` from the log
 * files (DIAG-1 to DIAG-6), writes a crash file on each reported death (DIAG-7), clears old crash files at
 * start (DIAG-10) and answers `getHealth` (DIAG-9). Cards 012 and 013.
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

  ctx.contribute(processDeathReporters, (death) => {
    void writeCrashReport(ctx.paths, { ...death, time: ctx.clock.now() }).then((file) => {
      if (file === null) ctx.log.log('warn', 'diagnostics.crash_report_failed', { process: death.process });
      else ctx.log.log('info', 'diagnostics.crash_report_written', { process: death.process, file });
    });
  });

  ctx.bus.handle(diagnosticsChannels.write, (record) => {
    if (record.process === 'ui') uiLog.write(record);
    else ctx.log.log('warn', 'diagnostics.write_refused', { process: record.process });
    return ok({});
  });
  ctx.bus.handle(diagnosticsChannels.getRecent, async ({ process, lines }) => {
    if (process === 'ui') await uiLog.flush();
    return ok(await readRecent(ctx.paths.logsDir, process, lines));
  });
  ctx.bus.handle(diagnosticsChannels.getHealth, () =>
    ok(
      toHealth(
        ctx.contributions(processMetricsSources).flatMap((source) => source()),
        ctx.clock.now(),
      ),
    ),
  );
}
