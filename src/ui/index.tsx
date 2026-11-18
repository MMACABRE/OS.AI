import { createRoot } from 'react-dom/client';

const MESSAGE_COUNT = 1_000;

/** Receives numbered binary messages from pty-host and reports order and total size (card 005). */
function checkPorts(show: (text: string) => void): void {
  window.addEventListener('message', (event) => {
    const port = event.data === 'hsos-port' ? event.ports[0] : undefined;
    if (port === undefined) return;
    let expected = 0;
    let total = 0;
    port.onmessage = (message: MessageEvent<unknown>) => {
      const data = message.data;
      if (!(data instanceof Uint8Array) || data[0] !== expected % 256) return show('ports-failed');
      expected += 1;
      total += data.byteLength;
      if (expected === MESSAGE_COUNT) show(`ports-ok ${total}`);
    };
    port.start();
  });
}

const root = document.getElementById('root');
if (root !== null) {
  const view = createRoot(root);
  view.render(<p>HSOS</p>);
  checkPorts((text) => view.render(<p>{text}</p>));
}
