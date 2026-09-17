/**
 * `@etyma/cli`'s programmatic surface.
 *
 * The primary interface is the `etyma` binary; this entry point exists so `validate` can be
 * driven directly - by a test, an editor, or a future MCP tool - without spawning a process
 * and parsing its stdout back into structured data that was structured a moment ago.
 *
 * @packageDocumentation
 */

export { runValidateCommand } from './commands/validate.js';
export { runCli } from './cli.js';
export type { CliResult } from './types.js';
