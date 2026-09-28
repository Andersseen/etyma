/**
 * Compile-time proof, run by each fixture's `astro check`, that typed params survive
 * packaging: a remote contract that lists a message's variables makes `etyma.t()` require
 * them, through the published `@etyma/core` and `@etyma/astro` declarations.
 */
import type { AstroI18n } from '@etyma/astro';

import type { i18n } from './i18n/index.js';

type Definition = typeof i18n;

declare const etyma: AstroI18n<
  Definition['keys'][number],
  NonNullable<Definition['messageParams']>
>;

export const typed = [
  etyma.t('home.greeting', { name: 'Mundo' }),
  etyma.t('about.paragraphs.1', { author: 'Andrii' }),
  etyma.t('home.title'),
  // @ts-expect-error - `home.greeting` declares `{$name}`, so params are required.
  etyma.t('home.greeting'),
  // @ts-expect-error - `about.paragraphs.1` takes `author`, not `name`.
  etyma.t('about.paragraphs.1', { name: 'Andrii' }),
];
