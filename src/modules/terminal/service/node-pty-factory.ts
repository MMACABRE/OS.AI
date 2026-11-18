import { spawn } from 'node-pty';
import type { PtyFactory, PtyProcess } from '@hsos/contracts/channels/terminal';

/** The real ConPTY behind the `PtyFactory` seam, through node-pty. Card 002. */
export function createNodePtyFactory(): PtyFactory {
  return {
    spawn(options): PtyProcess {
      const pty = spawn(options.shellPath, [...options.args], {
        name: 'xterm-256color',
        cwd: options.cwd,
        env: { ...options.env },
        cols: options.cols,
        rows: options.rows,
      });
      const encoder = new TextEncoder();
      return {
        pid: pty.pid,
        write: (data) => pty.write(data),
        resize: (cols, rows) => pty.resize(cols, rows),
        pause: () => pty.pause(),
        resume: () => pty.resume(),
        kill: () => pty.kill(),
        onData: (listener) => void pty.onData((data) => listener(encoder.encode(data))),
        onExit: (listener) => void pty.onExit((event) => listener(event.exitCode)),
      };
    },
  };
}
