import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { injectAppI18n } from '../../i18n/inject';

@Component({
  selector: 'app-themes-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="title">{{ t('themes.title') }}</h1>
    <p data-testid="lede">{{ t('themes.lede') }}</p>

    <p data-testid="token-count">{{ t('themes.tokenCount', { count: 24 }) }}</p>

    <p>
      <a [routerLink]="i18n.path('/docs')" data-testid="to-docs">{{ t('nav.docs') }}</a>
    </p>
  `,
})
export default class ThemesPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
}
