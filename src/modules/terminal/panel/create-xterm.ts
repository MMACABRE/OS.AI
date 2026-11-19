import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { Logger } from '@hsos/contracts/module';
import type { TerminalSettings } from '@hsos/contracts/channels/terminal';
import { readTokens, xtermTheme } from './xterm-theme';

export type XtermView = {
  readonly terminal: Terminal;
  readonly fit: FitAddon;
  /** Re-reads the theme tokens; a theme change applies without restarting the shell (TERM-51). */
  applyTheme(): void;
  dispose(): void;
};

/**
 * A terminal view with the settings' font, cursor and scrollback and a theme from the tokens (TERM-51).
 * `allowTransparency` lets the background show through the tint (TERM-76). The WebGL renderer is used
 * when `useWebgl` is on; if it cannot start or loses its context, xterm's default renderer takes over
 * and a warning is logged (TERM-52).
 */
export function createXterm(
  element: HTMLElement,
  settings: TerminalSettings,
  log: Logger,
): XtermView {
  const read = readTokens();
  const terminal = new Terminal({
    allowTransparency: true,
    fontFamily: read('font.mono') || 'monospace',
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    cursorStyle: settings.cursorStyle,
    cursorBlink: settings.cursorBlink,
    scrollback: settings.scrollbackLines,
    theme: xtermTheme(read),
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);
  if (settings.useWebgl) {
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        log.log('warn', 'terminal.webgl_context_lost', {});
        webgl.dispose();
      });
      terminal.loadAddon(webgl);
    } catch (error) {
      log.log('warn', 'terminal.webgl_unavailable', { message: error instanceof Error ? error.message : String(error) });
    }
  }
  return {
    terminal,
    fit,
    applyTheme: () => {
      terminal.options.theme = xtermTheme(readTokens());
    },
    dispose: () => terminal.dispose(),
  };
}
