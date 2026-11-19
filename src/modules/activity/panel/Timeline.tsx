import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { activityChannels } from '@hsos/contracts/channels/activity';
import type { ActivityCause, ActivityEntry } from '@hsos/contracts/channels/activity';
import { historyChannels } from '@hsos/contracts/channels/history';
import type { CommentTarget } from '@hsos/contracts/channels/review';
import type { AbsPath, ProjectId, SnapshotId } from '@hsos/contracts/ids';
import { zClaudeSessionId, zEpochMs } from '@hsos/contracts/schemas';
import { Button, ConfirmDialog, EmptyState, ErrorState, Icon, Menu, PanelFrame, Select, Skeleton, useToast } from '@hsos/ui-kit';
import type { IconName, MenuItem, PanelViewState } from '@hsos/ui-kit';
import { clockOf, cls, countsOf, dayLabel, splitPath } from './format';
import { PinDialog } from './PinDialog';
import { useProject } from './use-project';
import styles from './Timeline.module.css';

/** Entries per page (ACT-16). */
const PAGE = 100;
/** Entries of one cause and session within this many milliseconds collapse into a group row (ACT-11). */
const GROUP_MS = 60_000;

type CauseFilter = 'all' | ActivityCause;

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly entries: readonly ActivityEntry[]; readonly more: boolean }
  | { readonly status: 'error'; readonly message: string };

type Row =
  | { readonly kind: 'entry'; readonly entry: ActivityEntry }
  | { readonly kind: 'run'; readonly key: string; readonly entries: readonly ActivityEntry[] };

type Section = { readonly label: string; readonly rows: Row[] };

/** Days, then rows: consecutive entries of one cause and session that close in time become one group row (ACT-10, ACT-11). */
export function sectionsOf(entries: readonly ActivityEntry[], now: number = Date.now()): Section[] {
  const sections: Section[] = [];
  let section: Section | null = null;
  let run: ActivityEntry[] = [];
  const flush = () => {
    const first = run[0];
    if (section !== null && first !== undefined)
      section.rows.push(
        run.length === 1 ? { kind: 'entry', entry: first } : { kind: 'run', key: first.snapshotId, entries: [...run] },
      );
    run = [];
  };
  for (const entry of entries) {
    const label = dayLabel(entry.time, now);
    if (section === null || section.label !== label) {
      flush();
      section = { label, rows: [] };
      sections.push(section);
    }
    const last = run[run.length - 1];
    if (last !== undefined && last.cause === entry.cause && last.sessionId === entry.sessionId && last.time - entry.time <= GROUP_MS)
      run.push(entry);
    else {
      flush();
      run = [entry];
    }
  }
  flush();
  return sections;
}

/** The cause's icon and word (ACT-10): the session title, cut to 24 characters, for Claude. */
function causeOf(entry: ActivityEntry): { readonly icon: IconName; readonly word: string } {
  if (entry.cause === 'owner') return { icon: 'check', word: 'You' };
  if (entry.cause === 'claude') return { icon: 'agent', word: (entry.sessionTitle ?? 'Claude').slice(0, 24) };
  return { icon: 'external', word: 'Outside' };
}

/** The sessions in a list, for the session select (ACT-12). */
function sessionOptions(
  entries: readonly ActivityEntry[],
  selected: string,
): { readonly value: string; readonly label: string }[] {
  const seen = new Map<string, string>();
  for (const entry of entries)
    if (entry.sessionId !== null && !seen.has(entry.sessionId)) seen.set(entry.sessionId, entry.sessionTitle ?? 'Untitled session');
  // The chosen session stays an option even when no loaded entry names it.
  if (selected !== 'all' && !seen.has(selected)) seen.set(selected, 'Selected session');
  return [...seen].map(([value, title]) => ({ value, label: title.slice(0, 24) }));
}

export type TimelineProps = {
  readonly bus: Bus;
  readonly openFile: (path: AbsPath) => void;
  readonly openHistory: (path: AbsPath, snapshotId: string) => void;
};

/** Activity (side view `activity.timeline`, ACT-10 to ACT-16): what changed in the project, and by whom. */
export function Timeline({ bus, openFile, openHistory }: TimelineProps) {
  const toast = useToast();
  const project = useProject(bus);
  const projectId: ProjectId | null = project?.id ?? null;
  const [causeFilter, setCauseFilter] = useState<CauseFilter>('all');
  const [sessionFilter, setSessionFilter] = useState('all');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [restoring, setRestoring] = useState<{ readonly name: string; readonly previousId: SnapshotId; readonly time: number } | null>(
    null,
  );
  const [pinning, setPinning] = useState<CommentTarget | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);
  const loadedFor = useRef<string | null>(null);
  // The sessions of the whole project, read without the filters, so the select keeps its options (ACT-12).
  const [allEntries, setAllEntries] = useState<readonly ActivityEntry[]>([]);
  const cause = causeFilter === 'all' ? null : causeFilter;
  const session = sessionFilter === 'all' ? null : zClaudeSessionId.parse(sessionFilter);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    // "Loading" shows for the first read of a project and filter; a refresh keeps the old entries on screen.
    const scope = `${projectId}|${causeFilter}|${sessionFilter}`;
    if (loadedFor.current !== scope) {
      loadedFor.current = scope;
      setState({ status: 'loading' });
    }
    void bus
      .call(activityChannels.listTimeline, { projectId, limit: PAGE, before: null, cause, sessionId: session })
      .then((result) => {
        if (!live) return;
        setState((current) =>
          result.ok
            ? { status: 'ready', entries: result.value, more: result.value.length === PAGE }
            : current.status === 'ready'
              ? current
              : { status: 'error', message: result.error.message },
        );
      });
    return () => {
      live = false;
    };
    // `cause` and `session` derive from the filters listed here.
  }, [bus, projectId, causeFilter, sessionFilter, reload]);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    void bus
      .call(activityChannels.listTimeline, { projectId, limit: 200, before: null, cause: null, sessionId: null })
      .then((result) => {
        if (live && result.ok) setAllEntries(result.value);
      });
    return () => {
      live = false;
    };
  }, [bus, projectId, reload]);

  // A different project starts with no filter.
  useEffect(() => {
    setCauseFilter('all');
    setSessionFilter('all');
    setAllEntries([]);
    setPending(0);
  }, [projectId]);

  // ACT-15: a new entry goes to the top, unless the list is scrolled away; then a chip counts it.
  useEffect(
    () =>
      bus.on(activityChannels.entryAdded, (entry) => {
        if (cause !== null && entry.cause !== cause) return;
        if (session !== null && entry.sessionId !== session) return;
        if ((list.current?.scrollTop ?? 0) > 40) setPending((count) => count + 1);
        else
          setState((current) =>
            current.status === 'ready'
              ? { ...current, entries: [entry, ...current.entries.filter((item) => item.snapshotId !== entry.snapshotId)] }
              : current,
          );
      }),
    [bus, causeFilter, sessionFilter],
  );

  // ACT-16: 100 more entries when the end of the list is reached.
  const onScroll = () => {
    const node = list.current;
    if (node === null || projectId === null || state.status !== 'ready' || !state.more || loadingMore.current) return;
    if (node.scrollHeight - node.scrollTop - node.clientHeight > 80) return;
    const last = state.entries[state.entries.length - 1];
    if (last === undefined) return;
    loadingMore.current = true;
    void bus
      // `before` is exclusive and entries can share a millisecond, so ask from one past the boundary; known ids are dropped.
      .call(activityChannels.listTimeline, { projectId, limit: PAGE, before: zEpochMs.parse(last.time + 1), cause, sessionId: session })
      .then((result) => {
        loadingMore.current = false;
        if (!result.ok) {
          toast.show({ message: result.error.message, tone: 'error' });
          return;
        }
        setState((current) => {
          if (current.status !== 'ready') return current;
          const known = new Set(current.entries.map((item) => item.snapshotId));
          const added = result.value.filter((item) => !known.has(item.snapshotId));
          return { status: 'ready', entries: [...current.entries, ...added], more: added.length > 0 && result.value.length === PAGE };
        });
      });
  };

  /** ACT-14: asks before the version before this change is written back. */
  const askRestore = (entry: ActivityEntry) => {
    void bus.call(historyChannels.getPrevious, { id: entry.snapshotId }).then((previous) => {
      if (!previous.ok) toast.show({ message: previous.error.message, tone: 'error' });
      else if (previous.value === null) toast.show({ message: 'There is no earlier version of this file.', tone: 'info' });
      else setRestoring({ name: entry.relPath, previousId: previous.value.id, time: previous.value.time });
    });
  };

  const restore = (id: SnapshotId) => {
    void bus.call(historyChannels.restore, { id }).then((result) => {
      if (result.ok) {
        toast.show({ message: 'The earlier version is back.', tone: 'ok' });
        setReload((count) => count + 1);
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const menuFor = (entry: ActivityEntry): MenuItem[] => [
    { label: 'Open file', icon: 'file', onSelect: () => openFile(entry.path) },
    { label: 'Show diff', icon: 'changes', onSelect: () => openHistory(entry.path, entry.snapshotId) },
    { label: 'Restore the version before this change', icon: 'restore', onSelect: () => askRestore(entry) },
    { label: 'Pin comment', icon: 'pin', onSelect: () => setPinning({ kind: 'file-line', path: entry.path, line: 1, quote: '' }) },
  ];

  const renderEntry = (entry: ActivityEntry, indent: boolean) => {
    const who = causeOf(entry);
    const parts = splitPath(entry.relPath);
    return (
      <Menu key={entry.snapshotId} kind="context" items={menuFor(entry)}>
        <button type="button" className={cls(styles.row, indent && styles.indent)} onClick={() => openHistory(entry.path, entry.snapshotId)}>
          <span className={styles.time}>{clockOf(entry.time)}</span>
          <span className={styles.cause}>
            <Icon name={who.icon} size={16} />
            <span>{who.word}</span>
          </span>
          <span className={styles.path}>
            <span className={styles.folder}>{parts.folder}</span>
            <span className={styles.name}>{parts.name}</span>
          </span>
          <span className={styles.counts}>{countsOf(entry.linesAdded, entry.linesRemoved)}</span>
        </button>
      </Menu>
    );
  };

  // The project decides the frame; loading, empty and error of the list show inside, under the filters (P-40).
  const frame: PanelViewState =
    project === undefined
      ? { kind: 'loading' }
      : project === null
        ? { kind: 'empty', title: 'No project open', message: 'Open a project to see its activity.' }
        : { kind: 'ready' };

  const entries = state.status === 'ready' ? state.entries : [];
  const sections = sectionsOf(entries);
  const sessions = sessionOptions([...entries, ...allEntries], sessionFilter);

  return (
    <>
      <PanelFrame title="Activity" state={frame}>
        <div className={styles.column}>
          <div className={styles.filters}>
            <Select
              value={causeFilter}
              label="Cause"
              onChange={setCauseFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'owner', label: 'You' },
                { value: 'claude', label: 'Claude' },
                { value: 'outside', label: 'Outside' },
              ]}
            />
            {sessions.length === 0 ? null : (
              <Select
                value={sessionFilter}
                label="Session"
                onChange={setSessionFilter}
                options={[{ value: 'all', label: 'All sessions' }, ...sessions]}
              />
            )}
          </div>
          {pending === 0 ? null : (
            <Button
              size="small"
              onPress={() => {
                setPending(0);
                if (list.current !== null) list.current.scrollTop = 0;
                setReload((count) => count + 1);
              }}
            >
              {`${pending} new changes`}
            </Button>
          )}
          {state.status === 'loading' ? <Skeleton rows={4} label="Reading activity" /> : null}
          {state.status === 'error' ? (
            <ErrorState message={`Activity could not be read. ${state.message}`} onRetry={() => setReload((count) => count + 1)} />
          ) : null}
          {state.status === 'ready' && entries.length === 0 ? (
            <EmptyState
              message={
                causeFilter === 'all' && sessionFilter === 'all'
                  ? 'No changes recorded yet. Changes to files in this project appear here.'
                  : 'No change matches these filters.'
              }
            />
          ) : null}
          <div ref={list} className={styles.list} onScroll={onScroll} aria-label="Activity">
            {sections.map((section) => (
              <section key={section.label} className={styles.section}>
                <h3 className={styles.day}>{section.label}</h3>
                {section.rows.map((row) => {
                  if (row.kind === 'entry') return renderEntry(row.entry, false);
                  const isOpen = expanded.has(row.key);
                  const first = row.entries[0];
                  return (
                    <div key={row.key} className={styles.group}>
                      <button
                        type="button"
                        className={styles.groupRow}
                        aria-expanded={isOpen}
                        onClick={() => {
                          const next = new Set(expanded);
                          if (isOpen) next.delete(row.key);
                          else next.add(row.key);
                          setExpanded(next);
                        }}
                      >
                        {`${first === undefined ? '' : causeOf(first).word} · ${row.entries.length} files`}
                      </button>
                      {isOpen ? row.entries.map((entry) => renderEntry(entry, true)) : null}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        </div>
      </PanelFrame>
      {restoring === null ? null : (
        <ConfirmDialog
          title="Restore the version before this change?"
          body={`${restoring.name} goes back to the version from ${new Date(restoring.time).toLocaleString()}. The current content is kept in history first.`}
          confirmLabel="Restore"
          onConfirm={() => {
            restore(restoring.previousId);
            setRestoring(null);
          }}
          onCancel={() => setRestoring(null)}
        />
      )}
      {pinning === null || projectId === null ? null : (
        <PinDialog bus={bus} projectId={projectId} target={pinning} onClose={() => setPinning(null)} />
      )}
    </>
  );
}
