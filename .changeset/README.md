# Changesets

Every change that affects a published package needs a changeset. Run `pnpm changeset`,
describe the change in the words a consumer would use, and commit the generated file with
your pull request.

`@etyma/core`, `@etyma/angular` and `@etyma/analog` are a **fixed** version group, so a
changeset for any one of them releases all three at the same version. That is deliberate for
0.0.x: the packages are designed together, `@etyma/analog` peer-depends on an exact
`@etyma/angular`, and a matrix of independent versions would be a support burden long before
it was a convenience.

`@etyma/tooling` is published too, but is not in that group — it is development tooling that
evolves at its own pace, so it versions independently. A changeset naming only
`@etyma/tooling` releases only `@etyma/tooling`. See [RELEASING.md](../RELEASING.md) for the
reasoning and for what happens after a changeset is merged.
