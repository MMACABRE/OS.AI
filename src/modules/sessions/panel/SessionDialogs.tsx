import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { sessionsChannels } from '@hsos/contracts/channels/sessions';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import { Button, ConfirmDialog, Dialog, TextField, useToast } from '@hsos/ui-kit';
import { titleOf } from './actions';
import styles from './SessionDialogs.module.css';

/** What a dialog needs about a session: its id, name, note and live terminal. */
export type DialogItem = Pick<SessionListItem, 'sessionId' | 'title' | 'note' | 'liveTerminalId'>;

/** The dialogs the session lists open: rename (SESS-74), edit note (SESS-75), delete (SESS-76). */
export type SessionDialog =
  | { readonly kind: 'rename'; readonly item: DialogItem }
  | { readonly kind: 'note'; readonly item: DialogItem }
  | { readonly kind: 'delete'; readonly items: readonly DialogItem[] };

export type SessionDialogsProps = {
  readonly bus: Bus;
  readonly dialog: SessionDialog | null;
  readonly onClose: () => void;
  /** Called after a change was saved, so the lists read the new values. */
  readonly onChanged: () => void;
};

export function SessionDialogs({ bus, dialog, onClose, onChanged }: SessionDialogsProps) {
  if (dialog === null) return null;
  if (dialog.kind === 'rename') return <RenameDialog bus={bus} item={dialog.item} onClose={onClose} onChanged={onChanged} />;
  if (dialog.kind === 'note') return <NoteDialog bus={bus} item={dialog.item} onClose={onClose} onChanged={onChanged} />;
  return <DeleteDialog bus={bus} items={dialog.items} onClose={onClose} onChanged={onChanged} />;
}

type Common = Omit<SessionDialogsProps, 'dialog'> & { readonly item: DialogItem };

/** SESS-74: the title field is filled with the current name; Enter saves. */
function RenameDialog({ bus, item, onClose, onChanged }: Common) {
  const toast = useToast();
  const [title, setTitle] = useState(item.title);
  const trimmed = title.trim();
  const invalid = trimmed === '' ? 'Enter a name.' : trimmed.length > 80 ? 'Use 80 characters or fewer.' : null;
  const save = () => {
    if (invalid !== null) return;
    void bus.call(sessionsChannels.rename, { sessionId: item.sessionId, title: trimmed }).then((result) => {
      if (result.ok) {
        toast.show({ message: `Renamed to "${result.value.title}".`, tone: 'ok' });
        onChanged();
        onClose();
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };
  return (
    <Dialog
      title="Rename session"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={invalid !== null} onPress={save}>
            Save
          </Button>
        </>
      }
    >
      <div
        className={styles.column}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
          }
        }}
      >
        <TextField value={title} onChange={setTitle} label="Session name" invalidMessage={invalid} />
        <p className={styles.hint}>
          {item.liveTerminalId === null
            ? "Claude Code's own session list shows this name too."
            : 'Claude Code shows this name after the session ends.'}
        </p>
      </div>
    </Dialog>
  );
}

/** SESS-75: a multi-line note. Ctrl+Enter saves. The note is never sent to Claude (SESS-63). */
function NoteDialog({ bus, item, onClose, onChanged }: Common) {
  const toast = useToast();
  const [note, setNote] = useState(item.note);
  const save = () => {
    void bus.call(sessionsChannels.setNote, { sessionId: item.sessionId, note }).then((result) => {
      if (result.ok) {
        onChanged();
        onClose();
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };
  return (
    <Dialog
      title={`Note for ${titleOf(item)}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onPress={save}>
            Save note
          </Button>
        </>
      }
    >
      <textarea
        className={styles.note}
        aria-label="Note"
        value={note}
        maxLength={2000}
        spellCheck={false}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            save();
          }
        }}
      />
    </Dialog>
  );
}

/** SESS-76: moves the sessions to the Recycle Bin; running ones are skipped. Cancel has the first focus. */
function DeleteDialog({ bus, items, onClose, onChanged }: Omit<Common, 'item'> & { readonly items: readonly DialogItem[] }) {
  const toast = useToast();
  const removable = items.filter((item) => item.liveTerminalId === null);
  const running = items.filter((item) => item.liveTerminalId !== null);
  const count = removable.length;
  const skipped = running.length === 0 ? '' : ` Still running, will be skipped: ${running.map(titleOf).join(', ')}.`;
  const confirm = () => {
    if (count === 0) {
      toast.show({ message: 'Running sessions are skipped. Nothing was moved.', tone: 'info' });
      onClose();
      return;
    }
    void bus.call(sessionsChannels.trash, { sessionIds: removable.map((item) => item.sessionId) }).then((result) => {
      if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
      else {
        toast.show({ message: `${result.value.trashed.length} moved to the Recycle Bin`, tone: 'ok' });
        for (const failure of result.value.failed) toast.show({ message: failure.message, tone: 'error' });
      }
      onChanged();
      onClose();
    });
  };
  return (
    <ConfirmDialog
      title={`Move ${count} session${count === 1 ? '' : 's'} to the Recycle Bin?`}
      body={`Their transcripts, HSOS's backup copies and notes go to the Recycle Bin. Restore them from there if you change your mind.${skipped}`}
      confirmLabel="Move to Recycle Bin"
      danger
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
