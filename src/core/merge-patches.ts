import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { CliError } from './cli-error.js';
import { runProcess } from './process-runner.js';

export interface MergePatchInput {
  readonly workdir: string;
  readonly parentTaskId: string;
  readonly subtasks?: readonly string[] | undefined;
}

export interface MergePatchPreview {
  readonly subtaskId: string;
  readonly patchPath: string;
  readonly files: readonly string[];
  readonly lineCount: number;
  readonly status: 'ready';
}

export interface MergePreview {
  readonly parentTaskId: string;
  readonly parentTaskDir: string;
  readonly patches: readonly MergePatchPreview[];
  readonly warnings: readonly string[];
}

export interface ApplyMergeResult extends MergePreview {
  readonly status: 'success';
}

/** Loads dispatch subtask patch artifacts for a parent task without modifying the workdir. */
export async function loadMergePreview(input: MergePatchInput): Promise<MergePreview> {
  const workdir = resolve(input.workdir);
  const parentTaskDir = join(workdir, '.rolemux', 'tasks', input.parentTaskId);
  if (!existsSync(parentTaskDir)) {
    throw new CliError(`Parent task not found: ${input.parentTaskId}`, {
      code: 'NOT_FOUND',
      details: { parentTaskId: input.parentTaskId, parentTaskDir }
    });
  }

  const subtasksDir = join(parentTaskDir, 'subtasks');
  if (!existsSync(subtasksDir)) {
    return {
      parentTaskId: input.parentTaskId,
      parentTaskDir,
      patches: [],
      warnings: [`No subtask directory found for parent task ${input.parentTaskId}.`]
    };
  }

  const subtaskNames = normalizeSelectedSubtasks(input.subtasks) ?? await listDirectoryNames(subtasksDir);
  const patches = [];
  for (const subtaskId of subtaskNames) {
    const patchPath = join(subtasksDir, subtaskId, 'diff.patch');
    if (!existsSync(patchPath)) {
      if (input.subtasks !== undefined) {
        throw new CliError(`Patch artifact not found for selected subtask: ${subtaskId}`, {
          code: 'NOT_FOUND',
          details: {
            parentTaskId: input.parentTaskId,
            subtaskId,
            patchPath
          }
        });
      }
      continue;
    }
    const patch = await readFile(patchPath, 'utf8');
    patches.push({
      subtaskId,
      patchPath,
      files: parsePatchFiles(patch),
      lineCount: patch.split(/\r?\n/).length,
      status: 'ready' as const
    });
  }

  return {
    parentTaskId: input.parentTaskId,
    parentTaskDir,
    patches,
    warnings: patches.length === 0 ? [`No diff.patch artifacts found for parent task ${input.parentTaskId}.`] : []
  };
}

/** Applies all clean dispatch patches after checking every patch for conflicts first. */
export async function applyMergePatches(input: MergePatchInput): Promise<ApplyMergeResult> {
  const preview = await loadMergePreview(input);
  const workdir = resolve(input.workdir);
  const patchPaths = preview.patches.map(patch => patch.patchPath);
  assertNoOverlappingFiles(preview.patches);

  if (patchPaths.length > 0) {
    const check = await runProcess({
      executable: 'git',
      args: ['apply', '--check', ...patchPaths],
      cwd: workdir
    });
    if (check.status !== 'success') {
      throw new CliError('One or more patches have conflicts.', {
        code: 'MERGE_CONFLICT',
        details: {
          patchPaths,
          stderr: check.stderr.trim()
        }
      });
    }
  }

  if (patchPaths.length > 0) {
    const apply = await runProcess({
      executable: 'git',
      args: ['apply', ...patchPaths],
      cwd: workdir
    });
    if (apply.status !== 'success') {
      throw new CliError('Failed to apply one or more patches.', {
        code: 'PATCH_APPLY_FAILED',
        details: {
          patchPaths,
          stderr: apply.stderr.trim()
        }
      });
    }
  }

  return {
    ...preview,
    status: 'success'
  };
}

/** Extracts target file paths from git patch headers. */
export function parsePatchFiles(patch: string): string[] {
  const files = new Set<string>();
  for (const line of patch.split(/\r?\n/)) {
    const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (match?.[2] !== undefined) {
      files.add(match[2]);
    }
  }
  return [...files].sort();
}

async function listDirectoryNames(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function normalizeSelectedSubtasks(subtasks: readonly string[] | undefined): string[] | undefined {
  if (subtasks === undefined) {
    return undefined;
  }
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const subtask of subtasks) {
    const trimmed = subtask.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    selected.push(trimmed);
    seen.add(trimmed);
  }
  return selected.length === 0 ? undefined : selected;
}

function assertNoOverlappingFiles(patches: readonly MergePatchPreview[]): void {
  const owners = new Map<string, string>();
  for (const patch of patches) {
    for (const file of patch.files) {
      const owner = owners.get(file);
      if (owner !== undefined) {
        throw new CliError(`Multiple patches touch the same file: ${file}`, {
          code: 'MERGE_CONFLICT',
          details: {
            file,
            subtasks: [owner, patch.subtaskId]
          }
        });
      }
      owners.set(file, patch.subtaskId);
    }
  }
}
