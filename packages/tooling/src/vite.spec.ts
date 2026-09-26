/// <reference types="node" />

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { MessageSource } from '@etyma/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { json, startFixtureServer, status } from './__testing__/fixture-server.js';
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
    const load = () => Promise.resolve({ nav: { docs: 'Docs' } });

    await etymaRemoteContract({ load, output }).buildStart();
    const firstWrite = statSync(output).mtimeMs;

    await new Promise(resolve => setTimeout(resolve, 5));
    // A new plugin instance - the next build - regenerates, and finds nothing to write.
    await etymaRemoteContract({ load, output }).buildStart();

    expect(statSync(output).mtimeMs).toBe(firstWrite);
  });

  it('overwrites the file when the next build’s source catalog gains or loses a key', async () => {
    const output = join(dir, 'contract.generated.ts');
    let catalog: MessageSource = { nav: { docs: 'Docs' } };
    const load = () => Promise.resolve(catalog);

    await etymaRemoteContract({ load, output }).buildStart();
    expect(readFileSync(output, 'utf8')).not.toContain('"nav.home"');

    catalog = { nav: { docs: 'Docs', home: 'Home' } };
    await etymaRemoteContract({ load, output }).buildStart();

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

/**
 * Astro runs several Vite passes per build, and Vite environments can start concurrently, all
 * calling `buildStart` on the same plugin object. One plugin instance is one lifecycle: it
 * acquires the source catalog once and every call shares that one outcome.
 */
describe('etymaRemoteContract lifecycle', () => {
  const catalog: MessageSource = { nav: { docs: 'Docs' } };

  it('calls a custom load once across repeated buildStart calls', async () => {
    const output = join(dir, 'contract.generated.ts');
    const load = vi.fn(() => Promise.resolve(catalog));
    const plugin = etymaRemoteContract({ load, output });

    await plugin.buildStart();
    await plugin.buildStart();
    await plugin.buildStart();

    expect(load).toHaveBeenCalledTimes(1);
    expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
  });

  it('fetches a source URL once across repeated buildStart calls', async () => {
    const server = await startFixtureServer({ '/i18n/es.json': json(catalog) });

    try {
      const output = join(dir, 'contract.generated.ts');
      const plugin = etymaRemoteContract({ source: `${server.origin}/i18n/es.json`, output });

      await plugin.buildStart();
      await plugin.buildStart();
      await plugin.buildStart();

      expect(server.requests).toEqual(['/i18n/es.json']);
      expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
    } finally {
      await server.close();
    }
  });

  it('shares one in-flight load between concurrent buildStart calls', async () => {
    const output = join(dir, 'contract.generated.ts');
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const load = vi.fn(() => gate.then(() => catalog));
    const plugin = etymaRemoteContract({ load, output });

    const starts = Promise.all([plugin.buildStart(), plugin.buildStart(), plugin.buildStart()]);
    release();
    await starts;

    expect(load).toHaveBeenCalledTimes(1);
    expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
  });

  it('fetches a source URL once for concurrent buildStart calls', async () => {
    const server = await startFixtureServer({ '/i18n/es.json': json(catalog) });

    try {
      const output = join(dir, 'contract.generated.ts');
      const plugin = etymaRemoteContract({ source: `${server.origin}/i18n/es.json`, output });

      await Promise.all([plugin.buildStart(), plugin.buildStart(), plugin.buildStart()]);

      expect(server.requests).toEqual(['/i18n/es.json']);
    } finally {
      await server.close();
    }
  });

  it('falls back with one load and one warning, however often buildStart runs', async () => {
    const output = join(dir, 'contract.generated.ts');
    writeFileSync(output, 'the previously generated contract\n');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const load = vi.fn(() => Promise.reject(new Error('network down')));
      const plugin = etymaRemoteContract({ load, output });

      await plugin.buildStart();
      await Promise.all([plugin.buildStart(), plugin.buildStart()]);

      expect(load).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('could not refresh');
      expect(readFileSync(output, 'utf8')).toBe('the previously generated contract\n');
    } finally {
      warn.mockRestore();
    }
  });

  it('reports one fatal failure to every buildStart without fetching again', async () => {
    const server = await startFixtureServer({ '/i18n/es.json': status(503, 'down') });

    try {
      const output = join(dir, 'contract.generated.ts');
      const plugin = etymaRemoteContract({ source: `${server.origin}/i18n/es.json`, output });

      const outcomes = await Promise.allSettled([plugin.buildStart(), plugin.buildStart()]);
      const later = await Promise.allSettled([plugin.buildStart()]);
      const reasons = [...outcomes, ...later].map(outcome =>
        outcome.status === 'rejected' ? (outcome.reason as unknown) : outcome,
      );

      // One failed attempt, and the very same error for the concurrent and the later pass.
      expect(String(reasons[0])).toMatch(/no previously generated contract.*HTTP 503/s);
      expect(new Set(reasons).size).toBe(1);

      expect(server.requests).toEqual(['/i18n/es.json']);
    } finally {
      await server.close();
    }
  });

  it('lets a new plugin instance retry after a failed one', async () => {
    const output = join(dir, 'contract.generated.ts');
    let available = false;
    const load = vi.fn(() =>
      available ? Promise.resolve(catalog) : Promise.reject(new Error('network down')),
    );

    const failed = etymaRemoteContract({ load, output });
    await expect(failed.buildStart()).rejects.toThrow(/network down/);

    available = true;
    // The failed instance keeps its outcome for the rest of its own lifecycle...
    await expect(failed.buildStart()).rejects.toThrow(/network down/);
    // ...and the next build's instance starts over.
    await etymaRemoteContract({ load, output }).buildStart();

    expect(load).toHaveBeenCalledTimes(2);
    expect(readFileSync(output, 'utf8')).toContain('"nav.docs"');
  });

  it('runs each plugin instance once, even with the same load and output', async () => {
    const output = join(dir, 'contract.generated.ts');
    const load = vi.fn(() => Promise.resolve(catalog));
    const a = etymaRemoteContract({ load, output });
    const b = etymaRemoteContract({ load, output });

    await Promise.all([a.buildStart(), b.buildStart(), a.buildStart(), b.buildStart()]);

    expect(load).toHaveBeenCalledTimes(2);
  });
});
