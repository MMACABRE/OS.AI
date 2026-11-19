import type { ModuleFixtures } from '../demo-transport';
import { ago, HOUR, HSOS, MIN, VAULT } from './world';

export const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

/** The demo project tree: folders end with `/`. Sizes and times make the file list look lived in. */
const TREE: Readonly<Record<string, readonly string[]>> = {
  '': [
    '.claude/',
    'docs/',
    'node_modules/',
    'resources/',
    'spec/',
    'src/',
    'tests/',
    'CLAUDE.md',
    'PROGRESS.md',
    'README.md',
    'package.json',
    'tsconfig.json',
  ],
  src: ['demo/', 'main/', 'modules/', 'preload/', 'services/', 'ui/'],
  'src/modules': ['diagnostics/', 'hud/', 'settings/', 'shell/', 'terminal/', 'ui-kit/'],
  'src/modules/ui-kit': ['backdrop/', 'components/', 'icons/', 'motion/', 'palette/', 'index.ts'],
  'src/modules/ui-kit/backdrop': ['scenes/', 'Backdrop.tsx', 'backdrop-worker.ts', 'use-backdrop-source.ts'],
  'src/modules/ui-kit/backdrop/scenes': ['phosphor-dust.ts', 'still.ts'],
  'src/modules/hud': ['panel/', 'register.ui.ts'],
  'src/modules/hud/panel': ['SessionRibbon.tsx', 'SessionRibbon.module.css', 'UsageBox.tsx'],
  'src/ui': ['app-root.tsx', 'bus.ts', 'fonts.css', 'index.html', 'index.tsx'],
  docs: ['release/', 'JOURNAL.md', 'handoff.md'],
  'docs/release': ['stage-u.md'],
  spec: ['design/', 'modules/', 'contracts/', 'README.md'],
  tests: ['fixtures/', 'shell/', 'ui-kit/'],
};
const DIMMED = new Set(['node_modules', '.claude']);

const TEXTS: Readonly<Record<string, string>> = {
  'CLAUDE.md': `# HSOS\n\nSpec of HSOS, a Windows desktop app built around a terminal running Claude Code.\n\n## Before any work\n\nRun \`git fetch --prune\` and \`git status -sb\`.\n\n@docs/handoff.md\n`,
  'README.md':
    '# HSOS\n\nA desktop home for Claude Code: terminals, sessions, skills, git and notes in one window.\n',
  'docs/release/stage-u.md':
    '# Stage U\n\n- The look runs on demo data.\n- Phosphor dust behind every page.\n- Sessions ribbon blinks while Claude works.\n',
  'src/modules/ui-kit/backdrop/scenes/phosphor-dust.ts':
    '/** The phosphor-dust scene: glyphs, steam and dust (spec/reference/art/background.md). */\nexport function mixSteam(base: Float32Array, steam: Float32Array, glow: number, out: Float32Array, cap: Float32Array) {\n  for (let i = 0; i < base.length; i += 1) {\n    const mixed = base[i] + steam[i] * glow;\n    // UI-34: never brighter than 0.6 of the accent, per channel.\n    out[i] = Math.min(mixed, cap[i % 4]);\n  }\n}\n',
};

const relOf = (absolute: string, root: string): string =>
  absolute.toLowerCase() === root.toLowerCase() ? '' : absolute.slice(root.length + 1).replace(/\\/g, '/');

function listDir(dir: string) {
  const root = dir.toLowerCase().startsWith(VAULT.path.toLowerCase()) ? VAULT.path : HSOS.path;
  const rel = relOf(dir, root);
  const names = TREE[rel] ?? [];
  return names.map((entry, index) => {
    const isDir = entry.endsWith('/');
    const name = isDir ? entry.slice(0, -1) : entry;
    const relPath = rel === '' ? name : `${rel}/${name}`;
    return {
      name,
      relPath,
      kind: isDir ? 'dir' : 'file',
      size: isDir ? 0 : 1_200 + index * 517,
      modifiedAt: ago((index + 1) * 37 * MIN),
      isDimmed: DIMMED.has(name),
      isSymlink: false,
    };
  });
}

function read(path: string) {
  const rel = relOf(path, HSOS.path);
  const version = { path, hash: HASH, modifiedAt: ago(2 * HOUR), size: 2_048 };
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(path)) return { kind: 'image', version };
  const text = TEXTS[rel] ?? `// ${rel}\n// Demo content: the real file is read by the files service.\n`;
  return {
    kind: 'text',
    version: { ...version, size: text.length },
    text,
    format: { encoding: 'utf8', eol: 'lf' },
  };
}

/** The `files` channels over the demo tree. */
export const filesFixtures: ModuleFixtures = {
  requests: {
    'files.listDir': (payload: { dir: string }) => listDir(payload.dir),
    'files.read': (payload: { path: string }) => read(payload.path),
    'files.stat': (payload: { path: string }) => ({
      path: payload.path,
      hash: HASH,
      modifiedAt: ago(2 * HOUR),
      size: 2_048,
    }),
    'files.save': (payload: { path: string; content: string }) => ({
      path: payload.path,
      hash: HASH,
      modifiedAt: ago(0),
      size: payload.content.length,
    }),
    'files.writeBytes': (payload: { path: string }) => ({
      path: payload.path,
      hash: HASH,
      modifiedAt: ago(0),
      size: 2_048,
    }),
    'files.createFile': (payload: { path: string }) => ({
      path: payload.path,
      hash: HASH,
      modifiedAt: ago(0),
      size: 0,
    }),
    'files.createDir': {},
    'files.rename': {},
    'files.trash': {},
    'files.search': (payload: { query: string }) =>
      Object.keys(TEXTS)
        .concat(['src/ui/index.tsx', 'src/modules/hud/panel/SessionRibbon.tsx', 'spec/design/motion.md'])
        .filter((rel) => rel.toLowerCase().includes(payload.query.toLowerCase()) || payload.query === '')
        .map((rel, index) => ({
          path: `${HSOS.path}\\${rel.replace(/\//g, '\\')}`,
          relPath: rel,
          score: 100 - index,
        })),
    'files.storeUnsaved': {},
    'files.listUnsaved': [],
    'files.discardUnsaved': {},
  },
};
