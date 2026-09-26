/**
 * A faithful, minimal re-implementation of the `astro:i18n` functions this package calls,
 * for the one locale table every spec in this directory tests against:
 *
 * ```
 * locales: ['es', 'en', { path: 'ua', codes: ['uk'] }]
 * defaultLocale: 'es'
 * ```
 *
 * `es` is unprefixed (the default locale, `routing.prefixDefaultLocale: false` - Astro's
 * own default); `en` is served at `/en`; `uk` is served at `/ua`, Astro's stand-in for a
 * route path that is not the language code.
 *
 * Not a general Astro test double - the algorithms mirror `astro/dist/i18n/index.js` and
 * `astro/dist/i18n/utils.js` closely enough to exercise this package's logic correctly, but
 * this file exists so unit tests do not need a real Astro request. The real proof against
 * actual Astro behaviour is the `tools/compat/astro-*` fixtures' `astro build`, one per
 * supported Astro major, not this fixture.
 */
type LocaleEntry = string | { readonly path: string; readonly codes: readonly string[] };

const locales: readonly LocaleEntry[] = ['es', 'en', { path: 'ua', codes: ['uk'] }];
const defaultLocale = 'es';

let site: string | undefined;

/** Lets a spec opt into absolute URLs, the way `astro.config`'s `site` would. */
export function setSite(value: string | undefined): void {
  site = value;
}

export function getPathByLocale(locale: string): string {
  for (const entry of locales) {
    if (typeof entry === 'string') {
      if (entry === locale) return entry;
      continue;
    }

    if (entry.codes.includes(locale)) return entry.path;
  }

  throw new Error(`fake astro:i18n: no locale "${locale}" configured.`);
}

export function getLocaleByPath(path: string): string {
  for (const entry of locales) {
    if (typeof entry === 'string') {
      if (entry === path) return entry;
      continue;
    }

    if (entry.path === path) {
      const [first] = entry.codes;
      if (first === undefined) throw new Error('fake astro:i18n: locale entry has no codes.');
      return first;
    }
  }

  throw new Error(`fake astro:i18n: no locale for path "${path}".`);
}

export function pathHasLocale(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);

  return segments.some(segment =>
    locales.some(entry => (typeof entry === 'string' ? entry === segment : entry.path === segment)),
  );
}

export function getRelativeLocaleUrl(locale: string, path?: string): string {
  const localePath = getPathByLocale(locale);
  const segments = [...(locale === defaultLocale ? [] : [localePath]), ...(path ? [path] : [])];

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

export function getAbsoluteLocaleUrl(locale: string, path?: string): string {
  const relative = getRelativeLocaleUrl(locale, path);

  if (site === undefined) {
    return relative;
  }

  return relative === '/' ? site : `${site}${relative}`;
}
