import { describe, expect, it } from 'vitest';
import { createNodePtyFactory } from '../../src/modules/terminal/service/node-pty-factory';

describe('node-pty factory (card 002)', () => {
  it('runs a shell that echoes, resizes, and exits when killed', async () => {
    const pty = createNodePtyFactory().spawn({
      shellPath: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile'],
      cwd: process.cwd(),
      env: Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
      ),
      cols: 80,
      rows: 24,
    });
    const decoder = new TextDecoder();
    let output = '';
    const sawEcho = new Promise<void>((resolve) => {
      pty.onData((chunk) => {
        output += decoder.decode(chunk, { stream: true });
        if (output.includes('spike-ok')) resolve();
      });
    });
    const exited = new Promise<number>((resolve) => pty.onExit(resolve));

    pty.write('echo spike-ok\r');
    await sawEcho;
    expect(() => pty.resize(100, 30)).not.toThrow();
    pty.kill();

    expect(typeof (await exited)).toBe('number');
  }, 20_000);
});
