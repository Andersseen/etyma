#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const cwd = process.cwd();
const requireFromFixture = createRequire(join(cwd, 'package.json'));
let parserPackage;
let parserVersion;
try {
  parserPackage = '@astrojs/compiler';
  parserVersion = requireFromFixture(`${parserPackage}/package.json`).version;
} catch {
  parserPackage = '@astrojs/compiler-rs';
  parserVersion = requireFromFixture(`${parserPackage}/package.json`).version;
}
assert(
  (parserPackage === '@astrojs/compiler' && parserVersion.startsWith('4.')) ||
    (parserPackage === '@astrojs/compiler-rs' && parserVersion.startsWith('0.5.')),
  `unexpected Astro parser ${parserPackage}@${parserVersion}`,
);

const astroEntry = requireFromFixture.resolve('@etyma/tooling/astro');
const { analyzeAstroMessageUsage } = await import(pathToFileURL(astroEntry));
const direct = await analyzeAstroMessageUsage({
  keys: ['home.title'],
  files: [
    {
      path: 'pages/index.astro',
      source:
        `---\nimport { createAstroI18n } from '@etyma/astro';\n` +
        `const etyma = await createAstroI18n(Astro, definition);\n---\n` +
        `<h1>{etyma.t('home.title')}</h1>`,
    },
  ],
});
assert.deepEqual(direct.used, ['home.title']);
assert.deepEqual(direct.diagnostics, []);
const malformed = await analyzeAstroMessageUsage({
  keys: [],
  files: [{ path: 'pages/broken.astro', source: '---\nconst broken = ;\n---' }],
});
assert.equal(malformed.diagnostics[0]?.code, 'source.parse-error');
assert.equal(malformed.diagnostics[0]?.path, 'pages/broken.astro');

const project = join(cwd, '.etyma-astro-analysis-smoke');
rmSync(project, { recursive: true, force: true });
mkdirSync(join(project, 'src', '.astro'), { recursive: true });
mkdirSync(join(project, 'i18n'), { recursive: true });
writeFileSync(
  join(project, 'i18n/en.json'),
  JSON.stringify({ home: { title: 'Home' }, nav: { docs: 'Docs', unused: 'Unused' } }),
);
writeFileSync(
  join(project, 'src/app.ts'),
  `import { createAstroI18n } from '@etyma/astro';\n` +
    `const i18n = await createAstroI18n(Astro, definition);\n` +
    `i18n.t('nav.docs');`,
);
writeFileSync(
  join(project, 'src/Page.astro'),
  `---\nimport { createAstroI18n } from '@etyma/astro';\n` +
    `const etyma = await createAstroI18n(Astro, definition);\n---\n` +
    `<h1>{etyma.t('home.title')}</h1>\n` +
    `{etyma.t('nav.typo')} {etyma.t(key)}`,
);
writeFileSync(join(project, 'src/.astro/generated.astro'), `<p>generated</p>`);

const binary = join(cwd, 'node_modules/.bin/etyma');
const cli = spawnSync(
  binary,
  ['analyze', 'src', '--catalog', 'i18n/en.json', '--astro', '--format', 'json'],
  { cwd: project, encoding: 'utf8' },
);
assert.equal(cli.status, 1, cli.stderr || cli.stdout);
const output = JSON.parse(cli.stdout);
assert.deepEqual(output.used, ['home.title', 'nav.docs']);
assert.deepEqual(output.unreferenced, ['nav.unused']);
assert.equal(output.meta.mode, 'astro');
assert.equal(output.meta.fileCount, 2);
assert(
  output.diagnostics.some(item => item.code === 'source.unknown-key' && item.key === 'nav.typo'),
);
assert(
  output.diagnostics.some(
    item => item.code === 'source.dynamic-key' && item.severity === 'warning',
  ),
);
rmSync(project, { recursive: true, force: true });
console.log(
  `  ok   packed @etyma/tooling/astro and CLI --astro with ${parserPackage}@${parserVersion}`,
);
