---
'@etyma/tooling': minor
---

Generated contracts now carry the MessageFormat 2 functions each variable's value reaches, so
`@etyma/core` can type param values as well as names — for remote catalogs through
`etymaRemoteContract`, and for local ones through `etyma contract`:

```ts
export default defineMessageContract(
  ['footer.rights', 'welcome'] as const,
  { 'footer.rights': ['year'], welcome: ['name'] } as const,
  { 'footer.rights': { year: ['number'] } } as const,
);
```

- New `extractContractParams(source, options?)` returns `{ variables, functions }` from one
  parse per message; `extractContractVariables` is unchanged.
- `renderContractModule(keys, variables?, functions?)` takes the functions as an optional third
  argument; without it, or with none to list, the output is byte-identical to before.
- `MessageAnalysis` gains `parameterFunctions`: per external variable, the functions the caller's
  value reaches. An annotated `.input` is its variable's only evidence.

Names are recorded raw, as the source wrote them — including custom functions and disagreeing
annotations, which `@etyma/core` leaves broad. Invalid MessageFormat 2 is handled as before:
tolerated (no entry) by `etymaRemoteContract`, rejected by `etyma contract`. Commit the
regenerated contract; it changes wherever a source variable is annotated.
