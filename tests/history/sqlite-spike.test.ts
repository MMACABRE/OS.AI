import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('SQLite spike (card 003)', () => {
  it('opens a database, writes a row and reads it back', () => {
    const folder = mkdtempSync(join(tmpdir(), 'hsos-sqlite-'));
    const database = new Database(join(folder, 'spike.db'));
    database.exec('CREATE TABLE spike (id INTEGER PRIMARY KEY, text TEXT NOT NULL)');
    database.prepare('INSERT INTO spike (text) VALUES (?)').run('sqlite-ok');
    const row: unknown = database.prepare('SELECT id, text FROM spike').get();
    database.close();
    rmSync(folder, { recursive: true, force: true });

    expect(row).toEqual({ id: 1, text: 'sqlite-ok' });
  });
});
