import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandDefinition } from '@hsos/contracts/module';
import {
  TERMINAL_ATTRIBUTE,
  createKeyDispatcher,
  resolveBindings,
} from '../../src/modules/ui-kit/keys/key-dispatcher';
import type { KeyDispatcher } from '../../src/modules/ui-kit/keys/key-dispatcher';
import { createFakeClock } from '../fakes/fake-clock';

const silent = { log: () => undefined };

type Defaults = Pick<CommandDefinition, 'id' | 'defaultKey' | 'global'>;

function setup(defs: readonly Defaults[], overrides: Record<string, string | null> = {}) {
  const clock = createFakeClock();
  const ran: string[] = [];
  const pending: (string | null)[] = [];
  const commands = new Map(
    defs.map(
      (def) => [def.id, { id: def.id, global: def.global, run: () => void ran.push(def.id) }] as const,
    ),
  );
  const dispatcher = createKeyDispatcher({
    target: window,
    clock,
    log: silent,
    command: (id) => commands.get(id),
    onPending: (part) => void pending.push(part),
  });
  dispatcher.setBindings(resolveBindings(defs, overrides).byKey);
  return { clock, ran, pending, dispatcher };
}

/** Presses a key on `target`; returns whether the page's default was left alone (false when prevented). */
function press(
  target: Element,
  init: { key: string; code: string; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean },
): boolean {
  return target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}
const ctrlB = { key: 'b', code: 'KeyB', ctrlKey: true };
const ctrlShiftP = { key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true };

let live: KeyDispatcher | null = null;
beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  live?.dispose();
  live = null;
});

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const element = document.body.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error('nothing mounted');
  return element;
}

describe('key dispatcher', () => {
  it('UI-21 inside an element with data-hsos-terminal only the global palette command runs', () => {
    const terminal = mount(`<div ${TERMINAL_ATTRIBUTE}><div id="inner" tabindex="0"></div></div>`);
    const inner = terminal.querySelector('#inner');
    if (inner === null) throw new Error('no inner');
    const { ran, dispatcher } = setup([
      { id: 'sidebar.toggle', defaultKey: 'Ctrl+B', global: false },
      { id: 'palette.open', defaultKey: 'Ctrl+Shift+P', global: true },
    ]);
    live = dispatcher;

    const notPrevented = press(inner, ctrlB);
    const prevented = !press(inner, ctrlShiftP);

    expect(ran).toEqual(['palette.open']);
    expect(notPrevented).toBe(true);
    expect(prevented).toBe(true);
  });

  it('UI-21 outside a terminal the non-global command runs too', () => {
    const plain = mount('<div tabindex="0"></div>');
    const { ran, dispatcher } = setup([{ id: 'sidebar.toggle', defaultKey: 'Ctrl+B', global: false }]);
    live = dispatcher;
    press(plain, ctrlB);
    expect(ran).toEqual(['sidebar.toggle']);
  });

  it('UI-22 with focus in an input only Ctrl+S runs, not F2', () => {
    const input = mount('<input type="text" />');
    const { ran, dispatcher } = setup([
      { id: 'files.rename', defaultKey: 'F2', global: false },
      { id: 'files.save', defaultKey: 'Ctrl+S', global: false },
    ]);
    live = dispatcher;

    press(input, { key: 'F2', code: 'F2' });
    press(input, { key: 's', code: 'KeyS', ctrlKey: true });

    expect(ran).toEqual(['files.save']);
  });

  it('UI-22 with focus on a button a bare key binding runs', () => {
    const button = mount('<button type="button">ok</button>');
    const { ran, dispatcher } = setup([{ id: 'files.rename', defaultKey: 'F2', global: false }]);
    live = dispatcher;
    press(button, { key: 'F2', code: 'F2' });
    expect(ran).toEqual(['files.rename']);
  });

  it('UI-23 a chord does not run when Ctrl+T comes 2 000 ms after Ctrl+K, and runs within 1 500 ms', () => {
    const plain = mount('<div tabindex="0"></div>');
    const { ran, clock, dispatcher, pending } = setup([
      { id: 'theme.pick', defaultKey: 'Ctrl+K Ctrl+T', global: false },
    ]);
    live = dispatcher;
    const ctrlK = { key: 'k', code: 'KeyK', ctrlKey: true };
    const ctrlT = { key: 't', code: 'KeyT', ctrlKey: true };

    press(plain, ctrlK);
    clock.advance(2_000);
    press(plain, ctrlT);
    expect(ran).toEqual([]);
    expect(pending.slice(1)).toEqual(['Ctrl+K', null]);

    press(plain, ctrlK);
    clock.advance(1_000);
    press(plain, ctrlT);
    expect(ran).toEqual(['theme.pick']);
  });

  it('UI-23 any other key after the first part cancels the chord', () => {
    const plain = mount('<div tabindex="0"></div>');
    const { ran, dispatcher } = setup([{ id: 'theme.pick', defaultKey: 'Ctrl+K Ctrl+T', global: false }]);
    live = dispatcher;
    press(plain, { key: 'k', code: 'KeyK', ctrlKey: true });
    press(plain, { key: 'x', code: 'KeyX', ctrlKey: true });
    press(plain, { key: 't', code: 'KeyT', ctrlKey: true });
    expect(ran).toEqual([]);
  });

  it('SET-18 a key whose command was set to null does nothing', () => {
    const plain = mount('<div tabindex="0"></div>');
    const { ran, dispatcher } = setup([{ id: 'sidebar.toggle', defaultKey: 'Ctrl+B', global: false }], {
      'sidebar.toggle': null,
    });
    live = dispatcher;
    press(plain, ctrlB);
    expect(ran).toEqual([]);
  });

  it('UI-20 after dispose no key runs a command', () => {
    const plain = mount('<div tabindex="0"></div>');
    const { ran, dispatcher } = setup([{ id: 'sidebar.toggle', defaultKey: 'Ctrl+B', global: false }]);
    dispatcher.dispose();
    press(plain, ctrlB);
    expect(ran).toEqual([]);
  });
});
