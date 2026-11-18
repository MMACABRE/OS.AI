/** Channels and file schemas owned by the `workspace` module. Spec: spec/modules/workspace.md */
import { z } from 'zod';
import { event, request } from '../bus';
import { zAbsPath, zEmpty, zEpochMs, zPanelId, zProjectId } from '../schemas';

export const ProjectInfo = z.object({
  id: zProjectId,
  path: zAbsPath,
  /** The folder's base name. */
  name: z.string(),
});
export type ProjectInfo = z.infer<typeof ProjectInfo>;

export const RecentProject = z.object({
  path: zAbsPath,
  name: z.string(),
  lastOpened: zEpochMs,
  /** False when the folder is no longer on disk. */
  exists: z.boolean(),
});
export type RecentProject = z.infer<typeof RecentProject>;

/** One open panel as saved in the workspace file. `state` is validated by the panel's own schema on load. */
export const SavedPanel = z.object({
  type: z.string(),
  state: z.unknown(),
});
export type SavedPanel = z.infer<typeof SavedPanel>;

export const SideAreaState = z.object({
  /** Panel type of the active side view, or null when collapsed with nothing chosen. */
  activeView: z.string().nullable(),
  width: z.number().int().min(200).max(480),
  isCollapsed: z.boolean(),
});
export type SideAreaState = z.infer<typeof SideAreaState>;

/** workspaces/<projectId>.json */
export const WorkspaceFile = z.object({
  version: z.literal(1),
  projectPath: zAbsPath,
  /** The dock library's own serialised layout. Opaque to everything except workspace. */
  dock: z.unknown(),
  /** Every dock panel by id. Ids match those inside `dock`. */
  panels: z.record(z.string(), SavedPanel),
  /** Saved state of side views, by panel type. */
  sideViews: z.record(z.string(), z.unknown()),
  left: SideAreaState,
  right: SideAreaState,
  focusedPanel: zPanelId.nullable(),
  /** The page shown (WS-40, WS-44). */
  activePage: z.enum(['dashboard', 'code', 'notes']).default('code'),
  /** The notes page's own dock layout, or null for its default (WS-43). Panels live in `panels` too. */
  notesDock: z.unknown().default(null),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFile>;

export const workspaceChannels = {
  /** Opens a folder as the current project. Fails with WS_PROJECT_MISSING if it is not a folder. */
  openProject: request('workspace.openProject', 'main', z.object({ path: zAbsPath }), ProjectInfo),
  closeProject: request('workspace.closeProject', 'main', zEmpty, zEmpty),
  getCurrentProject: request('workspace.getCurrentProject', 'main', zEmpty, ProjectInfo.nullable()),
  projectChanged: event('workspace.projectChanged', 'main', ProjectInfo.nullable()),

  listRecentProjects: request('workspace.listRecentProjects', 'main', zEmpty, z.array(RecentProject)),
  forgetRecentProject: request('workspace.forgetRecentProject', 'main', z.object({ path: zAbsPath }), zEmpty),

  /** Returns null when the project has no saved workspace or the file is invalid (WS-12). */
  loadWorkspace: request(
    'workspace.loadWorkspace',
    'main',
    z.object({ projectId: zProjectId }),
    WorkspaceFile.nullable(),
  ),
  saveWorkspace: request(
    'workspace.saveWorkspace',
    'main',
    z.object({ projectId: zProjectId, workspace: WorkspaceFile }),
    zEmpty,
  ),

  /**
   * A service asks the UI to open a panel (used by `cli`). `main` re-emits it as
   * `openPanelRequested`. With `focus: false` the panel opens as a background tab (CLI-11).
   */
  requestOpenPanel: request(
    'workspace.requestOpenPanel',
    'main',
    z.object({ type: z.string(), state: z.unknown(), focus: z.boolean() }),
    zEmpty,
  ),
  openPanelRequested: event(
    'workspace.openPanelRequested',
    'main',
    z.object({ type: z.string(), state: z.unknown(), focus: z.boolean() }),
  ),
  /** Lists open dock panels for `hsos_list_panels`. The UI answers through `main`. */
  listOpenPanels: request(
    'workspace.listOpenPanels',
    'main',
    zEmpty,
    z.array(z.object({ panelId: zPanelId, type: z.string(), title: z.string(), target: z.string().nullable() })),
  ),

  /** Asks the UI to focus a panel, for example after a notification is clicked. */
  focusPanelRequested: event('workspace.focusPanelRequested', 'main', z.object({ panelId: zPanelId })),
} as const;
