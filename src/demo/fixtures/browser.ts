import type { ModuleFixtures } from '../demo-transport';

const tab = (id: string, url: string, title: string, agent = false) => ({
  id,
  panelId: null,
  url,
  title,
  isLoading: false,
  canGoBack: true,
  canGoForward: false,
  isAgentControlled: agent,
  error: null,
});

/** Two tabs: the local dev server Claude is checking, and the GitHub repo. */
export const BROWSER_TABS = [
  tab('btab00000001', 'http://localhost:5173/', 'HSOS dev server', true),
  tab('btab00000002', 'https://github.com/hsos-owner/hsos', 'hsos-owner/hsos'),
];

/**
 * The `browser` channels. The demo has no page views (they need main); tab lists and navigation answer
 * from fixtures, and the agent tools fall back to schema-built data.
 */
export const browserFixtures: ModuleFixtures = {
  requests: {
    'browser.listTabs': BROWSER_TABS,
    'browser.openTab': (payload: { url?: string }) =>
      tab('btab00000003', payload.url ?? 'about:blank', 'New tab'),
    'browser.navigate': (payload: { tabId: string; url: string }) => ({
      ...BROWSER_TABS[0],
      id: payload.tabId,
      url: payload.url,
    }),
    'browser.agentSnapshot': {
      url: 'http://localhost:5173/',
      title: 'HSOS dev server',
      tree: {
        ref: 'e1',
        role: 'document',
        name: 'HSOS dev server',
        children: [
          { ref: 'e2', role: 'heading', name: 'HSOS' },
          { ref: 'e3', role: 'button', name: 'Open Settings' },
          { ref: 'e4', role: 'textbox', name: 'Search settings', value: '' },
        ],
      },
    },
  },
};
