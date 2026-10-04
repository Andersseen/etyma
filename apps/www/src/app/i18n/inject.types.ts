/**
 * Compile-time proof that the generated contract reaches components through Angular.
 *
 * Type-only: nothing imports this file, so it never reaches a bundle, and `pnpm typecheck`
 * is what runs it - an `@ts-expect-error` that stops being needed fails it on its own. The
 * real call sites are `footer.rights` in `app.ts` and `button.released` in
 * `pages/docs/button.page.ts`, whose templates `ngc` checks in the same script.
 */
import type { injectAppI18n } from './inject';

declare const i18n: ReturnType<typeof injectAppI18n>;

// `footer.rights` is `{$year :number}`: a number is accepted, a date is not, and the param
// cannot be left out.
i18n.t('footer.rights', { year: 2026 });
// @ts-expect-error - `:number` does not take a Date.
i18n.t('footer.rights', { year: new Date() });
// @ts-expect-error - the message has a required `year` param.
i18n.t('footer.rights');

// `button.released` is `{$on :date}`: a Date is accepted, a boolean is not.
i18n.t('button.released', { on: new Date() });
// @ts-expect-error - `:date` does not take a boolean.
i18n.t('button.released', { on: true });

// Keys are still exact: the contract's key list matches the JSON source's.
i18n.t('seo.tagline');
// @ts-expect-error - not a key `en.json` defines.
i18n.t('seo.taglin');
