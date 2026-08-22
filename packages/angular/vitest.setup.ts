import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach } from 'vitest';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

// Vitest has no Angular integration to reset the module for us, and a `TestBed` carried
// between tests refuses to be reconfigured.
afterEach(() => {
  TestBed.resetTestingModule();
});
