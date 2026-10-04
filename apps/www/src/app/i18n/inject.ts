import { injectI18n } from '@etyma/angular';

import { i18n } from './i18n';

/**
 * The application's typed handle on Etyma.
 *
 * One line of glue so a component reads `injectAppI18n()` instead of repeating the
 * definition at every call site. `injectI18n(i18n)` is the underlying API; passing the
 * definition is what makes `t('docs.titel')` a compile error rather than a blank page, and
 * `t('footer.rights', { year: new Date() })` one too.
 *
 * The return type is inferred on purpose. Writing it as `EtymaI18n<MessageId>` keeps the keys
 * but defaults the second type parameter, silently dropping every param type the contract
 * provides - see `inject.types.ts`.
 *
 * Separate from `i18n.ts` so the definition itself stays free of Angular - the same split
 * the packages make, and the reason a catalog test can load it without a browser.
 */
export const injectAppI18n = () => injectI18n(i18n);
