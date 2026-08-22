import { Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideEtyma } from '@etyma/angular';
import { defineI18n } from '@etyma/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { installLocalizedSeo } from './seo.js';

const ORIGIN = 'https://etyma.example';

const definition = defineI18n({
  locales: ['en', 'es', 'uk', 'he'],
  sourceLocale: 'en',
  source: { nav: { docs: 'Docs' } },
  loaders: {
    es: () => ({ nav: { docs: 'Documentación' } }),
    uk: () => ({ nav: { docs: 'Документація' } }),
    he: () => ({ nav: { docs: 'מסמכים' } }),
  },
});

@Component({ template: '<span>page</span>' })
class Blank {
  protected readonly rendered = true;
}

const routes: Routes = [{ path: '**', component: Blank }];

let harness: RouterTestingHarness;
let document: Document;
let installed = false;

beforeEach(async () => {
  TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideEtyma(definition)],
  });

  document = TestBed.inject(DOCUMENT);
  document.head.replaceChildren();
  document.documentElement.removeAttribute('dir');
  installed = false;

  harness = await RouterTestingHarness.create();
});

/**
 * Installs the head management the way `provideEtymaAnalog()` does, then navigates.
 *
 * Installed on first use rather than in `beforeEach` so a test can seed the head before
 * the effect ever runs, which is how a server-rendered head reaching the browser looks.
 */
async function visit(url: string): Promise<void> {
  if (!installed) {
    TestBed.runInInjectionContext(() => {
      installLocalizedSeo(ORIGIN);
    });
    installed = true;
  }

  await harness.navigateByUrl(url);
  TestBed.tick();
  await harness.fixture.whenStable();
}

function alternates(): { hreflang: string; href: string }[] {
  return Array.from(document.head.querySelectorAll('link[rel="alternate"]')).map(link => ({
    hreflang: link.getAttribute('hreflang') ?? '',
    href: link.getAttribute('href') ?? '',
  }));
}

function canonical(): string | null {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
}

describe('installLocalizedSeo', () => {
  it('sets the document language and direction from the URL', async () => {
    await visit('/es/docs');

    expect(document.documentElement.getAttribute('lang')).toBe('es');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('sets dir to rtl for a right-to-left locale', async () => {
    await visit('/he/docs');

    expect(document.documentElement.getAttribute('lang')).toBe('he');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('falls back to the source locale on an unprefixed URL', async () => {
    await visit('/docs');

    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('writes an absolute canonical URL for the page being rendered', async () => {
    await visit('/es/docs');

    expect(canonical()).toBe(`${ORIGIN}/es/docs`);
  });

  it('leaves the query string out of the canonical URL', async () => {
    await visit('/es/docs?sort=name');

    expect(canonical()).toBe(`${ORIGIN}/es/docs`);
  });

  it('lists every translation of the page, plus x-default', async () => {
    await visit('/es/docs');

    expect(alternates()).toEqual([
      { hreflang: 'en', href: `${ORIGIN}/docs` },
      { hreflang: 'es', href: `${ORIGIN}/es/docs` },
      { hreflang: 'uk', href: `${ORIGIN}/uk/docs` },
      { hreflang: 'he', href: `${ORIGIN}/he/docs` },
      { hreflang: 'x-default', href: `${ORIGIN}/docs` },
    ]);
  });

  it('points x-default at the unprefixed source locale', async () => {
    await visit('/uk/docs/button');

    expect(alternates().at(-1)).toEqual({ hreflang: 'x-default', href: `${ORIGIN}/docs/button` });
  });

  it('describes the new page after navigating within one locale', async () => {
    await visit('/es/docs');
    expect(canonical()).toBe(`${ORIGIN}/es/docs`);

    await visit('/es/docs/button');

    expect(canonical()).toBe(`${ORIGIN}/es/docs/button`);
    expect(alternates()).toContainEqual({ hreflang: 'uk', href: `${ORIGIN}/uk/docs/button` });
  });

  it('describes the new page after switching locale', async () => {
    await visit('/es/docs/button');
    await visit('/uk/docs/button');

    expect(document.documentElement.getAttribute('lang')).toBe('uk');
    expect(canonical()).toBe(`${ORIGIN}/uk/docs/button`);
  });

  it('adds no duplicates however many times the page changes', async () => {
    await visit('/es/docs');
    await visit('/uk/docs/button');
    await visit('/docs');

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(alternates()).toHaveLength(definition.locales.length + 1);
  });

  it('adopts a canonical link the server already rendered rather than adding a second', async () => {
    const existing = document.createElement('link');
    existing.setAttribute('rel', 'canonical');
    existing.setAttribute('href', 'https://stale.example/wrong');
    document.head.appendChild(existing);

    await visit('/es/docs');

    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(canonical()).toBe(`${ORIGIN}/es/docs`);
  });
});
