import { InjectionToken } from '@angular/core';
import type { I18nDefinition, Locale } from '@etyma/core';

/**
 * The validated i18n configuration for this application.
 *
 * Provided by `provideEtyma()`. Integrations read it instead of taking the definition as a
 * parameter, so an Analog route guard and an Angular component always agree about which
 * catalog is in play.
 */
export const ETYMA_DEFINITION = new InjectionToken<I18nDefinition>('etyma.definition');

/**
 * How this application switches locale.
 *
 * `EtymaI18n.setLocale()` delegates here when something has provided it. That indirection
 * is what keeps a single source of truth: in an Analog application the URL decides the
 * locale, so `@etyma/analog` provides a switch that navigates, and calling `setLocale()`
 * from a component moves the URL instead of quietly disagreeing with it.
 *
 * Without a provider, `setLocale()` loads the catalog and applies it directly.
 */
export const ETYMA_LOCALE_SWITCH = new InjectionToken<(locale: Locale) => Promise<void>>(
  'etyma.locale-switch',
);
