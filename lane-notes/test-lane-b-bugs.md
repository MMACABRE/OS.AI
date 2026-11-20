# Tester lane B: bugs and seams for the Lead

Tests moved out of the committed files because src (or a spec/row) is at fault. Not fixed here.

## SET-6 / settings screen (card 024): a typed number above max is clamped, not rejected
- Rule: spec/modules/settings.md "Settings screen": "Invalid input shows the schema's message under the control and saves nothing." untested.md 024 row 1: type 400 into the terminal font size, expect the schema's message and no `setValue` after 400 ms. (The row says max 40; `terminalSection` fontSize is `.min(8).max(32)`.)
- Code: `src/modules/ui-kit/components/NumberField.tsx:34-37` (`commit` does `tidy(clamp(next, min, max), step)`) used by `src/modules/settings/panel/schema-control.tsx:120` (the `number` branch). Typing 400 and pressing Enter (or blurring) commits 32, which passes the schema, so `onValid(32)` runs and `setValue` is sent with 32. No message is ever shown for a number.
- Decision for the Lead: either the screen should reject (show the message, save nothing) or the spec/row should say that a number field clamps. The test below follows the spec text.
- Observed failure: `TestingLibraryElementError: Unable to find an accessible element with the role "alert"` at the `getAllByRole('alert')` line (nothing is shown, and setValue is sent).
- Test to add back into tests/settings/settings-screen.ui.test.tsx inside `describe('P-32 and SET-6 invalid input on the settings screen', ...)`; it uses that file's helpers `openScreen`, `openSection`, `advance`, `SAVE_DELAY_MS`:
```tsx
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
```