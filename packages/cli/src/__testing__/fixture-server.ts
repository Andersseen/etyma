import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

/**
 * A throwaway HTTP server on a random loopback port, built from Node built-ins only.
 *
 * Remote-mode tests must never touch the public internet - not Glossa, not GitHub, not a
 * CDN - so every "remote" catalog in this package's tests, including the packed-binary
 * smoke test, is served from here. Excluded from the published build (`tsconfig.lib.json`).
 */
export type RouteHandler = (request: IncomingMessage, response: ServerResponse) => void;

export interface FixtureServer {
  /** `http://127.0.0.1:<port>` - no trailing slash. */
  readonly origin: string;
  /** Every request path received, in arrival order. */
  readonly requests: readonly string[];
  close(): Promise<void>;
}

export async function startFixtureServer(
  routes: Readonly<Record<string, RouteHandler>>,
): Promise<FixtureServer> {
  const requests: string[] = [];

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://fixture.invalid').pathname;
    requests.push(path);

    const handler = routes[path];

    if (handler === undefined) {
      status(404, '<html><body>Not found</body></html>', 'text/html')(request, response);
      return;
    }

    handler(request, response);
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>(resolve => {
        // A hung or stalled route holds its socket open forever; drop them so `close` returns.
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** An origin nothing is listening on: connecting to it is refused. */
export async function unusedOrigin(): Promise<string> {
  const server = await startFixtureServer({});
  const { origin } = server;

  await server.close();

  return origin;
}

export function json(value: unknown): RouteHandler {
  return status(200, JSON.stringify(value), 'application/json');
}

export function status(code: number, body: string, contentType = 'text/plain'): RouteHandler {
  return (_request, response) => {
    response.writeHead(code, { 'content-type': contentType });
    response.end(body);
  };
}

/** Accepts the request and never answers - a host that is up but not responding. */
export function hang(): RouteHandler {
  return () => undefined;
}

/** Sends a `200` and the start of a body, then stalls - a connection that dies mid-response. */
export function stallBody(): RouteHandler {
  return (_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write('{"nav":');
  };
}

/** Answers after `delayMs`, so a fast route can finish before a slow one that was asked first. */
export function delayed(delayMs: number, handler: RouteHandler): RouteHandler {
  return (request, response) => {
    setTimeout(() => {
      handler(request, response);
    }, delayMs);
  };
}

/**
 * A barrier shared by several routes: each wrapped route holds its request until `count`
 * requests, across all of them, are in flight, then every one is released.
 *
 * Only completes if the client really does fetch concurrently: a client that finishes one
 * request before starting the next would wait here forever.
 */
export function rendezvous(count: number): (handler: RouteHandler) => RouteHandler {
  const waiting: (() => void)[] = [];

  return handler => (request, response) => {
    waiting.push(() => {
      handler(request, response);
    });

    if (waiting.length === count) {
      for (const release of waiting.splice(0)) {
        release();
      }
    }
  };
}

/**
 * Routes `<prefix>/<locale>.json` to each `*.json` file in a fixture directory, byte for
 * byte - the same catalogs the local-mode tests read from disk, served over HTTP.
 */
export function serveDirectory(directory: string, prefix = '/i18n'): Record<string, RouteHandler> {
  const routes: Record<string, RouteHandler> = {};

  for (const file of readdirSync(directory).filter(name => name.endsWith('.json'))) {
    const body = readFileSync(join(directory, file), 'utf8');
    routes[`${prefix}/${file}`] = status(200, body, 'application/json');
  }

  return routes;
}
