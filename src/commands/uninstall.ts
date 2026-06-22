import { constants } from 'node:fs';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface UninstallCommandOptions {
  homeDir: string;
  dryRun: boolean;
  keepConfig?: boolean;
  codex?: boolean;
  claude?: boolean;
  codexPlugin?: boolean;
}

export interface UninstallCommandResult {
  status: 'dry-run' | 'uninstalled';
  targets: string[];
  removed: string[];
  skipped: string[];
}

/**
 * 卸载 RoleMux 明确安装的 shared runtime、非插件 Skill，或显式选择的 Codex App 插件。
 */
export async function uninstallCommand(options: UninstallCommandOptions): Promise<UninstallCommandResult> {
  const targets = buildUninstallTargets(options);

  if (options.dryRun) {
    return {
      status: 'dry-run',
      targets,
      removed: [],
      skipped: []
    };
  }

  const removed: string[] = [];
  const skipped: string[] = [];
  for (const target of targets) {
    if (!(await exists(target))) {
      skipped.push(target);
      continue;
    }

    await rm(target, { recursive: true, force: true });
    removed.push(target);
  }

  return {
    status: 'uninstalled',
    targets,
    removed,
    skipped
  };
}

function buildUninstallTargets(options: UninstallCommandOptions): string[] {
  const hasExplicitTarget = options.codex === true || options.claude === true || options.codexPlugin === true;
  const targets: string[] = [];

  if (!hasExplicitTarget) {
    targets.push(join(options.homeDir, '.rolemux', 'roles'));
  }

  if (!hasExplicitTarget || options.codex === true) {
    targets.push(join(options.homeDir, '.codex', 'skills', 'rolemux-workflow'));
  }

  if (!hasExplicitTarget || options.claude === true) {
    targets.push(join(options.homeDir, '.claude', 'skills', 'rolemux-workflow'));
  }

  if (options.codexPlugin === true) {
    targets.push(
      join(options.homeDir, 'plugins', 'rolemux'),
      join(options.homeDir, '.codex', 'plugins', 'cache', 'personal', 'rolemux', '0.1.0')
    );
  }

  if (!hasExplicitTarget && options.keepConfig !== true) {
    targets.unshift(join(options.homeDir, '.rolemux', 'config.toml'));
  }

  return targets;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
