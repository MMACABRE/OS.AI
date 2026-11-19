import { createElement } from 'react';
import type { AbsPath } from '@hsos/contracts/ids';
import type { UiContext } from '@hsos/contracts/module';
import { z } from 'zod';
import { Artifacts } from './panel/Artifacts';
import { Timeline } from './panel/Timeline';

export const TIMELINE_VIEW = 'activity.timeline';
export const ARTIFACTS_VIEW = 'activity.artifacts';

/** The activity renderer side: the Activity and Artifacts side views (ACT-10 to ACT-33). Card 033. */
export function register(ctx: UiContext): void {
  const openFile = (path: AbsPath) => ctx.openPanel('files.viewer', { path, line: null });
  const openHistory = (path: AbsPath, snapshotId: string) => ctx.openPanel('history.timeline', { path, selectedId: snapshotId });

  // ACT commands (activity.md "Commands"): the side views are routed by the workspace.
  ctx.registerCommand({
    id: 'activity.showTimeline',
    title: 'Show Activity',
    defaultKey: null,
    global: false,
    run: () => ctx.openPanel(TIMELINE_VIEW),
  });
  ctx.registerCommand({
    id: 'activity.showArtifacts',
    title: 'Show Artifacts',
    defaultKey: null,
    global: false,
    run: () => ctx.openPanel(ARTIFACTS_VIEW),
  });

  ctx.registerPanel({
    type: TIMELINE_VIEW,
    kind: 'side',
    title: 'Activity',
    icon: 'activity',
    stateSchema: z.object({}),
    initialState: {},
    allowMultiple: false,
    component: () => createElement(Timeline, { bus: ctx.bus, openFile, openHistory }),
  });

  ctx.registerPanel({
    type: ARTIFACTS_VIEW,
    kind: 'side',
    title: 'Artifacts',
    icon: 'artifacts',
    stateSchema: z.object({}),
    initialState: {},
    allowMultiple: false,
    component: () => createElement(Artifacts, { bus: ctx.bus, openFile }),
  });
}
