# Changesets

Every change that affects a published package needs a changeset. Run `pnpm changeset`,
describe the change in the words a consumer would use, and commit the generated file with
your pull request.

The three published packages are a **fixed** version group, so a changeset for any one of
them releases all three at the same version. That is deliberate for 0.0.x: the packages are
designed together, `@etyma/analog` peer-depends on an exact `@etyma/angular`, and a matrix
of independent versions would be a support burden long before it was a convenience.

See [RELEASING.md](../RELEASING.md) for what happens after a changeset is merged.
