import type { Bus } from '@hsos/contracts/bus';
import { Button, Icon } from '@hsos/ui-kit';
import { OPERATION_WORD } from './actions';
import { useRepo } from './use-repo';

export type ChangesStatusProps = {
  readonly bus: Bus;
  /** Shows the Changes side view (git.md "UI"). */
  readonly openChanges: () => void;
};

/**
 * The left status item `git.changes`: the number of changed files, "Merge in progress" (or the other operation)
 * while one runs (GIT-26), and "Offline" after a failed fetch. Nothing when the tree is clean.
 */
export function ChangesStatus({ bus, openChanges }: ChangesStatusProps) {
  const { status } = useRepo(bus);
  if (status?.kind !== 'repo') return null;
  const count = status.files.length;
  const word = status.operation === 'none' ? null : OPERATION_WORD[status.operation];
  if (word === null && count === 0 && !status.isOffline) return null;
  const parts = [
    word ?? (count === 0 ? null : `${count} changed`),
    status.isOffline ? 'Offline' : null,
  ].filter((part): part is string => part !== null);
  return (
    <Button variant="ghost" size="small" icon={<Icon name="changes" size={16} />} onPress={openChanges}>
      {parts.join(' · ')}
    </Button>
  );
}
