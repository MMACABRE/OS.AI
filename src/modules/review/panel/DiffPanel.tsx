import { useEffect, useMemo, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { CommentTarget, PinnedComment, ReviewBase } from '@hsos/contracts/channels/review';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { AbsPath, ProjectId } from '@hsos/contracts/ids';
import { PanelFrame, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { DiffView, rowsFor } from './DiffView';
import type { DiffRow } from './DiffView';
import { useRepo } from './use-repo';
import styles from './DiffPanel.module.css';

type DiffState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'binary' }
  | { readonly status: 'large' }
  | { readonly status: 'ready'; readonly rows: readonly DiffRow[] };

export type DiffPanelProps = {
  readonly bus: Bus;
  readonly path: AbsPath;
  readonly base: ReviewBase;
};

/** The diff panel (dock `review.diff`, REV-20 to REV-25): one file against its base, refreshed as changes arrive. */
export function DiffPanel({ bus, path, base }: DiffPanelProps) {
  const toast = useToast();
  const { project } = useRepo(bus);
  const projectId: ProjectId | null = project?.id ?? null;
  const [diff, setDiff] = useState<DiffState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [comments, setComments] = useState<readonly PinnedComment[]>([]);
  const name = path.slice(path.lastIndexOf('\\') + 1);
  const baseKey = base.kind === 'last-commit' ? 'last-commit' : base.sessionId;

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    setDiff({ status: 'loading' });
    void bus.call(reviewChannels.getDiff, { projectId, base, path }).then((result) => {
      if (!live) return;
      if (!result.ok) {
        setDiff({ status: 'error', message: result.error.message });
        return;
      }
      if (result.value.isBinary) {
        setDiff({ status: 'binary' });
        return;
      }
      const rows = rowsFor(result.value.before ?? '', result.value.after ?? '');
      setDiff(rows === null ? { status: 'large' } : { status: 'ready', rows });
    });
    return () => {
      live = false;
    };
  }, [bus, projectId, baseKey, path, reload]);

  // REV-20: the diff refreshes when the changed files are invalidated.
  useEffect(() => {
    if (projectId === null) return undefined;
    return bus.on(reviewChannels.changesInvalidated, (payload) => {
      if (payload.projectId === projectId) setReload((count) => count + 1);
    });
  }, [bus, projectId]);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    void bus.call(reviewChannels.listComments, { projectId }).then((result) => {
      if (live && result.ok) setComments(result.value);
    });
    const off = bus.on(reviewChannels.commentsChanged, (payload) => {
      if (payload.projectId === projectId) setComments(payload.comments);
    });
    return () => {
      live = false;
      off();
    };
  }, [bus, projectId]);

  const onAdd = useMemo(
    () => (target: CommentTarget, text: string) => {
      if (projectId === null) return;
      void bus.call(reviewChannels.addComment, { projectId, target, text }).then((result) => {
        if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
      });
    },
    [bus, projectId, toast],
  );

  const onRemove = (id: PinnedComment['id']) => {
    if (projectId === null) return;
    void bus.call(reviewChannels.removeComment, { projectId, id });
  };

  const frame: PanelViewState =
    diff.status === 'loading'
      ? { kind: 'loading', label: `Reading ${name}` }
      : diff.status === 'error'
        ? { kind: 'error', message: `This diff could not be shown. ${diff.message}`, onRetry: () => setReload((count) => count + 1) }
        : { kind: 'ready' };

  return (
    <PanelFrame title={name} state={frame}>
      {diff.status === 'binary' ? <p className={styles.note}>Binary file changed.</p> : null}
      {diff.status === 'large' ? <p className={styles.note}>This diff is too large to show.</p> : null}
      {diff.status === 'ready' && diff.rows.every((row) => row.kind === 'same') ? (
        <p className={styles.note}>No differences.</p>
      ) : null}
      {diff.status === 'ready' && diff.rows.some((row) => row.kind !== 'same') ? (
        <DiffView rows={diff.rows} path={path} comments={comments} onAdd={onAdd} onRemove={onRemove} />
      ) : null}
    </PanelFrame>
  );
}
