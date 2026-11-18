import { createNodePtyFactory } from '../../modules/terminal/service/node-pty-factory';

console.log('pty-host');

/** Card 002: a shell through node-pty; the service exits after 3 seconds. */
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
setTimeout(() => {
  shell.kill();
  process.exit(0);
}, 3_000);
