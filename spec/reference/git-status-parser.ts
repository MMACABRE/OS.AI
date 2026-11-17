/**
 * REFERENCE CODE. Copy to src/modules/git/service/git-status-parser.ts unchanged.
 *
 * Parses the output of:
 *   git status --porcelain=v2 --branch -z --untracked-files=all
 * Entries are separated by NUL. A rename or copy entry is followed by one extra
 * NUL-terminated field holding the original path.
 */

export type ChangeCode = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type-changed' | 'unmodified';

export type StatusEntry = {
  /** Path relative to the repo root, forward slashes. */
  path: string;
  /** Original path for a rename or copy, else null. */
  originalPath: string | null;
  /** State of the staged copy compared with HEAD. */
  staged: ChangeCode;
  /** State of the working file compared with the staged copy. */
  unstaged: ChangeCode;
  isUntracked: boolean;
  isConflicted: boolean;
};

export type ParsedStatus = {
  /** Branch name, or null when HEAD is detached. */
  branch: string | null;
  /** Upstream such as `origin/main`, or null when none is set. */
  upstream: string | null;
  ahead: number;
  behind: number;
  /** True when the repo has no commits yet. */
  isInitial: boolean;
  entries: StatusEntry[];
};

const CODES: Record<string, ChangeCode> = {
  '.': 'unmodified',
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'type-changed',
};

function code(letter: string): ChangeCode {
  return CODES[letter] ?? 'modified';
}

/** Returns the text after the first `count` space-separated fields. Paths may contain spaces. */
function afterFields(line: string, count: number): string {
  let index = 0;
  for (let i = 0; i < count; i += 1) {
    index = line.indexOf(' ', index) + 1;
    if (index === 0) return '';
  }
  return line.slice(index);
}

export function parseGitStatus(output: string): ParsedStatus {
  const status: ParsedStatus = { branch: null, upstream: null, ahead: 0, behind: 0, isInitial: false, entries: [] };
  const fields = output.split('\0');

  for (let i = 0; i < fields.length; i += 1) {
    const line = fields[i] ?? '';
    if (line === '') continue;

    if (line.startsWith('# branch.oid ')) {
      status.isInitial = line.slice('# branch.oid '.length) === '(initial)';
    } else if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length);
      status.branch = head === '(detached)' ? null : head;
    } else if (line.startsWith('# branch.upstream ')) {
      status.upstream = line.slice('# branch.upstream '.length);
    } else if (line.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line);
      if (match) {
        status.ahead = Number(match[1]);
        status.behind = Number(match[2]);
      }
    } else if (line.startsWith('1 ')) {
      const xy = line.slice(2, 4);
      status.entries.push({
        path: afterFields(line, 8),
        originalPath: null,
        staged: code(xy.charAt(0)),
        unstaged: code(xy.charAt(1)),
        isUntracked: false,
        isConflicted: false,
      });
    } else if (line.startsWith('2 ')) {
      const xy = line.slice(2, 4);
      const originalPath = fields[i + 1] ?? null;
      i += 1;
      status.entries.push({
        path: afterFields(line, 9),
        originalPath,
        staged: code(xy.charAt(0)),
        unstaged: code(xy.charAt(1)),
        isUntracked: false,
        isConflicted: false,
      });
    } else if (line.startsWith('u ')) {
      status.entries.push({
        path: afterFields(line, 10),
        originalPath: null,
        staged: 'modified',
        unstaged: 'modified',
        isUntracked: false,
        isConflicted: true,
      });
    } else if (line.startsWith('? ')) {
      status.entries.push({
        path: line.slice(2),
        originalPath: null,
        staged: 'unmodified',
        unstaged: 'added',
        isUntracked: true,
        isConflicted: false,
      });
    }
    // Lines starting with '!' (ignored files) and unknown headers are skipped.
  }

  return status;
}

/** Self-check. Run with: npx tsx spec/reference/git-status-parser.ts */
function selfCheck(): void {
  const assertEqual = (actual: unknown, expected: unknown, label: string) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`);
  };

  const sample = [
    '# branch.oid 6b2032c39c5a15ee052fb66c39f8ffb047976cef',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -1',
    '1 .M N... 100644 100644 100644 aaaa bbbb src/app file.ts',
    '1 A. N... 000000 100644 100644 0000 cccc new.ts',
    '2 R. N... 100644 100644 100644 dddd eeee R100 docs/new name.md',
    'docs/old name.md',
    'u UU N... 100644 100644 100644 100644 1111 2222 3333 conflict.txt',
    '? notes/todo list.md',
    '! ignored.log',
    '',
  ].join('\0');

  const parsed = parseGitStatus(sample);
  assertEqual(parsed.branch, 'main', 'branch');
  assertEqual(parsed.upstream, 'origin/main', 'upstream');
  assertEqual([parsed.ahead, parsed.behind], [2, 1], 'ahead and behind');
  assertEqual(parsed.entries.length, 5, 'entry count');
  assertEqual(parsed.entries[0], { path: 'src/app file.ts', originalPath: null, staged: 'unmodified', unstaged: 'modified', isUntracked: false, isConflicted: false }, 'modified entry with a space in its path');
  assertEqual(parsed.entries[1]?.staged, 'added', 'added entry');
  assertEqual([parsed.entries[2]?.path, parsed.entries[2]?.originalPath, parsed.entries[2]?.staged], ['docs/new name.md', 'docs/old name.md', 'renamed'], 'rename entry');
  assertEqual([parsed.entries[3]?.path, parsed.entries[3]?.isConflicted], ['conflict.txt', true], 'conflict entry');
  assertEqual([parsed.entries[4]?.path, parsed.entries[4]?.isUntracked], ['notes/todo list.md', true], 'untracked entry');

  const detached = parseGitStatus(['# branch.oid abc', '# branch.head (detached)', ''].join('\0'));
  assertEqual([detached.branch, detached.upstream, detached.ahead], [null, null, 0], 'detached head');

  const initial = parseGitStatus(['# branch.oid (initial)', '# branch.head main', ''].join('\0'));
  assertEqual(initial.isInitial, true, 'initial repo');
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('git-status-parser.ts')) {
  selfCheck();
  console.log('git-status-parser self-check passed');
}
