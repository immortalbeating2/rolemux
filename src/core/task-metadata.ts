import { z } from 'zod';

/** Task run status persisted in metadata.json. */
export type TaskRunStatus = 'success' | 'failed' | 'timeout' | 'canceled' | 'dry-run';

/** Relative artifact paths written inside a task directory. */
export interface TaskArtifacts {
  readonly task: string;
  readonly prompt: string;
  readonly output: string;
  readonly stderr: string;
  readonly report?: string | undefined;
  readonly manifest?: string | undefined;
  readonly summary?: string | undefined;
  readonly diff?: string | undefined;
  readonly worktree?: string | undefined;
  readonly result?: string | undefined;
}

/** Reproducibility facts recorded without exposing provider credentials. */
export interface RunProvenance {
  readonly gitHead: string | null;
  readonly promptSha256: string;
  readonly executionConfigSha256: string;
  readonly providerExecutable: string;
  readonly providerCliVersion: string | null;
  readonly model: {
    readonly requested: string | null;
    readonly resolved: string | null;
    readonly source: 'not-reported' | 'provider-output' | 'user-supplied';
  };
  readonly humanApproval: 'not-recorded' | 'approved' | 'not-required';
}

/** Configured and consumed execution limits for a provider run. */
export interface ExecutionBudget {
  readonly maxAttempts: number;
  readonly timeoutMs: number | null;
  readonly attemptsUsed: number;
  readonly deadlineReached: boolean;
}

/** Persisted metadata schema for .rolemux/tasks/{task-id}/metadata.json. */
export interface TaskMetadata {
  readonly schemaVersion?: 1 | undefined;
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
  readonly provenance?: RunProvenance | undefined;
  readonly budget?: ExecutionBudget | undefined;
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
  schemaVersion: z.literal(1).optional(),
  taskId: z.string().min(1),
  command: z.string().min(1),
  provider: z.string().optional(),
  role: z.string().optional(),
  workdir: z.string().min(1),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  durationMs: z.number().nonnegative(),
  exitCode: z.number().int().nullable(),
  status: z.enum(['success', 'failed', 'timeout', 'canceled', 'dry-run']),
  artifacts: z.object({
    task: z.string().min(1),
    prompt: z.string().min(1),
    output: z.string().min(1),
    stderr: z.string().min(1),
    report: z.string().optional(),
    manifest: z.string().optional(),
    summary: z.string().optional(),
    diff: z.string().optional(),
    worktree: z.string().optional(),
    result: z.string().optional()
  }),
  provenance: z.object({
    gitHead: z.string().nullable(),
    promptSha256: z.string().regex(/^[a-f0-9]{64}$/),
    executionConfigSha256: z.string().regex(/^[a-f0-9]{64}$/),
    providerExecutable: z.string().min(1),
    providerCliVersion: z.string().nullable(),
    model: z.object({
      requested: z.string().nullable(),
      resolved: z.string().nullable(),
      source: z.enum(['not-reported', 'provider-output', 'user-supplied'])
    }),
    humanApproval: z.enum(['not-recorded', 'approved', 'not-required'])
  }).optional(),
  budget: z.object({
    maxAttempts: z.number().int().positive(),
    timeoutMs: z.number().int().positive().nullable(),
    attemptsUsed: z.number().int().nonnegative(),
    deadlineReached: z.boolean()
  }).optional(),
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
