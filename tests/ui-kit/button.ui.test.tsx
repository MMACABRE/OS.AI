import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@hsos/ui-kit';

afterEach(cleanup);

describe('Button (ui-kit)', () => {
  it('UI-BTN-1 a pressed button announces aria-pressed true and takes the primary class', () => {
    render(
      <>
        <Button pressed onPress={() => undefined}>
          Pressed
        </Button>
        <Button pressed={false} onPress={() => undefined}>
          Not pressed
        </Button>
      </>,
    );
    const on = screen.getByRole('button', { name: 'Pressed' });
    const off = screen.getByRole('button', { name: 'Not pressed' });
    expect(on.getAttribute('aria-pressed')).toBe('true');
    expect(on.className).toMatch(/primary/);
    expect(off.getAttribute('aria-pressed')).toBe('false');
    expect(off.className).not.toMatch(/primary/);
  });
});
