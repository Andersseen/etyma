import { inject } from '@angular/core';
import {
  Router,
  type CanActivateFn,
  type CanMatchFn,
  type RouterFeatures,
  type Routes,
} from '@angular/router';
import { routes as fileRoutes, withExtraRoutes } from '@analogjs/router';
import { EtymaI18n, ETYMA_DEFINITION } from '@etyma/angular';
import { Location } from '@angular/common';

/**
 * The route parameter the locale prefix is captured in.
 *
 * Prefixed rather than `locale` so it cannot collide with a parameter an application's own
 * page happens to use.
 */
export const ETYMA_LOCALE_PARAM = 'etymaLocale';

/**
 * Matches a URL whose first segment is a prefixed locale.
 *
 * Match-time rather than activate-time, so `/docs` - where `docs` is a page, not a language
 * - falls through to the unprefixed branch instead of 404ing inside this one.
 */
const isLocalePrefix: CanMatchFn = (_route, segments) => {
  const definition = inject(ETYMA_DEFINITION);
  const first = segments[0]?.path;

  return (
    first !== undefined && definition.router.isLocale(first) && first !== definition.sourceLocale
  );
};

/** Matches a source-locale prefix such as `/en/docs`, which redirects to `/docs`. */
const isSourceLocalePrefix: CanMatchFn = (_route, segments) => {
  const definition = inject(ETYMA_DEFINITION);

  return segments[0]?.path === definition.sourceLocale;
};

/** Removes a duplicate source-locale prefix while preserving the current query and hash. */
const redirectSourceLocalePrefix: CanActivateFn = () => {
  const definition = inject(ETYMA_DEFINITION);
  const location = inject(Location);
  const router = inject(Router);

  return router.parseUrl(definition.router.strip(location.path(true)));
};

/**
 * Loads and activates the locale a prefixed URL names, before the page renders.
 *
 * Being a guard is the whole point: it runs as part of navigation, so the catalog is in
 * memory before the first component of `/es/docs` is created. On the server that means the
 * HTML in the response is already Spanish; in the browser it means clicking a link to
 * another language never renders a frame of the old one.
 */
const activatePrefixedLocale: CanActivateFn = route => {
  const i18n = inject(EtymaI18n);
  const locale = route.paramMap.get(ETYMA_LOCALE_PARAM);

  if (locale === null) {
    return false;
  }

  return i18n.activate(locale).then(() => true);
};

/** Restores the source locale when a URL has no prefix. */
const activateSourceLocale: CanActivateFn = () => {
  const i18n = inject(EtymaI18n);

  return i18n.activate(i18n.sourceLocale).then(() => true);
};

/**
 * Serves every file-based page under both `/` and `/<locale>/`.
 *
 * ```ts
 * provideFileRouter(withLocalizedRoutes())
 * ```
 *
 * One set of page files, two URL shapes: the source locale keeps the URLs the site already
 * has, and every other locale gets a prefixed copy of the same tree. `withExtraRoutes`
 * inserts these ahead of the file-based routes, so the prefixed branch is tried first and
 * `/es/docs` cannot be mistaken for a page called `es`.
 *
 * The two branches share one `Routes` array rather than a copy of it, so a lazily loaded
 * page component is fetched once however the visitor reached it.
 */
export function withLocalizedRoutes(): RouterFeatures {
  const localized: Routes = [
    {
      path: `:${ETYMA_LOCALE_PARAM}`,
      canMatch: [isSourceLocalePrefix],
      canActivate: [redirectSourceLocalePrefix],
      children: fileRoutes,
    },
    {
      path: `:${ETYMA_LOCALE_PARAM}`,
      canMatch: [isLocalePrefix],
      canActivate: [activatePrefixedLocale],
      // The prefix changes without the branch being rebuilt when switching between two
      // prefixed locales, so the guard has to run on every navigation, not only the first.
      runGuardsAndResolvers: 'always',
      children: fileRoutes,
    },
    {
      path: '',
      canActivate: [activateSourceLocale],
      runGuardsAndResolvers: 'always',
      children: fileRoutes,
    },
  ];

  return withExtraRoutes(localized);
}
