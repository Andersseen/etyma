import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { validateCatalogs } from '@etyma/tooling';

import { VALIDATE_HELP } from '../help.js';
import { discoverCatalogFiles, readCatalogFiles } from '../io/local-catalogs.js';
import {
  fetchRemoteCatalogs,
  RemoteConfigError,
  resolveRemoteConfig,
} from '../io/remote-catalogs.js';
import { formatJson } from '../output/json.js';
import type { Origin } from '../output/json.js';
import { formatPretty } from '../output/pretty.js';
import { EXIT_USAGE_ERROR, EXIT_VALID, EXIT_VALIDATION_FAILED } from '../types.js';
import type { CatalogSource, CliResult } from '../types.js';

/**
 * `etyma validate <directory> --source <locale>` or
 * `etyma validate --remote <url-template> --locales <list> --source <locale>`, either with
 * `[--format pretty|json]`.
 *
 * An adapter, not a validator: every catalog semantic (key parity, MessageFormat 2 syntax,
 * variable parity, locale well-formedness) is `@etyma/tooling`'s `validateCatalogs`, called
 * once below - for a local directory and a remote URL template alike. Everything in this
 * file is argument parsing, catalog acquisition and presentation - see the package README for
 * why that split matters. The two modes are explicit (`--remote`, or a `<directory>`, never
 * a guess about what one string is) and differ only in how `catalogs` is produced.
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
        remote: { type: 'string' },
        locales: { type: 'string' },
        timeout: { type: 'string' },
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

  const selected = selectInput(values, positionals);

  if ('error' in selected) {
    return usageError(selected.error);
  }

  if (values.source === undefined) {
    return usageError('Missing required option --source <locale>.');
  }

  const format = values.format ?? 'pretty';

  if (format !== 'pretty' && format !== 'json') {
    return usageError(`Invalid --format "${format}". Expected "pretty" or "json".`);
  }

  const sourceLocale = values.source;

  const loaded =
    selected.mode === 'local'
      ? await loadLocalCatalogs(resolve(cwd, selected.directoryArg), sourceLocale)
      : await loadRemoteCatalogs(selected.template, values.locales, sourceLocale, values.timeout);

  if ('error' in loaded) {
    return usageError(loaded.error);
  }

  const { catalogs, locales, origin } = loaded;
  const result = validateCatalogs({ sourceLocale, catalogs });
  const messageCount = countMessages(catalogs[sourceLocale]);

  const stdout =
    format === 'json'
      ? formatJson(result, { ...origin, sourceLocale, locales, messageCount })
      : formatPretty(result, { locales, messageCount });

  return {
    exitCode: result.valid ? EXIT_VALID : EXIT_VALIDATION_FAILED,
    stdout,
    stderr: '',
  };
}

type Selected =
  | { readonly mode: 'local'; readonly directoryArg: string }
  | { readonly mode: 'remote'; readonly template: string }
  | { readonly error: string };

/**
 * Decides local or remote mode from the flags alone, and rejects a mix of the two.
 *
 * `--remote` is what selects remote mode - a positional argument is never sniffed for
 * "looks like a URL" - and `--locales` / `--timeout` exist only there.
 */
function selectInput(
  values: { readonly remote?: string; readonly locales?: string; readonly timeout?: string },
  positionals: readonly string[],
): Selected {
  if (values.remote !== undefined) {
    if (positionals.length > 0) {
      return {
        error:
          `Unexpected argument ${positionals.map(arg => `"${arg}"`).join(', ')}: --remote ` +
          'validates a URL template, not a <directory>. Use one mode or the other.',
      };
    }

    return { mode: 'remote', template: values.remote };
  }

  for (const [name, value] of [
    ['--locales', values.locales],
    ['--timeout', values.timeout],
  ] as const) {
    if (value !== undefined) {
      return { error: `${name} can only be used with --remote.` };
    }
  }

  const [directoryArg, ...extraPositionals] = positionals;

  if (directoryArg === undefined) {
    return { error: 'Missing required argument <directory> (or --remote <url-template>).' };
  }

  if (extraPositionals.length > 0) {
    return { error: `Too many arguments: ${positionals.join(', ')}. Expected one <directory>.` };
  }

  return { mode: 'local', directoryArg };
}

/** The catalogs every mode ends up with, plus what the JSON `meta` says they came from. */
interface LoadedCatalogs {
  readonly catalogs: Record<string, CatalogSource>;
  /** Sorted by locale. */
  readonly locales: readonly string[];
  readonly origin: Origin;
}

async function loadLocalCatalogs(
  directory: string,
  sourceLocale: string,
): Promise<LoadedCatalogs | { readonly error: string }> {
  let discovered;

  try {
    discovered = await discoverCatalogFiles(directory);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  if (discovered.length === 0) {
    return { error: `No *.json catalog files found in "${directory}".` };
  }

  if (!discovered.some(file => file.locale === sourceLocale)) {
    return {
      error: `Source locale "${sourceLocale}" has no catalog: expected "${sourceLocale}.json" in "${directory}".`,
    };
  }

  const files = await readCatalogFiles(discovered);
  const broken = files.filter(file => file.error !== undefined);

  if (broken.length > 0) {
    const details = broken.map(file => `  ${file.path}: ${file.error}`).join('\n');
    return { error: `Could not read ${broken.length} catalog file(s) as JSON:\n${details}` };
  }

  const catalogs: Record<string, CatalogSource> = {};

  for (const file of files) {
    catalogs[file.locale] = file.data as CatalogSource;
  }

  return {
    catalogs,
    locales: discovered.map(file => file.locale),
    origin: { mode: 'local', directory },
  };
}

/**
 * Fetches every requested locale's catalog from the `{locale}` URL template.
 *
 * A bad option combination, an unreachable host, a timeout, an HTTP error status and a body
 * that is not JSON are all reported as an `error` - validation cannot meaningfully run
 * without the catalogs, so this is a CLI input error (exit 2), exactly like malformed JSON in
 * a local file. Only a catalog that fetched and parsed goes on to `validateCatalogs`.
 */
async function loadRemoteCatalogs(
  template: string,
  localesArg: string | undefined,
  sourceLocale: string,
  timeoutArg: string | undefined,
): Promise<LoadedCatalogs | { readonly error: string }> {
  let config;

  try {
    config = resolveRemoteConfig({
      template,
      locales: localesArg,
      sourceLocale,
      timeout: timeoutArg,
    });
  } catch (error) {
    if (error instanceof RemoteConfigError) {
      return { error: error.message };
    }

    throw error;
  }

  const fetched = await fetchRemoteCatalogs(config);
  const broken = fetched.filter(catalog => catalog.error !== undefined);

  if (broken.length > 0) {
    const details = broken
      .map(catalog => `  ${catalog.locale} (${catalog.url}): ${catalog.error}`)
      .join('\n');

    return {
      error: `Could not load ${broken.length} of ${fetched.length} remote catalog(s):\n${details}`,
    };
  }

  // `Object.fromEntries` defines own properties, so a locale spelled `__proto__` cannot
  // rewrite the record's prototype the way `catalogs[locale] = ...` would.
  const catalogs = Object.fromEntries(
    fetched.map(catalog => [catalog.locale, catalog.data as CatalogSource]),
  );

  return {
    catalogs,
    locales: fetched.map(catalog => catalog.locale),
    origin: { mode: 'remote', remote: config.template },
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
