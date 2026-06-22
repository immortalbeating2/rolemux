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

  test('explicit codex target only removes Codex non-plugin Skill', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall codex home '));
    const configPath = join(homeDir, '.rolemux', 'config.toml');
    const codexSkillDir = join(homeDir, '.codex', 'skills', 'rolemux-workflow');
    const claudeSkillDir = join(homeDir, '.claude', 'skills', 'rolemux-workflow');
    await mkdir(codexSkillDir, { recursive: true });
    await mkdir(claudeSkillDir, { recursive: true });
    await mkdir(join(homeDir, '.rolemux'), { recursive: true });
    await writeFile(configPath, 'default_provider = "codex"\n', 'utf8');

    const result = await uninstallCommand({ homeDir, dryRun: false, codex: true });

    expect(result.targets).toEqual([codexSkillDir]);
    expect(existsSync(codexSkillDir)).toBe(false);
    expect(existsSync(claudeSkillDir)).toBe(true);
    expect(existsSync(configPath)).toBe(true);
  });

  test('explicit claude target only removes Claude non-plugin Skill', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall claude home '));
    const codexSkillDir = join(homeDir, '.codex', 'skills', 'rolemux-workflow');
    const claudeSkillDir = join(homeDir, '.claude', 'skills', 'rolemux-workflow');
    await mkdir(codexSkillDir, { recursive: true });
    await mkdir(claudeSkillDir, { recursive: true });

    const result = await uninstallCommand({ homeDir, dryRun: false, claude: true });

    expect(result.targets).toEqual([claudeSkillDir]);
    expect(existsSync(codexSkillDir)).toBe(true);
    expect(existsSync(claudeSkillDir)).toBe(false);
  });

  test('explicit codex-plugin target removes plugin source and cache only', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux uninstall plugin home '));
    const pluginRoot = join(homeDir, 'plugins', 'rolemux');
    const pluginCacheRoot = join(homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0');
    const codexSkillDir = join(homeDir, '.codex', 'skills', 'rolemux-workflow');
    await mkdir(pluginRoot, { recursive: true });
    await mkdir(pluginCacheRoot, { recursive: true });
    await mkdir(codexSkillDir, { recursive: true });

    const result = await uninstallCommand({ homeDir, dryRun: false, codexPlugin: true });

    expect(result.targets).toEqual([pluginRoot, pluginCacheRoot]);
    expect(existsSync(pluginRoot)).toBe(false);
    expect(existsSync(pluginCacheRoot)).toBe(false);
    expect(existsSync(codexSkillDir)).toBe(true);
  });
});
