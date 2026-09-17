#!/usr/bin/env node
/**
 * Builds clean applications against the packed tarballs, for every framework Etyma adapts.
 *
 * `@etyma/core`, `@etyma/angular` and `@etyma/analog` resolve through the workspace inside
 * this repository, which proves nothing about what an application installing the published
 * packages from npm would actually get - a missing `exports` condition, an Angular Package
 * Format partial declaration a newer compiler refuses to link, a `astro:i18n` import that
 * only worked because Vite happened to already have it resolved. So every fixture here
 * lives outside the pnpm workspace, installs the real tarballs with npm, and runs a real
 * framework build. The fixture names encode the version axis each one exercises:
 *
 * - angular-21-analog-26: Angular 21, Analog 2.6.x
 * - angular-21: Angular 21, Analog 2.7.x
 * - angular-22: Angular 22, Analog 2.7.x
 * - astro-6: Astro 6.x, `@etyma/astro`
 *
 * Angular 22 also requires TypeScript 6, so this is the only place the published Angular
 * declarations meet a compiler a major version newer than the one that wrote them.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { packAll, repoRoot } from './pack.mjs';
import { verifyAstroFixture } from './verify-astro-fixture.mjs';

const compatRoot = join(repoRoot, 'tools/compat');
const tarballs = join(compatRoot, '.tarballs');

/**
 * Every fixture family: the directory-name prefix that selects it, the shared source
 * copied into each matching fixture's `src`, and how to check what it actually built once
 * `build` has run (beyond "a `dist` directory exists", which every fixture is checked for
 * regardless).
 */
const families = [
  { prefix: 'angular-', consumer: join(compatRoot, 'consumer') },
  {
    prefix: 'astro-',
    consumer: join(compatRoot, 'consumer-astro'),
    verify: cwd => verifyAstroFixture(join(cwd, 'dist')),
  },
];

const only = process.argv[2];

const fixtures = readdirSync(compatRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .filter(name => only === undefined || name === only)
  .map(name => ({ name, family: families.find(family => name.startsWith(family.prefix)) }))
  .filter(({ family }) => family !== undefined)
  .sort((a, b) => a.name.localeCompare(b.name));

if (fixtures.length === 0) {
  console.error(only ? `No compatibility fixture named "${only}".` : 'No fixtures found.');
  process.exit(1);
}

function run(command, args, cwd) {
  console.log(`  $ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

console.log('Building the published packages...');
run('pnpm', ['run', 'build', '--filter=./packages/*'], repoRoot);
console.log('Packing the published packages...');
packAll(tarballs);

for (const { name: fixture, family } of fixtures) {
  const cwd = join(compatRoot, fixture);

  console.log(`\n=== ${fixture} ===`);

  // The consumer source is shared within a family so its fixtures cannot drift apart and
  // quietly stop testing the same API.
  const source = join(cwd, 'src');
  rmSync(source, { recursive: true, force: true });
  mkdirSync(source, { recursive: true });
  cpSync(family.consumer, source, { recursive: true });

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

  if (family.verify) {
    const failures = family.verify(cwd);

    if (failures.length > 0) {
      console.error(`\n${fixture} built, but its output is wrong:`);
      for (const failure of failures) console.error(`  - ${failure}`);
      process.exit(1);
    }

    console.log(`  ok   generated HTML matches the expected locale, routing and SEO output`);
  }
}

console.log('\nAll compatibility fixtures built against the packed tarballs.');
