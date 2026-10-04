---
'@etyma/tooling': minor
---

**Breaking:** `renderContractModule` takes one object, `{ keys, variables?, functions? }`
(exported as `ContractModuleInput`), so `extractContractParams`' result spreads straight in:
`renderContractModule({ keys, ...extractContractParams(source) })`. The module it renders - and
so the one `etymaRemoteContract` writes - uses `@etyma/core`'s new one-object
`defineMessageContract({ keys, variables, functions })` form, and requires `@etyma/core` 0.5.
An empty variable or function list is now left out of the module instead of written as `[]`,
which `defineMessageContract` would have rejected.

Diagnostics, and the locales `etymaRemoteValidation` reports, are now ordered by UTF-16 code
unit rather than with `localeCompare`, whose order depends on the host's default locale. The
same catalogs now produce the same diagnostic order on every machine, as documented.
