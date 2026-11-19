import { useEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem, TranscriptItem } from '@hsos/contracts/channels/sessions';
import { Button, PanelFrame, usePageVisible, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { loadSessions, resumeInNewTerminal, titleOf } from './actions';
import { cls } from './format';
import { SessionDialogs } from './SessionDialogs';
import type { SessionDialog } from './SessionDialogs';
import { useProject } from './use-project';
import styles from './SessionReader.module.css';

/** Items read per request (SESS-50). */
const PAGE = 200;
/** How often a visible reader checks for growth (SESS-50). */
const GROWTH_MS = 2_000;

/** The session fields the reader keeps from its panel state (SESS-50). */
export type ReaderSession = Pick<SessionListItem, 'sessionId' | 'title' | 'cwd' | 'hasOriginal' | 'liveTerminalId' | 'note'>;

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly TranscriptItem[]; readonly total: number }
  | { readonly status: 'error'; readonly message: string };

export type SessionReaderProps = {
  readonly bus: Bus;
  readonly session: ReaderSession;
};

/** The transcript reader (dock panel `sessions.transcript`, SESS-50, SESS-51). Text is data: rendered as plain text (P-6). */
export function SessionReader({ bus, session }: SessionReaderProps) {
  const project = useProject(bus);
  const toast = useToast();
  const visible = usePageVisible();
  const [meta, setMeta] = useState<ReaderSession>(session);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<SessionDialog | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const scroll = useRef<HTMLDivElement>(null);
  const sessionId = meta.sessionId;

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    void bus.call(sessionsChannels.readTranscript, { sessionId, beforeIndex: null, limit: PAGE }).then((result) => {
      if (!live) return;
      setState(
        result.ok
          ? { status: 'ready', items: result.value.items, total: result.value.total }
          : { status: 'error', message: result.error.message },
      );
    });
    return () => {
      live = false;
    };
  }, [bus, sessionId, reload]);

  // SESS-50: while visible, new items are appended as they arrive.
  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setInterval(() => {
      const current = latest.current;
      if (current.status !== 'ready') return;
      void bus.call(sessionsChannels.readTranscript, { sessionId, beforeIndex: null, limit: PAGE }).then((result) => {
        if (!result.ok || result.value.total <= current.total) return;
        const tail = result.value.items;
        const first = tail[0]?.index ?? 0;
        setState((previous) =>
          previous.status === 'ready'
            ? {
                status: 'ready',
                items: [...previous.items.filter((item) => item.index < first), ...tail],
                total: result.value.total,
              }
            : previous,
        );
      });
    }, GROWTH_MS);
    return () => window.clearInterval(timer);
  }, [bus, sessionId, visible]);

  // A fresh transcript opens at its end.
  useEffect(() => {
    if (state.status === 'ready' && scroll.current !== null) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [state.status]);

  const showEarlier = () => {
    if (state.status !== 'ready') return;
    const oldest = state.items[0];
    if (oldest === undefined) return;
    void bus.call(sessionsChannels.readTranscript, { sessionId, beforeIndex: oldest.index, limit: PAGE }).then((result) => {
      if (!result.ok) {
        toast.show({ message: result.error.message, tone: 'error' });
        return;
      }
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, items: [...result.value.items, ...previous.items] } : previous,
      );
    });
  };

  const resume = () => {
    if (project === undefined || project === null) return;
    void resumeInNewTerminal(bus, project, meta).then((result) => {
      if (result.ok) toast.show({ message: `Resumed "${titleOf(meta)}" in a new terminal.`, tone: 'ok' });
      else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  /** Rename and note change the header: the list is read again to take the new values. */
  const changed = () => {
    void loadSessions(bus, project ?? null, true).then((result) => {
      const updated = result.ok ? result.value.find((item) => item.sessionId === sessionId) : undefined;
      if (updated !== undefined) setMeta({ ...meta, title: updated.title, note: updated.note });
    });
  };

  const frame: PanelViewState =
    state.status === 'loading'
      ? { kind: 'loading', label: 'Reading the transcript' }
      : state.status === 'error'
        ? {
            kind: 'error',
            message: `The transcript could not be read. ${state.message}`,
            onRetry: () => setReload((count) => count + 1),
          }
        : state.total === 0
          ? { kind: 'empty', message: 'This session has no messages yet.' }
          : { kind: 'ready' };

  const items = state.status === 'ready' ? state.items : [];
  const hasEarlier = items.length > 0 && (items[0]?.index ?? 0) > 0;

  return (
    <>
      <PanelFrame
        title={titleOf(meta)}
        state={frame}
        actions={
          <>
            {meta.liveTerminalId === null ? (
              <Button size="small" variant="primary" onPress={resume}>
                Resume
              </Button>
            ) : null}
            <Button size="small" variant="ghost" onPress={() => setDialog({ kind: 'rename', item: meta })}>
              Rename
            </Button>
            <Button size="small" variant="ghost" onPress={() => setDialog({ kind: 'note', item: meta })}>
              Edit note
            </Button>
          </>
        }
      >
        <div ref={scroll} className={styles.scroll}>
          {hasEarlier ? (
            <div className={styles.earlier}>
              <Button size="small" variant="ghost" onPress={showEarlier}>
                Show earlier
              </Button>
            </div>
          ) : null}
          {items.map((item) =>
            item.role === 'tool' ? (
              <p key={item.index} className={styles.tool}>
                {item.text}
              </p>
            ) : (
              <section
                key={item.index}
                className={cls(styles.item, item.role === 'user' && styles.user)}
                aria-label={item.role === 'user' ? 'You' : 'Claude'}
              >
                <span className={styles.who}>{item.role === 'user' ? 'You' : 'Claude'}</span>
                <p className={styles.text}>{item.text}</p>
              </section>
            ),
          )}
        </div>
      </PanelFrame>
      <SessionDialogs
        bus={bus}
        dialog={dialog}
        onClose={() => setDialog(null)}
        onChanged={changed}
      />
    </>
  );
}
