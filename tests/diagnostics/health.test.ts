import { describe, expect, it } from 'vitest';
import { processMetricsFrom } from '../../src/modules/diagnostics/service/health';

const SERVICES = ['pty-host', 'workspace-service', 'link-service'];

describe('diagnostics health (card 013)', () => {
  it('DIAG-9 each service is found by the name Electron gives its utility process, and the page is ui', () => {
    const rows = [
      { type: 'Browser', name: undefined, pid: 1, memory: { workingSetSize: 100 }, creationTime: 10 },
      {
        type: 'Utility',
        name: 'workspace-service',
        serviceName: 'node.mojom.NodeService',
        pid: 2,
        memory: { workingSetSize: 2048 },
        creationTime: 20,
      },
      {
        type: 'Utility',
        name: 'pty-host',
        serviceName: 'node.mojom.NodeService',
        pid: 3,
        memory: { workingSetSize: 1024 },
        creationTime: 30,
      },
      {
        type: 'Utility',
        name: 'link-service',
        serviceName: 'node.mojom.NodeService',
        pid: 4,
        memory: { workingSetSize: 512 },
        creationTime: 40,
      },
      {
        type: 'Utility',
        name: 'audio',
        serviceName: 'audio.mojom.AudioService',
        pid: 5,
        memory: { workingSetSize: 1 },
        creationTime: 50,
      },
      { type: 'Tab', name: 'Tab', pid: 6, memory: { workingSetSize: 4096 }, creationTime: 60 },
    ];
    const found = processMetricsFrom(rows, 6, SERVICES);
    expect(found.map((metric) => [metric.process, metric.pid])).toEqual([
      ['main', 1],
      ['workspace-service', 2],
      ['pty-host', 3],
      ['link-service', 4],
      ['ui', 6],
    ]);
  });
});
