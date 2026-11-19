import type { Bus } from '@hsos/contracts/bus';
import type { AbsPath } from '@hsos/contracts/ids';
import { toAbsPath } from '@hsos/contracts/ids';
import { Button, Icon } from '@hsos/ui-kit';
import { useRepo } from './use-repo';

export type ChangesStatusProps = {
  readonly bus: Bus;
  /** Opens the first changed file's diff (see progress: the Changes side view is not reachable from here yet). */
  readonly openDiff: (path: AbsPath) => void;
};

/** The left status item `git.changes`: the number of changed files, or nothing when the tree is clean (git.md "UI"). */
export function ChangesStatus({ bus, openDiff }: ChangesStatusProps) {
  const { status } = useRepo(bus);
  if (status?.kind !== 'repo' || status.files.length === 0) return null;
  const first = status.files[0];
  const count = status.files.length;
  return (
    <Button
      variant="ghost"
      size="small"
      icon={<Icon name="changes" size={16} />}
      onPress={() => {
        if (first !== undefined) openDiff(toAbsPath(`${status.root}\\${first.path.replace(/\//g, '\\')}`));
      }}
    >
      {`${count} changed`}
    </Button>
  );
}
