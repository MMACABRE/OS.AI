import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Badge,
  Button,
  IconButton,
  Kbd,
  NumberField,
  Select,
  StatusDot,
  Switch,
  TextField,
} from '@hsos/ui-kit';
import { COMPONENTS, composes } from './css-composes';

/** Radix positions the tooltip with a ResizeObserver; jsdom has none. */
class StillResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= StillResizeObserver;

afterEach(cleanup);

const css = (name: string) => `${COMPONENTS}/${name}.module.css`;

describe('UI-2 every control works with the keyboard alone', () => {
  it('UI-2 Button is reached with Tab and pressed with Enter and with Space', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Save</Button>);
    await user.tab();
    const button = screen.getByRole('button', { name: 'Save' });
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(onPress).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(composes(button, css('Button'), 'focusRing')).toBe(true);
  });

  it('UI-2 IconButton is reached with Tab and pressed with Enter and with Space', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<IconButton icon={<span>i</span>} label="Close" onPress={onPress} />);
    await user.tab();
    const button = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(composes(button, css('IconButton'), 'focusRing')).toBe(true);
  });

  it('UI-2 Switch is reached with Tab and toggles with Space', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch checked={on} onChange={setOn} label="Wrap lines" />;
    }
    render(<Harness />);
    await user.tab();
    const toggle = screen.getByRole('switch', { name: 'Wrap lines' });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.keyboard(' ');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(composes(toggle, css('Switch'), 'focusRing')).toBe(true);
  });

  it('UI-2 NumberField steps with ArrowUp and ArrowDown and clamps to min and max', async () => {
    const user = userEvent.setup();
    const seen: number[] = [];
    function Harness() {
      const [value, setValue] = useState(9);
      return (
        <NumberField
          label="Size"
          value={value}
          min={8}
          max={10}
          step={1}
          onChange={(next) => {
            seen.push(next);
            setValue(next);
          }}
        />
      );
    }
    render(<Harness />);
    await user.tab();
    const field = screen.getByRole('spinbutton', { name: 'Size' });
    expect(document.activeElement).toBe(field);
    await user.keyboard('{ArrowUp}');
    expect(field.getAttribute('aria-valuenow')).toBe('10');
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(field.getAttribute('aria-valuenow')).toBe('10');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(field.getAttribute('aria-valuenow')).toBe('8');
    expect(Math.max(...seen)).toBe(10);
    expect(Math.min(...seen)).toBe(8);
    expect(composes(field, css('NumberField'), 'focusRing')).toBe(true);
  });

  it('UI-2 NumberField clamps a typed value to max on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Size" value={14} min={8} max={40} step={1} onChange={onChange} />);
    const field = screen.getByRole('spinbutton', { name: 'Size' });
    await user.clear(field);
    await user.type(field, '400{Enter}');
    expect(onChange).toHaveBeenCalledWith(40);
  });

  it('UI-2 Select is reached with Tab, changes its value and carries the focus ring', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Select
        label="Shell"
        value="a"
        options={[
          { value: 'a', label: 'Alpha' },
          { value: 'b', label: 'Beta' },
        ]}
        onChange={onChange}
      />,
    );
    await user.tab();
    const select = screen.getByRole('combobox', { name: 'Shell' });
    expect(document.activeElement).toBe(select);
    // jsdom does not move a native select with the arrow keys, so the change itself is driven by selectOptions.
    await user.selectOptions(select, 'b');
    expect(onChange).toHaveBeenCalledWith('b');
    expect(composes(select, css('Select'), 'focusRing')).toBe(true);
  });

  it('UI-2 TextField takes typing, calls onChange and carries the focus ring', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextField label="Name" value="" onChange={onChange} />);
    await user.tab();
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(document.activeElement).toBe(input);
    await user.keyboard('hi');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith('i');
    expect(composes(input, css('TextField'), 'focusRing')).toBe(true);
  });
});

describe('UI-3 IconButton names itself', () => {
  it('UI-3 IconButton has the accessible name label and its tooltip shows the label and the Kbd on focus', async () => {
    const user = userEvent.setup();
    render(<IconButton icon={<span>i</span>} label="Open settings" keyBinding="Ctrl+," onPress={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeTruthy();
    await user.tab();
    expect((await screen.findAllByText('Open settings')).length).toBeGreaterThan(0);
    expect((await screen.findAllByLabelText('Ctrl+,')).length).toBeGreaterThan(0);
  });
});

describe('020 other base component rules', () => {
  it('UI-2 TextField with invalidMessage sets aria-invalid and shows the message with role alert', () => {
    render(<TextField label="Port" value="x" invalidMessage="Must be a number" onChange={() => undefined} />);
    expect(screen.getByRole('textbox', { name: 'Port' }).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Must be a number');
  });

  it('UI-2 TextField without invalidMessage is valid and shows no alert', () => {
    render(<TextField label="Port" value="1" onChange={() => undefined} />);
    expect(screen.getByRole('textbox', { name: 'Port' }).getAttribute('aria-invalid')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('P-43 StatusDot has role img and the label as its name', () => {
    render(<StatusDot tone="ok" label="Service ready" />);
    expect(screen.getByRole('img', { name: 'Service ready' })).toBeTruthy();
  });

  it('UI-2 Kbd renders Ctrl+K Ctrl+T as four key caps', () => {
    const { container } = render(<Kbd binding="Ctrl+K Ctrl+T" />);
    const caps = [...container.querySelectorAll('kbd')].map((cap) => cap.textContent);
    expect(caps).toEqual(['Ctrl', 'K', 'Ctrl', 'T']);
  });

  it('UI-2 Badge shows its text', () => {
    render(<Badge tone="warn" text="Beta" />);
    expect(screen.getByText('Beta')).toBeTruthy();
  });
});
