import { createElement } from 'react';
import { terminalHeader } from '@hsos/contracts/channels/terminal';
import type { UiContext } from '@hsos/contracts/module';
import { contributeUi } from '@hsos/ui-kit';
import { setMascotProblemReporter } from './panel/mascot/Mascot';
import { startHudData } from './panel/ribbon/hud-data';
import { createRibbon } from './panel/ribbon/Ribbon';

/**
 * Renderer side of the HUD. Card 029: the session ribbon in every Claude terminal's header slot
 * (HUD-80, TERM-75) and the mascot. The HUD panel's sections come with card 031.
 */
export function register(ctx: UiContext): void {
  startHudData(ctx.bus);
  setMascotProblemReporter((problem) => ctx.log.log('warn', 'hud.mascot_sheet_missing', { problem }));
  const RibbonFor = createRibbon({ bus: ctx.bus, openPanel: (type) => ctx.openPanel(type) });
  contributeUi(terminalHeader, { render: (terminalId) => createElement(RibbonFor, { terminalId }) });
}
