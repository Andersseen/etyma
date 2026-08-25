import { describe, expect, it } from 'vitest';

import { EtymaError } from './errors.js';
import { defineMessages, flattenMessages } from './messages.js';

describe('flattenMessages', () => {
  it('addresses a nested catalog by dotted key', () => {
    const catalog = flattenMessages({
      nav: { docs: 'Docs', components: 'Components' },
      welcome: 'Hello',
    });

    expect(catalog.get('nav.docs')).toBe('Docs');
    expect(catalog.get('nav.components')).toBe('Components');
    expect(catalog.get('welcome')).toBe('Hello');
  });

  it('walks arbitrarily deep', () => {
    const catalog = flattenMessages({ a: { b: { c: { d: 'deep' } } } });

    expect(catalog.get('a.b.c.d')).toBe('deep');
  });

  it('has no entry for an intermediate node', () => {
    const catalog = flattenMessages({ nav: { docs: 'Docs' } });

    expect(catalog.has('nav')).toBe(false);
    expect(catalog.size).toBe(1);
  });

  it('rejects a key containing a dot, which would collide with a nested key', () => {
    expect(() => flattenMessages({ 'nav.docs': 'Docs' })).toThrow(EtymaError);
    expect(() => flattenMessages({ 'nav.docs': 'Docs' })).toThrow(/contains a "\."/);
  });

  it('rejects a non-string leaf, naming the key', () => {
    expect(() => flattenMessages({ count: 3 as unknown as string })).toThrow(/"count" is a number/);
    expect(() => flattenMessages({ items: [] as unknown as string })).toThrow(
      /"items" is an array/,
    );
  });

  it('rejects a malformed catalog root', () => {
    expect(() => flattenMessages(null as unknown as never)).toThrow(/root is null/);
    expect(() => flattenMessages([] as unknown as never)).toThrow(/root is an array/);
  });

  it('rejects an empty key', () => {
    expect(() => flattenMessages({ '': 'nameless' })).toThrow(/empty key/);
  });
});

describe('defineMessages', () => {
  it('normalises to the same catalog a JSON file would produce', () => {
    const authored = defineMessages({ nav: { docs: 'Docs' } });
    const parsed: unknown = JSON.parse('{"nav":{"docs":"Docs"}}');

    expect(flattenMessages(authored)).toEqual(flattenMessages(parsed as typeof authored));
  });
});
