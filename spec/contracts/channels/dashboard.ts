/** Channels, file schema and extension point of the `dashboard` module. Spec: spec/modules/dashboard.md */
import { z } from 'zod';
import { request } from '../bus';
import type { ExtensionPoint, SettingsSection } from '../module';
import { zEmpty } from '../schemas';

export const WidgetInstance = z.object({
  id: z.string().length(12),
  /** A type id contributed to `dashboardWidgets`, for example `hud.usage`. */
  type: z.string().min(1).max(80),
  /** 0-based screen index, 0 to 7. */
  screen: z.number().int().min(0).max(7),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  /** The widget type's own settings, validated by its `configSchema` (DASH-21). */
  config: z.unknown(),
});
export type WidgetInstance = z.infer<typeof WidgetInstance>;

/** %APPDATA%\HSOS\dashboard.json (DASH-20). */
export const DashboardFile = z.object({
  version: z.literal(1),
  screens: z.number().int().min(1).max(8),
  widgets: z.array(WidgetInstance).max(200),
});
export type DashboardFile = z.infer<typeof DashboardFile>;

export type WidgetSize = { readonly w: number; readonly h: number };

/** What a module contributes to `dashboardWidgets` for one widget type (DASH-3, DASH-12). */
export type WidgetType<C = unknown> = {
  readonly id: string;
  readonly title: string;
  readonly moduleId: string;
  readonly minSize: WidgetSize;
  readonly maxSize: WidgetSize;
  readonly defaultSize: WidgetSize;
  readonly configSchema: z.ZodType<C>;
  readonly defaultConfig: C;
  /** Renders the widget for its size. `cells` is the size in cells, `pixels` its box. */
  readonly component: (props: {
    readonly config: C;
    readonly cells: WidgetSize;
    readonly pixels: { readonly width: number; readonly height: number };
    readonly setConfig: (config: C) => void;
  }) => unknown;
  /** Runs when the widget is activated out of edit mode (DASH-13). */
  readonly activate?: (config: C) => void;
};

export const dashboardWidgets: ExtensionPoint<WidgetType> = { id: 'dashboard.widgets' };

export const DashboardSettings = z.object({
  columns: z.number().int().min(4).max(12).default(8),
  rows: z.number().int().min(3).max(10).default(6),
});
export type DashboardSettings = z.infer<typeof DashboardSettings>;

export const dashboardSection: SettingsSection<DashboardSettings> = {
  moduleId: 'dashboard',
  title: 'Dashboard',
  schema: DashboardSettings,
  defaults: DashboardSettings.parse({}),
};

export const dashboardChannels = {
  /** The saved layout, or null when there is none or it is invalid with no valid `.bak` (DASH-21). */
  load: request('dashboard.load', 'main', zEmpty, DashboardFile.nullable()),
  /** Saves atomically, keeping a `.bak` (DASH-21). */
  save: request('dashboard.save', 'main', z.object({ file: DashboardFile }), zEmpty),
} as const;
