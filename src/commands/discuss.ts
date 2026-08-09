import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTaskStore } from '../core/task-store.js';
import { readVerificationManifest, runVerificationManifest, type VerificationResult } from '../core/verification-manifest.js';
import { routeCommand, type RouteCommandResult } from './route.js';
import { runCommand } from './run.js';
import type { ProviderCommand, TaskKind } from '../providers/index.js';
import type { RunCommandResult } from './run.js';
import { assertProviderNamesReady } from '../core/provider-preflight.js';

export type DiscussMode = 'parallel' | 'serial' | 'structured';

export interface DiscussCommandOptions {
  providers?: string[] | undefined;
  task: string;
  workdir?: string;
  mode?: DiscussMode;
  dryRun?: boolean;
  counterReviewer?: string;
  summarizer?: string;
  verificationManifest?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  taskKind?: TaskKind | undefined;
  availableProviders?: string[] | undefined;
  excludeProviders?: string[] | undefined;
  maxProviders?: number | undefined;
}

export interface DiscussStage {
  readonly stage: 'candidate' | 'counter' | 'verification' | 'synthesis';
  readonly status: string;
  readonly taskId?: string | undefined;
  readonly provider?: string | undefined;
}

export interface DiscussCommandResult {
  status: 'dry-run' | 'success' | 'failed';
  mode: DiscussMode;
  previews?: ProviderCommand[];
  runs?: RunCommandResult[];
  stages?: DiscussStage[];
  verification?: readonly VerificationResult[];
  routing?: RouteCommandResult;
}

/** Runs independent or evidence-structured multi-provider discussion. */
export async function discussCommand(options: DiscussCommandOptions): Promise<DiscussCommandResult> {
  const mode = options.mode ?? 'parallel';
  if (mode !== 'parallel' && mode !== 'serial' && mode !== 'structured') {
    throw new Error(`Invalid discuss mode: ${String(mode)}`);
  }
  const explicitProviders = options.providers?.filter(Boolean) ?? [];
  const routing = explicitProviders.length > 0 ? undefined : await routeDiscussion(options);
  const providers = explicitProviders.length > 0 ? explicitProviders : [...(routing?.selected ?? [])];
  if (providers.length === 0) {
    throw new Error('Discuss requires explicit providers or a task kind with at least one available route.');
  }
  if (options.dryRun !== true) {
    await assertProviderNamesReady([
      ...providers,
      ...(options.counterReviewer === undefined ? [] : [options.counterReviewer]),
      ...(options.summarizer === undefined ? [] : [options.summarizer])
    ]);
  }
  if (mode === 'structured') {
    return runStructuredDiscussion(options, providers, routing);
  }

  const buildRun = (provider: string, dryRun: boolean): Promise<RunCommandResult> => runCommand({
    provider,
    role: 'summarizer',
    task: options.task,
    ...(options.workdir === undefined ? {} : { workdir: options.workdir }),
    dryRun,
    ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts })
  });

  if (options.dryRun !== true) {
    const runs = mode === 'parallel'
      ? await Promise.all(providers.map(provider => buildRun(provider, false)))
      : [];
    if (mode === 'serial') {
      for (const provider of providers) {
        runs.push(await buildRun(provider, false));
      }
    }
    return { status: runs.every(run => run.status === 'success') ? 'success' : 'failed', mode, runs, ...(routing === undefined ? {} : { routing }) };
  }

  const previews = await Promise.all(providers.map(async provider => (await buildRun(provider, true)).command));
  return { status: 'dry-run', mode, previews, ...(routing === undefined ? {} : { routing }) };
}

async function runStructuredDiscussion(
  options: DiscussCommandOptions,
  providers: readonly string[],
  routing?: RouteCommandResult
): Promise<DiscussCommandResult> {
  const workdir = resolve(options.workdir ?? process.cwd());
  const originalTask = await readFile(resolve(workdir, options.task), 'utf8');
  const counterReviewer = options.counterReviewer ?? providers.at(-1) ?? providers[0];
  const summarizer = options.summarizer ?? providers[0];
  if (counterReviewer === undefined || summarizer === undefined) {
    throw new Error('Structured discussion requires counter-reviewer and summarizer providers.');
  }
  const verificationManifest = options.verificationManifest === undefined
    ? undefined
    : await readVerificationManifest(resolve(workdir, options.verificationManifest));
  const tempDir = await mkdtemp(join(tmpdir(), 'rolemux-structured-'));
  try {
    const runStage = async (
      provider: string,
      role: string,
      name: string,
      task: string,
      structuredResult = false,
      authoritativeVerification?: readonly VerificationResult[]
    ): Promise<RunCommandResult> => {
      const taskPath = join(tempDir, `${name}.md`);
      await writeFile(taskPath, task, 'utf8');
      return runCommand({
        provider,
        role,
        task: taskPath,
        workdir,
        dryRun: options.dryRun === true,
        structuredResult,
        ...(authoritativeVerification === undefined ? {} : { authoritativeVerification }),
        ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts })
      });
    };

    const candidates = await Promise.all(providers.map((provider, index) => runStage(
      provider,
      'reviewer',
      `candidate-${index + 1}`,
      `Independent candidate analysis\n\nAnalyze this task independently. Do not assume or reference other candidates.\n\n${originalTask}`
    )));
    const successfulCandidates = candidates.filter(run => run.status === 'success');
    if (successfulCandidates.length === 0 && options.dryRun !== true) {
      return {
        status: 'failed',
        mode: 'structured',
        runs: candidates,
        stages: candidates.map((run, index) => toStage('candidate', providers[index], run)),
        ...(routing === undefined ? {} : { routing })
      };
    }

    const resolvedEvidence = options.dryRun === true
      ? providers.map((_, index) => `Candidate ${index + 1}:\n<available after execution>`)
      : (await Promise.all(successfulCandidates.map(run => readRunOutput(workdir, run))))
          .map((output, index) => `Candidate ${index + 1}:\n${output}`);
    const counter = await runStage(
      counterReviewer,
      'reviewer',
      'counter-review',
      `Challenge the anonymous candidate analyses. Identify unsupported claims, conflicts, and counterexamples.\n\n${resolvedEvidence.join('\n\n')}`
    );

    if (options.dryRun === true) {
      const synthesis = await runStage(
        summarizer,
        'summarizer',
        'synthesis',
        `Synthesize candidate evidence.\n\nCounter-review evidence:\n<available after execution>`,
        true
      );
      return {
        status: 'dry-run',
        mode: 'structured',
        previews: [...candidates, counter, synthesis].map(run => run.command),
        ...(routing === undefined ? {} : { routing })
      };
    }
    if (counter.status !== 'success') {
      return {
        status: 'failed',
        mode: 'structured',
        runs: [...candidates, counter],
        stages: [
          ...candidates.map((run, index) => toStage('candidate', providers[index], run)),
          toStage('counter', counterReviewer, counter)
        ],
        ...(routing === undefined ? {} : { routing })
      };
    }

    const verification = verificationManifest === undefined
      ? []
      : await runVerificationManifest({
          manifest: verificationManifest,
          workdir,
          ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs })
        });
    const verificationRecord = verificationManifest === undefined
      ? undefined
      : await persistVerification(workdir, originalTask, verification);
    const counterOutput = await readRunOutput(workdir, counter);
    const synthesis = await runStage(
      summarizer,
      'summarizer',
      'synthesis',
      [
        'Synthesize the evidence. Prefer deterministic verification over model agreement.',
        ...resolvedEvidence,
        `Counter-review evidence:\n${counterOutput}`,
        `Verification evidence:\n${JSON.stringify(verification, null, 2)}`
      ].join('\n\n'),
      true,
      verification
    );
    const stages: DiscussStage[] = [
      ...candidates.map((run, index) => toStage('candidate', providers[index], run)),
      toStage('counter', counterReviewer, counter),
      verificationRecord === undefined
        ? { stage: 'verification', status: 'not-run' }
        : { stage: 'verification', status: verificationRecord.status, taskId: verificationRecord.taskId },
      toStage('synthesis', summarizer, synthesis)
    ];
    return {
      status: synthesis.status === 'success' && verification.every(item => item.status === 'passed') ? 'success' : 'failed',
      mode: 'structured',
      runs: [...candidates, counter, synthesis],
      stages,
      verification,
      ...(routing === undefined ? {} : { routing })
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function routeDiscussion(options: DiscussCommandOptions): Promise<RouteCommandResult | undefined> {
  if (options.taskKind === undefined) {
    return undefined;
  }
  return routeCommand({
    taskKind: options.taskKind,
    available: options.availableProviders,
    exclude: options.excludeProviders,
    maxProviders: options.maxProviders
  });
}

async function readRunOutput(workdir: string, run: RunCommandResult): Promise<string> {
  if (run.taskId === undefined) {
    return '';
  }
  return readFile(join(workdir, '.rolemux', 'tasks', run.taskId, 'output.md'), 'utf8');
}

async function persistVerification(workdir: string, task: string, verification: readonly VerificationResult[]): Promise<{
  taskId: string;
  status: 'success' | 'failed';
}> {
  const startedAt = new Date().toISOString();
  const status = verification.every(item => item.status === 'passed') ? 'success' : 'failed';
  const record = await createTaskStore({ workdir }).createRun({
    command: 'verify',
    task,
    prompt: 'Execute the approved verification manifest using executable and args arrays.',
    output: `${JSON.stringify(verification, null, 2)}\n`,
    stderr: '',
    status,
    exitCode: status === 'success' ? 0 : 1,
    startedAt,
    finishedAt: new Date().toISOString()
  });
  return { taskId: record.taskId, status };
}

function toStage(stage: DiscussStage['stage'], provider: string | undefined, run: RunCommandResult): DiscussStage {
  return {
    stage,
    status: run.status,
    ...(run.taskId === undefined ? {} : { taskId: run.taskId }),
    ...(provider === undefined ? {} : { provider })
  };
}
