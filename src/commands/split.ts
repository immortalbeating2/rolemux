import { normalizeTasksDirectory, readSubtaskManifest, writeSubtaskManifest } from '../core/subtask-manifest.js';
import type { SubtaskManifest } from '../core/subtask-manifest.js';

export interface SplitCommandOptions {
  readonly manifest?: string | undefined;
  readonly tasksDir?: string | undefined;
  readonly out: string;
  readonly dryRun?: boolean | undefined;
}

export interface SplitCommandResult {
  readonly status: 'dry-run' | 'success';
  readonly manifestPath: string;
  readonly manifest: SubtaskManifest;
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Normalizes supported task inputs into the stable RoleMux subtask manifest. */
export async function splitCommand(options: SplitCommandOptions): Promise<SplitCommandResult> {
  const manifest = await buildManifest(options);
  if (options.dryRun !== true) {
    await writeSubtaskManifest(options.out, manifest);
  }
  return {
    status: options.dryRun === true ? 'dry-run' : 'success',
    manifestPath: options.out,
    manifest,
    nextCommands: [`rolemux dispatch --manifest ${options.out} --providers codex:1 --dry-run`],
    warnings: [],
    requiresUserAction: options.dryRun === true
  };
}

async function buildManifest(options: SplitCommandOptions): Promise<SubtaskManifest> {
  if (options.manifest !== undefined) {
    return readSubtaskManifest(options.manifest);
  }
  if (options.tasksDir !== undefined) {
    return normalizeTasksDirectory({ tasksDir: options.tasksDir });
  }
  throw new Error('split requires --manifest or --tasks-dir');
}
