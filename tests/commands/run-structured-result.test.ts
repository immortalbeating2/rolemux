import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test, vi } from 'vitest';
import { runCommand } from '../../src/commands/run.js';
import { createCli } from '../../src/cli.js';

describe('run structured result', () => {
  test('writes result.json and reproducible provenance when explicitly requested', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux structured result '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Review the fixture.', 'utf8');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/structured-result-provider.mjs');

    try {
      const run = await runCommand({
        provider: 'codex',
        role: 'reviewer',
        task,
        workdir,
        structuredResult: true
      });
      const taskDir = join(workdir, '.rolemux', 'tasks', run.taskId ?? 'missing');
      const result = JSON.parse(await readFile(join(taskDir, 'result.json'), 'utf8'));
      const metadata = JSON.parse(await readFile(join(taskDir, 'metadata.json'), 'utf8'));

      expect(run.status).toBe('success');
      expect(result.findings[0].claim).toBe('A verified fixture finding.');
      expect(metadata.artifacts.result).toBe('result.json');
      expect(metadata.provenance).toMatchObject({
        providerExecutable: process.execPath,
        model: { resolved: null, source: 'not-reported' }
      });
      expect(metadata.provenance.promptSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(metadata.provenance.executionConfigSha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('exposes the structured result contract through run --result-json dry-run', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux structured result cli '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Review the fixture.', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await createCli().parseAsync([
        'node', 'rolemux', 'run', '--provider', 'codex', '--role', 'reviewer',
        '--task', task, '--workdir', workdir, '--result-json', '--dry-run'
      ]);
      const result = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      expect(result.status).toBe('dry-run');
      expect(result.command.stdin).toContain('# Output Requirements');
      expect(result.command.stdin).toContain('"schemaVersion":1');
    } finally {
      log.mockRestore();
    }
  });

  test('exposes --result-json on plan and review', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux structured workflow cli '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Review the fixture.', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await createCli().parseAsync(['node', 'rolemux', 'plan', '--providers', 'codex', '--task', task, '--workdir', workdir, '--result-json', '--dry-run']);
      const plan = JSON.parse(String(log.mock.calls.at(-1)?.[0]));
      await createCli().parseAsync(['node', 'rolemux', 'review', '--provider', 'codex', '--task', task, '--workdir', workdir, '--result-json', '--dry-run']);
      const review = JSON.parse(String(log.mock.calls.at(-1)?.[0]));

      expect(plan.previews[0].stdin).toContain('# Output Requirements');
      expect(review.preview.stdin).toContain('# Output Requirements');
    } finally {
      log.mockRestore();
    }
  });

  test('exposes run budgets through CLI flags', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux run budget cli '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Preview a budgeted run.', 'utf8');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      await createCli().parseAsync([
        'node', 'rolemux', 'run', '--provider', 'codex', '--role', 'reviewer',
        '--task', task, '--workdir', workdir, '--max-attempts', '1', '--timeout-ms', '5000', '--dry-run'
      ]);
      expect(JSON.parse(String(log.mock.calls.at(-1)?.[0])).status).toBe('dry-run');
    } finally {
      log.mockRestore();
    }
  });

  test('preserves raw output and fails when the structured contract is invalid', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux invalid structured result '));
    const task = join(workdir, 'task.md');
    await writeFile(task, 'Return invalid structured output.', 'utf8');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/mock-provider.mjs');

    try {
      const run = await runCommand({ provider: 'codex', role: 'reviewer', task, workdir, structuredResult: true });
      const taskDir = join(workdir, '.rolemux', 'tasks', run.taskId ?? 'missing');
      const metadata = JSON.parse(await readFile(join(taskDir, 'metadata.json'), 'utf8'));
      const output = await readFile(join(taskDir, 'output.md'), 'utf8');
      const stderr = await readFile(join(taskDir, 'stderr.log'), 'utf8');

      expect(run.status).toBe('failed');
      expect(output).toContain('MOCK_PROVIDER_OUTPUT');
      expect(stderr).toContain('Structured result validation failed');
      expect(metadata.artifacts.result).toBeUndefined();
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
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
