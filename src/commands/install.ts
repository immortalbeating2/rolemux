import { constants, existsSync } from 'node:fs';
import { access, copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InstallCommandOptions {
  homeDir: string;
  projectDir: string;
  dryRun: boolean;
  withAgents?: boolean;
}

export interface InstallCommandResult {
  status: 'dry-run' | 'installed';
  targets: string[];
  written: string[];
  skipped: string[];
}

/**
 * 安装 RoleMux config、roles 与 Skill bundle；dry-run 只返回目标路径。
 */
export async function installCommand(options: InstallCommandOptions): Promise<InstallCommandResult> {
  const sourceRoot = findSourceRoot();
  const targets = buildInstallTargets(options);

  if (options.withAgents === true) {
    targets.push(join(options.projectDir, 'AGENTS.md'));
  }

  if (options.dryRun) {
    return {
      status: 'dry-run',
      targets,
      written: [],
      skipped: []
    };
  }

  const written: string[] = [];
  const skipped: string[] = [];

  await copyIfMissing(join(sourceRoot, 'templates', 'config.toml'), join(options.homeDir, '.rolemux', 'config.toml'), written, skipped);
  await copyDirectoryIfMissing(join(sourceRoot, 'roles'), join(options.homeDir, '.rolemux', 'roles'), written, skipped);
  await copyDirectoryIfMissing(
    join(sourceRoot, 'skills', 'codex', 'rolemux-workflow'),
    join(options.homeDir, '.codex', 'skills', 'rolemux-workflow'),
    written,
    skipped
  );
  await copyDirectoryIfMissing(
    join(sourceRoot, 'skills', 'claude', 'rolemux-workflow'),
    join(options.homeDir, '.claude', 'skills', 'rolemux-workflow'),
    written,
    skipped
  );

  if (options.withAgents === true) {
    await writeAgentsSnippet(join(options.projectDir, 'AGENTS.md'), written, skipped);
  }

  return {
    status: 'installed',
    targets,
    written,
    skipped
  };
}

function buildInstallTargets(options: InstallCommandOptions): string[] {
  return [
    join(options.homeDir, '.rolemux', 'config.toml'),
    join(options.homeDir, '.rolemux', 'roles'),
    join(options.homeDir, '.codex', 'skills', 'rolemux-workflow'),
    join(options.homeDir, '.claude', 'skills', 'rolemux-workflow')
  ];
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
