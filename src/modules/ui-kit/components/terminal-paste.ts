/*
 * The paste path into a terminal from other modules (REV-33): the terminal panel registers xterm's paste
 * for its terminal id, and a module such as review pastes through it. The ui-kit holds the registry
 * because it is the one module every panel may import.
 */

export type PasteOutcome = 'pasted' | 'needs-bracketed-paste' | 'no-terminal';
export type TerminalPaste = (text: string) => Exclude<PasteOutcome, 'no-terminal'>;

const pasters = new Map<string, TerminalPaste>();

/** Registers the paste of one terminal until the returned function is called. */
export function registerTerminalPaste(terminalId: string, paste: TerminalPaste): () => void {
  pasters.set(terminalId, paste);
  return () => {
    if (pasters.get(terminalId) === paste) pasters.delete(terminalId);
  };
}

/** Pastes into the terminal's panel; `no-terminal` when no panel shows that terminal. */
export function pasteToTerminal(terminalId: string, text: string): PasteOutcome {
  return pasters.get(terminalId)?.(text) ?? 'no-terminal';
}

/**
 * Text from outside is data (P-6): escape and other control characters are removed, so pasted text
 * cannot end a bracketed paste early (`ESC[201~`) or send key sequences. Tabs and line breaks stay.
 */
export function sanitizePaste(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');
}
