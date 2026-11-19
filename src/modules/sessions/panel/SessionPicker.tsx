import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { Badge, Button, Dialog, EmptyState, ErrorState, List, Skeleton, TextField, useToast } from '@hsos/ui-kit';
import type { Tone } from '@hsos/ui-kit';
import { copyResumeCommand, loadSessions, matchesSearch, resumeAndOpen, titleOf } from './actions';
import type { OpenTerminal } from './actions';
import { cls, relativeTime } from './format';
import { useProject } from './use-project';
import styles from './SessionPicker.module.css';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly SessionListItem[] }
  | { readonly status: 'error'; readonly message: string };

/** The state chip of a row: its word and the tone that carries it (SESS-31). */
export const STATE_CHIP: Record<SessionListItem['state'], { readonly text: string; readonly tone: Tone | 'neutral' }> = {
  running: { text: 'Running', tone: 'ok' },
  interrupted: { text: 'Interrupted', tone: 'warn' },
  ended: { text: 'Ended', tone: 'neutral' },
  untracked: { text: 'Untracked', tone: 'neutral' },
};

export type SessionPickerProps = {
  readonly bus: Bus;
  readonly onClose: () => void;
  readonly openTranscript: (item: SessionListItem) => void;
  readonly openTerminal: OpenTerminal;
};

/** Find Claude Session (command `sessions.find`, SESS-31, SESS-32): a dialog over the open project's sessions. */
export function SessionPicker({ bus, onClose, openTranscript, openTerminal }: SessionPickerProps) {
  const project = useProject(bus);
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (project === undefined || project === null) return undefined;
    let live = true;
    setState({ status: 'loading' });
    void loadSessions(bus, project, false).then((result) => {
      if (!live) return;
      setState(result.ok ? { status: 'ready', items: result.value } : { status: 'error', message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [bus, project, reload]);

  const items = state.status === 'ready' ? state.items : [];
  const filtered = items.filter((item) => matchesSearch(titleOf(item), query));
  const selected = filtered.find((item) => item.sessionId === selectedId) ?? filtered[0] ?? null;
  const rows = filtered.map((item) => ({ id: item.sessionId, text: titleOf(item), item }));

  const resume = (item: SessionListItem) => {
    void resumeAndOpen(bus, project, item, openTerminal).then((failure) => {
      if (failure !== null) {
        toast.show({ message: failure, tone: 'error' });
        return;
      }
      // The toast provider outlives the dialog (register.ui.ts), so this toast stays after the close.
      toast.show({ message: `Resumed "${titleOf(item)}" in a new terminal.`, tone: 'ok' });
      onClose();
    });
  };

  const copy = (item: SessionListItem) => {
    void copyResumeCommand(bus, item).then((result) => {
      if (result.ok) toast.show({ message: 'Copied the resume command.', tone: 'ok' });
      else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const firstAction = (item: SessionListItem) => {
    if (item.liveTerminalId === null) resume(item);
  };

  const body = (() => {
    if (project === null) return <EmptyState message="Open a project to find its sessions." />;
    if (state.status === 'loading') return <Skeleton rows={4} label="Loading sessions" />;
    if (state.status === 'error')
      return (
        <ErrorState
          message={`Sessions could not be read. ${state.message}`}
          onRetry={() => setReload((count) => count + 1)}
        />
      );
    if (items.length === 0) return <EmptyState message="No Claude sessions in this project yet." />;
    if (filtered.length === 0) return <EmptyState message="No session matches." />;
    return (
      <List
        rows={rows}
        rowHeight={44}
        selectedId={selected?.sessionId ?? null}
        onSelect={setSelectedId}
        onActivate={(id) => {
          const item = filtered.find((candidate) => candidate.sessionId === id);
          if (item !== undefined) firstAction(item);
        }}
        label="Claude sessions"
        renderRow={(row, rowState) => (
          <span className={cls(styles.row, rowState.selected && styles.selected)}>
            <span className={styles.title}>{row.text}</span>
            <span className={styles.meta}>
              {relativeTime(row.item.lastActiveAt)} · {row.item.messages} messages
            </span>
            <Badge tone={STATE_CHIP[row.item.state].tone} text={STATE_CHIP[row.item.state].text} />
            {!row.item.hasOriginal && row.item.hasBackup ? <Badge tone="info" text="Backup only" /> : null}
          </span>
        )}
      />
    );
  })();

  return (
    <>
      <Dialog
        title="Find Claude Session"
        onClose={onClose}
        actions={
          <>
            {selected === null ? null : (
              <>
                <Button
                  variant="primary"
                  disabled={selected.liveTerminalId !== null}
                  onPress={() => firstAction(selected)}
                >
                  {selected.liveTerminalId === null ? 'Resume in new terminal' : 'Go to terminal'}
                </Button>
                <Button onPress={() => openTranscript(selected)}>Open transcript</Button>
                {selected.liveTerminalId === null ? (
                  <Button onPress={() => copy(selected)}>Copy resume command</Button>
                ) : null}
              </>
            )}
            <Button variant="ghost" onPress={onClose}>
              Close
            </Button>
          </>
        }
      >
        <div className={styles.column}>
          <TextField value={query} onChange={setQuery} placeholder="Search by title" label="Search sessions" />
          <div className={styles.body}>{body}</div>
        </div>
      </Dialog>
    </>
  );
}
