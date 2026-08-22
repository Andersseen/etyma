import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { injectAppI18n } from '../../i18n/inject';

@Component({
  selector: 'app-docs-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="title">{{ t('docs.title') }}</h1>
    <p data-testid="lede">{{ t('docs.lede') }}</p>

    <p data-testid="plural-one">{{ t('docs.componentCount', { count: 1 }) }}</p>
    <p data-testid="plural-few">{{ t('docs.componentCount', { count: 3 }) }}</p>
    <p data-testid="plural-many">{{ t('docs.componentCount', { count: 12 }) }}</p>

    <!-- Translated in neither Spanish nor Ukrainian, so both fall back to English. -->
    <p data-testid="fallback">{{ t('docs.sourceOnly') }}</p>

    <p>
      <a [routerLink]="i18n.path('/docs/button')" data-testid="to-button">{{ t('nav.button') }}</a>
    </p>
  `,
})
export default class DocsPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
}
