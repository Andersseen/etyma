import { defineI18n } from '@etyma/core';
import { describe, expect, it } from 'vitest';

/**
 * Regression coverage, deliberately with NO `vi.mock('astro:i18n', ...)` anywhere in this
 * file: `astro:i18n` is a virtual module that only exists inside Astro's own Vite pipeline.
 * This package's entry point must not statically import it at module scope, or merely
 * importing `@etyma/astro` - even just for its exported types - would throw in a plain
 * Node/Vitest environment that never runs Astro's dev/build pipeline. Real-world consumers
 * hit exactly this: any application module that imports a type from `@etyma/astro`
 * alongside unrelated code becomes untestable in plain Vitest if this regresses.
 */
describe('importing @etyma/astro outside Astro (no astro:i18n mock)', () => {
  it('resolves without touching `astro:i18n`', async () => {
    await expect(import('./index.js')).resolves.toBeDefined();
  });

  it('only reaches for `astro:i18n` once createAstroI18n() is actually called', async () => {
    const { createAstroI18n } = await import('./index.js');

    const definition = defineI18n({
      locales: ['es'],
      sourceLocale: 'es',
      source: { home: { title: 'Inicio' } },
    });

    // No mock is registered, so the real (nonexistent, outside Astro) `astro:i18n` module
    // fails to resolve at call time - proving the import was genuinely deferred, not just
    // silently swallowed.
    await expect(
      createAstroI18n({ currentLocale: 'es', url: new URL('https://example.com/') }, definition),
    ).rejects.toThrow();
  });
});
