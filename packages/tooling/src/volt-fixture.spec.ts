import { describe, expect, it } from 'vitest';

import { voltEn, voltEs, voltUk } from './__fixtures__/volt.js';
import { validateCatalog } from './validate-catalog.js';
import { validateCatalogs } from './validate-catalogs.js';

describe('a realistic nested documentation catalog', () => {
  it('validates every locale on its own', () => {
    for (const [locale, catalog] of [
      ['en', voltEn],
      ['es', voltEs],
      ['uk', voltUk],
    ] as const) {
      expect(validateCatalog({ locale, catalog })).toEqual({ valid: true, diagnostics: [] });
    }
  });

  it('validates as a full set with no diagnostics', () => {
    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: { en: voltEn, es: voltEs, uk: voltUk },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('catches a missing key the runtime would silently fall back for', () => {
    // Etyma's runtime falls back to the source catalog when a secondary locale lacks a key,
    // so a page never breaks - but the catalog contract has still drifted, and the point of
    // static validation is to say so before a translator finds out from a stale string.
    const { footer: _footer, ...esMissingKey } = voltEs;

    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: { en: voltEn, es: esMissingKey, uk: voltUk },
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'catalog.missing-key',
        locale: 'es',
        key: 'footer.rights',
      }),
    );
  });

  it('catches a dropped variable in a real translated message', () => {
    const esDroppedVariable: typeof voltEs = {
      ...voltEs,
      footer: { rights: '© Volt UI' },
    };

    const result = validateCatalogs({
      sourceLocale: 'en',
      catalogs: { en: voltEn, es: esDroppedVariable, uk: voltUk },
    });

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'message.missing-variable',
        locale: 'es',
        key: 'footer.rights',
      }),
    );
  });
});
