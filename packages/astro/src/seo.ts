import type { I18nDefinition, Locale } from '@etyma/core';

import type { AstroSeoData } from './types.js';

/**
 * The slice of `astro:i18n` this module needs, passed in rather than imported at module
 * scope - see `create-astro-i18n.ts` for why: a static top-level `import ... from
 * 'astro:i18n'` would make importing anything from this package fail outside Astro's own
 * Vite pipeline, which resolves that virtual module.
 */
export interface AstroI18nRoutingHelpers {
  getAbsoluteLocaleUrl(locale: string, path?: string): string;
  getLocaleByPath(path: string): string;
}

/**
 * Builds SEO metadata for the current page, from the actual BCP 47 locale rather than the
 * Astro route path it happens to be served from.
 *
 * `getAbsoluteLocaleUrl` does the routing work - including honouring `Astro.site`, `base`
 * and `trailingSlash` - so this only has to know which logical path to ask it for in every
 * locale, and to key the alternate set by language code instead of by URL segment.
 */
export function buildSeo<TKey extends string>(
  definition: I18nDefinition<TKey>,
  locale: Locale,
  pathname: string,
  astroI18n: AstroI18nRoutingHelpers,
): AstroSeoData {
  const bare = stripLocalePrefix(pathname, locale, astroI18n);

  return Object.freeze({
    lang: locale,
    direction: definition.directionOf(locale),
    canonical: astroI18n.getAbsoluteLocaleUrl(locale, bare),
    alternates: Object.freeze(
      definition.locales.map(code => ({
        hreflang: code,
        href: astroI18n.getAbsoluteLocaleUrl(code, bare),
      })),
    ),
    xDefault: astroI18n.getAbsoluteLocaleUrl(definition.sourceLocale, bare),
  });
}

/**
 * The current page's logical path, with its locale segment removed.
 *
 * The segment removed is whatever Astro actually put in the URL - `"ua"`, not `"uk"` - so
 * this asks `astro:i18n` which locale a segment belongs to rather than comparing it to
 * `locale` directly, which would silently fail to strip a custom route path.
 */
function stripLocalePrefix(
  pathname: string,
  locale: Locale,
  astroI18n: AstroI18nRoutingHelpers,
): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const [first, ...rest] = segments;

  if (first === undefined) {
    return undefined;
  }

  let matched: Locale | undefined;

  try {
    matched = astroI18n.getLocaleByPath(first);
  } catch {
    matched = undefined;
  }

  const remaining = matched === locale ? rest : segments;

  return remaining.length === 0 ? undefined : remaining.join('/');
}
