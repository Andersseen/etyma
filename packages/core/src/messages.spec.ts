import { describe, expect, it } from 'vitest';

import { EtymaError } from './errors.js';
import {
  defineMessageContract,
  defineMessages,
  flattenMessages,
  type MessageSourceLeaf,
  type MessageSourceProblem,
  walkMessageSource,
} from './messages.js';

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
    expect(() => flattenMessages({ on: true as unknown as string })).toThrow(/"on" is a boolean/);
  });

  it('rejects a malformed catalog root', () => {
    expect(() => flattenMessages(null as unknown as never)).toThrow(/root is null/);
    expect(() => flattenMessages([] as unknown as never)).toThrow(/root is an array/);
  });

  it('rejects an empty key', () => {
    expect(() => flattenMessages({ '': 'nameless' })).toThrow(/empty key/);
  });
});

describe('flattenMessages: arrays of messages', () => {
  it('flattens a string array to zero-based indexed keys', () => {
    const catalog = flattenMessages({ features: ['Typed keys', 'MessageFormat 2', 'SSR ready'] });

    expect([...catalog]).toEqual([
      ['features.0', 'Typed keys'],
      ['features.1', 'MessageFormat 2'],
      ['features.2', 'SSR ready'],
    ]);
  });

  it('flattens an array nested anywhere inside the tree', () => {
    const catalog = flattenMessages({
      nav: { items: ['Home', 'Docs'] },
      sections: { intro: { paragraphs: ['First paragraph.', 'Second paragraph.'] } },
    });

    expect(catalog.get('nav.items.1')).toBe('Docs');
    expect(catalog.get('sections.intro.paragraphs.0')).toBe('First paragraph.');
    expect(catalog.has('nav.items')).toBe(false);
  });

  it('is the same catalog as numbered object keys, so lookup cannot depend on authoring syntax', () => {
    expect(flattenMessages({ features: ['A', 'B'] })).toEqual(
      flattenMessages({ features: { '0': 'A', '1': 'B' } }),
    );
  });

  it('keeps MessageFormat 2 source untouched, the same as any other message', () => {
    const catalog = flattenMessages({
      steps: ['Hello, {$name}!', 'You have {$count :number} items.'],
    });

    expect(catalog.get('steps.1')).toBe('You have {$count :number} items.');
  });

  it('rejects an empty array, which would otherwise vanish from the key contract', () => {
    expect(() => flattenMessages({ features: [] })).toThrow(EtymaError);
    expect(() => flattenMessages({ features: [] })).toThrow(/"features" is an empty array/);
  });

  it('rejects a non-string element at its own indexed path', () => {
    const numbers = { features: ['Typed', 42, 'Safe'] } as unknown as never;
    const objects = { features: ['Typed', { nested: 'no' }] } as unknown as never;

    expect(() => flattenMessages(numbers)).toThrow(/"features\.1" is a number/);
    expect(() => flattenMessages(objects)).toThrow(/"features\.1" is an object/);
    expect(() => flattenMessages(objects)).toThrow(/array elements must be strings/);
  });

  it('rejects a nested array at the index where it occurs', () => {
    const matrix = { matrix: [['a', 'b'], ['c']] } as unknown as never;

    expect(() => flattenMessages(matrix)).toThrow(/"matrix\.0" is an array/);
  });

  it('rejects a hole in a sparse array instead of skipping its index', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(() => flattenMessages({ steps: ['a', , 'c'] as unknown as never })).toThrow(
      /"steps\.1" is undefined/,
    );
  });

  it('still rejects an array as the catalog root', () => {
    expect(() => flattenMessages(['Hello', 'World'] as unknown as never)).toThrow(
      /root is an array/,
    );
  });
});

describe('walkMessageSource', () => {
  function walk(source: unknown): {
    leaves: MessageSourceLeaf[];
    problems: MessageSourceProblem[];
  } {
    const leaves: MessageSourceLeaf[] = [];
    const problems: MessageSourceProblem[] = [];

    walkMessageSource(
      source,
      leaf => leaves.push(leaf),
      problem => problems.push(problem),
    );

    return { leaves, problems };
  }

  it('reports every leaf, in traversal order', () => {
    const { leaves, problems } = walk({ nav: { docs: 'Docs' }, welcome: 'Hello' });

    expect(leaves).toEqual([
      { path: 'nav.docs', value: 'Docs' },
      { path: 'welcome', value: 'Hello' },
    ]);
    expect(problems).toEqual([]);
  });

  it('does not stop at the first problem', () => {
    const { leaves, problems } = walk({
      ok: 'fine',
      count: 3,
      'nav.docs': 'Docs',
      also: 'fine too',
    });

    expect(leaves).toEqual([
      { path: 'ok', value: 'fine' },
      { path: 'also', value: 'fine too' },
    ]);
    expect(problems).toEqual([
      { path: 'count', kind: 'invalid-leaf', value: 3 },
      { path: 'nav.docs', kind: 'dotted-key' },
    ]);
  });

  it('reports an invalid root without throwing', () => {
    const { leaves, problems } = walk(null);

    expect(leaves).toEqual([]);
    expect(problems).toEqual([{ path: '', kind: 'invalid-root', value: null }]);
  });

  it('reports an empty key with its parent path', () => {
    const { problems } = walk({ nav: { '': 'nameless' } });

    expect(problems).toEqual([{ path: 'nav.', kind: 'empty-key' }]);
  });

  it('walks an array in index order, not lexicographic key order', () => {
    const items = Array.from({ length: 11 }, (_, index) => `item ${index}`);
    const { leaves } = walk({ items });

    expect(leaves.map(leaf => leaf.path)).toEqual(items.map((_, index) => `items.${index}`));
    expect(leaves[10]).toEqual({ path: 'items.10', value: 'item 10' });
  });

  it('reports every invalid element of an array, and keeps its valid ones', () => {
    const { leaves, problems } = walk({
      team: ['Andrii', { name: 'Julia' }, ['nested'], null, 'Ok'],
      empty: [],
    });

    expect(leaves).toEqual([
      { path: 'team.0', value: 'Andrii' },
      { path: 'team.4', value: 'Ok' },
    ]);
    expect(problems).toEqual([
      { path: 'team.1', kind: 'invalid-leaf', value: { name: 'Julia' } },
      { path: 'team.2', kind: 'invalid-leaf', value: ['nested'] },
      { path: 'team.3', kind: 'invalid-leaf', value: null },
      { path: 'empty', kind: 'empty-array' },
    ]);
  });

  it('reports a sparse-array hole the same as an explicit undefined element', () => {
    // eslint-disable-next-line no-sparse-arrays
    const { leaves, problems } = walk({ steps: ['a', , 'c'] });

    expect(leaves.map(leaf => leaf.path)).toEqual(['steps.0', 'steps.2']);
    expect(problems).toEqual([{ path: 'steps.1', kind: 'invalid-leaf', value: undefined }]);
  });

  it('reports a root array as an invalid root, not as indexed messages', () => {
    const { leaves, problems } = walk(['Hello']);

    expect(leaves).toEqual([]);
    expect(problems).toEqual([{ path: '', kind: 'invalid-root', value: ['Hello'] }]);
  });
});

describe('defineMessages', () => {
  it('normalises to the same catalog a JSON file would produce', () => {
    const authored = defineMessages({ nav: { docs: 'Docs' } });
    const parsed: unknown = JSON.parse('{"nav":{"docs":"Docs"}}');

    expect(flattenMessages(authored)).toEqual(flattenMessages(parsed as typeof authored));
  });

  it('normalises an array the same way from TypeScript and from JSON', () => {
    const authored = defineMessages({ faq: { answers: ['First', 'Second'] } });
    const parsed: unknown = JSON.parse('{"faq":{"answers":["First","Second"]}}');

    expect(flattenMessages(authored)).toEqual(flattenMessages(parsed as typeof authored));
  });
});

describe('defineMessageContract', () => {
  it('sorts keys regardless of the order they were given in', () => {
    expect(defineMessageContract({ keys: ['welcome', 'nav.docs'] }).keys).toEqual([
      'nav.docs',
      'welcome',
    ]);
  });

  it('freezes the returned keys', () => {
    expect(Object.isFrozen(defineMessageContract({ keys: ['a'] }).keys)).toBe(true);
  });

  it('rejects an empty list', () => {
    expect(() => defineMessageContract({ keys: [] })).toThrow(EtymaError);
    expect(() => defineMessageContract({ keys: [] })).toThrow(/must list at least one key/);
  });

  it('rejects a duplicate key', () => {
    expect(() => defineMessageContract({ keys: ['nav.docs', 'nav.docs'] })).toThrow(
      /key "nav.docs" is listed twice/,
    );
  });

  it('rejects the positional form older generated contracts used, saying how to fix it', () => {
    const legacy = defineMessageContract as unknown as (keys: readonly string[]) => unknown;

    expect(() => legacy(['nav.docs'])).toThrow(EtymaError);
    expect(() => legacy(['nav.docs'])).toThrow(/expected one object.*regenerate it/s);
  });

  it('ignores a field it does not know, so a newer contract still loads', () => {
    const newer = { keys: ['welcome'], variables: { welcome: ['name'] }, laterMetadata: {} };

    expect(defineMessageContract(newer)).toEqual({
      keys: ['welcome'],
      variables: { welcome: ['name'] },
    });
  });

  it('has no variables unless it is given some', () => {
    expect(defineMessageContract({ keys: ['welcome'] })).toEqual({ keys: ['welcome'] });
  });

  it('keeps variables sorted and frozen, by key', () => {
    const contract = defineMessageContract({
      keys: ['welcome', 'footer.rights'],
      variables: {
        welcome: ['name'],
        'footer.rights': ['year', 'author'],
      },
    });

    expect(contract.variables).toEqual({ 'footer.rights': ['author', 'year'], welcome: ['name'] });
    expect(Object.keys(contract.variables ?? {})).toEqual(['footer.rights', 'welcome']);
    expect(Object.isFrozen(contract.variables)).toBe(true);
    expect(Object.isFrozen(contract.variables?.['footer.rights'])).toBe(true);
  });

  it('rejects variables for a key it does not list', () => {
    expect(() =>
      defineMessageContract({
        keys: ['welcome'],
        variables: { nope: ['name'] } as unknown as never,
      }),
    ).toThrow(/variables are listed for "nope", which is not in `keys`/);
  });

  it('rejects an empty, repeated or non-string variable list', () => {
    expect(() => defineMessageContract({ keys: ['welcome'], variables: { welcome: [] } })).toThrow(
      /must be a non-empty array/,
    );
    expect(() =>
      defineMessageContract({ keys: ['welcome'], variables: { welcome: ['name', 'name'] } }),
    ).toThrow(/variable "name" is listed twice for "welcome"/);
    expect(() =>
      defineMessageContract({ keys: ['welcome'], variables: { welcome: [1] } as unknown as never }),
    ).toThrow(/must be non-empty strings/);
  });

  describe('functions', () => {
    const keys = ['total', 'welcome'];
    const variables = { total: ['label', 'count'], welcome: ['name'] };

    it('has none unless it is given some', () => {
      expect(defineMessageContract({ keys, variables })).not.toHaveProperty('functions');
    });

    it('keeps them sorted and frozen, by key and variable', () => {
      const contract = defineMessageContract({
        keys,
        variables,
        functions: {
          total: { label: ['string'], count: ['number', 'integer'] },
        },
      });

      expect(contract.functions).toEqual({
        total: { count: ['integer', 'number'], label: ['string'] },
      });
      expect(Object.keys(contract.functions?.['total'] ?? {})).toEqual(['count', 'label']);
      expect(Object.isFrozen(contract.functions)).toBe(true);
      expect(Object.isFrozen(contract.functions?.['total'])).toBe(true);
      expect(Object.isFrozen(contract.functions?.['total']?.['count'])).toBe(true);
    });

    it('rejects functions for a key with no variables listed', () => {
      expect(() =>
        defineMessageContract({
          keys,
          variables: { total: ['count'] },
          functions: {
            welcome: { name: ['number'] },
          } as unknown as never,
        }),
      ).toThrow(/functions are listed for "welcome", which has no variables listed/);
      expect(() =>
        defineMessageContract({ keys, functions: { total: { count: ['number'] } } as never }),
      ).toThrow(/functions are listed for "total", which has no variables listed/);
    });

    it('rejects functions for an unknown variable of a key', () => {
      expect(() =>
        defineMessageContract({
          keys,
          variables,
          functions: {
            total: { nope: ['number'] },
          } as unknown as never,
        }),
      ).toThrow(/variable "nope" of "total", which is not one of its variables/);
    });

    it('rejects an empty, malformed, repeated or empty-named entry', () => {
      expect(() => defineMessageContract({ keys, variables, functions: { total: {} } })).toThrow(
        /functions for "total" must be a non-empty object/,
      );
      expect(() =>
        defineMessageContract({
          keys,
          variables,
          functions: { total: ['number'] } as unknown as never,
        }),
      ).toThrow(/functions for "total" must be a non-empty object/);
      expect(() =>
        defineMessageContract({ keys, variables, functions: { total: { count: [] } } }),
      ).toThrow(/"total" variable "count" must be a non-empty array/);
      expect(() =>
        defineMessageContract({
          keys,
          variables,
          functions: { total: { count: ['number', 'number'] } },
        }),
      ).toThrow(/function "number" is listed twice for "total" variable "count"/);
      expect(() =>
        defineMessageContract({ keys, variables, functions: { total: { count: [''] } } }),
      ).toThrow(/must be non-empty strings/);
    });
  });
});
