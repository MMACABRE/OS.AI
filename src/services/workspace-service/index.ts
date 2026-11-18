import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';

console.log('workspace-service');

const folder = mkdtempSync(join(tmpdir(), 'hsos-sqlite-'));
const database = new Database(join(folder, 'spike.db'));
database.exec('CREATE TABLE spike (id INTEGER PRIMARY KEY, text TEXT NOT NULL)');
database.prepare('INSERT INTO spike (text) VALUES (?)').run('sqlite-ok');
console.log(`workspace-service row: ${JSON.stringify(database.prepare('SELECT id, text FROM spike').get())}`);
database.close();
rmSync(folder, { recursive: true, force: true });
