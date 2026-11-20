import { PinnedComment } from '@hsos/contracts/channels/review';
import type { CommentTarget } from '@hsos/contracts/channels/review';
import { SessionListItem } from '@hsos/contracts/channels/sessions';
import { zTerminalId } from '@hsos/contracts/schemas';

/** A pinned comment built through the contract schema; `id` is padded to 12 characters. */
export function pinned(id: string, target: CommentTarget, text: string): PinnedComment {
  return PinnedComment.parse({ id: id.padEnd(12, '_'), target, text, createdAt: 1_000 });
}

type ItemInput = Partial<Omit<SessionListItem, 'liveTerminalId'>> & {
  readonly liveTerminalId?: string | null;
};

/** A session list row built through the contract schema. */
export function listItem(id: string, input: ItemInput = {}): SessionListItem {
  const { liveTerminalId = null, ...rest } = input;
  return SessionListItem.parse({
    sessionId: id,
    title: id,
    cwd: 'C:\\code\\hsos',
    startedAt: 1_000,
    lastActiveAt: Date.now() - 5 * 60_000,
    messages: 3,
    state: 'ended',
    liveTerminalId: liveTerminalId === null ? null : zTerminalId.parse(liveTerminalId),
    hasOriginal: true,
    hasBackup: true,
    note: '',
    ...rest,
  });
}
