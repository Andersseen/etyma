#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const requireFromFixture = createRequire(join(cwd, 'package.json'));
requireFromFixture.resolve('@etyma/tooling/package.json');
assert.throws(() => requireFromFixture.resolve('@angular/compiler/package.json'));
assert.throws(() => requireFromFixture.resolve('@astrojs/compiler/package.json'));
assert.throws(() => requireFromFixture.resolve('@astrojs/compiler-rs/package.json'));

const binary = join(cwd, 'node_modules/.bin/etyma');
for (const args of [
  ['--help'],
  ['validate', '--help'],
  ['contract', '--help'],
  ['analyze', '--help'],
]) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')} failed: ${result.stderr}`);
}

const project = join(cwd, '.etyma-non-angular-smoke');
mkdirSync(join(project, 'src'), { recursive: true });
mkdirSync(join(project, 'i18n'), { recursive: true });
writeFileSync(
  join(project, 'i18n/en.json'),
  JSON.stringify({ nav: { home: 'Home', unused: 'Unused' } }),
);
writeFileSync(
  join(project, 'src/app.ts'),
  `import { injectT } from '@etyma/angular';\nconst t = injectT(definition); t('nav.home');`,
);
writeFileSync(join(project, 'src/page.astro'), `<p>no optional parser installed</p>`);
const normal = spawnSync(
  binary,
  ['analyze', 'src', '--catalog', 'i18n/en.json', '--format', 'json'],
  {
    cwd: project,
    encoding: 'utf8',
  },
);
assert.equal(normal.status, 0, normal.stderr || normal.stdout);
const output = JSON.parse(normal.stdout);
assert.deepEqual(output.used, ['nav.home']);
assert.deepEqual(output.unreferenced, ['nav.unused']);
assert.equal(output.meta.mode, undefined);

const angular = spawnSync(binary, ['analyze', 'src', '--catalog', 'i18n/en.json', '--angular'], {
  cwd: project,
  encoding: 'utf8',
});
assert.equal(angular.status, 2);
assert.match(angular.stderr, /Angular analysis requires @angular\/compiler \^21 \|\| \^22/);
assert.doesNotMatch(angular.stderr, /ERR_MODULE_NOT_FOUND|node_modules/);
const astro = spawnSync(binary, ['analyze', 'src', '--catalog', 'i18n/en.json', '--astro'], {
  cwd: project,
  encoding: 'utf8',
});
assert.equal(astro.status, 2);
assert.match(
  astro.stderr,
  /Astro analysis requires @astrojs\/compiler \^4 .* or @astrojs\/compiler-rs \^0\.5/,
);
assert.doesNotMatch(astro.stderr, /ERR_MODULE_NOT_FOUND|node_modules/);
console.log('  ok   packed non-Angular CLI without @angular/compiler');
