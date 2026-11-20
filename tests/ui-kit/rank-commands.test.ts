import { describe, expect, it } from 'vitest';
import { matchScore, rankCommands } from '../../src/modules/ui-kit/palette/rank-commands';

const make = (titles: string[]) => titles.map((title, index) => ({ id: `c${index}`, title }));
const titlesOf = (list: readonly { title: string }[]) => list.map((item) => item.title);

describe('UI-11 command ranking', () => {
  it('UI-11 query set ranks the prefix match, then the word-start match, then a subsequence, and drops the rest', () => {
    // "Reset tasks" holds s, e, t in order but starts no word with "set".
    const commands = make(['Reset tasks', 'Open Settings', 'Toggle Side Bar', 'Settings: Open']);
    expect(titlesOf(rankCommands(commands, 'set', []))).toEqual([
      'Settings: Open',
      'Open Settings',
      'Reset tasks',
    ]);
  });

  it('UI-11 the query term ranks "Terminal: Clear" before "New Terminal" and drops "Open Settings"', () => {
    const commands = make(['New Terminal', 'Terminal: Clear', 'Open Settings']);
    expect(titlesOf(rankCommands(commands, 'term', []))).toEqual(['Terminal: Clear', 'New Terminal']);
  });

  it('UI-11 among equal scores the id in recent comes first, then registration order', () => {
    const commands = make(['Settings: Open', 'Settings: Close', 'Settings: Reset']);
    expect(titlesOf(rankCommands(commands, 'set', ['c2']))).toEqual([
      'Settings: Reset',
      'Settings: Open',
      'Settings: Close',
    ]);
    expect(titlesOf(rankCommands(commands, 'set', ['c1', 'c2']))).toEqual([
      'Settings: Close',
      'Settings: Reset',
      'Settings: Open',
    ]);
    expect(titlesOf(rankCommands(commands, 'set', []))).toEqual([
      'Settings: Open',
      'Settings: Close',
      'Settings: Reset',
    ]);
  });

  it('UI-11 an empty query lists every command in registration order', () => {
    const commands = make(['B', 'A', 'C']);
    expect(titlesOf(rankCommands(commands, '', []))).toEqual(['B', 'A', 'C']);
  });

  it('UI-11 matchScore is 3 for a prefix, 2 for a word start, 1 for a subsequence and 0 otherwise', () => {
    expect(matchScore('Settings: Open', 'set')).toBe(3);
    expect(matchScore('Open Settings', 'set')).toBe(2);
    expect(matchScore('Reset tasks', 'set')).toBe(1);
    expect(matchScore('Toggle Side Bar', 'set')).toBe(0);
  });
});
