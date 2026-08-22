import type { Locale } from './locale.js';

export interface LocaleRouterOptions {
  readonly locales: readonly Locale[];
  readonly sourceLocale: Locale;
}

/**
 * Translates between a logical path (`/docs/button`) and the path a locale is served at
 * (`/es/docs/button`).
 *
 * The source locale is served unprefixed: `/docs/button` is the URL the site already has,
 * and moving it to `/en/docs/button` for symmetry costs a redirect on every existing link
 * into the site. Every other locale is prefixed, which is the only shape a search engine
 * indexes once per language.
 *
 * Pure string work, so the same rules run in the browser, on the server and in a test with
 * no router in sight.
 */
export interface LocaleRouter {
  readonly locales: readonly Locale[];
  readonly sourceLocale: Locale;

  /**
   * Whether `value` is one of the configured locales.
   *
   * Returns a plain boolean rather than a type predicate. `Locale` is `string`, so a
   * predicate would narrow the *failing* branch to `never` and turn every error message
   * that mentions the rejected value into a compile error.
   */
  isLocale(value: string | null | undefined): boolean;

  /** The locale a URL belongs to, taken from its first path segment. */
  localeOf(path: string): Locale;

  /** The same page with its locale prefix removed. Query and hash survive. */
  strip(path: string): string;

  /** The same page in `locale`. Round-trips: `localize(localize(p, 'es'), 'en') === p`. */
  localize(path: string, locale: Locale): string;
}

export function createLocaleRouter(options: LocaleRouterOptions): LocaleRouter {
  const locales = [...options.locales];
  const known = new Set(locales);
  const { sourceLocale } = options;

  const isLocale = (value: string | null | undefined): boolean =>
    typeof value === 'string' && known.has(value);

  const strip = (path: string): string => {
    const { pathname, suffix } = split(path);
    const segments = pathname.split('/').filter(Boolean);

    if (isLocale(segments[0])) {
      segments.shift();
    }

    return `/${segments.join('/')}${suffix}`;
  };

  return {
    locales,
    sourceLocale,
    isLocale,
    strip,

    localeOf(path) {
      const [first] = split(path).pathname.split('/').filter(Boolean);

      return first !== undefined && isLocale(first) ? first : sourceLocale;
    },

    localize(path, locale) {
      const bare = strip(path);

      if (locale === sourceLocale) {
        return bare;
      }

      const { pathname, suffix } = split(bare);

      return pathname === '/' ? `/${locale}${suffix}` : `/${locale}${pathname}${suffix}`;
    },
  };
}

/** Splits `/es/docs?a=1#b` into its pathname and everything after it. */
function split(path: string): { pathname: string; suffix: string } {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const cut = normalized.search(/[?#]/);

  if (cut === -1) {
    return { pathname: normalized, suffix: '' };
  }

  return { pathname: normalized.slice(0, cut), suffix: normalized.slice(cut) };
}
