import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LmnArrowLeftIcon } from 'lumen-icons/arrow-left';
import { LmnCloudArrowUpIcon } from 'lumen-icons/cloud-arrow-up';
import { LmnGlobeAltIcon } from 'lumen-icons/globe-alt';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';

import { injectAppI18n } from '../../i18n/inject';

@Component({
  selector: 'app-themes-page',
  imports: [RouterLink, LmnArrowLeftIcon, LmnCloudArrowUpIcon, LmnGlobeAltIcon, LmnServerStackIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero compact" data-motion="rise">
      <p class="eyebrow">{{ t('themes.eyebrow') }}</p>
      <h1 data-testid="title">{{ t('themes.title') }}</h1>
      <p data-testid="lede">{{ t('themes.lede') }}</p>
    </section>

    <section class="section feature-grid">
      <article class="feature-card">
        <lmn-server-stack [size]="24" background="soft" backgroundTone="primary" />
        <h2>{{ t('themes.routingTitle') }}</h2>
        <p>{{ t('themes.routingBody') }}</p>
      </article>
      <article class="feature-card">
        <lmn-globe-alt [size]="24" background="soft" backgroundTone="success" />
        <h2>{{ t('themes.seoTitle') }}</h2>
        <p>{{ t('themes.seoBody') }}</p>
      </article>
      <article class="feature-card">
        <lmn-cloud-arrow-up [size]="24" background="soft" backgroundTone="warning" />
        <h2>{{ t('themes.cloudflareTitle') }}</h2>
        <p data-testid="token-count">{{ t('themes.tokenCount', { count: 24 }) }}</p>
      </article>
    </section>

    <a class="text-link" [routerLink]="i18n.path('/docs')" data-testid="to-docs">
      <lmn-arrow-left [size]="16" />{{ t('themes.back') }}
    </a>
  `,
})
export default class ThemesPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
}
