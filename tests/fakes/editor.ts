import { EditorView } from 'codemirror';

/** The CodeMirror view inside a rendered CodeView. */
export function editorIn(root: ParentNode = document): EditorView {
  const dom = root.querySelector<HTMLElement>('.cm-editor');
  const view = dom === null ? null : EditorView.findFromDOM(dom);
  if (view === null) throw new Error('No CodeMirror editor is rendered');
  return view;
}

/** Appends text at the end of the document, as typing would. */
export function typeAtEnd(view: EditorView, text: string): void {
  view.dispatch({ changes: { from: view.state.doc.length, insert: text } });
}

/** Presses Ctrl+S inside the editor's content element. */
export function pressSave(view: EditorView): void {
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true, cancelable: true }),
  );
}
