import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CatalogDirectoryError, discoverCatalogFiles, readCatalogFiles } from './local-catalogs.js';

function fixture(name: string): string {
  return fileURLToPath(new URL(`../__fixtures__/${name}`, import.meta.url));
}

describe('discoverCatalogFiles', () => {
  it('finds every *.json file and derives its locale from the filename', async () => {
    const files = await discoverCatalogFiles(fixture('valid'));

    expect(files).toEqual([
      { locale: 'en', path: fixture('valid/en.json') },
      { locale: 'es', path: fixture('valid/es.json') },
      { locale: 'uk', path: fixture('valid/uk.json') },
    ]);
  });

  it('sorts by locale deterministically regardless of filesystem order', async () => {
    const first = await discoverCatalogFiles(fixture('valid'));
    const second = await discoverCatalogFiles(fixture('valid'));

    expect(first.map(file => file.locale)).toEqual(['en', 'es', 'uk']);
    expect(second).toEqual(first);
  });

  it('ignores non-json files without treating them as ambiguous', async () => {
    const files = await discoverCatalogFiles(fixture('unrelated-files'));

    expect(files.map(file => file.locale)).toEqual(['en', 'es']);
  });

  it('derives locales with region and script subtags from the filename', async () => {
    const files = await discoverCatalogFiles(fixture('canonical-duplicate'));

    expect(files.map(file => file.locale).sort()).toEqual(['en', 'he', 'iw']);
  });

  it('throws CatalogDirectoryError for a directory that does not exist', async () => {
    await expect(discoverCatalogFiles(fixture('does-not-exist'))).rejects.toThrow(
      CatalogDirectoryError,
    );
  });
});

describe('readCatalogFiles', () => {
  it('parses every file and returns its data', async () => {
    const discovered = await discoverCatalogFiles(fixture('valid'));
    const results = await readCatalogFiles(discovered);

    expect(results.every(result => result.error === undefined)).toBe(true);
    expect(results.find(result => result.locale === 'en')?.data).toEqual({
      nav: { docs: 'Docs' },
      footer: { rights: '© {$year :number useGrouping=never}' },
    });
  });

  it('reports a malformed file as an error instead of throwing', async () => {
    const discovered = await discoverCatalogFiles(fixture('malformed-json'));
    const results = await readCatalogFiles(discovered);

    const broken = results.find(result => result.locale === 'es');
    const clean = results.find(result => result.locale === 'en');

    expect(broken?.error).toBeDefined();
    expect(broken?.data).toBeUndefined();
    expect(clean?.error).toBeUndefined();
  });
});
