/** Stable RoleMux error codes used by core modules. */
export type CliErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'PROCESS_FAILED'
  | 'PROCESS_TIMEOUT'
  | 'TASK_STORE_ERROR'
  | 'PROVIDER_NOT_FOUND'
  | 'SUBTASK_ID_DUPLICATED'
  | 'WORKER_POOL_INVALID'
  | 'DISPATCH_UNSUPPORTED_WRITE_POLICY';

/** Structured error for command and core boundaries. */
export class CliError extends Error {
  readonly code: CliErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(message: string, options: { code: CliErrorCode; details?: Record<string, unknown>; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'CliError';
    this.code = options.code;
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}
