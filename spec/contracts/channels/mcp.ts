/** Settings and tool names of the `mcp` module. Spec: spec/modules/mcp.md */
import { z } from 'zod';
import type { SettingsSection } from '../module';

/** Every tool HSOS offers to Claude, by group. The names are part of the contract with Claude. */
export const MCP_TOOLS = {
  browser: [
    'browser_navigate',
    'browser_snapshot',
    'browser_click',
    'browser_type',
    'browser_press_key',
    'browser_screenshot',
    'browser_console',
    'browser_network',
    'browser_wait_for',
    'browser_tabs',
    'browser_release',
  ],
  workspace: ['hsos_open_file', 'hsos_show_diff', 'hsos_reveal_in_tree', 'hsos_notify', 'hsos_list_panels'],
  graph: ['graph_search', 'graph_backlinks', 'graph_focus'],
  review: ['review_list_comments'],
} as const;

export type McpToolGroup = keyof typeof MCP_TOOLS;
export type McpToolName = (typeof MCP_TOOLS)[McpToolGroup][number];

export const McpSettings = z.object({
  enabled: z.boolean().default(true),
  /** Groups of tools offered. Fewer groups means less of Claude's context is used. */
  groups: z.array(z.enum(['browser', 'workspace', 'graph', 'review'])).default(['browser', 'workspace', 'graph', 'review']),
});
export type McpSettings = z.infer<typeof McpSettings>;

export const mcpSection: SettingsSection<McpSettings> = {
  moduleId: 'mcp',
  title: 'Claude tools (MCP)',
  schema: McpSettings,
  defaults: McpSettings.parse({}),
};
