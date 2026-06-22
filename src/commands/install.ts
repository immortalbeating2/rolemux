import { constants, existsSync } from 'node:fs';
import { access, copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InstallCommandOptions {
  homeDir: string;
  projectDir: string;
  dryRun: boolean;
  withAgents?: boolean;
  codex?: boolean;
  claude?: boolean;
  codexPlugin?: boolean;
}

export type InstallTargetGroup = 'shared' | 'codex' | 'claude' | 'codex-plugin' | 'agents';

export interface InstallTargetPlan {
  group: InstallTargetGroup;
  path: string;
  status: 'planned' | 'skipped-existing' | 'optional-not-selected';
  flag?: string;
}

export interface OptionalInstallTarget {
  flag: string;
  group: InstallTargetGroup;
  paths: string[];
}

export interface InstallCommandResult {
  status: 'dry-run' | 'installed';
  targets: string[];
  targetPlan: InstallTargetPlan[];
  optionalTargets: OptionalInstallTarget[];
  written: string[];
  skipped: string[];
  warnings: string[];
}

/**
 * 安装 RoleMux shared runtime，并按显式目标安装非插件 Skill 或同步 Codex App 插件。
 */
export async function installCommand(options: InstallCommandOptions): Promise<InstallCommandResult> {
  const sourceRoot = findSourceRoot();
  const installTargets = buildInstallTargets(options);
  const optionalTargets = buildOptionalTargets(options);

  if (options.withAgents === true) {
    installTargets.push({
      group: 'agents',
      path: join(options.projectDir, 'AGENTS.md'),
      action: 'agents'
    });
  }

  const targets = installTargets.map(target => target.path);
  const targetPlan = await buildTargetPlan(installTargets, optionalTargets);

  if (options.dryRun) {
    return {
      status: 'dry-run',
      targets,
      targetPlan,
      optionalTargets,
      written: [],
      skipped: [],
      warnings: []
    };
  }

  const written: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  let codexPluginSynced = false;

  for (const target of installTargets) {
    if (target.action === 'copy-file') {
      await copyIfMissing(requiredSource(target), target.path, written, skipped);
      continue;
    }
    if (target.action === 'copy-directory') {
      await copyDirectoryIfMissing(requiredSource(target), target.path, written, skipped);
      continue;
    }
    if (target.action === 'sync-codex-plugin') {
      if (!codexPluginSynced) {
        await syncCodexPlugin(sourceRoot, options.homeDir, written, skipped, warnings);
        codexPluginSynced = true;
      }
      continue;
    }
    await writeAgentsSnippet(target.path, written, skipped);
  }

  return {
    status: 'installed',
    targets,
    targetPlan,
    optionalTargets,
    written,
    skipped,
    warnings
  };
}

interface InstallTarget {
  group: InstallTargetGroup;
  path: string;
  action: 'copy-file' | 'copy-directory' | 'sync-codex-plugin' | 'agents';
  source?: string;
}

function requiredSource(target: InstallTarget): string {
  if (target.source === undefined) {
    throw new Error(`Install target is missing a source path: ${target.path}`);
  }
  return target.source;
}

function buildInstallTargets(options: InstallCommandOptions): InstallTarget[] {
  const sourceRoot = findSourceRoot();
  const targets: InstallTarget[] = [
    {
      group: 'shared',
      path: join(options.homeDir, '.rolemux', 'config.toml'),
      action: 'copy-file',
      source: join(sourceRoot, 'templates', 'config.toml')
    },
    {
      group: 'shared',
      path: join(options.homeDir, '.rolemux', 'roles'),
      action: 'copy-directory',
      source: join(sourceRoot, 'roles')
    }
  ];

  if (options.codex === true) {
    targets.push({
      group: 'codex',
      path: join(options.homeDir, '.codex', 'skills', 'rolemux-workflow'),
      action: 'copy-directory',
      source: getSharedSkillSource(sourceRoot)
    });
  }

  if (options.claude === true) {
    targets.push({
      group: 'claude',
      path: join(options.homeDir, '.claude', 'skills', 'rolemux-workflow'),
      action: 'copy-directory',
      source: getSharedSkillSource(sourceRoot)
    });
  }

  if (options.codexPlugin === true) {
    targets.push({
      group: 'codex-plugin',
      path: join(options.homeDir, 'plugins', 'rolemux'),
      action: 'sync-codex-plugin'
    });
    targets.push({
      group: 'codex-plugin',
      path: join(options.homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0'),
      action: 'sync-codex-plugin'
    });
  }

  return targets;
}

function buildOptionalTargets(options: InstallCommandOptions): OptionalInstallTarget[] {
  const optionalTargets: OptionalInstallTarget[] = [];
  if (options.codex !== true) {
    optionalTargets.push({
      flag: '--codex',
      group: 'codex',
      paths: [join(options.homeDir, '.codex', 'skills', 'rolemux-workflow')]
    });
  }
  if (options.claude !== true) {
    optionalTargets.push({
      flag: '--claude',
      group: 'claude',
      paths: [join(options.homeDir, '.claude', 'skills', 'rolemux-workflow')]
    });
  }
  if (options.codexPlugin !== true) {
    optionalTargets.push({
      flag: '--codex-plugin',
      group: 'codex-plugin',
      paths: [
        join(options.homeDir, 'plugins', 'rolemux'),
        join(options.homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0')
      ]
    });
  }
  return optionalTargets;
}

async function buildTargetPlan(installTargets: InstallTarget[], optionalTargets: OptionalInstallTarget[]): Promise<InstallTargetPlan[]> {
  const planned = await Promise.all(installTargets.map(async target => ({
    group: target.group,
    path: target.path,
    status: target.group === 'codex-plugin' || !(await exists(target.path)) ? 'planned' as const : 'skipped-existing' as const
  })));
  const optional = optionalTargets.flatMap(target => target.paths.map(path => ({
    group: target.group,
    path,
    flag: target.flag,
    status: 'optional-not-selected' as const
  })));
  return [...planned, ...optional];
}

async function copyDirectoryIfMissing(sourceDir: string, targetDir: string, written: string[], skipped: string[]): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryIfMissing(sourcePath, targetPath, written, skipped);
      continue;
    }
    await copyIfMissing(sourcePath, targetPath, written, skipped);
  }
}

async function copyIfMissing(sourcePath: string, targetPath: string, written: string[], skipped: string[]): Promise<void> {
  if (await exists(targetPath)) {
    skipped.push(targetPath);
    return;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  written.push(targetPath);
}

async function copyOverwrite(sourcePath: string, targetPath: string, written: string[]): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  written.push(targetPath);
}

async function copyDirectoryOverwrite(sourceDir: string, targetDir: string, written: string[]): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectoryOverwrite(sourcePath, targetPath, written);
      continue;
    }
    await copyOverwrite(sourcePath, targetPath, written);
  }
}

async function syncCodexPlugin(sourceRoot: string, homeDir: string, written: string[], skipped: string[], warnings: string[]): Promise<void> {
  const pluginRoot = join(homeDir, 'plugins', 'rolemux');
  const pluginCacheRoot = join(homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0');

  if (!(await exists(pluginRoot))) {
    warnings.push(`Codex plugin source not found: ${pluginRoot}`);
    skipped.push(pluginRoot);
    return;
  }

  const sourceSkill = join(getSharedSkillSource(sourceRoot), 'SKILL.md');
  await copyOverwrite(sourceSkill, join(pluginRoot, 'skills', 'rolemux-workflow', 'SKILL.md'), written);
  await copyOverwrite(join(sourceRoot, 'README.md'), join(pluginRoot, 'README.md'), written);

  if (!(await exists(pluginCacheRoot))) {
    warnings.push(`Codex plugin cache not found: ${pluginCacheRoot}`);
    skipped.push(pluginCacheRoot);
    return;
  }

  await copyDirectoryOverwrite(pluginRoot, pluginCacheRoot, written);
}

function getSharedSkillSource(sourceRoot: string): string {
  return join(sourceRoot, 'skills', 'rolemux-workflow');
}

async function writeAgentsSnippet(targetPath: string, written: string[], skipped: string[]): Promise<void> {
  if (await exists(targetPath)) {
    skipped.push(targetPath);
    return;
  }

  const snippet = [
    '# RoleMux',
    '',
    'This project can use RoleMux for optional multi-CLI planning, review, and discussion workflows.',
    'RoleMux should not read or print secrets, and dry-run commands should not invoke provider CLIs.',
    ''
  ].join('\n');

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, snippet, 'utf8');
  written.push(targetPath);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findSourceRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const candidates = [
    resolve(dirname(currentFile), '..'),
    resolve(dirname(currentFile), '..', '..'),
    process.cwd()
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  return process.cwd();
}
