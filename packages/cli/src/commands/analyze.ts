import { readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { extractContractKeys } from '@etyma/tooling';
import type {
  AnalyzeAngularMessageUsageOptions,
  MessageUsageAnalysis,
} from '@etyma/tooling/angular';
import type { AnalyzeAstroMessageUsageOptions } from '@etyma/tooling/astro';

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
        angular: { type: 'boolean' },
        astro: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    return failure(errorMessage(error));
  }

  const { values, positionals } = parsed;
  if (values.help) return { exitCode: EXIT_VALID, stdout: ANALYZE_HELP, stderr: '' };
  if (values.angular === true && values.astro === true) {
    return failure('Options --angular and --astro are mutually exclusive.');
  }

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
    discovered = await discoverSourceFiles(
      directoryPath,
      values.exclude ?? [],
      values.angular === true,
      values.astro === true,
    );
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

  // Framework parsers are loaded only by their explicit opt-in modes.
  let analysis: MessageUsageAnalysis;
  if (values.angular === true) {
    let analyzer: {
      analyzeAngularMessageUsage: (
        options: AnalyzeAngularMessageUsageOptions,
      ) => MessageUsageAnalysis;
    };
    try {
      analyzer = await import('@etyma/tooling/angular');
    } catch (error) {
      if (isMissingAngularCompiler(error)) {
        return failure(
          'Angular analysis requires @angular/compiler ^21 || ^22. Install the version matching your Angular application.',
        );
      }
      throw error;
    }
    analysis = analyzer.analyzeAngularMessageUsage({ keys, files });
  } else if (values.astro === true) {
    let analyzer: {
      analyzeAstroMessageUsage: (
        options: AnalyzeAstroMessageUsageOptions,
      ) => Promise<MessageUsageAnalysis>;
    };
    try {
      analyzer = await import('@etyma/tooling/astro');
      analysis = await analyzer.analyzeAstroMessageUsage({ keys, files });
    } catch (error) {
      if (isMissingModule(error)) {
        return failure(
          'Astro analysis requires @astrojs/compiler ^4 (Astro 6) or @astrojs/compiler-rs ^0.5 (Astro 7). Install Astro or the matching parser.',
        );
      }
      throw error;
    }
  } else {
    const { analyzeMessageUsage } = await import('@etyma/tooling/source');
    analysis = analyzeMessageUsage({ keys, files });
  }
  const meta = {
    command: 'analyze' as const,
    directory: shownDirectory,
    catalog: shownCatalog,
    fileCount: files.length,
    catalogKeyCount: keys.length,
    ...(values.angular === true ? { mode: 'angular' as const } : {}),
    ...(values.astro === true ? { mode: 'astro' as const } : {}),
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

function isMissingAngularCompiler(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
  );
}

function isMissingModule(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
  );
}

function failure(message: string): CliResult {
  return { exitCode: EXIT_USAGE_ERROR, stdout: '', stderr: `etyma analyze: ${message}\n` };
}
