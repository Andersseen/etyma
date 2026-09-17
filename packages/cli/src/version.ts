import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface OwnPackageJson {
  readonly version: string;
}

/**
 * `@etyma/cli`'s own installed version, read from its `package.json` at run time.
 *
 * Resolved relative to this compiled file rather than `process.cwd()` - `etyma --version`
 * must report the same thing whether it's run from the repository root, a deeply nested
 * project directory, or through a shell alias. `dist/version.js` and `src/version.ts` are
 * both exactly one directory below the package root, so the same relative path resolves
 * correctly under `vitest` (running `src/`) and once built (running `dist/`) alike.
 */
export function readOwnVersion(): string {
  const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
  const contents = readFileSync(packageJsonPath, 'utf8');

  return (JSON.parse(contents) as OwnPackageJson).version;
}
