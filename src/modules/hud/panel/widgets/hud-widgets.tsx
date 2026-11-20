import { createElement } from 'react';
import type { ComponentType } from 'react';
import { z } from 'zod';
import type { WidgetSize, WidgetType } from '@hsos/contracts/channels/dashboard';
import { EmptyState, RollingNumber } from '@hsos/ui-kit';
import { HudDepsContext } from '../hud-context';
import type { HudDeps } from '../hud-context';
import { targetSession, useHudData } from '../hud-data';
import { ACTIVITY_WORDS, createRibbon } from '../ribbon/Ribbon';
import { Mascot } from '../mascot/Mascot';
import { QuickBar, tokensText } from '../QuickBar';
import { cacheState, SessionsBoard } from '../SessionsSection';
import { SkillsDeck } from '../SkillsSection';
import { focusTerminalWhenShown } from '../send-command';
import { resetsText, usageTone, useNow, UsageBars } from '../UsageSection';
import widgetStyles from './HudWidgets.module.css';

type Sized = { readonly cells: WidgetSize; readonly pixels: { readonly width: number; readonly height: number } };
/** Pixels of widget per step of mascot zoom: a 2 by 2 cell widget shows the strawberry near the mockup's size. */
const MASCOT_CELL_PX = 48;
/** The sprite's side before zoom: the 16 by 16 cell at scale 2. */
const MASCOT_SPRITE_PX = 32;/** Segments of the context bar, as in the mockup. */
const CONTEXT_SEGMENTS = 20;

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
    const settings = useHudData((state) => state.settings);
    const now = useNow();
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
    if (cells.h < 2) return createElement(UsageBars);
    // The mockup's USAGE box: per window a big toned number, its reset time, then a segmented bar.
    const rows = [
      { label: '5 hours', window: usage.value.fiveHour },
      { label: '7 days', window: usage.value.sevenDay },
    ];
    return createElement(
      'div',
      { className: widgetStyles.usage },
      rows.map(({ label, window }) => {
        const used = window === null ? null : Math.round(window.usedPercentage);
        const tone = used === null ? 'ok' : usageTone(used, settings.warnAt, settings.dangerAt);
        const filled = Math.round(((used ?? 0) / 100) * CONTEXT_SEGMENTS);
        return createElement(
          'div',
          { key: label, className: widgetStyles.usageWindow },
          createElement(
            'div',
            { className: widgetStyles.usageLabel },
            createElement(
              'span',
              { className: `${widgetStyles.bigNumber} ${widgetStyles[tone]}` },
              createElement(RollingNumber, {
                value: used ?? 0,
                format: (value: number) => (used === null ? '–' : `${value}%`),
              }),
            ),
            createElement(
              'span',
              { className: widgetStyles.small },
              createElement('span', null, label),
              window === null ? ' · no data yet' : ` · ${resetsText(window.resetsAt, now)}`,
            ),
          ),
          createElement(
            'span',
            {
              className: `${widgetStyles.segments} ${widgetStyles[tone]}`,
              role: 'img',
              'aria-label': used === null ? `${label}: no data yet` : `${label} ${used} percent used`,
            },
            Array.from({ length: CONTEXT_SEGMENTS }, (_, index) =>
              createElement('i', { key: index, 'data-on': index < filled || undefined }),
            ),
          ),
        );
      }),
    );
  };

  const ContextWidget = ({ cells }: Sized) => {
    const sessions = useHudData((state) => state.sessions);
    const focusOrder = useHudData((state) => state.focusOrder);
    const now = useNow();
    const target = targetSession(sessions, focusOrder);
    if (target === null) return createElement(EmptyState, { message: 'No session to show.' });
    const percent = target.contextUsedPercentage === null ? null : Math.round(target.contextUsedPercentage);
    // The mockup's CONTEXT box: a big yellow number, a segmented bar, then tokens and cache in small text.
    const filled = Math.round(((percent ?? 0) / 100) * CONTEXT_SEGMENTS);
    // One cell high: the number and the bar side by side, tokens after them (mockup bottom right).
    return createElement(
      'div',
      { className: cells.h < 2 ? widgetStyles.contextRow : widgetStyles.context },
      createElement(
        'span',
        { className: widgetStyles.bigNumber },
        createElement(RollingNumber, {
          value: percent ?? 0,
          format: (value: number) => (percent === null ? '—' : `${value}%`),
        }),
      ),
      createElement(
        'span',
        { className: widgetStyles.segments, 'aria-hidden': true },
        Array.from({ length: CONTEXT_SEGMENTS }, (_, index) =>
          createElement('i', { key: index, 'data-on': index < filled || undefined }),
        ),
      ),
      cells.h < 2
        ? null
        : createElement('p', { className: widgetStyles.small }, tokensText(target.contextTokens, target.contextWindowSize)),
      cells.h < 2 ? null : createElement('p', { className: widgetStyles.small }, cacheState(target.lastResponseAt, now)),
    );
  };

  /** The mascot fills its cells, as large as the mockup's top-right strawberry: whole-pixel scales only. */
  const MascotWidget = ({ cells, pixels }: Sized) => {
    const sessions = useHudData((state) => state.sessions);
    const focusOrder = useHudData((state) => state.focusOrder);
    const target = targetSession(sessions, focusOrder);
    // From 2 by 2 the state is said in words under the mascot (catalog, HUD-93), so the sprite leaves room for it.
    const withWord = cells.w >= 2 && cells.h >= 2;
    // The sprite draws at scale 2 (32 px); a whole-number CSS scale enlarges it with crisp pixels.
    const zoom = Math.min(4, Math.max(1, Math.floor(Math.min(pixels.width, pixels.height) / MASCOT_CELL_PX)));
    const side = MASCOT_SPRITE_PX * zoom;
    return createElement(
      'div',
      { className: widgetStyles.mascot },
      createElement(
        'span',
        { className: widgetStyles.mascotSprite, style: { width: side, height: side } },
        createElement(
          'span',
          { style: { transform: `scale(${zoom})` } },
          createElement(Mascot, { activity: target?.activity ?? null, page: 'other', scale: 2 }),
        ),
      ),
      withWord
        ? createElement(
            'div',
            { className: widgetStyles.mascotWords },
            createElement(
              'span',
              { className: widgetStyles.mascotWord },
              target === null ? 'sleeping' : ACTIVITY_WORDS[target.activity],
            ),
            target?.currentTool
              ? createElement('span', { className: widgetStyles.small }, target.currentTool)
              : null,
          )
        : null,
    );
  };

  // Activating a session widget goes to its terminal on the Code page, with the terminal focused (DASH-13).
  const focusTarget = () => {
    const state = useHudData.getState();
    const target = targetSession(state.sessions, state.focusOrder);
    if (target?.terminalId === undefined || target?.terminalId === null) return;
    deps.openPanel('terminal.shell', {
      terminalId: target.terminalId,
      cwd: target.cwd,
      worktree: null,
      launch: null,
      fontSizeDelta: 0,
    });
    focusTerminalWhenShown(target.terminalId);
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
