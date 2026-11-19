import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import type { Bus } from '@hsos/contracts/bus';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { TerminalSettings } from '@hsos/contracts/channels/terminal';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { AbsPath, TerminalId } from '@hsos/contracts/ids';
import type { Logger, PanelProps } from '@hsos/contracts/module';
import { zAbsPath, zTerminalId } from '@hsos/contracts/schemas';
import { Button, ErrorState, usePageVisible } from '@hsos/ui-kit';
import { createXterm } from './create-xterm';
import type { XtermView } from './create-xterm';
import { HeaderSlot } from './header-slot';
import styles from './TerminalPanel.module.css';

export const TerminalPanelState = z.object({
  terminalId: zTerminalId.nullable(),
  cwd: zAbsPath.or(z.literal('')),
  worktree: z.string().nullable(),
  launch: z.string().nullable(),
  fontSizeDelta: z.number().int(),
});
export type TerminalPanelState = z.infer<typeof TerminalPanelState>;

export const INITIAL_TERMINAL_STATE: TerminalPanelState = {
  terminalId: null,
  cwd: '',
  worktree: null,
  launch: null,
  fontSizeDelta: 0,
};

/** TERM-30: an `ack` each time this many more bytes are drawn. */
export const ACK_BYTES = 100_000;
/** TERM-53: fitting waits this long after the last size change. */
export const FIT_DEBOUNCE_MS = 50;
/** The loading line shows after this wait (visual-direction.md "Panel states"). */
export const LOADING_DELAY_MS = 150;

export type TerminalPanelDeps = {
  readonly bus: Bus;
  readonly log: Logger;
  readonly settings: () => TerminalSettings;
  readonly openSettings: () => void;
};

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'exited'; code: number }
  | { kind: 'error'; message: string };

/**
 * The terminal panel (`terminal.shell`): a see-through xterm (TERM-76) under the header slot (TERM-75),
 * attached to a shell in pty-host with replay (TERM-21, TERM-23), flow control (TERM-30) and fitting
 * (TERM-53, TERM-54). Its text never animates (MOT-10).
 */
export function createTerminalPanel(deps: TerminalPanelDeps) {
  return function TerminalPanel({ state, setState, isFocused }: PanelProps<TerminalPanelState>) {
    const { bus, log } = deps;
    const screen = useRef<HTMLDivElement>(null);
    const view = useRef<XtermView | null>(null);
    const idRef = useRef<TerminalId | null>(state.terminalId);
    const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
    const [showLoading, setShowLoading] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [terminalId, setTerminalId] = useState<TerminalId | null>(state.terminalId);
    const visible = usePageVisible();

    const fitNow = useCallback(() => {
      const current = view.current;
      const id = idRef.current;
      if (current === null || screen.current === null || screen.current.clientWidth === 0) return;
      current.fit.fit();
      if (id !== null)
        void bus.call(terminalChannels.resize, { id, cols: current.terminal.cols, rows: current.terminal.rows });
    }, [bus]);

    const scheduleFit = useCallback(() => {
      if (fitTimer.current !== null) clearTimeout(fitTimer.current);
      fitTimer.current = setTimeout(fitNow, FIT_DEBOUNCE_MS);
    }, [fitNow]);

    useEffect(() => {
      const element = screen.current;
      if (element === null) return undefined;
      setPhase({ kind: 'loading' });
      setShowLoading(false);
      const loadingTimer = setTimeout(() => setShowLoading(true), LOADING_DELAY_MS);
      const xterm = createXterm(element, deps.settings(), log);
      view.current = xterm;
      let lastSeq = 0;
      let undrawnAck = 0;
      let alive = true;

      const offData = bus.on(terminalChannels.data, (chunk) => {
        if (chunk.id !== idRef.current || chunk.seq <= lastSeq) return;
        lastSeq = chunk.seq;
        xterm.terminal.write(chunk.data, () => {
          undrawnAck += chunk.data.byteLength;
          const id = idRef.current;
          if (undrawnAck >= ACK_BYTES && id !== null) {
            void bus.call(terminalChannels.ack, { id, bytes: undrawnAck });
            undrawnAck = 0;
          }
        });
      });
      const offExit = bus.on(terminalChannels.exited, (exit) => {
        if (exit.id !== idRef.current) return;
        xterm.terminal.write(`\r\n[process exited with code ${exit.exitCode}]\r\n`);
        setPhase({ kind: 'exited', code: exit.exitCode });
      });
      const input = xterm.terminal.onData((data) => {
        const id = idRef.current;
        if (id !== null) void bus.call(terminalChannels.write, { id, data, source: 'owner' });
      });
      const resize = new ResizeObserver(scheduleFit);
      resize.observe(element);
      const theme = new MutationObserver(() => xterm.applyTheme());
      theme.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

      const start = async () => {
        let id = idRef.current;
        if (id === null) {
          const project = await bus.call(workspaceChannels.getCurrentProject, {});
          if (!project.ok || project.value === null) {
            setPhase({ kind: 'error', message: 'No project is open.' });
            return;
          }
          xterm.fit.fit();
          const created = await bus.call(terminalChannels.create, {
            projectId: project.value.id,
            cwd: (state.cwd === '' ? project.value.path : state.cwd) as AbsPath,
            cols: Math.max(2, xterm.terminal.cols),
            rows: Math.max(1, xterm.terminal.rows),
            worktree: state.worktree,
            launch: state.launch,
          });
          if (!alive) return;
          if (!created.ok) {
            setPhase({ kind: 'error', message: created.error.message });
            return;
          }
          id = created.value.id;
          idRef.current = id;
          setTerminalId(id);
          setState({ ...state, terminalId: id, cwd: created.value.cwd });
        }
        const attached = await bus.call(terminalChannels.attach, { id });
        if (!alive) return;
        if (!attached.ok) {
          setPhase({ kind: 'error', message: attached.error.message });
          return;
        }
        setTerminalId(id);
        lastSeq = Math.max(lastSeq, attached.value.lastSeq);
        if (attached.value.replay.byteLength > 0) xterm.terminal.write(attached.value.replay);
        setPhase(
          attached.value.info.state === 'exited'
            ? { kind: 'exited', code: attached.value.info.exitCode ?? 0 }
            : { kind: 'ready' },
        );
        // TERM-23: one row fewer, then the true size, so a full-screen program redraws.
        fitNow();
        const rows = xterm.terminal.rows;
        const attachedId = id;
        if (rows > 1) {
          void bus.call(terminalChannels.resize, { id: attachedId, cols: xterm.terminal.cols, rows: rows - 1 });
          setTimeout(fitNow, 50);
        }
      };
      void start();

      return () => {
        alive = false;
        clearTimeout(loadingTimer);
        if (fitTimer.current !== null) clearTimeout(fitTimer.current);
        offData();
        offExit();
        input.dispose();
        resize.disconnect();
        theme.disconnect();
        xterm.dispose();
        view.current = null;
      };
      // One view per attempt; `state` is read once when the panel starts its shell.
    }, [attempt]);

    // TERM-54: a hidden terminal keeps its output and is fitted when it shows again.
    useEffect(() => {
      if (visible) scheduleFit();
    }, [visible, scheduleFit]);

    useEffect(() => {
      if (isFocused) view.current?.terminal.focus();
    }, [isFocused]);

    const restart = () => {
      idRef.current = null;
      setTerminalId(null);
      setState({ ...state, terminalId: null });
      setAttempt((count) => count + 1);
    };

    return (
      <div className={styles.panel} data-phase={phase.kind}>
        {terminalId === null ? null : <HeaderSlot terminalId={terminalId} onHeightChange={scheduleFit} />}
        <div ref={screen} className={styles.screen} data-hsos-terminal="" />
        {phase.kind === 'loading' && showLoading ? <p className={styles.loading}>Starting shell…</p> : null}
        {phase.kind === 'exited' ? (
          <div className={styles.exited}>
            <Button variant="primary" onPress={restart}>
              Restart
            </Button>
          </div>
        ) : null}
        {phase.kind === 'error' ? (
          <div className={styles.error}>
            <ErrorState
              message={`The shell could not start: ${phase.message}`}
              onRetry={() => setAttempt((count) => count + 1)}
              settingsAction={{ label: 'Terminal settings', onPress: deps.openSettings }}
            />
          </div>
        ) : null}
      </div>
    );
  };
}
