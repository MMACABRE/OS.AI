import { graphChannels, graphSection } from '@hsos/contracts/channels/graph';
import type { AbsPath } from '@hsos/contracts/ids';
import type { UiContext } from '@hsos/contracts/module';
import { createGraphView, GraphViewState, INITIAL_GRAPH_VIEW_STATE } from './panel/GraphView';
import { createLocalGraph, INITIAL_LOCAL_GRAPH_STATE, LocalGraphState } from './panel/LocalGraph';
import { createNotesList, INITIAL_NOTES_LIST_STATE, NotesListState } from './panel/NotesList';
import { startGraphData, useGraphData } from './panel/graph-store';

/** Renderer side of the graph (graph.md): the graph view, the local graph, the notes list, and the commands. */
export function register(ctx: UiContext): void {
  startGraphData(ctx.bus);
  const settings = ctx.settings(graphSection);
  const openFile = (path: AbsPath, line: number | null) => ctx.openPanel('files.viewer', { path, line });
  const openSettings = () => ctx.openPanel('settings.screen');
  const showLocal = () => ctx.openPanel('graph.local');

  ctx.registerPanel<GraphViewState>({
    type: 'graph.view',
    kind: 'dock',
    title: 'Graph',
    icon: 'graph',
    stateSchema: GraphViewState,
    initialState: INITIAL_GRAPH_VIEW_STATE,
    component: createGraphView({
      bus: ctx.bus,
      log: ctx.log,
      openNote: (path, line) => openFile(path, line),
      showLocal,
      openSettings,
    }),
    allowMultiple: false,
  });
  ctx.registerPanel<NotesListState>({
    type: 'graph.notes',
    kind: 'side',
    title: 'Notes',
    icon: 'file-markdown',
    stateSchema: NotesListState,
    initialState: INITIAL_NOTES_LIST_STATE,
    component: createNotesList((path) => openFile(path, null)),
    allowMultiple: false,
  });
  ctx.registerPanel<LocalGraphState>({
    type: 'graph.local',
    kind: 'side',
    title: 'Local Graph',
    icon: 'graph',
    stateSchema: LocalGraphState,
    initialState: INITIAL_LOCAL_GRAPH_STATE,
    component: createLocalGraph({
      bus: ctx.bus,
      log: ctx.log,
      depth: () => settings.get().localDepth,
      open: (path, line) => openFile(path, line),
    }),
    allowMultiple: false,
  });

  ctx.registerCommand({
    id: 'graph.open',
    title: 'Open Graph',
    defaultKey: 'Ctrl+Shift+M',
    global: true,
    run: () => ctx.openPanel('graph.view'),
  });
  ctx.registerCommand({
    id: 'graph.agentView',
    title: 'Show What Claude Loads at Start',
    defaultKey: null,
    global: false,
    run: () => {
      useGraphData.getState().requestAgentView();
      ctx.openPanel('graph.view');
    },
  });
  ctx.registerCommand({
    id: 'graph.showLocal',
    title: 'Show Local Graph',
    defaultKey: null,
    global: false,
    run: showLocal,
  });
  ctx.registerCommand({
    id: 'graph.reindex',
    title: 'Rebuild Note Index',
    defaultKey: null,
    global: false,
    run: async () => {
      const result = await ctx.bus.call(graphChannels.reindex, {});
      if (!result.ok) ctx.log.log('warn', 'graph.reindex_failed', { message: result.error.message });
    },
  });
}
