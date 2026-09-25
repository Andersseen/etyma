import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // `astro:i18n` only exists inside Astro's own Vite pipeline; here it resolves to a
        // faithful fake. An alias rather than `vi.mock` alone: Vitest cannot serve a mocked
        // module that does not exist to overlapping dynamic imports, and concurrent renders -
        // exactly what the prerender catalog specs exercise - import it concurrently.
        resolve: {
          alias: {
            'astro:i18n': fileURLToPath(
              new URL('./src/__fixtures__/fake-astro-i18n.ts', import.meta.url),
            ),
          },
        },
        test: {
          name: '@etyma/astro',
          environment: 'node',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/import-without-astro.spec.ts'],
          // Typed message keys and the typed `AstroI18nContext` boundary are a feature, so
          // the types are asserted rather than assumed: `expectTypeOf` only means anything
          // when the compiler actually runs over it.
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
            tsconfig: 'tsconfig.json',
          },
        },
      },
      {
        // Without the alias: this spec proves the package imports cleanly where `astro:i18n`
        // cannot be resolved at all.
        test: {
          name: '@etyma/astro (outside Astro)',
          environment: 'node',
          include: ['src/import-without-astro.spec.ts'],
        },
      },
    ],
  },
});
