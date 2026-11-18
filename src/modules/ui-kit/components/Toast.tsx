import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import styles from './Overlay.module.css';

/** A toast stays this long, unless it is an error (ui-kit.md "Components"). */
export const TOAST_MS = 4_000;
/** At most this many toasts are stacked; a new one pushes out the oldest. */
export const MAX_TOASTS = 3;

export type ToastInput = {
  readonly message: string;
  readonly tone?: 'info' | 'ok' | 'error';
};

type ShownToast = ToastInput & { readonly id: number };

export type ToastApi = { show(toast: ToastInput): void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

/** Shows toasts from anywhere below the provider. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

type ToastViewProps = { readonly toast: ShownToast; readonly dismiss: (id: number) => void };

function ToastView({ toast, dismiss }: ToastViewProps) {
  const isError = toast.tone === 'error';
  useEffect(() => {
    if (isError) return;
    const timer = setTimeout(() => dismiss(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [isError, dismiss, toast.id]);
  return (
    <div
      className={cx(styles.toast, isError && styles.toastError, toast.tone === 'ok' && styles.toastOk)}
      role={isError ? 'alert' : 'status'}
    >
      <span className={styles.toastIcon} aria-hidden="true">
        <Icon name={isError ? 'error' : toast.tone === 'ok' ? 'check' : 'info'} />
      </span>
      <span className={styles.toastMessage}>{toast.message}</span>
      <IconButton icon={<Icon name="close" />} label="Dismiss" onPress={() => dismiss(toast.id)} />
    </div>
  );
}

/**
 * Holds the toasts: bottom right, 4 s each, at most 3 stacked, errors stay until dismissed.
 * The app frame mounts it once.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ShownToast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)),
    [],
  );
  const api = useMemo<ToastApi>(
    () => ({
      show: (toast) => {
        const id = nextId.current;
        nextId.current += 1;
        setToasts((current) => [...current, { ...toast, id }].slice(-MAX_TOASTS));
      },
    }),
    [],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts} aria-live="polite">
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} dismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
