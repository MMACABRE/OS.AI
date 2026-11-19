import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { SessionListItem, TranscriptItem } from '@hsos/contracts/channels/sessions';
import { Button, PanelFrame, usePageVisible, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { loadSessions, resumeAndOpen, titleOf } from './actions';
import type { OpenTerminal } from './actions';
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

const lastIndex = (items: readonly TranscriptItem[]): number => items[items.length - 1]?.index ?? -1;

/**
 * The newest items after `known`, with nothing missing between: when more than a page arrived since the last
 * check, older pages are read until the new items join the old ones (SESS-50).
 */
async function withoutGap(
  bus: Bus,
  sessionId: SessionListItem['sessionId'],
  tail: readonly TranscriptItem[],
  known: number,
): Promise<readonly TranscriptItem[]> {
  let items = tail;
  for (let round = 0; round < 100; round += 1) {
    const first = items[0];
    if (first === undefined || first.index <= known + 1) break;
    const older = await bus.call(sessionsChannels.readTranscript, { sessionId, beforeIndex: first.index, limit: PAGE });
    if (!older.ok || older.value.items.length === 0) break;
    items = [...older.value.items, ...items];
  }
  return items.filter((item) => item.index > known);
}

export type SessionReaderProps = {
  readonly bus: Bus;
  readonly session: ReaderSession;
  readonly openTerminal: OpenTerminal;
};

/** The transcript reader (dock panel `sessions.transcript`, SESS-50, SESS-51). Text is data: rendered as plain text (P-6). */
export function SessionReader({ bus, session, openTerminal }: SessionReaderProps) {
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
  // The scroll height before older items are put on top, so the view can stay where it was.
  const anchor = useRef<number | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  /** Takes the title, note and live terminal from the session list again. */
  const refreshMeta = useCallback(() => {
    void loadSessions(bus, projectRef.current ?? null, true).then((result) => {
      const updated = result.ok ? result.value.find((item) => item.sessionId === sessionId) : undefined;
      if (updated !== undefined)
        setMeta((current) => ({
          ...current,
          title: updated.title,
          note: updated.note,
          liveTerminalId: updated.liveTerminalId,
        }));
    });
  }, [bus, sessionId]);

  // SESS-32, SESS-43: Resume follows the session's live state, so it hides while a shell runs it.
  useEffect(() => {
    const offs = [
      bus.on(sessionsChannels.recordChanged, (record) => {
        if (record.sessionId === sessionId) refreshMeta();
      }),
      bus.on(terminalChannels.created, refreshMeta),
      bus.on(terminalChannels.exited, refreshMeta),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [bus, sessionId, refreshMeta]);

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
        const total = result.value.total;
        void withoutGap(bus, sessionId, result.value.items, current.items[current.items.length - 1]?.index ?? -1).then(
          (fresh) => {
            setState((previous) =>
              previous.status === 'ready'
                ? {
                    status: 'ready',
                    items: [...previous.items.filter((item) => item.index <= lastIndex(current.items)), ...fresh],
                    total,
                  }
                : previous,
            );
          },
        );
      });
    }, GROWTH_MS);
    return () => window.clearInterval(timer);
  }, [bus, sessionId, visible]);

  // Older items put on top keep the view where it was.
  useLayoutEffect(() => {
    if (anchor.current === null || scroll.current === null) return;
    scroll.current.scrollTop += scroll.current.scrollHeight - anchor.current;
    anchor.current = null;
  }, [state]);

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
      anchor.current = scroll.current?.scrollHeight ?? null;
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, items: [...result.value.items, ...previous.items] } : previous,
      );
    });
  };

  const resume = () => {
    void resumeAndOpen(bus, project, meta, openTerminal).then((failure) => {
      if (failure === null) toast.show({ message: `Resumed "${titleOf(meta)}" in a new terminal.`, tone: 'ok' });
      else toast.show({ message: failure, tone: 'error' });
    });
  };

  /** Rename and note change the header: the list is read again to take the new values. */
  const changed = refreshMeta;

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
