import { DOCUMENT, effect, inject } from '@angular/core';
import { Location } from '@angular/common';
import { ETYMA_DEFINITION } from '@etyma/angular';
import type { I18nDefinition, Locale } from '@etyma/core';

import { injectCurrentUrl } from './current-url.js';
import { resolveOrigin } from './origin.js';

/** Marks the elements Etyma owns, so it updates them instead of adding more. */
const OWNED = 'data-etyma';

interface AlternateLink {
  readonly hreflang: string;
  readonly href: string;
}

/**
 * Keeps a localized page's head telling the truth about which page it is.
 *
 * Everything is derived from the URL, which is the only value that is right on the server,
 * right after hydration, and right after a client-side navigation that changed the page
 * without changing the language. That last case is the one that quietly breaks: metadata
 * written once at bootstrap describes `/es/docs/a` forever, including on `/es/docs/b`.
 *
 * Elements are updated in place and tagged, never appended blindly, so a server-rendered
 * head and a hydrated one end up with one canonical link rather than two.
 *
 * Must be called in an injection context.
 */
export function installLocalizedSeo(origin: string | undefined): void {
  const document = inject(DOCUMENT);
  const definition = inject(ETYMA_DEFINITION);
  const location = inject(Location);
  const currentUrl = injectCurrentUrl();
  const resolvedOrigin = resolveOrigin(origin);

  /**
   * A router path as a browser would see it.
   *
   * `prepareExternalUrl` re-applies the base href the router works without, so an
   * application served from a sub-path publishes canonical URLs that resolve.
   */
  const absolute = (path: string): string =>
    `${resolvedOrigin}${location.prepareExternalUrl(path)}`;

  effect(() => {
    // Derived from the URL rather than from the active locale signal: during a language
    // switch the two disagree for a moment, and the URL is the one that is authoritative.
    const path = pathnameOf(currentUrl());
    const locale = definition.router.localeOf(path);
    const bare = definition.router.strip(path);

    const root = document.documentElement;
    root.setAttribute('lang', locale);
    root.setAttribute('dir', definition.directionOf(locale));

    setCanonical(document, absolute(path));
    setAlternates(document, alternatesFor(definition, bare, absolute));
  });
}

/**
 * Every translation of this page, plus the `x-default` a search engine shows a visitor
 * whose language the site is not published in.
 *
 * A page has to list *all* of its translations including itself, or the set is read as
 * unrelated pages competing for the same content rather than as one page in three
 * languages.
 */
function alternatesFor(
  definition: I18nDefinition,
  barePath: string,
  absolute: (path: string) => string,
): readonly AlternateLink[] {
  const links = definition.locales.map((locale: Locale) => ({
    hreflang: locale,
    href: absolute(definition.router.localize(barePath, locale)),
  }));

  return [
    ...links,
    {
      hreflang: 'x-default',
      href: absolute(definition.router.localize(barePath, definition.sourceLocale)),
    },
  ];
}

/**
 * Query strings and fragments are dropped.
 *
 * A canonical URL naming `?sort=name` tells a search engine that every sort order is a
 * separate page, which is the duplicate-content problem canonical links exist to prevent.
 */
function pathnameOf(url: string): string {
  const cut = url.search(/[?#]/);

  return cut === -1 ? url : url.slice(0, cut);
}

function setCanonical(document: Document, href: string): void {
  const existing = first(document, 'link[rel="canonical"]');

  if (existing !== undefined) {
    existing.setAttribute('href', href);
    return;
  }

  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  link.setAttribute(OWNED, 'canonical');
  document.head.appendChild(link);
}

/**
 * Rewrites the alternate set in place.
 *
 * Reusing the elements Etyma already owns is what makes this safe to run on every
 * navigation: removing and re-adding would churn the head on every route change, and
 * appending without removing would leave a page with nine alternates after three
 * navigations.
 */
function setAlternates(document: Document, wanted: readonly AlternateLink[]): void {
  const existing = all(document, `link[${OWNED}="alternate"]`);

  wanted.forEach((alternate, index) => {
    const element = existing[index] ?? createAlternate(document);

    element.setAttribute('hreflang', alternate.hreflang);
    element.setAttribute('href', alternate.href);
  });

  for (const stale of existing.slice(wanted.length)) {
    stale.remove();
  }
}

/**
 * The document head, typed the way a server DOM actually behaves.
 *
 * The DOM Angular renders into on the server is a shim, and the one bundled with
 * `@angular/platform-server` returns `undefined` from `querySelector` rather than the
 * `null` the DOM standard specifies. `lib.dom` promises `null`, so a `!== null` check
 * passes on a miss and the next line dereferences nothing - which is how this was first
 * found: a crash during prerendering that no browser test could have reproduced.
 */
interface ServerTolerantHead {
  querySelector(selector: string): Element | null | undefined;
  querySelectorAll(selector: string): ArrayLike<Element> | null | undefined;
}

function head(document: Document): ServerTolerantHead {
  return document.head;
}

function first(document: Document, selector: string): Element | undefined {
  return head(document).querySelector(selector) ?? undefined;
}

function all(document: Document, selector: string): Element[] {
  const found = head(document).querySelectorAll(selector);

  return found ? Array.from(found) : [];
}

function createAlternate(document: Document): HTMLLinkElement {
  const link = document.createElement('link');
  link.setAttribute('rel', 'alternate');
  link.setAttribute(OWNED, 'alternate');
  document.head.appendChild(link);

  return link;
}
