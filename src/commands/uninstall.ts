import { constants } from 'node:fs';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';

export interface UninstallCommandOptions {
  homeDir: string;
  dryRun: boolean;
  keepConfig?: boolean;
}

export interface UninstallCommandResult {
  status: 'dry-run' | 'uninstalled';
  targets: string[];
  removed: string[];
  skipped: string[];
}

/**
 * 卸载 RoleMux 明确安装的 config、roles 与 Skill bundle；dry-run 只列出目标。
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
  const targets = [
    join(options.homeDir, '.rolemux', 'roles'),
    join(options.homeDir, '.codex', 'skills', 'rolemux-workflow'),
    join(options.homeDir, '.claude', 'skills', 'rolemux-workflow')
  ];

  if (options.keepConfig !== true) {
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
