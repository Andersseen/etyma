#!/usr/bin/env node
/**
 * Validates the packages that would be published, not the source they are built from.
 *
 * Everything here runs against a real `pnpm pack` tarball. A package can typecheck, test
 * and build perfectly and still be unusable once published - a missing `exports` condition,
 * a `workspace:` specifier that escaped rewriting, a declaration file nobody can resolve,
 * a source tree shipped by accident. None of those are visible from inside the repository.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { contentsOf, manifestOf, packAll, repoRoot } from './pack.mjs';

const failures = [];

function check(description, assertion) {
  try {
    assertion();
    console.log(`  ok   ${description}`);
  } catch (error) {
    failures.push(`${description}: ${error.message}`);
    console.log(`  FAIL ${description}`);
    console.log(`       ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  } catch (error) {
    throw new Error(`${command} ${args.join(' ')}\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  }
}

const workspace = mkdtempSync(join(tmpdir(), 'etyma-package-check-'));

try {
  const packages = packAll(join(workspace, 'tarballs'));

  for (const pkg of packages) {
    console.log(`\n${pkg.name}`);

    const manifest = manifestOf(pkg.tarball);
    const files = contentsOf(pkg.tarball);

    check('publint reports no problems', () => {
      run('pnpm', ['exec', 'publint', '--strict', pkg.extracted], repoRoot);
    });

    check('declarations resolve for every consumer', () => {
      // `esm-only` is the correct profile: these packages ship no CommonJS, and a report
      // of "CJS cannot import this" is the intended design rather than a defect.
      run('pnpm', ['exec', 'attw', '--profile', 'esm-only', pkg.tarball], repoRoot);
    });

    check('is ESM only', () => {
      assert(manifest.type === 'module', 'package.json is missing "type": "module"');
      assert(
        !files.some(file => file.endsWith('.cjs')),
        `ships CommonJS: ${files.filter(file => file.endsWith('.cjs')).join(', ')}`,
      );
    });

    check('declares an exports map with types', () => {
      assert(manifest.exports?.['.'] !== undefined, 'no "." entry in exports');
      assert(manifest.exports['.'].types !== undefined, 'the "." export has no types condition');
      assert(manifest.exports['./package.json'] !== undefined, 'package.json is not exported');
    });

    check('has no unresolved workspace specifiers', () => {
      const specifiers = Object.entries({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      }).filter(([, range]) => String(range).startsWith('workspace:'));

      assert(
        specifiers.length === 0,
        `would publish unresolvable ranges: ${specifiers.map(([n, r]) => `${n}@${r}`).join(', ')}`,
      );
    });

    check('keeps Angular out of runtime dependencies', () => {
      const runtime = Object.keys(manifest.dependencies ?? {});
      const frameworks = runtime.filter(
        name => name.startsWith('@angular/') || name.startsWith('@analogjs/'),
      );

      assert(
        frameworks.length === 0,
        `${frameworks.join(', ')} must be peer dependencies, not dependencies`,
      );
    });

    check('ships no sources, tests or build configuration', () => {
      const unwanted = files.filter(
        file =>
          (file.endsWith('.ts') && !file.endsWith('.d.ts')) ||
          file.includes('.spec.') ||
          file.startsWith('src/') ||
          file.startsWith('tsconfig') ||
          file === 'ng-package.json' ||
          file === 'vitest.config.ts',
      );

      assert(unwanted.length === 0, `unexpected files: ${unwanted.join(', ')}`);
    });

    check('ships a licence', () => {
      assert(files.includes('LICENSE'), 'no LICENSE in the tarball');
      assert(manifest.license === 'MIT', `license is ${String(manifest.license)}, expected MIT`);
    });

    check('is marked side-effect free', () => {
      assert(manifest.sideEffects === false, 'sideEffects is not false');
    });

    check('publishes publicly', () => {
      assert(manifest.publishConfig?.access === 'public', 'publishConfig.access is not "public"');
      assert(manifest.publishConfig?.provenance === true, 'provenance is not enabled');
    });
  }

  const core = packages.find(pkg => pkg.name === '@etyma/core');

  console.log('\ncross-package');

  check('@etyma/core depends on nothing from a framework', () => {
    const manifest = manifestOf(core.tarball);

    assert(
      Object.keys(manifest.peerDependencies ?? {}).length === 0,
      'the portable engine should need no peers at all',
    );
    assert(
      Object.keys(manifest.dependencies ?? {}).join(',') === 'messageformat',
      `unexpected runtime dependencies: ${Object.keys(manifest.dependencies ?? {}).join(', ')}`,
    );
  });

  check('the three packages agree on one version', () => {
    const versions = new Set(packages.map(pkg => manifestOf(pkg.tarball).version));

    assert(versions.size === 1, `fixed versioning is broken: ${[...versions].join(', ')}`);
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} package check(s) failed.`);
  process.exit(1);
}

console.log('\nAll package checks passed.');
