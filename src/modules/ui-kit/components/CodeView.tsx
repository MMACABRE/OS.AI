import { useEffect, useRef } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { keymap } from '@codemirror/view';
import styles from './CodeView.module.css';

export type CodeViewProps = {
  readonly value: string;
  /** The file's language. No language packages are installed yet, so every file shows as plain text. */
  readonly language: string;
  readonly readOnly: boolean;
  readonly onChange?: (value: string) => void;
  /** Ctrl+S (Cmd+S) inside the editor. */
  readonly onSave?: () => void;
  /** Puts the cursor at the start of this line and centres it (FILE-78). */
  readonly revealLine?: number | null;
  readonly label: string;
};

/** The editor theme, built from the tokens (ui-kit.md): see-through, mono, the caret in the accent colour. */
const tokenTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--color-text-primary)', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 1px var(--color-accent)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-body)', lineHeight: '1.5' },
  '.cm-content': { caretColor: 'var(--color-accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--color-text-muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 30%, transparent)',
  },
});

/** A text editor or reader wrapping CodeMirror 6 (ui-kit.md `CodeView`). */
export function CodeView({ value, language, readOnly, onChange, onSave, revealLine = null, label }: CodeViewProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const handlers = useRef({ onChange, onSave });
  handlers.current = { onChange, onSave };

  useEffect(() => {
    const parent = host.current;
    if (parent === null) return undefined;
    const editor = new EditorView({
      doc: value,
      parent,
      extensions: [
        keymap.of([
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              handlers.current.onSave?.();
              return handlers.current.onSave !== undefined;
            },
          },
        ]),
        basicSetup,
        tokenTheme,
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) handlers.current.onChange?.(update.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // `value` is applied by the next effect; a new editor only when it becomes read-only or editable.
  }, [readOnly, label]);

  // A new value from outside (a reload) replaces the text and keeps the cursor line and scroll (FILE-73);
  // typing does not come back here as a change.
  useEffect(() => {
    const editor = view.current;
    if (editor === null || editor.state.doc.toString() === value) return;
    const lineNumber = editor.state.doc.lineAt(editor.state.selection.main.head).number;
    const scrollTop = editor.scrollDOM.scrollTop;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    const line = editor.state.doc.line(Math.min(lineNumber, editor.state.doc.lines));
    editor.dispatch({ selection: { anchor: line.from } });
    editor.scrollDOM.scrollTop = scrollTop;
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (editor === null || revealLine === null) return;
    const line = editor.state.doc.line(Math.min(Math.max(1, revealLine), editor.state.doc.lines));
    editor.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    editor.focus();
  }, [revealLine]);

  return <div ref={host} className={styles.code} data-language={language} />;
}
