import {
  inject,
  Injector,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ETYMA_DEFINITION, ETYMA_LOCALE_SWITCH, EtymaI18n } from '@etyma/angular';
import type { Locale } from '@etyma/core';

import { installLocalizedSeo } from './seo.js';

export interface EtymaAnalogOptions {
  /**
   * The absolute origin for canonical and `hreflang` URLs.
   *
   * Defaults to the origin of the request being rendered, which is correct on localhost, on
   * a preview deployment and in production without any of them being named in the
   * repository. Set it only when rendering outside a request, or behind a proxy that does
   * not forward the original host.
   */
  readonly origin?: string;

  /**
   * Manage `<html lang>`, `dir`, the canonical link and the `hreflang` set.
   *
   * On by default. Turn it off in an application that writes its own head, and Etyma will
   * leave every one of those alone.
   */
  readonly seo?: boolean;
}

/**
 * Wires Etyma to Analog: the URL decides the locale, and the head follows the URL.
 *
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideFileRouter(withLocalizedRoutes()),
 *     provideEtyma(i18n),
 *     provideEtymaAnalog(),
 *   ],
 * };
 * ```
 *
 * The locale is resolved from the request path during application initialization - before
 * the router navigates and before anything renders - so the server's very first output is
 * already in the right language. Nothing is read from or written to `localStorage`: a
 * remembered preference that could override the path would mean `/es/docs` sometimes
 * renders in English, which is the one thing a localized URL must never do.
 */
export function provideEtymaAnalog(options: EtymaAnalogOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ETYMA_LOCALE_SWITCH, useFactory: createLocaleSwitch },
    provideAppInitializer(() => {
      if (options.seo !== false) {
        installLocalizedSeo(options.origin);
      }

      return activateRequestLocale();
    }),
  ]);
}

/**
 * Loads the catalog the request's URL asks for, before the first render.
 *
 * In the browser after a server render this resolves from transferred state without a
 * second fetch, which is what makes hydration free of both a locale round trip and a flash
 * of the source language.
 */
function activateRequestLocale(): Promise<void> {
  const i18n = inject(EtymaI18n);
  const definition = inject(ETYMA_DEFINITION);
  const location = inject(Location);

  return i18n.activate(definition.router.localeOf(location.path()));
}

/**
 * Switching language is a navigation, not a state change.
 *
 * `EtymaI18n.setLocale()` routes through here, so a component that calls it moves the URL
 * rather than putting the service and the address bar into disagreement. The catalog is
 * loaded before the navigation starts, so the destination page never renders a frame in the
 * language the visitor just left.
 */
function createLocaleSwitch(): (locale: Locale) => Promise<void> {
  // Resolved lazily: `EtymaI18n` asks for this token in its own constructor, so injecting
  // the service here directly would be a cycle.
  const injector = inject(Injector);
  let switchVersion = 0;

  return async locale => {
    const version = ++switchVersion;
    const i18n = injector.get(EtymaI18n);
    const router = injector.get(Router);
    const location = injector.get(Location);
    const definition = injector.get(ETYMA_DEFINITION);

    // `Location`, not `Router.url`: until the first navigation resolves the router still
    // reports `/`, and a visitor who reaches the switcher before then - through replayed
    // events on a slow connection, which is exactly when they are most likely to - would
    // be sent to the site root instead of to this page in another language.
    const here = location.path(true);

    await i18n.load(locale);

    if (version !== switchVersion) {
      return;
    }

    await router.navigateByUrl(definition.router.localize(here, locale));
  };
}
