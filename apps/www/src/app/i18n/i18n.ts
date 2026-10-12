import { createHttpMessageLoader, defineRemoteI18n } from '@etyma/core';

import contract from './etyma.generated';
import { catalogUrl, I18N_PROJECT } from './project';

/**
 * The application's i18n definition.
 *
 * Glossa owns every runtime catalog, including the source locale. The generated contract keeps
 * keys and MessageFormat parameter types exact without bundling translation JSON locally.
 */
const load = createHttpMessageLoader(catalogUrl);

export const i18n = defineRemoteI18n({
  locales: I18N_PROJECT.locales,
  sourceLocale: I18N_PROJECT.sourceLocale,
  contract,
  loaders: {
    en: load,
    es: load,
    uk: load,
  },
});
