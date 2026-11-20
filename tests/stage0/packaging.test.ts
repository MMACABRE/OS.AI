import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

/** js-yaml ships no types here, so it is loaded through a name the compiler does not resolve. */
const yamlName = 'js-yaml';
const yaml = (await import(/* @vite-ignore */ yamlName)) as unknown as { load: (text: string) => unknown };

type BuilderConfig = {
  appId: string;
  productName: string;
  npmRebuild: boolean;
  asarUnpack: string[];
  extraResources: { from: string; to: string }[];
  nsis: Record<string, unknown>;
  win: { target: { target: string; arch: string[] }[]; icon: string };
};
const config = yaml.load(readFileSync(resolve(root, 'electron-builder.yml'), 'utf8')) as BuilderConfig;

describe('F-010 packaging settings', () => {
  it('F-010 the app id is local.hsos.app and the product name is HSOS', () => {
    expect(config.appId).toBe('local.hsos.app');
    expect(config.productName).toBe('HSOS');
  });

  it('F-010 the NSIS installer is not one-click, per user, and lets the owner pick the folder', () => {
    expect(config.nsis.oneClick).toBe(false);
    expect(config.nsis.perMachine).toBe(false);
    expect(config.nsis.allowToChangeInstallationDirectory).toBe(true);
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
  });

  it('F-010 node-pty and better-sqlite3 are unpacked from the asar archive', () => {
    expect(config.asarUnpack).toContain('node_modules/node-pty/**');
    expect(config.asarUnpack).toContain('node_modules/better-sqlite3/**');
  });

  it('F-010 the built-in themes are copied to the themes folder under resources and npmRebuild is off', () => {
    expect(config.extraResources).toContainEqual(
      expect.objectContaining({ from: 'resources/themes', to: 'themes' }),
    );
    expect(config.npmRebuild).toBe(false);
  });
});

describe('F-010 the app icon', () => {
  it('F-010 resources/icon.ico is an icon file that holds a 256 by 256 image', () => {
    const bytes = readFileSync(resolve(root, config.win.icon));
    // ICONDIR: reserved 0, type 1 (icon), count; each ICONDIRENTRY of 16 bytes starts with width and height, where 0 means 256.
    expect(bytes.readUInt16LE(0)).toBe(0);
    expect(bytes.readUInt16LE(2)).toBe(1);
    const count = bytes.readUInt16LE(4);
    expect(count).toBeGreaterThan(0);
    const sizes = Array.from({ length: count }, (_, index) => {
      const entry = 6 + index * 16;
      return [bytes.readUInt8(entry) || 256, bytes.readUInt8(entry + 1) || 256];
    });
    expect(sizes).toContainEqual([256, 256]);
  });
});
