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

/** Reported once, in development, when a remote source catalog's keys drift from its contract. */
export interface ContractDriftInfo {
  readonly locale: Locale;
  /** Keys the contract declares that the loaded catalog does not have. */
  readonly missing: readonly string[];
  /** Keys the loaded catalog has that the contract does not declare. */
  readonly extra: readonly string[];
}

export interface CatalogRegistryOptions {
  /** Called after a catalog becomes available, so a framework layer can invalidate. */
  readonly onChange?: (locale: Locale) => void;
  /** Catalogs already known, typically transferred from a server render. */
  readonly snapshot?: CatalogSnapshot | undefined;
  /**
   * Called once, the first time a remote source catalog is adopted, if its keys do not
   * exactly match the definition's contract. Never called in static mode, where the source
   * catalog's shape *is* the contract by construction, and never called more than once per
   * registry.
   */
  readonly onContractDrift?: ((info: ContractDriftInfo) => void) | undefined;
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
  // Static mode's source catalog is already in memory and never goes through a loader.
  // Remote mode's is not: it starts absent and arrives through the registry like any other
  // locale, so nothing here can seed it up front.
  const catalogs = new Map<Locale, MessageCatalog>(
    definition.sourceCatalog === undefined
      ? []
      : [[definition.sourceLocale, definition.sourceCatalog]],
  );
  const inFlight = new Map<Locale, Promise<MessageCatalog>>();
  const { onChange, onContractDrift } = options;
  const contractKeys = new Set<string>(definition.keys);
  let contractChecked = false;

  const checkContractDrift = (locale: Locale, catalog: MessageCatalog): void => {
    if (
      contractChecked ||
      locale !== definition.sourceLocale ||
      definition.sourceCatalog !== undefined
    ) {
      return;
    }

    contractChecked = true;

    const catalogKeys = new Set(catalog.keys());
    const missing = [...contractKeys].filter(key => !catalogKeys.has(key)).sort();
    const extra = [...catalogKeys].filter(key => !contractKeys.has(key)).sort();

    if (missing.length > 0 || extra.length > 0) {
      onContractDrift?.({ locale, missing, extra });
    }
  };

  const adopt = (locale: Locale, catalog: MessageCatalog): MessageCatalog => {
    catalogs.set(locale, catalog);
    checkContractDrift(locale, catalog);
    onChange?.(locale);

    return catalog;
  };

  const hydrate = (snapshot: CatalogSnapshot): void => {
    for (const [locale, messages] of Object.entries(snapshot)) {
      // In static mode the source catalog is already in memory and is the one the types
      // were built from, so a transferred copy is redundant. In remote mode there is no
      // such copy yet, and this is exactly how it arrives without a second browser fetch.
      const isPreloadedSource =
        locale === definition.sourceLocale && definition.sourceCatalog !== undefined;

      if (isPreloadedSource || catalogs.has(locale)) {
        continue;
      }

      adopt(locale, new Map(Object.entries(messages)));
    }
  };

  if (options.snapshot) {
    hydrate(options.snapshot);
  }

  const loadOne = (locale: Locale): Promise<MessageCatalog> => {
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
  };

  return {
    get loaded() {
      return [...catalogs.keys()];
    },

    has: locale => catalogs.has(locale),
    get: locale => catalogs.get(locale),
    hydrate,

    load(locale) {
      if (locale === definition.sourceLocale) {
        return loadOne(locale);
      }

      // The source locale is the fallback for every other locale, so activating any target
      // locale must guarantee the source is loaded too - concurrently where both are
      // remote, immediately where the source is already in memory (static mode, or a
      // remote source loaded by an earlier call).
      return Promise.all([loadOne(definition.sourceLocale), loadOne(locale)]).then(
        ([, catalog]) => catalog,
      );
    },

    dehydrate() {
      const snapshot: Record<Locale, Record<string, string>> = {};

      for (const [locale, catalog] of catalogs) {
        // Static mode's source catalog ships in the bundle already; sending it again would
        // double the payload of every page in the source language for nothing. Remote
        // mode's was fetched on the server, so it has to be sent, or hydration would fetch
        // it again for no reason.
        if (locale === definition.sourceLocale && definition.sourceCatalog !== undefined) {
          continue;
        }

        snapshot[locale] = Object.fromEntries(catalog);
      }

      return snapshot;
    },
  };
}
