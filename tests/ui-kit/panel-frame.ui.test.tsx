import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFrame, SKELETON_DELAY_MS, UiKitActionsContext } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function frame(state: PanelViewState) {
  return (
    <PanelFrame title="Files" state={state}>
      <p>child content</p>
    </PanelFrame>
  );
}

describe('P-40 PanelFrame draws the four states', () => {
  it('P-40 loading shows nothing for 150 ms, then the loading line, and no children', () => {
    vi.useFakeTimers();
    expect(SKELETON_DELAY_MS).toBe(150);
    render(frame({ kind: 'loading', label: 'Indexing files' }));
    expect(screen.queryByText('Indexing files')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.queryByText('Indexing files')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Indexing files')).toBeTruthy();
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('P-40 empty shows the title, the message and the action button, and no children', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      frame({
        kind: 'empty',
        title: 'No files',
        message: 'Open a folder to see files.',
        action: { label: 'Open folder', onPress },
      }),
    );
    expect(screen.getByText('No files')).toBeTruthy();
    expect(screen.getByText('Open a folder to see files.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Open folder' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('P-40 error shows the message, Retry calls onRetry, Show log calls openLog, the frame has the error class', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const openLog = vi.fn();
    const { container } = render(
      <UiKitActionsContext.Provider value={{ openLog }}>
        {frame({ kind: 'error', message: 'Watcher died', onRetry })}
      </UiKitActionsContext.Provider>,
    );
    expect(screen.getByText('Watcher died')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Show log' }));
    expect(openLog).toHaveBeenCalledTimes(1);
    const section = container.querySelector('section');
    expect(section?.className).toMatch(/_error_/);
    expect(screen.queryByText('child content')).toBeNull();
  });

  it('P-40 ready renders the children and none of the other states', () => {
    const { container } = render(frame({ kind: 'ready' }));
    expect(screen.getByText('child content')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('section')?.className).not.toMatch(/_error_/);
  });

  it('P-40 a frame that is not in the error state has no error class', () => {
    const { container } = render(frame({ kind: 'empty', message: 'Nothing' }));
    expect(container.querySelector('section')?.className).not.toMatch(/_error_/);
  });
});
