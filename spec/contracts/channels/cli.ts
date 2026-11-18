/** Settings and command names of the `cli` module. Spec: spec/modules/cli.md */
import { z } from 'zod';
import type { SettingsSection } from '../module';

/** Every `hsos <group> <command>` HSOS offers to Claude. The names are part of the contract with Claude. */
export const CLI_COMMANDS = {
  browser: [
    'navigate',
    'snapshot',
    'click',
    'type',
    'press-key',
    'screenshot',
    'console',
    'network',
    'wait-for',
    'tabs',
    'release',
  ],
  workspace: ['open-file', 'show-diff', 'reveal-in-tree', 'notify', 'list-panels'],
  graph: ['search', 'backlinks', 'focus'],
  review: ['comments'],
} as const;

export type CliGroup = keyof typeof CLI_COMMANDS;
export type CliCommandName = (typeof CLI_COMMANDS)[CliGroup][number];

export const CliSettings = z.object({
  enabled: z.boolean().default(true),
  /** Groups of commands offered. `hsos help` lists only these. */
  groups: z.array(z.enum(['browser', 'workspace', 'graph', 'review'])).default(['browser', 'workspace', 'graph', 'review']),
});
export type CliSettings = z.infer<typeof CliSettings>;

export const cliSection: SettingsSection<CliSettings> = {
  moduleId: 'cli',
  title: 'Claude tools (hsos command)',
  schema: CliSettings,
  defaults: CliSettings.parse({}),
};

/** The permission rule `session-settings.json` carries so Claude runs `hsos` without a prompt (CLI-3). */
export const CLI_PERMISSION_RULE = 'Bash(hsos *)';
