#!/usr/bin/env node
import { runCli } from './cli.js';

// `process` is used as the Node global here, not imported from `node:process`: a namespace
// import makes every property readonly (TypeScript models ES module namespace objects as
// immutable), and `process.exitCode` below needs a live, mutable reference - the whole
// reason this file, not `cli.ts`, is the one place that touches it. See the package README
// for why nothing deeper in this package calls `process.exit()` directly.

const result = await runCli(process.argv.slice(2), process.cwd());

if (result.stdout.length > 0) {
  process.stdout.write(result.stdout);
}

if (result.stderr.length > 0) {
  process.stderr.write(result.stderr);
}

process.exitCode = result.exitCode;
