import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test, vi } from 'vitest';
import { discussCommand } from '../../src/commands/discuss.js';
import { createCli } from '../../src/cli.js';
import { planCommand } from '../../src/commands/plan.js';
import { reviewCommand } from '../../src/commands/review.js';

describe('workflow commands', () => {
  test('plan, review, and discuss support dry-run', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Design the runner.', 'utf8');

    const plan = await planCommand({ providers: ['codex', 'claude'], task, workdir, dryRun: true });
    const review = await reviewCommand({ provider: 'codex', task, workdir, dryRun: true });
    const discuss = await discussCommand({ providers: ['codex', 'claude', 'agy', 'grok', 'opencode'], task, workdir, mode: 'parallel', dryRun: true });

    expect(plan.status).toBe('dry-run');
    expect(plan.previews).toHaveLength(2);
    expect(review.status).toBe('dry-run');
    expect(discuss.status).toBe('dry-run');
    expect(discuss.previews).toHaveLength(5);
    expect(discuss.previews?.at(-1)?.provider).toBe('opencode');
  });

  test('discuss rejects invalid mode values', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow invalid '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Discuss the runner.', 'utf8');

    await expect(discussCommand({
      providers: ['codex'],
      task,
      workdir,
      mode: 'invalid' as 'parallel',
      dryRun: true
    })).rejects.toThrow('Invalid discuss mode');
  });

  test('plan and review can opt into the shared structured result contract', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux workflow result '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Review the runner.', 'utf8');

    const plan = await planCommand({ providers: ['codex'], task, workdir, dryRun: true, structuredResult: true });
    const review = await reviewCommand({ provider: 'codex', task, workdir, dryRun: true, structuredResult: true });

    expect(plan.previews?.[0]?.stdin).toContain('# Output Requirements');
    expect(review.preview?.stdin).toContain('# Output Requirements');
  });

  test('structured discussion isolates candidates then challenges, verifies, and synthesizes evidence', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux structured discuss '));
    const task = join(workdir, 'task.md');
    const logPath = join(workdir, 'stage-prompts.jsonl');
    const manifest = join(workdir, 'verification.json');
    const providerFixture = resolve('tests/fixtures/workflow-stage-provider.mjs');
    const verificationFixture = resolve('tests/fixtures/verification-command.mjs');
    await writeFile(task, 'Assess the shared fixture.', 'utf8');
    await writeFile(manifest, JSON.stringify({
      version: 1,
      commands: [{ name: 'fixture-check', executable: process.execPath, args: [verificationFixture, 'verified'] }]
    }), 'utf8');
    const overrides = {
      ROLEMUX_WORKFLOW_STAGE_LOG: logPath,
      ROLEMUX_PROVIDER_CODEX_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX: `${providerFixture};codex`,
      ROLEMUX_PROVIDER_CLAUDE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_CLAUDE_ARGS_PREFIX: `${providerFixture};claude`,
      ROLEMUX_PROVIDER_GROK_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_GROK_ARGS_PREFIX: `${providerFixture};grok`,
      ROLEMUX_PROVIDER_OPENCODE_COMMAND: process.execPath,
      ROLEMUX_PROVIDER_OPENCODE_ARGS_PREFIX: `${providerFixture};opencode`
    };
    const oldValues = new Map<string, string | undefined>();
    for (const [name, value] of Object.entries(overrides)) {
      oldValues.set(name, process.env[name]);
      process.env[name] = value;
    }

    try {
      const result = await discussCommand({
        providers: ['codex', 'claude'],
        counterReviewer: 'grok',
        summarizer: 'opencode',
        task,
        workdir,
        mode: 'structured',
        verificationManifest: manifest
      });
      const prompts = (await readFile(logPath, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));
      const candidates = prompts.filter(entry => entry.stage === 'candidate');
      const counter = prompts.find(entry => entry.stage === 'counter');
      const synthesis = prompts.find(entry => entry.stage === 'synthesis');

      expect(result.status).toBe('success');
      expect(result.mode).toBe('structured');
      expect(result.stages?.filter(stage => stage.stage === 'candidate')).toHaveLength(2);
      expect(result.verification).toEqual([expect.objectContaining({ name: 'fixture-check', status: 'passed' })]);
      expect(candidates).toHaveLength(2);
      expect(candidates.every(entry => !entry.prompt.includes('Candidate 1'))).toBe(true);
      expect(counter.prompt).toContain('Candidate 1');
      expect(counter.prompt).toContain('Candidate 2');
      expect(counter.prompt).not.toContain('codex');
      expect(counter.prompt).not.toContain('claude');
      expect(synthesis.prompt).toContain('Counter-review evidence');
      expect(synthesis.prompt).toContain('fixture-check');
      const finalStage = result.stages?.find(stage => stage.stage === 'synthesis');
      const finalResult = JSON.parse(await readFile(
        join(workdir, '.rolemux', 'tasks', finalStage?.taskId ?? 'missing', 'result.json'),
        'utf8'
      ));
      expect(finalResult.schemaVersion).toBe(1);
      expect(finalResult.verification).toEqual([expect.objectContaining({ name: 'fixture-check', status: 'passed' })]);
    } finally {
      for (const [name, value] of oldValues) {
        restoreEnv(name, value);
      }
    }
  });

  test('exposes structured discussion controls through the CLI', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux structured discuss cli '));
    const task = join(workdir, 'task.md');
    const manifest = join(workdir, 'verification.json');
    await writeFile(task, 'Preview structured evidence.', 'utf8');
    await writeFile(manifest, JSON.stringify({
      version: 1,
      commands: [{ name: 'preview', executable: process.execPath, args: ['--version'] }]
    }), 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await createCli().parseAsync([
        'node', 'rolemux', 'discuss', '--providers', 'codex,claude', '--task', task,
        '--workdir', workdir, '--mode', 'structured', '--counter-reviewer', 'grok',
        '--summarizer', 'opencode', '--verification-manifest', manifest, '--dry-run'
      ]);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result.mode).toBe('structured');
      expect(result.previews).toHaveLength(4);
    } finally {
      log.mockRestore();
    }
  });

  test('rejects shell-string verification manifests before starting providers', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux invalid verification manifest '));
    const task = join(workdir, 'task.md');
    const manifest = join(workdir, 'verification.json');
    const logPath = join(workdir, 'stage-prompts.jsonl');
    const providerFixture = resolve('tests/fixtures/workflow-stage-provider.mjs');
    await writeFile(task, 'Do not execute an invalid manifest.', 'utf8');
    await writeFile(manifest, JSON.stringify({
      version: 1,
      commands: [{ name: 'unsafe', command: 'npm test' }]
    }), 'utf8');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgs = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    const oldLog = process.env.ROLEMUX_WORKFLOW_STAGE_LOG;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = `${providerFixture};codex`;
    process.env.ROLEMUX_WORKFLOW_STAGE_LOG = logPath;

    try {
      await expect(discussCommand({
        providers: ['codex'],
        task,
        workdir,
        mode: 'structured',
        verificationManifest: manifest
      })).rejects.toThrow();
      await expect(readFile(logPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgs);
      restoreEnv('ROLEMUX_WORKFLOW_STAGE_LOG', oldLog);
    }
  });

  test('structured discussion routes only when providers are not explicit', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux routed discuss '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Route this research task.', 'utf8');

    const routed = await discussCommand({
      task,
      workdir,
      mode: 'structured',
      taskKind: 'research',
      availableProviders: ['codex', 'grok', 'opencode'],
      maxProviders: 1,
      dryRun: true
    });
    const explicit = await discussCommand({
      providers: ['opencode'],
      task,
      workdir,
      mode: 'structured',
      taskKind: 'research',
      availableProviders: ['grok'],
      maxProviders: 1,
      dryRun: true
    });

    expect(routed.routing?.selected).toEqual(['grok']);
    expect(routed.previews?.every(preview => preview.provider === 'grok')).toBe(true);
    expect(explicit.routing).toBeUndefined();
    expect(explicit.previews?.every(preview => preview.provider === 'opencode')).toBe(true);
  });

  test('stops before verification and synthesis when counter-review fails', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux counter stop '));
    const task = join(workdir, 'task.md');
    const logPath = join(workdir, 'stage-prompts.jsonl');
    const providerFixture = resolve('tests/fixtures/workflow-stage-provider.mjs');
    await writeFile(task, 'Stop after failed counter-review.', 'utf8');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgs = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    const oldLog = process.env.ROLEMUX_WORKFLOW_STAGE_LOG;
    const oldFailStage = process.env.ROLEMUX_WORKFLOW_FAIL_STAGE;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = `${providerFixture};codex`;
    process.env.ROLEMUX_WORKFLOW_STAGE_LOG = logPath;
    process.env.ROLEMUX_WORKFLOW_FAIL_STAGE = 'counter';

    try {
      const result = await discussCommand({ providers: ['codex'], task, workdir, mode: 'structured' });
      const prompts = (await readFile(logPath, 'utf8')).trim().split(/\r?\n/).map(line => JSON.parse(line));

      expect(result.status).toBe('failed');
      expect(result.stages?.map(stage => stage.stage)).toEqual(['candidate', 'counter']);
      expect(result.verification).toBeUndefined();
      expect(prompts.map(entry => entry.stage)).toEqual(['candidate', 'counter']);
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgs);
      restoreEnv('ROLEMUX_WORKFLOW_STAGE_LOG', oldLog);
      restoreEnv('ROLEMUX_WORKFLOW_FAIL_STAGE', oldFailStage);
    }
  });

  test('marks verification not-run when structured discussion has no manifest', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux verification not run '));
    const task = join(workdir, 'task.md');
    const logPath = join(workdir, 'stage-prompts.jsonl');
    const providerFixture = resolve('tests/fixtures/workflow-stage-provider.mjs');
    await writeFile(task, 'Synthesize without deterministic checks.', 'utf8');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgs = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    const oldLog = process.env.ROLEMUX_WORKFLOW_STAGE_LOG;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = `${providerFixture};codex`;
    process.env.ROLEMUX_WORKFLOW_STAGE_LOG = logPath;

    try {
      const result = await discussCommand({ providers: ['codex'], task, workdir, mode: 'structured' });
      const verification = result.stages?.find(stage => stage.stage === 'verification');

      expect(result.status).toBe('success');
      expect(verification).toEqual({ stage: 'verification', status: 'not-run' });
      expect(result.verification).toEqual([]);
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgs);
      restoreEnv('ROLEMUX_WORKFLOW_STAGE_LOG', oldLog);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
