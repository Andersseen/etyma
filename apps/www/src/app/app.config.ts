import { provideFileRouter } from '@analogjs/router';
import {
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  type ApplicationConfig,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideEtymaAnalog, withLocalizedRoutes } from '@etyma/analog';
import { provideEtyma } from '@etyma/angular';
import { provideVoltTheme } from '@voltui/components';
import { provideMovement } from 'angular-movement';

import { i18n } from './i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Zone.js is not installed in this application at all. Etyma never asks for it.
    provideZonelessChangeDetection(),
    provideFileRouter(withLocalizedRoutes()),
    provideClientHydration(withEventReplay()),
    provideEtyma(i18n),
    provideEtymaAnalog(),
    provideVoltTheme({ color: 'glacier', style: 'sharp', dark: true }),
    provideMovement({
      duration: 420,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    }),
  ],
};
