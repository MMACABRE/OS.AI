import { createNodePtyFactory } from '../../modules/terminal/service/node-pty-factory';

console.log('pty-host');

type PortLike = { postMessage(data: unknown): void; start(): void };
type ParentPort = { on(event: 'message', listener: (message: { ports: readonly PortLike[] }) => void): void };

function isParentPort(value: unknown): value is ParentPort {
  return typeof value === 'object' && value !== null && 'on' in value;
}

/** Card 002: a shell through node-pty, killed after 3 seconds. */
function runShellSpike(): void {
  const shell = createNodePtyFactory().spawn({
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
  shell.onData((chunk) => console.log(`pty-host output: ${JSON.stringify(decoder.decode(chunk))}`));
  shell.write('echo spike-ok\r');
  setTimeout(() => shell.kill(), 3_000);
}

/** Card 005: 1 000 numbered messages of 10 000 bytes to the renderer's port. */
function sendOverPort(port: PortLike): void {
  port.start();
  for (let index = 0; index < 1_000; index += 1) port.postMessage(new Uint8Array(10_000).fill(index % 256));
}

runShellSpike();
const parentPort: unknown = Reflect.get(process, 'parentPort');
if (isParentPort(parentPort)) {
  parentPort.on('message', (message) => {
    const port = message.ports[0];
    if (port !== undefined) sendOverPort(port);
  });
}
