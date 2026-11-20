import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TerminalSettings } from '@hsos/contracts/channels/terminal';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { ok } from '@hsos/contracts/result';
import { ToastProvider } from '@hsos/ui-kit';
import { SettingsScreen } from '../../src/modules/settings/panel/SettingsScreen';
import { SCREEN_SECTIONS } from '../../src/modules/settings/panel/SettingsScreen';
import { createStubBus } from '../fakes/stub-bus';

afterEach(cleanup);

function setup(overrides: Record<string, Record<string, unknown>> = {}) {
  const bus = createStubBus();
  bus.answer(settingsChannels.getSection, ({ moduleId }) => {
    const section = SCREEN_SECTIONS.find((entry) => entry.moduleId === moduleId);
    return ok({ ...(section?.defaults as Record<string, unknown>), ...(overrides[moduleId] ?? {}) });
  });
  bus.answer(settingsChannels.getProblems, () => ok([]));
  bus.answer(settingsChannels.setValue, () => ok({}));
  render(
    <ToastProvider>
      <SettingsScreen bus={bus} />
    </ToastProvider>,
  );
  return bus;
}

const nav = () => screen.getByRole('navigation', { name: 'Settings sections' });
const navItem = (title: string) => within(nav()).getByText(title).closest('button') as HTMLElement;
const rowOf = (label: string) => screen.getByText(label).closest('div[class*="row"]') as HTMLElement;

describe('settings screen, layout A (card 036 part 1)', () => {
  it('the section list shows each section with its number of keys, and none for key bindings and themes', async () => {
    setup();
    await screen.findByRole('region', { name: 'Appearance' });
    const count = (title: string) => within(navItem(title)).queryAllByText(/^\d+$/)[0]?.textContent ?? null;
    expect(count('Appearance')).toBe('4');
    expect(count('Files')).toBe('8');
    expect(count('Claude sessions')).toBe('2');
    expect(count('Dashboard')).toBe('2');
    expect(count('Key bindings')).toBeNull();
    expect(count('Themes')).toBeNull();
  });

  it('a changed key row has data-changed and a Reset link, an unchanged one has neither', async () => {
    const bus = setup({ terminal: { fontSize: 20 } });
    await userEvent.click(await screen.findByRole('button', { name: /^Terminal/ }));
    const changed = rowOf('Font size');
    expect(changed.hasAttribute('data-changed')).toBe(true);
    expect(within(changed).getByRole('button', { name: 'Reset' })).toBeTruthy();
    const unchanged = rowOf('Line height');
    expect(unchanged.hasAttribute('data-changed')).toBe(false);
    expect(within(unchanged).queryByRole('button', { name: 'Reset' })).toBeNull();
    await userEvent.click(within(changed).getByRole('button', { name: 'Reset' }));
    await waitFor(() =>
      expect(bus.payloadsOf(settingsChannels.setValue)).toContainEqual({
        moduleId: 'terminal',
        key: 'fontSize',
        value: 13,
      }),
    );
  });

  it('a schema with a description shows that text under its label', async () => {
    const fontSize = TerminalSettings.shape.fontSize;
    z.globalRegistry.add(fontSize, { description: 'How big the terminal text is.' });
    setup();
    await userEvent.click(await screen.findByRole('button', { name: /^Terminal/ }));
    const label = screen.getByText('Font size').parentElement as HTMLElement;
    expect(within(label).getByText('How big the terminal text is.')).toBeTruthy();
    expect(within(rowOf('Line height')).queryByText('How big the terminal text is.')).toBeNull();
  });
});
