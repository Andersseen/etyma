---
'@etyma/core': minor
---

Export `walkMessageSource`, alongside its `MessageSourceLeaf` and `MessageSourceProblem`
types: a non-throwing walk over a nested message catalog, reporting every leaf and every
structural problem instead of throwing on the first one.

It is the same tree-walk `flattenMessages` already used internally, now available directly.
`flattenMessages` itself is unchanged — same behavior, same errors, same tests — this only
exposes the tolerant primitive underneath it for a caller that wants to collect every
problem in one pass, such as `@etyma/tooling`'s catalog validator.
