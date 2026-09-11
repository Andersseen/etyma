/// <reference types="node" />

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { EtymaError, type MessageSource } from '@etyma/core';

import { extractContractKeys, renderContractModule } from './generate-contract.js';

export type EtymaRemoteContractOptions =
  | { readonly source: string; readonly output: string }
  | { readonly load: () => Promise<MessageSource>; readonly output: string };

/**
 * A Vite plugin, declared structurally rather than typed against `vite`'s own `Plugin`.
 *
 * `@etyma/tooling` ships with zero peer dependencies - a development tooling package should
 * need none - so this file never imports `vite`. Vite (and the Rollup interface its plugins
 * are built on) resolve plugins duck-typed: an object with a `name` and the hooks it
 * implements is indistinguishable from one built against the real `Plugin` type.
 */
export interface EtymaContractPlugin {
  readonly name: string;
  buildStart(): Promise<void>;
}

/**
 * Generates a `defineMessageContract` module from a remote catalog's shape, automatically,
 * as part of `vite dev` and `vite build`.
 *
 * Etyma's compile-time key contract is decoupled from the runtime source catalog in remote
 * mode - see `defineRemoteI18n` in `@etyma/core` - and this closes that gap without a
 * consumer hand-maintaining the contract: it loads the source catalog once per build or
 * dev-server start, derives its keys, and writes `output` only when the rendered content
 * actually changed, so the file stays a normal, reviewable diff instead of churning on every
 * run.
 *
 * If loading the catalog fails and `output` does not already hold a previously generated
 * contract, this throws - which fails `vite dev`/`vite build` loudly rather than silently
 * widening every translation key to `string`. If a file already exists at `output`, a failed
 * load falls back to it with a warning instead: the file already in the branch is, by
 * construction, the last one known to work.
 */
export function etymaRemoteContract(options: EtymaRemoteContractOptions): EtymaContractPlugin {
  return {
    name: 'etyma-remote-contract',
    buildStart: () => generate(options),
  };
}

async function generate(options: EtymaRemoteContractOptions): Promise<void> {
  const existing = readExisting(options.output);
  const source = await loadCatalog(options, existing);

  if (source === undefined) {
    return;
  }

  const rendered = renderContractModule(extractContractKeys(source));

  if (rendered === existing) {
    return;
  }

  mkdirSync(dirname(options.output), { recursive: true });
  writeFileSync(options.output, rendered);
}

async function loadCatalog(
  options: EtymaRemoteContractOptions,
  existing: string | undefined,
): Promise<MessageSource | undefined> {
  try {
    return 'load' in options ? await options.load() : await fetchCatalog(options.source);
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);

    if (existing !== undefined) {
      console.warn(
        `[etyma] could not refresh the remote message contract at "${options.output}"; ` +
          `keeping the existing one. ${reason}`,
      );

      return undefined;
    }

    throw new EtymaError(
      `etymaRemoteContract: failed to load the source catalog for "${options.output}", and ` +
        `no previously generated contract exists to fall back to. ${reason}`,
    );
  }
}

function readExisting(output: string): string | undefined {
  try {
    return readFileSync(output, 'utf8');
  } catch {
    return undefined;
  }
}

async function fetchCatalog(url: string): Promise<MessageSource> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new EtymaError(
      `Failed to fetch message catalog from "${url}": HTTP ${response.status} ${response.statusText}.`,
    );
  }

  return (await response.json()) as MessageSource;
}
