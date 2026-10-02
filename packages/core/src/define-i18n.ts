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
  compareKeys,
  flattenMessages,
  type MessageCatalog,
  type MessageContract,
  type MessageKey,
  type MessageParamValue,
  type MessageParamsMap,
  type MessageParamsOf,
  type MessageSource,
} from './messages.js';
import { createLocaleRouter, type LocaleRouter } from './routing.js';
import { returnMessageKey, type MissingMessageHandler } from './translator.js';

export type LocaleTuple = readonly [Locale, ...Locale[]];

/**
 * The params a static definition types `t()` with: what the literal source declares, and what
 * the contract lists, both - so a contract adds params a `.json` import cannot carry, never
 * drops the ones a `defineMessages()` literal already has, and a stale contract that disagrees
 * with a literal surfaces as a compile error. Without contract params, exactly the source's.
 */
type StaticParams<TSource, TParams> =
  // Bounded through `infer` so a generic `TSource` does not make TypeScript expand the
  // param map to check it against the constraint.
  (
    [keyof TParams] extends [never]
      ? MessageParamsOf<TSource>
      : MergeParams<MessageParamsOf<TSource>, TParams>
  ) extends infer M extends MessageParamsMap
    ? M
    : never;

type MergeParams<A, B> = MergeByKeys<A, B, keyof A, keyof B>;

/**
 * The key sets arrive as type arguments, so each is resolved to a plain union once. Written
 * as `K extends keyof A` instead, every key re-resolves `keyof` of a remapped mapped type - a
 * contract's params, a literal's `MessageParamsOf` - which made the merge quadratic in the
 * number of keys: an 836-key literal source with a contract hit TS2589, "excessively deep".
 * Indexing through `KA` and `KB` keeps it linear (`tools/compat/core-large-catalog`).
 */
type MergeByKeys<A, B, KA extends keyof A, KB extends keyof B> = {
  [K in KA | KB]: K extends KA
    ? K extends KB
      ? MergeMessageParams<A[K], B[K]>
      : A[K]
    : K extends KB
      ? B[K]
      : never;
};

/** Every variable either side names is required; a variable both name gets both's evidence. */
type MergeMessageParams<A, B> = {
  readonly [V in keyof A | keyof B]: V extends keyof A
    ? V extends keyof B
      ? MergeParamValue<A[V], B[V]>
      : A[V]
    : V extends keyof B
      ? B[V]
      : never;
};

/**
 * A broad side yields to a narrow one, and two equal types are that type. Two different
 * narrow types - a literal `:number` against a contract's `:datetime` - mean the contract is
 * stale; `never` makes every call to that key a compile error rather than quietly accepting
 * whatever the two happen to share.
 */
type MergeParamValue<A, B> = [MessageParamValue] extends [A]
  ? B
  : [MessageParamValue] extends [B]
    ? A
    : [A] extends [B]
      ? [B] extends [A]
        ? A
        : never
      : never;

export interface I18nOptions<
  TSource extends MessageSource,
  TLocales extends LocaleTuple,
  TKey extends MessageKey<TSource> = MessageKey<TSource>,
  TParams extends MessageParamsMap = Record<never, never>,
> {
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

  /**
   * Optional compile-time metadata for `source`: its exact keys and each message's
   * MessageFormat 2 variables, typically generated from the same file with `etyma contract`.
   *
   * Never read for content - `source` stays the runtime catalog and the fallback. It only
   * sharpens types where a `.json` import cannot: `t()` requires the params the contract lists,
   * and an array's keys are its exact indexes rather than `` `steps.${number}` ``. Its keys
   * must match `source`'s exactly, or `defineI18n` throws; its variables are not re-checked at
   * runtime - regenerate the contract, and run `etyma validate`, when the source changes.
   */
  readonly contract?: MessageContract<TKey, TParams>;

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
export interface I18nDefinition<
  TKey extends string = string,
  TParams extends MessageParamsMap = Record<never, never>,
> {
  readonly id: string;
  readonly locales: readonly Locale[];
  readonly sourceLocale: Locale;

  /**
   * Every message key the definition's contract carries, sorted. Also carries the key type.
   *
   * From the source catalog's own shape for `defineI18n` - typed by `contract`'s exact keys
   * when one is given, which it must match; from an explicit `MessageContract` for
   * `defineRemoteI18n`, which has no static catalog to read a shape from.
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

  /**
   * Type-only: the params each message key needs - as {@link MessageParamsOf} reads them from
   * a literal source catalog, together with any a `contract` lists. Never set at runtime. It exists so a framework layer can infer
   * `TParams` from the definition it is given, the way `keys` carries `TKey`.
   */
  readonly messageParams?: TParams;
}

/**
 * Validates an i18n configuration and freezes it into an {@link I18nDefinition}.
 *
 * Everything it can catch, it catches here: an unknown source locale, a malformed language
 * tag, a locale with no way to load its catalog, a catalog with a key that cannot be
 * addressed. All of those are configuration bugs, and the useful moment to fail is the one
 * where the file that caused it is on screen.
 */
export function defineI18n<
  const TSource extends MessageSource,
  const TLocales extends LocaleTuple,
  TKey extends MessageKey<TSource> = MessageKey<TSource>,
  TParams extends MessageParamsMap = Record<never, never>,
>(
  options: I18nOptions<TSource, TLocales, TKey, TParams>,
): I18nDefinition<TKey, StaticParams<TSource, TParams>> & {
  readonly sourceCatalog: MessageCatalog;
} {
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

  if (options.contract !== undefined) {
    assertContractMatchesSource(options.contract, sourceCatalog);
  }

  const directions = new Map<Locale, TextDirection>(
    Object.entries(options.textDirection ?? {}).filter(
      (entry): entry is [Locale, TextDirection] => entry[1] !== undefined,
    ),
  );

  const definition: I18nDefinition<TKey, StaticParams<TSource, TParams>> & {
    readonly sourceCatalog: MessageCatalog;
  } = {
    id: options.id ?? 'etyma',
    locales,
    sourceLocale,
    keys: Object.freeze([...sourceCatalog.keys()].sort()) as readonly TKey[],
    sourceCatalog,
    router: createLocaleRouter({ locales, sourceLocale }),
    formatting: options.formatting ?? {},
    onMissingMessage: options.onMissingMessage ?? returnMessageKey,
    loaderFor: (locale: Locale) => loaders.get(locale),
    directionOf: (locale: Locale) => directions.get(locale) ?? localeDirection(locale),
  };

  return Object.freeze(definition);
}

/** How many keys of each kind a drift error names before summarising the rest. */
const DRIFT_KEYS_SHOWN = 10;

/**
 * Checks that a static definition's `contract` describes its `source` - the same key set,
 * exactly. Only keys: they are already known from the flattened catalog, so the check is a set
 * comparison. Variables would need a MessageFormat 2 parse of every message, which is
 * `@etyma/tooling`'s job at build time, not this one's at startup.
 */
function assertContractMatchesSource(contract: MessageContract, sourceCatalog: MessageCatalog) {
  const { missing, extra } = compareKeys(contract.keys, sourceCatalog.keys());

  if (missing.length === 0 && extra.length === 0) {
    return;
  }

  const lines = [
    'defineI18n: `contract` does not match the source catalog - it was probably generated ' +
      'from an older version of it. Regenerate it (for example with `etyma contract`).',
  ];

  if (extra.length > 0) {
    lines.push(`  In the source catalog but not the contract: ${listKeys(extra)}`);
  }

  if (missing.length > 0) {
    lines.push(`  In the contract but not the source catalog: ${listKeys(missing)}`);
  }

  throw new EtymaError(lines.join('\n'));
}

function listKeys(keys: readonly string[]): string {
  const shown = keys.slice(0, DRIFT_KEYS_SHOWN).join(', ');

  return keys.length > DRIFT_KEYS_SHOWN
    ? `${shown} (and ${keys.length - DRIFT_KEYS_SHOWN} more)`
    : shown;
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
