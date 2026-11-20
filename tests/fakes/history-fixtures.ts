import { Snapshot } from '@hsos/contracts/channels/history';
import type { SnapshotSource } from '@hsos/contracts/channels/history';
import type { AbsPath } from '@hsos/contracts/ids';

/** A snapshot built through the contract schema. `id` is padded to 12 characters. */
export function snapshot(
  id: string,
  path: AbsPath,
  source: SnapshotSource,
  size: number,
  time: number = Date.now(),
): Snapshot {
  return Snapshot.parse({ id: id.padEnd(12, '_'), path, hash: 'd'.repeat(64), time, size, source });
}
