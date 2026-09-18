---
'@etyma/astro': patch
---

Fix two bugs found while dogfooding this package in a real Astro 6 consumer before its first release:

- `path()` no longer silently double-prefixes a path that already contains a locale segment (e.g. the current, already-prefixed `Astro.url.pathname`). It now throws a clear `EtymaError` explaining the mistake, and points at `seo().alternates` for the "current page in another locale" case, which already strips the current locale segment correctly.
- The `astro:i18n` virtual module is now imported lazily, inside `createAstroI18n`'s body, instead of statically at module scope. Previously, merely importing anything from `@etyma/astro` — even just its exported types — threw outside Astro's own Vite pipeline, for example in a plain Vitest test.
