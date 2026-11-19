import { Component, createElement, useEffect, useRef, useState } from 'react';
import type {
  ComponentType,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import type { WidgetInstance, WidgetType } from '@hsos/contracts/channels/dashboard';
import { dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import type { Logger } from '@hsos/contracts/module';
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Skeleton,
  Surface,
  useReducedMotion,
  useToast,
  useUiContributions,
} from '@hsos/ui-kit';
import { canPlace, firstFit, resizeTarget, MAX_SCREENS } from './placement';
import type { Cell, Size, TypeSizes } from './placement';

/** Joins the class names that are set. */
const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');

/** Arrow keys as cell steps (DASH-11). */
const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};
import { newWidgetId, resetDashboard, useDashboard } from './dashboard-store';
import styles from './Dashboard.module.css';

/** Pointer still for this long starts edit mode (DASH-5). */
export const HOLD_MS = 500;
/** Movement that cancels the hold (DASH-5). */
export const HOLD_SLOP_PX = 6;

type WidgetProps = {
  readonly config: unknown;
  readonly cells: Size;
  readonly pixels: { readonly width: number; readonly height: number };
  readonly setConfig: (config: unknown) => void;
};

type Drag = {
  readonly id: string;
  readonly kind: 'move' | 'resize';
  readonly cell: Cell;
  readonly valid: boolean;
};

export type DashboardDeps = { readonly log: Logger; readonly openSettings: () => void };

const sizesOf = (def: WidgetType): TypeSizes => ({
  min: def.minSize,
  max: def.maxSize,
  defaultSize: def.defaultSize,
});

/** A widget that throws shows its error state in its own frame (DASH-4, P-12). */
class WidgetBoundary extends Component<
  { readonly title: string; readonly log: Logger; readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    this.props.log.log('error', 'dashboard.widget_failed', {
      widget: this.props.title,
      message: error.message,
    });
  }
  override render() {
    if (this.state.failed) return <ErrorState message={`${this.props.title} stopped working.`} />;
    return this.props.children;
  }
}

type CellProps = {
  readonly widget: WidgetInstance;
  readonly def: WidgetType;
  readonly index: number;
  readonly editing: boolean;
  readonly focusable: boolean;
  readonly log: Logger;
  readonly onRemove: (id: string) => void;
  readonly onActivate: () => void;
  readonly onKey: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
};

/** One widget on the grid: its frame (box or free), its content, and in edit mode its handles (DASH-4, DASH-5). */
function WidgetCell({ widget, def, index, editing, focusable, log, onRemove, onActivate, onKey }: CellProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [pixels, setPixels] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const observer = new ResizeObserver(() =>
      setPixels({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const props: WidgetProps = {
    config: widget.config ?? def.defaultConfig,
    cells: { w: widget.w, h: widget.h },
    pixels,
    setConfig: () => undefined,
  };
  const body = (
    <WidgetBoundary title={def.title} log={log}>
      {createElement(def.component as unknown as ComponentType<WidgetProps>, props) as ReactNode}
    </WidgetBoundary>
  );
  const style: CSSProperties = {
    gridColumn: `${widget.x + 1} / span ${widget.w}`,
    gridRow: `${widget.y + 1} / span ${widget.h}`,
    ...(editing && !reduced ? { animationDelay: `${-index * 0.3}s` } : {}),
  };
  return (
    <div
      ref={ref}
      className={cx(styles.cell, editing && styles.editing, editing && !reduced && styles.sway)}
      style={style}
      data-widget={widget.id}
      data-type={widget.type}
      tabIndex={focusable ? 0 : -1}
      role="group"
      aria-label={def.title}
      onKeyDown={onKey}
      onClick={() => {
        if (!editing) onActivate();
      }}
    >
      {def.frame === 'box' ? (
        <Surface role="widget">
          <div className={styles.box}>{body}</div>
        </Surface>
      ) : (
        <div className={styles.free}>{body}</div>
      )}
      {editing ? (
        <>
          <span className={styles.handle} data-handle="resize" aria-hidden="true" />
          <div className={styles.removeButton}>
            <IconButton
              icon={<Icon name="trash" />}
              label="Remove widget"
              onPress={() => onRemove(widget.id)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * The Dashboard page (dashboard.md): screens of widgets on a grid, slid by dots and keys, with edit mode
 * (hold, move, resize, add, remove, screens and keyboard). The page itself draws the layout; widgets come from
 * `dashboardWidgets` (DASH-1 to DASH-13).
 */
export function createDashboardPage(deps: DashboardDeps) {
  return function DashboardScreens() {
    const store = useDashboard();
    const contributed = useUiContributions(dashboardWidgets);
    const toast = useToast();
    const reduced = useReducedMotion();
    const track = useRef<HTMLDivElement>(null);
    const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdStart = useRef<{ x: number; y: number } | null>(null);
    const dragRef = useRef<Drag | null>(null);
    const dragOrigin = useRef<{
      x: number;
      y: number;
      w: number;
      h: number;
      startX: number;
      startY: number;
      cellW: number;
      cellH: number;
      type: WidgetType;
    } | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [adding, setAdding] = useState(false);
    const [screensOpen, setScreensOpen] = useState(false);
    const [confirmScreen, setConfirmScreen] = useState<number | null>(null);
    const { grid, screens, screen, editing, widgets } = store;
    const typeOf = (type: string) => contributed.find((entry) => entry.id === type);
    const onScreen = (index: number) => widgets.filter((widget) => widget.screen === index);

    const endEdit = () => {
      store.setEditing(false);
    };
    useEffect(() => {
      if (!editing) return undefined;
      const onKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !adding && !screensOpen && confirmScreen === null) endEdit();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [editing, adding, screensOpen, confirmScreen]);

    const cancelHold = () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      holdTimer.current = null;
      holdStart.current = null;
    };

    // DASH-5: a still pointer for HOLD_MS starts edit mode; movement beyond the slop cancels it.
    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || editing) return;
      holdStart.current = { x: event.clientX, y: event.clientY };
      cancelHold();
      holdStart.current = { x: event.clientX, y: event.clientY };
      holdTimer.current = setTimeout(() => {
        holdTimer.current = null;
        store.setEditing(true);
      }, HOLD_MS);
    };
    const onPointerMoveHold = (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = holdStart.current;
      if (start !== null && Math.hypot(event.clientX - start.x, event.clientY - start.y) > HOLD_SLOP_PX)
        cancelHold();
    };

    const cellSize = () => {
      const rect = track.current?.parentElement?.getBoundingClientRect();
      if (rect === undefined || rect.width === 0) return { w: 1, h: 1 };
      return { w: rect.width / grid.columns, h: rect.height / grid.rows };
    };

    /** Starts a move or resize drag from a widget in edit mode (DASH-6, DASH-7). */
    const startDrag = (
      event: ReactPointerEvent<HTMLDivElement>,
      widget: WidgetInstance,
      kind: 'move' | 'resize',
    ) => {
      const type = typeOf(widget.type);
      if (type === undefined) return;
      const size = cellSize();
      dragOrigin.current = {
        x: widget.x,
        y: widget.y,
        w: widget.w,
        h: widget.h,
        startX: event.clientX,
        startY: event.clientY,
        cellW: size.w,
        cellH: size.h,
        type,
      };
      const first: Drag = {
        id: widget.id,
        kind,
        cell: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
        valid: true,
      };
      dragRef.current = first;
      setDrag(first);
      const onMove = (move: PointerEvent) => {
        const origin = dragOrigin.current;
        if (origin === null) return;
        const dx = Math.round((move.clientX - origin.startX) / origin.cellW);
        const dy = Math.round((move.clientY - origin.startY) / origin.cellH);
        const others = onScreen(widget.screen).filter((entry) => entry.id !== widget.id);
        const sizes = sizesOf(origin.type);
        let next: Drag;
        if (kind === 'move') {
          const cell = { x: origin.x + dx, y: origin.y + dy, w: origin.w, h: origin.h };
          next = { id: widget.id, kind, cell, valid: canPlace(cell, others, grid) };
        } else {
          const target = resizeTarget(
            { x: origin.x, y: origin.y, w: origin.w, h: origin.h },
            { w: origin.w + dx, h: origin.h + dy },
            sizes,
            others,
            grid,
          );
          next = { id: widget.id, kind, cell: { x: origin.x, y: origin.y, ...target }, valid: true };
        }
        dragRef.current = next;
        setDrag(next);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const finished = dragRef.current;
        if (finished !== null && finished.valid) store.moveOrResize(finished.id, finished.cell);
        dragRef.current = null;
        dragOrigin.current = null;
        setDrag(null);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    const onCellPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const cell = target.closest<HTMLElement>('[data-widget]');
      const id = cell?.dataset['widget'];
      const widget = widgets.find((entry) => entry.id === id);
      if (editing && widget !== undefined) {
        event.preventDefault();
        startDrag(event, widget, target.dataset['handle'] === 'resize' ? 'resize' : 'move');
        return;
      }
      onPointerDown(event);
    };

    const remove = (id: string) => {
      store.remove(id);
      toast.show({
        message: 'Widget removed.',
        tone: 'info',
        action: { label: 'Undo', onPress: () => store.undoRemove() },
      });
    };

    const activate = (widget: WidgetInstance) => {
      const type = typeOf(widget.type);
      try {
        type?.activate?.(widget.config ?? type.defaultConfig);
      } catch (error) {
        deps.log.log('error', 'dashboard.activate_failed', {
          type: widget.type,
          message: error instanceof Error ? error.message : 'unknown',
        });
      }
    };

    const onWidgetKey = (event: ReactKeyboardEvent<HTMLDivElement>, widget: WidgetInstance) => {
      const type = typeOf(widget.type);
      if (type === undefined) return;
      const others = onScreen(widget.screen).filter((entry) => entry.id !== widget.id);
      const step = STEPS[event.key];
      if (event.key === 'Enter') {
        event.preventDefault();
        if (editing) endEdit();
        else activate(widget);
        return;
      }
      if (event.key === 'Escape' && editing) return endEdit();
      if (event.key === 'Delete' && editing) return remove(widget.id);
      if (!editing) {
        if (step !== undefined) {
          const cells = [...(track.current?.querySelectorAll<HTMLElement>('[data-widget]') ?? [])];
          const at = cells.findIndex((element) => element.dataset['widget'] === widget.id);
          const next = cells[at + (step[0] === 1 || step[1] === 1 ? 1 : -1)];
          next?.focus();
        }
        return;
      }
      if (step === undefined) return;
      event.preventDefault();
      const [dx, dy] = step;
      if (event.shiftKey) {
        const target = resizeTarget(
          { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
          { w: widget.w + dx, h: widget.h + dy },
          sizesOf(type),
          others,
          grid,
        );
        store.moveOrResize(widget.id, { x: widget.x, y: widget.y, ...target });
      } else store.moveOrResize(widget.id, { x: widget.x + dx, y: widget.y + dy, w: widget.w, h: widget.h });
    };

    const addAt = (type: WidgetType) => {
      const others = onScreen(screen);
      const cell = firstFit(type.defaultSize, others, grid);
      if (cell === null) {
        toast.show({ message: 'No room on this screen. Make space or add a screen.', tone: 'error' });
        return;
      }
      store.add({ id: newWidgetId(), type: type.id, screen, ...cell, config: type.defaultConfig });
      setAdding(false);
    };

    const pages = Array.from({ length: screens }, (_, index) => index);
    const groups = [...new Set(contributed.map((entry) => entry.moduleId))];
    const pendingCount = confirmScreen === null ? 0 : onScreen(confirmScreen).length;

    if (!store.loaded)
      return (
        <div className={styles.page}>
          <Skeleton rows={4} label="Loading dashboard" />
        </div>
      );
    if (store.error !== null)
      return (
        <div className={styles.page}>
          <ErrorState
            message={`The dashboard could not be loaded. ${store.error}`}
            onRetry={() => resetDashboard(grid)}
          />
        </div>
      );

    return (
      <div
        className={styles.page}
        onClick={(event) => {
          if (editing && event.target === event.currentTarget) endEdit();
        }}
      >
        {editing ? (
          <div className={styles.toolbar} role="toolbar" aria-label="Edit dashboard">
            <Button onPress={() => setAdding(true)}>Add widget</Button>
            <Button onPress={() => setScreensOpen(true)}>Screens</Button>
            <Button variant="primary" onPress={endEdit}>
              Done
            </Button>
          </div>
        ) : null}
        <div
          className={styles.viewport}
          onPointerDown={onCellPointerDown}
          onPointerMove={onPointerMoveHold}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
        >
          <div
            ref={track}
            className={cx(styles.track, editing && styles.trackEditing, reduced && styles.noMotion)}
            style={{ width: `${screens * 100}%`, transform: `translateX(-${(screen * 100) / screens}%)` }}
          >
            {pages.map((index) => (
              <div
                key={index}
                className={styles.screen}
                style={{ width: `${100 / screens}%` }}
                aria-label={`Screen ${index + 1}`}
              >
                <div
                  className={styles.grid}
                  style={{
                    gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {onScreen(index).map((widget, position) => {
                    const def = typeOf(widget.type);
                    if (def === undefined) return null;
                    return (
                      <WidgetCell
                        key={widget.id}
                        widget={widget}
                        def={def}
                        index={position}
                        editing={editing}
                        focusable={index === screen}
                        log={deps.log}
                        onRemove={remove}
                        onActivate={() => activate(widget)}
                        onKey={(event) => onWidgetKey(event, widget)}
                      />
                    );
                  })}
                  {drag !== null && index === screen ? (
                    <div
                      className={cx(styles.outline, drag.valid ? styles.outlineOk : styles.outlineBad)}
                      style={{
                        gridColumn: `${drag.cell.x + 1} / span ${drag.cell.w}`,
                        gridRow: `${drag.cell.y + 1} / span ${drag.cell.h}`,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                {onScreen(index).length === 0 ? (
                  <div className={styles.empty}>
                    <EmptyState
                      title="This screen is empty."
                      message="Add a widget to start."
                      action={{ label: 'Add widget', onPress: () => setAdding(true) }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className={styles.dots} role="group" aria-label="Screens">
          {pages.map((index) => (
            <button
              key={index}
              type="button"
              className={cx(styles.dot, index === screen && styles.dotOn)}
              aria-label={`Screen ${index + 1}`}
              aria-pressed={index === screen}
              onClick={() => store.setScreen(index)}
            />
          ))}
        </div>
        {adding ? (
          <Dialog
            title="Add widget"
            onClose={() => setAdding(false)}
            actions={<Button onPress={() => setAdding(false)}>Close</Button>}
          >
            {groups.length === 0 ? <p>No widgets are available.</p> : null}
            {groups.map((group) => (
              <section key={group}>
                <h3>{group}</h3>
                {contributed
                  .filter((entry) => entry.moduleId === group)
                  .map((entry) => (
                    <Button key={entry.id} onPress={() => addAt(entry)}>
                      {`${entry.title} (${entry.defaultSize.w} by ${entry.defaultSize.h})`}
                    </Button>
                  ))}
              </section>
            ))}
          </Dialog>
        ) : null}
        {screensOpen ? (
          <Dialog
            title="Screens"
            onClose={() => setScreensOpen(false)}
            actions={<Button onPress={() => setScreensOpen(false)}>Close</Button>}
          >
            {pages.map((index) => (
              <div key={index}>
                <span>{`Screen ${index + 1}, ${onScreen(index).length} widgets`}</span>
                <IconButton
                  icon={<Icon name="trash" />}
                  label={`Remove screen ${index + 1}`}
                  onPress={() =>
                    onScreen(index).length === 0 ? store.removeScreen(index) : setConfirmScreen(index)
                  }
                />
              </div>
            ))}
            <Button disabled={screens >= MAX_SCREENS} onPress={() => store.addScreen()}>
              Add screen
            </Button>
          </Dialog>
        ) : null}
        {confirmScreen === null ? null : (
          <ConfirmDialog
            title="Remove screen"
            body={`Remove this screen and its ${pendingCount} widgets?`}
            confirmLabel="Remove"
            danger
            onConfirm={() => {
              store.removeScreen(confirmScreen);
              setConfirmScreen(null);
            }}
            onCancel={() => setConfirmScreen(null)}
          />
        )}
      </div>
    );
  };
}
