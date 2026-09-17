import { describe, expect, it } from 'vitest';

import packageJson from '../package.json' with { type: 'json' };
import { readOwnVersion } from './version.js';

describe('readOwnVersion', () => {
  it("reads @etyma/cli's own version from its package.json, not a hardcoded string", () => {
    expect(readOwnVersion()).toBe(packageJson.version);
  });
});
