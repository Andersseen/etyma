#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const cwd = process.cwd();
const requireFromFixture = createRequire(join(cwd, 'package.json'));
const toolingPackage = requireFromFixture.resolve('@etyma/tooling/package.json');
const compilerPackage = requireFromFixture.resolve('@angular/compiler/package.json');
const compilerMajor = Number(
  JSON.parse(readFileSync(compilerPackage, 'utf8')).version.split('.')[0],
);
assert([21, 22].includes(compilerMajor), `unexpected compiler major ${compilerMajor}`);

const tooling = await import(pathToFileURL(join(dirname(toolingPackage), 'dist/angular.js')));
const direct = tooling.analyzeAngularMessageUsage({
  keys: ['nav.home', 'nav.docs'],
  files: [
    {
      path: 'src/app.ts',
      source:
        `import { Component } from '@angular/core';\n` +
        `import { injectT } from '@etyma/angular';\n` +
        `@Component({ templateUrl: './app.html' })\n` +
        `export class App { readonly t = injectT(definition); }`,
    },
    { path: 'src/app.html', source: `{{ t('nav.home') }} {{ t('nav.typo') }}` },
  ],
});
assert.deepEqual(direct.used, ['nav.home']);
assert.equal(direct.diagnostics[0]?.code, 'source.unknown-key');
assert.equal(direct.diagnostics[0]?.path, 'src/app.html');

const project = join(cwd, '.etyma-angular-tooling-smoke');
rmSync(project, { recursive: true, force: true });
mkdirSync(join(project, 'src'), { recursive: true });
mkdirSync(join(project, 'i18n'), { recursive: true });
writeFileSync(
  join(project, 'i18n/en.json'),
  JSON.stringify({ nav: { home: 'Home', docs: 'Docs' } }),
);
writeFileSync(
  join(project, 'src/app.ts'),
  `import { Component } from '@angular/core';\n` +
    `import { injectT } from '@etyma/angular';\n` +
    `@Component({ templateUrl: './app.html' })\n` +
    `export class App { readonly t = injectT(definition); }\n` +
    `const t = injectT(definition); t('nav.docs');`,
);
writeFileSync(
  join(project, 'src/app.html'),
  `{{ t('nav.home') }} {{ t('nav.typo') }} {{ t(key) }}`,
);
const binary = join(cwd, 'node_modules/.bin/etyma');
const cli = spawnSync(
  binary,
  ['analyze', 'src', '--catalog', 'i18n/en.json', '--angular', '--format', 'json'],
  {
    cwd: project,
    encoding: 'utf8',
  },
);
assert.equal(cli.status, 1, cli.stderr || cli.stdout);
const output = JSON.parse(cli.stdout);
assert.deepEqual(output.used, ['nav.docs', 'nav.home']);
assert.deepEqual(output.unreferenced, []);
assert.equal(output.meta.mode, 'angular');
assert(
  output.diagnostics.some(
    item => item.code === 'source.dynamic-key' && item.severity === 'warning',
  ),
);
assert(
  output.diagnostics.some(item => item.code === 'source.unknown-key' && item.severity === 'error'),
);
rmSync(project, { recursive: true, force: true });
console.log(`  ok   packed Angular ${compilerMajor} tooling API and CLI --angular smoke`);
