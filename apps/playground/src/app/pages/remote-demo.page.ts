import { inject, ChangeDetectionStrategy, Component } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import type { RouteMeta } from '@analogjs/router';
import { EtymaI18n, provideEtyma } from '@etyma/angular';

import { injectRemoteI18n } from '../i18n/remote/inject.js';
import { remoteI18n } from '../i18n/remote/remote-i18n.js';

/**
 * Loads and activates Spanish before this route's component is created.
 *
 * `provideEtyma`'s `initialLocale` option relies on `provideAppInitializer`, which Angular
 * only awaits at root bootstrap - not for an environment injector a route's own `providers`
 * create, so it silently never runs here. A guard is what `@etyma/analog`'s own
 * `activatePrefixedLocale` uses for exactly this reason: it runs as part of navigation, so
 * the server has the catalog in memory before rendering. Spanish rather than the source
 * locale is the interesting case - it proves the remote source (`en`, for fallback) loads
 * alongside the target (`es`), which is the whole point of this fixture.
 */
const activateSpanish: CanActivateFn = () =>
  inject(EtymaI18n)
    .activate('es')
    .then(() => true);

/**
 * Its own, isolated Etyma instance, deliberately separate from the app's root `i18n`.
 *
 * A route's `providers` create a child environment injector, so `remoteI18n` never touches
 * the app's static definition or its `withLocalizedRoutes()` guards - this page proves
 * `defineRemoteI18n` on its own terms.
 */
export const routeMeta: RouteMeta = {
  providers: [provideEtyma(remoteI18n)],
  canActivate: [activateSpanish],
};

@Component({
  selector: 'app-remote-demo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="remote-title">{{ t('remote.title') }}</h1>
    <p data-testid="remote-lede">{{ t('remote.lede') }}</p>
    <p data-testid="remote-nav-docs">{{ t('nav.docs') }}</p>
    <p data-testid="remote-active">{{ t('remote.active', { locale: i18n.locale() }) }}</p>

    <button type="button" data-testid="remote-switch-en" (click)="i18n.activate('en')">
      English
    </button>
    <button type="button" data-testid="remote-switch-es" (click)="i18n.activate('es')">
      Español
    </button>
    <button type="button" data-testid="remote-switch-uk" (click)="i18n.activate('uk')">
      Українська
    </button>
  `,
})
export default class RemoteDemoPage {
  /**
   * `.activate()`, not `.setLocale()`: this route has no URL-driven locale of its own, and
   * `setLocale()` would otherwise pick up the *root* app's `ETYMA_LOCALE_SWITCH` - provided
   * by `provideEtymaAnalog()` above this route in the injector tree, and not shadowed here -
   * which navigates the root app's localized URL instead of switching this isolated
   * instance. `.activate()` never consults that token.
   */
  protected readonly i18n = injectRemoteI18n();
  protected readonly t = this.i18n.t;

  /**
   * Proves the generated contract is precise, not `string`: a key the contract does not
   * define is a compile error here, the same as it would be for the static `i18n` next to
   * this one. `pnpm typecheck` is what enforces this - a stray, unneeded `@ts-expect-error`
   * fails the build on its own.
   */
  protected readonly typeContractIsPrecise = (): string =>
    // @ts-expect-error - "remote.doesNotExist" is not a key the generated contract defines.
    this.t('remote.doesNotExist');
}
