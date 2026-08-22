import { EtymaError } from './errors.js';

/**
 * A BCP 47 language tag, such as `en`, `es`, `pt-BR`.
 *
 * Deliberately a plain string rather than a branded type: the value comes from a URL, a
 * config file or an HTTP header, and a brand would only add casts at every one of those
 * boundaries without catching anything a runtime check does not already catch.
 */
export type Locale = string;

/** Which way text runs in a locale. Drives `<html dir>` and MF2 bidi isolation. */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Whether `Intl` recognises `value` as a well-formed language tag.
 *
 * Well-formed is not the same as supported — `Intl` will happily canonicalise `xx-YY`.
 * This catches typos such as `en_US` or `english`, which is what it is for.
 */
export function isWellFormedLocale(value: string): boolean {
  try {
    Intl.getCanonicalLocales(value);
    return true;
  } catch {
    return false;
  }
}

/** Throws unless `value` is a well-formed BCP 47 tag. */
export function assertWellFormedLocale(value: string, context: string): void {
  if (!isWellFormedLocale(value)) {
    throw new EtymaError(`${context}: "${value}" is not a well-formed BCP 47 language tag.`);
  }
}

/**
 * Scripts written right to left, by ISO 15924 code.
 *
 * A table only exists because the standard way to ask — `Intl.Locale.prototype.getTextInfo()`
 * — is a stage 3 proposal that not every runtime we target has shipped yet. Where the
 * runtime does answer, that answer wins; this is the fallback, and it is small on purpose.
 */
const RIGHT_TO_LEFT_SCRIPTS: ReadonlySet<string> = new Set([
  'Adlm',
  'Arab',
  'Aran',
  'Hebr',
  'Mand',
  'Nkoo',
  'Rohg',
  'Samr',
  'Syrc',
  'Thaa',
  'Yezi',
]);

interface TextInfoCarrier {
  getTextInfo?: () => { direction?: string };
  textInfo?: { direction?: string };
}

/**
 * The text direction of a locale.
 *
 * Asks the runtime first (`getTextInfo()`, then the older `textInfo` accessor), and only
 * falls back to the script of the maximized locale when neither exists.
 */
export function localeDirection(locale: Locale): TextDirection {
  let resolved: Intl.Locale;

  try {
    resolved = new Intl.Locale(locale);
  } catch {
    return 'ltr';
  }

  const carrier = resolved as unknown as TextInfoCarrier;
  const reported = carrier.getTextInfo?.().direction ?? carrier.textInfo?.direction;

  if (reported === 'rtl' || reported === 'ltr') {
    return reported;
  }

  const script = resolved.maximize().script;

  return script !== undefined && RIGHT_TO_LEFT_SCRIPTS.has(script) ? 'rtl' : 'ltr';
}
