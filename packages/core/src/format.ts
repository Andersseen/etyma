import { MessageFormat } from 'messageformat';
import type { MessagePart as Mf2MessagePart } from 'messageformat';
import { DraftFunctions, type MessageFunction } from 'messageformat/functions';

import type { Locale } from './locale.js';
import type { MessageParams } from './messages.js';

/** One piece of a formatted message, as produced by MessageFormat 2. */
export type MessagePart = Mf2MessagePart<string>;

/** A custom MessageFormat 2 function handler, keyed by the name it is called by. */
export type MessageFunctions = Readonly<Record<string, MessageFunction<string, string>>>;

/** Where a formatting problem happened, so a report can name it. */
export interface MessageFormatIssue {
  readonly locale: Locale;
  readonly key: string;
  readonly source: string;
  readonly error: unknown;
}

export interface MessageFormatterOptions {
  /**
   * How MessageFormat 2 isolates placeholders whose text direction differs from the
   * message around them.
   *
   * Etyma defaults to 'none', which is NOT the MessageFormat default. The spec default
   * wraps every interpolated value in U+2068 and U+2069, so `t('welcome', { name: 'World' })`
   * returns a string that looks like `Hello, World!` but is not equal to it. Invisible on
   * screen, and a surprise in every equality assertion, `textContent` read and snapshot a
   * team writes afterwards.
   *
   * Set this to 'default' when messages mix directions - a Hebrew name inside an English
   * sentence - and the isolation earns its cost.
   */
  readonly bidiIsolation?: 'default' | 'none';

  /**
   * Register the LDML draft functions: `:date`, `:time`, `:datetime`, `:currency`,
   * `:percent`, `:unit`.
   *
   * On by default, because a toolkit where `{$when :date style=long}` silently renders
   * `{$when}` is not one anybody would keep using. They are draft in LDML 48 and the spec
   * may still change them; turn them off to stay on the stable subset (`:string`,
   * `:number`, `:integer`, `:offset`), which is always registered.
   */
  readonly draftFunctions?: boolean;

  /** Additional function handlers, merged over the built-ins. */
  readonly functions?: MessageFunctions;

  /** Called for every syntax or resolution problem. Formatting never throws. */
  readonly onIssue?: (issue: MessageFormatIssue) => void;
}

/**
 * Formats MessageFormat 2 patterns, caching one parsed message per locale and pattern.
 *
 * The cache lives on the instance rather than in the module, so a server that creates one
 * formatter per request cannot accumulate every message every visitor has ever seen, and
 * two requests in flight at once share nothing.
 */
export interface MessageFormatter {
  format(locale: Locale, key: string, source: string, params?: MessageParams): string;
  formatToParts(
    locale: Locale,
    key: string,
    source: string,
    params?: MessageParams,
  ): readonly MessagePart[];
}

export function createMessageFormatter(options: MessageFormatterOptions = {}): MessageFormatter {
  const bidiIsolation = options.bidiIsolation ?? 'none';
  const { onIssue } = options;

  const functions: MessageFunctions = {
    ...(options.draftFunctions === false ? {} : DraftFunctions),
    ...options.functions,
  };

  // `null` records a pattern that failed to parse, so a broken message is reported once
  // and then costs a map lookup instead of a throw on every render.
  const cache = new Map<string, MessageFormat<string, string> | null>();

  const compile = (
    locale: Locale,
    key: string,
    source: string,
  ): MessageFormat<string, string> | null => {
    const cacheKey = `${locale} ${source}`;
    const cached = cache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    let compiled: MessageFormat<string, string> | null = null;

    try {
      compiled = new MessageFormat<string, string>(locale, source, { bidiIsolation, functions });
    } catch (error) {
      onIssue?.({ locale, key, source, error });
    }

    cache.set(cacheKey, compiled);

    return compiled;
  };

  return {
    format(locale, key, source, params) {
      const compiled = compile(locale, key, source);

      // An unparseable pattern renders as its own source: wrong, visible, and still a page.
      if (compiled === null) {
        return source;
      }

      return compiled.format(params, error => onIssue?.({ locale, key, source, error }));
    },

    formatToParts(locale, key, source, params) {
      const compiled = compile(locale, key, source);

      if (compiled === null) {
        return [{ type: 'text', value: source }];
      }

      return compiled.formatToParts(params, error => onIssue?.({ locale, key, source, error }));
    },
  };
}
