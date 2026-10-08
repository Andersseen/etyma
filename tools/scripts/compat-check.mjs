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
 * - astro-6: Astro 6, `@etyma/astro` (the major its declarations are built against)
 * - astro-7: Astro 7 (Vite 8 / Rolldown), `@etyma/astro`
 * - core-large-catalog: plain `@etyma/core`, no framework, typing a large generated catalog
 *
 * Angular 22 also requires TypeScript 6, so this is the only place the published Angular
 * declarations meet a compiler a major version newer than the one that wrote them. Astro 7
 * plays the same role for `@etyma/astro`, and for `@etyma/tooling/vite` running under Vite 8.
 *
 * Fixtures are discovered by directory prefix: a new major is a new directory whose
 * `package.json` pins it, with no change to this script. Every fixture in a family builds
 * the same shared consumer source - for Astro, including its `astro.config` - so the
 * matrix proves the same API on every major rather than a different app per version.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packAll, repoRoot } from './pack.mjs';
import { verifyAstroFixture } from './verify-astro-fixture.mjs';
import { verifyCoreFixture } from './verify-core-fixture.mjs';

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
    verify: cwd => verifyAstroFixture(cwd),
    verified: 'generated HTML and catalog request counts match expectations',
    // `etymaRemoteContract` writes `contract.generated.ts` during the build, and the consumer
    // type-checks `t()` against that generated file - so `astro check` has to run after it.
    typecheckAfterBuild: true,
  },
  {
    prefix: 'core-',
    consumer: join(compatRoot, 'consumer-core'),
    verify: cwd => verifyCoreFixture(cwd),
    // The build generates the catalog, the contract and the consumer before compiling them.
    typecheckAfterBuild: true,
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

function verifyPackedWithoutAngularCompiler() {
  const cwd = mkdtempSync(join(tmpdir(), 'etyma-packed-no-angular-'));
  try {
    const toolingTarball = join(tarballs, 'etyma-tooling.tgz');
    const cliTarball = join(tarballs, 'etyma-cli.tgz');
    const coreTarball = join(tarballs, 'etyma-core.tgz');
    writeFileSync(
      join(cwd, 'package.json'),
      JSON.stringify(
        {
          name: 'etyma-packed-no-angular',
          version: '0.0.0',
          private: true,
          type: 'module',
          dependencies: {
            '@etyma/core': `file:${coreTarball}`,
            '@etyma/tooling': `file:${toolingTarball}`,
            '@etyma/cli': `file:${cliTarball}`,
          },
        },
        null,
        2,
      ),
    );
    run('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], cwd);
    run('node', [join(repoRoot, 'tools/scripts/verify-no-angular-cli.mjs')], cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

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
  rmSync(join(cwd, 'catalog-requests.json'), { force: true });
  rmSync(join(cwd, 'contract.generated.ts'), { force: true });

  // npm rather than pnpm: a fixture that resolved through the workspace store would be
  // testing the repository again instead of the package.
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], cwd);
  if (!family.typecheckAfterBuild) run('npm', ['run', 'typecheck'], cwd);
  run('npm', ['run', 'build'], cwd);
  if (family.typecheckAfterBuild) run('npm', ['run', 'typecheck'], cwd);

  if (fixture === 'angular-21' || fixture === 'angular-22') {
    run(
      'npm',
      [
        'install',
        '--no-save',
        '--no-audit',
        '--no-fund',
        '--loglevel',
        'error',
        join(tarballs, 'etyma-tooling.tgz'),
        join(tarballs, 'etyma-cli.tgz'),
      ],
      cwd,
    );
    run('node', [join(repoRoot, 'tools/scripts/verify-angular-tooling-fixture.mjs')], cwd);
  }

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

    console.log(`  ok   ${family.verified ?? 'build output matches expectations'}`);
  }
}

if (only === undefined) verifyPackedWithoutAngularCompiler();

console.log('\nAll compatibility fixtures built against the packed tarballs.');
