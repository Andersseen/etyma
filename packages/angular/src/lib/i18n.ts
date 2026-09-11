import {
  computed,
  inject,
  Injectable,
  isDevMode,
  makeStateKey,
  PLATFORM_ID,
  signal,
  TransferState,
  type Signal,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import {
  createCatalogRegistry,
  createMessageFormatter,
  createTranslator,
  EtymaError,
  type CatalogRegistry,
  type CatalogSnapshot,
  type ContractDriftInfo,
  type Locale,
  type MessageFormatIssue,
  type MessageFormatter,
  type MessageParams,
  type MessagePart,
  type TextDirection,
} from '@etyma/core';

import { ETYMA_DEFINITION, ETYMA_LOCALE_SWITCH } from './tokens.js';

/** Translates a key in the active locale. Reading it in a template subscribes to the locale. */
export type TranslateFn<TKey extends string = string> = (
  key: TKey,
  params?: MessageParams,
) => string;

interface EtymaHydrationState {
  readonly locale: Locale;
  readonly catalogs: CatalogSnapshot;
}

const NO_TRANSFERRED_HYDRATION_STATE: EtymaHydrationState | null = null;

/**
 * Etyma's translation state, as signals.
 *
 * One instance per application injector, which on a server means one per request. Every
 * piece of mutable state - the active locale, the catalogs loaded so far - lives on the
 * instance, so two requests rendering two languages at once share nothing.
 *
 * The reactive shape is deliberately small: `locale` is the only input, `t` is derived from
 * it, and reading `t` inside a template is what makes that template re-render when the
 * language changes. No zone, no subscription, no manual invalidation.
 */
@Injectable()
export class EtymaI18n<TKey extends string = string> {
  /**
   * The configuration this instance was built from.
   *
   * Exposed with plain string keys rather than `TKey`. The key union is a property of the
   * call site that named the definition, not of the injected instance, and keeping it out
   * of here is what makes `EtymaI18n<string>` - which is all the injector can hand back -
   * assignable to `EtymaI18n<TKey>` without an assertion anywhere.
   */
  readonly definition = inject(ETYMA_DEFINITION);

  private readonly transferState = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly switchLocale = inject(ETYMA_LOCALE_SWITCH, { optional: true });

  private readonly stateKey = makeStateKey<EtymaHydrationState>(`${this.definition.id}.hydration`);
  private readonly transferredState = this.readTransferredState();

  private readonly activeLocale = signal<Locale>(
    this.transferredState?.locale ?? this.definition.sourceLocale,
  );
  private activationVersion = 0;

  /**
   * Bumped whenever a catalog arrives.
   *
   * A `Map` mutating in place is invisible to signals, and copying every catalog into a new
   * `Map` on each load to make it visible would copy thousands of strings to communicate
   * one bit. A counter says the same thing for free.
   */
  private readonly revision = signal(0);

  private readonly formatter: MessageFormatter;
  private readonly registry: CatalogRegistry;

  private readonly translator = computed(() => {
    this.revision();

    const locale = this.activeLocale();

    return createTranslator<TKey>({
      locale,
      catalog: this.registry.get(locale),
      sourceLocale: this.definition.sourceLocale,
      sourceCatalog: this.registry.get(this.definition.sourceLocale),
      formatter: this.formatter,
      onMissingMessage: this.definition.onMissingMessage,
    });
  });

  constructor() {
    const configured = this.definition.formatting;
    const onIssue = configured.onIssue ?? developmentIssueReporter();

    this.formatter = createMessageFormatter(
      onIssue === undefined ? configured : { ...configured, onIssue },
    );

    // Held locally as well as on `this`, because the change handler runs once during
    // construction when a server snapshot is adopted - before the field is assigned.
    const registry = createCatalogRegistry(this.definition, {
      snapshot: this.transferredState?.catalogs,
      onChange: () => {
        this.revision.update(n => n + 1);

        // The server serialises transfer state after rendering finishes, so rewriting the
        // whole snapshot on every change leaves the last write complete.
        if (this.isServer) {
          this.writeHydrationState(registry);
        }
      },
      onContractDrift: developmentContractDriftReporter(),
    });

    this.registry = registry;
  }

  /** Every locale this application publishes. */
  get locales(): readonly Locale[] {
    return this.definition.locales;
  }

  /** The locale the source catalog is written in, and the fallback for every other one. */
  get sourceLocale(): Locale {
    return this.definition.sourceLocale;
  }

  /** The locale currently rendering. */
  readonly locale: Signal<Locale> = this.activeLocale.asReadonly();

  /** The text direction of {@link locale}, for `<html dir>`. */
  readonly direction: Signal<TextDirection> = computed(() =>
    this.definition.directionOf(this.activeLocale()),
  );

  /** Whether the catalog for {@link locale} is in memory. False means messages fall back. */
  readonly ready: Signal<boolean> = computed(() => {
    this.revision();

    return this.registry.has(this.activeLocale());
  });

  /**
   * Translates a key in the active locale, falling back to the source locale.
   *
   * An arrow rather than a method so a template can hold it directly, and so the signal
   * reads inside it happen during that template's evaluation - which is what makes the
   * component re-render on a language change.
   *
   * The result is always text. A translated string is never interpreted as markup.
   */
  readonly t: TranslateFn<TKey> = (key, params) => this.translator().translate(key, params);

  /**
   * The message as MessageFormat 2 parts.
   *
   * For a message that needs more than a string - a number in its own element, a date in a
   * `<time>` - without ever routing a translation through `innerHTML`.
   */
  readonly parts = (key: TKey, params?: MessageParams): readonly MessagePart[] =>
    this.translator().translateToParts(key, params);

  /** Whether `key` resolves in the active locale or in the source locale. */
  readonly has = (key: TKey): boolean => this.translator().has(key);

  /**
   * The path `to` as it is served in `locale`, defaulting to the active one.
   *
   * Every in-app link needs this: `routerLink="/docs"` from a Spanish page would otherwise
   * navigate to the English one, because the link knows nothing about where it was clicked.
   */
  readonly path = (to: string, locale?: Locale): string =>
    this.definition.router.localize(to, locale ?? this.activeLocale());

  /** Whether a locale's catalog has already been loaded. */
  isLoaded(locale: Locale): boolean {
    this.revision();

    return this.registry.has(locale);
  }

  /** Loads a locale's catalog without switching to it. Concurrent calls share one load. */
  async load(locale: Locale): Promise<void> {
    this.assertKnown(locale);
    await this.registry.load(locale);
  }

  /**
   * Loads `locale` and makes it active, without touching the URL.
   *
   * The primitive a routing integration uses once it has decided, from the URL, which
   * locale a page is. Applications call {@link setLocale} instead.
   */
  async activate(locale: Locale): Promise<void> {
    const version = ++this.activationVersion;

    await this.load(locale);

    if (version !== this.activationVersion) {
      return;
    }

    this.activeLocale.set(locale);

    if (this.isServer) {
      this.writeHydrationState(this.registry);
    }
  }

  /**
   * Switches the application to `locale`.
   *
   * Where something has provided `ETYMA_LOCALE_SWITCH` - as `@etyma/analog` does - this
   * navigates, so the URL stays the single source of truth. Otherwise it loads the catalog
   * and applies it.
   */
  async setLocale(locale: Locale): Promise<void> {
    this.assertKnown(locale);

    if (this.switchLocale !== null) {
      await this.switchLocale(locale);
      return;
    }

    await this.activate(locale);
  }

  private assertKnown(locale: Locale): void {
    if (!this.definition.router.isLocale(locale)) {
      throw new EtymaError(
        `Unknown locale "${locale}". Configured locales: ${this.definition.locales.join(', ')}.`,
      );
    }
  }

  private readTransferredState(): EtymaHydrationState | undefined {
    if (this.isServer) {
      return undefined;
    }

    const state = this.transferState.get(this.stateKey, NO_TRANSFERRED_HYDRATION_STATE);
    this.transferState.remove(this.stateKey);

    if (state === null || !this.definition.router.isLocale(state.locale)) {
      return undefined;
    }

    return state;
  }

  private writeHydrationState(registry: CatalogRegistry): void {
    this.transferState.set(this.stateKey, {
      locale: this.activeLocale(),
      catalogs: registry.dehydrate(),
    });
  }
}

/**
 * Surfaces malformed patterns and unresolvable placeholders while developing.
 *
 * Production stays silent: a message that fails to format still renders something, and a
 * console full of warnings on a live site helps nobody.
 */
function developmentIssueReporter(): ((issue: MessageFormatIssue) => void) | undefined {
  if (!isDevMode()) {
    return undefined;
  }

  return issue => {
    console.warn(`[etyma] message "${issue.key}" (${issue.locale}) failed to format:`, issue.error);
  };
}

/**
 * Surfaces a remote source catalog that has drifted from its build-time contract.
 *
 * Production stays silent, same reasoning as {@link developmentIssueReporter}: the app's
 * type contract naturally corresponds to the source as seen at the last generation, and a
 * key added or removed since then is not a reason to fail a live page.
 */
function developmentContractDriftReporter(): ((info: ContractDriftInfo) => void) | undefined {
  if (!isDevMode()) {
    return undefined;
  }

  return info => {
    console.warn(
      `[etyma] the remote source catalog for "${info.locale}" does not match its contract.`,
      info,
    );
  };
}
