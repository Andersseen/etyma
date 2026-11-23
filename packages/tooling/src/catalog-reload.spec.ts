import { describe, expect, it, vi } from 'vitest';

import { etymaCatalogReload, type CatalogReloadModule } from './catalog-reload.js';

function module(file: string, importers: CatalogReloadModule[] = []): CatalogReloadModule {
  return { file, importers: new Set(importers) };
}

function server() {
  return {
    moduleGraph: { invalidateModule: vi.fn() },
    watcher: { emit: vi.fn() },
    ws: { send: vi.fn() },
  };
}

describe('etymaCatalogReload', () => {
  it('invalidates every module that depends on a changed catalog, transitively', () => {
    const page = module('/app/home.ts');
    const config = module('/app/i18n/index.ts', [page]);
    const catalog = module('/app/i18n/es.json', [config]);
    const s = server();

    const result = etymaCatalogReload().handleHotUpdate({
      file: '/app/i18n/es.json',
      modules: [catalog],
      server: s,
    });

    expect(result).toEqual([]);
    expect(s.moduleGraph.invalidateModule).toHaveBeenCalledTimes(3);
    expect(s.watcher.emit).toHaveBeenCalledWith('change', '/app/i18n/index.ts');
    expect(s.watcher.emit).toHaveBeenCalledWith('change', '/app/home.ts');
    expect(s.watcher.emit).not.toHaveBeenCalledWith('change', '/app/i18n/es.json');
    expect(s.ws.send).toHaveBeenCalledWith({ type: 'full-reload' });
  });

  it('terminates on an import cycle', () => {
    const a = module('/app/a.ts');
    const catalog = module('/app/i18n/en.json', [a]);
    (a.importers as Set<CatalogReloadModule>).add(a);
    const s = server();

    etymaCatalogReload().handleHotUpdate({
      file: '/app/i18n/en.json',
      modules: [catalog],
      server: s,
    });

    expect(s.moduleGraph.invalidateModule).toHaveBeenCalledTimes(2);
  });

  it('ignores files that are not catalogs', () => {
    const s = server();

    const result = etymaCatalogReload().handleHotUpdate({
      file: '/app/data/config.json',
      modules: [module('/app/data/config.json')],
      server: s,
    });

    expect(result).toBeUndefined();
    expect(s.moduleGraph.invalidateModule).not.toHaveBeenCalled();
    expect(s.ws.send).not.toHaveBeenCalled();
  });

  it('accepts a custom matcher', () => {
    const s = server();

    const result = etymaCatalogReload({ include: /locales\/.*\.json$/ }).handleHotUpdate({
      file: '/app/locales/es.json',
      modules: [module('/app/locales/es.json')],
      server: s,
    });

    expect(result).toEqual([]);
  });
});
