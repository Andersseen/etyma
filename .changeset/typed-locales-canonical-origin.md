---
'@etyma/core': minor
'@etyma/angular': minor
'@etyma/analog': minor
'@etyma/tooling': minor
---

Typed locales, a clearer canonical origin and a dev-server fix for stale catalog types.

- `I18nDefinition` and `EtymaI18n` take a third `TLocale` type parameter (defaulting to `string`, so existing code is unaffected). `i18n.locale()`, `i18n.locales` and `i18n.sourceLocale` are now the union given to `defineI18n({ locales: [...] })` when the service comes from `injectI18n(i18n)`.
- `@etyma/analog`: the `origin` option is now documented as the way to point canonical and `hreflang` URLs at production, instead of at a preview deployment's own host. Behaviour is unchanged.
- `@etyma/tooling`: new `etymaCatalogReload()` Vite plugin (`@etyma/tooling/vite`) that invalidates the modules depending on a catalog when it changes, so a running dev server no longer keeps the old typed keys.
