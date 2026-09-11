/**
 * Etyma's portable engine.
 *
 * Nothing here touches Angular, a DOM, a browser global or a Node built-in: the only
 * platform APIs it uses are `Intl` and MessageFormat 2. That constraint is what lets the
 * same catalog logic run in a browser, in a Node server, in a Cloudflare Worker and in
 * whatever framework adapter comes next.
 *
 * @packageDocumentation
 */

export { EtymaError } from './errors.js';

export {
  assertWellFormedLocale,
  isWellFormedLocale,
  localeDirection,
  type Locale,
  type TextDirection,
} from './locale.js';

export {
  defineMessageContract,
  defineMessages,
  flattenMessages,
  walkMessageSource,
  type MessageCatalog,
  type MessageContract,
  type MessageKey,
  type MessageParams,
  type MessageSource,
  type MessageSourceLeaf,
  type MessageSourceProblem,
} from './messages.js';

export { createLocaleRouter, type LocaleRouter, type LocaleRouterOptions } from './routing.js';

export {
  createMessageFormatter,
  type MessageFormatIssue,
  type MessageFormatter,
  type MessageFormatterOptions,
  type MessageFunctions,
  type MessagePart,
} from './format.js';

export {
  createHttpMessageLoader,
  loadMessageCatalog,
  toMessageSource,
  type HttpLoaderInit,
  type MessageLoader,
  type MessageLoaderResult,
  type MessageModule,
} from './loader.js';

export {
  createTranslator,
  returnMessageKey,
  type MissingMessageHandler,
  type MissingMessageInfo,
  type Translator,
  type TranslatorInput,
} from './translator.js';

export { defineI18n, type I18nDefinition, type I18nOptions } from './define-i18n.js';

export { defineRemoteI18n, type RemoteI18nOptions } from './remote-i18n.js';

export {
  createCatalogRegistry,
  type CatalogRegistry,
  type CatalogRegistryOptions,
  type CatalogSnapshot,
  type ContractDriftInfo,
} from './catalog-registry.js';
