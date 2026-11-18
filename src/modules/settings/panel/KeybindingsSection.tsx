import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { Button, Kbd, keyFromEvent, useCommands, useToast } from '@hsos/ui-kit';
import styles from './SettingsScreen.module.css';

type Pending = { readonly commandId: string; readonly key: string; readonly takenBy: string | null };

/**
 * "Key bindings": every command with its key. Select a row and press a combination to set it; a key
 * another command holds is shown as a conflict before saving (settings.md "Settings screen").
 */
export function KeybindingsSection({ bus, filter }: { readonly bus: Bus; readonly filter: string }) {
  const { registry, keyFor } = useCommands();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const commands = [...(registry?.commands.values() ?? [])]
    .filter((command) => `${command.title} ${command.id}`.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));

  const save = async (commandId: string, key: string | null) => {
    const result = await bus.call(settingsChannels.setKeybinding, { commandId, key });
    if (!result.ok) toast.show({ tone: 'error', message: result.error.message });
    setPending(null);
  };

  const onKeyDown = (commandId: string, event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab' || event.key === 'Escape') return;
    const key = keyFromEvent(event.nativeEvent);
    if (key === null) return;
    event.preventDefault();
    event.stopPropagation();
    const takenBy =
      [...(registry?.commands.values() ?? [])].find(
        (command) => command.id !== commandId && keyFor(command.id) === key,
      )?.id ?? null;
    if (takenBy === null) void save(commandId, key);
    else setPending({ commandId, key, takenBy });
  };

  return (
    <div className={styles.rows}>
      <p className={styles.hint}>Select a command and press the keys you want for it.</p>
      {commands.map((command) => {
        const key = keyFor(command.id);
        const isPending = pending?.commandId === command.id;
        return (
          <div
            key={command.id}
            className={styles.row}
            role="button"
            tabIndex={0}
            aria-pressed={selected === command.id}
            data-selected={selected === command.id}
            onFocus={() => setSelected(command.id)}
            onKeyDown={(event) => onKeyDown(command.id, event)}
          >
            <span className={styles.label}>{command.title}</span>
            <span className={styles.control}>
              {key === null ? <span className={styles.muted}>No key</span> : <Kbd binding={key} />}
              {key !== null ? (
                <Button variant="ghost" size="small" onPress={() => void save(command.id, null)}>
                  Remove
                </Button>
              ) : null}
            </span>
            {isPending && pending !== null ? (
              <span className={styles.conflict} role="alert">
                <Kbd binding={pending.key} /> is used by{' '}
                {registry?.commands.get(pending.takenBy ?? '')?.title ?? pending.takenBy}.
                <Button
                  size="small"
                  variant="danger"
                  onPress={() => void save(pending.commandId, pending.key)}
                >
                  Use it here
                </Button>
                <Button size="small" variant="ghost" onPress={() => setPending(null)}>
                  Cancel
                </Button>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
