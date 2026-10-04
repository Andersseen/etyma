/**
 * Checks the `tools/compat/core-*` fixture's declaration output.
 *
 * `tsc` succeeding already proves the large catalog type-checks with no instantiation-depth
 * error, recursion failure or crash. What it does not prove is that the declarations an
 * application emits for its own definitions stay proportional to the catalog: a type that
 * expands instead of being referenced by name can turn a few hundred keys into megabytes of
 * `.d.ts`. This bounds each exported declaration, generously - a guard against a
 * pathological blow-up, not a size budget - and prints the numbers for information.
 *
 * Per declaration rather than per file, because TypeScript writes an exported value's
 * inferred type out in full each time: three definitions and three translators repeat the
 * key union six times, which is linear and expected.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Declaration bytes allowed per source-catalog byte, per export. Measured near 2.1. */
const MAX_RATIO = 4;

export function verifyCoreFixture(cwd) {
  const failures = [];
  const catalog = statSync(join(cwd, 'src/en.json')).size;
  let declarations;

  try {
    declarations = readFileSync(join(cwd, 'dist/app.d.ts'), 'utf8');
  } catch {
    return ['dist/app.d.ts was not emitted'];
  }

  const exports = declarations.split(/\n(?=export declare const )/).slice(1);

  if (exports.length === 0) {
    return ['dist/app.d.ts declares no exported definitions'];
  }

  for (const declaration of exports) {
    const name = /^export declare const (\w+)/.exec(declaration)?.[1];
    const ratio = declaration.length / catalog;

    console.log(
      `  info ${name}: ${declaration.length} declaration bytes, ${ratio.toFixed(2)}x the ` +
        `${catalog}-byte catalog`,
    );

    if (ratio > MAX_RATIO) {
      failures.push(
        `${name}'s declaration is ${ratio.toFixed(1)}x the catalog (limit ${MAX_RATIO}x)`,
      );
    }
  }

  return failures;
}
