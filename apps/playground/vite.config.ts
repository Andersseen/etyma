import analog from '@analogjs/platform';
import { etymaRemoteContract } from '@etyma/tooling/vite';
import { defineConfig } from 'vite';

/**
 * Gives every non-source catalog a chunk whose name does not move between builds.
 *
 * Lazy locale loading is a promise Etyma makes, and a promise nobody can check is not one.
 * A stable name lets the end-to-end suite assert both halves of it: the chunk exists and is
 * separate from the entry bundle, and the browser never requests it after a server render
 * has already sent that catalog in transfer state.
 */
function localeChunk(id: string): string | undefined {
  const locale = /\/app\/i18n\/([a-z-]+)\.json$/.exec(id)?.[1];

  // English is the source catalog and is imported statically, so it belongs in the entry
  // bundle. Splitting it would only add a request for something every page needs.
  return locale !== undefined && locale !== 'en' ? `etyma-locale-${locale}` : undefined;
}

/**
 * Cloudflare Pages deploys one directory, and everything has to be inside it.
 *
 * Analog's Cloudflare preset puts `_worker.js` in Nitro's public directory but leaves
 * `_routes.json`, `_headers` and `_redirects` in the output directory above it, so a
 * deploy of the public directory alone silently loses them - every request would reach the
 * worker, including the ones for hashed static assets. Collapsing the two directories into
 * one puts the whole deployable in `pages_build_output_dir`.
 */
const cloudflareOutput =
  process.env['BUILD_PRESET'] === 'cloudflare-pages'
    ? { nitro: { output: { dir: 'dist/analog/public', publicDir: 'dist/analog/public' } } }
    : {};

export default defineConfig(({ isSsrBuild }) => ({
  build: {
    target: ['es2022'],
    // Chunk naming is a client-bundle concern; the server build inlines its imports.
    ...(isSsrBuild ? {} : { rollupOptions: { output: { manualChunks: localeChunk } } }),
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    // Regenerates the remote-mode demo's typed key contract from its fixture catalog's
    // shape before dev or build ever needs it - see src/app/i18n/remote/remote-i18n.ts.
    // The generated file is committed, so this is a refresh, not a first-time requirement.
    etymaRemoteContract({
      load: () => import('./src/app/i18n/remote/fixture-source.js').then(m => m.default),
      output: 'src/app/i18n/remote/contract.generated.ts',
    }),
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
    name: '@etyma/playground',
    globals: false,
    environment: 'jsdom',
    setupFiles: ['vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
}));
