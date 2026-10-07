import { readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { extractContractKeys } from '@etyma/tooling';

import { ANALYZE_HELP } from '../help.js';
import { discoverSourceFiles } from '../io/source-files.js';
import { formatAnalyzeJson, formatAnalyzePretty } from '../output/analyze.js';
import { EXIT_USAGE_ERROR, EXIT_VALID, EXIT_VALIDATION_FAILED } from '../types.js';
import type { CatalogSource, CliResult } from '../types.js';

/** Filesystem and presentation adapter for the in-memory source analyzer. */
export async function runAnalyzeCommand(argv: readonly string[], cwd: string): Promise<CliResult> {
  let parsed;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        catalog: { type: 'string' },
        format: { type: 'string' },
        exclude: { type: 'string', multiple: true },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return failure(errorMessage(error));
  }

  const { values, positionals } = parsed;
  if (values.help) return { exitCode: EXIT_VALID, stdout: ANALYZE_HELP, stderr: '' };

  const [directoryArg, ...extra] = positionals;
  if (directoryArg === undefined) return failure('Missing required argument <directory>.');
  if (extra.length > 0) {
    return failure(`Too many directories: ${positionals.join(', ')}. Expected one <directory>.`);
  }
  if (values.catalog === undefined) return failure('Missing required option --catalog <file>.');

  const format = values.format ?? 'pretty';
  if (format !== 'pretty' && format !== 'json') {
    return failure(`Invalid --format "${format}". Expected "pretty" or "json".`);
  }

  const directoryPath = resolve(cwd, directoryArg);
  const catalogPath = resolve(cwd, values.catalog);
  const shownDirectory = displayPath(cwd, directoryPath);
  const shownCatalog = displayPath(cwd, catalogPath);

  try {
    const directoryInfo = await stat(directoryPath);
    if (!directoryInfo.isDirectory()) return failure(`"${shownDirectory}" is not a directory.`);
  } catch (error) {
    return failure(`Cannot access directory "${shownDirectory}": ${errorMessage(error)}`);
  }

  let catalogText: string;
  try {
    catalogText = await readFile(catalogPath, 'utf8');
  } catch (error) {
    return failure(`Cannot read catalog "${shownCatalog}": ${errorMessage(error)}`);
  }

  let catalog: CatalogSource;
  try {
    catalog = JSON.parse(catalogText) as CatalogSource;
  } catch (error) {
    return failure(`Catalog "${shownCatalog}" is not valid JSON: ${errorMessage(error)}`);
  }

  let keys: readonly string[];
  try {
    keys = extractContractKeys(catalog);
  } catch (error) {
    return failure(`Cannot extract message keys from "${shownCatalog}": ${errorMessage(error)}`);
  }

  let discovered;
  try {
    discovered = await discoverSourceFiles(directoryPath, values.exclude ?? []);
  } catch (error) {
    return failure(`Cannot scan "${shownDirectory}": ${errorMessage(error)}`);
  }

  const files = [];
  for (const file of discovered) {
    try {
      files.push({ path: file.path, source: await readFile(file.absolutePath, 'utf8') });
    } catch (error) {
      return failure(`Cannot read source file "${file.path}": ${errorMessage(error)}`);
    }
  }

  // Keep TypeScript out of help, validate, contract and version startup graphs.
  const { analyzeMessageUsage } = await import('@etyma/tooling/source');
  const analysis = analyzeMessageUsage({ keys, files });
  const meta = {
    command: 'analyze' as const,
    directory: shownDirectory,
    catalog: shownCatalog,
    fileCount: files.length,
    catalogKeyCount: keys.length,
  };
  const output =
    format === 'json'
      ? formatAnalyzeJson(analysis, meta)
      : formatAnalyzePretty(analysis, { fileCount: files.length });
  const hasErrors = analysis.diagnostics.some(diagnostic => diagnostic.severity === 'error');

  return {
    exitCode: hasErrors ? EXIT_VALIDATION_FAILED : EXIT_VALID,
    stdout: output,
    stderr: '',
  };
}

function displayPath(cwd: string, path: string): string {
  return (relative(resolve(cwd), path) || '.').replaceAll('\\', '/');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(message: string): CliResult {
  return { exitCode: EXIT_USAGE_ERROR, stdout: '', stderr: `etyma analyze: ${message}\n` };
}
