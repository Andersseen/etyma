import { EtymaError } from './errors.js';
import type { Locale } from './locale.js';
import { flattenMessages, type MessageCatalog, type MessageSource } from './messages.js';

/** What `import('./es.json')` resolves to. */
export interface MessageModule {
  readonly default: MessageSource;
}

export type MessageLoaderResult = MessageSource | MessageModule;

/**
 * Produces the catalog for one locale, on demand.
 *
 * The only thing Etyma requires of a loader is that it eventually returns a
 * {@link MessageSource}. A dynamic `import()` of a JSON file is what an application starts
 * with; the same signature covers a `fetch` from a CDN or a CMS without the runtime
 * learning anything new about where messages come from.
 *
 * ```ts
 * const loaders = {
 *   es: () => import('./i18n/es.json'),
 *   uk: () => fetch('/i18n/uk.json').then(res => res.json()),
 * };
 * ```
 */
export type MessageLoader = (locale: Locale) => MessageLoaderResult | Promise<MessageLoaderResult>;

/**
 * Unwraps a module namespace, and leaves a plain catalog alone.
 *
 * A catalog is allowed to have a top-level `default` key, so the check is for the module
 * markers a bundler actually sets rather than for the presence of the property.
 */
export function toMessageSource(result: unknown, locale: Locale): MessageSource {
  if (result === null || typeof result !== 'object') {
    throw new EtymaError(
      `Message loader for "${locale}" resolved to ${result === null ? 'null' : typeof result}; ` +
        'expected an object of messages.',
    );
  }

  const marked =
    (result as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag] === 'Module' ||
    (result as { __esModule?: unknown }).__esModule === true;

  if (!marked) {
    return result as MessageSource;
  }

  const inner: unknown = (result as { default?: unknown }).default;

  if (inner === null || typeof inner !== 'object') {
    throw new EtymaError(
      `Message loader for "${locale}" resolved to a module without a default export of messages.`,
    );
  }

  return inner as MessageSource;
}

/** Runs a loader and normalises whatever it returns into a flat catalog. */
export async function loadMessageCatalog(
  locale: Locale,
  loader: MessageLoader,
): Promise<MessageCatalog> {
  return flattenMessages(toMessageSource(await loader(locale), locale));
}
