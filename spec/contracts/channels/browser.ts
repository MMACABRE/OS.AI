/** Channels owned by the `browser` module. Spec: spec/modules/browser.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zBrowserTabId, zEmpty, zPanelId } from '../schemas';

export const BrowserTab = z.object({
  id: zBrowserTabId,
  /** The dock panel showing this tab, or null while it is being moved. */
  panelId: zPanelId.nullable(),
  url: z.string(),
  title: z.string(),
  isLoading: z.boolean(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  /** True while Claude is driving this tab (BROW-40). */
  isAgentControlled: z.boolean(),
  /** The last load error, or null. */
  error: z.string().nullable(),
});
export type BrowserTab = z.infer<typeof BrowserTab>;

/** A node of the page's accessibility tree as given to Claude (BROW-31). */
export type SnapshotNode = {
  /** Stable reference for later actions, such as `e12`. */
  ref: string;
  role: string;
  name: string;
  value?: string | undefined;
  children?: SnapshotNode[] | undefined;
};

export const SnapshotNodeSchema: z.ZodType<SnapshotNode> = z.lazy(() =>
  z.object({
    ref: z.string(),
    role: z.string(),
    name: z.string(),
    value: z.string().optional(),
    children: z.array(SnapshotNodeSchema).optional(),
  }),
);

export const ConsoleEntry = z.object({
  level: z.enum(['log', 'info', 'warn', 'error', 'debug']),
  text: z.string().max(2000),
  source: z.string().max(500).nullable(),
  time: z.number(),
});
export type ConsoleEntry = z.infer<typeof ConsoleEntry>;

export const NetworkEntry = z.object({
  method: z.string(),
  url: z.string().max(2000),
  status: z.number().int().nullable(),
  resourceType: z.string(),
  durationMs: z.number().nullable(),
  failed: z.string().nullable(),
});
export type NetworkEntry = z.infer<typeof NetworkEntry>;

/** Bounds of a browser panel's page area in window coordinates, in CSS pixels. */
export const ViewBounds = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
});
export type ViewBounds = z.infer<typeof ViewBounds>;

export const BrowserSettings = z.object({
  homeUrl: z.string().default('about:blank'),
  /** Hosts Claude may open without asking, besides localhost and 127.0.0.1. */
  agentAllowedHosts: z.array(z.string()).default([]),
  /** Ask once per host before Claude navigates to any other host. */
  askBeforeAgentNavigates: z.boolean().default(true),
  /** Keep cookies and storage between launches. Off means a fresh profile at every launch. */
  persistProfile: z.boolean().default(true),
});
export type BrowserSettings = z.infer<typeof BrowserSettings>;

export const browserSection: SettingsSection<BrowserSettings> = {
  moduleId: 'browser',
  title: 'Browser',
  schema: BrowserSettings,
  defaults: BrowserSettings.parse({}),
};

const zTab = z.object({ tabId: zBrowserTabId });

export const browserChannels = {
  // Owner-facing: called by the browser panel.
  openTab: request(
    'browser.openTab',
    'main',
    z.object({ panelId: zPanelId, url: z.string().max(8000) }),
    BrowserTab,
  ),
  closeTab: request('browser.closeTab', 'main', zTab, zEmpty),
  navigate: request('browser.navigate', 'main', z.object({ tabId: zBrowserTabId, url: z.string().max(8000) }), BrowserTab),
  back: request('browser.back', 'main', zTab, BrowserTab),
  forward: request('browser.forward', 'main', zTab, BrowserTab),
  reload: request('browser.reload', 'main', zTab, BrowserTab),
  stop: request('browser.stop', 'main', zTab, BrowserTab),
  /** Places the page view over the panel's page area. Hidden panels send width 0. */
  setBounds: request('browser.setBounds', 'main', z.object({ tabId: zBrowserTabId, bounds: ViewBounds }), zEmpty),
  openDevTools: request('browser.openDevTools', 'main', zTab, zEmpty),
  /** Starts element capture: the next click in the page picks an element (BROW-50). */
  startCapture: request('browser.startCapture', 'main', zTab, zEmpty),
  cancelCapture: request('browser.cancelCapture', 'main', zTab, zEmpty),
  /** The owner pressed "Stop Claude" on a tab (BROW-42). */
  revokeAgentControl: request('browser.revokeAgentControl', 'main', zTab, zEmpty),
  listTabs: request('browser.listTabs', 'main', zEmpty, z.array(BrowserTab)),
  tabChanged: event('browser.tabChanged', 'main', BrowserTab),
  tabClosed: event('browser.tabClosed', 'main', zTab),
  captured: event(
    'browser.captured',
    'main',
    z.object({
      tabId: zBrowserTabId,
      url: z.string(),
      selector: z.string(),
      html: z.string().max(4000),
      styles: z.string().max(2000),
    }),
  ),

  // Agent-facing: called by the cli module in link-service. Each answers within its timeout.
  agentSnapshot: request('browser.agentSnapshot', 'main', zTab, z.object({ url: z.string(), title: z.string(), tree: SnapshotNodeSchema }), 15_000),
  agentClick: request('browser.agentClick', 'main', z.object({ tabId: zBrowserTabId, ref: z.string() }), zEmpty, 15_000),
  agentType: request(
    'browser.agentType',
    'main',
    z.object({ tabId: zBrowserTabId, ref: z.string(), text: z.string().max(20_000), submit: z.boolean() }),
    zEmpty,
    15_000,
  ),
  agentPressKey: request('browser.agentPressKey', 'main', z.object({ tabId: zBrowserTabId, key: z.string().max(40) }), zEmpty, 15_000),
  agentNavigate: request('browser.agentNavigate', 'main', z.object({ tabId: zBrowserTabId.nullable(), url: z.string().max(8000) }), BrowserTab, 600_000),
  agentScreenshot: request(
    'browser.agentScreenshot',
    'main',
    z.object({ tabId: zBrowserTabId, fullPage: z.boolean() }),
    z.object({ pngBase64: z.string() }),
    30_000,
  ),
  agentConsole: request('browser.agentConsole', 'main', z.object({ tabId: zBrowserTabId, onlyErrors: z.boolean() }), z.array(ConsoleEntry)),
  agentNetwork: request('browser.agentNetwork', 'main', z.object({ tabId: zBrowserTabId, onlyFailed: z.boolean() }), z.array(NetworkEntry)),
  agentWaitFor: request(
    'browser.agentWaitFor',
    'main',
    z.object({ tabId: zBrowserTabId, text: z.string().max(500), timeoutMs: z.number().int().min(100).max(30_000) }),
    z.object({ found: z.boolean() }),
    35_000,
  ),
  /** Ends agent control of a tab when Claude is done. */
  agentRelease: request('browser.agentRelease', 'main', zTab, zEmpty),
} as const;
