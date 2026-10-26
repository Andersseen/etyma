import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from '@voltui/components';
import { LmnArrowLeftIcon } from 'lumen-icons/arrow-left';
import { LmnCloudArrowUpIcon } from 'lumen-icons/cloud-arrow-up';
import { LmnGlobeAltIcon } from 'lumen-icons/globe-alt';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';

import { injectAppI18n } from '../../i18n/inject';
import { injectPageSeo } from '../../seo/page-seo';

@Component({
  selector: 'app-themes-page',
  imports: [
    RouterLink,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    LmnArrowLeftIcon,
    LmnCloudArrowUpIcon,
    LmnGlobeAltIcon,
    LmnServerStackIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero compact" data-motion="rise">
      <p class="eyebrow">{{ t('themes.eyebrow') }}</p>
      <h1 data-testid="title">{{ t('themes.title') }}</h1>
      <p data-testid="lede">{{ t('themes.lede') }}</p>
    </section>

    <section class="section feature-grid">
      <volt-card>
        <volt-card-header>
          <lmn-server-stack
            [size]="24"
            background="soft"
            backgroundTone="primary"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('themes.routingTitle')
          }}</volt-card-title>
          <volt-card-description>{{ t('themes.routingBody') }}</volt-card-description>
        </volt-card-header>
      </volt-card>
      <volt-card>
        <volt-card-header>
          <lmn-globe-alt
            [size]="24"
            background="soft"
            backgroundTone="success"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('themes.seoTitle')
          }}</volt-card-title>
          <volt-card-description>{{ t('themes.seoBody') }}</volt-card-description>
        </volt-card-header>
      </volt-card>
      <volt-card>
        <volt-card-header>
          <lmn-cloud-arrow-up
            [size]="24"
            background="soft"
            backgroundTone="warning"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('themes.cloudflareTitle')
          }}</volt-card-title>
        </volt-card-header>
        <volt-card-content class="grid gap-2 text-sm text-muted-foreground">
          <p data-testid="token-count">{{ t('themes.tokenCount', { count: 24 }) }}</p>
        </volt-card-content>
      </volt-card>
    </section>

    <a class="text-link" [routerLink]="i18n.path('/docs')" data-testid="to-docs">
      <lmn-arrow-left [size]="16" />{{ t('themes.back') }}
    </a>
  `,
})
export default class ThemesPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;

  constructor() {
    injectPageSeo(() => ({
      title: `${this.t('themes.title')} | ${this.t('seo.siteName')}`,
      description: this.t('themes.lede'),
    }));
  }
}
