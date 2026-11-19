import type { ModuleFixtures } from '../demo-transport';
import { ago, DAY, HOME, HOUR, HSOS, v } from './world';

/** 40 vault notes in four communities, written as the owner's notes about HSOS. */
const NOTES: readonly [string, number, readonly string[]][] = [
  ['Phosphor look', 0, ['design']],
  ['One colour per job', 0, ['design']],
  ['Glow not shadow', 0, ['design']],
  ['Corner brackets', 0, ['design']],
  ['Pixel icons', 0, ['design']],
  ['Strawberry mascot', 0, ['design', 'mascot']],
  ['Dust and steam', 0, ['design', 'background']],
  ['CRT overlay', 0, ['design', 'background']],
  ['Glass map', 0, ['design']],
  ['Motion rules', 1, ['motion']],
  ['Buttons lift', 1, ['motion']],
  ['Stagger on enter', 1, ['motion']],
  ['Rolling numbers', 1, ['motion']],
  ['Reduced motion', 1, ['motion', 'a11y']],
  ['Page transitions', 1, ['motion']],
  ['Ribbon blink', 1, ['motion', 'hud']],
  ['Terminal text never moves', 1, ['motion', 'terminal']],
  ['Claude sessions', 2, ['claude']],
  ['Needs-you states', 2, ['claude', 'hud']],
  ['Usage limits', 2, ['claude']],
  ['Subagents', 2, ['claude']],
  ['Session recovery', 2, ['claude']],
  ['Hook receiver', 2, ['claude', 'link']],
  ['Skills deck', 2, ['skills']],
  ['Skill states', 2, ['skills']],
  ['Quick bar', 2, ['hud']],
  ['Weekly review', 3, ['review']],
  ['Inbox', 3, ['review']],
  ['Reading list', 3, ['review']],
  ['Release checklist', 3, ['release']],
  ['Stage U plan', 3, ['release']],
  ['Look first', 3, ['release', 'design']],
  ['Owner gate', 3, ['release']],
  ['Bus design', 3, ['architecture']],
  ['Supervisor', 3, ['architecture']],
  ['Settings files', 3, ['architecture']],
  ['Demo backend', 3, ['architecture', 'release']],
  ['Ideas', 3, []],
  ['Daily 2026-11-17', 3, ['daily']],
  ['Daily 2026-11-18', 3, ['daily']],
];

const LINKS: readonly [string, string][] = [
  ['Phosphor look', 'One colour per job'],
  ['Phosphor look', 'Glow not shadow'],
  ['Phosphor look', 'Corner brackets'],
  ['Phosphor look', 'Pixel icons'],
  ['Phosphor look', 'Strawberry mascot'],
  ['Phosphor look', 'Dust and steam'],
  ['Dust and steam', 'CRT overlay'],
  ['Dust and steam', 'Glass map'],
  ['Glass map', 'Glow not shadow'],
  ['Motion rules', 'Buttons lift'],
  ['Motion rules', 'Stagger on enter'],
  ['Motion rules', 'Rolling numbers'],
  ['Motion rules', 'Reduced motion'],
  ['Motion rules', 'Page transitions'],
  ['Motion rules', 'Ribbon blink'],
  ['Motion rules', 'Terminal text never moves'],
  ['Buttons lift', 'Phosphor look'],
  ['Ribbon blink', 'Needs-you states'],
  ['Claude sessions', 'Needs-you states'],
  ['Claude sessions', 'Usage limits'],
  ['Claude sessions', 'Subagents'],
  ['Claude sessions', 'Session recovery'],
  ['Claude sessions', 'Hook receiver'],
  ['Skills deck', 'Skill states'],
  ['Skills deck', 'Quick bar'],
  ['Quick bar', 'Claude sessions'],
  ['Weekly review', 'Inbox'],
  ['Weekly review', 'Reading list'],
  ['Weekly review', 'Daily 2026-11-17'],
  ['Daily 2026-11-18', 'Daily 2026-11-17'],
  ['Daily 2026-11-18', 'Demo backend'],
  ['Release checklist', 'Stage U plan'],
  ['Stage U plan', 'Look first'],
  ['Look first', 'Owner gate'],
  ['Look first', 'Phosphor look'],
  ['Stage U plan', 'Demo backend'],
  ['Bus design', 'Supervisor'],
  ['Supervisor', 'Settings files'],
  ['Demo backend', 'Bus design'],
  ['Ideas', 'Strawberry mascot'],
  ['Ideas', 'Motion rules'],
  ['Inbox', 'Ideas'],
  ['Reading list', 'Ghost note'],
];

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const degree = new Map<string, number>();
for (const [a, b] of LINKS) {
  degree.set(a, (degree.get(a) ?? 0) + 1);
  degree.set(b, (degree.get(b) ?? 0) + 1);
}

const note = ([label, community, tags]: (typeof NOTES)[number], index: number) => ({
  id: `note:${slug(label)}`,
  kind: 'note',
  label,
  path: v(`${label}.md`),
  root: 'vault',
  tags: [...tags],
  modifiedAt: ago((index % 9) * 7 * HOUR + (index % 4) * DAY),
  degree: degree.get(label) ?? 0,
  community,
  loadsAtStart: false,
  lineCount: 18 + ((index * 13) % 90),
});

export const GRAPH_NODES = [
  {
    id: 'claudeMd:project',
    kind: 'claudeMd',
    label: 'CLAUDE.md',
    path: `${HSOS.path}\\CLAUDE.md`,
    root: 'project',
    tags: [],
    modifiedAt: ago(5 * HOUR),
    degree: 6,
    community: null,
    loadsAtStart: true,
    lineCount: 96,
  },
  ...NOTES.map(note),
  ...['hsluck', 'caveman', 'phosphor-check'].map((name, index) => ({
    id: `skill:${name}`,
    kind: 'skill',
    label: name,
    path: `${HOME}\\.agents\\skills\\${name}\\SKILL.md`,
    root: 'claude',
    tags: [],
    modifiedAt: ago((index + 1) * DAY),
    degree: 1,
    community: 2,
    loadsAtStart: false,
    lineCount: 60 + index * 12,
  })),
  {
    id: 'memory:look-first',
    kind: 'memory',
    label: 'Look first build order',
    path: `${HOME}\\.claude\\projects\\hsos\\memory\\look-first-build-order.md`,
    root: 'claude',
    tags: [],
    modifiedAt: ago(2 * DAY),
    degree: 1,
    community: 3,
    loadsAtStart: true,
    lineCount: 9,
  },
  {
    id: 'unresolved:ghost-note',
    kind: 'unresolved',
    label: 'Ghost note',
    path: null,
    root: 'vault',
    tags: [],
    modifiedAt: null,
    degree: 1,
    community: null,
    loadsAtStart: false,
    lineCount: 0,
  },
];

export const GRAPH_EDGES = [
  ...LINKS.map(([a, b]) => ({
    source: `note:${slug(a)}`,
    target: b === 'Ghost note' ? 'unresolved:ghost-note' : `note:${slug(b)}`,
    kind: 'wikilink',
  })),
  ...['Phosphor look', 'Look first', 'Stage U plan', 'Bus design'].map((label) => ({
    source: 'claudeMd:project',
    target: `note:${slug(label)}`,
    kind: 'markdown',
  })),
  { source: 'claudeMd:project', target: 'skill:hsluck', kind: 'import' },
  { source: 'claudeMd:project', target: 'memory:look-first', kind: 'import' },
  { source: 'skill:caveman', target: 'note:skill-states', kind: 'markdown' },
  { source: 'skill:phosphor-check', target: 'note:phosphor-look', kind: 'markdown' },
];

const status = {
  state: 'idle',
  notes: NOTES.length,
  links: GRAPH_EDGES.length,
  unresolved: 1,
  processed: NOTES.length,
  total: NOTES.length,
  error: null,
};

/** The `graph` channels: a vault of 40 linked notes around CLAUDE.md. */
export const graphFixtures: ModuleFixtures = {
  requests: {
    'graph.getStatus': status,
    'graph.getGraph': { nodes: GRAPH_NODES, edges: GRAPH_EDGES },
    'graph.backlinks': (payload: { path: string }) => {
      const label = NOTES.find(([name]) => payload.path.endsWith(`${name}.md`))?.[0];
      return LINKS.filter(([, target]) => target === label).map(([from], index) => ({
        from: v(`${from}.md`),
        fromLabel: from,
        line: 4 + index * 3,
        context: `See [[${label ?? ''}]] for the details.`,
      }));
    },
    'graph.outgoing': (payload: { path: string }) => {
      const label = NOTES.find(([name]) => payload.path.endsWith(`${name}.md`))?.[0];
      return GRAPH_EDGES.filter((edge) => label !== undefined && edge.source === `note:${slug(label)}`);
    },
    'graph.resolve': (payload: { target: string }) => ({
      path: NOTES.some(([name]) => name === payload.target) ? v(`${payload.target}.md`) : null,
      heading: null,
      blockId: null,
    }),
    'graph.search': (payload: { query: string; limit: number }) =>
      GRAPH_NODES.filter((node) => node.label.toLowerCase().includes(payload.query.toLowerCase())).slice(
        0,
        payload.limit,
      ),
    'graph.reindex': {},
    'graph.preview': (payload: { path: string }) => {
      const label = NOTES.find(([name]) => payload.path.endsWith(`${name}.md`))?.[0] ?? 'Note';
      const links = LINKS.filter(([from]) => from === label).map(([, to]) => `[[${to}]]`);
      return {
        text: `# ${label}\n\nNotes on ${label.toLowerCase()} for HSOS.\n\n${links.length > 0 ? `Related: ${links.join(', ')}` : 'No links yet.'}\n`,
        truncated: false,
      };
    },
  },
};
