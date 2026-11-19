import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { filesChannels } from '@hsos/contracts/channels/files';
import { historyChannels } from '@hsos/contracts/channels/history';
import type { Snapshot, SnapshotSource } from '@hsos/contracts/channels/history';
import type { AbsPath, SnapshotId } from '@hsos/contracts/ids';
import { Button, ConfirmDialog, DiffView, ErrorState, Icon, List, PanelFrame, Skeleton, Switch, useToast } from '@hsos/ui-kit';
import type { IconName, PanelViewState } from '@hsos/ui-kit';
import { absoluteTime, cls, relativeTime, signedBytes } from './format';
import styles from './Timeline.module.css';

/** The word and icon of each source (HIST-40). */
const SOURCE: Record<SnapshotSource, { readonly word: string; readonly icon: IconName }> = {
  baseline: { word: 'Before first change', icon: 'clock' },
  'hsos-save': { word: 'Saved in HSOS', icon: 'check' },
  external: { word: 'Changed outside HSOS', icon: 'agent' },
  restore: { word: 'Restored', icon: 'restore' },
  deleted: { word: 'Deleted', icon: 'trash' },
};

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly snapshots: readonly Snapshot[] }
  | { readonly status: 'error'; readonly message: string };

/** One side of the diff: its text, a binary file, or the reason it could not be read. */
type Text =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'binary' }
  | { readonly kind: 'error'; readonly message: string };

type DiffState =
  | { readonly status: 'loading' }
  | { readonly status: 'binary' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly before: string; readonly after: string };

export type TimelineProps = {
  readonly bus: Bus;
  readonly path: AbsPath;
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
};

async function snapshotText(bus: Bus, id: SnapshotId): Promise<Text> {
  const result = await bus.call(historyChannels.readText, { id });
  if (result.ok) return { kind: 'text', text: result.value };
  if (result.error.code === 'FILE_BINARY') return { kind: 'binary' };
  return { kind: 'error', message: result.error.message };
}

/** The version before `id` for the same file; a file with no earlier version starts empty (HIST-40). */
async function previousText(bus: Bus, id: SnapshotId): Promise<Text> {
  const previous = await bus.call(historyChannels.getPrevious, { id });
  if (!previous.ok) return { kind: 'error', message: previous.error.message };
  if (previous.value === null) return { kind: 'text', text: '' };
  return snapshotText(bus, previous.value.id);
}

async function currentText(bus: Bus, path: AbsPath): Promise<Text> {
  const result = await bus.call(filesChannels.read, { path });
  if (!result.ok) return { kind: 'error', message: result.error.message };
  return result.value.kind === 'text' ? { kind: 'text', text: result.value.text } : { kind: 'binary' };
}

function combine(before: Text, after: Text): DiffState {
  if (before.kind === 'error') return { status: 'error', message: before.message };
  if (after.kind === 'error') return { status: 'error', message: after.message };
  if (before.kind === 'binary' || after.kind === 'binary') return { status: 'binary' };
  return { status: 'ready', before: before.text, after: after.text };
}

/** The timeline of one file (dock panel `history.timeline`): versions on the left, the diff on the right (HIST-40 to HIST-43). */
export function Timeline({ bus, path, selectedId, onSelect }: TimelineProps) {
  const toast = useToast();
  const name = path.slice(path.lastIndexOf('\\') + 1);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [compare, setCompare] = useState(false);
  const [diff, setDiff] = useState<DiffState>({ status: 'loading' });
  const [confirming, setConfirming] = useState<Snapshot | null>(null);
  const listedFor = useRef<string | null>(null);
  const diffFor = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    // "Loading" shows for the first read of a file; a new snapshot or a restore refreshes the list in place.
    if (listedFor.current !== path) {
      listedFor.current = path;
      setList({ status: 'loading' });
    }
    void bus.call(historyChannels.listForFile, { path }).then((result) => {
      if (!live) return;
      setList((current) =>
        result.ok
          ? { status: 'ready', snapshots: result.value }
          : current.status === 'ready'
            ? current
            : { status: 'error', message: result.error.message },
      );
    });
    return () => {
      live = false;
    };
  }, [bus, path, reload]);

  // HIST-43: a new snapshot of this file refreshes the list.
  useEffect(
    () =>
      bus.on(historyChannels.snapshotAdded, (snapshot) => {
        if (snapshot.path === path) setReload((count) => count + 1);
      }),
    [bus, path],
  );

  const snapshots = list.status === 'ready' ? list.snapshots : [];
  const selected = snapshots.find((item) => item.id === selectedId) ?? snapshots[0] ?? null;
  const selectedKey = selected?.id ?? null;

  useEffect(() => {
    if (selectedKey === null) return undefined;
    let live = true;
    const scope = `${path}|${selectedKey}|${compare}`;
    if (diffFor.current !== scope) {
      diffFor.current = scope;
      setDiff({ status: 'loading' });
    }
    // HIST-41: "Compare with current file" sets the selected version beside the file as it is now.
    const before = compare ? snapshotText(bus, selectedKey) : previousText(bus, selectedKey);
    const after = compare ? currentText(bus, path) : snapshotText(bus, selectedKey);
    void Promise.all([before, after]).then(([previous, current]) => {
      if (live) setDiff(combine(previous, current));
    });
    return () => {
      live = false;
    };
  }, [bus, path, selectedKey, compare, reload]);

  const restore = (snapshot: Snapshot) => {
    void bus.call(historyChannels.restore, { id: snapshot.id }).then((result) => {
      if (result.ok) {
        setReload((count) => count + 1);
        // HIST-42: Undo restores the version that was current before. HSOS saved it first (HIST-20), so it is the
        // row just under the new "restore" row.
        void bus.call(historyChannels.listForFile, { path }).then((after) => {
          const newest = after.ok ? after.value[0] : undefined;
          const undo = after.ok && newest?.source === 'restore' ? after.value[1] : undefined;
          toast.show({
            message: `${name} is back at the version from ${relativeTime(snapshot.time)}.`,
            tone: 'ok',
            ...(undo === undefined
              ? {}
              : {
                  action: {
                    label: 'Undo',
                    onPress: () => {
                      void bus.call(historyChannels.restore, { id: undo.id }).then((undone) => {
                        if (undone.ok) setReload((count) => count + 1);
                        else toast.show({ message: undone.error.message, tone: 'error' });
                      });
                    },
                  },
                }),
          });
        });
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const recreate = (snapshot: Snapshot) => {
    void bus.call(historyChannels.restoreDeleted, { id: snapshot.id }).then((result) => {
      if (result.ok) {
        toast.show({ message: `${name} is back.`, tone: 'ok' });
        setReload((count) => count + 1);
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const frame: PanelViewState =
    list.status === 'loading'
      ? { kind: 'loading', label: `Reading the history of ${name}` }
      : list.status === 'error'
        ? {
            kind: 'error',
            message: `History could not be read. ${list.message}`,
            onRetry: () => setReload((count) => count + 1),
          }
        : snapshots.length === 0
          ? {
              kind: 'empty',
              title: 'No earlier versions',
              message: 'No earlier versions of this file yet. Versions appear here after the file changes.',
            }
          : { kind: 'ready' };

  const rows = snapshots.map((snapshot, index) => ({
    id: snapshot.id,
    text: SOURCE[snapshot.source].word,
    snapshot,
    older: snapshots[index + 1] ?? null,
  }));

  const diffBody =
    diff.status === 'loading' ? (
      <Skeleton rows={3} label="Loading the difference" />
    ) : diff.status === 'binary' ? (
      <p className={styles.note}>Binary file changed.</p>
    ) : diff.status === 'error' ? (
      <ErrorState message={`This diff could not be shown. ${diff.message}`} />
    ) : (
      <DiffView before={diff.before} after={diff.after} label={`Changes in ${name}`} />
    );

  return (
    <>
      <PanelFrame title={name} state={frame}>
        <div className={styles.layout}>
          <div className={styles.list}>
            <List
              rows={rows}
              rowHeight={40}
              selectedId={selected?.id ?? null}
              onSelect={onSelect}
              onActivate={onSelect}
              label="Versions of this file"
              renderRow={(row, state) => (
                <span className={cls(styles.row, state.selected && styles.selected)}>
                  <Icon name={SOURCE[row.snapshot.source].icon} size={16} />
                  <span className={styles.rowText}>
                    <span>{SOURCE[row.snapshot.source].word}</span>
                    <span className={styles.muted}>
                      {relativeTime(row.snapshot.time)}
                      {row.older === null ? '' : ` · ${signedBytes(row.snapshot.size - row.older.size)}`}
                    </span>
                  </span>
                </span>
              )}
            />
          </div>
          <div className={styles.detail}>
            {selected === null ? null : (
              <>
                <div className={styles.toolbar}>
                  <span className={styles.muted} title={absoluteTime(selected.time)}>
                    {absoluteTime(selected.time)}
                  </span>
                  <Switch checked={compare} onChange={setCompare} label="Compare with current file" />
                  {selected.source === 'deleted' ? (
                    <Button onPress={() => recreate(selected)}>Recreate file</Button>
                  ) : (
                    <Button onPress={() => setConfirming(selected)}>Restore this version</Button>
                  )}
                </div>
                <div className={styles.diff}>{diffBody}</div>
              </>
            )}
          </div>
        </div>
      </PanelFrame>
      {confirming === null ? null : (
        <ConfirmDialog
          title="Restore this version?"
          body={`${name} goes back to the version from ${absoluteTime(confirming.time)}. The current content is kept in history first.`}
          confirmLabel="Restore"
          onConfirm={() => {
            restore(confirming);
            setConfirming(null);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
