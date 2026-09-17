import type { CatalogValidationResult } from '@etyma/tooling';
import { describe, expect, it } from 'vitest';

import { formatJson } from './json.js';

describe('formatJson', () => {
  it('carries valid and diagnostics over unchanged, alongside execution metadata', () => {
    const result: CatalogValidationResult = {
      valid: false,
      diagnostics: [
        {
          code: 'catalog.missing-key',
          severity: 'error',
          locale: 'es',
          key: 'nav.docs',
          message: '"nav.docs" is missing from "es".',
        },
      ],
    };

    const output = formatJson(result, {
      directory: '/repo/src/app/i18n',
      sourceLocale: 'en',
      locales: ['en', 'es'],
      messageCount: 12,
    });

    expect(JSON.parse(output)).toEqual({
      valid: false,
      diagnostics: result.diagnostics,
      meta: {
        command: 'validate',
        directory: '/repo/src/app/i18n',
        sourceLocale: 'en',
        locales: ['en', 'es'],
        messageCount: 12,
      },
    });
  });

  it('produces stable, indented output for identical input', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };
    const meta = { directory: '/i18n', sourceLocale: 'en', locales: ['en'], messageCount: 1 };

    expect(formatJson(result, meta)).toBe(formatJson(result, meta));
    expect(formatJson(result, meta).endsWith('\n')).toBe(true);
  });

  it('emits nothing but the JSON object plus a trailing newline', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };
    const output = formatJson(result, {
      directory: '/i18n',
      sourceLocale: 'en',
      locales: ['en'],
      messageCount: 1,
    });

    expect(output.endsWith('}\n')).toBe(true);
    expect(() => {
      JSON.parse(output);
    }).not.toThrow();
  });
});
