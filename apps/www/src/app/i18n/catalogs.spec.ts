import { createMessageFormatter, flattenMessages } from '@etyma/core';
import { describe, expect, it } from 'vitest';

import es from './es.json';
import contract from './etyma.generated';
import uk from './uk.json';
import { i18n } from './i18n';

/**
 * Keys that only the source catalog has, on purpose.
 *
 * The site carries one so the fallback path is exercised by a real page rather than
 * only by a unit test. Listing it here is what keeps this suite a drift detector: any
 * *other* key going missing from a translation fails, and adding one to the list is a
 * deliberate act with a diff attached.
 */
const SOURCE_ONLY = new Set(['docs.sourceOnly']);

const catalogs = { es, uk } as const;

/** `en.json` is the whole source catalog; `defineI18n` flattens it into these keys. */
const sourceKeys: ReadonlySet<string> = new Set<string>(i18n.keys);

describe('the website catalogs', () => {
  it('agree on the locales the definition declares', () => {
    expect(i18n.locales).toEqual(['en', 'es', 'uk']);
    expect(i18n.sourceLocale).toBe('en');
  });

  it('take every source key from en.json, including the SEO messages', () => {
    expect(sourceKeys.has('seo.siteName')).toBe(true);
    expect(sourceKeys.has('nav.docs')).toBe(true);
  });

  it('are described exactly by the committed contract', () => {
    // `defineI18n` already throws on a key mismatch; this names the drift in a test report
    // instead of a module-load error. Param drift is `etyma contract --check`'s job.
    expect([...contract.keys].sort()).toEqual([...sourceKeys].sort());
  });

  for (const [locale, catalog] of Object.entries(catalogs)) {
    describe(locale, () => {
      const keys = new Set(flattenMessages(catalog).keys());

      it('translates every key the source catalog defines', () => {
        const missing = [...sourceKeys].filter(key => !keys.has(key) && !SOURCE_ONLY.has(key));

        expect(missing).toEqual([]);
      });

      it('defines no key the source catalog does not', () => {
        const extra = [...keys].filter(key => !sourceKeys.has(key));

        expect(extra).toEqual([]);
      });

      it('contains only patterns MessageFormat 2 can parse', () => {
        // A malformed pattern is invisible until the page that uses it is opened in the one
        // language it is broken in, which on a three-language site is most of the time.
        const problems: string[] = [];
        const formatter = createMessageFormatter({
          onIssue: issue => problems.push(`${issue.key}: ${String(issue.error)}`),
        });

        for (const [key, pattern] of flattenMessages(catalog)) {
          formatter.format(locale, key, pattern, {
            count: 1,
            year: 2026,
            name: 'x',
            state: 'beta',
            on: new Date(),
          });
        }

        expect(problems).toEqual([]);
      });
    });
  }

  it('keeps the source-only key out of the translations, so fallback is exercised', () => {
    for (const catalog of Object.values(catalogs)) {
      const keys = new Set(flattenMessages(catalog).keys());

      for (const key of SOURCE_ONLY) {
        expect(keys.has(key)).toBe(false);
      }
    }
  });
});
