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
};

/** Runs providers in order and returns the first successful attempt. */
export async function runWithFallback<TProvider extends string, TAttempt extends FallbackAttemptResult>(
  providers: readonly TProvider[],
  runAttempt: (provider: TProvider) => Promise<TAttempt>
): Promise<FallbackResult<TAttempt>> {
  const attempts: TAttempt[] = [];

  for (const provider of providers) {
    const attempt = await runAttempt(provider);
    attempts.push(attempt);
    if (attempt.status === 'success') {
      return { ...attempt, attempts };
    }
  }

  const lastAttempt = attempts.at(-1);
  if (lastAttempt === undefined) {
    throw new Error('Fallback requires at least one provider.');
  }

  return { ...lastAttempt, status: 'failed', attempts };
}
