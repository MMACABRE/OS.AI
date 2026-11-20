import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
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
  /** One button beside the message; pressing it runs `onPress` and dismisses the toast. */
  readonly action?: { readonly label: string; readonly onPress: () => void } | undefined;
  /** How long the toast stays, in ms. Defaults to TOAST_MS. Errors stay until dismissed. */
  readonly duration?: number;
};

type ShownToast = ToastInput & { readonly id: number };

export type ToastApi = { show(toast: ToastInput): void };

/** The providers mounted now, in mount order: the last one is where a toast from outside React goes. */
const mountedProviders: ToastApi[] = [];

/** Shows a toast from outside React, such as a command. It goes to the most recently mounted ToastProvider. */
export function showToast(toast: ToastInput): void {
  mountedProviders[mountedProviders.length - 1]?.show(toast);
}

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
    const timer = setTimeout(() => dismiss(toast.id), toast.duration ?? TOAST_MS);
    return () => clearTimeout(timer);
  }, [isError, dismiss, toast.id, toast.duration]);
  return (
    <div
      className={cx(styles.toast, isError && styles.toastError, toast.tone === 'ok' && styles.toastOk)}
      role={isError ? 'alert' : 'status'}
    >
      <span className={styles.toastIcon} aria-hidden="true">
        <Icon name={isError ? 'error' : toast.tone === 'ok' ? 'check' : 'info'} />
      </span>
      <span className={styles.toastMessage}>{toast.message}</span>
      {toast.action === undefined ? null : (
        <Button
          variant="ghost"
          size="small"
          onPress={() => {
            toast.action?.onPress();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </Button>
      )}
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
  useEffect(() => {
    mountedProviders.push(api);
    return () => {
      const index = mountedProviders.indexOf(api);
      if (index >= 0) mountedProviders.splice(index, 1);
    };
  }, [api]);
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
