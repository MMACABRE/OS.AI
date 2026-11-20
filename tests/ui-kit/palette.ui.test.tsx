import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { COMMAND_MODE, CommandPalette, ToastProvider, createCommandRegistry } from '@hsos/ui-kit';
import type { CommandRegistry, PaletteModeId } from '@hsos/ui-kit';

class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??= StillResizeObserver;
  Element.prototype.scrollIntoView ??= () => undefined;
});
afterEach(cleanup);

function command(id: string, title: string, run: () => void | Promise<void>) {
  return { id, title, defaultKey: null, global: false, run };
}

function Harness({
  registry,
  initialMode = COMMAND_MODE,
  keyFor = () => null,
}: {
  registry: CommandRegistry;
  initialMode?: PaletteModeId;
  keyFor?: (id: string) => string | null;
}) {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <input aria-label="Notes field" />
      <CommandPalette
        registry={registry}
        open={open}
        initialMode={initialMode}
        keyFor={keyFor}
        onClose={() => setOpen(false)}
      />
    </ToastProvider>
  );
}

describe('UI-13 running a command', () => {
  it('UI-13 a command that rejects with Boom closes the palette and shows an error toast Boom', async () => {
    const user = userEvent.setup();
    const registry = createCommandRegistry();
    registry.add(command('x.boom', 'Boom command', () => Promise.reject(new Error('Boom'))));
    render(<Harness registry={registry} />);
    await user.type(screen.getByRole('combobox'), 'boom');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    const toast = await screen.findByRole('alert');
    expect(toast.textContent).toContain('Boom');
  });

  it('UI-13 a resolving command runs once, closes the palette and is marked used', async () => {
    const user = userEvent.setup();
    const registry = createCommandRegistry();
    const run = vi.fn(() => Promise.resolve());
    registry.add(command('x.fine', 'Fine command', run));
    registry.add(command('x.other', 'Other command', () => undefined));
    render(<Harness registry={registry} />);
    await user.type(screen.getByRole('combobox'), 'fine');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    expect(run).toHaveBeenCalledTimes(1);
    expect(registry.recent()).toEqual(['x.fine']);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('UI-10 the list', () => {
  it('UI-10 lists every registered command with its effective key binding', () => {
    const registry = createCommandRegistry();
    registry.add(command('a.one', 'Alpha one', () => undefined));
    registry.add(command('b.two', 'Beta two', () => undefined));
    render(<Harness registry={registry} keyFor={(id) => (id === 'a.one' ? 'Ctrl+Shift+A' : null)} />);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Alpha oneCtrlShiftA', 'Beta two']);
    expect(options[0]?.querySelector('[aria-label="Ctrl+Shift+A"]')).not.toBeNull();
  });
});

describe('UI-14 focus returns', () => {
  it('UI-14 focus on a button, open the palette, Escape: focus is on the button again', async () => {
    const user = userEvent.setup();
    const registry = createCommandRegistry();
    registry.add(command('a.one', 'Alpha one', () => undefined));
    render(<Harness registry={registry} />);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    const button = screen.getByRole('button', { name: 'Open palette' });
    act(() => button.focus());
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('combobox')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('UI-14 focus in a text field, the palette opens and closes: the text field has focus again', async () => {
    const user = userEvent.setup();
    const registry = createCommandRegistry();
    registry.add(command('a.one', 'Alpha one', () => undefined));
    render(<Harness registry={registry} />);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    const field = screen.getByRole('textbox', { name: 'Notes field' });
    act(() => field.focus());
    act(() => screen.getByRole('button', { name: 'Open palette' }).click());
    expect(await screen.findByRole('combobox')).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(field));
  });
});

describe('UI-12 provider modes', () => {
  it('UI-12 a mode of prefix empty opened as initialMode lists its items; typing > switches to commands', async () => {
    const user = userEvent.setup();
    const registry = createCommandRegistry();
    registry.add(command('settings.open', 'Open Settings', () => undefined));
    registry.addMode({
      id: 'files',
      prefix: '',
      placeholder: 'Find a file',
      search: () => [{ id: 'f1', title: 'readme.md', run: () => undefined }],
    });
    render(<Harness registry={registry} initialMode="files" />);
    const input = await screen.findByRole('combobox');
    expect(input.getAttribute('placeholder')).toBe('Find a file');
    expect(await screen.findByText('readme.md')).toBeTruthy();
    await user.type(input, '>');
    await waitFor(() =>
      expect(screen.getByRole('combobox').getAttribute('placeholder')).toBe('Type a command'),
    );
    expect(screen.getByText('Open Settings')).toBeTruthy();
    expect(screen.queryByText('readme.md')).toBeNull();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
  });
});
