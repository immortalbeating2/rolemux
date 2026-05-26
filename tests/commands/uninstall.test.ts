import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, test } from 'vitest';
import { uninstallCommand } from '../../src/commands/uninstall.js';

describe('uninstall command', () => {
  test('dry-run lists uninstall targets without deleting files', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall dry home '));
    const configPath = join(homeDir, '.rolemux', 'config.toml');
    await mkdir(join(homeDir, '.rolemux'), { recursive: true });
    await writeFile(configPath, 'default_provider = "codex"\n', 'utf8');

    const result = await uninstallCommand({ homeDir, dryRun: true });

    expect(result.status).toBe('dry-run');
    expect(result.targets).toEqual(expect.arrayContaining([
      configPath,
      join(homeDir, '.rolemux', 'roles'),
      join(homeDir, '.codex', 'skills', 'rolemux-workflow'),
      join(homeDir, '.claude', 'skills', 'rolemux-workflow')
    ]));
    expect(result.removed).toHaveLength(0);
    expect(existsSync(configPath)).toBe(true);
  });

  test('removes RoleMux config, roles, and Skill directories from an isolated home', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall real home '));
    const configPath = join(homeDir, '.rolemux', 'config.toml');
    const rolesDir = join(homeDir, '.rolemux', 'roles');
    const codexSkillDir = join(homeDir, '.codex', 'skills', 'rolemux-workflow');
    const claudeSkillDir = join(homeDir, '.claude', 'skills', 'rolemux-workflow');
    const customFile = join(homeDir, '.rolemux', 'custom.md');

    await mkdir(rolesDir, { recursive: true });
    await mkdir(codexSkillDir, { recursive: true });
    await mkdir(claudeSkillDir, { recursive: true });
    await writeFile(configPath, 'default_provider = "codex"\n', 'utf8');
    await writeFile(join(rolesDir, 'builder.md'), 'builder\n', 'utf8');
    await writeFile(join(codexSkillDir, 'SKILL.md'), 'codex skill\n', 'utf8');
    await writeFile(join(claudeSkillDir, 'SKILL.md'), 'claude skill\n', 'utf8');
    await writeFile(customFile, 'user custom file\n', 'utf8');

    const result = await uninstallCommand({ homeDir, dryRun: false });

    expect(result.status).toBe('uninstalled');
    expect(result.removed).toEqual(expect.arrayContaining([configPath, rolesDir, codexSkillDir, claudeSkillDir]));
    expect(existsSync(configPath)).toBe(false);
    expect(existsSync(rolesDir)).toBe(false);
    expect(existsSync(codexSkillDir)).toBe(false);
    expect(existsSync(claudeSkillDir)).toBe(false);
    expect(existsSync(customFile)).toBe(true);
  });

  test('keep-config preserves the global RoleMux config file', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall keep config home '));
    const configPath = join(homeDir, '.rolemux', 'config.toml');
    const rolesDir = join(homeDir, '.rolemux', 'roles');
    await mkdir(rolesDir, { recursive: true });
    await writeFile(configPath, 'default_provider = "codex"\n', 'utf8');

    const result = await uninstallCommand({ homeDir, dryRun: false, keepConfig: true });

    expect(result.targets).not.toContain(configPath);
    expect(existsSync(configPath)).toBe(true);
    expect(existsSync(rolesDir)).toBe(false);
  });
});
