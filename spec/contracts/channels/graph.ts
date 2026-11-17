/** Channels owned by the `graph` module. Spec: spec/modules/graph.md */
import { z } from 'zod';
import { event, request } from '../bus';
import type { SettingsSection } from '../module';
import { zAbsPath, zEmpty, zEpochMs, zProjectId } from '../schemas';

export const NodeKind = z.enum([
  /** Any markdown note. */
  'note',
  /** A CLAUDE.md or AGENTS.md file. */
  'claudeMd',
  /** A SKILL.md file. */
  'skill',
  /** A file in a Claude memory folder (`memory\*.md`). */
  'memory',
  /** A link target that does not exist. */
  'unresolved',
]);
export type NodeKind = z.infer<typeof NodeKind>;

export const GraphNode = z.object({
  /** The absolute path for files; `unresolved:<target text>` for missing targets. */
  id: z.string(),
  kind: NodeKind,
  /** Title: frontmatter `title`, else the first `# ` heading, else the file name without `.md`. */
  label: z.string(),
  path: zAbsPath.nullable(),
  /** Which root the file is in. */
  root: z.enum(['project', 'vault', 'claude']),
  tags: z.array(z.string()),
  modifiedAt: zEpochMs.nullable(),
  /** Number of links in plus links out. */
  degree: z.number().int().nonnegative(),
  /** Community number from Louvain clustering, or null before it is computed. */
  community: z.number().int().nullable(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  source: z.string(),
  target: z.string(),
  kind: z.enum(['wikilink', 'markdown', 'embed']),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const LinkRef = z.object({
  /** The note that holds the link. */
  from: zAbsPath,
  fromLabel: z.string(),
  line: z.number().int().positive(),
  /** The line's text around the link, cut to 200 characters. */
  context: z.string(),
});
export type LinkRef = z.infer<typeof LinkRef>;

export const IndexStatus = z.object({
  state: z.enum(['idle', 'indexing', 'error']),
  notes: z.number().int().nonnegative(),
  links: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
  /** Files read so far during indexing, for progress. */
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type IndexStatus = z.infer<typeof IndexStatus>;

export const GraphSettings = z.object({
  /** Include the Claude Code folder (`%USERPROFILE%\.claude`: CLAUDE.md, memory, skills). */
  includeClaudeFolder: z.boolean().default(true),
  /** Folder names never indexed. */
  exclude: z.array(z.string()).default(['node_modules', '.git', '.obsidian', '.trash', 'dist', 'build']),
  /** Show unresolved targets as nodes. */
  showUnresolved: z.boolean().default(false),
  /** Show notes with no links. */
  showOrphans: z.boolean().default(true),
  /** Link depth shown by the local graph. */
  localDepth: z.number().int().min(1).max(3).default(1),
  maxFileBytes: z.number().int().min(10_000).max(10_000_000).default(1_000_000),
});
export type GraphSettings = z.infer<typeof GraphSettings>;

export const graphSection: SettingsSection<GraphSettings> = {
  moduleId: 'graph',
  title: 'Graph',
  schema: GraphSettings,
  defaults: GraphSettings.parse({}),
};

export const graphChannels = {
  getStatus: request('graph.getStatus', 'workspace-service', zEmpty, IndexStatus),
  statusChanged: event('graph.statusChanged', 'workspace-service', IndexStatus),
  /** The whole graph of the current project, vault and Claude folder. */
  getGraph: request(
    'graph.getGraph',
    'workspace-service',
    z.object({ projectId: zProjectId }),
    z.object({ nodes: z.array(GraphNode), edges: z.array(GraphEdge) }),
    30_000,
  ),
  /** Emitted after the index changes. Carries ids so views can update without refetching everything. */
  graphChanged: event(
    'graph.graphChanged',
    'workspace-service',
    z.object({ changedNodeIds: z.array(z.string()), removedNodeIds: z.array(z.string()) }),
  ),
  backlinks: request('graph.backlinks', 'workspace-service', z.object({ path: zAbsPath }), z.array(LinkRef)),
  outgoing: request('graph.outgoing', 'workspace-service', z.object({ path: zAbsPath }), z.array(GraphEdge)),
  /** Resolves link text such as `Note`, `Folder/Note#Heading` or `Note|Alias` from a given note. */
  resolve: request(
    'graph.resolve',
    'workspace-service',
    z.object({ from: zAbsPath, target: z.string().max(1000) }),
    z.object({ path: zAbsPath.nullable(), heading: z.string().nullable(), blockId: z.string().nullable() }),
  ),
  /** Notes whose title, alias, tag or path matches `query`, best first. */
  search: request(
    'graph.search',
    'workspace-service',
    z.object({ query: z.string().max(200), limit: z.number().int().min(1).max(100) }),
    z.array(GraphNode),
  ),
  reindex: request('graph.reindex', 'workspace-service', zEmpty, zEmpty, 600_000),
} as const;
