import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runProcess } from '../src/core/process-runner.js';
import { runWorkflow } from '../src/core/workflow-runner.js';
import { isProviderName, type ProviderName } from '../src/providers/index.js';
import {
  parseEvalOutput,
  parseEvalPack,
  renderEvalReport,
  scoreEvalResult,
  type EvalMode,
  type EvalPack,
  type EvalScore
} from './result.js';

export interface EvalInvocationInput {
  readonly provider: ProviderName;
  readonly role: string;
  readonly task: string;
  readonly workdir: string;
}

export interface EvalInvocationResult {
  readonly provider: ProviderName;
  readonly role: string;
  readonly status: string;
  readonly output: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface EvalModeRun {
  readonly mode: EvalMode;
  readonly final: EvalInvocationResult;
  readonly invocations: readonly EvalInvocationResult[];
}

export type EvalExecutor = (input: EvalInvocationInput) => Promise<EvalInvocationResult>;

interface EvalInvocationSummary {
  readonly provider: ProviderName;
  readonly role: string;
  readonly status: string;
  readonly durationMs: number;
}

export interface EvalModeSummary {
  readonly mode: EvalMode;
  readonly finalStatus: string;
  readonly invocationCount: number;
  readonly durationMs: number;
  readonly invocations: readonly EvalInvocationSummary[];
  readonly score: EvalScore;
  readonly parseError?: string | undefined;
}

/** Runs single, unstructured, and structured comparisons against one immutable pack. */
export async function runEvalModes(input: {
  readonly pack: EvalPack;
  readonly workdir: string;
  readonly providers: readonly [ProviderName, ProviderName, ProviderName];
  readonly execute: EvalExecutor;
}): Promise<EvalModeRun[]> {
  const [primary] = input.providers;
  const single = await input.execute({
    provider: primary,
    role: 'reviewer',
    task: buildAnalysisTask(input.pack, 'single'),
    workdir: input.workdir
  });
  const unstructuredCandidates = await Promise.all(input.providers.map(provider => input.execute({
    provider,
    role: 'reviewer',
    task: buildAnalysisTask(input.pack, 'unstructured'),
    workdir: input.workdir
  })));
  const unstructuredFinal = await input.execute({
    provider: primary,
    role: 'summarizer',
    task: buildSynthesisTask(input.pack, 'unstructured', unstructuredCandidates),
    workdir: input.workdir
  });
  const structuredProfiles = [
    { role: 'architect', focus: 'Focus on contracts, module boundaries, and exact constants.' },
    { role: 'reviewer', focus: 'Focus on safety behavior, failure states, and counterexamples.' },
    { role: 'reviewer', focus: 'Independently verify every claim and reject unsupported assumptions.' }
  ] as const;
  const structuredCandidates = await Promise.all(input.providers.map((provider, index) => {
    const profile = structuredProfiles[index];
    if (profile === undefined) {
      throw new Error(`Missing structured profile for provider index ${index}.`);
    }
    return input.execute({
      provider,
      role: profile.role,
      task: `${buildAnalysisTask(input.pack, 'structured')}\n\nPerspective: ${profile.focus}`,
      workdir: input.workdir
    });
  }));
  const structuredCounter = await input.execute({
    provider: primary,
    role: 'reviewer',
    task: buildStructuredCounterTask(structuredCandidates),
    workdir: input.workdir
  });
  const structuredFinal = await input.execute({
    provider: primary,
    role: 'summarizer',
    task: buildStructuredSynthesisTask(input.pack, structuredCandidates, structuredCounter),
    workdir: input.workdir
  });

  return [
    { mode: 'single', final: single, invocations: [single] },
    { mode: 'unstructured', final: unstructuredFinal, invocations: [...unstructuredCandidates, unstructuredFinal] },
    { mode: 'structured', final: structuredFinal, invocations: [...structuredCandidates, structuredCounter, structuredFinal] }
  ];
}

function buildAnalysisTask(pack: EvalPack, mode: EvalMode): string {
  const cases = pack.cases.map(testCase => ({
    id: testCase.id,
    question: testCase.question,
    allowedPaths: testCase.allowedPaths
  }));
  return [
    `Evaluate all repository cases below in result mode "${mode}".`,
    'This is read-only. Do not modify files. Do not read secrets or paths outside each case allowlist.',
    'Do not read other candidate outputs. Inspect the listed source files and answer every case independently.',
    'Return only one JSON object, without Markdown fences, using this contract:',
    '{"schemaVersion":1,"mode":"MODE","summary":"...","findings":[{"caseId":"...","claim":"explicit facts","evidence":["path:line"],"confidence":0.0}]}',
    'The mode field must exactly match the requested result mode. Put all answer facts in claim and cite source paths with line numbers.',
    JSON.stringify(cases, null, 2)
  ].join('\n\n');
}

function buildSynthesisTask(pack: EvalPack, mode: Exclude<EvalMode, 'single'>, candidates: readonly EvalInvocationResult[]): string {
  return [
    `Synthesize candidate audits into one result for mode "${mode}".`,
    'Use only claims supported by cited repository evidence. Resolve disagreements conservatively; do not vote facts into existence.',
    'Return only one JSON object using the same schemaVersion 1 contract and include every pack case exactly once.',
    `Required case ids: ${pack.cases.map(testCase => testCase.id).join(', ')}`,
    ...candidates.map((candidate, index) => [
      `Candidate ${index + 1}: provider=${candidate.provider} role=${candidate.role} status=${candidate.status}`,
      candidate.output
    ].join('\n'))
  ].join('\n\n');
}

function buildStructuredCounterTask(candidates: readonly EvalInvocationResult[]): string {
  return [
    'Challenge the anonymous candidate audits. Identify unsupported claims, conflicts, and missing evidence.',
    'Do not infer correctness from agreement. Return a concise counter-review for the final synthesizer.',
    ...candidates.map((candidate, index) => `Candidate ${index + 1} status=${candidate.status}:\n${candidate.output}`)
  ].join('\n\n');
}

function buildStructuredSynthesisTask(
  pack: EvalPack,
  candidates: readonly EvalInvocationResult[],
  counter: EvalInvocationResult
): string {
  return [
    'Synthesize the anonymous candidate audits and counter-review into one structured result.',
    'Use only claims supported by cited repository evidence. The deterministic scorer, not provider agreement, is the final judge.',
    'Return only one JSON object using the schemaVersion 1 Eval Pack contract and include every case exactly once.',
    `Required case ids: ${pack.cases.map(testCase => testCase.id).join(', ')}`,
    ...candidates.map((candidate, index) => `Candidate ${index + 1} status=${candidate.status}:\n${candidate.output}`),
    `Counter-review evidence status=${counter.status}:\n${counter.output}`
  ].join('\n\n');
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const repoRoot = resolve(options.workdir ?? process.cwd());
  const packPath = resolve(repoRoot, options.pack ?? 'eval/cases.json');
  const pack = parseEvalPack(JSON.parse(await readFile(packPath, 'utf8')));
  const providers = parseProviders(options.providers ?? 'codex,claude,grok');
  const startedAt = new Date();
  const runId = startedAt.toISOString().replaceAll(':', '').replaceAll('.', '-');
  const outputDir = resolve(repoRoot, options.out ?? join('validation', 'eval-pack', 'runs', runId));
  const tempRoot = await mkdtemp(join(tmpdir(), 'rolemux-eval-pack-'));
  const evalWorktree = join(tempRoot, 'worktree');
  await mkdir(outputDir, { recursive: true });

  const head = await requireGit(repoRoot, ['rev-parse', 'HEAD']);
  await requireGit(repoRoot, ['worktree', 'add', '--detach', evalWorktree, head]);
  const modeSummaries: EvalModeSummary[] = [];
  let worktreeDirty = false;
  try {
    const runs = await runEvalModes({
      pack,
      workdir: evalWorktree,
      providers,
      execute: async input => {
        const result = await runWorkflow({ ...input, timeoutMs: 300_000 });
        return {
          provider: result.provider,
          role: result.role,
          status: result.status,
          output: result.output,
          stderr: result.stderr,
          durationMs: result.durationMs
        };
      }
    });
    for (const run of runs) {
      await writeModeArtifacts(outputDir, run);
      try {
        const result = parseEvalOutput(run.final.output, run.mode);
        modeSummaries.push({
          mode: run.mode,
          finalStatus: run.final.status,
          invocationCount: run.invocations.length,
          durationMs: sumDurations(run.invocations),
          invocations: summarizeInvocations(run.invocations),
          score: scoreEvalResult(pack, result)
        });
      } catch (error) {
        modeSummaries.push({
          mode: run.mode,
          finalStatus: run.final.status,
          invocationCount: run.invocations.length,
          durationMs: sumDurations(run.invocations),
          invocations: summarizeInvocations(run.invocations),
          score: emptyScore(run.mode, pack.cases.length),
          parseError: error instanceof Error ? error.message : String(error)
        });
      }
    }
    worktreeDirty = (await requireGit(evalWorktree, ['status', '--porcelain'])).trim().length > 0;
  } finally {
    const cleanup = await runProcess({ executable: 'git', args: ['worktree', 'remove', '--force', evalWorktree], cwd: repoRoot });
    await runProcess({ executable: 'git', args: ['worktree', 'prune'], cwd: repoRoot });
    await rm(tempRoot, { recursive: true, force: true });
    if (cleanup.status !== 'success') {
      throw new Error(`Eval worktree cleanup failed: ${cleanup.stderr.trim()}`);
    }
  }

  const summary = {
    schemaVersion: 1,
    pack: pack.title,
    packVersion: pack.version,
    caseCount: pack.cases.length,
    gitHead: head,
    providers,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    worktreeDirty,
    worktreeCleanup: 'success',
    modes: modeSummaries
  };
  const report = renderRunReport(pack.title, head, providers, worktreeDirty, modeSummaries);
  await writeFile(join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(join(outputDir, 'report.md'), report, 'utf8');
  const latestDir = join(repoRoot, 'validation', 'eval-pack');
  await mkdir(latestDir, { recursive: true });
  await writeFile(join(latestDir, 'latest-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeFile(join(latestDir, 'latest-report.md'), report, 'utf8');
  console.log(JSON.stringify({ status: 'completed', outputDir, report: join(outputDir, 'report.md'), modes: modeSummaries }, null, 2));
}

function parseArgs(argv: readonly string[]): { workdir?: string; pack?: string; providers?: string; out?: string } {
  const options: { workdir?: string; pack?: string; providers?: string; out?: string } = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (value === undefined || !['--workdir', '--pack', '--providers', '--out'].includes(flag ?? '')) {
      throw new Error('Usage: npm run eval:pack -- [--workdir DIR] [--pack FILE] [--providers codex,claude,grok] [--out DIR]');
    }
    if (flag === '--workdir') options.workdir = value;
    if (flag === '--pack') options.pack = value;
    if (flag === '--providers') options.providers = value;
    if (flag === '--out') options.out = value;
  }
  return options;
}

function parseProviders(value: string): [ProviderName, ProviderName, ProviderName] {
  const providers = value.split(',').map(item => item.trim()).filter(Boolean);
  if (providers.length !== 3 || !providers.every(isProviderName)) {
    throw new Error('Eval Pack requires exactly three supported providers.');
  }
  return providers as [ProviderName, ProviderName, ProviderName];
}

async function requireGit(cwd: string, args: readonly string[]): Promise<string> {
  const result = await runProcess({ executable: 'git', args, cwd });
  if (result.status !== 'success') {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

async function writeModeArtifacts(outputDir: string, run: EvalModeRun): Promise<void> {
  const modeDir = join(outputDir, run.mode);
  await mkdir(modeDir, { recursive: true });
  for (const [index, invocation] of run.invocations.entries()) {
    const prefix = `${String(index + 1).padStart(2, '0')}-${invocation.provider}-${invocation.role}`;
    await writeFile(join(modeDir, `${prefix}-output.md`), invocation.output, 'utf8');
    await writeFile(join(modeDir, `${prefix}-stderr.log`), invocation.stderr, 'utf8');
    await writeFile(join(modeDir, `${prefix}-metadata.json`), `${JSON.stringify({
      provider: invocation.provider,
      role: invocation.role,
      status: invocation.status,
      durationMs: invocation.durationMs
    }, null, 2)}\n`, 'utf8');
  }
}

export function renderRunReport(
  title: string,
  head: string,
  providers: readonly ProviderName[],
  worktreeDirty: boolean,
  summaries: readonly EvalModeSummary[]
): string {
  return [
    renderEvalReport(title, summaries.map(summary => summary.score)).trimEnd(),
    '',
    `- Git HEAD: \`${head}\``,
    `- Providers: ${providers.join(', ')}`,
    `- Temporary worktree changed: ${worktreeDirty ? 'yes' : 'no'}`,
    `- Temporary worktree cleanup: success`,
    '',
    '| mode | final status | calls | cumulative provider duration | parse error |',
    '|---|---|---:|---:|---|',
    ...summaries.map(summary => `| ${summary.mode} | ${summary.finalStatus} | ${summary.invocationCount} | ${summary.durationMs} ms | ${escapeCell(summary.parseError ?? '')} |`),
    '',
    '| mode | provider | role | status | duration |',
    '|---|---|---|---|---:|',
    ...summaries.flatMap(summary => summary.invocations.map(invocation =>
      `| ${summary.mode} | ${invocation.provider} | ${invocation.role} | ${invocation.status} | ${invocation.durationMs} ms |`
    )),
    '',
    'The unstructured mode approximates ad-hoc multi-CLI use with identical prompts; it is not a recording of an interactive Codex conversation.',
    ''
  ].join('\n');
}

function emptyScore(mode: EvalMode, caseCount: number): EvalScore {
  return { mode, caseCount, answeredCount: 0, factScore: 0, evidenceScore: 0, coverageScore: 0, totalScore: 0 };
}

function sumDurations(invocations: readonly EvalInvocationResult[]): number {
  return invocations.reduce((total, invocation) => total + invocation.durationMs, 0);
}

function summarizeInvocations(invocations: readonly EvalInvocationResult[]): EvalInvocationSummary[] {
  return invocations.map(({ provider, role, status, durationMs }) => ({ provider, role, status, durationMs }));
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && pathToFileURL(resolve(invokedPath)).href === import.meta.url) {
  void main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
