import { appendFileSync, mkdirSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { LogRecord } from '@hsos/contracts/channels/diagnostics';
import type { ProcessName } from '@hsos/contracts/channels/diagnostics';
import type { Clock, Logger } from '@hsos/contracts/module';
import { redact } from './redact';

/** A live log file at or past this size is rotated before the next write (DIAG-2). */
export const ROTATE_BYTES = 5 * 1024 * 1024;
/** Rotated files kept: `.1.log` to `.4.log` (DIAG-2). */
export const KEPT_ROTATIONS = 4;
export const FLUSH_MS = 500;
const MAX_EVENT_LENGTH = 80;

export type FileLoggerOptions = {
  readonly process: ProcessName;
  readonly logsDir: string;
  readonly clock: Clock;
  /** The `diagnostics.debug` setting, read at each record so a change applies at once (DIAG-6). */
  readonly debug?: () => boolean;
};

/** The logger of one process. Its `log` writes as module `shell`; modules get their own through `forModule`. */
export type FileLogger = Logger & {
  forModule(module: string): Logger;
  /** Adds a record built elsewhere, such as the renderer's through `diagnostics.write` (DIAG-1). */
  write(record: LogRecord): void;
  /** Writes the buffered records. Never rejects (DIAG-3). */
  flush(): Promise<void>;
  /** Flushes and stops the 500 ms timer; call on process stop (DIAG-3). */
  close(): Promise<void>;
  /** Writes the buffer at once, blocking. Only for a process about to exit after a crash (DIAG-8). */
  flushSync(): void;
};

/** `<logsDir>\<process>.log`, or `<process>.<n>.log` for rotation `n`. */
export function logFile(logsDir: string, process: ProcessName, rotation = 0): string {
  return join(logsDir, rotation === 0 ? `${process}.log` : `${process}.${rotation}.log`);
}

async function rotate(logsDir: string, process: ProcessName): Promise<void> {
  await rm(logFile(logsDir, process, KEPT_ROTATIONS), { force: true });
  for (let rotation = KEPT_ROTATIONS - 1; rotation >= 0; rotation -= 1)
    await rename(logFile(logsDir, process, rotation), logFile(logsDir, process, rotation + 1)).catch(
      () => undefined,
    );
}

async function append(logsDir: string, process: ProcessName, text: string): Promise<void> {
  await mkdir(logsDir, { recursive: true });
  const live = logFile(logsDir, process);
  const size = await stat(live).then(
    (stats) => stats.size,
    () => 0,
  );
  if (size >= ROTATE_BYTES) await rotate(logsDir, process);
  await appendFile(live, text, 'utf8');
}

/**
 * Buffers records and appends them to `<process>.log`, one JSON object per line, every 500 ms.
 * Secrets are redacted and long strings cut before a record is buffered. Nothing here throws. DIAG-1 to DIAG-6.
 */
export function createFileLogger(options: FileLoggerOptions): FileLogger {
  let buffer: string[] = [];
  let writing: Promise<void> = Promise.resolve();

  const flush = (): Promise<void> => {
    if (buffer.length === 0) return writing;
    const text = buffer.join('');
    buffer = [];
    writing = writing.then(() => append(options.logsDir, options.process, text)).catch(() => undefined);
    return writing;
  };
  const write = (record: LogRecord): void => {
    try {
      if (record.level === 'debug' && options.debug?.() !== true) return;
      const { data, ...rest } = record;
      const clean: LogRecord = {
        ...rest,
        event: rest.event.slice(0, MAX_EVENT_LENGTH),
        ...(data === undefined ? {} : { data: redact(data) }),
      };
      buffer.push(`${JSON.stringify(clean)}\n`);
    } catch {
      // Logging never throws (DIAG-3): a record that cannot be serialised is dropped.
    }
  };
  const forModule = (module: string): Logger => ({
    log: (level, event, data) =>
      write({
        time: options.clock.now(),
        process: options.process,
        module,
        level,
        event,
        ...(data === undefined ? {} : { data }),
      }),
  });
  const stopTimer = options.clock.every(FLUSH_MS, () => void flush());
  const shell = forModule('shell');

  return {
    log: shell.log,
    forModule,
    write,
    flush,
    close: () => {
      stopTimer();
      return flush();
    },
    flushSync: () => {
      const text = buffer.join('');
      buffer = [];
      if (text === '') return;
      try {
        mkdirSync(options.logsDir, { recursive: true });
        appendFileSync(logFile(options.logsDir, options.process), text, 'utf8');
      } catch {
        // DIAG-3: a failed write is dropped.
      }
    },
  };
}

function parseLine(line: string): LogRecord[] {
  if (line.trim() === '') return [];
  try {
    const parsed = LogRecord.safeParse(JSON.parse(line));
    return parsed.success ? [parsed.data] : [];
  } catch {
    return [];
  }
}

/** The newest `lines` records of one process from its log files, oldest first. Unflushed records are not included. */
export async function readRecent(logsDir: string, process: ProcessName, lines: number): Promise<LogRecord[]> {
  const records: LogRecord[] = [];
  for (let rotation = 0; rotation <= KEPT_ROTATIONS && records.length < lines; rotation += 1) {
    const text = await readFile(logFile(logsDir, process, rotation), 'utf8').catch(() => '');
    records.unshift(...text.split('\n').flatMap(parseLine));
  }
  return records.slice(-lines);
}
