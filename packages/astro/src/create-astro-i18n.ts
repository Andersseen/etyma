import {
  createCatalogRegistry,
  createMessageFormatter,
  createTranslator,
  EtymaError,
  type I18nDefinition,
  type Locale,
} from '@etyma/core';

import { buildSeo, type AstroI18nRoutingHelpers } from './seo.js';
import type { AstroI18n, AstroI18nContext } from './types.js';

/** The slice of `astro:i18n` this module calls, imported lazily - see below. */
interface AstroI18nModule extends AstroI18nRoutingHelpers {
  getRelativeLocaleUrl(locale: string, path?: string): string;
  pathHasLocale(path: string): boolean;
}

/**
 * Builds Etyma's translation API for one Astro render.
 *
 * Astro decides the locale - from the URL, through the `i18n` routing configured in
 * `astro.config` - and this reads that decision off `Astro.currentLocale` rather than
 * re-deriving it from the path. Everything downstream (loading the catalog, formatting,
 * localized paths, SEO metadata) is scoped to this one call and shares nothing with any
 * other render, static or concurrent.
 *
 * ```astro
 * ---
 * import { createAstroI18n } from '@etyma/astro';
 * import { i18n } from '../i18n';
 *
 * const etyma = await createAstroI18n(Astro, i18n);
 * ---
 * <html lang={etyma.locale} dir={etyma.direction}>
 *   <h1>{etyma.t('home.title')}</h1>
 * </html>
 * ```
 *
 * Works the same way for a static build and for a server-rendered route: both give
 * `Astro.currentLocale` a value, and neither is treated as a special case here.
 */
export async function createAstroI18n<TKey extends string>(
  astro: AstroI18nContext,
  definition: I18nDefinition<TKey>,
): Promise<AstroI18n<TKey>> {
  // Imported here, lazily, rather than as a static top-level `import ... from 'astro:i18n'`:
  // that virtual module only resolves inside Astro's own Vite pipeline, so a static import
  // would make importing *anything* from this package - even just its exported types -
  // throw in a plain Node/Vitest environment that never runs Astro's dev/build pipeline.
  const astroI18n: AstroI18nModule = await import('astro:i18n');

  const locale = resolveCurrentLocale(astro, definition, astroI18n);

  const formatter = createMessageFormatter(definition.formatting);
  // No `snapshot` and no `onChange`: a Astro render is one pass, with no hydration step to
  // transfer state to, so there is nothing here for a transfer payload to serve.
  const registry = createCatalogRegistry(definition);

  await registry.load(locale);

  const translator = createTranslator<TKey>({
    locale,
    catalog: registry.get(locale),
    sourceLocale: definition.sourceLocale,
    sourceCatalog: registry.get(definition.sourceLocale),
    formatter,
    onMissingMessage: definition.onMissingMessage,
  });

  const path = (to: string, target: Locale = locale): string => {
    assertKnownLocale(definition, target);

    const { pathname, search, hash } = new URL(to, 'https://etyma.invalid');

    if (astroI18n.pathHasLocale(pathname)) {
      throw new EtymaError(
        `createAstroI18n: path() expects a bare logical path (e.g. "/blog"), but "${to}" ` +
          'already contains a locale segment. This usually happens when the current, ' +
          'already-prefixed `Astro.url.pathname` is passed in directly - to link the ' +
          "current page in another locale, use `seo().alternates` instead, which already " +
          'strips the current locale segment for you.',
      );
    }

    return `${astroI18n.getRelativeLocaleUrl(target, bareArg(pathname))}${search}${hash}`;
  };

  const api: AstroI18n<TKey> = {
    locale,
    sourceLocale: definition.sourceLocale,
    locales: definition.locales,
    direction: definition.directionOf(locale),
    t: (key, params) => translator.translate(key, params),
    parts: (key, params) => translator.translateToParts(key, params),
    has: key => translator.has(key),
    path,
    seo: () => buildSeo(definition, locale, astro.url.pathname, astroI18n),
  };

  return Object.freeze(api);
}

/**
 * Reads the current locale off Astro rather than the URL directly - `Astro.currentLocale`
 * already resolves a custom route path such as `"ua"` to its configured language code
 * (`"uk"`), which is exactly the split Etyma needs and must not reimplement.
 */
function resolveCurrentLocale<TKey extends string>(
  astro: AstroI18nContext,
  definition: I18nDefinition<TKey>,
  astroI18n: AstroI18nModule,
): Locale {
  const locale = astro.currentLocale;

  if (locale === undefined) {
    throw new EtymaError(
      'createAstroI18n: `Astro.currentLocale` is undefined. This route is not covered by ' +
        'the `i18n` routing configured in `astro.config` - check that its locale segment ' +
        'matches one of `i18n.locales`.',
    );
  }

  assertKnownLocale(definition, locale);

  // Etyma's first Astro adapter requires one clear rule: the source locale is the
  // unprefixed route, exactly like Astro's own default locale with the default
  // `routing.prefixDefaultLocale: false`. This is the one place that rule is enforced -
  // per render, against the URL Astro actually resolved, rather than by trusting
  // `astro.config` to agree with `defineI18n`'s `sourceLocale` unchecked.
  if (locale === definition.sourceLocale && astroI18n.pathHasLocale(astro.url.pathname)) {
    throw new EtymaError(
      `createAstroI18n: the source locale "${locale}" is being served from a prefixed URL ` +
        `("${astro.url.pathname}"). Etyma's Astro adapter requires the default/source ` +
        "locale to be served unprefixed: set astro.config's `i18n.defaultLocale` to " +
        `"${locale}" and leave \`i18n.routing.prefixDefaultLocale\` at its default of ` +
        '`false`, or choose a different Etyma `sourceLocale`.',
    );
  }

  return locale;
}

function assertKnownLocale(definition: I18nDefinition, locale: Locale): void {
  if (!definition.router.isLocale(locale)) {
    throw new EtymaError(
      `createAstroI18n: "${locale}" is not one of Etyma's configured locales ` +
        `[${definition.locales.join(', ')}]. Every Astro locale "codes" entry needs a ` +
        "matching Etyma locale - Etyma tracks BCP 47 language codes, not Astro's route paths.",
    );
  }
}

/** Strips the leading slash `getRelativeLocaleUrl`'s `path` argument does not expect. */
function bareArg(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);

  return segments.length === 0 ? undefined : segments.join('/');
}
