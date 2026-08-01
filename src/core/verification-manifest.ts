import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { runProcess } from './process-runner.js';
import type { TaskResult } from './task-result.js';

const verificationManifestSchema = z.object({
  version: z.literal(1),
  commands: z.array(z.object({
    name: z.string().min(1),
    executable: z.string().min(1),
    args: z.array(z.string())
  })).min(1)
});

export type VerificationResult = TaskResult['verification'][number];

/** Reads a versioned verification manifest that cannot contain shell command strings. */
export async function readVerificationManifest(path: string): Promise<z.infer<typeof verificationManifestSchema>> {
  return verificationManifestSchema.parse(JSON.parse(await readFile(resolve(path), 'utf8')));
}

/** Executes verification commands without a shell and returns compact evidence. */
export async function runVerificationManifest(options: {
  manifest: z.infer<typeof verificationManifestSchema>;
  workdir: string;
  timeoutMs?: number | undefined;
}): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  for (const command of options.manifest.commands) {
    const run = await runProcess({
      executable: command.executable,
      args: command.args,
      cwd: options.workdir,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
    });
    results.push({
      name: command.name,
      status: run.status === 'success' ? 'passed' : 'failed',
      exitCode: run.exitCode,
      output: compactOutput(run.stdout, run.stderr)
    });
  }
  return results;
}

function compactOutput(stdout: string, stderr: string): string {
  return `${stdout}${stderr}`.trim().slice(0, 4_000);
}
