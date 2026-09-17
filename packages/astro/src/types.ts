import type { APIContext } from 'astro';
import type { Locale, MessageParams, MessagePart, TextDirection } from '@etyma/core';

/**
 * The slice of Astro's own request context that Etyma needs.
 *
 * A structural subset of `APIContext` - which `AstroGlobal` (the `Astro` in a `.astro`
 * file's frontmatter) already extends - rather than either type in full. That is what lets
 * `createAstroI18n` be called the same way from a page and from a middleware handler, and
 * what lets a test build one of these from a plain object instead of a real Astro request.
 */
export type AstroI18nContext = Pick<APIContext, 'currentLocale' | 'url'>;

/** One entry of a page's `hreflang` set, keyed by BCP 47 language code - never a route path. */
export interface AstroSeoAlternate {
  readonly hreflang: Locale;
  readonly href: string;
}

/**
 * Everything a localized page's `<head>` needs to tell the truth about which page it is.
 *
 * Data, not markup: this package renders nothing. A consumer reads these fields into
 * whatever `<head>` templating its own layout already uses.
 */
export interface AstroSeoData {
  /** The actual BCP 47 language code, e.g. `"uk"` - not the Astro route path, e.g. `"ua"`. */
  readonly lang: Locale;
  readonly direction: TextDirection;
  readonly canonical: string;
  /** Every translation of this page, including itself, plus `x-default`. */
  readonly alternates: readonly AstroSeoAlternate[];
  readonly xDefault: string;
}

/**
 * Etyma's translation API for one Astro render.
 *
 * Created fresh by {@link createAstroI18n} for each page, from the locale Astro already
 * resolved for the current request - never held across renders and never backed by module-
 * level state, so two concurrent SSR requests in two languages share nothing.
 */
export interface AstroI18n<TKey extends string = string> {
  /** The actual BCP 47 language code for this render, e.g. `"uk"` for the `/ua` route. */
  readonly locale: Locale;
  readonly sourceLocale: Locale;
  readonly locales: readonly Locale[];
  readonly direction: TextDirection;

  /** The translated, formatted string. Always text - never markup. */
  t(key: TKey, params?: MessageParams): string;

  /** The message as MessageFormat 2 parts, for structure `t()` cannot express as text. */
  parts(key: TKey, params?: MessageParams): readonly MessagePart[];

  /** Whether `key` resolves in this locale or in the source locale. */
  has(key: TKey): boolean;

  /**
   * The path `to` as Astro serves it in `locale`, defaulting to the current one.
   *
   * `to` is a logical path such as `/blog`, with an optional query string and fragment -
   * both are preserved. Built entirely on `astro:i18n`'s own URL helpers, so a custom route
   * path such as `ua` for the `uk` locale is honoured automatically.
   */
  path(to: string, locale?: Locale): string;

  /** SEO metadata for the current page: canonical, `hreflang` alternates, `x-default`. */
  seo(): AstroSeoData;
}
