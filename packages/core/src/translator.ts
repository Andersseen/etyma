import type { MessageFormatter, MessagePart } from './format.js';
import type { Locale } from './locale.js';
import type { MessageArgs, MessageCatalog, MessageParams, MessageParamsMap } from './messages.js';

export interface MissingMessageInfo {
  readonly key: string;
  /** The locale that was asked for. */
  readonly locale: Locale;
  /** The locale that was tried next, and also came up empty. */
  readonly sourceLocale: Locale;
}

/**
 * Decides what a page shows where a message should have been.
 *
 * The default returns the key. It is visible, it names what is missing, and it is stable
 * enough for a test to assert on - all of which an empty string is not.
 */
export type MissingMessageHandler = (info: MissingMessageInfo) => string;

export const returnMessageKey: MissingMessageHandler = info => info.key;

export interface TranslatorInput {
  readonly locale: Locale;
  /** The catalog for `locale`, or `undefined` while it is still loading. */
  readonly catalog: MessageCatalog | undefined;
  readonly sourceLocale: Locale;
  /** The source locale's catalog, or `undefined` while it is still loading, in remote mode. */
  readonly sourceCatalog: MessageCatalog | undefined;
  readonly formatter: MessageFormatter;
  readonly onMissingMessage?: MissingMessageHandler;
}

/**
 * Translation bound to one locale and one set of catalogs.
 *
 * Immutable and cheap to build, which is what lets a framework layer derive a new one
 * whenever the locale or the loaded catalogs change and never have to invalidate anything
 * by hand.
 */
export interface Translator<
  TKey extends string = string,
  TParams extends MessageParamsMap = Record<never, never>,
> {
  readonly locale: Locale;

  /**
   * The translated, formatted string. Always text - never markup.
   *
   * `params` is required, and exact, for a key `TParams` records variables for; optional and
   * untyped for every other key.
   */
  translate<K extends TKey>(key: K, ...params: MessageArgs<TParams, K>): string;

  /**
   * The message as MessageFormat 2 parts.
   *
   * The escape hatch for rendering a message that is more than text - a number that needs
   * its own element, a date that should sit in a `<time>` - without ever handing a
   * translated string to `innerHTML`.
   */
  translateToParts<K extends TKey>(
    key: K,
    ...params: MessageArgs<TParams, K>
  ): readonly MessagePart[];

  /** Whether `key` resolves in this locale or in the source locale. */
  has(key: TKey): boolean;
}

export function createTranslator<
  TKey extends string = string,
  TParams extends MessageParamsMap = Record<never, never>,
>(input: TranslatorInput): Translator<TKey, TParams> {
  const { locale, catalog, sourceLocale, sourceCatalog, formatter } = input;
  const onMissingMessage = input.onMissingMessage ?? returnMessageKey;

  /**
   * Resolving returns the locale the pattern was found in, not just the pattern.
   *
   * A message that falls back to the source locale has to be formatted in the source
   * locale too, or a Ukrainian page formats an English pattern with Ukrainian plural
   * categories and picks a variant the English message does not define.
   */
  const resolve = (key: string): { source: string; locale: Locale } | undefined => {
    const own = catalog?.get(key);

    if (own !== undefined) {
      return { source: own, locale };
    }

    const fallback = sourceCatalog?.get(key);

    return fallback === undefined ? undefined : { source: fallback, locale: sourceLocale };
  };

  const translator = {
    locale,

    translate(key: string, params?: MessageParams): string {
      const resolved = resolve(key);

      if (resolved === undefined) {
        return onMissingMessage({ key, locale, sourceLocale });
      }

      return formatter.format(resolved.locale, key, resolved.source, params);
    },

    translateToParts(key: string, params?: MessageParams): readonly MessagePart[] {
      const resolved = resolve(key);

      if (resolved === undefined) {
        return [{ type: 'text', value: onMissingMessage({ key, locale, sourceLocale }) }];
      }

      return formatter.formatToParts(resolved.locale, key, resolved.source, params);
    },

    has(key: string): boolean {
      return resolve(key) !== undefined;
    },
  };

  // `TParams` only ever narrows what a caller may pass, never what arrives: at runtime every
  // key takes the same optional `MessageParams` record, which is what the untyped
  // implementation above handles.
  return translator as unknown as Translator<TKey, TParams>;
}
