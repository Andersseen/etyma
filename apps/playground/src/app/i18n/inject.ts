import { injectI18n, type EtymaI18n } from '@etyma/angular';

import { i18n, type MessageId } from './i18n';

/**
 * The application's typed handle on Etyma.
 *
 * One line of glue so a component reads `injectAppI18n()` instead of repeating the
 * definition at every call site. `injectI18n(i18n)` is the underlying API; passing the
 * definition is what makes `t('docs.titel')` a compile error rather than a blank page.
 *
 * Separate from `i18n.ts` so the definition itself stays free of Angular - the same split
 * the packages make, and the reason a catalog test can load it without a browser.
 */
export const injectAppI18n = (): EtymaI18n<MessageId> => injectI18n(i18n);
