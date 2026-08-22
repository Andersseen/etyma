import type { I18nDefinition } from './define-i18n.js';
import { EtymaError } from './errors.js';
import type { Locale } from './locale.js';
import { loadMessageCatalog } from './loader.js';
import type { MessageCatalog } from './messages.js';

/**
 * Loaded catalogs in a form that survives a JSON round trip.
 *
 * This is what crosses from server to browser, so it is deliberately flat and plain: keys
 * already resolved, no `Map`, nothing that needs a reviver.
 */
export type CatalogSnapshot = Readonly<Record<Locale, Readonly<Record<string, string>>>>;

export interface CatalogRegistryOptions {
  /** Called after a catalog becomes available, so a framework layer can invalidate. */
  readonly onChange?: (locale: Locale) => void;
  /** Catalogs already known, typically transferred from a server render. */
  readonly snapshot?: CatalogSnapshot | undefined;
}

/**
 * Holds the catalogs an application has loaded so far, and loads the ones it has not.
 *
 * One registry per application instance - which on a server means one per request. Nothing
 * here is module-level, so two requests rendering two locales at the same time cannot see
 * each other's catalogs.
 *
 * Concurrent calls for the same locale share a single load: a page with four components
 * that each ask for Ukrainian causes one fetch, not four.
 */
export interface CatalogRegistry {
  /** Every locale whose catalog is in memory, in load order. */
  readonly loaded: readonly Locale[];

  has(locale: Locale): boolean;
  get(locale: Locale): MessageCatalog | undefined;

  /** Loads `locale` if needed. Resolves immediately for anything already in memory. */
  load(locale: Locale): Promise<MessageCatalog>;

  /** Adds catalogs from a snapshot without running any loader. */
  hydrate(snapshot: CatalogSnapshot): void;

  /** The loaded catalogs, for transfer to the browser. */
  dehydrate(): CatalogSnapshot;
}

export function createCatalogRegistry(
  definition: I18nDefinition,
  options: CatalogRegistryOptions = {},
): CatalogRegistry {
  const catalogs = new Map<Locale, MessageCatalog>([
    [definition.sourceLocale, definition.sourceCatalog],
  ]);
  const inFlight = new Map<Locale, Promise<MessageCatalog>>();
  const { onChange } = options;

  const adopt = (locale: Locale, catalog: MessageCatalog): MessageCatalog => {
    catalogs.set(locale, catalog);
    onChange?.(locale);

    return catalog;
  };

  const hydrate = (snapshot: CatalogSnapshot): void => {
    for (const [locale, messages] of Object.entries(snapshot)) {
      // The source catalog is already in memory and is the one the types were built from.
      if (locale === definition.sourceLocale || catalogs.has(locale)) {
        continue;
      }

      adopt(locale, new Map(Object.entries(messages)));
    }
  };

  if (options.snapshot) {
    hydrate(options.snapshot);
  }

  return {
    get loaded() {
      return [...catalogs.keys()];
    },

    has: locale => catalogs.has(locale),
    get: locale => catalogs.get(locale),
    hydrate,

    load(locale) {
      const existing = catalogs.get(locale);

      if (existing !== undefined) {
        return Promise.resolve(existing);
      }

      const pending = inFlight.get(locale);

      if (pending !== undefined) {
        return pending;
      }

      const loader = definition.loaderFor(locale);

      if (loader === undefined) {
        return Promise.reject(
          new EtymaError(`No message loader is configured for locale "${locale}".`),
        );
      }

      const request = loadMessageCatalog(locale, loader)
        .then(catalog => adopt(locale, catalog))
        .finally(() => {
          inFlight.delete(locale);
        });

      inFlight.set(locale, request);

      return request;
    },

    dehydrate() {
      const snapshot: Record<Locale, Record<string, string>> = {};

      for (const [locale, catalog] of catalogs) {
        // The source catalog ships in the bundle already; sending it again would double
        // the payload of every page in the source language for nothing.
        if (locale === definition.sourceLocale) {
          continue;
        }

        snapshot[locale] = Object.fromEntries(catalog);
      }

      return snapshot;
    },
  };
}
