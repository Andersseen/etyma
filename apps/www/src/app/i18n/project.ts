/** The Glossa project is the runtime source of truth for every application catalog. */
export const I18N_PROJECT = {
  remote: 'https://glossa.andersseen.dev/i18n/etyma-www/{locale}.json',
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
} as const;

export const catalogUrl = (locale: string): string =>
  I18N_PROJECT.remote.replace('{locale}', locale);
