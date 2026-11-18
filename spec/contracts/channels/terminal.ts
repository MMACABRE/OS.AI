/** Channels owned by the `terminal` module. Spec: spec/modules/terminal.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { TerminalId } from '../ids';
import type { ExtensionPoint, SettingsSection } from '../module';
import { zAbsPath, zEmpty, zEpochMs, zProjectId, zTerminalId } from '../schemas';

export const TerminalInfo = z.object({
  id: zTerminalId,
  projectId: zProjectId,
  /** Folder the shell was started in. */
  cwd: zAbsPath,
  shellPath: z.string(),
  /** Name of the git worktree this terminal belongs to, or null for the main working tree. */
  worktree: z.string().nullable(),
  /** Command typed into the shell right after start, for example `claude`, or null. */
  launch: z.string().nullable(),
  startedAt: zEpochMs,
  cols: z.number().int(),
  rows: z.number().int(),
  state: z.enum(['running', 'exited']),
  exitCode: z.number().int().nullable(),
});
export type TerminalInfo = z.infer<typeof TerminalInfo>;

export const CreateTerminalRequest = z.object({
  projectId: zProjectId,
  cwd: zAbsPath,
  cols: z.number().int().min(2).max(1000),
  rows: z.number().int().min(1).max(1000),
  worktree: z.string().nullable(),
  launch: z.string().max(2000).nullable(),
});
export type CreateTerminalRequest = z.infer<typeof CreateTerminalRequest>;

export const AttachResponse = z.object({
  info: TerminalInfo,
  /** Recent raw output to replay into a fresh terminal view (TERM-21). */
  replay: z.instanceof(Uint8Array),
  /** Sequence number of the last chunk included in `replay`. */
  lastSeq: z.number().int().nonnegative(),
});
export type AttachResponse = z.infer<typeof AttachResponse>;

export const TerminalSettings = z.object({
  /** Empty means auto: pwsh.exe when found on PATH, else powershell.exe. */
  shellPath: z.string().default(''),
  shellArgs: z.array(z.string()).default(['-NoLogo']),
  fontSize: z.number().int().min(8).max(32).default(13),
  lineHeight: z.number().min(1).max(2).default(1.35),
  scrollbackLines: z.number().int().min(1000).max(200_000).default(20_000),
  cursorStyle: z.enum(['block', 'bar', 'underline']).default('block'),
  cursorBlink: z.boolean().default(false),
  /** What Shift+Enter sends. The default inserts a newline in Claude Code and, with shell integration, in PowerShell (TERM-45). */
  shiftEnterSequence: z.string().default('\u001b\r'),
  copyOnSelect: z.boolean().default(false),
  rightClickPastes: z.boolean().default(true),
  /** Ask before closing a terminal whose shell has a child process running. */
  confirmCloseWhenBusy: z.boolean().default(true),
  /** Keep shells of a project alive when another project is opened. */
  keepShellsAcrossProjects: z.boolean().default(true),
  /** Bytes of recent output kept per terminal for reattach. */
  replayBufferBytes: z.number().int().min(65_536).max(16_777_216).default(2_097_152),
  useWebgl: z.boolean().default(true),
  /** Load terminal-init.ps1 into PowerShell shells: Shift+Enter newlines, prompt marks, live folder (TERM-70). */
  shellIntegration: z.boolean().default(true),
});
export type TerminalSettings = z.infer<typeof TerminalSettings>;

export const terminalSection: SettingsSection<TerminalSettings> = {
  moduleId: 'terminal',
  title: 'Terminal',
  schema: TerminalSettings,
  defaults: TerminalSettings.parse({}),
};

export const terminalChannels = {
  create: request('terminal.create', 'pty-host', CreateTerminalRequest, TerminalInfo),
  list: request('terminal.list', 'pty-host', z.object({ projectId: zProjectId }), z.array(TerminalInfo)),
  attach: request('terminal.attach', 'pty-host', z.object({ id: zTerminalId }), AttachResponse),
  /** Keyboard input or pasted text for the shell. */
  write: request('terminal.write', 'pty-host', z.object({ id: zTerminalId, data: z.string() }), zEmpty),
  resize: request(
    'terminal.resize',
    'pty-host',
    z.object({ id: zTerminalId, cols: z.number().int().min(2).max(1000), rows: z.number().int().min(1).max(1000) }),
    zEmpty,
  ),
  /** The view reports how many bytes it has drawn, for flow control (TERM-31). */
  ack: request('terminal.ack', 'pty-host', z.object({ id: zTerminalId, bytes: z.number().int().positive() }), zEmpty),
  /** Ends the shell and forgets the terminal. */
  kill: request('terminal.kill', 'pty-host', z.object({ id: zTerminalId }), zEmpty),
  /** True when the shell has at least one child process (TERM-42). */
  isBusy: request('terminal.isBusy', 'pty-host', z.object({ id: zTerminalId }), z.boolean()),

  /** Stores the view's serialised scrollback for the next launch (TERM-50). */
  storeScrollback: request(
    'terminal.storeScrollback',
    'pty-host',
    z.object({ id: zTerminalId, text: z.string().max(20_000_000) }),
    zEmpty,
  ),
  /** Returns stored scrollback for a terminal id from an earlier run, or null. Removes the file. */
  takeScrollback: request(
    'terminal.takeScrollback',
    'pty-host',
    z.object({ projectId: zProjectId, id: zTerminalId }),
    z.string().nullable(),
  ),

  /** Facts about the pty-host process, found once at start (TERM-48). */
  hostInfo: request('terminal.hostInfo', 'pty-host', zEmpty, z.object({ elevated: z.boolean() })),

  /** Extra environment variables for every shell started from now on. Used by claude-link. */
  setExtraEnv: request(
    'terminal.setExtraEnv',
    'pty-host',
    z.object({ env: z.record(z.string(), z.string()) }),
    zEmpty,
  ),

  data: event(
    'terminal.data',
    'pty-host',
    z.object({ id: zTerminalId, seq: z.number().int().nonnegative(), data: z.instanceof(Uint8Array) }),
  ),
  exited: event('terminal.exited', 'pty-host', z.object({ id: zTerminalId, exitCode: z.number().int() })),
  created: event('terminal.created', 'pty-host', TerminalInfo),
} as const;

/** Something a terminal panel can start in a new shell instead of a plain prompt (TERM-24, TERM-25, TERM-57). */
export type RecoveryOffer = {
  /** Button text, for example `Resume Claude session "fix login"`. */
  readonly label: string;
  /** One muted line written into the view before the new shell starts. */
  readonly notice: string;
  /** Text typed into the new shell, as `launch` (TERM-5). */
  readonly launch: string;
  /** True: TERM-24 uses the offer without asking. False: it shows the offer as a button. */
  readonly auto: boolean;
  /** Called with the new terminal's id as soon as `create` returns, before `launch` is typed. */
  accepted(newTerminalId: TerminalId): Promise<void>;
};

/**
 * Modules in the ui process that can bring something back into a terminal whose shell is gone
 * contribute one of these. `sessions` uses it. The first non-null offer wins.
 */
export type TerminalRecovery = {
  offerFor(savedTerminalId: TerminalId): Promise<RecoveryOffer | null>;
};

export const terminalRecovery: ExtensionPoint<TerminalRecovery> = { id: 'terminal.recovery' };

/** The seam between pty-host and the real ConPTY. tests/fakes/fake-pty.ts implements it too. */
export type PtyProcess = {
  readonly pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  pause(): void;
  resume(): void;
  kill(): void;
  onData(listener: (data: Uint8Array) => void): void;
  onExit(listener: (exitCode: number) => void): void;
};

export type PtyFactory = {
  spawn(options: {
    shellPath: string;
    args: readonly string[];
    cwd: string;
    env: Readonly<Record<string, string>>;
    cols: number;
    rows: number;
  }): PtyProcess;
};
