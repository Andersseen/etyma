/**
 * A clean consumer of `@etyma/astro`, exercising the exact configuration the task that
 * added the package cared about most: the Ukrainian route is served at `/ua`, but its
 * language code is `uk` - path and language code deliberately differ.
 */
import { defineI18n } from '@etyma/core';

import es from './es.json';

export const i18n = defineI18n({
  locales: ['es', 'en', 'uk'],
  sourceLocale: 'es',
  source: es,
  loaders: {
    en: () => import('./en.json'),
    uk: () => import('./uk.json'),
  },
});
