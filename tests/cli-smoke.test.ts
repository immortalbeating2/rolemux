import { describe, expect, test } from 'vitest';
import { createCli } from '../src/cli.js';

describe('CLI smoke', () => {
  test('registers the RoleMux command name', () => {
    const cli = createCli();

    expect(cli.name()).toBe('rolemux');
    expect(cli.description()).toContain('multi-CLI');
  });
});
