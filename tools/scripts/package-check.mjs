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
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { contentsOf, manifestOf, packAll, readJson, repoRoot, runtimePackages } from './pack.mjs';

const failures = [];

/**
 * Every package's public entry points, exactly. A new subpath - or a lost one - is a public
 * API decision, so it has to be made here on purpose rather than arrive through a build
 * configuration change. `@etyma/cli` is a binary only: it has no importable entry point.
 */
const intendedEntryPoints = {
  '@etyma/core': ['.', './package.json'],
  '@etyma/angular': ['.', './package.json'],
  '@etyma/analog': ['.', './package.json'],
  '@etyma/astro': ['.', './package.json'],
  '@etyma/tooling': ['.', './vite', './source', './package.json'],
  '@etyma/cli': ['./package.json'],
};

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
    throw new Error(`${command} ${args.join(' ')}\n${error.stdout ?? ''}${error.stderr ?? ''}`, {
      cause: error,
    });
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
      // A binary-only package has no declarations for anything to resolve.
      if (intendedEntryPoints[pkg.name]?.every(entry => entry === './package.json')) return;

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

    check('exports exactly its intended entry points, each with types', () => {
      const expected = intendedEntryPoints[pkg.name];
      const actual = Object.keys(manifest.exports ?? {}).sort();

      assert(expected !== undefined, `no intended entry points recorded for ${pkg.name}`);
      assert(
        JSON.stringify(actual) === JSON.stringify([...expected].sort()),
        `exports ${actual.join(', ') || '(nothing)'}; intended ${expected.join(', ')}`,
      );

      for (const entry of actual.filter(entry => entry !== './package.json')) {
        assert(manifest.exports[entry].types !== undefined, `"${entry}" has no types condition`);
      }
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
  const astro = packages.find(pkg => pkg.name === '@etyma/astro');
  const tooling = packages.find(pkg => pkg.name === '@etyma/tooling');
  const cli = packages.find(pkg => pkg.name === '@etyma/cli');

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

  check('the runtime trio agree on one version', () => {
    const runtime = packages.filter(pkg =>
      runtimePackages.some(name => pkg.name === `@etyma/${name}`),
    );
    const versions = new Set(runtime.map(pkg => manifestOf(pkg.tarball).version));

    assert(versions.size === 1, `fixed versioning is broken: ${[...versions].join(', ')}`);
  });

  check(
    '@etyma/astro depends on nothing from Angular/Analog, and only @etyma/core among Etyma packages',
    () => {
      const manifest = manifestOf(astro.tarball);

      const peers = Object.keys(manifest.peerDependencies ?? {});
      assert(
        peers.length === 1 && peers[0] === 'astro',
        `@etyma/astro's only peer dependency should be "astro", not: ${peers.join(', ') || '(none)'}`,
      );

      const dependencies = Object.keys(manifest.dependencies ?? {});
      const etymaDependencies = dependencies.filter(name => name.startsWith('@etyma/'));

      assert(
        etymaDependencies.length === 1 && etymaDependencies[0] === '@etyma/core',
        `@etyma/astro must depend on exactly @etyma/core among Etyma packages, not: ` +
          `${etymaDependencies.join(', ') || '(none)'} - it must not depend on @etyma/angular ` +
          'or @etyma/analog, which would make it a port rather than an independent adapter.',
      );

      const frameworks = dependencies.filter(
        name => name.startsWith('@angular/') || name.startsWith('@analogjs/') || name === 'rxjs',
      );
      assert(
        frameworks.length === 0,
        `@etyma/astro must not depend on Angular/Analog/RxJS: ${frameworks.join(', ')}`,
      );
    },
  );

  check('@etyma/astro is versioned independently of the runtime trio', () => {
    const changesetConfig = readJson(join(repoRoot, '.changeset/config.json'));
    const groups = [...(changesetConfig.fixed ?? []), ...(changesetConfig.linked ?? [])];

    assert(
      !groups.some(group => group.includes('@etyma/astro')),
      "@etyma/astro must not be listed in .changeset/config.json's `fixed` or `linked` " +
        'groups - it releases on its own schedule, not whenever Angular/Analog change.',
    );
  });

  check(
    '@etyma/tooling depends on nothing from a framework, and only @etyma/core among Etyma packages',
    () => {
      const manifest = manifestOf(tooling.tarball);

      assert(
        Object.keys(manifest.peerDependencies ?? {}).length === 0,
        'a development tooling package should need no peers at all',
      );

      const dependencies = Object.keys(manifest.dependencies ?? {});
      const etymaDependencies = dependencies.filter(name => name.startsWith('@etyma/'));

      assert(
        etymaDependencies.length === 1 && etymaDependencies[0] === '@etyma/core',
        `@etyma/tooling must depend on exactly @etyma/core among Etyma packages, not: ` +
          `${etymaDependencies.join(', ') || '(none)'}`,
      );
    },
  );

  check('@etyma/tooling/vite ships both Vite plugins, and the main entry reaches neither', () => {
    const manifest = manifestOf(tooling.tarball);
    const files = contentsOf(tooling.tarball);
    const vite = manifest.exports?.['./vite'];

    assert(
      vite?.types === './dist/vite.d.ts' && vite?.default === './dist/vite.js',
      `unexpected "./vite" export: ${JSON.stringify(vite)}`,
    );

    const declarations = readFileSync(join(tooling.extracted, 'dist/vite.d.ts'), 'utf8');
    for (const name of ['etymaRemoteContract', 'etymaRemoteValidation']) {
      assert(declarations.includes(name), `dist/vite.d.ts does not declare ${name}`);
    }

    assert(
      !files.some(file => file.includes('__testing__')),
      'the loopback test server in src/__testing__ was packed',
    );

    // `import { validateCatalogs } from '@etyma/tooling'` must stay network-free: walk the
    // packed main entry's relative imports and make sure none of them is the remote code.
    const pending = ['index.js'];
    const reached = new Set();

    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      if (reached.has(file)) continue;
      reached.add(file);

      const source = readFileSync(join(tooling.extracted, 'dist', file), 'utf8');
      assert(!/\bfetch\(/.test(source), `dist/${file}, reachable from the main entry, calls fetch`);

      for (const [, specifier] of source.matchAll(/from '\.\/([^']+)'/g)) pending.push(specifier);
    }

    const leaked = [...reached].filter(file => /vite|remote|source/.test(file));
    assert(leaked.length === 0, `the main entry reaches ${leaked.join(', ')}`);

    // The TypeScript parser belongs to `./source` alone: validating a catalog must not pay to
    // load it, so nothing the main entry reaches may import it - at runtime or in its types.
    for (const file of reached) {
      for (const extension of ['js', 'd.ts']) {
        const path = join(tooling.extracted, 'dist', file.replace(/\.js$/, `.${extension}`));
        const text = readFileSync(path, 'utf8');
        assert(
          !/from 'typescript'/.test(text),
          `dist/${file.replace(/\.js$/, `.${extension}`)}, reachable from the main entry, imports typescript`,
        );
      }
    }
  });

  check(
    '@etyma/tooling/source ships the analyzer, reaches the TypeScript parser, and nothing with I/O',
    () => {
      const manifest = manifestOf(tooling.tarball);
      const source = manifest.exports?.['./source'];

      assert(
        source?.types === './dist/source.d.ts' && source?.default === './dist/source.js',
        `unexpected "./source" export: ${JSON.stringify(source)}`,
      );
      assert(
        typeof manifest.dependencies?.typescript === 'string',
        'typescript must be a runtime dependency: the published ./source entry imports it',
      );

      const declarations = readFileSync(join(tooling.extracted, 'dist/source.d.ts'), 'utf8');
      assert(declarations.includes('analyzeMessageUsage'), 'dist/source.d.ts does not declare it');

      const pending = ['source.js'];
      const reached = new Set();
      const parserImporters = [];

      for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
        if (reached.has(file)) continue;
        reached.add(file);

        // Declarations must not leak parser types into a consumer's compilation either.
        const base = file.replace(/\.js$/, '');
        const declared = readFileSync(join(tooling.extracted, 'dist', `${base}.d.ts`), 'utf8');
        assert(!/typescript/.test(declared), `dist/${base}.d.ts mentions typescript`);

        const text = readFileSync(join(tooling.extracted, 'dist', file), 'utf8');
        const code = text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

        assert(!/\bfetch\(/.test(code), `dist/${file}, reachable from ./source, calls fetch`);
        assert(!/from 'node:/.test(code), `dist/${file}, reachable from ./source, imports node:`);
        assert(!/\bprocess\./.test(code), `dist/${file}, reachable from ./source, uses process`);
        assert(!/\bconsole\./.test(code), `dist/${file}, reachable from ./source, uses console`);

        if (/from 'typescript'/.test(code)) parserImporters.push(file);
        for (const [, specifier] of text.matchAll(/from '\.\/([^']+)'/g)) pending.push(specifier);
      }

      assert(
        parserImporters.join(',') === 'source-scan.js',
        `the parser should be imported by source-scan.js alone, not: ${parserImporters.join(', ') || '(nothing)'}`,
      );

      const leaked = [...reached].filter(file => /vite|remote/.test(file));
      assert(leaked.length === 0, `./source reaches ${leaked.join(', ')}`);
    },
  );

  check(
    '@etyma/cli depends on nothing from a framework, and only @etyma/tooling among Etyma packages',
    () => {
      const manifest = manifestOf(cli.tarball);

      assert(
        Object.keys(manifest.peerDependencies ?? {}).length === 0,
        'CLI development tooling should need no peers at all',
      );

      const dependencies = Object.keys(manifest.dependencies ?? {});
      const etymaDependencies = dependencies.filter(name => name.startsWith('@etyma/'));

      assert(
        etymaDependencies.length === 1 && etymaDependencies[0] === '@etyma/tooling',
        `@etyma/cli must depend on exactly @etyma/tooling among Etyma packages, not: ` +
          `${etymaDependencies.join(', ') || '(none)'} - catalog semantics must not be ` +
          `duplicated, and @etyma/core should only be reached through tooling`,
      );
    },
  );

  check('@etyma/cli has @etyma/tooling as its only runtime dependency', () => {
    const dependencies = Object.keys(manifestOf(cli.tarball).dependencies ?? {});

    // Remote validation uses Node's native `fetch` and `AbortSignal.timeout`. An HTTP client
    // library appearing here would be a second network stack shipped to every CI install.
    assert(
      dependencies.length === 1 && dependencies[0] === '@etyma/tooling',
      `@etyma/cli's only runtime dependency should be @etyma/tooling, not: ${dependencies.join(', ') || '(none)'}`,
    );
  });

  check('@etyma/cli ships a working `etyma` binary entry', () => {
    const manifest = manifestOf(cli.tarball);
    const files = contentsOf(cli.tarball);

    assert(manifest.bin?.etyma !== undefined, 'no "etyma" entry in the "bin" map');

    const binPath = manifest.bin.etyma.replace(/^\.\//, '');
    assert(
      files.includes(binPath),
      `"bin.etyma" points at "${binPath}", which is not in the tarball`,
    );
  });

  check('@etyma/cli keeps the TypeScript parser outside every non-analyze startup graph', () => {
    const reached = new Set();
    const pending = ['dist/bin.js'];

    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      if (reached.has(file)) continue;
      reached.add(file);

      const source = readFileSync(join(cli.extracted, file), 'utf8');
      assert(
        !/from ['"]@etyma\/tooling\/source['"]|import\(['"]@etyma\/tooling\/source['"]\)/.test(
          source,
        ),
        `${file} eagerly imports @etyma/tooling/source`,
      );
      assert(!/from ['"]typescript['"]/.test(source), `${file} statically imports typescript`);

      for (const match of source.matchAll(/from ['"](\.\/[^'"]+)['"]/g)) {
        const specifier = match[1];
        assert(specifier !== undefined, `could not read static import from ${file}`);
        if (specifier.endsWith('.js')) pending.push(join(file, '..', specifier));
      }
    }

    assert(
      ![...reached].some(file => file.endsWith('/commands/analyze.js')),
      'the non-analyze startup graph reaches commands/analyze.js',
    );
    assert(
      reached.has('dist/cli.js'),
      'the packed binary startup graph does not reach the CLI dispatcher',
    );
  });
} finally {
  rmSync(workspace, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} package check(s) failed.`);
  process.exit(1);
}

console.log('\nAll package checks passed.');
