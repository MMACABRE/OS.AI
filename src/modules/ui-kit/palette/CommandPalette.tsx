import * as RadixDialog from '@radix-ui/react-dialog';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '../components/cx';
import { Kbd } from '../components/Kbd';
import { useOverlayOpen } from '../components/overlay-state';
import { useToast } from '../components/Toast';
import styles from './CommandPalette.module.css';
import type { CommandRegistry, PaletteItem } from './command-registry';
import { rankCommands } from './rank-commands';

/** `commands`, or the id of a provider mode such as file mode (UI-12). */
export type PaletteModeId = string;
export const COMMAND_MODE = 'commands';

export type CommandPaletteProps = {
  readonly registry: CommandRegistry;
  readonly open: boolean;
  /** The mode it opens in: `commands` for Ctrl+Shift+P, the '' prefix mode for Ctrl+P. */
  readonly initialMode: PaletteModeId;
  readonly onClose: () => void;
  /** The effective key of a command, shown beside it (UI-10). */
  readonly keyFor: (commandId: string) => string | null;
};

type Row = PaletteItem & { readonly key: string | null };

/**
 * The command palette (UI-10 to UI-14): every registered command with its key, fuzzy ranked; `>` switches
 * from a provider mode to commands; Enter runs and closes; a rejected command shows an error toast; closing
 * returns focus to where it was.
 */
export function CommandPalette({ registry, open, initialMode, onClose, keyFor }: CommandPaletteProps) {
  const [mode, setMode] = useState<PaletteModeId>(initialMode);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [modeRows, setModeRows] = useState<readonly Row[]>([]);
  const toast = useToast();
  const listId = useId();
  const opener = useRef<HTMLElement | null>(null);
  useOverlayOpen(open);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode(initialMode);
    setQuery('');
    setActive(0);
  }, [open, initialMode]);

  const providerMode = registry.modes().find((item) => item.id === mode);
  const commandRows = useMemo<readonly Row[]>(() => {
    if (mode !== COMMAND_MODE) return [];
    const commands = [...registry.commands.values()];
    return rankCommands(commands, query, registry.recent()).map((command) => ({
      id: command.id,
      title: command.title,
      key: keyFor(command.id),
      run: () => {
        registry.markUsed(command.id);
        return command.run();
      },
    }));
  }, [mode, query, registry, keyFor]);

  useEffect(() => {
    if (providerMode === undefined) return;
    let current = true;
    void Promise.resolve(providerMode.search(query)).then((items) => {
      if (current) setModeRows(items.map((item) => ({ ...item, key: null })));
    });
    return () => {
      current = false;
    };
  }, [providerMode, query]);

  const rows = mode === COMMAND_MODE ? commandRows : modeRows;
  const safeActive = Math.min(active, Math.max(0, rows.length - 1));

  const onQuery = (text: string) => {
    if (mode !== COMMAND_MODE && text.startsWith('>')) {
      setMode(COMMAND_MODE);
      setQuery(text.slice(1));
    } else setQuery(text);
    setActive(0);
  };

  const runRow = (row: Row | undefined) => {
    if (row === undefined) return;
    onClose();
    try {
      void Promise.resolve(row.run()).catch((error: unknown) =>
        toast.show({ tone: 'error', message: error instanceof Error ? error.message : String(error) }),
      );
    } catch (error) {
      toast.show({ tone: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') setActive((index) => Math.min(rows.length - 1, index + 1));
    else if (event.key === 'ArrowUp') setActive((index) => Math.max(0, index - 1));
    else if (event.key === 'Enter') runRow(rows[safeActive]);
    else return;
    event.preventDefault();
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.dim} />
        <RadixDialog.Content
          className={styles.palette}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          <RadixDialog.Title className={styles.hidden}>Command palette</RadixDialog.Title>
          <input
            className={styles.input}
            value={query}
            placeholder={providerMode?.placeholder ?? 'Type a command'}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={rows.length > 0 ? `${listId}-${safeActive}` : undefined}
            aria-label={mode === COMMAND_MODE ? 'Command' : (providerMode?.placeholder ?? 'Search')}
            spellCheck={false}
            onChange={(event) => onQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className={styles.list} id={listId} role="listbox">
            {rows.length === 0 ? <p className={styles.none}>No matches</p> : null}
            {rows.map((row, index) => (
              <div
                key={row.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === safeActive}
                className={cx(styles.row, index === safeActive && styles.active)}
                onMouseMove={() => setActive(index)}
                onClick={() => runRow(row)}
              >
                <span className={styles.title}>{row.title}</span>
                {row.detail === undefined ? null : <span className={styles.detail}>{row.detail}</span>}
                {row.key === null ? null : (
                  <span className={styles.key}>
                    <Kbd binding={row.key} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
