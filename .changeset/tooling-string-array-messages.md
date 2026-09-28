---
'@etyma/tooling': minor
---

Validation and contract generation understand arrays of strings in catalogs, as `@etyma/core`
now does. Each element is checked as the indexed key it flattens to, so the existing checks
apply per element with no new rules: a translated array one element short is
`catalog.missing-key` for the last index (`features.2`), one element long is
`catalog.extra-key`, and MessageFormat 2 syntax and variable parity are checked per element
(`message.missing-variable` at `rows.0`). `etymaRemoteContract` writes the exact indexes of a
remote source catalog's arrays into the generated contract, sorted like every other key.

- New diagnostic `catalog.empty-array`, keyed by the array, for an array with no elements.
- A non-string array element - an object, a nested array, a number - is
  `catalog.invalid-leaf` keyed by the element's own index (`features.1`), not by the array.
- `catalog.invalid-leaf` no longer fires for a non-empty array of strings.
