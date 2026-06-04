import { loadDispatchResume } from '../core/dispatch-resume.js';
import type { DispatchResumeSummary } from '../core/dispatch-resume.js';

export interface DispatchResumeCommandOptions {
  readonly parentTask: string;
  readonly workdir?: string | undefined;
}

/** Loads a dispatch parent task and returns a machine-readable resume summary. */
export async function dispatchResumeCommand(options: DispatchResumeCommandOptions): Promise<DispatchResumeSummary> {
  return loadDispatchResume({
    parentTaskId: options.parentTask,
    workdir: options.workdir ?? process.cwd()
  });
}
