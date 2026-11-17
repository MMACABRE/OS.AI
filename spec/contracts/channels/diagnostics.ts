/** Channels owned by the `diagnostics` module. Spec: spec/modules/diagnostics.md */
import { z } from 'zod';
import { request } from '../bus';
import { zEmpty, zEpochMs } from '../schemas';

export const zProcessName = z.enum(['main', 'pty-host', 'workspace-service', 'link-service', 'ui']);
export type ProcessName = z.infer<typeof zProcessName>;

export const LogRecord = z.object({
  time: zEpochMs,
  process: zProcessName,
  module: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  event: z.string().max(80),
  data: z.record(z.string(), z.unknown()).optional(),
});
export type LogRecord = z.infer<typeof LogRecord>;

export const ProcessHealth = z.object({
  process: zProcessName,
  pid: z.number().int(),
  memoryMb: z.number(),
  uptimeMs: z.number(),
});
export type ProcessHealth = z.infer<typeof ProcessHealth>;

export const diagnosticsChannels = {
  /** Used by processes that cannot write log files themselves (the renderer). */
  write: request('diagnostics.write', 'main', LogRecord, zEmpty),
  /** The newest `lines` records of one process, oldest first. */
  getRecent: request(
    'diagnostics.getRecent',
    'main',
    z.object({ process: zProcessName, lines: z.number().int().min(1).max(1000) }),
    z.array(LogRecord),
  ),
  getHealth: request('diagnostics.getHealth', 'main', zEmpty, z.array(ProcessHealth)),
  openLogFolder: request('diagnostics.openLogFolder', 'main', zEmpty, zEmpty),
} as const;
