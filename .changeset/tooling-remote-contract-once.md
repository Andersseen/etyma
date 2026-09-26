---
'@etyma/tooling': patch
---

`etymaRemoteContract` now loads its source catalog once per plugin instance, as documented,
instead of on every `buildStart`.

Astro runs several Vite passes per `astro build` with the same plugin objects, and each pass
called `buildStart` again, so one build fetched the source catalog (or called `load()`) three
times and repeated its comparison and fallback warning. Every pass - including passes starting
concurrently - now shares the first one's result:

- **One acquisition.** The source URL is fetched, or `load()` called, once per plugin instance.
- **One warning.** When the load fails and a generated contract already exists, the fallback
  warns once and keeps the file, however many passes follow.
- **One failure.** When the load fails and there is no contract to fall back to, every pass of
  that build rejects with the same error instead of fetching again. The next build or
  dev-server start creates a new plugin instance and retries.

Nothing is cached across plugin instances or processes, and the options are unchanged.
`etymaRemoteValidation` already behaved this way and is unchanged.

Measured with the packed Astro 6 compatibility fixture: source-catalog requests from
`etymaRemoteContract` per `astro build` went from 3 to 1.
