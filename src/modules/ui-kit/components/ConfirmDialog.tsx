import { useRef } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export type ConfirmDialogProps = {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/** A yes-or-no question. With `danger`, Cancel has the first focus so Enter never destroys by accident. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelWrap = useRef<HTMLSpanElement | null>(null);
  return (
    <Dialog
      title={title}
      danger={danger}
      onClose={onCancel}
      initialFocus={() => (danger ? (cancelWrap.current?.querySelector('button') ?? null) : null)}
      actions={
        <>
          <span ref={cancelWrap}>
            <Button variant="ghost" onPress={onCancel}>
              Cancel
            </Button>
          </span>
          <Button variant={danger ? 'danger' : 'primary'} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}
