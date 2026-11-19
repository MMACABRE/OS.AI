import { useEffect, useMemo, useRef, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { filesChannels } from '@hsos/contracts/channels/files';
import type { DirEntry } from '@hsos/contracts/channels/files';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { toAbsPath } from '@hsos/contracts/ids';
import type { AbsPath } from '@hsos/contracts/ids';
import { Button, ConfirmDialog, Dialog, Icon, Menu, PanelFrame, TextField, Tree, useToast } from '@hsos/ui-kit';
import type { IconName, MenuItem, PanelViewState, TreeNode } from '@hsos/ui-kit';
import { baseName, cls, iconFor, joinPath, parentOf } from './helpers';
import { useProject } from './use-project';
import styles from './FilesTree.module.css';

/** What one folder holds, as far as the tree knows (FILE-60). */
type Listing =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly entries: readonly DirEntry[] }
  | { readonly status: 'error'; readonly message: string };

export type FilesTreeProps = {
  readonly bus: Bus;
  /** Reads `files.confirmTrash` now, so the setting applies without a reload. */
  readonly confirmTrash: () => boolean;
  readonly openFile: (path: AbsPath) => void;
  readonly showHistory: (path: AbsPath) => void;
};

/** Builds the tree from the folders loaded so far; a folder not loaded yet is expandable but empty. */
function buildNodes(dir: string, listings: ReadonlyMap<string, Listing>, index: Map<string, DirEntry>): TreeNode[] {
  const listing = listings.get(dir);
  if (listing?.status !== 'ready') return [];
  return listing.entries.map((entry) => {
    const id = joinPath(dir, entry.name);
    index.set(id, entry);
    return { id, text: entry.name, children: entry.kind === 'dir' ? buildNodes(id, listings, index) : null };
  });
}

/** The Files view (side view `files.tree`): the project's folders and files, lazily loaded (FILE-60, FILE-61). */
export function FilesTree({ bus, confirmTrash, openFile, showHistory }: FilesTreeProps) {
  const project = useProject(bus);
  const toast = useToast();
  const root = project?.path ?? null;
  const [listings, setListings] = useState<ReadonlyMap<string, Listing>>(new Map());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [trashing, setTrashing] = useState<AbsPath | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Counts project switches, so a listing that arrives after a switch is dropped.
  const epoch = useRef(0);
  const known = useRef<ReadonlySet<string>>(new Set());
  known.current = new Set(listings.keys());

  /** Reads a folder. A folder already shown keeps its entries while it is read again, so the tree never blinks. */
  const load = (dir: string) => {
    const mine = epoch.current;
    setListings((current) =>
      current.get(dir)?.status === 'ready' ? current : new Map(current).set(dir, { status: 'loading' }),
    );
    void bus.call(filesChannels.listDir, { dir: toAbsPath(dir) }).then((result) => {
      if (mine !== epoch.current) return;
      setListings((current) => {
        if (!result.ok && current.get(dir)?.status === 'ready') return current;
        const listing: Listing = result.ok
          ? { status: 'ready', entries: result.value }
          : { status: 'error', message: result.error.message };
        return new Map(current).set(dir, listing);
      });
    });
  };

  // A new project starts with its root folder loaded and nothing expanded.
  useEffect(() => {
    epoch.current += 1;
    setExpanded(new Set());
    setSelected(null);
    setListings(new Map());
    if (root !== null) load(root);
  }, [bus, root]);

  // FILE-61: a batch reloads only the folders that are loaded and affected.
  useEffect(
    () =>
      bus.on(filesChannels.changed, ({ changes }) => {
        const dirs = new Set(changes.map((change) => parentOf(change.path)));
        // Every folder that has been read is read again, collapsed or not, so none shows stale entries.
        for (const dir of dirs) if (dir === root || known.current.has(dir)) load(dir);
      }),
    [bus, root],
  );

  const { nodes, index } = useMemo(() => {
    const found = new Map<string, DirEntry>();
    const tree = root === null ? [] : buildNodes(root, listings, found);
    return { nodes: tree, index: found };
  }, [root, listings]);

  const toggle = (id: string) => {
    if (expanded.has(id)) {
      const next = new Set(expanded);
      next.delete(id);
      setExpanded(next);
      return;
    }
    setExpanded(new Set(expanded).add(id));
    load(id);
  };

  const activate = (id: string) => {
    if (index.get(id)?.kind === 'file') openFile(toAbsPath(id));
  };

  const trash = (path: AbsPath) => {
    void bus.call(filesChannels.trash, { path }).then((result) => {
      if (result.ok) load(parentOf(path));
      else toast.show({ message: result.error.message, tone: 'error' });
    });
  };

  const createFile = (dir: string, name: string) => {
    const path = joinPath(dir, name.trim());
    void bus.call(filesChannels.createFile, { path }).then((result) => {
      if (!result.ok) {
        toast.show({ message: result.error.message, tone: 'error' });
        return;
      }
      setCreatingIn(null);
      setNewName('');
      load(dir);
      openFile(path);
    });
  };

  const selectedPath = selected === null ? null : toAbsPath(selected);
  const selectedIsFile = selected !== null && index.get(selected)?.kind === 'file';
  const relative = selectedPath !== null && root !== null ? selectedPath.slice(root.length + 1).replace(/\\/g, '/') : '';
  const menuItems: readonly MenuItem[] = [
    {
      label: 'Open',
      icon: 'file',
      disabled: !selectedIsFile,
      onSelect: () => {
        if (selectedPath !== null) openFile(selectedPath);
      },
    },
    { separator: true },
    {
      label: 'Copy Path',
      icon: 'copy',
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath !== null) void bus.call(shellChannels.writeClipboard, { text: selectedPath });
      },
    },
    {
      label: 'Copy Relative Path',
      icon: 'copy',
      disabled: selectedPath === null,
      onSelect: () => void bus.call(shellChannels.writeClipboard, { text: relative }),
    },
    {
      label: 'Reveal in Explorer',
      icon: 'folder',
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath !== null) void bus.call(shellChannels.revealInExplorer, { path: selectedPath });
      },
    },
    {
      label: 'Show History',
      icon: 'history',
      disabled: !selectedIsFile,
      onSelect: () => {
        if (selectedPath !== null) showHistory(selectedPath);
      },
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'trash',
      danger: true,
      disabled: selectedPath === null,
      onSelect: () => {
        if (selectedPath === null) return;
        if (confirmTrash()) setTrashing(selectedPath);
        else trash(selectedPath);
      },
    },
  ];

  const rootListing = root === null ? undefined : listings.get(root);
  const frame: PanelViewState =
    project === undefined || (project !== null && rootListing === undefined)
      ? { kind: 'loading' }
      : project === null
        ? { kind: 'empty', title: 'No project open', message: 'Open a project to see its files.' }
        : rootListing?.status === 'loading'
          ? { kind: 'loading' }
          : rootListing?.status === 'error'
            ? {
                kind: 'error',
                message: `The folder could not be read. ${rootListing.message}`,
                onRetry: () => load(project.path),
              }
            : rootListing?.status === 'ready' && rootListing.entries.length === 0
              ? {
                  kind: 'empty',
                  message: 'This folder is empty.',
                  action: { label: 'New file', onPress: () => setCreatingIn(project.path) },
                }
              : { kind: 'ready' };

  const renderLabel = (node: TreeNode, state: { readonly expanded: boolean }) => {
    const isFolder = node.children !== null;
    const name: IconName = isFolder ? (state.expanded ? 'folder-open' : 'folder') : iconFor(node.text);
    const dimmed = index.get(node.id)?.isDimmed === true;
    return (
      <span className={cls(styles.label, dimmed && styles.dimmed)}>
        <Icon name={name} size={16} />
        <span className={styles.name}>{node.text}</span>
      </span>
    );
  };

  const invalidName = /[\\/:*?"<>|]/.test(newName) ? 'File names cannot contain \\ / : * ? " < > |.' : null;

  return (
    <>
      <PanelFrame title="Files" state={frame}>
        <Menu kind="context" items={menuItems}>
          <div className={styles.area}>
            <Tree
              nodes={nodes}
              expandedIds={expanded}
              onToggle={toggle}
              selectedId={selected}
              onSelect={setSelected}
              onActivate={activate}
              renderLabel={renderLabel}
              label="Project files"
            />
          </div>
        </Menu>
      </PanelFrame>
      {trashing === null ? null : (
        <ConfirmDialog
          title="Move to Recycle Bin?"
          body={`${baseName(trashing)} goes to the Recycle Bin. Restore it from there if you change your mind.`}
          confirmLabel="Move to Recycle Bin"
          danger
          onConfirm={() => {
            trash(trashing);
            setTrashing(null);
          }}
          onCancel={() => setTrashing(null)}
        />
      )}
      {creatingIn === null ? null : (
        <Dialog
          title="New file"
          onClose={() => setCreatingIn(null)}
          actions={
            <>
              <Button variant="ghost" onPress={() => setCreatingIn(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={newName.trim() === '' || invalidName !== null}
                onPress={() => createFile(creatingIn, newName)}
              >
                Create
              </Button>
            </>
          }
        >
          <div className={styles.newFile}>
            <TextField
              value={newName}
              onChange={setNewName}
              placeholder="name.ext"
              label="File name"
              invalidMessage={invalidName}
              mono
            />
          </div>
        </Dialog>
      )}
    </>
  );
}
