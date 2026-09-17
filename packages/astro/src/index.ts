/**
 * Astro bindings for Etyma.
 *
 * Astro owns routing: `i18n.locales`, `i18n.defaultLocale` and `i18n.routing` in
 * `astro.config`, and the `astro:i18n` helpers built on top of them. Etyma owns messages:
 * typed catalogs, MessageFormat 2, lazy loading. `createAstroI18n` is the thin,
 * render-scoped bridge between the two - it reads the locale Astro already resolved and
 * builds a translator from it, and never reimplements URL routing of its own.
 *
 * @packageDocumentation
 */

export { createAstroI18n } from './create-astro-i18n.js';
export type { AstroI18n, AstroI18nContext, AstroSeoAlternate, AstroSeoData } from './types.js';
