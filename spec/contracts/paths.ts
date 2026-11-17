/**
 * Every location HSOS reads or writes for its own data. See spec/02-architecture.md §5.
 * Modules get a DataPaths from their context and never build these paths themselves.
 */
import type { AbsPath, ProjectId, TerminalId } from './ids';

export type DataPaths = {
  /** %APPDATA%\HSOS */
  readonly configRoot: AbsPath;
  /** %LOCALAPPDATA%\HSOS */
  readonly localRoot: AbsPath;

  readonly settingsFile: AbsPath;
  readonly keybindingsFile: AbsPath;
  readonly themesDir: AbsPath;
  readonly appStateFile: AbsPath;
  readonly skillFavouritesFile: AbsPath;

  readonly logsDir: AbsPath;
  readonly crashDir: AbsPath;
  readonly browserProfileDir: AbsPath;
  readonly linkDir: AbsPath;

  workspaceFile(project: ProjectId): AbsPath;
  historyDir(project: ProjectId): AbsPath;
  noteIndexFile(project: ProjectId): AbsPath;
  terminalRestoreFile(project: ProjectId, terminal: TerminalId): AbsPath;
  hotExitDir(project: ProjectId): AbsPath;
};
