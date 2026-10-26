import { injectBaseURL } from '@analogjs/router/tokens';
import { DOCUMENT, Location } from '@angular/common';
import { effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { injectAppI18n } from '../i18n/inject';

export interface PageSeo {
  readonly title: string;
  readonly description: string;
  /** Structured data for this page. Replaced on every page, removed when a page has none. */
  readonly jsonLd?: readonly object[];
}

/** Open Graph wants a territory; Etyma's locales are bare languages. */
const OG_LOCALES: Readonly<Record<string, string>> = {
  en: 'en_US',
  es: 'es_ES',
  uk: 'uk_UA',
};

const JSON_LD = 'data-page-seo';

/**
 * Title, description, Open Graph, Twitter card and JSON-LD for one page.
 *
 * `@etyma/analog` already owns `lang`, `dir`, canonical and `hreflang`; this adds the tags
 * that describe the page's content, read from signals so they follow a language switch.
 * Meta tags are updated by name rather than appended, so the server's head and the hydrated
 * one stay a single set.
 *
 * Must be called in an injection context, once per routed page.
 */
export function injectPageSeo(read: () => PageSeo): void {
  const document = inject(DOCUMENT);
  const location = inject(Location);
  const meta = inject(Meta);
  const title = inject(Title);
  const i18n = injectAppI18n();
  const origin = resolveOrigin(injectBaseURL(), document);

  effect(() => {
    const page = read();
    const locale = i18n.locale();
    const bare = location.path().replace(/[?#].*$/, '');
    const path = bare === '' ? '/' : bare;
    const url = `${origin}${location.prepareExternalUrl(path)}`;
    const image = `${origin}/og.jpg`;
    const siteName = i18n.t('seo.siteName');

    title.setTitle(page.title);

    for (const [name, content] of [
      ['description', page.description],
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', page.title],
      ['twitter:description', page.description],
      ['twitter:image', image],
    ] as const) {
      meta.updateTag({ name, content });
    }

    for (const [property, content] of [
      ['og:type', 'website'],
      ['og:site_name', siteName],
      ['og:title', page.title],
      ['og:description', page.description],
      ['og:url', url],
      ['og:image', image],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', page.title],
      ['og:locale', OG_LOCALES[locale] ?? locale],
    ] as const) {
      meta.updateTag({ property, content });
    }

    setAlternateOgLocales(meta, i18n.locales, locale);
    setJsonLd(document, page.jsonLd ?? []);
  });
}

function resolveOrigin(fromRequest: string | null, document: Document): string {
  const origin =
    fromRequest !== null && fromRequest.length > 0
      ? fromRequest
      : (document.defaultView?.location.origin ?? '');

  return origin === 'null' ? '' : origin.replace(/\/$/, '');
}

function setAlternateOgLocales(meta: Meta, locales: readonly string[], active: string): void {
  meta.getTags('property="og:locale:alternate"').forEach(tag => {
    meta.removeTagElement(tag);
  });

  for (const locale of locales) {
    if (locale !== active) {
      meta.addTag({ property: 'og:locale:alternate', content: OG_LOCALES[locale] ?? locale });
    }
  }
}

/** The server DOM shim's `querySelectorAll`, typed the way `@etyma/analog`'s head code types it. */
interface ServerTolerantHead {
  querySelectorAll(selector: string): ArrayLike<Element> | null | undefined;
}

/**
 * The server DOM shim returns `undefined` from `querySelectorAll` misses on some paths; the
 * guard keeps the update a no-op there instead of a crash.
 */
function setJsonLd(document: Document, blocks: readonly object[]): void {
  const head: ServerTolerantHead = document.head;
  const found = head.querySelectorAll(`script[${JSON_LD}]`);
  const existing = found ? (Array.from(found) as HTMLScriptElement[]) : [];

  blocks.forEach((block, index) => {
    let script = existing[index];

    if (script === undefined) {
      script = document.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.setAttribute(JSON_LD, '');
      document.head.appendChild(script);
    }

    // `<` is escaped so a string inside the data can never close the script element.
    script.textContent = JSON.stringify(block).replace(/</g, '\\u003c');
  });

  for (const stale of existing.slice(blocks.length)) {
    stale.remove();
  }
}
