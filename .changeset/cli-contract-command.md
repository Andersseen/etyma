---
'@etyma/cli': minor
---

New command: `etyma contract <source.json> --output <file>` generates the `defineMessageContract`
module for a local JSON source catalog - its exact keys, array indexes included, and each
message's MessageFormat 2 variable names, never its text. Pass it to `defineI18n` as `contract`
to type `t()` params for a JSON source.

It uses `@etyma/tooling`'s `extractContractKeys`, `extractContractVariables` and
`renderContractModule`, so the module is byte-identical to what `etymaRemoteContract` generates
for the same catalog. Output is deterministic and only written when its content changes;
missing directories are created. Malformed JSON, an invalid catalog shape, or a source message
that is not valid MessageFormat 2 exits 2 and writes nothing. It describes the source catalog
only - other locales are still `etyma validate`'s job.

`etyma --help` lists it, and `etyma contract --help` documents it. No configuration file.
