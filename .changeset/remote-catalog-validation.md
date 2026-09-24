---
'@etyma/cli': minor
---

`etyma validate` can now validate remote catalogs.

A project whose production catalogs live behind an HTTP endpoint - a CDN, a headless CMS, a translation platform - has no local `en.json` for `etyma validate <directory>` to read, and so lost key parity, MessageFormat 2 and external-variable checks unless it wrote its own download step. Remote mode closes that gap:

```sh
etyma validate \
  --remote "https://cdn.example.com/i18n/{locale}.json" \
  --locales en,es,uk \
  --source en
```

- `--remote <url-template>` replaces `{locale}` with each entry of `--locales`, fetches every catalog concurrently with Node's native `fetch`, and passes the parsed JSON to the same `validateCatalogs()` local mode uses. Diagnostics, pretty output, JSON output and exit codes are identical; no catalog semantic is reimplemented in the CLI, and remote mode needed no change to `@etyma/tooling`.
- The two modes are explicit: `etyma validate <directory>` is exactly what 0.1 did, and a `<directory>` cannot be combined with `--remote`. Nothing is guessed from what a positional argument looks like.
- Public `http:` / `https:` URLs only. `file:`, `data:` and other protocols, and URLs with embedded credentials, are usage errors. No auth options exist yet. Nothing fetched is written to disk.
- Each request has its own timeout, 10 seconds by default, covering a body that stalls after the headers; `--timeout <ms>` overrides it.
- A catalog that cannot be obtained - unreachable host, timeout, HTTP error status, a body that is not JSON - is exit code `2`, reported on `stderr` with the locale, URL and reason, and never with the response body. A catalog that is obtained and wrong is a diagnostic, exit code `1`, as in local mode.
- The remote request is checked before anything is fetched: `{locale}` present, a valid `http(s)` URL, a non-empty `--locales` without repeated entries, and `--source` among them.

`--format json` gains `meta.mode` (`"local"` or `"remote"`) and, in remote mode, `meta.remote` (the URL template as typed) in place of `meta.directory`. Nothing 0.1 emitted was renamed or removed.
