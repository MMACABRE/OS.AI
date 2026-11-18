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
  /** %LOCALAPPDATA%\HSOS\link-usage.json: last use of MCP servers and subagents seen by HSOS (LINK-72). */
  readonly linkUsageFile: AbsPath;
  /** %LOCALAPPDATA%\HSOS\terminal\terminal-init.ps1, rewritten by pty-host at every start (TERM-8). */
  readonly terminalInitFile: AbsPath;

  workspaceFile(project: ProjectId): AbsPath;
  historyDir(project: ProjectId): AbsPath;
  noteIndexFile(project: ProjectId): AbsPath;
  terminalRestoreFile(project: ProjectId, terminal: TerminalId): AbsPath;
  hotExitDir(project: ProjectId): AbsPath;
  /** %LOCALAPPDATA%\HSOS\activity\<projectId>-artifacts.json */
  artifactsFile(project: ProjectId): AbsPath;
  /** %LOCALAPPDATA%\HSOS\review\<projectId>-comments.json */
  reviewCommentsFile(project: ProjectId): AbsPath;
};
