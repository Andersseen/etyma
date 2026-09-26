---
'@etyma/astro': minor
---

Astro 7 is now supported alongside Astro 6: the `astro` peer dependency is
`^6.0.0 || ^7.0.0`.

No API or behaviour change, and no Astro 7-specific code path - `@etyma/astro` still relies
only on `Astro.currentLocale`, `Astro.url`, `Astro.isPrerendered` and `astro:i18n`'s URL
helpers, which Astro 7 keeps unchanged. The package is still built against Astro 6, and the
same static site is built from the packed package on both Astro 6.4.8 and Astro 7.3.5 (Vite 8),
checking:

- the `/ua` route rendering the `uk` language in `lang`, `hreflang` and `etyma.locale`;
- localized paths (`etyma.path('/blog?tag=astro#latest', 'uk')` is
  `/ua/blog/?tag=astro#latest`), canonical, alternates and `x-default`;
- prerendered pages loading each remote catalog once per locale for the whole build;
- `@etyma/tooling/vite`'s `etymaRemoteContract` (one source request per build) and
  `etymaRemoteValidation` running under Astro 7's Vite 8;
- `AstroI18nContext` still matching Astro 7's `APIContext` and `AstroGlobal` types, and
  `@etyma/astro` importing from plain Node without `astro:i18n`.
