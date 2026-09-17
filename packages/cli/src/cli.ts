import { runValidateCommand } from './commands/validate.js';
import { TOP_LEVEL_HELP } from './help.js';
import { EXIT_USAGE_ERROR, EXIT_VALID } from './types.js';
import type { CliResult } from './types.js';
import { readOwnVersion } from './version.js';

/**
 * Top-level dispatch, ahead of `node:util`'s `parseArgs`.
 *
 * `parseArgs` has no notion of subcommands, and one command doesn't need it to fake one: the
 * first token is either a flag handled here (`--help`, `--version`) or the command name, and
 * everything after it belongs to that command's own `parseArgs` call - see
 * `commands/validate.ts`.
 */
export async function runCli(argv: readonly string[], cwd: string): Promise<CliResult> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h') {
    return { exitCode: EXIT_VALID, stdout: TOP_LEVEL_HELP, stderr: '' };
  }

  if (command === '--version' || command === '-v') {
    return { exitCode: EXIT_VALID, stdout: `${readOwnVersion()}\n`, stderr: '' };
  }

  if (command === 'validate') {
    return runValidateCommand(rest, cwd);
  }

  return {
    exitCode: EXIT_USAGE_ERROR,
    stdout: '',
    stderr: `etyma: unknown command "${command}"\n\n${TOP_LEVEL_HELP}`,
  };
}
