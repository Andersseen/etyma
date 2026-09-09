# Releasing Etyma

Three packages — `@etyma/core`, `@etyma/angular`, `@etyma/analog` — share one version and
are released together. A changeset for any of them releases all three.

The process is deliberately in three separable parts, so no single opaque workflow both
decides a version and pushes it to a registry:

1. **Describe** — a changeset in the pull request that made the change.
2. **Version** — `release.yml` opens a pull request that applies the pending changesets.
   Merging it is the decision to release.
3. **Publish** — `publish.yml`, dispatched by a human, re-runs every gate and publishes.

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

## 3. Publishing Current Releases

Go to **Actions → Publish → Run workflow**, and run it against the merged release commit.
For `0.1.1` and later, publish with **use-oidc: true** unless npm package settings prove
Trusted Publishing has not been configured yet.

It runs the full quality gates first — `pnpm check`, `pnpm package:check`,
`pnpm compat:check` — then builds and publishes from the `npm-publish` environment. The
gates are re-run rather than inherited from an earlier green run, because the commit being
published is what lives on npm forever.

Inputs:

- **use-oidc** — publish with npm Trusted Publishing instead of `NPM_TOKEN`. This is the
  default for current releases.
- **dry-run** — run every gate and pack the tarballs without publishing. Useful for
  rehearsing a release.

The repository side is already prepared for Trusted Publishing: `publish.yml` runs in the
protected `npm-publish` environment, grants `id-token: write` to the publish job, upgrades
npm before publishing, and sets provenance. The npm-side trusted publisher binding cannot
be proven from this repository. Before publishing `0.1.1`, verify on npmjs.com that each
package is bound to:

- Organization or user: `Andersseen`
- Repository: `etyma`
- Workflow filename: `publish.yml`
- Environment: `npm-publish`

If any package is not bound yet, either configure it before publishing or run the workflow
with **use-oidc: false** using the protected environment token, then immediately complete
the OIDC setup and revoke the token.

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
