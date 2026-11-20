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
