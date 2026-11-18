/**
 * Theme files. See spec/design/visual-direction.md and spec/modules/settings.md.
 */
import { z } from 'zod';

/** Every token name the app uses. A theme may set any subset; the rest come from Graphite. */
export const TOKEN_NAMES = [
  'color.bg.app',
  'color.bg.panel',
  'color.bg.raised',
  'color.bg.overlay',
  'color.bg.selected',
  'color.border.hairline',
  'color.border.strong',
  'color.text.primary',
  'color.text.secondary',
  'color.text.muted',
  'color.accent',
  'color.accent.text',
  'color.state.ok',
  'color.state.warn',
  'color.state.danger',
  'color.state.info',
  'color.diff.added.bg',
  'color.diff.removed.bg',
  'color.term.foreground',
  'color.term.background',
  'color.term.cursor',
  'color.term.selection',
  'color.term.ansi.black',
  'color.term.ansi.red',
  'color.term.ansi.green',
  'color.term.ansi.yellow',
  'color.term.ansi.blue',
  'color.term.ansi.magenta',
  'color.term.ansi.cyan',
  'color.term.ansi.white',
  'color.term.ansi.brightBlack',
  'color.term.ansi.brightRed',
  'color.term.ansi.brightGreen',
  'color.term.ansi.brightYellow',
  'color.term.ansi.brightBlue',
  'color.term.ansi.brightMagenta',
  'color.term.ansi.brightCyan',
  'color.term.ansi.brightWhite',
  'color.graph.node.note',
  'color.graph.node.claudeMd',
  'color.graph.node.skill',
  'color.graph.node.memory',
  'color.graph.node.unresolved',
  'color.graph.edge',
  'font.ui',
  'font.mono',
  'font.size.small',
  'font.size.body',
  'font.size.title',
  'font.size.number',
  'radius.control',
  'radius.panel',
  'radius.dialog',
  'size.row',
  'size.tab',
  'size.titlebar',
  'size.statusbar',
  'size.rail',
  'motion.instant',
  'motion.quick',
  'motion.normal',
  'motion.slow',
  'motion.ease.out',
  'motion.ease.in',
  'motion.page',
  'motion.ease.spring',
  'shadow.overlay',
  // Glass surfaces over the background (UI-31): opacity 0 to 1 and blur in px per surface role.
  'surface.app.alpha',
  'surface.panel.alpha',
  'surface.panel.blur',
  'surface.terminal.alpha',
  'surface.terminal.blur',
  'surface.overlay.alpha',
  'surface.overlay.blur',
  'surface.widget.alpha',
  'surface.widget.blur',
  'surface.ribbon.alpha',
  'surface.ribbon.blur',
  /** The lowest opacity a surface holding reading text may have (P-45). */
  'surface.text.minAlpha',
  // The animated background (UI-30, UI-32).
  'backdrop.scene',
  'backdrop.fps',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

export const ThemeFile = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(60),
  kind: z.enum(['dark', 'light']),
  /** Unknown token names are ignored and reported by the settings screen (SET-14). */
  tokens: z.record(z.string(), z.string().max(200)),
});
export type ThemeFile = z.infer<typeof ThemeFile>;

/** A theme with every token present, after missing ones are filled from Graphite. */
export type ResolvedTheme = {
  readonly name: string;
  readonly kind: 'dark' | 'light';
  readonly tokens: Readonly<Record<TokenName, string>>;
};

/** `color.bg.app` becomes `--color-bg-app`. */
export function tokenToCssVariable(token: TokenName): string {
  return `--${token.replace(/\./g, '-')}`;
}
