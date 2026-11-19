import { hudWidgetTypes } from './panel/widgets/hud-widgets';
import { dashboardWidgets } from '@hsos/contracts/channels/dashboard';
import { createElement } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { settingsChannels } from '@hsos/contracts/channels/settings';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalHeader } from '@hsos/contracts/channels/terminal';
import type { PanelProps, UiContext } from '@hsos/contracts/module';
import { contributeUi } from '@hsos/ui-kit';
import { HudDepsContext } from './panel/hud-context';
import type { HudDeps } from './panel/hud-context';
import { startHudAlerts } from './panel/hud-alerts';
import { startHudData, useHudData } from './panel/hud-data';
import { HudPanel, HudPanelState, INITIAL_HUD_STATE, searchSkills } from './panel/HudPanel';
import { setMascotProblemReporter } from './panel/mascot/Mascot';
import { createRibbon } from './panel/ribbon/Ribbon';
import { focusTerminal } from './panel/send-command';
import { SetupView, SetupViewState } from './panel/SetupView';
import { createAttentionStatus } from './panel/AttentionStatus';
import { createUsageStatus } from './panel/UsageSection';
import { TEST_LINE, useVoiceChooser, VoiceChooser } from './panel/VoiceChooser';

/** Renders `component` inside the HUD's provider. */
function provided<P extends object>(deps: HudDeps, component: ComponentType<P>, extra?: ReactNode): ComponentType<P> {
  return function Provided(props: P) {
    return createElement(HudDepsContext.Provider, { value: deps }, createElement(component, props), extra);
  };
}

/**
 * Renderer side of the HUD: the HUD side view with its quick bar and sections (HUD-1 to HUD-41, HUD-60
 * to HUD-68), the Claude setup view (HUD-50 to HUD-55), the session ribbon and mascot in every Claude
 * terminal's header (HUD-80 to HUD-93), the status items, the alerts and the commands.
 */
export function register(ctx: UiContext): void {
  startHudData(ctx.bus);
  startHudAlerts(ctx.bus);
  setMascotProblemReporter((problem) => ctx.log.log('warn', 'hud.mascot_sheet_missing', { problem }));

  const commands = new Set<string>();
  const deps: HudDeps = {
    bus: ctx.bus,
    log: ctx.log,
    openPanel: (type, state) => ctx.openPanel(type, state),
    setSetting: async (key, value) => (await ctx.bus.call(settingsChannels.setValue, { moduleId: 'hud', key, value })).ok,
    hasCommand: (id) => commands.has(id) || id.startsWith('hud.'),
    runCommand: (id) => {
      if (id === 'hud.searchSkills') searchSkills();
    },
  };

  const RibbonFor = createRibbon({ bus: ctx.bus, openPanel: (type) => ctx.openPanel(type) });
  for (const type of hudWidgetTypes(deps)) contributeUi(dashboardWidgets, type);
  contributeUi(terminalHeader, { render: (terminalId) => createElement(RibbonFor, { terminalId }) });

  ctx.registerPanel({
    type: 'hud.panel',
    kind: 'side',
    title: 'HUD',
    icon: 'hud',
    stateSchema: HudPanelState,
    initialState: INITIAL_HUD_STATE,
    component: provided<PanelProps<HudPanelState>>(deps, HudPanel, createElement(VoiceChooser)),
    allowMultiple: false,
  });
  ctx.registerPanel({
    type: 'hud.setup',
    kind: 'dock',
    title: 'Claude Setup',
    icon: 'agent',
    stateSchema: SetupViewState,
    initialState: {},
    component: provided<PanelProps<SetupViewState>>(deps, SetupView),
    allowMultiple: false,
  });

  const showHud = () => ctx.openPanel('hud.panel');
  ctx.registerStatusItem({ id: 'hud.attention', side: 'right', order: 30, component: createAttentionStatus() });
  ctx.registerStatusItem({ id: 'hud.usage5h', side: 'right', order: 20, component: createUsageStatus('fiveHour', showHud) });
  ctx.registerStatusItem({ id: 'hud.usage7d', side: 'right', order: 10, component: createUsageStatus('sevenDay', showHud) });

  const register = (id: string, title: string, defaultKey: string | null, run: () => void, global = false) => {
    commands.add(id);
    ctx.registerCommand({ id, title, defaultKey, global, run });
  };
  register('hud.show', 'Show HUD', 'Ctrl+Shift+H', showHud);
  register(
    'hud.focusNextAttention',
    'Go to Next Session That Needs You',
    'Ctrl+Shift+U',
    () => {
      const next = [...useHudData.getState().sessions.values()].find(
        (session) => session.activity === 'needs-you' && session.terminalId !== null,
      );
      if (next?.terminalId !== null && next?.terminalId !== undefined) focusTerminal(next.terminalId);
    },
    true,
  );
  register('hud.searchSkills', 'Search Skills', 'Ctrl+Shift+K', () => {
    showHud();
    searchSkills();
  });
  register('hud.openSetup', 'Show Claude Setup', null, () => ctx.openPanel('hud.setup'));
  register('hud.toggleSpokenAlerts', 'Turn Spoken Alerts On or Off', null, () => {
    const on = !useHudData.getState().settings.speakAlerts;
    void deps.setSetting('speakAlerts', on).then((saved) => {
      if (saved)
        useHudData.setState((state) => ({ settings: { ...state.settings, speakAlerts: on } }));
      ctx.log.log('info', 'hud.spoken_alerts', { on, saved });
    });
  });
  register('hud.testVoice', 'Test Alert Voice', null, () => {
    const { speakVoice, speakRate } = useHudData.getState().settings;
    void ctx.bus.call(shellChannels.speak, { text: TEST_LINE, voice: speakVoice === '' ? null : speakVoice, rate: speakRate });
  });
  register('hud.chooseVoice', 'Choose Alert Voice', null, () => useVoiceChooser.setState({ open: true }));
}
