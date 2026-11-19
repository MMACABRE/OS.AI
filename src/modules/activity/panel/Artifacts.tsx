import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { activityChannels } from '@hsos/contracts/channels/activity';
import type { Artifact } from '@hsos/contracts/channels/activity';
import type { CommentTarget } from '@hsos/contracts/channels/review';
import { shellChannels } from '@hsos/contracts/channels/shell';
import type { AbsPath, ProjectId } from '@hsos/contracts/ids';
import { Icon, Menu, PanelFrame, TextField, useToast } from '@hsos/ui-kit';
import type { IconName, MenuItem, PanelViewState } from '@hsos/ui-kit';
import { relativeTime } from './format';
import { PinDialog } from './PinDialog';
import { useProject } from './use-project';
import styles from './Artifacts.module.css';

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly Artifact[] }
  | { readonly status: 'error'; readonly message: string };

/** How long the search waits after the last key (ACT-33). */
const SEARCH_DEBOUNCE_MS = 300;

/** The icon of each kind; images have no thumbnail until the app serves local files (ACT-30). */
const KIND_ICON: Record<Artifact['kind'], IconName> = { html: 'file-code', pdf: 'file', image: 'file-image', video: 'play' };

export type ArtifactsProps = {
  readonly bus: Bus;
  readonly openFile: (path: AbsPath) => void;
};

/** Artifacts (side view `activity.artifacts`, ACT-30 to ACT-33): the pages, PDFs and images Claude made, as tiles. */
export function Artifacts({ bus, openFile }: ArtifactsProps) {
  const toast = useToast();
  const project = useProject(bus);
  const projectId: ProjectId | null = project?.id ?? null;
  const [query, setQuery] = useState('');
  // ACT-33: the list filters as typed, but asks 300 ms after the last key.
  const [asked, setAsked] = useState('');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reload, setReload] = useState(0);
  const [pinning, setPinning] = useState<CommentTarget | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setAsked(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // A different project starts empty: no old tiles, search or open menu dialog.
  useEffect(() => {
    setQuery('');
    setAsked('');
    setState({ status: 'loading' });
    setPinning(null);
  }, [projectId]);

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    void bus.call(activityChannels.listArtifacts, { projectId, query: asked }).then((result) => {
      if (!live) return;
      setState(result.ok ? { status: 'ready', items: result.value } : { status: 'error', message: result.error.message });
    });
    return () => {
      live = false;
    };
  }, [bus, projectId, asked, reload]);

  useEffect(() => bus.on(activityChannels.artifactsChanged, () => setReload((count) => count + 1)), [bus]);

  // ACT-31: an image opens in a file viewer; a page, PDF or video opens in the system's program.
  const open = (artifact: Artifact) => {
    if (artifact.kind === 'image') openFile(artifact.path);
    else
      void bus.call(shellChannels.openPath, { path: artifact.path }).then((result) => {
        if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
      });
  };

  const menuFor = (artifact: Artifact): MenuItem[] => [
    { label: 'Open', icon: 'external', onSelect: () => open(artifact) },
    { label: 'Reveal in Explorer', icon: 'folder', onSelect: () => void bus.call(shellChannels.revealInExplorer, { path: artifact.path }) },
    { label: 'Copy Path', icon: 'copy', onSelect: () => void bus.call(shellChannels.writeClipboard, { text: artifact.path }) },
    { label: 'Pin Comment', icon: 'pin', onSelect: () => setPinning({ kind: 'artifact', path: artifact.path }) },
    { separator: true },
    {
      label: 'Remove from Inbox',
      icon: 'trash',
      danger: true,
      onSelect: () => {
        void bus.call(activityChannels.dismissArtifact, { path: artifact.path }).then((result) => {
          if (!result.ok) toast.show({ message: result.error.message, tone: 'error' });
        });
      },
    },
  ];

  const frame: PanelViewState =
    project === undefined
      ? { kind: 'loading', label: 'Reading artifacts' }
      : project === null
        ? { kind: 'empty', title: 'No project open', message: 'Open a project to see its artifacts.' }
        : state.status === 'loading'
          ? { kind: 'loading', label: 'Reading artifacts' }
          : state.status === 'error'
            ? { kind: 'error', message: `Artifacts could not be read. ${state.message}`, onRetry: () => setReload((count) => count + 1) }
            : state.items.length === 0 && query === ''
              ? { kind: 'empty', message: 'Pages, PDFs and images Claude makes in this project appear here.' }
              : { kind: 'ready' };

  return (
    <>
    <PanelFrame title="Artifacts" state={frame}>
      <div className={styles.column}>
        <TextField value={query} onChange={setQuery} placeholder="Search by path" label="Search artifacts" />
        {state.status === 'ready' && state.items.length === 0 ? (
          <p className={styles.muted}>No artifact matches.</p>
        ) : (
          <div className={styles.grid} aria-label="Artifacts">
            {state.status === 'ready'
              ? state.items.map((artifact) => {
                  const name = artifact.relPath.slice(artifact.relPath.lastIndexOf('/') + 1);
                  return (
                    <Menu key={artifact.path} kind="context" items={menuFor(artifact)}>
                      <button type="button" className={styles.tile} onClick={() => open(artifact)}>
                        <span className={styles.thumb}>
                          <Icon name={KIND_ICON[artifact.kind]} size={24} />
                        </span>
                        <span className={styles.name}>{name}</span>
                        <span className={styles.meta}>
                          {`${relativeTime(artifact.modifiedAt)} · ${artifact.sessionTitle ?? 'Outside'}`}
                        </span>
                      </button>
                    </Menu>
                  );
                })
              : null}
          </div>
        )}
      </div>
    </PanelFrame>
    {pinning === null || projectId === null ? null : (
      <PinDialog bus={bus} projectId={projectId} target={pinning} onClose={() => setPinning(null)} />
    )}
    </>
  );
}
