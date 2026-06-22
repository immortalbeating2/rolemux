import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { installCommand } from '../../src/commands/install.js';

describe('install command', () => {
  test('keeps one shared Skill source in the repository', async () => {
    const sharedSkill = await readFile(join(process.cwd(), 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');

    expect(sharedSkill).toContain('current AI session');
    expect(existsSync(join(process.cwd(), 'skills', 'codex', 'rolemux-workflow', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'skills', 'claude', 'rolemux-workflow', 'SKILL.md'))).toBe(false);
  });

  test('dry-run defaults to shared targets and shows optional agent targets', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux install home '));
    const projectDir = await mkdtemp(join(tmpdir(), 'rolemux install project '));

    const result = await installCommand({
      homeDir,
      projectDir,
      dryRun: true,
      withAgents: false
    });

    expect(result.status).toBe('dry-run');
    expect(result.targets).toEqual(expect.arrayContaining([
      join(homeDir, '.rolemux', 'config.toml'),
      join(homeDir, '.rolemux', 'roles')
    ]));
    expect(result.targets.some(target => target.includes('.codex'))).toBe(false);
    expect(result.targets.some(target => target.includes('.claude'))).toBe(false);
    expect(result.optionalTargets.map(target => target.flag)).toEqual(expect.arrayContaining(['--codex', '--claude', '--codex-plugin']));
    expect(result.targetPlan.some(target => target.status === 'optional-not-selected' && target.flag === '--codex')).toBe(true);
    expect(result.targets.some(target => target.endsWith('AGENTS.md'))).toBe(false);
  });

  test('default install writes only shared runtime files into an isolated home', async () => {
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
      join(homeDir, '.rolemux', 'roles', 'builder.md')
    ]));
    expect(result.written.some(path => path.includes('.codex'))).toBe(false);
    expect(result.written.some(path => path.includes('.claude'))).toBe(false);
    expect(existsSync(join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'))).toBe(false);
    expect(existsSync(join(homeDir, '.claude', 'skills', 'rolemux-workflow', 'SKILL.md'))).toBe(false);
    expect(result.written.some(path => path.endsWith('AGENTS.md'))).toBe(false);
  });

  test('explicit codex and claude options install non-plugin Skill files', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux install agents home '));
    const projectDir = await mkdtemp(join(tmpdir(), 'rolemux install agents project '));

    const result = await installCommand({
      homeDir,
      projectDir,
      dryRun: false,
      withAgents: false,
      codex: true,
      claude: true
    });

    expect(result.written).toEqual(expect.arrayContaining([
      join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'),
      join(homeDir, '.claude', 'skills', 'rolemux-workflow', 'SKILL.md')
    ]));
    const installedCodexSkill = await readFile(join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');
    const installedClaudeSkill = await readFile(join(homeDir, '.claude', 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');
    const sharedSkill = await readFile(join(process.cwd(), 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');
    expect(installedCodexSkill).toBe(sharedSkill);
    expect(installedClaudeSkill).toBe(sharedSkill);
  });

  test('codex-plugin target syncs plugin source and cache without writing non-plugin Codex Skill', async () => {
    const homeDir = await mkdtemp(join(tmpdir(), 'rolemux install plugin home '));
    const projectDir = await mkdtemp(join(tmpdir(), 'rolemux install plugin project '));
    const pluginRoot = join(homeDir, 'plugins', 'rolemux');
    const pluginCacheRoot = join(homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0');
    await mkdir(join(pluginRoot, '.codex-plugin'), { recursive: true });
    await mkdir(pluginCacheRoot, { recursive: true });

    const result = await installCommand({
      homeDir,
      projectDir,
      dryRun: false,
      withAgents: false,
      codexPlugin: true
    });

    const sourceSkill = await readFile(join(pluginRoot, 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');
    const cachedSkill = await readFile(join(pluginCacheRoot, 'skills', 'rolemux-workflow', 'SKILL.md'), 'utf8');
    expect(sourceSkill).toContain('RoleMux');
    expect(cachedSkill).toBe(sourceSkill);
    expect(result.written).toEqual(expect.arrayContaining([
      join(pluginRoot, 'skills', 'rolemux-workflow', 'SKILL.md'),
      join(pluginRoot, 'README.md'),
      join(pluginCacheRoot, 'skills', 'rolemux-workflow', 'SKILL.md')
    ]));
    expect(existsSync(join(homeDir, '.codex', 'skills', 'rolemux-workflow', 'SKILL.md'))).toBe(false);
  });
});
