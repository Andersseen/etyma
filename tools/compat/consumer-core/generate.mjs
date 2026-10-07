/**
 * Writes a large, realistic application catalog - and the consumer that types against it -
 * into this directory, deterministically. The same input always produces the same bytes.
 *
 * The shape is chosen to stress the type layer the way a real application does, not to set
 * a record: nested namespaces, arrays of messages, messages with zero, one and several
 * params, and numeric, currency, plural and date/time annotations, in roughly the
 * proportions a product UI has. The contract is rendered by the packed `@etyma/tooling`,
 * exactly as `etyma contract` would, so the fixture also proves the generator's output
 * compiles against the packed `@etyma/core` at this size.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractContractKeys, extractContractParams, renderContractModule } from '@etyma/tooling';

const here = dirname(fileURLToPath(import.meta.url));

const SECTIONS = 20;
const GROUPS = 5;
const MESSAGES = 8;
const ARRAYS = 12;

/** One message per kind, cycled through by index. Each kind's params, by name. */
const kinds = [
  [i => `Plain label ${i}`, []],
  [i => `Hello {$name}, welcome to item ${i}.`, ['name']],
  [i => `{$first} and {$second} edited {$title} (${i}).`, ['first', 'second', 'title']],
  [i => `{$count :number} results for ${i}`, ['count']],
  [
    i =>
      `.input {$count :number}\n.match $count\none {{One file in ${i}}}\n* {{{$count} files in ${i}}}`,
    ['count'],
  ],
  [i => `Updated {$when :date style=long} (${i})`, ['when']],
  [i => `Total {$amount :currency currency=EUR} for ${i}`, ['amount']],
  [
    i => `{$name} has {$count :integer} items since {$since :datetime} (${i})`,
    ['name', 'count', 'since'],
  ],
];

/** A value of the right type for each param name, for the generated `t()` calls. */
const sampleValue = {
  name: "'Ada'",
  first: "'Ada'",
  second: "'Grace'",
  title: "'Docs'",
  count: '3',
  when: 'new Date(0)',
  amount: '9.99',
  since: 'new Date(0)',
};

const catalog = {};
const samples = [];
let index = 0;

for (let s = 0; s < SECTIONS; s++) {
  const section = (catalog[`section${s}`] = {});

  for (let g = 0; g < GROUPS; g++) {
    const group = (section[`group${g}`] = {});

    for (let m = 0; m < MESSAGES; m++) {
      const [message, params] = kinds[index % kinds.length];
      group[`message${m}`] = message(index);

      // Every eleventh message is called from the consumer, which reaches every kind.
      if (index % 11 === 0) {
        samples.push([`section${s}.group${g}.message${m}`, params, index % kinds.length]);
      }
      index++;
    }
  }

  // An array of messages in most sections: plain steps, with a param in the last one.
  if (s < ARRAYS) {
    section.steps = [
      `Step one of section ${s}`,
      `Step two of section ${s}`,
      `Finish with {$name} in section ${s}`,
    ];
    samples.push([`section${s}.steps.2`, ['name'], -1]);
  }
}

const call = (t, [key, params]) =>
  params.length === 0
    ? `${t}.translate('${key}');`
    : `${t}.translate('${key}', { ${params.map(p => `${p}: ${sampleValue[p]}`).join(', ')} });`;

writeFileSync(join(here, 'en.json'), `${JSON.stringify(catalog, null, 2)}\n`);

writeFileSync(
  join(here, 'catalog.ts'),
  [
    "import { defineMessages } from '@etyma/core';",
    '',
    `export const catalog = defineMessages(${JSON.stringify(catalog, null, 2)});`,
    '',
  ].join('\n'),
);

writeFileSync(
  join(here, 'contract.generated.ts'),
  renderContractModule({
    keys: extractContractKeys(catalog),
    ...extractContractParams(catalog, { strict: true }),
  }),
);

const ofKind = kind => samples.find(sample => sample[2] === kind);
const [plain, oneParam, numeric, date] = [0, 1, 3, 5].map(ofKind);

writeFileSync(
  join(here, 'app.ts'),
  `import {
  defineI18n,
  defineRemoteI18n,
  type I18nDefinition,
  type I18nKeysRequiringParams,
  type I18nKeysWithoutRequiredParams,
  type I18nMessageArgs,
  type I18nMessageKey,
  type MessageKey,
  type MessageParamsMap,
  type MessageParamsOf,
  type Translator,
} from '@etyma/core';

import { catalog } from './catalog.js';
import contract from './contract.generated.js';
import en from './en.json' with { type: 'json' };

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

const loadEs = () => import('./en.json', { with: { type: 'json' } });

/** A literal \`defineMessages()\` source: keys and params inferred from the catalog itself. */
export const literal = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source: catalog,
  loaders: { es: loadEs },
});

/** A JSON source, typed by the generated contract. */
export const json = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source: en,
  contract,
  loaders: { es: loadEs },
});

/**
 * A literal source with a contract too. Redundant for params, but supported - and the case
 * that used to hit TS2589 ("excessively deep") at this size, when merging the two was
 * quadratic in the number of keys.
 */
export const literalWithContract = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source: catalog,
  contract,
  loaders: { es: loadEs },
});

/** A remote source, typed by the generated contract alone. */
export const remote = defineRemoteI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  contract,
  loaders: { en: loadEs, es: loadEs },
});

export type Key = MessageKey<typeof catalog>;
export type Params = MessageParamsOf<typeof catalog>;

// The generated contract types exactly what the literal catalog infers - at this size too.
export type ContractMatchesLiteral = Assert<
  Equal<Params, NonNullable<typeof contract.messageParams>>
>;
export type KeysMatch = Assert<Equal<Key, (typeof contract.keys)[number]>>;

declare function translatorFor<K extends string, P extends MessageParamsMap>(
  definition: I18nDefinition<K, P>,
): Translator<K, P>;

export const tLiteral = translatorFor(literal);
export const tJson = translatorFor(json);
export const tRemote = translatorFor(remote);
export const tBoth = translatorFor(literalWithContract);

// Definition-first key vocabulary, derived from each definition at this size.
export type LiteralKey = I18nMessageKey<typeof literal>;
export type LiteralRequiring = I18nKeysRequiringParams<typeof literal>;
export type LiteralWithout = I18nKeysWithoutRequiredParams<typeof literal>;
export type JsonRequiring = I18nKeysRequiringParams<typeof json>;
export type JsonWithout = I18nKeysWithoutRequiredParams<typeof json>;
export type RemoteWithout = I18nKeysWithoutRequiredParams<typeof remote>;
export type BothRequiring = I18nKeysRequiringParams<typeof literalWithContract>;
export type NumericArgs = I18nMessageArgs<typeof literal, '${numeric[0]}'>;
export type JsonNumericArgs = I18nMessageArgs<typeof json, '${numeric[0]}'>;

export type KeySplitIsExhaustive = Assert<
  Equal<LiteralRequiring | LiteralWithout, LiteralKey>
>;
export type JsonMatchesLiteral = Assert<Equal<JsonRequiring, LiteralRequiring>>;
export type ContractAgreesBothWays = Assert<Equal<BothRequiring, LiteralRequiring>>;

export const dynamicLinks: readonly { readonly key: LiteralWithout }[] = [
  { key: '${plain[0]}' },
];
export const dynamicJsonLinks: readonly { readonly key: JsonWithout }[] = [{ key: '${plain[0]}' }];
export const dynamicRemoteLinks: readonly { readonly key: RemoteWithout }[] = [
  { key: '${plain[0]}' },
];

for (const link of dynamicLinks) tLiteral.translate(link.key);
for (const link of dynamicJsonLinks) tJson.translate(link.key);
for (const link of dynamicRemoteLinks) tRemote.translate(link.key);

export const numericArgs: NumericArgs = [{ count: 3 }];
export const jsonNumericArgs: JsonNumericArgs = [{ count: 3 }];
tLiteral.translate('${numeric[0]}', ...numericArgs);
tJson.translate('${numeric[0]}', ...jsonNumericArgs);

// @ts-expect-error - \`${oneParam[0]}\` needs params, so it is not in the without-params domain.
export const notWithout: LiteralWithout = '${oneParam[0]}';
// @ts-expect-error - \`${plain[0]}\` is not known to need params.
export const notRequiring: LiteralRequiring = '${plain[0]}';

${samples.flatMap(sample => ['tLiteral', 'tJson', 'tRemote', 'tBoth'].map(t => call(t, sample))).join('\n')}

// A key typed as a union needs every member's params.
declare const either: '${oneParam[0]}' | '${date[0]}';
tJson.translate(either, { name: 'Ada', when: new Date(0) });
// @ts-expect-error - \`${date[0]}\` needs \`when\` too.
tJson.translate(either, { name: 'Ada' });

// @ts-expect-error - not a key.
tRemote.translate('section0.group0.nope');
// @ts-expect-error - \`${oneParam[0]}\` needs \`name\`, from the literal and the contract alike.
tBoth.translate('${oneParam[0]}');
// @ts-expect-error - \`${oneParam[0]}\` needs \`name\`.
tJson.translate('${oneParam[0]}');
// @ts-expect-error - \`${numeric[0]}\` is :number, and a Date is not a number.
tLiteral.translate('${numeric[0]}', { count: new Date(0) });
// @ts-expect-error - \`${plain[0]}\` has no params to require, but they stay untyped values.
tRemote.translate('${plain[0]}', { x: Symbol('no') });
`,
);

console.log(
  `generated ${extractContractKeys(catalog).length} keys, ${samples.length * 4} typed calls`,
);
