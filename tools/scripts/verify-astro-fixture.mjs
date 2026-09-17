/**
 * Static acceptance checks for `tools/compat/astro-6`'s build output.
 *
 * A green `astro build` only proves the package resolves and renders *something*; it does
 * not prove Etyma got the one thing this fixture exists to test right - that the Ukrainian
 * route ("/ua") reports its actual language ("uk") everywhere a search engine or a browser
 * reads it, never the route path. `@etyma/astro`'s own unit tests cover the adapter's logic
 * in isolation; this reads the real, generated HTML that a real `astro build` produced
 * against the packed tarballs, which is the only thing that can catch a mismatch between
 * this package's assumptions and Astro's actual behaviour.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://example.com';

/** One page this fixture must produce, and what must be true of its rendered HTML. */
const pages = [
  {
    path: 'index.html',
    lang: 'es',
    canonical: `${SITE}/`,
    xDefault: `${SITE}/`,
    contains: ['Inicio', 'Hola, Mundo!', '© 2026 Mi Blog', '3 artículos'],
  },
  {
    path: 'en/index.html',
    lang: 'en',
    canonical: `${SITE}/en/`,
    xDefault: `${SITE}/`,
    contains: ['Home', 'Hello, Mundo!', '© 2026 My Blog', '3 posts'],
  },
  {
    path: 'ua/index.html',
    lang: 'uk',
    canonical: `${SITE}/ua/`,
    xDefault: `${SITE}/`,
    contains: ['Головна', 'Привіт, Mundo!', '© 2026 Мій блог', '3 статті'],
  },
  {
    path: 'blog/index.html',
    lang: 'es',
    canonical: `${SITE}/blog/`,
    xDefault: `${SITE}/blog/`,
    contains: ['1 artículo', '5 artículos'],
  },
  {
    path: 'en/blog/index.html',
    lang: 'en',
    canonical: `${SITE}/en/blog/`,
    xDefault: `${SITE}/blog/`,
    contains: ['1 post', '5 posts'],
  },
  {
    path: 'ua/blog/index.html',
    lang: 'uk',
    canonical: `${SITE}/ua/blog/`,
    xDefault: `${SITE}/blog/`,
    // Ukrainian plural categories, from CLDR via Intl.PluralRules('uk') - not "one"/"other".
    contains: ['1 стаття', '5 статей'],
  },
];

const expectedAlternates = [
  { hreflang: 'es', bare: '' },
  { hreflang: 'en', bare: 'en/' },
  { hreflang: 'uk', bare: 'ua/' },
];

export function verifyAstroFixture(distDir) {
  const failures = [];

  const assert = (condition, message) => {
    if (!condition) failures.push(message);
  };

  for (const page of pages) {
    const html = readFileSync(join(distDir, page.path), 'utf8');

    assert(
      html.includes(`<html lang="${page.lang}"`),
      `${page.path}: expected <html lang="${page.lang}">, got: ${firstHtmlTag(html)}`,
    );

    // The regression this fixture exists for: the Astro route path ("ua") must never leak
    // into "lang" or "dir" - only the real BCP 47 language code ("uk") may appear there.
    assert(
      !html.includes('lang="ua"'),
      `${page.path}: found lang="ua" - the Astro route path leaked into <html lang>, ` +
        'instead of the resolved language code',
    );

    assert(
      html.includes(`<link rel="canonical" href="${page.canonical}">`),
      `${page.path}: expected canonical "${page.canonical}"`,
    );

    assert(
      html.includes(`hreflang="x-default" href="${page.xDefault}"`),
      `${page.path}: expected x-default "${page.xDefault}"`,
    );

    for (const alternate of expectedAlternates) {
      const bareForThisPage = page.path.includes('blog')
        ? `${alternate.bare}blog/`
        : alternate.bare;
      const expected = `hreflang="${alternate.hreflang}" href="${SITE}/${bareForThisPage}"`;

      assert(html.includes(expected), `${page.path}: expected alternate ${expected}`);
    }

    assert(
      !html.includes('hreflang="ua"'),
      `${page.path}: found hreflang="ua" - hreflang must use the BCP 47 language code ` +
        '("uk"), never the Astro route path ("ua")',
    );

    for (const text of page.contains) {
      assert(html.includes(text), `${page.path}: expected to find "${text}" in the rendered HTML`);
    }
  }

  return failures;
}

function firstHtmlTag(html) {
  const match = /<html[^>]*>/.exec(html);

  return match?.[0] ?? '(no <html> tag found)';
}
