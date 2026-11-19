import { useEffect, useMemo, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { CommentTarget, PinnedComment, ReviewBase } from '@hsos/contracts/channels/review';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { AbsPath, ProjectId } from '@hsos/contracts/ids';
import { Button, DiffView, PanelFrame, Switch, useToast } from '@hsos/ui-kit';
import type { DiffRow, PanelViewState } from '@hsos/ui-kit';
import { useRepo } from './use-repo';
import styles from './DiffPanel.module.css';

type DiffState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'binary' }
  | { readonly status: 'ready'; readonly before: string; readonly after: string };

export type DiffPanelProps = {
  readonly bus: Bus;
  readonly path: AbsPath;
  readonly base: ReviewBase;
};

/** REV-23: the comment target of one line; a removed line pins to the old file (REV-31). */
export function targetOf(row: DiffRow, path: AbsPath): CommentTarget {
  const quote = row.text.slice(0, 300);
  if (row.kind === 'removed') return { kind: 'diff-line', path, line: row.before ?? 1, side: 'before', quote };
  return { kind: 'diff-line', path, line: row.after ?? 1, side: 'after', quote };
}

const sameLine = (target: CommentTarget, other: CommentTarget) =>
  target.kind === 'diff-line' &&
  other.kind === 'diff-line' &&
  target.path === other.path &&
  target.side === other.side &&
  target.line === other.line;

/**
 * The diff panel (dock `review.diff`, REV-20 to REV-25): one file against its base. A refresh keeps the
 * diff on screen until the new one arrives, so the scroll position and an open comment box stay (REV-20).
 */
export function DiffPanel({ bus, path, base }: DiffPanelProps) {
  const toast = useToast();
  const { project } = useRepo(bus);
  const projectId: ProjectId | null = project?.id ?? null;
  const [diff, setDiff] = useState<DiffState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [comments, setComments] = useState<readonly PinnedComment[]>([]);
  const [split, setSplit] = useState(false);
  const [composing, setComposing] = useState<CommentTarget | null>(null);
  const [draft, setDraft] = useState('');
  const name = path.slice(path.lastIndexOf('\\') + 1);
  const baseKey = base.kind === 'last-commit' ? 'last-commit' : base.sessionId;

  // A new file or base starts from loading; a refresh of the same one does not.
  useEffect(() => setDiff({ status: 'loading' }), [projectId, baseKey, path]);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    void bus.call(reviewChannels.getDiff, { projectId, base, path }).then((result) => {
      if (!live) return;
      if (!result.ok) setDiff({ status: 'error', message: result.error.message });
      else if (result.value.isBinary) setDiff({ status: 'binary' });
      else setDiff({ status: 'ready', before: result.value.before ?? '', after: result.value.after ?? '' });
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

  const save = () => {
    const text = draft.trim();
    if (projectId === null || composing === null || text === '') return;
    const target = composing;
    setComposing(null);
    setDraft('');
    void bus.call(reviewChannels.addComment, { projectId, target, text }).then((result) => {
      if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const remove = (id: PinnedComment['id']) => {
    if (projectId === null) return;
    void bus.call(reviewChannels.removeComment, { projectId, id }).then((result) => {
      if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const fileComments = useMemo(
    () => comments.filter((comment) => comment.target.kind === 'diff-line' && comment.target.path === path),
    [comments, path],
  );

  const renderBelow = (row: DiffRow) => {
    const target = targetOf(row, path);
    const pinned = fileComments.filter((comment) => sameLine(comment.target, target));
    const open = composing !== null && sameLine(composing, target);
    if (pinned.length === 0 && !open) return null;
    return (
      <>
        {pinned.map((comment) => (
          <div key={comment.id} className={styles.comment}>
            <span className={styles.commentText}>{comment.text}</span>
            <Button size="small" variant="ghost" onPress={() => remove(comment.id)}>
              Remove
            </Button>
          </div>
        ))}
        {open ? (
          <div className={styles.composer}>
            <textarea
              className={styles.field}
              aria-label={`Comment on line ${target.kind === 'diff-line' ? target.line : ''}`}
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.ctrlKey) {
                  event.preventDefault();
                  save();
                } else if (event.key === 'Escape') setComposing(null);
              }}
            />
            <div className={styles.composerActions}>
              <Button size="small" onPress={save}>
                Add comment
              </Button>
              <Button size="small" variant="ghost" onPress={() => setComposing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const frame: PanelViewState =
    diff.status === 'loading'
      ? { kind: 'loading', label: `Reading ${name}` }
      : diff.status === 'error'
        ? {
            kind: 'error',
            message: `This diff could not be shown. ${diff.message}`,
            onRetry: () => setReload((count) => count + 1),
          }
        : { kind: 'ready' };

  return (
    <PanelFrame
      title={name}
      state={frame}
      actions={<Switch checked={split} onChange={setSplit} label="Side by side" />}
    >
      {diff.status === 'binary' ? <p className={styles.note}>Binary file changed.</p> : null}
      {diff.status === 'ready' ? (
        <DiffView
          before={diff.before}
          after={diff.after}
          mode={split ? 'split' : 'inline'}
          label={`Changes in ${name}`}
          onLineAction={(row) => {
            setComposing(targetOf(row, path));
            setDraft('');
          }}
          lineActionLabel={(row) => `Comment on line ${(row.kind === 'removed' ? row.before : row.after) ?? ''}`}
          renderBelow={renderBelow}
        />
      ) : null}
    </PanelFrame>
  );
}
