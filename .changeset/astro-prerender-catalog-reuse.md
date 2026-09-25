---
'@etyma/astro': minor
---

Prerendered pages now share loaded catalogs instead of loading them once per page.

`createAstroI18n` used to build a fresh catalog registry for every render, so a static build
with remote catalogs fetched the source catalog on every page and each secondary catalog on
every page in that locale: the request count grew with the number of pages. When Astro reports
a page as prerendered (`Astro.isPrerendered`), catalogs now load through one registry per
`I18nDefinition`, shared by every prerendered page in the process. Each locale's catalog is
loaded once per build, by the first page that needs it; pages prerendering concurrently share
that one in-flight load, and a failed load is retried by the next page instead of being
remembered.

- **One build, one snapshot.** A catalog is not fetched again mid-build, so a remote catalog
  edited during generation cannot mix two translation revisions into one deploy.
- **On-demand SSR is unchanged.** When `isPrerendered` is `false`, or absent, every call still
  loads into a registry of its own and nothing is shared between requests.
- **Only catalog content is shared.** Locale, translator, paths and SEO data stay per render.
  Definitions are kept apart by object identity, not by `id`.
- **In memory only**, for the life of the process: no disk cache and no expiry. A remote
  catalog edit appears in the next build. `astro dev` also reports prerendered pages as
  prerendered, so restart the dev server to pick up a remote edit.

No API change: `AstroI18nContext` gains an optional `isPrerendered`, which Astro's own context
always provides, so existing calls - `createAstroI18n(Astro, i18n)` - get this automatically
and hand-built contexts keep compiling.

Measured with `@etyma/astro`'s packed Astro 6 compatibility fixture (9 pages, 3 remote
locales), render-time catalog requests went from 15 to 3; on a real 11-page site, from 17 to 3,
with byte-identical output.
