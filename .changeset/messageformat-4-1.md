---
'@etyma/core': patch
---

Update `messageformat` to 4.1.0. `:currency` and `:percent` are now stable MessageFormat 2
functions, so they stay registered when `draftFunctions: false` is set; the remaining draft
functions are `:date`, `:time`, `:datetime` and `:unit`.
