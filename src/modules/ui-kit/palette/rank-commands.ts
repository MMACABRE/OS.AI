export type Rankable = { readonly id: string; readonly title: string };

/** How a title matches: 3 prefix, 2 word start, 1 any subsequence, 0 no match (UI-11). */
export function matchScore(title: string, query: string): number {
  const text = title.toLowerCase();
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return 1;
  if (text.startsWith(wanted)) return 3;
  if (text.split(/[^a-z0-9]+/).some((word) => word.startsWith(wanted)) || text.includes(` ${wanted}`))
    return 2;
  let position = 0;
  for (const char of wanted) {
    position = text.indexOf(char, position);
    if (position < 0) return 0;
    position += 1;
  }
  return 1;
}

/**
 * Filters and orders commands for the palette (UI-11): prefix matches, then word-start matches, then any
 * subsequence; among equals the most recently used come first, then registration order.
 * `recent` lists command ids, most recent first.
 */
export function rankCommands<T extends Rankable>(
  commands: readonly T[],
  query: string,
  recent: readonly string[],
): T[] {
  const recency = new Map(recent.map((id, index) => [id, index]));
  return commands
    .map((command, order) => ({ command, order, score: matchScore(command.title, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const ra = recency.get(a.command.id) ?? Number.POSITIVE_INFINITY;
      const rb = recency.get(b.command.id) ?? Number.POSITIVE_INFINITY;
      if (ra !== rb) return ra - rb;
      return a.order - b.order;
    })
    .map((entry) => entry.command);
}
