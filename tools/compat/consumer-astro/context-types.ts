/**
 * Compile-time proof, run by each fixture's `astro check` against that fixture's own Astro
 * major, that the packed `AstroI18nContext` still describes Astro's real context types.
 *
 * `@etyma/astro`'s declarations are built against its lowest supported Astro, and
 * `AstroI18nContext` is a `Pick` of `APIContext`. Astro's strict preset sets `skipLibCheck`,
 * so if a newer major renamed or dropped one of those fields, the error inside the packed
 * `.d.ts` would be hidden and the field would quietly widen to `any` - the equality checks
 * below are what would fail instead.
 */
import type { AstroI18nContext } from '@etyma/astro';
import type { APIContext, AstroGlobal } from 'astro';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

// Astro's own contexts are accepted unchanged: a page's `Astro`, and a middleware or
// endpoint context.
export const fromPage = (astro: AstroGlobal): AstroI18nContext => astro;
export const fromEndpoint = (context: APIContext): AstroI18nContext => context;

export type ContextFields = [
  Assert<Equals<AstroI18nContext['currentLocale'], string | undefined>>,
  Assert<Equals<AstroI18nContext['url'], URL>>,
  Assert<Equals<AstroI18nContext['isPrerendered'], boolean | undefined>>,
];
