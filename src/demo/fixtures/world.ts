/**
 * The owner's world in the demo (card 026): two projects, terminals, four Claude sessions, a vault.
 * Every fixture file builds on these names so the screens agree with each other.
 */
import { DEMO_NOW } from '../mock-from-schema';

export const NOW = DEMO_NOW;
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;
export const ago = (ms: number): number => NOW - ms;

export const HOME = 'C:\\Users\\owner';
export const HSOS = { id: '3f2a9c71e0b45d18', path: `${HOME}\\code\\hsos`, name: 'hsos' } as const;
export const VAULT = { id: 'a81c4e2f907d3b65', path: `${HOME}\\notes\\vault`, name: 'vault' } as const;
export const PROJECTS = [HSOS, VAULT] as const;

/** Terminals of the hsos project (TerminalId: 12 characters). */
export const TERMINALS = {
  main: 'term00000001',
  review: 'term00000002',
  shell: 'term00000003',
} as const;

/** Four Claude sessions, one in each lively activity. */
export const SESSIONS = {
  dust: { id: '6c1e2f4a-0b7d-4e19-9f3a-5d8c2b7e1a40', title: 'Cap dust brightness behind the terminal' },
  ribbon: { id: '9a7b3c2d-1e4f-4a8b-b6c5-0d1e2f3a4b5c', title: 'Blink the ribbon while Claude works' },
  notes: { id: '2f8e7d6c-5b4a-4938-8271-6a5b4c3d2e1f', title: 'Link the motion notes into the graph' },
  release: { id: 'd4c3b2a1-9f8e-4d7c-a6b5-c4d3e2f1a0b9', title: 'Draft the stage U release notes' },
} as const;

export const p = (relative: string): string => `${HSOS.path}\\${relative.replace(/\//g, '\\')}`;
export const v = (relative: string): string => `${VAULT.path}\\${relative.replace(/\//g, '\\')}`;
