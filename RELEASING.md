# Releasing Etyma

Three packages — `@etyma/core`, `@etyma/angular`, `@etyma/analog` — share one version and
are released together. A changeset for any of them releases all three.

`@etyma/tooling` is not in that group. It is development tooling — a catalog validator today,
with a CLI, an MCP server and CMS integrations planned on top of it — and it will evolve at
its own pace: a new diagnostic code or a stricter check is a real change worth releasing, but
it has nothing to do with the runtime engine, and a runtime-only consumer installing
`@etyma/core` should not see an unrelated version bump because tooling shipped a release. It
is therefore versioned independently in `.changeset/config.json` (simply by being absent from
`fixed` and `linked`, which is what makes a package independent under Changesets — no
extra configuration was needed). A changeset touching only `@etyma/tooling` releases only
`@etyma/tooling`; the runtime trio only moves when a changeset actually names one of them.
`tools/scripts/pack.mjs` and `package-check.mjs` check the runtime trio's shared version and
`@etyma/tooling`'s package boundary as two separate assertions for the same reason.

`@etyma/tooling` has never been published, so its first release hits the same bootstrap
problem `0.1.0` did (below): npm Trusted Publishing cannot be configured for a package that
does not exist yet. Its first release needs the same short-lived-token dance, scoped to
_only_ `@etyma/tooling`, followed by switching it to OIDC once the package exists.

The process is deliberately in three separable steps, even though only the first two need a
human:

1. **Describe** — a changeset in the pull request that made the change.
2. **Version** — `release.yml` opens a pull request that applies the pending changesets.
   Merging it is the decision to release.
3. **Publish** — `release.yml` triggers `publish.yml` automatically, the moment it finds
   nothing left to version - which is exactly the state right after step 2's pull request is
   merged. It re-runs every gate and publishes. No separate dispatch needed for a normal
   release; `publish.yml` stays manually dispatchable for a dry run or for the one thing
   automation cannot do on its own - see [Historical Bootstrap](#historical-bootstrap-010)
   and [First release of a new package](#first-release-of-a-new-package) below.

## 1. Describing a change

```sh
pnpm changeset
```

Pick the packages, pick the bump, and write the entry in the words a consumer would use.
Commit the generated file with the change it describes.

## 2. The release pull request

Every push to `main` runs `release.yml`, which uses
[changesets/action](https://github.com/changesets/action) to open or update a pull request
titled **release: version packages**. That pull request:

- bumps all three packages to the same new version,
- writes `CHANGELOG.md` entries from the changesets,
- deletes the consumed changeset files,
- refreshes the lockfile.

Review it like any other change. Merging it is the release decision.

## 3. Publishing

Nothing to do. The moment the release pull request from step 2 is merged, `release.yml`'s
`version` job runs again on that merge commit, finds no changesets left, and its `publish`
job calls `publish.yml` - `use-oidc: true`, the current default - which re-runs every gate
and publishes from the `npm-publish` environment.

The repository side is already prepared for Trusted Publishing: `publish.yml` runs in the
protected `npm-publish` environment, grants `id-token: write` to the publish job, upgrades
npm before publishing, and sets provenance. The npm-side trusted publisher binding cannot
be proven from this repository; if a package is not bound yet, either configure it on
npmjs.com or use the manual dispatch below with `use-oidc: false`.

### Manual dispatch

`publish.yml` still takes `workflow_dispatch` directly - **Actions → Publish → Run
workflow** - for the two cases automation cannot handle on its own:

- **A dry run.** `dry-run: true` runs every gate and packs the tarballs without publishing,
  for rehearsing a release.
- **A package's first-ever publish**, or any run needing `use-oidc: false` - see
  [Historical Bootstrap](#historical-bootstrap-010) and
  [First release of a new package](#first-release-of-a-new-package).

Inputs:

- **use-oidc** — publish with npm Trusted Publishing instead of `NPM_TOKEN`. Default `true`.
- **dry-run** — run every gate and pack the tarballs without publishing. Default `false`.

Before relying on the automatic path for `0.1.1` and later, verify on npmjs.com that each
package is bound to:

- Organization or user: `Andersseen`
- Repository: `etyma`
- Workflow filename: `publish.yml`
- Environment: `npm-publish`

Binding is keyed to the **called** workflow's own filename, not whatever triggered it - a
publish that `release.yml` sets off still authenticates as `publish.yml`, so the existing
binding for `@etyma/core`, `@etyma/angular` and `@etyma/analog` needs no change.

## First release of a new package

`changeset publish` computes one plan across every package in the workspace before
publishing any of them, by asking the registry for each package's current versions. A
package that has never been published gets a normal "not found in the registry" result and
is planned like any other - this works cleanly when every package in that run is new, which
is how `0.1.0` bootstrapped the runtime trio together (see below).

A batch that **mixes** an established package with a brand-new one has, in practice, hit a
crash while computing that plan (`@changesets/cli@3.0.1`, pnpm's registry-info path -
`TypeError: Cannot read properties of undefined (reading 'includes')` in
`getPublishPlan.mjs`). It did not reproduce running the identical plan computation locally
against the same commit, which points at a transient registry hiccup during one of the
concurrent `pnpm info` calls rather than a deterministic bug - nothing was published either
way. If this happens:

1. **Retry first** - dispatch `publish.yml` again (or push an empty commit so `release.yml`
   re-evaluates). A transient registry response does not usually repeat.
2. If it repeats, publish the new package's first version on its own via manual dispatch
   with `use-oidc: false` (its Trusted Publisher cannot be configured until the package
   exists - same bootstrap problem as `0.1.0`), then let a normal run publish the rest.

## Historical Bootstrap: `0.1.0`

npm Trusted Publishing has to be configured _on an existing package_, and none of the
`@etyma` packages existed before `0.1.0`. That first release therefore used a short-lived
token, with the token intended to be revoked immediately afterwards.

**Before running the workflow**

1. On npmjs.com, confirm you can publish to the `@etyma` organization.
2. Create a **granular access token** scoped to _only_ `@etyma/core`, `@etyma/angular` and
   `@etyma/analog`, with **read and write** permission and the shortest expiry npm offers.
   Do not use a classic automation token: it can publish anything you own.
3. In the repository: **Settings → Environments → New environment → `npm-publish`**.
   - Add **required reviewers** (yourself is enough).
   - Restrict the deployment branch to `main`.
   - Add the token as the environment secret **`NPM_TOKEN`**.

The token lives in the environment, never in a file, never in a repository-level secret.

**Publishing**

1. Merge the release pull request that sets the version to `0.1.0`.
2. Run **Publish** with `use-oidc: false`. Optionally run it once with `dry-run: true`
   first.
3. Approve the environment when prompted.
4. Check the three packages on npm: version `0.1.0`, public, and each showing a provenance
   attestation.

Provenance works in this stage too — the workflow requests `id-token: write` and sets
`NPM_CONFIG_PROVENANCE`, so the attestation is signed by the workflow even though the
registry credential is still a token.

## Switching To OIDC

Once the packages exist, move off the token. Do this immediately — the whole point of the
bootstrap token is that it is temporary.

1. For **each** of `@etyma/core`, `@etyma/angular` and `@etyma/analog`, on npmjs.com:
   **Settings → Trusted Publisher → GitHub Actions**, and bind it to exactly:
   - Organization or user: `Andersseen`
   - Repository: `etyma`
   - Workflow filename: `publish.yml`
   - Environment: `npm-publish`
2. Confirm the workflow already has `id-token: write` (it does) and that it upgrades npm to
   the latest (it does — Trusted Publishing needs npm >= 11.5.1).
3. Run **Publish** with `use-oidc: true` for the next release and confirm it succeeds.
4. **Revoke `NPM_TOKEN`** on npmjs.com, and delete the `NPM_TOKEN` secret from the
   `npm-publish` environment.

From then on every release is OIDC-authenticated and provenance-backed, and the repository
holds no publishing credential at all.

## What must never happen

- No npm token in a file, a commit, or a repository-level secret. The environment is the
  only place one may live, and only until step 4 above.
- No publishing from a local machine. `pnpm release` exists for the workflow to call; run
  locally it would publish an unverified build under whichever npm identity happens to be
  logged in.
- No publishing a version whose gates did not pass on that exact commit.

## Deploying the playground

Unrelated to publishing, and separate on purpose: `deploy-playground.yml` runs after a
healthy `main`, builds the playground with Analog's Cloudflare Pages preset and deploys it
with Wrangler.

It needs a `cloudflare-playground` environment with:

- `CLOUDFLARE_API_TOKEN` — a token with the **Cloudflare Pages: Edit** permission for the
  account, and nothing else.
- `CLOUDFLARE_ACCOUNT_ID`.

The Pages project itself has to exist first; create one named `etyma-playground` (matching
`name` in `apps/playground/wrangler.toml`) with **Direct Upload**, not the dashboard's Git
integration — the build that is deployed should be the one CI tested.

To try the production build locally:

```sh
pnpm --filter @etyma/playground run build:cloudflare
pnpm --filter @etyma/playground run preview:cloudflare   # Wrangler, on :8788
```
