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
      mode: 'local',
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
        mode: 'local',
        directory: '/repo/src/app/i18n',
        sourceLocale: 'en',
        locales: ['en', 'es'],
        messageCount: 12,
      },
    });
  });

  it('produces stable, indented output for identical input', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };
    const meta = {
      mode: 'local' as const,
      directory: '/i18n',
      sourceLocale: 'en',
      locales: ['en'],
      messageCount: 1,
    };

    expect(formatJson(result, meta)).toBe(formatJson(result, meta));
    expect(formatJson(result, meta).endsWith('\n')).toBe(true);
  });

  it('emits nothing but the JSON object plus a trailing newline', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };
    const output = formatJson(result, {
      mode: 'local',
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

  it('describes a remote run by its URL template, with no directory', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };

    const output = formatJson(result, {
      mode: 'remote',
      remote: 'https://cdn.example.com/i18n/{locale}.json',
      sourceLocale: 'en',
      locales: ['en', 'es', 'uk'],
      messageCount: 120,
    });

    expect(JSON.parse(output)).toEqual({
      valid: true,
      diagnostics: [],
      meta: {
        command: 'validate',
        mode: 'remote',
        remote: 'https://cdn.example.com/i18n/{locale}.json',
        sourceLocale: 'en',
        locales: ['en', 'es', 'uk'],
        messageCount: 120,
      },
    });
  });

  it('lists command and mode first in meta, so the shape reads the same in both modes', () => {
    const result: CatalogValidationResult = { valid: true, diagnostics: [] };
    const output = formatJson(result, {
      mode: 'remote',
      remote: 'https://cdn.example.com/{locale}.json',
      sourceLocale: 'en',
      locales: ['en'],
      messageCount: 1,
    });

    const meta = (JSON.parse(output) as { meta: object }).meta;

    expect(Object.keys(meta).slice(0, 2)).toEqual(['command', 'mode']);
  });
});
