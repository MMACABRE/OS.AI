import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { PinnedComment, ReviewBase, ReviewFile } from '@hsos/contracts/channels/review';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import type { AbsPath, ProjectId } from '@hsos/contracts/ids';
import { zClaudeSessionId } from '@hsos/contracts/schemas';
import { Button, List, Menu, PanelFrame, Select, TextField, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { CHANGE, absoluteFrom, baseKey, cls, countsOf } from './helpers';
import { gitMessage, loadSessions } from './data';
import { FeedbackTray } from './FeedbackTray';
import { useRepo } from './use-repo';
import styles from './ChangesView.module.css';

type ChangesState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly files: readonly ReviewFile[] }
  | { readonly status: 'error'; readonly message: string };

export type ChangesViewProps = {
  readonly bus: Bus;
  readonly openFile: (path: AbsPath) => void;
  readonly openDiff: (path: AbsPath, base: ReviewBase) => void;
  readonly openHistory: (path: AbsPath) => void;
};

/** The Changes side view (`review.changes`, REV-10 to REV-15): the changed files, a commit box and the feedback tray. */
export function ChangesView({ bus, openFile, openDiff, openHistory }: ChangesViewProps) {
  const toast = useToast();
  const { project, status } = useRepo(bus);
  const projectId: ProjectId | null = project?.id ?? null;
  const root = project?.path ?? null;
  const [base, setBase] = useState<ReviewBase>({ kind: 'last-commit' });
  const [sessions, setSessions] = useState<readonly SessionListItem[]>([]);
  const [changes, setChanges] = useState<ChangesState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [comments, setComments] = useState<readonly PinnedComment[]>([]);
  const messageTouched = useRef(false);
  const key = baseKey(base);
  const repoRoot = status?.kind === 'repo' ? status.root : null;

  // The sessions of the project, for the base select and the feedback target (REV-10, REV-33).
  useEffect(() => {
    if (project === undefined || project === null) return undefined;
    let live = true;
    void loadSessions(bus, project).then((result) => {
      if (live && result.ok) setSessions(result.value);
    });
    return () => {
      live = false;
    };
  }, [bus, project]);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    setChanges({ status: 'loading' });
    void bus.call(reviewChannels.listChanges, { projectId, base }).then((result) => {
      if (!live) return;
      setChanges(result.ok ? { status: 'ready', files: result.value } : { status: 'error', message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [bus, projectId, key, reload]);

  // REV-12: the list refreshes when the set of changed files may have changed (REV-5).
  useEffect(() => {
    if (projectId === null) return undefined;
    const off = bus.on(reviewChannels.changesInvalidated, (payload) => {
      if (payload.projectId === projectId) setReload((count) => count + 1);
    });
    return off;
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

  // REV-14: the message starts as a suggestion for the listed files, until the owner types.
  const fileCount = changes.status === 'ready' ? changes.files.length : 0;
  useEffect(() => {
    if (repoRoot === null || base.kind !== 'last-commit' || fileCount === 0) return undefined;
    let live = true;
    void bus.call(gitChannels.suggestMessage, { root: repoRoot }).then((result) => {
      if (live && result.ok && !messageTouched.current) setMessage(result.value);
    });
    return () => {
      live = false;
    };
  }, [bus, repoRoot, key, fileCount]);

  const commit = (andSync: boolean) => {
    if (repoRoot === null || changes.status !== 'ready') return;
    const paths = changes.files.map((file) => file.relPath);
    const text = message.trim();
    void bus.call(gitChannels.commit, { root: repoRoot, message: text, paths }).then((result) => {
      if (!result.ok) {
        const shown = gitMessage(result.error);
        if (shown !== null) toast.show({ message: shown, tone: 'error' });
        return;
      }
      toast.show({ message: `Committed ${paths.length} file${paths.length === 1 ? '' : 's'}.`, tone: 'ok' });
      messageTouched.current = false;
      setMessage('');
      setReload((count) => count + 1);
      if (!andSync) return;
      void bus.call(gitChannels.sync, { root: repoRoot }).then((synced) => {
        if (synced.ok) toast.show({ message: 'Synced with GitHub.', tone: 'ok' });
        else {
          const shown = gitMessage(synced.error);
          if (shown !== null) toast.show({ message: shown, tone: 'error' });
        }
      });
    });
  };

  const operationIdle = status?.kind === 'repo' && status.operation === 'none';
  const canCommit = operationIdle && fileCount > 0 && message.trim() !== '';

  const baseOptions = [
    { value: 'last-commit', label: 'Since last commit' },
    ...sessions.map((item) => ({
      value: `session:${item.sessionId}`,
      label: `Session: ${item.title.trim() === '' ? 'Untitled session' : item.title}`,
    })),
  ];
  const chooseBase = (value: string) => {
    setSelected(null);
    setBase(
      value.startsWith('session:')
        ? { kind: 'session-start', sessionId: zClaudeSessionId.parse(value.slice('session:'.length)) }
        : { kind: 'last-commit' },
    );
  };

  const files = changes.status === 'ready' ? changes.files : [];
  const added = files.reduce((sum, file) => sum + (file.linesAdded ?? 0), 0);
  const removed = files.reduce((sum, file) => sum + (file.linesRemoved ?? 0), 0);
  const selectedFile = files.find((file) => file.relPath === selected) ?? null;
  const selectedPath = selectedFile === null || root === null ? null : absoluteFrom(root, selectedFile.relPath);

  const menuItems = [
    {
      label: 'Open File',
      icon: 'file' as const,
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath !== null) openFile(selectedPath);
      },
    },
    {
      label: 'Open Diff',
      icon: 'changes' as const,
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath !== null) openDiff(selectedPath, base);
      },
    },
    { separator: true as const },
    {
      label: 'Show History',
      icon: 'history' as const,
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath !== null) openHistory(selectedPath);
      },
    },
  ];

  const frame: PanelViewState =
    project === undefined
      ? { kind: 'loading', label: 'Reading changes' }
      : project === null
        ? { kind: 'empty', title: 'No project open', message: 'Open a project to see its changes.' }
        : changes.status === 'loading'
          ? { kind: 'loading', label: 'Reading changes' }
          : changes.status === 'error'
          ? {
              kind: 'error',
              message: `Changes could not be read. ${changes.message}`,
              onRetry: () => setReload((count) => count + 1),
            }
          : files.length === 0
            ? {
                kind: 'empty',
                message:
                  base.kind === 'last-commit'
                    ? status?.kind === 'not-a-repo'
                      ? 'This folder is not a git repository. Choose a Claude session to see its changes.'
                      : 'No changes since the last commit.'
                    : 'This session has not changed any files.',
              }
            : { kind: 'ready' };

  return (
    <PanelFrame title="Changes" state={frame}>
      <div className={styles.column}>
        <Select value={key} options={baseOptions} onChange={chooseBase} label="Changes since" />
        <p className={styles.summary}>
          {`${files.length} file${files.length === 1 ? '' : 's'} · +${added} −${removed}`}
        </p>
        <Menu kind="context" items={menuItems}>
          <div className={styles.list}>
            <List
              rows={files.map((file) => ({ id: file.relPath, text: file.relPath, file }))}
              rowHeight={26}
              selectedId={selected}
              onSelect={setSelected}
              onActivate={(id) => {
                if (root !== null) openFile(absoluteFrom(root, id));
              }}
              label="Changed files"
              renderRow={(row, rowState) => {
                const slash = row.file.relPath.lastIndexOf('/');
                return (
                  <span className={cls(styles.row, rowState.selected && styles.selected)}>
                    <span className={styles.letter} aria-label={CHANGE[row.file.change].word}>
                      {CHANGE[row.file.change].letter}
                    </span>
                    <span className={styles.path}>
                      {slash < 0 ? null : <span className={styles.folder}>{row.file.relPath.slice(0, slash + 1)}</span>}
                      <span className={styles.name}>{row.file.relPath.slice(slash + 1)}</span>
                    </span>
                    <span className={styles.counts}>{countsOf(row.file)}</span>
                  </span>
                );
              }}
            />
          </div>
        </Menu>
        {base.kind === 'last-commit' && status?.kind === 'repo' ? (
          <div className={styles.commit}>
            <TextField
              value={message}
              onChange={(value) => {
                messageTouched.current = true;
                setMessage(value);
              }}
              placeholder="Commit message"
              label="Commit message"
            />
            <div className={styles.buttons}>
              <Button size="small" disabled={!canCommit} onPress={() => commit(false)}>
                Commit
              </Button>
              <Button size="small" variant="ghost" disabled={!canCommit} onPress={() => commit(true)}>
                Commit and Sync
              </Button>
            </div>
          </div>
        ) : null}
        {projectId === null || root === null ? null : (
          <FeedbackTray bus={bus} projectId={projectId} root={root} comments={comments} sessions={sessions} />
        )}
      </div>
    </PanelFrame>
  );
}
