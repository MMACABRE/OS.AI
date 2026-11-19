import { createElement } from 'react';
import { z } from 'zod';
import { filesSection } from '@hsos/contracts/channels/files';
import type { AbsPath } from '@hsos/contracts/ids';
import { toAbsPath } from '@hsos/contracts/ids';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { zAbsPath } from '@hsos/contracts/schemas';
import { FileViewer } from './panel/FileViewer';
import { FilesTree } from './panel/FilesTree';

export const TREE_PANEL = 'files.tree';
export const VIEWER_PANEL = 'files.viewer';

const ViewerState = z.object({ path: zAbsPath, line: z.number().int().positive().nullable() });
type ViewerState = z.infer<typeof ViewerState>;

/** The files renderer side: the Files view (side view) and the file viewer (dock). Card 030. */
export function register(ctx: UiContext): void {
  const settings = ctx.settings(filesSection);
  const showHistory = (path: AbsPath) => ctx.openPanel('history.timeline', { path, selectedId: null });
  const openFile = (path: AbsPath, line: number | null = null) => ctx.openPanel(VIEWER_PANEL, { path, line });
  // FILE-79: a relative link opens the file; an https link opens externally until the browser panel exists.
  // Wiki links wait for the graph module.
  const openLink = (href: string, from: AbsPath) => {
    if (/^https?:/i.test(href)) {
      void ctx.bus.call(shellChannels.openExternal, { url: href });
      return;
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return;
    const folder = from.slice(0, from.lastIndexOf('\\'));
    let target: string;
    try {
      target = decodeURI(href.split('#')[0] ?? '');
    } catch {
      return;
    }
    const parts = [...folder.split('\\'), ...target.split(/[\\/]/)];
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.' && part !== '') resolved.push(part);
    }
    openFile(toAbsPath(resolved.join('\\')));
  };

  ctx.registerPanel({
    type: TREE_PANEL,
    kind: 'side',
    title: 'Files',
    icon: 'files',
    stateSchema: z.object({}),
    initialState: {},
    allowMultiple: false,
    component: () =>
      createElement(FilesTree, {
        bus: ctx.bus,
        confirmTrash: () => settings.get().confirmTrash,
        openFile: (path: AbsPath) => openFile(path),
        showHistory,
      }),
  });

  ctx.registerPanel<ViewerState>({
    type: VIEWER_PANEL,
    kind: 'dock',
    title: 'File',
    icon: 'file-code',
    stateSchema: ViewerState,
    initialState: { path: toAbsPath('C:\\'), line: null },
    allowMultiple: true,
    component: (props: PanelProps<ViewerState>) =>
      createElement(FileViewer, {
        bus: ctx.bus,
        path: props.state.path,
        line: props.state.line,
        openHistory: showHistory,
        openLink,
        markdownPreviewFirst: settings.get().markdownPreviewFirst,
      }),
  });
}
