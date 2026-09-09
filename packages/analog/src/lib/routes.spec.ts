import { provideFileRouter } from '@analogjs/router';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
  ROUTES,
  Router,
  UrlSegment,
  type CanMatchFn,
  type Route,
  type Routes,
} from '@angular/router';
import { ETYMA_LOCALE_SWITCH, EtymaI18n, provideEtyma } from '@etyma/angular';
import { defineI18n, type MessageLoader } from '@etyma/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ETYMA_LOCALE_PARAM, withLocalizedRoutes } from './routes.js';
import { provideEtymaAnalog } from './provide.js';

const definition = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: { nav: { docs: 'Docs' } },
  loaders: {
    es: () => ({ nav: { docs: 'Documentación' } }),
    uk: () => ({ nav: { docs: 'Документація' } }),
  },
});

function definitionWith(loaders: { es?: MessageLoader; uk?: MessageLoader }) {
  return defineI18n({
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
    source: { nav: { docs: 'Docs' } },
    loaders: {
      es: loaders.es ?? (() => ({ nav: { docs: 'Documentación' } })),
      uk: loaders.uk ?? (() => ({ nav: { docs: 'Документація' } })),
    },
  });
}

let routes: Routes;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [provideEtyma(definition), provideFileRouter(withLocalizedRoutes())],
  });

  // `ROUTES` is a multi provider; Analog registers the localized branches ahead of the
  // file-based ones, which is what makes the prefixed branch win the match.
  routes = TestBed.inject(ROUTES).flat();
});

/** Runs a route's `canMatch` guard against a URL the way the router would. */
function canMatch(route: Route | undefined, path: string): boolean {
  const guard = route?.canMatch?.[0] as CanMatchFn | undefined;

  if (route === undefined || guard === undefined) {
    throw new Error('route has no canMatch guard');
  }

  const segments = path
    .split('/')
    .filter(Boolean)
    .map(part => new UrlSegment(part, {}));

  return TestBed.runInInjectionContext(() => guard(route, segments)) as boolean;
}

describe('withLocalizedRoutes', () => {
  it('serves the page tree under a locale prefix and under the bare path', () => {
    expect(routes[0]?.path).toBe(`:${ETYMA_LOCALE_PARAM}`);
    expect(routes[1]?.path).toBe(`:${ETYMA_LOCALE_PARAM}`);
    expect(routes[2]?.path).toBe('');
  });

  it('matches a prefixed locale', () => {
    expect(canMatch(routes[1], '/es/docs')).toBe(true);
    expect(canMatch(routes[1], '/uk')).toBe(true);
  });

  it('does not mistake a page for a locale', () => {
    expect(canMatch(routes[1], '/docs')).toBe(false);
    expect(canMatch(routes[1], '/docs/button')).toBe(false);
    expect(canMatch(routes[1], '/')).toBe(false);
  });

  it('does not match an unconfigured locale', () => {
    expect(canMatch(routes[1], '/de/docs')).toBe(false);
  });

  it('does not match the source locale, which is served without a prefix', () => {
    expect(canMatch(routes[1], '/en/docs')).toBe(false);
  });

  it('matches the source locale on its redirect branch', () => {
    expect(canMatch(routes[0], '/en/docs')).toBe(true);
    expect(canMatch(routes[0], '/es/docs')).toBe(false);
  });

  it('leaves the unprefixed branch open to everything, so it can act as the fallback', () => {
    expect(routes[2]?.canMatch).toBeUndefined();
  });

  it('guards both branches, so the locale follows the URL in either direction', () => {
    expect(routes[0]?.canActivate).toHaveLength(1);
    expect(routes[1]?.canActivate).toHaveLength(1);
    expect(routes[2]?.canActivate).toHaveLength(1);
  });

  it('re-runs its guards on every navigation, not only on the first', () => {
    expect(routes[1]?.runGuardsAndResolvers).toBe('always');
    expect(routes[2]?.runGuardsAndResolvers).toBe('always');
  });

  it('shares one page tree between the branches, so a page chunk is fetched once', () => {
    expect(routes[0]?.children).toBe(routes[1]?.children);
    expect(routes[1]?.children).toBe(routes[2]?.children);
  });
});

describe('the prefixed locale guard', () => {
  it('loads and activates the locale the URL names before the page renders', async () => {
    const i18n = TestBed.inject(EtymaI18n);
    const guard = routes[1]?.canActivate?.[0] as
      ((route: { paramMap: { get(name: string): string | null } }) => Promise<boolean>) | undefined;

    const allowed = await TestBed.runInInjectionContext(() =>
      guard?.({ paramMap: { get: () => 'es' } }),
    );

    expect(allowed).toBe(true);
    expect(i18n.locale()).toBe('es');
    expect(i18n.t('nav.docs')).toBe('Documentación');
  });

  it('restores the source locale on the unprefixed branch', async () => {
    const i18n = TestBed.inject(EtymaI18n);
    await i18n.setLocale('uk');

    const guard = routes[2]?.canActivate?.[0] as
      ((_route: unknown, state: { url: string }) => Promise<boolean>) | undefined;
    await TestBed.runInInjectionContext(() => guard?.({}, { url: '/docs' }));

    expect(i18n.locale()).toBe('en');
    expect(i18n.t('nav.docs')).toBe('Docs');
  });

  it('does not let a stale source-branch activation override a prefixed request URL', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideEtyma(definition),
        provideFileRouter(withLocalizedRoutes()),
        { provide: Location, useValue: { path: () => '/es/docs' } },
      ],
    });

    const localRoutes = TestBed.inject(ROUTES).flat();
    const i18n = TestBed.inject(EtymaI18n);
    await i18n.activate('es');

    const guard = localRoutes[2]?.canActivate?.[0] as
      ((_route: unknown, state: { url: string }) => Promise<boolean>) | undefined;
    await TestBed.runInInjectionContext(() => guard?.({}, { url: '/docs' }));

    expect(i18n.locale()).toBe('es');
    expect(i18n.t('nav.docs')).toBe('Documentación');
  });
});

describe('the Analog locale switch', () => {
  it('lets the most recent switch win when catalog loads finish out of order', async () => {
    let releaseSpanish!: (catalog: { nav: { docs: string } }) => void;
    let releaseUkrainian!: (catalog: { nav: { docs: string } }) => void;

    const es = new Promise<{ nav: { docs: string } }>(resolve => {
      releaseSpanish = resolve;
    });
    const uk = new Promise<{ nav: { docs: string } }>(resolve => {
      releaseUkrainian = resolve;
    });
    const navigateByUrl = vi.fn(() => Promise.resolve(true));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideEtyma(definitionWith({ es: () => es, uk: () => uk })),
        provideEtymaAnalog({ seo: false }),
        { provide: Location, useValue: { path: () => '/docs?tab=api#usage' } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });

    const switchLocale = TestBed.inject(ETYMA_LOCALE_SWITCH);
    const spanishSwitch = switchLocale('es');
    const ukrainianSwitch = switchLocale('uk');

    releaseUkrainian({ nav: { docs: 'Документація' } });
    await ukrainianSwitch;

    expect(navigateByUrl).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/uk/docs?tab=api#usage');

    releaseSpanish({ nav: { docs: 'Documentación' } });
    await spanishSwitch;

    expect(navigateByUrl).toHaveBeenCalledOnce();
  });
});
