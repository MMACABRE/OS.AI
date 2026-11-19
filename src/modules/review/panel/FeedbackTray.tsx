import { useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import type { CommentTarget, PinnedComment } from '@hsos/contracts/channels/review';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { SessionListItem } from '@hsos/contracts/channels/sessions';
import type { ProjectId } from '@hsos/contracts/ids';
import { Button, ConfirmDialog, Select, TextField, useToast } from '@hsos/ui-kit';
import { pasteBracketed } from './data';
import { relativeTo } from './helpers';
import styles from './FeedbackTray.module.css';

/** The words that name a comment's target in the tray and the prompt (REV-31). */
export function targetLabel(target: CommentTarget, root: string): string {
  switch (target.kind) {
    case 'diff-line':
      return `${relativeTo(root, target.path)} line ${target.line}${target.side === 'before' ? ' (removed line)' : ''}`;
    case 'file-line':
      return `${relativeTo(root, target.path)} line ${target.line}`;
    case 'artifact':
      return `${relativeTo(root, target.path)} (artifact)`;
    case 'element':
      return `Element on ${target.url}`;
  }
}

export type FeedbackTrayProps = {
  readonly bus: Bus;
  readonly projectId: ProjectId;
  readonly root: string;
  readonly comments: readonly PinnedComment[];
  readonly sessions: readonly SessionListItem[];
};

/** The feedback tray (REV-30 to REV-37): the pinned comments, composed into one prompt and pasted to a Claude terminal. */
export function FeedbackTray({ bus, projectId, root, comments, sessions }: FeedbackTrayProps) {
  const toast = useToast();
  const live = sessions.filter((item) => item.liveTerminalId !== null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = live.find((item) => item.liveTerminalId === chosenId) ?? live[0];
  const terminal = chosen?.liveTerminalId ?? null;
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [clearing, setClearing] = useState(false);

  const clearAll = () => {
    void bus.call(reviewChannels.clearComments, { projectId }).then((result) => {
      if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
      setSent(false);
    });
  };

  const send = () => {
    if (terminal === null) return;
    void bus.call(reviewChannels.composePrompt, { projectId }).then((composed) => {
      if (!composed.ok) {
        toast.show({ message: composed.error.message, tone: 'error' });
        return;
      }
      // REV-33: pasted, not run; the owner reads it and presses Enter.
      void pasteBracketed(bus, terminal, composed.value).then((written) => {
        if (written.ok) setSent(true);
        else toast.show({ message: written.error.message, tone: 'error' });
      });
    });
  };

  const copy = () => {
    void bus.call(reviewChannels.composePrompt, { projectId }).then((composed) => {
      if (!composed.ok) return;
      void bus.call(shellChannels.writeClipboard, { text: composed.value }).then((written) => {
        if (written.ok) toast.show({ message: 'Copied the feedback.', tone: 'ok' });
      });
    });
  };

  const saveEdit = (id: PinnedComment['id']) => {
    void bus.call(reviewChannels.updateComment, { projectId, id, text: draft.trim() }).then((result) => {
      if (result.ok) setEditing(null);
      else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const remove = (id: PinnedComment['id']) => {
    void bus.call(reviewChannels.removeComment, { projectId, id });
  };

  return (
    <section className={styles.tray} aria-label="Feedback tray">
      <div className={styles.head}>
        <span className={styles.title}>{`Feedback · ${comments.length} comment${comments.length === 1 ? '' : 's'}`}</span>
        {comments.length === 0 ? null : (
          <Button size="small" variant="ghost" onPress={() => setClearing(true)}>
            Clear all
          </Button>
        )}
      </div>
      {comments.length === 0 ? (
        <p className={styles.muted}>Pin a line in a diff, or an artifact, to send it to Claude.</p>
      ) : (
        <ol className={styles.items}>
          {comments.map((comment, index) => (
            <li key={comment.id} className={styles.item}>
              <span className={styles.target}>{`${index + 1}. ${targetLabel(comment.target, root)}`}</span>
              {editing === comment.id ? (
                <div className={styles.editor}>
                  <TextField value={draft} onChange={setDraft} label="Comment text" />
                  <div className={styles.actions}>
                    <Button size="small" onPress={() => saveEdit(comment.id)}>
                      Save
                    </Button>
                    <Button size="small" variant="ghost" onPress={() => setEditing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.text}>{comment.text}</span>
                  <div className={styles.actions}>
                    <Button
                      size="small"
                      variant="ghost"
                      onPress={() => {
                        setEditing(comment.id);
                        setDraft(comment.text);
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="small" variant="ghost" onPress={() => remove(comment.id)}>
                      Remove
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {comments.length === 0 ? null : (
        <div className={styles.send}>
          {live.length === 0 ? (
            <p className={styles.muted}>No Claude session is running here.</p>
          ) : (
            <Select
              value={terminal ?? ''}
              options={live.map((item) => ({ value: String(item.liveTerminalId), label: `Session: ${item.title || 'Untitled session'}` }))}
              onChange={setChosenId}
              label="Send to session"
            />
          )}
          {sent ? (
            <div className={styles.actions}>
              <span>Sent. Clear comments?</span>
              <Button size="small" onPress={clearAll}>
                Clear
              </Button>
              <Button size="small" variant="ghost" onPress={() => setSent(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              <Button size="small" disabled={terminal === null} onPress={send}>
                Send to Claude
              </Button>
              <Button size="small" variant="ghost" onPress={copy}>
                Copy
              </Button>
            </div>
          )}
        </div>
      )}
      {clearing ? (
        <ConfirmDialog
          title="Clear all comments?"
          body="Their text leaves the tray. Comments already sent to Claude are not affected."
          confirmLabel="Clear all"
          danger
          onConfirm={() => {
            setClearing(false);
            clearAll();
          }}
          onCancel={() => setClearing(false)}
        />
      ) : null}
    </section>
  );
}
