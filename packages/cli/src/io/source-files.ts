import { readdir } from 'node:fs/promises';
import { extname, join, matchesGlob as pathMatchesGlob, relative, resolve } from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.angular',
  '.astro',
]);

/** A source file's absolute read path and its stable path relative to the scan root. */
export interface DiscoveredSourceFile {
  readonly absolutePath: string;
  readonly path: string;
}

/** Recursively finds supported source files without following symlinks. */
export async function discoverSourceFiles(
  directory: string,
  excludes: readonly string[],
): Promise<DiscoveredSourceFile[]> {
  const root = resolve(directory);
  const found: DiscoveredSourceFile[] = [];

  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => compareCodeUnits(a.name, b.name));

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await visit(join(current, entry.name));
        continue;
      }

      // Dirents for symbolic links are neither files nor directories, so they are skipped.
      if (!entry.isFile()) continue;

      const absolutePath = join(current, entry.name);
      const extension = extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(extension) || isDeclarationFile(entry.name)) continue;

      const path = toPosix(relative(root, absolutePath));
      if (excludes.some(pattern => matchesGlob(path, pattern))) continue;

      found.push({ absolutePath, path });
    }
  }

  await visit(root);
  found.sort((a, b) => compareCodeUnits(a.path, b.path));
  return found;
}

function matchesGlob(path: string, pattern: string): boolean {
  // path.matchesGlob is available from the package's Node >=22.22 baseline.
  return pathMatchesGlob(path, pattern);
}

function isDeclarationFile(name: string): boolean {
  return /\.d\.(?:ts|mts|cts)$/i.test(name);
}

function toPosix(path: string): string {
  return path.replaceAll('\\', '/');
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
