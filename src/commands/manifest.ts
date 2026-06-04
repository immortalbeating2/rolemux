import { readSubtaskManifest } from '../core/subtask-manifest.js';

export interface ManifestValidateCommandOptions {
  readonly manifest: string;
}

export interface ManifestValidateCommandResult {
  readonly status: 'success';
  readonly manifestPath: string;
  readonly parentTitle: string;
  readonly subtaskCount: number;
  readonly nextCommands: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresUserAction: boolean;
}

/** Validates a RoleMux subtask manifest and returns AI-friendly next commands. */
export async function manifestValidateCommand(options: ManifestValidateCommandOptions): Promise<ManifestValidateCommandResult> {
  const manifest = await readSubtaskManifest(options.manifest);
  return {
    status: 'success',
    manifestPath: options.manifest,
    parentTitle: manifest.parentTask.title,
    subtaskCount: manifest.subtasks.length,
    nextCommands: [`rolemux dispatch --manifest ${options.manifest} --providers codex:1 --dry-run`],
    warnings: [],
    requiresUserAction: false
  };
}
