#!/usr/bin/env node
/**
 * REFERENCE CODE. Copy to scripts/guard.mjs unchanged. Task 001 installs it as the
 * git pre-commit hook. It enforces the table in spec/04-implementer-protocol.md.
 *
 * Exit code 0 lets the commit through. Any other code blocks it and prints why.
 * Run `node scripts/guard.mjs --no-check` to apply the file rules without running
 * `npm run check` (used by the guard's own self-test only).
 */
import { execFileSync, spawnSync } from 'node:child_process';

const READ_ONLY_PREFIXES = ['spec/', 'tasks/', 'docs/'];
const READ_ONLY_FILES = ['GLOSSARY.md', 'CLAUDE.md'];
/** May be created once (task 001), never changed after. */
const CREATE_ONLY_FILES = ['scripts/guard.mjs', 'scripts/hooks/pre-commit', 'scripts/init.ps1'];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function headVersion(path) {
  try {
    return git(['show', `HEAD:${path}`]);
  } catch {
    return null;
  }
}

function stagedVersion(path) {
  return git(['show', `:${path}`]);
}

function stagedChanges() {
  const out = git(['diff', '--cached', '--name-status', '--no-renames', '-z']);
  const parts = out.split('\0').filter((part) => part !== '');
  const changes = [];
  for (let i = 0; i < parts.length; i += 2) changes.push({ status: parts[i], path: parts[i + 1] });
  return changes;
}

function checkFeatures(before, after, problems) {
  let oldList;
  let newList;
  try {
    oldList = JSON.parse(before);
    newList = JSON.parse(after);
  } catch {
    problems.push('features.json must stay valid JSON.');
    return;
  }
  const oldFeatures = oldList.features ?? [];
  const newFeatures = newList.features ?? [];
  if (oldFeatures.length !== newFeatures.length) {
    problems.push('features.json: features may not be added or removed.');
    return;
  }
  oldFeatures.forEach((oldFeature, index) => {
    const newFeature = newFeatures[index];
    const { passes: oldPasses, ...oldRest } = oldFeature;
    const { passes: newPasses, ...newRest } = newFeature ?? {};
    if (JSON.stringify(oldRest) !== JSON.stringify(newRest)) {
      problems.push(`features.json: only "passes" may change (feature ${oldFeature.id}).`);
    }
    if (oldPasses === true && newPasses !== true) {
      problems.push(`features.json: a passing feature may not be set back to failing (${oldFeature.id}).`);
    }
  });
}

function checkAppendOnly(path, before, after, problems) {
  if (!after.startsWith(before)) problems.push(`${path}: may only be appended to.`);
}

function checkTestGrowsOnly(path, before, after, problems) {
  const kept = new Set(after.split(/\r?\n/));
  const removed = before.split(/\r?\n/).filter((line) => line.trim() !== '' && !kept.has(line));
  if (removed.length > 0) {
    problems.push(`${path}: existing test lines may not be removed or changed. First one: ${removed[0].trim()}`);
  }
}

function main() {
  const problems = [];

  for (const { status, path } of stagedChanges()) {
    const isReadOnly = READ_ONLY_FILES.includes(path) || READ_ONLY_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (isReadOnly) {
      problems.push(`${path}: is read-only for the implementer.`);
      continue;
    }

    const before = headVersion(path);
    if (CREATE_ONLY_FILES.includes(path) && before !== null) {
      problems.push(`${path}: was created by task 001 and may not change.`);
      continue;
    }
    if (status === 'D') {
      if (path === 'features.json' || path === 'PROGRESS.md' || path.startsWith('tests/')) {
        problems.push(`${path}: may not be deleted.`);
      }
      continue;
    }
    if (before === null) continue;

    const after = stagedVersion(path);
    if (path === 'features.json') checkFeatures(before, after, problems);
    else if (path === 'PROGRESS.md') checkAppendOnly(path, before, after, problems);
    else if (path.startsWith('tests/') && /\.test\.tsx?$/.test(path)) checkTestGrowsOnly(path, before, after, problems);
  }

  if (problems.length > 0) {
    console.error('Commit blocked by scripts/guard.mjs:');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  if (!process.argv.includes('--no-check')) {
    const check = spawnSync('npm', ['run', 'check'], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (check.status !== 0) {
      console.error('Commit blocked: `npm run check` failed.');
      process.exit(1);
    }
  }
}

main();
