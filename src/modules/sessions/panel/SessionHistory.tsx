import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { Badge, Button, EmptyState, Icon, IconButton, Menu, PanelFrame, Select, TextField, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { copyResumeCommand, loadSessions, matchesSearch, newestFirst, resumeAndOpen, rowMenu, titleOf } from './actions';
import type { OpenTerminal } from './actions';
import { cls, firstLine, folderName, relativeTime } from './format';
import { SessionDialogs } from './SessionDialogs';
import type { SessionDialog } from './SessionDialogs';
import { STATE_CHIP } from './SessionPicker';
import { useProject } from './use-project';
import styles from './SessionHistory.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly SessionListItem[] }
  | { readonly status: 'error'; readonly message: string };

type StateFilter = 'all' | SessionListItem['state'];

const STATE_OPTIONS: readonly { readonly value: StateFilter; readonly label: string }[] = [
  { value: 'all', label: 'All states' },
  { value: 'running', label: 'Running' },
  { value: 'interrupted', label: 'Interrupted' },
  { value: 'ended', label: 'Ended' },
  { value: 'untracked', label: 'Untracked' },
];

export type SessionHistoryProps = {
  readonly bus: Bus;
  readonly openTranscript: (item: SessionListItem) => void;
  readonly openTerminal: OpenTerminal;
};

/** Session History (dock panel `sessions.history`, SESS-70 to SESS-77): every project's sessions in one list. */
export function SessionHistory({ bus, openTranscript, openTerminal }: SessionHistoryProps) {
  const project = useProject(bus);
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [dialog, setDialog] = useState<SessionDialog | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const projectId = project?.id ?? null;

  // SESS-71: a different project starts again from the default filter.
  useEffect(() => {
    setProjectFilter(null);
    setSelected(new Set());
    setAnchor(null);
  }, [projectId]);

  // SESS-70: the list reads again when a record or a transcript changes, debounced 500 ms.
  useEffect(() => {
    let timer: number | undefined;
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setReload((count) => count + 1), 500);
    };
    const offRecord = bus.on(sessionsChannels.recordChanged, bump);
    const offRemoved = bus.on(sessionsChannels.removed, bump);
    return () => {
      window.clearTimeout(timer);
      offRecord();
      offRemoved();
    };
  }, [bus]);

  useEffect(() => {
    if (project === undefined) return undefined;
    let live = true;
    setState({ status: 'loading' });
    void loadSessions(bus, project, true).then((result) => {
      if (!live) return;
      setState(result.ok ? { status: 'ready', items: result.value } : { status: 'error', message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [bus, project, reload]);

  const resume = (item: SessionListItem) => {
    void resumeAndOpen(bus, project, item, openTerminal).then((failure) => {
      if (failure === null) toast.show({ message: `Resumed "${titleOf(item)}" in a new terminal.`, tone: 'ok' });
      else toast.show({ message: failure, tone: 'error' });
    });
  };

  const copy = (item: SessionListItem) => {
    void copyResumeCommand(bus, item).then((result) => {
      if (result.ok) toast.show({ message: 'Copied the resume command.', tone: 'ok' });
      else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const items = state.status === 'ready' ? state.items : [];
  // SESS-71: the open project is the default filter, else all projects.
  const folders = useMemo(() => [...new Set(items.map((item) => item.cwd))], [items]);
  // A folder with no sessions is not an option, so the filter falls back to all projects.
  const wanted = projectFilter ?? project?.path ?? 'all';
  const projectValue = wanted === 'all' || folders.some((folder) => folder === wanted) ? wanted : 'all';
  const projectOptions = [
    { value: 'all', label: 'All projects' },
    ...folders.map((cwd) => ({ value: cwd, label: folderName(cwd) })),
  ];

  const visible = items
    .filter(
    (item) =>
      (projectValue === 'all' || item.cwd === projectValue) &&
      (stateFilter === 'all' || item.state === stateFilter) &&
      matchesSearch(`${titleOf(item)} ${item.note}`, query),
    )
    .sort(newestFirst);
  // SESS-72: grouped by folder when "All projects" is chosen; the newest activity first in each group.
  const groups =
    projectValue === 'all'
      ? folders
          .map((cwd) => ({ cwd, items: visible.filter((item) => item.cwd === cwd) }))
          .filter((group) => group.items.length > 0)
          .sort((a, b) => (b.items[0]?.lastActiveAt ?? 0) - (a.items[0]?.lastActiveAt ?? 0))
      : [{ cwd: projectValue, items: visible }];
  const ordered = groups.flatMap((group) => group.items);
  const positions = new Map(ordered.map((item, index) => [item.sessionId, index]));
  const selectedItems = ordered.filter((item) => selected.has(item.sessionId));

  const pick = (index: number, shift: boolean, additive: boolean) => {
    const item = ordered[index];
    if (item === undefined) return;
    if (shift && anchor !== null) {
      const [from, to] = [Math.min(anchor, index), Math.max(anchor, index)];
      setSelected(new Set(ordered.slice(from, to + 1).map((row) => row.sessionId)));
      return;
    }
    setAnchor(index);
    if (additive) {
      const next = new Set(selected);
      if (next.has(item.sessionId)) next.delete(item.sessionId);
      else next.add(item.sessionId);
      setSelected(next);
    } else setSelected(new Set([item.sessionId]));
  };

  const rowKey = (event: KeyboardEvent<HTMLLIElement>, item: SessionListItem, index: number) => {
    // Keys from the row's own buttons and menu belong to them.
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      body.current?.querySelector<HTMLElement>(`[data-index="${index + (event.key === 'ArrowDown' ? 1 : -1)}"]`)?.focus();
    } else if (event.key === 'Enter') openTranscript(item);
    else if (event.key === 'F2') setDialog({ kind: 'rename', item });
    else if (event.key === 'Delete') setDialog({ kind: 'delete', items: [item] });
  };

  const frame: PanelViewState =
    state.status === 'loading'
      ? { kind: 'loading', label: 'Loading sessions' }
      : state.status === 'error'
        ? {
            kind: 'error',
            message: `Sessions could not be read. ${state.message}`,
            onRetry: () => setReload((count) => count + 1),
          }
        : items.length === 0
          ? { kind: 'empty', message: 'No Claude sessions found.' }
          : { kind: 'ready' };

  const renderRow = (item: SessionListItem, index: number) => {
    const isSelected = selected.has(item.sessionId);
    const chip = STATE_CHIP[item.state];
    const title = titleOf(item);
    return (
      <li
        key={item.sessionId}
        role="option"
        className={cls(styles.row, isSelected && styles.selected)}
        tabIndex={0}
        data-index={index}
        aria-selected={isSelected}
        onClick={(event) => pick(index, event.shiftKey, false)}
        onDoubleClick={() => openTranscript(item)}
        onKeyDown={(event) => rowKey(event, item, index)}
      >
        <input
          type="checkbox"
          className={styles.check}
          checked={isSelected}
          aria-label={`Select ${title}`}
          tabIndex={-1}
          onChange={() => undefined}
          onClick={(event) => {
            event.stopPropagation();
            pick(index, event.shiftKey, true);
          }}
        />
        <span className={styles.main}>
          <span className={styles.title}>{title}</span>
          {firstLine(item.note) === '' ? null : <span className={styles.note}>{firstLine(item.note)}</span>}
        </span>
        <span className={styles.meta}>
          {relativeTime(item.lastActiveAt)} · {item.messages} messages
        </span>
        <Badge tone={chip.tone} text={chip.text} />
        {!item.hasOriginal && item.hasBackup ? <Badge tone="info" text="Backup only" /> : null}
        <Menu items={rowMenu(item, {
          resume,
          copy,
          transcript: openTranscript,
          rename: (target) => setDialog({ kind: 'rename', item: target }),
          note: (target) => setDialog({ kind: 'note', item: target }),
          remove: (target) => setDialog({ kind: 'delete', items: [target] }),
        })}>
          <button type="button" className={styles.more} aria-label={`Actions for ${title}`}>
            <Icon name="more" size={16} />
          </button>
        </Menu>
      </li>
    );
  };

  return (
    <>
      <PanelFrame title="Session History" state={frame}>
        <div
          ref={body}
          className={styles.body}
          onKeyDown={(event) => {
            // Ctrl+A in the search field selects its text, not the rows.
            if (event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') return;
            if (event.target instanceof HTMLTextAreaElement) return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
              event.preventDefault();
              setSelected(new Set(ordered.map((item) => item.sessionId)));
            }
          }}
        >
          <div className={styles.toolbar}>
            <Select
              value={projectValue}
              options={projectOptions}
              onChange={setProjectFilter}
              label="Project"
            />
            <Select value={stateFilter} options={STATE_OPTIONS} onChange={setStateFilter} label="State" />
            <div className={styles.search}>
              <TextField value={query} onChange={setQuery} placeholder="Search titles and notes" label="Search sessions" />
            </div>
            <IconButton icon={<Icon name="refresh" />} label="Refresh" onPress={() => setReload((count) => count + 1)} />
            {selectedItems.length === 0 ? null : (
              <Button
                variant="danger"
                onPress={() => setDialog({ kind: 'delete', items: selectedItems })}
              >
                {`Delete ${selectedItems.length}`}
              </Button>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState message="No session matches." />
          ) : (
            <div className={styles.scroll}>
              {groups.map((group) => (
                <section key={group.cwd} className={styles.group} aria-label={folderName(group.cwd)}>
                  {projectValue === 'all' ? (
                    <h3 className={styles.groupTitle} title={group.cwd}>
                      {folderName(group.cwd)}
                    </h3>
                  ) : null}
                  <ul className={styles.list} aria-label="Sessions" role="listbox" aria-multiselectable="true">
                    {group.items.map((item) => renderRow(item, positions.get(item.sessionId) ?? 0))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </PanelFrame>
      <SessionDialogs
        bus={bus}
        dialog={dialog}
        onClose={() => setDialog(null)}
        onChanged={() => {
          setSelected(new Set());
          setReload((count) => count + 1);
        }}
      />
    </>
  );
}
