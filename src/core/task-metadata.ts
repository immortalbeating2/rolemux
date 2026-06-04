import { z } from 'zod';

/** Task run status persisted in metadata.json. */
export type TaskRunStatus = 'success' | 'failed' | 'timeout' | 'dry-run';

/** Relative artifact paths written inside a task directory. */
export interface TaskArtifacts {
  readonly task: string;
  readonly prompt: string;
  readonly output: string;
  readonly stderr: string;
  readonly report?: string | undefined;
  readonly manifest?: string | undefined;
  readonly summary?: string | undefined;
}

/** Persisted metadata schema for .rolemux/tasks/{task-id}/metadata.json. */
export interface TaskMetadata {
  readonly taskId: string;
  readonly command: string;
  readonly provider?: string | undefined;
  readonly role?: string | undefined;
  readonly workdir: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly exitCode: number | null;
  readonly status: TaskRunStatus;
  readonly artifacts: TaskArtifacts;
  readonly attempts?: readonly unknown[] | undefined;
  readonly dispatch?: {
    readonly manifestPath: string;
    readonly workerCount: number;
    readonly subtaskCount: number;
    readonly successCount: number;
    readonly failedCount: number;
    readonly timeoutCount: number;
  } | undefined;
}

/** Runtime validator for persisted task artifact metadata. */
export const taskMetadataSchema = z.object({
  taskId: z.string().min(1),
  command: z.string().min(1),
  provider: z.string().optional(),
  role: z.string().optional(),
  workdir: z.string().min(1),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
  exitCode: z.number().int().nullable(),
  status: z.enum(['success', 'failed', 'timeout', 'dry-run']),
  artifacts: z.object({
    task: z.string().min(1),
    prompt: z.string().min(1),
    output: z.string().min(1),
    stderr: z.string().min(1),
    report: z.string().optional(),
    manifest: z.string().optional(),
    summary: z.string().optional()
  }),
  attempts: z.array(z.unknown()).optional(),
  dispatch: z.object({
    manifestPath: z.string().min(1),
    workerCount: z.number().int().nonnegative(),
    subtaskCount: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    timeoutCount: z.number().int().nonnegative()
  }).optional()
});

/** Parses metadata JSON into the stable TaskMetadata contract. */
export function parseTaskMetadata(value: unknown): TaskMetadata {
  return taskMetadataSchema.parse(value) as TaskMetadata;
}
