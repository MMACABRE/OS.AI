# Test lane C: bugs found and rows needing a seam

Each entry: rule, src location, spec, code, test, failure.

## BUG: FILE-61 / FILE-43 - FilesTree ignores files.rescanNeeded

- Test file to add the test to: `tests/files/files-tree.ui.test.tsx`
- Src: src/modules/files/panel/FilesTree.tsx (only subscribes to filesChannels.changed, around the useEffect with bus.on)
- Spec says: untested.md 030: files.rescanNeeded makes the root reload (FILE-43: "The watcher lost events. Consumers reload everything they show").
- Code does: No subscription to filesChannels.rescanNeeded anywhere under src (grep finds none), so nothing reloads.
- Failure: AssertionError: expected 1 to be 2 (listDir call count stayed at 1 after emit of files.rescanNeeded; waitFor timed out). Needs helper tests/fakes/stub-bus.ts, fakes/fixtures.ts.

Test code:

```tsx
  it('FILE-61 reloads the root when the watcher lost events (rescanNeeded)', async () => {
    const { bus } = setup({ [PROJECT.path]: [dirEntry('a.txt')] });
    await screen.findByRole('treeitem', { name: 'a.txt' });
    const before = bus.payloadsOf(filesChannels.listDir).length;
    act(() => {
      bus.emit(filesChannels.rescanNeeded, {});
    });
    await waitFor(() => expect(bus.payloadsOf(filesChannels.listDir).length).toBe(before + 1));
    expect(listDirCalls(bus).at(-1)).toBe(PROJECT.path);
    expect(screen.queryByRole('alert')).toBeNull();
  });
```

## BUG: HIST-41 - diffRows shows a phantom removed empty line when the old text is empty

- Test file to add the test to: `tests/ui-kit/diff-rows.test.ts`
- Src: src/modules/ui-kit/components/diff-rows.ts, diffRows (before.split('\n') on an empty string gives [''])
- Spec says: untested.md 030 (line-diff rows): before empty, after `a` gives one `added a`. Timeline uses text '' for a file with no earlier version.
- Code does: Returns [removed "" (1/null), added "a" (null/1)]: an extra removed blank line. Same for the opposite direction (text to empty) and for new-file diffs in history and review.
- Failure: AssertionError: expected [ [ 'removed', '', 1, null ], …(1) ] to deeply equal [ [ 'added', 'a', null, 1 ] ]. (The test file also imports DiffRow type from diff-rows.)

Test code:

```tsx
  it('HIST-41 a text against an empty one is one added line', () => {
    const rows = diffRows('', 'a');
    expect(rows).not.toBeNull();
    const changed = (rows ?? []).filter((row) => row.kind !== 'same');
    expect(view(changed)).toEqual([['added', 'a', null, 1]]);
  });
```

## BUG: REV-21 / REV-22 - F7 stops on both the removed and the added row of one replaced line

- Test file to add the test to: `tests/ui-kit/views.ui.test.tsx`
- Src: src/modules/ui-kit/components/DiffView.tsx, onKeyDown (changed = every non-same row index; F7 picks the next such row)
- Spec says: review.md REV-22: F7 and Shift+F7 move to the next and previous change; untested.md (ui-kit views) "three changes: F7 three times then Shift+F7 -> change 1, 2, 3, then 2". A replaced line (removed + added) is one change.
- Code does: Visits removed then added row of the same replaced line (2 stops per replaced line). With three pure additions it is correct. If the Lead reads "change" as "changed row", drop this entry.
- Failure: AssertionError: expected '2+B' to match /d$/ (second F7 lands on the added row of the first replaced line instead of the second change)

Test code:

```tsx
  it('REV-21 F7 treats a replaced line (removed plus added) as one change', () => {
    const before = ['a1', 'b', 'a2', 'a3', 'd', 'a4', 'a5', 'f', 'a6'].join('\n');
    const after = ['a1', 'B', 'a2', 'a3', 'D', 'a4', 'a5', 'F', 'a6'].join('\n');
    render(<DiffView before={before} after={after} />);
    const region = screen.getByRole('region', { name: 'Diff' });
    region.focus();
    const press = (shiftKey: boolean) => fireEvent.keyDown(document.activeElement ?? region, { key: 'F7', shiftKey });
    press(false);
    expect(activeRow()).toMatch(/b$/);
    press(false);
    expect(activeRow()).toMatch(/d$/);
    press(false);
    expect(activeRow()).toMatch(/f$/);
    press(true);
    expect(activeRow()).toMatch(/d$/);
  });
```

## BUG: UI-MENU-1 (root cause of HUD-1 menu, HUD-34, HUD-37 in 031) - a Menu cannot open from an IconButton

- Test file to add the test to: `tests/ui-kit/menu-trigger.ui.test.tsx`
- Src: src/modules/ui-kit/components/IconButton.tsx (declares fixed props only and renders its own <button> inside a Tooltip) used as the child of Menu (Menu.tsx wraps it in Radix Trigger asChild)
- Spec says: ui-kit.md Menu: dropdown opens from the trigger on press. hud.md HUD-1 (section menu), HUD-34/HUD-37 (row menu) use an IconButton as the trigger (SessionsSection.tsx SessionsMenu, SkillsSection.tsx "More for <name>").
- Code does: Radix Trigger asChild passes onPointerDown, onKeyDown, aria-haspopup, ref and data-state to the IconButton component, which drops every prop it does not declare, so the menu never opens. A plain <button> trigger works (the quick bar "More" menu passes). So the Sessions section menu and every skill row menu are dead in the app.
- Failure: TestingLibraryElementError: Unable to find role="menuitem" and name "Do it" (UI-MENU-1); same error for the HUD tests below. Fix: IconButton must forward rest props and ref to its <button> (forwardRef), or Menu must use a different trigger wrapper. Test UI-MENU-1 is in tests/ui-kit/menu-trigger.ui.test.tsx as a failing test moved here; add it back after the fix.

Test code:

```tsx
  it('UI-MENU-1 a Menu opens from an IconButton trigger', async () => {
    const onSelect = vi.fn();
    render(
      <Menu items={[{ label: 'Do it', onSelect }]}>
        <IconButton icon={<Icon name="more" />} label="More" onPress={() => undefined} />
      </Menu>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Do it' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
```

## BUG: HUD-1 - "Show all projects" menu cannot be opened

- Test file to add the test to: `tests/hud/hud.ui.test.tsx`
- Src: src/modules/hud/panel/SessionsSection.tsx SessionsMenu (IconButton inside Menu)
- Spec says: A toggle in the section menu, "Show all projects", lists every session.
- Code does: Menu does not open: root cause UI-MENU-1 (IconButton as Menu trigger).
- Failure: TestingLibraryElementError: Unable to find role="menuitem" and name "Show all projects"

Test code:

```tsx
  it('HUD-1 the section menu item "Show all projects" lists every session', async () => {
    renderHud(
      <>
        <SessionsMenu />
        <SessionsBoard />
      </>,
    );
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
    expect(screen.queryByText('elsewhere')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sessions menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Show all projects' }));
    expect(screen.getByText('elsewhere')).toBeTruthy();
    expect(screen.getByText('in project')).toBeTruthy();
    expect(screen.getByText('in worktree')).toBeTruthy();
  });
```

## BUG: HUD-34 - skill row menu cannot be opened

- Test file to add the test to: `tests/hud/hud.ui.test.tsx`
- Src: src/modules/hud/panel/SkillsSection.tsx menuFor + IconButton "More for <name>"
- Spec says: HUD-34: the row menu has "Show in folder", which calls shell.revealInExplorer with the file.
- Code does: Menu does not open: root cause UI-MENU-1.
- Failure: TestingLibraryElementError: Unable to find role="menuitem" and name "Show in folder"

Test code:

```tsx
  it('HUD-34 the row menu "Show in folder" reveals the skill file', async () => {
    seedHud({ skills: { kind: 'ready', value: [skill('a')] } });
    const { bus } = renderHud(<SkillsDeck />);
    bus.answer(shellChannels.revealInExplorer, () => ok({}));
    await userEvent.click(screen.getByRole('button', { name: 'More for a' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Show in folder' }));
    expect(bus.payloadsOf(shellChannels.revealInExplorer)).toEqual([{ path: skill('a').file }]);
  });
```

## BUG: HUD-36 / HUD-37 - locked skill menu cannot be opened

- Test file to add the test to: `tests/hud/hud.ui.test.tsx`
- Src: src/modules/hud/panel/SkillsSection.tsx menuFor
- Spec says: A stateLock disables the state choices and shows its reason (SKILL-9).
- Code does: Menu does not open: root cause UI-MENU-1. (Also noted, not tested: with stateSource default, "For this project only" calls setState with the current state, not the chosen one; hud.md HUD-37 test row expects setState({ name, state: user-invocable-only, scope: project-local }).)
- Failure: TestingLibraryElementError: Unable to find role="menuitem" and name /You only/

Test code:

```tsx
  it('HUD-37 a policy-locked skill disables its state choices and shows the reason', async () => {
    seedHud({ skills: { kind: 'ready', value: [skill('a', { state: 'off', stateLock: 'policy', stateSource: 'policy' })] } });
    renderHud(<SkillsDeck />);
    await userEvent.click(screen.getByRole('button', { name: 'More for a' }));
    const choice = await screen.findByRole('menuitem', { name: /You only/ });
    expect(choice.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Set by your organisation policy.')).toBeTruthy();
  });
```

## BUG: HUD-65 - Compact dialog: Cancel does not get focus

- Test file to add the test to: `tests/hud/hud.ui.test.tsx`
- Src: src/modules/hud/panel/QuickBar.tsx, compact Dialog initialFocus (querySelector("[data-hud-cancel]") returns the wrapping <span>, whose focus() does nothing; the clear dialog correctly uses "[data-hud-cancel] button")
- Spec says: HUD-65: "Cancel" has focus when the dialog opens.
- Code does: Focus stays on the Compact chip behind the dialog (Radix auto-focus is prevented because initialFocus returned a non-null element).
- Failure: AssertionError: expected <button class="_button_...">Cancel</button> to be <button class="_chip_...">Compact</button> (document.activeElement is the Compact chip)

Test code:

```tsx
  it('HUD-65 the compact dialog opens with Cancel focused', async () => {
    withTarget();
    renderHud(<QuickBar onSearchSkills={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Compact$/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Compact this conversation?' });
    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' })));
  });
```
