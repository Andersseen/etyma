import { flattenMessages } from '@etyma/core';
import { describe, expect, it } from 'vitest';

import { myBlogEn, myBlogEs, myBlogUk } from './__fixtures__/my-blog.js';
import { extractContractKeys } from './generate-contract.js';
import { validateCatalogs } from './validate-catalogs.js';

describe("my-blog's pre-migration catalogs, with string arrays", () => {
  it('validates as a full set with no diagnostics', () => {
    const result = validateCatalogs({
      sourceLocale: 'es',
      catalogs: { es: myBlogEs, en: myBlogEn, uk: myBlogUk },
    });

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it('flattens to the numbered keys the migration had to write by hand, zero-based', () => {
    expect(extractContractKeys(myBlogEs)).toEqual([
      'about.paragraphs.0',
      'about.paragraphs.1',
      'footer.rights',
      'home.editorialPoints.0',
      'home.editorialPoints.1',
      'home.editorialPoints.2',
      'home.editorialPoints.3',
    ]);
    expect(flattenMessages(myBlogEs).get('home.editorialPoints.3')).toBe(
      'Contenido alineado con Andersseen Dev',
    );
  });

  it('catches a translation that dropped the last editorial point', () => {
    const result = validateCatalogs({
      sourceLocale: 'es',
      catalogs: {
        es: myBlogEs,
        en: { ...myBlogEn, home: { editorialPoints: myBlogEn.home.editorialPoints.slice(0, 3) } },
      },
    });

    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'catalog.missing-key',
        locale: 'en',
        key: 'home.editorialPoints.3',
      }),
    ]);
  });
});
