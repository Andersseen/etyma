import { ChangeDetectionStrategy, Component } from '@angular/core';

import { injectAppI18n } from '../i18n/inject';

@Component({
  selector: 'app-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 data-testid="title">{{ t('home.title') }}</h1>
    <p data-testid="lede">{{ t('home.lede') }}</p>

    <p data-testid="greeting">{{ t('home.greeting', { name: 'Etyma' }) }}</p>

    <h2>{{ t('home.localesHeading') }}</h2>
    <dl>
      <dt>{{ t('seo.siteName') }}</dt>
      <dd data-testid="tagline">{{ t('seo.tagline') }}</dd>
    </dl>
  `,
})
export default class HomePage {
  protected readonly t = injectAppI18n().t;
}
