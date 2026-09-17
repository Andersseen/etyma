import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { validateCatalogs } from '@etyma/tooling';

import { VALIDATE_HELP } from '../help.js';
import { discoverCatalogFiles, readCatalogFiles } from '../io/catalogs.js';
import { formatJson } from '../output/json.js';
import { formatPretty } from '../output/pretty.js';
import { EXIT_USAGE_ERROR, EXIT_VALID, EXIT_VALIDATION_FAILED } from '../types.js';
import type { CatalogSource, CliResult } from '../types.js';

/**
 * `etyma validate <directory> --source <locale> [--format pretty|json]`.
 *
 * An adapter, not a validator: every catalog semantic (key parity, MessageFormat 2 syntax,
 * variable parity, locale well-formedness) is `@etyma/tooling`'s `validateCatalogs`, called
 * once below. Everything in this file is filesystem discovery, argument parsing and
 * presentation - see the package README for why that split matters.
 *
 * Never calls `process.exit()`: it returns a `CliResult` and lets `bin.ts` - the actual
 * process boundary - decide what to write and which exit code to set. That is also what
 * makes this directly testable without spawning a process (see `validate.spec.ts`).
 */
export async function runValidateCommand(argv: readonly string[], cwd: string): Promise<CliResult> {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        source: { type: 'string' },
        format: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return usageError(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;

  if (values.help) {
    return { exitCode: EXIT_VALID, stdout: VALIDATE_HELP, stderr: '' };
  }

  const [directoryArg, ...extraPositionals] = positionals;

  if (directoryArg === undefined) {
    return usageError('Missing required argument <directory>.');
  }

  if (extraPositionals.length > 0) {
    return usageError(`Too many arguments: ${positionals.join(', ')}. Expected one <directory>.`);
  }

  if (values.source === undefined) {
    return usageError('Missing required option --source <locale>.');
  }

  const format = values.format ?? 'pretty';

  if (format !== 'pretty' && format !== 'json') {
    return usageError(`Invalid --format "${format}". Expected "pretty" or "json".`);
  }

  const sourceLocale = values.source;
  const directory = resolve(cwd, directoryArg);

  let discovered;

  try {
    discovered = await discoverCatalogFiles(directory);
  } catch (error) {
    return usageError(error instanceof Error ? error.message : String(error));
  }

  if (discovered.length === 0) {
    return usageError(`No *.json catalog files found in "${directory}".`);
  }

  const sourceFile = discovered.find(file => file.locale === sourceLocale);

  if (sourceFile === undefined) {
    return usageError(
      `Source locale "${sourceLocale}" has no catalog: expected "${sourceLocale}.json" in "${directory}".`,
    );
  }

  const files = await readCatalogFiles(discovered);
  const broken = files.filter(file => file.error !== undefined);

  if (broken.length > 0) {
    const details = broken.map(file => `  ${file.path}: ${file.error}`).join('\n');
    return usageError(`Could not read ${broken.length} catalog file(s) as JSON:\n${details}`);
  }

  const catalogs: Record<string, CatalogSource> = {};

  for (const file of files) {
    catalogs[file.locale] = file.data as CatalogSource;
  }

  const result = validateCatalogs({ sourceLocale, catalogs });
  const locales = discovered.map(file => file.locale);
  const messageCount = countMessages(catalogs[sourceLocale]);

  const stdout =
    format === 'json'
      ? formatJson(result, { directory, sourceLocale, locales, messageCount })
      : formatPretty(result, { locales, messageCount });

  return {
    exitCode: result.valid ? EXIT_VALID : EXIT_VALIDATION_FAILED,
    stdout,
    stderr: '',
  };
}

function usageError(message: string): CliResult {
  return { exitCode: EXIT_USAGE_ERROR, stdout: '', stderr: `etyma validate: ${message}\n` };
}

/**
 * Counts string leaves in a parsed catalog, for the pretty/JSON summary only.
 *
 * Deliberately not `@etyma/core`'s `flattenMessages`: that would pull `@etyma/core` into this
 * package's dependency graph for a number shown in a summary line, which is exactly the
 * dependency `@etyma/cli` is meant to avoid taking directly (see the README). Tolerant of a
 * malformed node (an array, `null`, a number) rather than throwing - `@etyma/tooling` already
 * reports those as `catalog.invalid-leaf` diagnostics; this only needs to not crash while
 * counting past one.
 */
function countMessages(node: unknown): number {
  if (typeof node === 'string') {
    return 1;
  }

  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return 0;
  }

  let count = 0;

  for (const value of Object.values(node)) {
    count += countMessages(value);
  }

  return count;
}
