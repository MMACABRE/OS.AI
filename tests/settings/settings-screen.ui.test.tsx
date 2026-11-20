import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import type { SettingsProblem } from '@hsos/contracts/channels/settings';
import { ok } from '@hsos/contracts/result';
import { zAbsPath } from '@hsos/contracts/schemas';
import { ToastProvider } from '@hsos/ui-kit';
import {
  SAVE_DELAY_MS,
  SCREEN_SECTIONS,
  SettingsScreen,
} from '../../src/modules/settings/panel/SettingsScreen';
import { fieldKindOf } from '../../src/modules/settings/panel/schema-control';
import { createFakeBus } from '../fakes/fake-bus';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type SetCall = { moduleId: string; key: string; value: unknown };

/** Lets the bus's microtasks and React's updates settle without moving the fake clock far. */
async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The settings screen over a fake bus that answers getSection, getProblems and setValue. */
async function openScreen(
  options: {
    stored?: Record<string, Record<string, unknown>>;
    problems?: SettingsProblem[];
  } = {},
) {
  vi.useFakeTimers();
  const bus = createFakeBus();
  const setCalls: SetCall[] = [];
  bus.handle(settingsChannels.getSection, ({ moduleId }) => {
    const section = SCREEN_SECTIONS.find((item) => item.moduleId === moduleId);
    return ok({ ...(section?.defaults as Record<string, unknown>), ...(options.stored?.[moduleId] ?? {}) });
  });
  bus.handle(settingsChannels.getProblems, () => ok(options.problems ?? []));
  bus.handle(settingsChannels.setValue, (payload) => {
    setCalls.push(payload);
    return ok({});
  });
  render(
    <ToastProvider>
      <SettingsScreen bus={bus} />
    </ToastProvider>,
  );
  await settle();
  return { bus, setCalls };
}

async function openSection(title: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
  await settle();
}

const fileA = zAbsPath.parse('C:\\Users\\x\\AppData\\Roaming\\HSOS\\settings\\settings.json');
const fileB = zAbsPath.parse('C:\\Users\\x\\AppData\\Roaming\\HSOS\\settings\\keybindings.json');

describe('P-32 and SET-6 invalid input on the settings screen', () => {
  it('SET-6 typing 400 into the terminal font size (max 32) shows the schema message and sends no setValue', async () => {
    const { setCalls } = await openScreen();
    await openSection('Terminal');
    const field = screen.getByRole('spinbutton', { name: 'Font size' });
    fireEvent.change(field, { target: { value: '400' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await advance(SAVE_DELAY_MS + 100);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(setCalls).toEqual([]);
  });

  it('P-32 invalid text in a field shows the schema message under the control and sends no setValue after 400 ms', async () => {
    const { setCalls } = await openScreen();
    await openSection('Terminal');
    const field = screen.getByRole('textbox', { name: 'Shell args' });
    fireEvent.change(field, { target: { value: '[1' } });
    await advance(SAVE_DELAY_MS + 100);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(setCalls).toEqual([]);
  });
});

describe('Reset', () => {
  it('SET-2 a Reset link appears only for a key whose value differs from its default', async () => {
    await openScreen({ stored: { terminal: { fontSize: 20 } } });
    await openSection('Terminal');
    const resets = screen.getAllByRole('button', { name: 'Reset' });
    expect(resets).toHaveLength(1);
    expect(resets[0]?.closest('[data-changed]')?.textContent).toContain('Font size');
  });

  it('SET-2 pressing Reset sends setValue with the default after 400 ms', async () => {
    const { setCalls } = await openScreen({ stored: { terminal: { fontSize: 20 } } });
    await openSection('Terminal');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await advance(SAVE_DELAY_MS - 1);
    expect(setCalls).toEqual([]);
    await advance(1);
    expect(setCalls).toEqual([{ moduleId: 'terminal', key: 'fontSize', value: 13 }]);
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('SET-2 with every value at its default no Reset link is shown', async () => {
    await openScreen();
    await openSection('Terminal');
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });
});

describe('the problems banner', () => {
  it('P-32 lists each problem from getProblems and from a problemsChanged event, each with Open file', async () => {
    const first: SettingsProblem = {
      file: fileA,
      path: 'values.terminal.fontSize',
      message: 'Expected a number',
    };
    const { bus } = await openScreen({ problems: [first] });
    const banner = screen.getByRole('alert');
    expect(banner.textContent).toContain('values.terminal.fontSize');
    expect(banner.textContent).toContain('Expected a number');
    expect(screen.getAllByRole('button', { name: 'Open file' })).toHaveLength(1);

    const second: SettingsProblem = { file: fileB, path: '', message: 'Not valid JSON' };
    bus.emit(settingsChannels.problemsChanged, [first, second]);
    await settle();
    expect(screen.getAllByRole('button', { name: 'Open file' })).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toContain('Not valid JSON');
  });

  it('P-32 shows no banner when there are no problems', async () => {
    await openScreen();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('saving', () => {
  it('SET-6 a valid edit is sent once, 400 ms after the last change', async () => {
    const { setCalls } = await openScreen();
    await openSection('Terminal');
    const field = screen.getByRole('spinbutton', { name: 'Font size' });
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    await advance(200);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    await advance(SAVE_DELAY_MS - 1);
    expect(setCalls).toEqual([]);
    await advance(1);
    expect(setCalls).toEqual([{ moduleId: 'terminal', key: 'fontSize', value: 15 }]);
    await advance(2000);
    expect(setCalls).toHaveLength(1);
  });
});

describe('fieldKindOf', () => {
  it('SET-6 gives boolean for z.boolean().default(true)', () => {
    expect(fieldKindOf('cursorBlink', z.boolean().default(true)).kind).toBe('boolean');
  });

  it('SET-6 gives enum with its options for z.enum', () => {
    expect(fieldKindOf('cursorStyle', z.enum(['block', 'bar', 'underline']).default('block'))).toMatchObject({
      kind: 'enum',
      options: ['block', 'bar', 'underline'],
    });
  });

  it('SET-6 gives number with min and max for z.number().int().min(8).max(40).default(14)', () => {
    expect(fieldKindOf('fontSize', z.number().int().min(8).max(40).default(14))).toMatchObject({
      kind: 'number',
      min: 8,
      max: 40,
    });
  });

  it('SET-6 gives path for zAbsPath.nullable().default(null)', () => {
    expect(fieldKindOf('vaultPath', zAbsPath.nullable().default(null))).toMatchObject({
      kind: 'path',
      nullable: true,
    });
  });

  it('SET-6 gives string for a plain string key', () => {
    expect(fieldKindOf('theme', z.string().default('Phosphor')).kind).toBe('string');
  });
});
