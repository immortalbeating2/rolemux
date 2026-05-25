import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { installCommand } from '../../src/commands/install.js';

describe('install command', () => {
  test('dry-run lists install targets without writing files', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux install home '));
    const projectDir = await mkdtemp(join(tmpdir(), 'rolemux install project '));

    const result = await installCommand({
      homeDir,
      projectDir,
      dryRun: true,
      withAgents: false
    });

    expect(result.status).toBe('dry-run');
    expect(result.targets.some(target => target.includes('.codex'))).toBe(true);
    expect(result.targets.some(target => target.endsWith('AGENTS.md'))).toBe(false);
  });

  test('installs config, roles, and Skill files into an isolated home', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux install real home '));
    const projectDir = await mkdtemp(join(tmpdir(), 'rolemux install real project '));

    const result = await installCommand({
      homeDir,
      projectDir,
      dryRun: false,
      withAgents: false
    });

    expect(result.status).toBe('installed');
    expect(result.written).toEqual(expect.arrayContaining([
      join(homeDir, '.rolemux', 'config.toml'),
      join(homeDir, '.rolemux', 'roles', 'builder.md'),
      join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'),
      join(homeDir, '.claude', 'skills', 'rolemux-workflow', 'SKILL.md')
    ]));
    expect(result.written.some(path => path.endsWith('AGENTS.md'))).toBe(false);
  });
});
