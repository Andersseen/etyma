#!/usr/bin/env node
/**
 * Builds a clean Angular application against the packed tarballs, once per supported
 * Angular version.
 *
 * Etyma is built with Angular 21 and published as Angular Package Format partial
 * declarations, which a consumer's own compiler links at application build time. Whether
 * that works on Angular 22 is not something the repository can answer about itself: it has
 * one Angular version installed and resolves `@etyma/*` through workspace symlinks. So the
 * fixtures live outside the workspace, install the real tarballs with npm, and run a real
 * `ng build`.
 *
 * Angular 22 also requires TypeScript 6, so this is the only place the published
 * declarations meet a compiler a major version newer than the one that wrote them.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { packAll, repoRoot } from './pack.mjs';

const compatRoot = join(repoRoot, 'tools/compat');
const tarballs = join(compatRoot, '.tarballs');
const consumer = join(compatRoot, 'consumer');

const only = process.argv[2];

const fixtures = readdirSync(compatRoot)
  .filter(entry => entry.startsWith('angular-'))
  .filter(entry => only === undefined || entry === only)
  .sort();

if (fixtures.length === 0) {
  console.error(only ? `No compatibility fixture named "${only}".` : 'No fixtures found.');
  process.exit(1);
}

function run(command, args, cwd) {
  console.log(`  $ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

console.log('Packing the published packages...');
packAll(tarballs);

for (const fixture of fixtures) {
  const cwd = join(compatRoot, fixture);

  console.log(`\n=== ${fixture} ===`);

  // The consumer source is shared so the two fixtures cannot drift apart and quietly stop
  // testing the same API.
  const source = join(cwd, 'src');
  rmSync(source, { recursive: true, force: true });
  mkdirSync(source, { recursive: true });
  cpSync(consumer, source, { recursive: true });

  // A stale tree would hide a resolution failure, which is the main thing this checks.
  rmSync(join(cwd, 'node_modules'), { recursive: true, force: true });
  rmSync(join(cwd, 'package-lock.json'), { force: true });
  rmSync(join(cwd, 'dist'), { recursive: true, force: true });

  // npm rather than pnpm: a fixture that resolved through the workspace store would be
  // testing the repository again instead of the package.
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], cwd);
  run('npm', ['run', 'typecheck'], cwd);
  run('npm', ['run', 'build'], cwd);

  if (!existsSync(join(cwd, 'dist'))) {
    console.error(`${fixture} produced no build output.`);
    process.exit(1);
  }
}

console.log('\nAll compatibility fixtures built against the packed tarballs.');
