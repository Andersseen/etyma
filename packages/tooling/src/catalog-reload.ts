/**
 * The slice of Vite's `ModuleNode` this plugin reads - structural, so this package never
 * imports `vite`.
 */
export interface CatalogReloadModule {
  readonly file?: string | null;
  readonly importers: ReadonlySet<CatalogReloadModule>;
}

export interface CatalogReloadServer {
  readonly moduleGraph: {
    invalidateModule(module: CatalogReloadModule): void;
  };
  readonly watcher: {
    emit(event: 'change', file: string): unknown;
  };
  readonly ws: { send(payload: { type: 'full-reload' }): void };
}

export interface EtymaCatalogReloadOptions {
  /**
   * Which files are message catalogs. Defaults to any `.json` file inside an `i18n`
   * directory, which is where `defineI18n` projects keep them.
   */
  readonly include?: RegExp | ((file: string) => boolean);
}

/** The plugin `etymaCatalogReload` returns, declared structurally like the others here. */
export interface EtymaCatalogReloadPlugin {
  readonly name: string;
  readonly apply: 'serve';
  handleHotUpdate(context: {
    readonly file: string;
    readonly modules: readonly CatalogReloadModule[];
    readonly server: CatalogReloadServer;
  }): [] | undefined;
}

const DEFAULT_CATALOG = /[\\/]i18n[\\/][^\\/]+\.json$/;
const SOURCE_FILE = /\.[cm]?tsx?$/;

/**
 * Keeps `vite dev` honest about a catalog's types after the catalog changes.
 *
 * Typed keys come from the type of the source catalog's JSON import. When a key is added, the
 * language service behind a running dev server (Analog compiles with the Angular compiler)
 * still holds the old shape of that import, so `t('home.newKey')` keeps failing with "not
 * assignable" until the server restarts. This plugin treats a catalog change as a change to
 * every module that depends on it: it invalidates them in Vite's module graph, tells the
 * file watcher that each dependent TypeScript file changed - which is what makes the
 * compiler re-read the import - and reloads the page.
 *
 * Development only (`apply: 'serve'`); a build always starts from disk.
 */
export function etymaCatalogReload(
  options: EtymaCatalogReloadOptions = {},
): EtymaCatalogReloadPlugin {
  const include = options.include ?? DEFAULT_CATALOG;
  const isCatalog = typeof include === 'function' ? include : (file: string) => include.test(file);

  return {
    name: 'etyma-catalog-reload',
    apply: 'serve',
    handleHotUpdate({ file, modules, server }) {
      if (!isCatalog(file)) {
        return undefined;
      }

      const dependents = collectDependents(modules);

      for (const module of dependents) {
        server.moduleGraph.invalidateModule(module);

        if (module.file != null && SOURCE_FILE.test(module.file)) {
          server.watcher.emit('change', module.file);
        }
      }

      server.ws.send({ type: 'full-reload' });

      // Handled: Vite's own per-module update would race the reload with a stale graph.
      return [];
    },
  };
}

function collectDependents(roots: readonly CatalogReloadModule[]): Set<CatalogReloadModule> {
  const seen = new Set<CatalogReloadModule>();
  const pending = [...roots];

  for (let module = pending.pop(); module !== undefined; module = pending.pop()) {
    if (seen.has(module)) {
      continue;
    }

    seen.add(module);
    pending.push(...module.importers);
  }

  return seen;
}
