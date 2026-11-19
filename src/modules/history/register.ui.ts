import { createElement } from 'react';
import { z } from 'zod';
import { toAbsPath } from '@hsos/contracts/ids';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { zAbsPath } from '@hsos/contracts/schemas';
import { Timeline } from './panel/Timeline';

export const TIMELINE_PANEL = 'history.timeline';

const TimelineState = z.object({ path: zAbsPath, selectedId: z.string().max(40).nullable() });
type TimelineState = z.infer<typeof TimelineState>;

/** The history renderer side: the timeline of one file (dock panel `history.timeline`). Card 030. */
export function register(ctx: UiContext): void {
  ctx.registerPanel<TimelineState>({
    type: TIMELINE_PANEL,
    kind: 'dock',
    title: 'History',
    icon: 'history',
    stateSchema: TimelineState,
    initialState: { path: toAbsPath('C:\\'), selectedId: null },
    allowMultiple: true,
    component: (props: PanelProps<TimelineState>) =>
      createElement(Timeline, {
        bus: ctx.bus,
        path: props.state.path,
        selectedId: props.state.selectedId,
        onSelect: (id: string) => props.setState({ path: props.state.path, selectedId: id }),
      }),
  });
}
