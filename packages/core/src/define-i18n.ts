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

type LocaleTuple = readonly [Locale, ...Locale[]];

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

  /** Every message key in the source catalog, sorted. Also carries the key type. */
  readonly keys: readonly TKey[];

  readonly sourceCatalog: MessageCatalog;
  readonly router: LocaleRouter;
  readonly formatting: MessageFormatterOptions;
  readonly onMissingMessage: MissingMessageHandler;

  /** The loader for `locale`, or `undefined` for the source locale, which needs none. */
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
): I18nDefinition<MessageKey<TSource>> {
  const locales: readonly Locale[] = [...options.locales];

  if (locales.length === 0) {
    throw new EtymaError('defineI18n: `locales` must list at least one locale.');
  }

  const seen = new Set<Locale>();

  for (const locale of locales) {
    assertWellFormedLocale(locale, 'defineI18n: `locales`');

    if (seen.has(locale)) {
      throw new EtymaError(`defineI18n: locale "${locale}" is listed twice.`);
    }

    seen.add(locale);
  }

  const { sourceLocale } = options;

  if (!seen.has(sourceLocale)) {
    throw new EtymaError(
      `defineI18n: sourceLocale "${sourceLocale}" is not in locales [${locales.join(', ')}].`,
    );
  }

  const loaders = new Map<Locale, MessageLoader>();

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

  const definition: I18nDefinition<MessageKey<TSource>> = {
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
