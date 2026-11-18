import { randomBytes } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import type { Bus } from '@hsos/contracts/bus';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { Logger } from '@hsos/contracts/module';
import { err, ok } from '@hsos/contracts/result';

/** File types `openPath` may open in their default program (SHELL-27, the list in the contract). */
export const OPENABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'pdf',
  'mp4',
  'webm',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'html',
  'htm',
  'txt',
  'md',
]);

/** The parts of Electron's `shell` used here. */
export type ShellApi = {
  openExternal(url: string): Promise<void>;
  /** Resolves to '' on success, otherwise an error message. */
  openPath(path: string): Promise<string>;
  showItemInFolder(path: string): void;
  trashItem(path: string): Promise<void>;
};

/** The main window, as the system channels use it. */
export type WindowApi = {
  isFocused(): boolean;
  isMinimized(): boolean;
  isMaximized(): boolean;
  minimize(): void;
  maximize(): void;
  unmaximize(): void;
  restore(): void;
  focus(): void;
  close(): void;
};

export type SystemDeps = {
  readonly bus: Bus;
  readonly log: Logger;
  readonly shell: ShellApi;
  /** null until the window exists. */
  window(): WindowApi | null;
  pickFolder(title: string): Promise<string | null>;
  writeClipboard(text: string): void;
  /** Shows a Windows notification; `onClick` runs when the owner clicks it. */
  showNotification(title: string, body: string, onClick: () => void): void;
  /** Whether the path is an existing folder; injectable for tests. */
  isDirectory?(path: string): Promise<boolean>;
  /** The launch token (SHELL-26); created here when absent. */
  launchToken?: string;
};

/** 32 random bytes, hex encoded (SHELL-26, P-7). */
export function createLaunchToken(): string {
  return randomBytes(32).toString('hex');
}

const defaultIsDirectory = (path: string) =>
  stat(path).then(
    (stats) => stats.isDirectory(),
    () => false,
  );

/**
 * Handlers of the system channels owned by shell: pickFolder, trashItem (SHELL-22), openExternal (SHELL-21),
 * openPath (SHELL-27), openFolder (SHELL-30), revealInExplorer, notify (SHELL-23), writeClipboard,
 * windowAction and getLaunchToken (SHELL-26). Card 015. Returns the launch token.
 */
export function registerSystemChannels(deps: SystemDeps): string {
  const { bus, shell } = deps;
  const token = deps.launchToken ?? createLaunchToken();
  const isDirectory = deps.isDirectory ?? defaultIsDirectory;

  bus.handle(shellChannels.pickFolder, async ({ title }) => ok(await deps.pickFolder(title)));

  bus.handle(shellChannels.trashItem, async ({ path }) => {
    try {
      await shell.trashItem(path);
      return ok({});
    } catch {
      return err(
        'FILE_WRITE_FAILED',
        'The item could not be moved to the Recycle Bin. It was left in place.',
      );
    }
  });

  bus.handle(shellChannels.openExternal, async ({ url }) => {
    if (new URL(url).protocol !== 'https:') return err('BAD_REQUEST', 'Only https links can be opened.');
    await shell.openExternal(url);
    return ok({});
  });

  bus.handle(shellChannels.openPath, async ({ path }) => {
    const extension = extname(path).slice(1).toLowerCase();
    if (!OPENABLE_EXTENSIONS.has(extension))
      return err('BAD_REQUEST', 'HSOS opens only documents, images and videos in their default program.');
    const failure = await shell.openPath(path);
    return failure === '' ? ok({}) : err('FILE_NOT_FOUND', 'The file could not be opened.', failure);
  });

  bus.handle(shellChannels.openFolder, async ({ path }) => {
    if (!(await isDirectory(path))) return err('BAD_REQUEST', 'Only an existing folder can be opened.');
    const failure = await shell.openPath(path);
    return failure === '' ? ok({}) : err('FILE_NOT_FOUND', 'The folder could not be opened.', failure);
  });

  bus.handle(shellChannels.revealInExplorer, ({ path }) => {
    shell.showItemInFolder(path);
    return ok({});
  });

  bus.handle(shellChannels.notify, ({ title, body, focusPanel }) => {
    const window = deps.window();
    if (window === null || window.isFocused()) return ok({});
    deps.showNotification(title, body, () => {
      const current = deps.window();
      if (current?.isMinimized() === true) current.restore();
      current?.focus();
      if (focusPanel !== null) bus.emit(workspaceChannels.focusPanelRequested, { panelId: focusPanel });
    });
    return ok({});
  });

  bus.handle(shellChannels.writeClipboard, ({ text }) => {
    deps.writeClipboard(text);
    return ok({});
  });

  bus.handle(shellChannels.windowAction, ({ action }) => {
    const window = deps.window();
    if (window === null) return err('NOT_FOUND', 'The window is not open.');
    if (action === 'minimize') window.minimize();
    else if (action === 'close') window.close();
    else if (window.isMaximized()) window.unmaximize();
    else window.maximize();
    return ok({});
  });

  bus.handle(shellChannels.getLaunchToken, (_payload, meta) => {
    if (meta.from !== 'link-service') {
      deps.log.log('warn', 'shell.launch_token_refused', { from: meta.from });
      return err('BAD_REQUEST', 'Only link-service may read the launch token.');
    }
    return ok({ token });
  });

  return token;
}
