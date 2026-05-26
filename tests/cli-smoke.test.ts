import { describe, expect, test } from 'vitest';
import { createCli } from '../src/cli.js';

describe('CLI smoke', () => {
  test('registers the RoleMux command name', () => {
    const cli = createCli();

    expect(cli.name()).toBe('rolemux');
    expect(cli.description()).toContain('multi-CLI');
  });

  test('registers install and uninstall lifecycle commands', () => {
    const cli = createCli();
    const commandNames = cli.commands.map(command => command.name());

    expect(commandNames).toEqual(expect.arrayContaining(['install', 'uninstall']));
  });
});
