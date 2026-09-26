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
  {
    path: 'about/index.html',
    lang: 'es',
    canonical: `${SITE}/about/`,
    xDefault: `${SITE}/about/`,
    contains: ['Sobre mí', 'Escribo sobre Astro.'],
  },
  {
    path: 'en/about/index.html',
    lang: 'en',
    canonical: `${SITE}/en/about/`,
    xDefault: `${SITE}/about/`,
    contains: ['About', 'I write about Astro.'],
  },
  {
    path: 'ua/about/index.html',
    lang: 'uk',
    canonical: `${SITE}/ua/about/`,
    xDefault: `${SITE}/about/`,
    contains: ['Про мене', 'Я пишу про Astro.'],
  },
];

const expectedAlternates = [
  { hreflang: 'es', bare: '' },
  { hreflang: 'en', bare: 'en/' },
  { hreflang: 'uk', bare: 'ua/' },
];

export function verifyAstroFixture(cwd) {
  const distDir = join(cwd, 'dist');
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
      const section = /(blog|about)\//.exec(page.path)?.[0] ?? '';
      const bareForThisPage = `${alternate.bare}${section}`;
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

  verifyCatalogRequests(cwd, assert);
  verifyRemoteContract(cwd, assert);

  return failures;
}

/**
 * The fixture prerenders three pages per locale, several at a time, from remote catalogs.
 * `@etyma/astro` must load each catalog once for the whole build - the count follows the
 * locales, never the pages. Requests from `@etyma/tooling`'s build-time validation are a
 * separate consumer and are only reported.
 */
function verifyCatalogRequests(cwd, assert) {
  const { tooling, render } = readCatalogRequests(cwd);
  const locales = ['es', 'en', 'uk'];

  console.log(
    `  catalog requests while rendering ${pages.length} pages: ${JSON.stringify(render)}`,
  );
  console.log(`  catalog requests from etymaRemoteValidation: ${JSON.stringify(tooling)}`);

  for (const locale of locales) {
    assert(
      render[locale] === 1,
      `expected exactly 1 render-time request for the "${locale}" catalog across the whole ` +
        `build, got ${render[locale] ?? 0} - catalogs are being loaded per page`,
    );
  }

  assert(
    Object.keys(render).every(locale => locales.includes(locale)),
    `unexpected render-time catalog requests: ${JSON.stringify(render)}`,
  );
}

/**
 * Astro runs several Vite passes per `astro build`, all with the same plugin objects, so each
 * pass calls `etymaRemoteContract`'s `buildStart` again. The source catalog must still be
 * fetched once per build, and the contract generated from it must be the fixture's.
 */
function verifyRemoteContract(cwd, assert) {
  const { contract } = readCatalogRequests(cwd);

  console.log(`  catalog requests from etymaRemoteContract: ${JSON.stringify(contract)}`);

  assert(
    JSON.stringify(contract) === JSON.stringify({ es: 1 }),
    `expected etymaRemoteContract to fetch only the source catalog, once per build, got ` +
      `${JSON.stringify(contract)} - it is refreshing on every Vite pass`,
  );

  const generated = readFileSync(join(cwd, 'contract.generated.ts'), 'utf8');
  const expectedKeys = [
    'about.body',
    'about.title',
    'footer.rights',
    'home.greeting',
    'home.title',
    'nav.blog',
    'posts.count',
  ];

  for (const key of expectedKeys) {
    assert(generated.includes(`"${key}"`), `contract.generated.ts: expected key "${key}"`);
  }
}

function readCatalogRequests(cwd) {
  return JSON.parse(readFileSync(join(cwd, 'catalog-requests.json'), 'utf8'));
}

function firstHtmlTag(html) {
  const match = /<html[^>]*>/.exec(html);

  return match?.[0] ?? '(no <html> tag found)';
}
