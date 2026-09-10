import { describe, expect, it } from 'vitest';

import type { MessageSource } from '@etyma/core';

import { validateCatalogs } from './validate-catalogs.js';

/**
 * A catalog large enough to expose an accidentally quadratic implementation — comparing
 * every key against every other key, or re-parsing a source message once per translation -
 * without making the suite slow or timing-sensitive. This asserts correctness at scale, not
 * a duration: a hand implementation that regresses to O(locales * keys²) would time out
 * against Vitest's own default test timeout long before any assertion here could fail, which
 * is a more stable signal than asserting on elapsed milliseconds.
 */
function syntheticCatalog(messageCount: number, missingFrom?: Set<number>): MessageSource {
  const source: Record<string, string> = {};

  for (let i = 0; i < messageCount; i += 1) {
    if (!missingFrom?.has(i)) {
      source[`key${i}`] = `Message number {$index :number} of ${i}`;
    }
  }

  return source;
}

describe('validateCatalogs: performance at scale', () => {
  it('validates several thousand messages across multiple locales without quadratic blowup', () => {
    const messageCount = 3000;
    const missing = new Set([10, 500, 2000]);

    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: {
        en: syntheticCatalog(messageCount),
        es: syntheticCatalog(messageCount, missing),
        uk: syntheticCatalog(messageCount),
      },
    });

    const missingKeyDiagnostics = result.diagnostics.filter(d => d.code === 'catalog.missing-key');

    expect(missingKeyDiagnostics).toHaveLength(missing.size);
    expect(result.diagnostics.every(d => d.locale === 'es')).toBe(true);
    expect(result.valid).toBe(false);
  });
});
