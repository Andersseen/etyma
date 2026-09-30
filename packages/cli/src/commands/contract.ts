import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { extractContractKeys, extractContractParams, renderContractModule } from '@etyma/tooling';

import { CONTRACT_HELP } from '../help.js';
import { EXIT_USAGE_ERROR, EXIT_VALID, EXIT_VALIDATION_FAILED } from '../types.js';
import type { CatalogSource, CliResult } from '../types.js';

/**
 * `etyma contract <source.json> --output <file> [--check]`.
 *
 * Generates the `defineMessageContract` module for one local source catalog - the file
 * `defineI18n({ source, contract })` reads for typed params, and exact array keys, that a
 * `.json` import cannot give. An adapter like `validate`: reading keys, reading MessageFormat
 * 2 variables and the functions their values reach, and rendering the module are
 * `@etyma/tooling`'s `extractContractKeys`, `extractContractParams` and
 * `renderContractModule` - the same three `etymaRemoteContract` uses for a remote catalog -
 * so both produce byte-identical modules for the same catalog. Everything here is arguments
 * and files.
 *
 * It describes the source catalog and nothing else: translated catalogs are `etyma
 * validate`'s job. It does refuse a source message that is not valid MessageFormat 2, since it
 * was asked for that message's variables and cannot know them.
 *
 * `output` is written only when its content would change, so an unchanged catalog touches no
 * file and triggers no rebuild. Every generation failure is exit 2: nothing here produces
 * catalog diagnostics, only a module or a reason there is none.
 *
 * `--check` renders the same module and compares it byte for byte with `output`, writing
 * nothing - not even a directory. A missing or stale output is exit 1: the check ran and found
 * the committed contract wrong, the way `validate` finds a catalog wrong. That is what catches
 * a same-key change `defineI18n`'s key comparison cannot see, such as `{$count :number}`
 * becoming `{$count :datetime}`. Byte equality is enough because the rendering is
 * deterministic; there is nothing to parse and no hash to keep.
 */
export async function runContractCommand(argv: readonly string[], cwd: string): Promise<CliResult> {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        output: { type: 'string', short: 'o' },
        check: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }

  const { values, positionals } = parsed;

  if (values.help) {
    return { exitCode: EXIT_VALID, stdout: CONTRACT_HELP, stderr: '' };
  }

  const [sourceArg, ...extra] = positionals;

  if (sourceArg === undefined) {
    return failure('Missing required argument <source.json>.');
  }

  if (extra.length > 0) {
    return failure(`Too many arguments: ${positionals.join(', ')}. Expected one <source.json>.`);
  }

  if (values.output === undefined) {
    return failure('Missing required option --output <file>.');
  }

  const sourcePath = resolve(cwd, sourceArg);
  const outputPath = resolve(cwd, values.output);

  if (sourcePath === outputPath) {
    return failure('--output must not be the source catalog itself.');
  }

  // Paths in messages are relative to where the command ran, as a developer typed them -
  // never an absolute machine path.
  const shownSource = relative(cwd, sourcePath) || sourceArg;
  const shownOutput = relative(cwd, outputPath) || values.output;
  const source = await readSource(sourcePath, shownSource);

  if ('error' in source) {
    return failure(source.error);
  }

  let rendered: string;
  let keyCount: number;

  try {
    const keys = extractContractKeys(source.catalog);

    if (keys.length === 0) {
      return failure(`"${shownSource}" has no messages; a contract needs at least one key.`);
    }

    const { variables, functions } = extractContractParams(source.catalog, { strict: true });

    rendered = renderContractModule(keys, variables, functions);
    keyCount = keys.length;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return failure(`Cannot generate a contract from "${shownSource}":\n${reason}`);
  }

  if (values.check) {
    let existing: string | undefined;

    try {
      existing = await readExisting(outputPath);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      return failure(`Cannot read "${shownOutput}": ${reason}`);
    }

    if (existing === rendered) {
      return success(`✓ ${shownOutput} is up to date (${count(keyCount)})\n`);
    }

    const [state, verb] =
      existing === undefined ? ['missing', 'Generate'] : ['out of date', 'Regenerate'];

    return {
      exitCode: EXIT_VALIDATION_FAILED,
      stdout:
        `✗ ${shownOutput} is ${state}.\n` +
        `  ${verb} it with: etyma contract ${shownSource} --output ${shownOutput}\n`,
      stderr: '',
    };
  }

  try {
    if ((await readExisting(outputPath)) === rendered) {
      return success(`✓ ${shownOutput} is up to date (${count(keyCount)})\n`);
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, rendered);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return failure(`Cannot write "${shownOutput}": ${reason}`);
  }

  return success(`✓ Wrote ${shownOutput} (${count(keyCount)})\n`);
}

async function readSource(
  path: string,
  shown: string,
): Promise<{ readonly catalog: CatalogSource } | { readonly error: string }> {
  let text: string;

  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return { error: `Cannot read "${shown}": ${reason}` };
  }

  try {
    return { catalog: JSON.parse(text) as CatalogSource };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    return { error: `"${shown}" is not valid JSON: ${reason}` };
  }
}

/** The file already at `path`, or `undefined` when there is none to compare with. */
async function readExisting(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

function count(keys: number): string {
  return `${keys} ${keys === 1 ? 'key' : 'keys'}`;
}

function success(stdout: string): CliResult {
  return { exitCode: EXIT_VALID, stdout, stderr: '' };
}

function failure(message: string): CliResult {
  return { exitCode: EXIT_USAGE_ERROR, stdout: '', stderr: `etyma contract: ${message}\n` };
}
