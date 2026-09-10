import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The runtime packages, in dependency order. Released together as one version - see
 * `.changeset/config.json`'s `fixed` group.
 */
export const runtimePackages = ['core', 'angular', 'analog'];

/**
 * Every published package, runtime and tooling alike, in dependency order.
 *
 * `@etyma/tooling` is published but versions independently of the runtime trio: it is
 * development tooling that evolves at its own pace, and a runtime consumer should not see a
 * release whenever a catalog-validation check changes. See RELEASING.md.
 */
export const publishedPackages = [...runtimePackages, 'tooling'];

/**
 * Packs every published package exactly as `pnpm publish` would.
 *
 * Packing rather than reading `dist/` directly is the whole point: `files`,
 * `publishConfig.directory` and pnpm's rewriting of `workspace:` specifiers all happen
 * during packing, and every one of them is a way to publish something broken from a source
 * tree that looks fine.
 *
 * Tarballs are copied to a version-free name so a fixture's `package.json` does not have to
 * be edited every time the version changes.
 */
export function packAll(destination) {
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });

  return publishedPackages.map(name => {
    const cwd = join(repoRoot, 'packages', name);

    execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd, stdio: 'pipe' });

    const versioned = readdirSync(destination).find(
      file => file.startsWith(`etyma-${name}-`) && file.endsWith('.tgz'),
    );

    if (versioned === undefined) {
      throw new Error(`pnpm pack produced no tarball for @etyma/${name}`);
    }

    const stable = join(destination, `etyma-${name}.tgz`);
    cpSync(join(destination, versioned), stable);

    // Extracted as well as packed: `publint` inspects a directory, and it has to be the
    // directory the tarball contains rather than the source package, which still has
    // `node_modules` and a build output beside it.
    const extracted = join(destination, `extracted-${name}`);
    mkdirSync(extracted, { recursive: true });
    execFileSync('tar', ['-xzf', stable, '-C', extracted, '--strip-components', '1']);

    return { name: `@etyma/${name}`, directory: cwd, tarball: stable, extracted };
  });
}

/** Reads the manifest that was actually packed, out of the tarball. */
export function manifestOf(tarball) {
  const json = execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], {
    encoding: 'utf8',
  });

  return JSON.parse(json);
}

/** Every path inside a tarball, relative to the package root. */
export function contentsOf(tarball) {
  return execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map(entry => entry.replace(/^package\//, ''))
    .filter(entry => !entry.endsWith('/'));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
