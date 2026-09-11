import { EtymaError } from './errors.js';
import type { MessageFormatterOptions } from './format.js';
import {
  assertWellFormedLocale,
  localeDirection,
  type Locale,
  type TextDirection,
} from './locale.js';
import type { MessageLoader } from './loader.js';
import {
  flattenMessages,
  type MessageCatalog,
  type MessageKey,
  type MessageSource,
} from './messages.js';
import { createLocaleRouter, type LocaleRouter } from './routing.js';
import { returnMessageKey, type MissingMessageHandler } from './translator.js';

export type LocaleTuple = readonly [Locale, ...Locale[]];

export interface I18nOptions<TSource extends MessageSource, TLocales extends LocaleTuple> {
  /** Every locale the application publishes, as BCP 47 tags. */
  readonly locales: TLocales;

  /**
   * The locale the source catalog is written in.
   *
   * It defines the key contract, it is what every other locale falls back to, and it is
   * the one catalog that is not lazy-loaded.
   */
  readonly sourceLocale: TLocales[number];

  /**
   * The source catalog, imported statically.
   *
   * Static on purpose, and the only one that is: its *type* is where typed keys come from,
   * and its *value* is what a half-translated page falls back to. Every other locale is
   * loaded through {@link I18nOptions.loaders} and never reaches the initial bundle.
   */
  readonly source: TSource;

  /** How to fetch each non-source locale. Required for all of them. */
  readonly loaders?: Readonly<Partial<Record<TLocales[number], MessageLoader>>>;

  /**
   * Override the detected text direction of a locale.
   *
   * Only needed where the runtime's own answer is missing and Etyma's fallback table is
   * wrong for the language in question.
   */
  readonly textDirection?: Readonly<Partial<Record<TLocales[number], TextDirection>>>;

  /** What renders in place of a message that exists in no catalog. Defaults to the key. */
  readonly onMissingMessage?: MissingMessageHandler;

  /** MessageFormat 2 behaviour: bidi isolation, custom functions, issue reporting. */
  readonly formatting?: MessageFormatterOptions;

  /**
   * Distinguishes this definition's SSR transfer payload from another's.
   *
   * Only matters in the rare application that provides two catalogs side by side.
   */
  readonly id?: string;
}

/**
 * A validated, framework-agnostic i18n configuration.
 *
 * Everything downstream - the Angular providers, the Analog routing, a future adapter -
 * reads this and nothing else. `TKey` carries the source catalog's key union, which is how
 * `t()` stays typed across a package boundary without a code generator.
 */
export interface I18nDefinition<TKey extends string = string> {
  readonly id: string;
  readonly locales: readonly Locale[];
  readonly sourceLocale: Locale;

  /**
   * Every message key the definition's contract carries, sorted. Also carries the key type.
   *
   * From the source catalog's own shape for `defineI18n`; from an explicit
   * `MessageContract` for `defineRemoteI18n`, which has no static catalog to read a shape
   * from.
   */
  readonly keys: readonly TKey[];

  /**
   * The source catalog, or `undefined` when the source locale is itself loaded remotely -
   * see `defineRemoteI18n`. `defineI18n` always sets this; its own return type narrows it
   * back to non-optional, since a static source is always present by construction.
   */
  readonly sourceCatalog: MessageCatalog | undefined;
  readonly router: LocaleRouter;
  readonly formatting: MessageFormatterOptions;
  readonly onMissingMessage: MissingMessageHandler;

  /**
   * The loader for `locale`.
   *
   * `undefined` only for the source locale of a `defineI18n` definition, which needs none.
   * `defineRemoteI18n` configures one for every locale, including the source.
   */
  loaderFor(locale: Locale): MessageLoader | undefined;

  /** The text direction to render `locale` in. */
  directionOf(locale: Locale): TextDirection;
}

/**
 * Validates an i18n configuration and freezes it into an {@link I18nDefinition}.
 *
 * Everything it can catch, it catches here: an unknown source locale, a malformed language
 * tag, a locale with no way to load its catalog, a catalog with a key that cannot be
 * addressed. All of those are configuration bugs, and the useful moment to fail is the one
 * where the file that caused it is on screen.
 */
export function defineI18n<const TSource extends MessageSource, const TLocales extends LocaleTuple>(
  options: I18nOptions<TSource, TLocales>,
): I18nDefinition<MessageKey<TSource>> & { readonly sourceCatalog: MessageCatalog } {
  const locales: readonly Locale[] = [...options.locales];

  validateLocales('defineI18n', locales);

  const { sourceLocale } = options;

  validateSourceLocale('defineI18n', locales, sourceLocale);

  const seen = new Set(locales);
  const loaders = new Map<Locale, MessageLoader>();
  const configuredLoaders = Object.entries(options.loaders ?? {});

  for (const [locale, loader] of configuredLoaders) {
    assertWellFormedLocale(locale, 'defineI18n: `loaders`');

    if (!seen.has(locale)) {
      throw new EtymaError(
        `defineI18n: loader configured for unknown locale "${locale}". ` +
          `Configured locales: [${locales.join(', ')}].`,
      );
    }

    if (locale === sourceLocale && loader !== undefined) {
      throw new EtymaError(
        `defineI18n: source locale "${sourceLocale}" must not have a loader. ` +
          'Import the source catalog statically with `source` instead.',
      );
    }

    if (loader !== undefined && typeof loader !== 'function') {
      throw new EtymaError(
        `defineI18n: loader for locale "${locale}" is a ${typeof loader}; expected a function.`,
      );
    }
  }

  for (const locale of locales) {
    const loader = options.loaders?.[locale as TLocales[number]];

    if (loader !== undefined) {
      loaders.set(locale, loader);
      continue;
    }

    if (locale !== sourceLocale) {
      throw new EtymaError(
        `defineI18n: locale "${locale}" has no loader. Every locale except the source ` +
          'locale is loaded on demand and needs one, for example ' +
          `\`loaders: { ${locale}: () => import('./i18n/${locale}.json') }\`.`,
      );
    }
  }

  const sourceCatalog = flattenMessages(options.source);

  if (sourceCatalog.size === 0) {
    throw new EtymaError('defineI18n: the source catalog is empty.');
  }

  const directions = new Map<Locale, TextDirection>(
    Object.entries(options.textDirection ?? {}).filter(
      (entry): entry is [Locale, TextDirection] => entry[1] !== undefined,
    ),
  );

  const definition: I18nDefinition<MessageKey<TSource>> & {
    readonly sourceCatalog: MessageCatalog;
  } = {
    id: options.id ?? 'etyma',
    locales,
    sourceLocale,
    keys: Object.freeze([...sourceCatalog.keys()].sort()) as readonly MessageKey<TSource>[],
    sourceCatalog,
    router: createLocaleRouter({ locales, sourceLocale }),
    formatting: options.formatting ?? {},
    onMissingMessage: options.onMissingMessage ?? returnMessageKey,
    loaderFor: (locale: Locale) => loaders.get(locale),
    directionOf: (locale: Locale) => directions.get(locale) ?? localeDirection(locale),
  };

  return Object.freeze(definition);
}

/**
 * Validates a locale list: non-empty, every tag well-formed, no duplicates.
 *
 * Shared between `defineI18n` and `defineRemoteI18n`, since a locale list means the same
 * thing in both - `context` is only which one's error message this becomes.
 */
export function validateLocales(context: string, locales: readonly Locale[]): void {
  if (locales.length === 0) {
    throw new EtymaError(`${context}: \`locales\` must list at least one locale.`);
  }

  const seen = new Set<Locale>();

  for (const locale of locales) {
    assertWellFormedLocale(locale, `${context}: \`locales\``);

    if (seen.has(locale)) {
      throw new EtymaError(`${context}: locale "${locale}" is listed twice.`);
    }

    seen.add(locale);
  }
}

/** Validates that `sourceLocale` is one of `locales`. `locales` must already be de-duplicated. */
export function validateSourceLocale(
  context: string,
  locales: readonly Locale[],
  sourceLocale: Locale,
): void {
  if (!locales.includes(sourceLocale)) {
    throw new EtymaError(
      `${context}: sourceLocale "${sourceLocale}" is not in locales [${locales.join(', ')}].`,
    );
  }
}
