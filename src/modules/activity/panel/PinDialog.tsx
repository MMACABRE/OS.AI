import { useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { reviewChannels } from '@hsos/contracts/channels/review';
import type { CommentTarget } from '@hsos/contracts/channels/review';
import type { ProjectId } from '@hsos/contracts/ids';
import { Button, Dialog, TextField, useToast } from '@hsos/ui-kit';
import styles from './PinDialog.module.css';

export type PinDialogProps = {
  readonly bus: Bus;
  readonly projectId: ProjectId;
  readonly target: CommentTarget;
  readonly onClose: () => void;
};

/** "Pin comment" (ACT-14, ACT-32): a comment on a file line or an artifact, kept in the feedback tray (REV-36). */
export function PinDialog({ bus, projectId, target, onClose }: PinDialogProps) {
  const toast = useToast();
  const [text, setText] = useState('');
  const save = () => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    void bus.call(reviewChannels.addComment, { projectId, target, text: trimmed }).then((result) => {
      if (result.ok) {
        toast.show({ message: 'Pinned to the feedback tray.', tone: 'ok' });
        onClose();
      } else toast.show({ message: result.error.message, tone: 'error' });
    });
  };
  return (
    <Dialog
      title="Pin comment"
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={text.trim() === ''} onPress={save}>
            Pin
          </Button>
        </>
      }
    >
      <div
        className={styles.column}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            save();
          }
        }}
      >
        <TextField value={text} onChange={setText} label="What should Claude look at?" />
      </div>
    </Dialog>
  );
}
