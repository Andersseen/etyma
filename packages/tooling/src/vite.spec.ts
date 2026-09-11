/// <reference types="node" />

import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { etymaRemoteContract } from './vite.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'etyma-remote-contract-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('etymaRemoteContract', () => {
  it('writes the generated contract when none exists yet', async () => {
    const output = join(dir, 'contract.generated.ts');
    const plugin = etymaRemoteContract({
      load: () => Promise.resolve({ nav: { docs: 'Docs' } }),
      output,
    });

    await plugin.buildStart();

    expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
  });

  it('creates the output directory if it does not exist', async () => {
    const output = join(dir, 'nested', 'contract.generated.ts');
    const plugin = etymaRemoteContract({
      load: () => Promise.resolve({ nav: { docs: 'Docs' } }),
      output,
    });

    await plugin.buildStart();

    expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
  });

  it('does not rewrite the file when the generated content is unchanged', async () => {
    const output = join(dir, 'contract.generated.ts');
    const plugin = etymaRemoteContract({
      load: () => Promise.resolve({ nav: { docs: 'Docs' } }),
      output,
    });

    await plugin.buildStart();
    const firstWrite = statSync(output).mtimeMs;

    await new Promise(resolve => setTimeout(resolve, 5));
    await plugin.buildStart();

    expect(statSync(output).mtimeMs).toBe(firstWrite);
  });

  it('overwrites the file when the source catalog gains or loses a key', async () => {
    const output = join(dir, 'contract.generated.ts');
    let keys: Record<string, string> = { nav: { docs: 'Docs' } } as never;
    const plugin = etymaRemoteContract({ load: () => Promise.resolve(keys), output });

    await plugin.buildStart();
    expect(readFileSync(output, 'utf8')).not.toContain('"nav.home"');

    keys = { nav: { docs: 'Docs', home: 'Home' } } as never;
    await plugin.buildStart();

    expect(readFileSync(output, 'utf8')).toContain('"nav.home"');
  });

  it('fetches a remote URL when `source` is given instead of `load`', async () => {
    const output = join(dir, 'contract.generated.ts');
    const originalFetch = globalThis.fetch;

    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ nav: { docs: 'Docs' } }), { status: 200 }));

    try {
      const plugin = etymaRemoteContract({ source: 'https://cdn.example.com/en.json', output });

      await plugin.buildStart();

      expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when loading fails and no previously generated contract exists', async () => {
    const output = join(dir, 'contract.generated.ts');
    const plugin = etymaRemoteContract({
      load: () => Promise.reject(new Error('network down')),
      output,
    });

    await expect(plugin.buildStart()).rejects.toThrow(
      /failed to load the source catalog.*no previously generated contract/s,
    );
  });

  it('warns and keeps the existing file when loading fails but a valid one already exists', async () => {
    const output = join(dir, 'contract.generated.ts');
    const good = etymaRemoteContract({
      load: () => Promise.resolve({ nav: { docs: 'Docs' } }),
      output,
    });

    await good.buildStart();
    const before = readFileSync(output, 'utf8');

    const warn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);

    try {
      const failing = etymaRemoteContract({
        load: () => Promise.reject(new Error('network down')),
        output,
      });

      await expect(failing.buildStart()).resolves.toBeUndefined();
    } finally {
      console.warn = warn;
    }

    expect(readFileSync(output, 'utf8')).toBe(before);
    expect(calls).toHaveLength(1);
    expect(String(calls[0]?.[0])).toContain('could not refresh');
  });
});
