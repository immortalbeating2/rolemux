/** Minimal shape required for fallback status evaluation. */
export interface FallbackAttemptResult {
  readonly provider: string;
  readonly status: string;
  readonly output?: string;
  readonly command?: unknown;
  readonly prompt?: string;
  readonly stderr?: string;
  readonly exitCode?: number | null;
}

/** Result returned by the fallback runner. */
export type FallbackResult<TAttempt extends FallbackAttemptResult> = TAttempt & {
  readonly attempts: readonly TAttempt[];
  readonly deadlineReached: boolean;
};

export interface FallbackOptions {
  readonly maxAttempts?: number | undefined;
  readonly deadlineAt?: number | undefined;
}

/** Runs providers in order and returns the first successful attempt. */
export async function runWithFallback<TProvider extends string, TAttempt extends FallbackAttemptResult>(
  providers: readonly TProvider[],
  runAttempt: (provider: TProvider, remainingMs?: number) => Promise<TAttempt>,
  options: FallbackOptions = {}
): Promise<FallbackResult<TAttempt>> {
  const attempts: TAttempt[] = [];
  const maxAttempts = options.maxAttempts ?? providers.length;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Fallback maxAttempts must be a positive integer.');
  }

  for (const provider of providers.slice(0, maxAttempts)) {
    const remainingMs = options.deadlineAt === undefined ? undefined : options.deadlineAt - Date.now();
    if (remainingMs !== undefined && remainingMs <= 0) {
      break;
    }
    const attempt = await runAttempt(provider, remainingMs);
    attempts.push(attempt);
    if (attempt.status === 'success') {
      return { ...attempt, attempts, deadlineReached: false };
    }
    if (options.deadlineAt !== undefined && (Date.now() >= options.deadlineAt || attempt.status === 'timeout')) {
      return { ...attempt, status: 'timeout', attempts, deadlineReached: true };
    }
  }

  const lastAttempt = attempts.at(-1);
  if (lastAttempt === undefined) {
    throw new Error('Fallback requires at least one provider.');
  }

  return { ...lastAttempt, status: 'failed', attempts, deadlineReached: false };
}
