---
'@etyma/cli': patch
---

`etyma validate` accepts catalogs with arrays of strings, locally and with `--remote`, through
`@etyma/tooling`'s array support: a translated array with a missing or extra element is
reported at that element's index. The summary counts each array element as one message.
