import { describe, expect, it } from 'vitest';

import { catalogUrl, I18N_PROJECT } from './project';

describe('Glossa i18n project', () => {
  it('defines the published locales and source locale', () => {
    expect(I18N_PROJECT.locales).toEqual(['en', 'es', 'uk']);
    expect(I18N_PROJECT.sourceLocale).toBe('en');
  });

  it('resolves every locale to the project delivery endpoint', () => {
    expect(I18N_PROJECT.locales.map(catalogUrl)).toEqual([
      'https://glossa.andersseen.dev/i18n/etyma-www/en.json',
      'https://glossa.andersseen.dev/i18n/etyma-www/es.json',
      'https://glossa.andersseen.dev/i18n/etyma-www/uk.json',
    ]);
  });
});
