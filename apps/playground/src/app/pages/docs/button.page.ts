import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { injectAppI18n } from '../../i18n/inject';

/** Fixed so the rendered date is the same in every run, and assertable. */
const RELEASED_ON = new Date(Date.UTC(2026, 0, 15, 12));

@Component({
  selector: 'app-button-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="title">{{ t('button.title') }}</h1>
    <p data-testid="lede">{{ t('button.lede') }}</p>

    <p data-testid="released">{{ t('button.released', { on: releasedOn }) }}</p>
    <p data-testid="status">{{ t('button.status', { state: 'beta' }) }}</p>

    <p>
      <a [routerLink]="i18n.path('/docs')" data-testid="to-docs">{{ t('nav.docs') }}</a>
    </p>
  `,
})
export default class ButtonPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
  protected readonly releasedOn = RELEASED_ON;
}
