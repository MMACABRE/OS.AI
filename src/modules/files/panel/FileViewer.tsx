import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { filesChannels } from '@hsos/contracts/channels/files';
import type { FileContent, FileVersion } from '@hsos/contracts/channels/files';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { AbsPath } from '@hsos/contracts/ids';
import { Button, CodeView, DiffView, MarkdownView, PanelFrame, StatusDot, Switch, useToast } from '@hsos/ui-kit';
import type { PanelViewState } from '@hsos/ui-kit';
import { baseName, formatBytes } from './helpers';
import styles from './FileViewer.module.css';

type View =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly content: FileContent };

/** What the bar above the editor explains: the file changed on disk, or was deleted (FILE-74, FILE-75). */
type Conflict = 'changed' | 'deleted' | null;

export type FileViewerProps = {
  readonly bus: Bus;
  readonly path: AbsPath;
  /** Places the cursor on this line and centres it (FILE-78). */
  readonly line: number | null;
  readonly openHistory: (path: AbsPath) => void;
  /** FILE-79: a markdown link was activated. */
  readonly openLink: (href: string, from: AbsPath) => void;
  /** FILE-70: markdown files start in preview when this is on. */
  readonly markdownPreviewFirst: boolean;
};

const isMarkdown = (path: string) => /\.mdx?$/i.test(path);
const extensionOf = (path: string) => path.slice(path.lastIndexOf('.') + 1).toLowerCase();

/** The file viewer (dock panel `files.viewer`): one file, edited in place and saved with Ctrl+S (FILE-70 to FILE-75). */
export function FileViewer({ bus, path, line, openHistory, openLink, markdownPreviewFirst }: FileViewerProps) {
  const toast = useToast();
  const name = baseName(path);
  const [view, setView] = useState<View>({ status: 'loading' });
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('');
  const [version, setVersion] = useState<FileVersion | null>(null);
  const [conflict, setConflict] = useState<Conflict>(null);
  const [preview, setPreview] = useState(markdownPreviewFirst && isMarkdown(path));
  /** FILE-74 "Compare": the text on disk, shown against the buffer until closed. */
  const [diskText, setDiskText] = useState<string | null>(null);
  const [revealLine, setRevealLine] = useState<number | null>(null);
  const placedLine = useRef<number | null>(null);
  const saving = useRef(false);
  const pathRef = useRef(path);
  pathRef.current = path;
  const dirty = draft !== saved;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const read = (silent: boolean) => {
    if (!silent) setView({ status: 'loading' });
    const asked = path;
    void bus.call(filesChannels.read, { path }).then((result) => {
      if (asked !== pathRef.current) return;
      if (!result.ok) {
        // A failed silent reload keeps the clean buffer on screen.
        if (!silent) setView({ status: 'error', message: result.error.message });
        return;
      }
      const content = result.value;
      setView({ status: 'ready', content });
      setVersion(content.version);
      if (content.kind === 'text') {
        setDraft(content.text);
        setSaved(content.text);
      }
      setConflict(null);
      setDiskText(null);
    });
  };

  useEffect(() => {
    placedLine.current = null;
    read(false);
    // `read` reads only `bus` and `path`, which are the dependencies here.
  }, [bus, path]);

  // FILE-73: a clean buffer reloads silently; a dirty one only shows the bar (FILE-74).
  useEffect(
    () =>
      bus.on(filesChannels.changed, ({ changes }) => {
        for (const change of changes) {
          if (change.path !== path) continue;
          if (change.kind === 'deleted') setConflict('deleted');
          else if (dirtyRef.current) setConflict('changed');
          else read(true);
        }
      }),
    [bus, path],
  );

  // FILE-78: a line from the caller puts the cursor there and centres it, once per open.
  useEffect(() => {
    if (view.status !== 'ready' || line === null || placedLine.current === line) return;
    placedLine.current = line;
    setPreview(false);
    setRevealLine(line);
  }, [view.status, line]);

  const save = (options: { readonly overwrite: boolean; readonly recreate?: boolean }) => {
    if (view.status !== 'ready') return;
    const content = view.content;
    if (content.kind !== 'text') return;
    if (saving.current) return;
    saving.current = true;
    const text = draft;
    void bus.call(filesChannels.save, {
      path,
      content: text,
      format: content.format,
      baseHash: options.recreate === true ? null : (version?.hash ?? null),
      overwrite: options.overwrite,
    }).then((result) => {
      saving.current = false;
      if (result.ok) {
        setSaved(text);
        setVersion(result.value);
        setConflict(null);
        return;
      }
      if (result.error.code === 'FILE_CHANGED_ON_DISK') {
        const deleted = (result.error.details as { readonly deleted?: boolean } | undefined)?.deleted === true;
        setConflict(deleted ? 'deleted' : 'changed');
        return;
      }
      toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  // FILE-70: Ctrl+Shift+V switches a markdown file between preview and source.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isMarkdown(path) || !event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'v') return;
    event.preventDefault();
    setPreview((current) => !current);
  };

  const compare = () =>
    void bus.call(filesChannels.read, { path }).then((result) => {
      if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
      else if (result.value.kind !== 'text') toast.show({ message: 'The file on disk is not text.', tone: 'info' });
      else setDiskText(result.value.text);
    });

  const reveal = () => void bus.call(shellChannels.revealInExplorer, { path });

  const frame: PanelViewState =
    view.status === 'loading'
      ? { kind: 'loading', label: `Opening ${name}` }
      : view.status === 'error'
        ? {
            kind: 'error',
            message: `This file could not be opened. ${view.message}`,
            onRetry: () => read(false),
          }
        : { kind: 'ready' };

  const content = view.status === 'ready' ? view.content : null;
  return (
    <PanelFrame
      title={name}
      state={frame}
      actions={
        <>
          {dirty ? <StatusDot tone="warn" label="Unsaved changes" /> : null}
          {content?.kind === 'text' && isMarkdown(path) ? (
            <Switch checked={preview} onChange={setPreview} label="Preview" />
          ) : null}
          {content?.kind === 'text' && dirty ? (
            <Button size="small" onPress={() => save({ overwrite: false })}>
              Save
            </Button>
          ) : null}
          <Button size="small" variant="ghost" onPress={() => openHistory(path)}>
            History
          </Button>
        </>
      }
    >
      {content === null ? null : content.kind === 'text' ? (
        <div className={styles.body} onKeyDown={onKeyDown}>
          {conflict === null ? null : (
            <div role="alert" className={styles.bar}>
              {conflict === 'deleted' ? (
                <>
                  <span>This file was deleted.</span>
                  <Button size="small" onPress={() => save({ overwrite: false, recreate: true })}>
                    Save to recreate
                  </Button>
                  <Button size="small" variant="ghost" onPress={() => setConflict(null)}>
                    Close
                  </Button>
                </>
              ) : (
                <>
                  <span>This file changed on disk.</span>
                  {diskText === null ? (
                    <Button size="small" onPress={compare}>
                      Compare
                    </Button>
                  ) : (
                    <Button size="small" variant="ghost" onPress={() => setDiskText(null)}>
                      Back to editor
                    </Button>
                  )}
                  <Button size="small" onPress={() => read(false)}>
                    Reload from disk
                  </Button>
                  <Button size="small" variant="danger" onPress={() => save({ overwrite: true })}>
                    Overwrite
                  </Button>
                </>
              )}
            </div>
          )}
          {diskText !== null ? (
            <DiffView before={diskText} after={draft} label={`${name} on disk against your changes`} />
          ) : preview ? (
            <MarkdownView source={draft} onLinkActivate={(href) => openLink(href, path)} />
          ) : (
            <CodeView
              value={draft}
              language={extensionOf(path)}
              readOnly={false}
              onChange={setDraft}
              onSave={() => save({ overwrite: false })}
              revealLine={revealLine}
              label={`Edit ${name}`}
            />
          )}
        </div>
      ) : (
        <div className={styles.notice}>
          {content.kind === 'binary' ? <p>This file is not text.</p> : null}
          {content.kind === 'too-large' ? <p>This file is too large to edit here.</p> : null}
          {content.kind === 'image' ? <p>Image preview is not in this build.</p> : null}
          <p className={styles.muted}>{formatBytes(content.version.size)}</p>
          <Button onPress={reveal}>Reveal in Explorer</Button>
        </div>
      )}
    </PanelFrame>
  );
}
