---
'@etyma/tooling': minor
---

`etymaRemoteContract` now writes each remote source message's MessageFormat 2 variables into
the generated contract, so `t()` params are typed for remote catalogs as well as keys:

```ts
export default defineMessageContract(
  ['footer.rights', 'nav.docs', 'welcome'] as const,
  { 'footer.rights': ['author', 'year'], welcome: ['name'] } as const,
);
```

Variables are read with the `messageformat` parser, through the same analysis variable parity
uses. A message that is not valid MessageFormat 2 gets no entry and keeps untyped params;
`etymaRemoteValidation` reports the syntax error. A catalog with no variables still renders
the exact keys-only module, byte for byte.

New `extractContractVariables(source)`; `renderContractModule(keys, variables?)` takes the
variables as an optional second argument.

A committed contract for a catalog with variables changes on the next `vite dev` or
`vite build` - commit the regenerated file. Calls that omit a param the source message
declares then fail to compile; they already rendered a `{$name}` fallback at runtime.
