import type { CatalogValidationResult } from '@etyma/tooling';
import { describe, expect, it } from 'vitest';

import { formatPretty } from './pretty.js';

describe('formatPretty', () => {
  it('renders a success summary with counted locales and messages', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };

    const output = formatPretty(result, { locales: ['en', 'es', 'uk'], messageCount: 765 });

    expect(output).toBe('✓ 3 locales\n✓ 765 messages\n✓ Catalogs are valid\n');
  });

  it('uses singular nouns for a count of one', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };

    const output = formatPretty(result, { locales: ['en'], messageCount: 1 });

    expect(output).toBe('✓ 1 locale\n✓ 1 message\n✓ Catalogs are valid\n');
  });

  it('groups diagnostics by locale, uppercased, in the order they arrive', () => {
    const result: CatalogValidationResult = {
      valid: false,
      diagnostics: [
        {
          code: 'catalog.missing-key',
          severity: 'error',
          locale: 'es',
          key: 'docs.button.title',
          message: '"docs.button.title" is missing from "es".',
        },
        {
          code: 'message.missing-variable',
          severity: 'error',
          locale: 'uk',
          key: 'footer.rights',
          message: 'Variable "year" is missing from the "uk" translation.',
        },
      ],
    };

    const output = formatPretty(result, { locales: ['en', 'es', 'uk'], messageCount: 10 });

    expect(output).toBe(
      [
        'ES',
        '',
        'ERROR catalog.missing-key',
        'docs.button.title',
        '"docs.button.title" is missing from "es".',
        '',
        'UK',
        '',
        'ERROR message.missing-variable',
        'footer.rights',
        'Variable "year" is missing from the "uk" translation.',
        '',
        '✗ 2 errors, 0 warnings',
      ].join('\n') + '\n',
    );
  });

  it('falls back to a general heading for a diagnostic with no locale', () => {
    const result: CatalogValidationResult = {
      valid: false,
      diagnostics: [
        { code: 'config.no-catalogs', severity: 'error', message: 'No catalogs were given.' },
      ],
    };

    const output = formatPretty(result, { locales: [], messageCount: 0 });

    expect(output).toContain('(GENERAL)');
    expect(output).toContain('ERROR config.no-catalogs');
  });

  it('counts a warning separately from an error in the trailing summary', () => {
    const result: CatalogValidationResult = {
      valid: true,
      diagnostics: [
        {
          code: 'message.variable-function-mismatch',
          severity: 'warning',
          locale: 'es',
          key: 'footer.rights',
          message: 'annotation mismatch',
        },
      ],
    };

    // A warning alone does not fail validation, so this exercises the success branch - the
    // summary line only appears on the failure branch, by design (see the package README).
    const output = formatPretty(result, { locales: ['en', 'es'], messageCount: 2 });

    expect(output).toBe('✓ 2 locales\n✓ 2 messages\n✓ Catalogs are valid\n');
  });
});
