import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import type { I18nDefinition, Locale } from '@etyma/core';

import { EtymaI18n } from './i18n.js';
import { ETYMA_DEFINITION } from './tokens.js';

export interface EtymaOptions {
  /**
   * A locale to load and activate before the application renders.
   *
   * For an application that decides its locale some other way than from the URL. Analog
   * applications do not set this: `provideEtymaRouting()` from `@etyma/analog` derives the
   * locale from the request instead, which is the only answer that is right on the server
   * as well as in the browser.
   */
  readonly initialLocale?: Locale;
}

/**
 * Registers Etyma in an Angular application.
 *
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideEtyma(i18n)],
 * };
 * ```
 *
 * Nothing here needs Zone.js, and nothing here starts a subscription. The service it
 * provides is created lazily on first injection and lives for the lifetime of the
 * application injector - one per request when rendering on a server.
 */
export function provideEtyma<TKey extends string>(
  definition: I18nDefinition<TKey>,
  options: EtymaOptions = {},
): EnvironmentProviders {
  const providers: (Provider | EnvironmentProviders)[] = [
    { provide: ETYMA_DEFINITION, useValue: definition },
    EtymaI18n,
  ];

  const { initialLocale } = options;

  if (initialLocale !== undefined) {
    providers.push(provideAppInitializer(() => inject(EtymaI18n).activate(initialLocale)));
  }

  return makeEnvironmentProviders(providers);
}
