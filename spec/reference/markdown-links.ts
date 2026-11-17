/**
 * REFERENCE CODE. Copy to src/modules/graph/service/markdown-links.ts unchanged.
 *
 * Extracts links, tags, headings and frontmatter from one markdown note,
 * following Obsidian's link syntax (https://obsidian.md/help/links). Links inside
 * fenced code blocks, inline code and HTML comments are ignored.
 */

export type ParsedLink = {
  kind: 'wikilink' | 'markdown' | 'embed';
  /** The target without heading, block or alias: `Folder/Note`, `Note.md`, `image.png`. */
  target: string;
  heading: string | null;
  blockId: string | null;
  alias: string | null;
  /** 1-based line number. */
  line: number;
};

export type ParsedNote = {
  frontmatter: Record<string, string | string[]>;
  title: string | null;
  headings: string[];
  tags: string[];
  aliases: string[];
  links: ParsedLink[];
};

const WIKILINK = /(!?)\[\[([^\[\]\n]+?)\]\]/g;
const MARKDOWN_LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const TAG = /(^|[\s(])#([A-Za-z][\w/-]*)/g;
const INLINE_CODE = /`[^`\n]*`/g;

function parseFrontmatter(lines: string[]): { data: Record<string, string | string[]>; bodyStart: number } {
  const data: Record<string, string | string[]> = {};
  if (lines[0]?.trim() !== '---') return { data, bodyStart: 0 };

  let currentKey: string | null = null;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.trim() === '---') return { data, bodyStart: i + 1 };

    const listItem = /^\s+-\s+(.*)$/.exec(line);
    if (listItem && currentKey) {
      const existing = data[currentKey];
      const value = (listItem[1] ?? '').trim().replace(/^["']|["']$/g, '');
      data[currentKey] = Array.isArray(existing) ? [...existing, value] : [value];
      continue;
    }

    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!pair) continue;
    currentKey = pair[1] ?? null;
    const raw = (pair[2] ?? '').trim();
    if (!currentKey) continue;
    if (raw.startsWith('[') && raw.endsWith(']')) {
      data[currentKey] = raw
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter((part) => part.length > 0);
    } else if (raw !== '') {
      data[currentKey] = raw.replace(/^["']|["']$/g, '');
    } else {
      data[currentKey] = [];
    }
  }
  return { data: {}, bodyStart: 0 };
}

function splitTarget(raw: string): { target: string; heading: string | null; blockId: string | null } {
  const hashIndex = raw.indexOf('#');
  if (hashIndex === -1) return { target: raw.trim(), heading: null, blockId: null };
  const target = raw.slice(0, hashIndex).trim();
  const rest = raw.slice(hashIndex + 1).trim();
  if (rest.startsWith('^')) return { target, heading: null, blockId: rest.slice(1) };
  return { target, heading: rest.split('#')[0]?.trim() ?? null, blockId: null };
}

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function parseNote(source: string): ParsedNote {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const { data: frontmatter, bodyStart } = parseFrontmatter(lines);

  const note: ParsedNote = {
    frontmatter,
    title: null,
    headings: [],
    tags: asList(frontmatter['tags']).map((tag) => tag.replace(/^#/, '')),
    aliases: asList(frontmatter['aliases']),
    links: [],
  };
  const titleValue = frontmatter['title'];
  if (typeof titleValue === 'string') note.title = titleValue;

  let inFence = false;
  let inComment = false;

  for (let i = bodyStart; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    let line = lines[i] ?? '';

    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) continue;
      inComment = false;
      line = line.slice(end + 3);
    }
    line = line.replace(/<!--.*?-->/g, '');
    const commentStart = line.indexOf('<!--');
    if (commentStart !== -1) {
      inComment = true;
      line = line.slice(0, commentStart);
    }

    line = line.replace(INLINE_CODE, '');

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const text = heading[2] ?? '';
      note.headings.push(text);
      if (note.title === null && heading[1] === '#') note.title = text;
      continue;
    }

    for (const match of line.matchAll(WIKILINK)) {
      const isEmbed = match[1] === '!';
      const inner = match[2] ?? '';
      const pipe = inner.indexOf('|');
      const targetPart = pipe === -1 ? inner : inner.slice(0, pipe);
      const alias = pipe === -1 ? null : inner.slice(pipe + 1).trim();
      const split = splitTarget(targetPart);
      note.links.push({ kind: isEmbed ? 'embed' : 'wikilink', ...split, alias, line: lineNumber });
    }

    for (const match of line.matchAll(MARKDOWN_LINK)) {
      const href = match[3] ?? '';
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
      const decoded = (() => {
        try {
          return decodeURIComponent(href);
        } catch {
          return href;
        }
      })();
      const split = splitTarget(decoded);
      if (split.target === '' && split.heading === null) continue;
      note.links.push({
        kind: match[1] === '!' ? 'embed' : 'markdown',
        ...split,
        alias: (match[2] ?? '').trim() || null,
        line: lineNumber,
      });
    }

    for (const match of line.matchAll(TAG)) {
      const tag = match[2] ?? '';
      if (!note.tags.includes(tag)) note.tags.push(tag);
    }
  }

  return note;
}

/** Self-check. Run with: npx tsx spec/reference/markdown-links.ts */
function selfCheck(): void {
  const assertEqual = (actual: unknown, expected: unknown, label: string) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
  };

  const source = [
    '---',
    'title: Project plan',
    'tags: [plan, "q4"]',
    'aliases:',
    '  - Plan',
    '---',
    '# Ignored as title because frontmatter has one',
    'See [[Roadmap]] and [[Folder/Spec#Goals|the goals]].',
    'Block ref [[Notes#^abc-1]] and same-note [[#Risks]].',
    '![[diagram.png]] and [text](Docs/Three%20laws.md#Intro) and [web](https://example.com).',
    'Inline `[[not a link]]` and a #tag/sub here.',
    '```',
    '[[inside fence]]',
    '```',
    '<!-- [[in comment]] -->',
    '## Risks',
  ].join('\n');

  const note = parseNote(source);
  assertEqual(note.title, 'Project plan', 'title from frontmatter');
  assertEqual(note.aliases, ['Plan'], 'aliases');
  assertEqual(note.tags, ['plan', 'q4', 'tag/sub'], 'tags');
  assertEqual(note.headings, ['Ignored as title because frontmatter has one', 'Risks'], 'headings');
  assertEqual(
    note.links.map((link) => [link.kind, link.target, link.heading, link.blockId, link.alias, link.line]),
    [
      ['wikilink', 'Roadmap', null, null, null, 8],
      ['wikilink', 'Folder/Spec', 'Goals', null, 'the goals', 8],
      ['wikilink', 'Notes', null, 'abc-1', null, 9],
      ['wikilink', '', 'Risks', null, null, 9],
      ['embed', 'diagram.png', null, null, null, 10],
      ['markdown', 'Docs/Three laws.md', 'Intro', null, 'text', 10],
    ],
    'links',
  );

  const plain = parseNote('# Heading One\nText [[A]]\r\n');
  assertEqual(plain.title, 'Heading One', 'title from first heading');
  assertEqual(plain.links.length, 1, 'one link');
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('markdown-links.ts')) {
  selfCheck();
  console.log('markdown-links self-check passed');
}
