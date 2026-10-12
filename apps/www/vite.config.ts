import analog from '@analogjs/platform';
import { etymaRemoteContract, etymaRemoteValidation } from '@etyma/tooling/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

import { catalogUrl, I18N_PROJECT } from './src/app/i18n/project.js';

/**
 * Cloudflare Pages deploys one directory, and everything has to be inside it.
 *
 * Analog's Cloudflare preset puts `_worker.js` in Nitro's public directory but leaves
 * `_routes.json`, `_headers` and `_redirects` in the output directory above it, so a
 * deploy of the public directory alone silently loses them - every request would reach
 * the worker, including the ones for hashed static assets. Collapsing the two directories
 * into one puts the whole deployable in `pages_build_output_dir`.
 */
const cloudflareOutput =
  process.env['BUILD_PRESET'] === 'cloudflare-pages'
    ? { nitro: { output: { dir: 'dist/analog/public', publicDir: 'dist/analog/public' } } }
    : {};

export default defineConfig(({ mode }) => ({
  build: {
    target: ['es2022'],
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    ...(mode === 'test'
      ? []
      : [
          etymaRemoteContract({
            source: catalogUrl(I18N_PROJECT.sourceLocale),
            output: 'src/app/i18n/etyma.generated.ts',
          }),
          etymaRemoteValidation({
            remote: I18N_PROJECT.remote,
            locales: I18N_PROJECT.locales,
            sourceLocale: I18N_PROJECT.sourceLocale,
            allowedMissingKeys: ['docs.sourceOnly'],
          }),
        ]),
    tailwindcss(),
    analog({
      ssr: true,
      ...cloudflareOutput,
      // Nothing is prerendered. Every response is a real server render of a real request,
      // which is the only way the canonical and hreflang URLs can carry the origin the
      // visitor actually asked for - a build-time render has no request to read one from.
      prerender: { routes: [] },
    }),
  ],
  test: {
    name: '@etyma/www',
    globals: false,
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
}));
