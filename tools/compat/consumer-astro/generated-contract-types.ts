/**
 * Compile-time proof that the contract `etymaRemoteContract` generated during this fixture's
 * build - from the remote source catalog, through the packed `@etyma/tooling` - types
 * `etyma.t()` and `etyma.parts()` exactly like the hand-written one `i18n/index.ts` uses:
 * param names and, where a built-in function annotates them, param values.
 *
 * `compat-check.mjs` runs `astro check` after the build for this family, so the generated
 * file exists by then.
 */
import { createAstroI18n, type AstroI18nContext } from '@etyma/astro';
import { createHttpMessageLoader, defineRemoteI18n } from '@etyma/core';

import contract from '../contract.generated.js';
import type { i18n } from './i18n/index.js';

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const load = createHttpMessageLoader(locale => `https://example.invalid/${locale}.json`);
const generated = defineRemoteI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  contract,
  loaders: { es: load, en: load, uk: load },
});

export type SameAsHandWritten = Assert<
  Equals<NonNullable<typeof generated.messageParams>, NonNullable<typeof i18n.messageParams>>
>;

declare const astro: AstroI18nContext;

export async function typed(): Promise<unknown[]> {
  const etyma = await createAstroI18n(astro, generated);

  return [
    etyma.t('footer.rights', { year: 2026n }),
    etyma.parts('posts.count', { count: 3 }),
    etyma.t('home.greeting', { name: 'Mundo' }),
    // @ts-expect-error - `{$year :number}` does not take a Date.
    etyma.t('footer.rights', { year: new Date() }),
    // @ts-expect-error - `.input {$count :number}` does not take a boolean.
    etyma.parts('posts.count', { count: true }),
    // @ts-expect-error - `home.greeting` needs `name`.
    etyma.t('home.greeting'),
  ];
}
