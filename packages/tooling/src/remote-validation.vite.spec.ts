/// <reference types="node" />

import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build, createLogger, createServer } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { json, startFixtureServer } from './__testing__/fixture-server.js';
import type { FixtureServer, RouteHandler } from './__testing__/fixture-server.js';
import { etymaRemoteValidation } from './vite.js';

/**
 * The plugin inside a real Vite, rather than calling `buildStart()` by hand: proves Vite
 * accepts the structural plugin object, calls its hooks in the order the plugin assumes, and
 * surfaces a thrown error as a failed build.
 */

const en = { nav: { docs: 'Docs' } };
const es = { nav: { docs: 'Documentación' } };

let root: string;
let server: FixtureServer | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'etyma-remote-validation-vite-'));
  writeFileSync(join(root, 'main.js'), 'export const answer = 42;\n');
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  rmSync(root, { recursive: true, force: true });
});

async function serve(routes: Record<string, RouteHandler>): Promise<string> {
  server = await startFixtureServer(routes);
  return server.origin;
}

function recordingLogger() {
  const warnings: string[] = [];
  const logger = createLogger('silent');

  logger.warn = message => {
    warnings.push(message);
  };

  return { warnings, logger };
}

function viteBuild(origin: string) {
  return build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      etymaRemoteValidation({
        remote: `${origin}/i18n/{locale}.json`,
        locales: ['en', 'es'],
        sourceLocale: 'en',
      }),
    ],
    build: { write: false, lib: { entry: join(root, 'main.js'), formats: ['es'] } },
  });
}

describe('etymaRemoteValidation inside Vite', () => {
  it('lets `vite build` pass on valid remote catalogs, without writing anything', async () => {
    const origin = await serve({ '/i18n/en.json': json(en), '/i18n/es.json': json(es) });

    await expect(viteBuild(origin)).resolves.toBeDefined();

    expect(server?.requests).toHaveLength(2);
    expect(readdirSync(root)).toEqual(['main.js']);
  });

  it('fails `vite build` on an invalid remote catalog', async () => {
    const origin = await serve({ '/i18n/en.json': json(en), '/i18n/es.json': json({ nav: {} }) });

    await expect(viteBuild(origin)).rejects.toThrow(
      /remote catalog validation failed[\s\S]*catalog\.missing-key {2}nav\.docs/,
    );
    expect(readdirSync(root)).toEqual(['main.js']);
  });

  it('fails `vite build` when a remote catalog cannot be fetched', async () => {
    const origin = await serve({ '/i18n/en.json': json(en) });

    await expect(viteBuild(origin)).rejects.toThrow(/could not load 1 of 2[\s\S]*HTTP 404/);
  });

  it('starts the dev server on an invalid remote catalog, warning through its logger', async () => {
    const origin = await serve({ '/i18n/en.json': json(en), '/i18n/es.json': json({ nav: {} }) });
    const { warnings, logger } = recordingLogger();

    const dev = await createServer({
      root,
      configFile: false,
      customLogger: logger,
      server: { port: 0, host: '127.0.0.1', ws: false },
      plugins: [
        etymaRemoteValidation({
          remote: `${origin}/i18n/{locale}.json`,
          locales: ['en', 'es'],
          sourceLocale: 'en',
        }),
      ],
    });

    try {
      await dev.listen();

      expect(warnings.join('\n')).toContain('catalog.missing-key  nav.docs');
      expect(server?.requests).toHaveLength(2);
    } finally {
      await dev.close();
    }
  });
});
