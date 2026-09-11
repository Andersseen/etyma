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

/**
 * A minimal, structurally-typed subset of the Fetch API's request options.
 *
 * Deliberately not the ambient `RequestInit` DOM type: `@etyma/core` runs in browsers and in
 * edge runtimes such as Cloudflare Workers without depending on the DOM lib, so this names
 * only the shape {@link createHttpMessageLoader} forwards, not everything `fetch` accepts.
 */
export type HttpLoaderInit = Readonly<Record<string, unknown>>;

interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  json(): Promise<unknown>;
}

type FetchFunction = (input: string, init?: HttpLoaderInit) => Promise<FetchResponse>;

/**
 * The platform `fetch`, referenced structurally rather than through the ambient `fetch`
 * global - which does not exist in this package's own "ES2023, no DOM" type-checking
 * environment, even though every runtime that actually loads this code provides it.
 */
function platformFetch(): FetchFunction {
  return (globalThis as unknown as { readonly fetch: FetchFunction }).fetch;
}

/**
 * Loads a catalog over HTTP, from a CDN, a headless CMS, or any endpoint that returns a
 * {@link MessageSource} as JSON.
 *
 * Uses the platform `fetch`, nothing more - no retry, no cache, no auth. An application that
 * needs any of those wraps this or writes its own {@link MessageLoader}; this exists to make
 * the common case - one JSON file per locale, publicly reachable - a one-liner. The result
 * still passes through {@link loadMessageCatalog}'s usual validation: a remote catalog gets
 * no less scrutiny than one bundled locally.
 *
 * ```ts
 * loaders: {
 *   en: createHttpMessageLoader('https://cdn.example.com/i18n/en.json'),
 *   es: createHttpMessageLoader(locale => `https://cdn.example.com/i18n/${locale}.json`),
 * }
 * ```
 */
export function createHttpMessageLoader(
  url: string | ((locale: Locale) => string),
  init?: HttpLoaderInit,
): MessageLoader {
  return async locale => {
    const resolved = typeof url === 'function' ? url(locale) : url;
    const fetch = platformFetch();

    let response: FetchResponse;

    try {
      response = await fetch(resolved, init);
    } catch (cause) {
      throw new EtymaError(
        `Failed to fetch message catalog for "${locale}" from "${resolved}": ` +
          `${cause instanceof Error ? cause.message : String(cause)}.`,
      );
    }

    if (!response.ok) {
      throw new EtymaError(
        `Failed to fetch message catalog for "${locale}" from "${resolved}": ` +
          `HTTP ${response.status} ${response.statusText}.`,
      );
    }

    try {
      return (await response.json()) as MessageSource;
    } catch {
      throw new EtymaError(`Message catalog for "${locale}" from "${resolved}" is not valid JSON.`);
    }
  };
}
