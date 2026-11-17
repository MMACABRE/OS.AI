/** Channels owned by the `shell` module. Spec: spec/modules/shell.md */
import { z } from 'zod';
import { event, request } from '../bus';
import { zAbsPath, zEmpty, zPanelId, zServiceId } from '../schemas';

export const ServiceStatus = z.object({
  service: zServiceId,
  state: z.enum(['starting', 'ready', 'down', 'stopped']),
  /** Deaths in the last 60 seconds. */
  recentDeaths: z.number().int().nonnegative(),
  /** True when automatic restart has stopped (SHELL-13). */
  needsManualRestart: z.boolean(),
});
export type ServiceStatus = z.infer<typeof ServiceStatus>;

export const shellChannels = {
  /** The renderer finished registering modules and restoring the workspace (SHELL-5). */
  uiReady: request('shell.uiReady', 'main', zEmpty, zEmpty),

  getServiceStatus: request('shell.getServiceStatus', 'main', zEmpty, z.array(ServiceStatus)),
  serviceStatusChanged: event('shell.serviceStatusChanged', 'main', ServiceStatus),
  restartService: request('shell.restartService', 'main', z.object({ service: zServiceId }), zEmpty),

  /** A fresh MessagePort for `service` was posted to the renderer (architecture §2.2). */
  servicePort: event('shell.servicePort', 'main', z.object({ service: zServiceId })),

  windowAction: request(
    'shell.windowAction',
    'main',
    z.object({ action: z.enum(['minimize', 'toggleMaximize', 'close']) }),
    zEmpty,
  ),
  windowState: event(
    'shell.windowState',
    'main',
    z.object({ isMaximized: z.boolean(), isFocused: z.boolean() }),
  ),

  /** Opens the system folder picker. `null` means the owner cancelled. */
  pickFolder: request('shell.pickFolder', 'main', z.object({ title: z.string() }), zAbsPath.nullable(), 600_000),

  /** Moves a file or folder to the Recycle Bin (P-1). */
  trashItem: request('shell.trashItem', 'main', z.object({ path: zAbsPath }), zEmpty),

  /** Opens an https URL in the owner's default browser. Other schemes are refused (SHELL-21). */
  openExternal: request('shell.openExternal', 'main', z.object({ url: z.string().url() }), zEmpty),

  /**
   * Opens a file in the system's default program. Allowed only for the extensions
   * pdf, mp4, webm, png, jpg, jpeg, gif, webp, svg, html, htm, txt, md (SHELL-27).
   */
  openPath: request('shell.openPath', 'main', z.object({ path: zAbsPath }), zEmpty),

  /** Reveals a path in Windows Explorer. */
  revealInExplorer: request('shell.revealInExplorer', 'main', z.object({ path: zAbsPath }), zEmpty),

  /** Shows a Windows notification. Clicking it focuses the window and the given panel. */
  notify: request(
    'shell.notify',
    'main',
    z.object({ title: z.string().max(80), body: z.string().max(240), focusPanel: zPanelId.nullable() }),
    zEmpty,
  ),

  /**
   * The random token created at launch for local listeners (P-7). Only link-service may call
   * this; main refuses callers from the renderer with BAD_REQUEST (SHELL-26).
   */
  getLaunchToken: request('shell.getLaunchToken', 'main', zEmpty, z.object({ token: z.string().min(32) })),

  /** Writes text to the system clipboard. */
  writeClipboard: request('shell.writeClipboard', 'main', z.object({ text: z.string().max(5_000_000) }), zEmpty),
} as const;
