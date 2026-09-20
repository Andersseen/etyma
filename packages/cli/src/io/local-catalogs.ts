import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

/** One `*.json` file found directly inside a catalog directory. */
export interface DiscoveredCatalogFile {
  readonly locale: string;
  readonly path: string;
}

/** A directory that could not be listed - does not exist, or is not a directory. */
export class CatalogDirectoryError extends Error {}

/**
 * Finds every `*.json` file directly inside `directory` and derives each one's locale from
 * its filename (`en.json` -> `"en"`, `pt-BR.json` -> `"pt-BR"`).
 *
 * Deliberately not recursive: the directory the caller names is the whole scope (see the
 * package README's non-goals), and a non-`.json` file already there - a README, a `.DS_Store`
 * - is silently ignored rather than treated as ambiguous. Locale well-formedness and
 * canonical-tag collisions are not checked here; that is `@etyma/tooling`'s job once the
 * catalogs are read, not file discovery's.
 *
 * The result is sorted by locale so that discovery, and everything built from it, is
 * deterministic for a given directory regardless of the filesystem's own readdir order.
 */
export async function discoverCatalogFiles(directory: string): Promise<DiscoveredCatalogFile[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CatalogDirectoryError(`Cannot read directory "${directory}": ${reason}`);
  }

  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => ({ locale: basename(entry.name, '.json'), path: join(directory, entry.name) }));

  return files.sort((a, b) => a.locale.localeCompare(b.locale));
}

/** One file's content, or the reason it could not be loaded as JSON. */
export interface CatalogFileResult {
  readonly locale: string;
  readonly path: string;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Reads and parses every discovered file.
 *
 * A read or parse failure is reported per file, in `error`, rather than thrown - the caller
 * collects every broken file in one pass instead of stopping at the first one. A malformed
 * JSON file is never passed on to `validateCatalogs()`: it is not yet a catalog, so it is not
 * a catalog diagnostic, it is a CLI input error (see the package README).
 */
export async function readCatalogFiles(
  files: readonly DiscoveredCatalogFile[],
): Promise<CatalogFileResult[]> {
  return Promise.all(
    files.map(async (file): Promise<CatalogFileResult> => {
      try {
        const text = await readFile(file.path, 'utf8');
        return { locale: file.locale, path: file.path, data: JSON.parse(text) as unknown };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { locale: file.locale, path: file.path, error: reason };
      }
    }),
  );
}
