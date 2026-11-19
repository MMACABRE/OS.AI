import { createElement } from 'react';
import type { ComponentType } from 'react';
import { z } from 'zod';
import type { WidgetSize, WidgetType } from '@hsos/contracts/channels/dashboard';
import { EmptyState, RollingNumber } from '@hsos/ui-kit';
import { HudDepsContext } from '../hud-context';
import type { HudDeps } from '../hud-context';
import { targetSession, useHudData } from '../hud-data';
import { createRibbon } from '../ribbon/Ribbon';
import { Mascot } from '../mascot/Mascot';
import { QuickBar, tokensText } from '../QuickBar';
import { cacheState, SessionsBoard } from '../SessionsSection';
import { SkillsDeck } from '../SkillsSection';
import { focusTerminal } from '../send-command';
import { useNow, UsageBars } from '../UsageSection';

type Sized = { readonly cells: WidgetSize };

/** The HUD's widget types for the dashboard (dashboard.md catalog, `hud.*`), each drawn inside the HUD's provider. */
export function hudWidgetTypes(deps: HudDeps): WidgetType[] {
  const Ribbon = createRibbon({ bus: deps.bus, openPanel: (type) => deps.openPanel(type) });
  const provide = (Component: ComponentType<Sized>) =>
    function Provided(props: Sized) {
      return createElement(HudDepsContext.Provider, { value: deps }, createElement(Component, props));
    };

  const RibbonWidget = () => {
    const sessions = useHudData((state) => state.sessions);
    const focusOrder = useHudData((state) => state.focusOrder);
    const target = targetSession(sessions, focusOrder);
    if (target === null || target.terminalId === null)
      return createElement(EmptyState, {
        title: 'No Claude session',
        message: 'Start Claude in a terminal.',
      });
    return createElement(Ribbon, { terminalId: target.terminalId });
  };

  const UsageWidget = ({ cells }: Sized) => {
    const usage = useHudData((state) => state.usage);
    if (usage.kind !== 'ready') return createElement(EmptyState, { message: 'Usage is not known yet.' });
    const percent = Math.max(
      usage.value.fiveHour?.usedPercentage ?? 0,
      usage.value.sevenDay?.usedPercentage ?? 0,
    );
    if (cells.w * cells.h <= 1)
      return createElement(RollingNumber, {
        value: Math.round(percent),
        format: (value: number) => `${value}%`,
      });
    return createElement(UsageBars);
  };

  const ContextWidget = () => {
    const sessions = useHudData((state) => state.sessions);
    const focusOrder = useHudData((state) => state.focusOrder);
    const now = useNow();
    const target = targetSession(sessions, focusOrder);
    if (target === null) return createElement(EmptyState, { message: 'No session to show.' });
    const percent = target.contextUsedPercentage === null ? null : Math.round(target.contextUsedPercentage);
    return createElement(
      'div',
      null,
      createElement(RollingNumber, {
        value: percent ?? 0,
        format: (value: number) => (percent === null ? '—' : `${value}%`),
      }),
      createElement('p', null, tokensText(target.contextTokens, target.contextWindowSize)),
      createElement('p', null, cacheState(target.lastResponseAt, now)),
    );
  };

  const MascotWidget = () => {
    const sessions = useHudData((state) => state.sessions);
    const focusOrder = useHudData((state) => state.focusOrder);
    const target = targetSession(sessions, focusOrder);
    return createElement(Mascot, { activity: target?.activity ?? null, page: 'other', scale: 2 });
  };

  const focusTarget = () => {
    const state = useHudData.getState();
    const target = targetSession(state.sessions, state.focusOrder);
    if (target?.terminalId) focusTerminal(target.terminalId);
  };

  const widget = (
    id: string,
    title: string,
    min: WidgetSize,
    max: WidgetSize,
    defaultSize: WidgetSize,
    frame: 'box' | 'free',
    component: ComponentType<Sized>,
    activate?: () => void,
  ): WidgetType => ({
    id,
    title,
    moduleId: 'hud',
    minSize: min,
    maxSize: max,
    defaultSize,
    frame,
    configSchema: z.unknown(),
    defaultConfig: null,
    component: provide(component),
    ...(activate === undefined ? {} : { activate: () => activate() }),
  });

  return [
    widget(
      'hud.ribbon',
      'Session ribbon',
      { w: 2, h: 1 },
      { w: 8, h: 3 },
      { w: 4, h: 2 },
      'box',
      RibbonWidget as ComponentType<Sized>,
      focusTarget,
    ),
    widget(
      'hud.sessions',
      'Sessions',
      { w: 2, h: 2 },
      { w: 8, h: 6 },
      { w: 4, h: 3 },
      'box',
      SessionsBoard as ComponentType<Sized>,
    ),
    widget('hud.usage', 'Usage', { w: 1, h: 1 }, { w: 4, h: 3 }, { w: 2, h: 2 }, 'box', UsageWidget, () =>
      deps.openPanel('hud.panel'),
    ),
    widget(
      'hud.context',
      'Context',
      { w: 1, h: 1 },
      { w: 4, h: 3 },
      { w: 2, h: 2 },
      'box',
      ContextWidget as ComponentType<Sized>,
      () => deps.openPanel('hud.panel'),
    ),
    widget('hud.quickBar', 'Quick bar', { w: 2, h: 1 }, { w: 8, h: 2 }, { w: 8, h: 1 }, 'free', (() =>
      createElement(QuickBar, {
        onSearchSkills: () => deps.runCommand('hud.searchSkills'),
      })) as unknown as ComponentType<Sized>),
    widget(
      'hud.skills',
      'Skills',
      { w: 2, h: 2 },
      { w: 6, h: 6 },
      { w: 4, h: 4 },
      'box',
      SkillsDeck as ComponentType<Sized>,
    ),
    widget(
      'hud.mascot',
      'Mascot',
      { w: 1, h: 1 },
      { w: 4, h: 4 },
      { w: 2, h: 2 },
      'free',
      MascotWidget as ComponentType<Sized>,
      focusTarget,
    ),
  ];
}
