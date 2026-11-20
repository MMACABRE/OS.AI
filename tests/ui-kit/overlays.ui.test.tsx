import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  Button,
  ConfirmDialog,
  Dialog,
  ICONS,
  Icon,
  MAX_TOASTS,
  Menu,
  TOAST_MS,
  TextField,
  ToastProvider,
  useAnyOverlayOpen,
  useToast,
} from '@hsos/ui-kit';
import type { ToastApi } from '@hsos/ui-kit';
import { COMPONENTS, MOTION, composedBy, composes, ruleBody } from './css-composes';

class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
  Element.prototype.hasPointerCapture ??= () => false;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('data-motion');
});

const overlayCss = `${COMPONENTS}/Overlay.module.css`;

function OpensDialog({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open it</Button>
      {open ? (
        <Dialog
          title="Rename"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          actions={<Button onPress={() => setOpen(false)}>Done</Button>}
        >
          <TextField label="Name" value="" onChange={() => undefined} />
        </Dialog>
      ) : null}
    </>
  );
}

describe('Dialog', () => {
  it('UI-2 Escape closes a Dialog, calls onClose and returns focus to the button that opened it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<OpensDialog onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('UI-2 a Dialog without initialFocus focuses its first focusable element', async () => {
    const user = userEvent.setup();
    render(<OpensDialog onClose={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Name' })));
  });
});

describe('ConfirmDialog', () => {
  it('UI-2 ConfirmDialog with danger focuses Cancel on open', async () => {
    render(
      <ConfirmDialog
        title="Delete"
        body="Delete the note?"
        confirmLabel="Delete"
        danger
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })));
  });

  it('UI-2 ConfirmDialog without danger focuses the first focusable element of the dialog', async () => {
    render(
      <ConfirmDialog
        title="Save"
        body="Save the note?"
        confirmLabel="Save"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const dialog = screen.getByRole('dialog');
    const first = dialog.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(first?.closest('[role="dialog"]')).toBe(dialog);
  });

  it('UI-2 the confirm button calls onConfirm and Cancel calls onCancel', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Save"
        body="Save?"
        confirmLabel="Save"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Toast', () => {
  function capture(): { api: () => ToastApi } {
    let api: ToastApi | null = null;
    function Grab() {
      const toast = useToast();
      useEffect(() => {
        api = toast;
      }, [toast]);
      return null;
    }
    render(
      <ToastProvider>
        <Grab />
      </ToastProvider>,
    );
    return {
      api: () => {
        if (api === null) throw new Error('the toast api was not captured');
        return api;
      },
    };
  }

  it('UI-2 at most 3 toasts: showing 4 leaves the last 3', () => {
    vi.useFakeTimers();
    const { api } = capture();
    expect(MAX_TOASTS).toBe(3);
    act(() => {
      for (const message of ['one', 'two', 'three', 'four']) api().show({ message });
    });
    expect(screen.queryByText('one')).toBeNull();
    expect(screen.getByText('two')).toBeTruthy();
    expect(screen.getByText('three')).toBeTruthy();
    expect(screen.getByText('four')).toBeTruthy();
  });

  it('UI-2 a non-error toast is gone after 4000 ms', () => {
    vi.useFakeTimers();
    const { api } = capture();
    expect(TOAST_MS).toBe(4000);
    act(() => api().show({ message: 'saved', tone: 'ok' }));
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByText('saved')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('saved')).toBeNull();
  });

  it('UI-2 an error toast stays until Dismiss is pressed', () => {
    vi.useFakeTimers();
    const { api } = capture();
    act(() => api().show({ message: 'it broke', tone: 'error' }));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('it broke')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('it broke')).toBeNull();
  });
});

describe('SET-15 a dialog under reduced motion', () => {
  it('SET-15 under data-motion reduced the dialog animation is a fade of at most motion.quick', async () => {
    document.documentElement.setAttribute('data-motion', 'reduced');
    render(
      <Dialog title="Hi" onClose={() => undefined} actions={<Button onPress={() => undefined}>Ok</Button>} />,
    );
    const dialog = screen.getByRole('dialog');
    // jsdom computes no animation from CSS modules, so the stylesheet source is read for the rule.
    expect(composes(dialog, overlayCss, 'dialogIn')).toBe(true);
    const normal = ruleBody(`${MOTION}/motion.module.css`, '.dialogIn');
    expect(normal).toMatch(/animation:\s*dialogIn var\(--motion-slow\)/);
    const reduced = ruleBody(`${MOTION}/motion.module.css`, ":global([data-motion='reduced']) .dialogIn");
    expect(reduced).toMatch(/animation-name:\s*fade\b/);
    expect(reduced).toMatch(/animation-duration:\s*var\(--motion-quick\)/);
    expect(composedBy(overlayCss, 'dim').has('dimIn')).toBe(true);
  });
});

describe('BROW-3 overlay state', () => {
  function Probe() {
    return <span data-testid="probe">{String(useAnyOverlayOpen())}</span>;
  }

  it('BROW-3 useAnyOverlayOpen is true while a Dialog is mounted and false after', () => {
    const { rerender } = render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('false');
    rerender(
      <>
        <Probe />
        <Dialog title="Hi" onClose={() => undefined} actions={null} />
      </>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('true');
    rerender(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('false');
  });

  it('BROW-3 useAnyOverlayOpen is true while a Menu is open and false after it closes', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Probe />
        <Menu items={[{ label: 'Rename', onSelect: () => undefined }]}>
          <button type="button">Actions</button>
        </Menu>
      </>,
    );
    expect(screen.getByTestId('probe').textContent).toBe('false');
    await user.tab();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Rename' })).toBeTruthy();
    expect(screen.getByTestId('probe').textContent).toBe('true');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('false'));
  });
});

describe('Icons', () => {
  it('UI-6 every name in ICONS is 8 rows of 8 cells of # or .', () => {
    const names = Object.keys(ICONS);
    expect(names).toHaveLength(49);
    for (const name of names) {
      const rows: readonly string[] = ICONS[name as keyof typeof ICONS];
      expect(rows, name).toHaveLength(8);
      for (const row of rows) expect(row, name).toMatch(/^[#.]{8}$/);
    }
  });

  it('UI-6 the icon set holds the names the spec lists', () => {
    const specNames = [
      'files',
      'changes',
      'graph',
      'activity',
      'artifacts',
      'hud',
      'terminal',
      'browser',
      'settings',
      'search',
      'close',
      'add',
      'split-right',
      'split-down',
      'maximize',
      'chevron-right',
      'chevron-down',
      'folder',
      'folder-open',
      'file',
      'file-code',
      'file-markdown',
      'file-image',
      'git-branch',
      'arrow-up',
      'arrow-down',
      'sync',
      'check',
      'warning',
      'error',
      'info',
      'play',
      'stop',
      'star',
      'star-filled',
      'pin',
      'comment',
      'send',
      'history',
      'restore',
      'trash',
      'external',
      'copy',
      'agent',
      'subagent',
      'clock',
      'target',
      'refresh',
      'more',
    ];
    expect(Object.keys(ICONS).sort()).toEqual([...specNames].sort());
  });

  it('UI-6 Icon renders one rect per # of its grid and is hidden from screen readers', () => {
    const { container } = render(<Icon name="check" />);
    const lit = ICONS.check.join('').replaceAll('.', '').length;
    expect(lit).toBeGreaterThan(0);
    expect(container.querySelectorAll('rect')).toHaveLength(lit);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
