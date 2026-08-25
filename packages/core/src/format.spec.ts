import { describe, expect, it, vi } from 'vitest';

import { createMessageFormatter } from './format.js';

const PLURAL = [
  '.input {$count :number}',
  '.match $count',
  'one {{{$count} component}}',
  '*   {{{$count} components}}',
].join('\n');

const UK_PLURAL = [
  '.input {$count :number}',
  '.match $count',
  'one  {{{$count} компонент}}',
  'few  {{{$count} компоненти}}',
  'many {{{$count} компонентів}}',
  '*    {{{$count} компонента}}',
].join('\n');

describe('createMessageFormatter', () => {
  it('interpolates a MessageFormat 2 placeholder', () => {
    const formatter = createMessageFormatter();

    expect(formatter.format('en', 'welcome', 'Hello, {$name}!', { name: 'World' })).toBe(
      'Hello, World!',
    );
  });

  it('leaves text alone when there is nothing to substitute', () => {
    const formatter = createMessageFormatter();

    expect(formatter.format('en', 'nav.docs', 'Docs')).toBe('Docs');
  });

  it('selects the English plural category', () => {
    const formatter = createMessageFormatter();

    expect(formatter.format('en', 'count', PLURAL, { count: 1 })).toBe('1 component');
    expect(formatter.format('en', 'count', PLURAL, { count: 7 })).toBe('7 components');
  });

  it('selects Ukrainian one, few and many, which English does not have', () => {
    const formatter = createMessageFormatter();
    const render = (count: number) => formatter.format('uk', 'count', UK_PLURAL, { count });

    expect(render(1)).toBe('1 компонент');
    expect(render(3)).toBe('3 компоненти');
    expect(render(12)).toBe('12 компонентів');
    expect(render(21)).toBe('21 компонент');
  });

  it('formats numbers in the locale asked for, not the locale of the last call', () => {
    const formatter = createMessageFormatter();

    expect(formatter.format('en', 'n', '{$n :number}', { n: 1234.5 })).toBe('1,234.5');
    expect(formatter.format('es', 'n', '{$n :number}', { n: 1234.5 })).toBe('1234,5');
  });

  it('formats dates through the draft :date function', () => {
    const formatter = createMessageFormatter();
    const on = new Date(Date.UTC(2026, 0, 15, 12));

    expect(formatter.format('en', 'd', 'Released {$on :date style=long}', { on })).toContain(
      '2026',
    );
  });

  it('leaves the draft functions out when they are turned off', () => {
    const formatter = createMessageFormatter({ draftFunctions: false, onIssue: vi.fn() });
    const on = new Date(Date.UTC(2026, 0, 15, 12));

    expect(formatter.format('en', 'd', '{$on :date}', { on })).toBe('{$on}');
  });

  it('emits no bidi isolation characters by default', () => {
    const formatter = createMessageFormatter();
    const result = formatter.format('en', 'welcome', 'Hello, {$name}!', { name: 'World' });

    expect(result).not.toMatch(/[⁦-⁩]/);
  });

  it('isolates placeholders when asked to', () => {
    const formatter = createMessageFormatter({ bidiIsolation: 'default' });
    const result = formatter.format('en', 'welcome', 'Hello, {$name}!', { name: 'World' });

    expect(result).toMatch(/[⁦-⁩]/);
  });

  it('renders an unparseable pattern as its own source and reports it once', () => {
    const onIssue = vi.fn();
    const formatter = createMessageFormatter({ onIssue });

    expect(formatter.format('en', 'broken', 'Hello {$')).toBe('Hello {$');
    expect(formatter.format('en', 'broken', 'Hello {$')).toBe('Hello {$');
    expect(onIssue).toHaveBeenCalledTimes(1);
    expect(onIssue.mock.calls[0]?.[0]).toMatchObject({ key: 'broken', locale: 'en' });
  });

  it('reports a missing parameter instead of throwing', () => {
    const onIssue = vi.fn();
    const formatter = createMessageFormatter({ onIssue });

    expect(formatter.format('en', 'welcome', 'Hello, {$name}!')).toBe('Hello, {$name}!');
    expect(onIssue).toHaveBeenCalledOnce();
  });

  it('ignores unexpected parameters according to MessageFormat semantics', () => {
    const onIssue = vi.fn();
    const formatter = createMessageFormatter({ onIssue });

    expect(formatter.format('en', 'plain', 'Hello', { unused: 'value' })).toBe('Hello');
    expect(onIssue).not.toHaveBeenCalled();
  });

  it('formats non-Latin text without custom escaping', () => {
    const formatter = createMessageFormatter();

    expect(formatter.format('uk', 'welcome', 'Привіт, {$name}!', { name: 'Світ' })).toBe(
      'Привіт, Світ!',
    );
  });

  it('returns the message as parts, so markup never has to come from a string', () => {
    const formatter = createMessageFormatter();
    const parts = formatter.formatToParts('en', 'welcome', 'Hello, {$name}!', { name: 'World' });

    expect(parts).toEqual([
      { type: 'text', value: 'Hello, ' },
      { type: 'string', locale: 'en', value: 'World' },
      { type: 'text', value: '!' },
    ]);
  });
});
