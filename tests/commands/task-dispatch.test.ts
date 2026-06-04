import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { dispatchCommand } from '../../src/commands/dispatch.js';
import { manifestValidateCommand } from '../../src/commands/manifest.js';
import { mergeCommand } from '../../src/commands/merge.js';
import { splitCommand } from '../../src/commands/split.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('task dispatch commands', () => {
  test('validates a manifest and reports next commands', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux manifest command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [{ id: 'one', title: 'One', task: 'Do one thing.' }]
    }), 'utf8');

    const result = await manifestValidateCommand({ manifest: manifestPath });

    expect(result.status).toBe('success');
    expect(result.subtaskCount).toBe(1);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('normalizes tasks-dir into a manifest file', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: false
    });

    const raw = await readFile(out, 'utf8');
    const manifest = JSON.parse(raw) as { subtasks: unknown[] };
    expect(result.status).toBe('success');
    expect(result.manifestPath).toBe(out);
    expect(manifest.subtasks).toHaveLength(2);
  });

  test('split dry-run returns the normalized manifest without writing output', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'rolemux split dry output '));
    const out = join(outputDir, 'rolemux-tasks.json');

    const result = await splitCommand({
      tasksDir: 'tests/fixtures/subtasks',
      out,
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.manifest.subtasks).toHaveLength(2);
    await expect(readFile(out, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('dispatch dry-run assigns subtasks to workers', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rolemux dispatch command '));
    const manifestPath = join(dir, 'rolemux-tasks.json');
    await writeFile(manifestPath, JSON.stringify({
      version: 1,
      parentTask: { title: 'Dispatch work' },
      subtasks: [
        { id: 'one', title: 'One', task: 'Do one thing.' },
        { id: 'two', title: 'Two', task: 'Do another thing.' },
        { id: 'three', title: 'Three', provider: 'agy', task: 'Use fixed provider.' }
      ]
    }), 'utf8');

    const result = await dispatchCommand({
      manifest: manifestPath,
      providers: 'codex:2,claude:1',
      dryRun: true
    });

    expect(result.status).toBe('dry-run');
    expect(result.assignments.map(assignment => assignment.provider)).toEqual(['codex', 'codex', 'agy']);
    expect(result.nextCommands[0]).toContain('rolemux dispatch');
  });

  test('dispatch executes readonly subtasks and writes nested artifacts', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/mock-provider.mjs');

    try {
      const workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch real '));
      const manifestPath = join(workdir, 'rolemux-tasks.json');
      await writeFile(manifestPath, JSON.stringify({
        version: 1,
        parentTask: { title: 'Dispatch real work' },
        subtasks: [
          { id: 'one', title: 'One', task: 'Do one thing.', writePolicy: 'readonly' }
        ]
      }), 'utf8');

      const result = await dispatchCommand({
        manifest: manifestPath,
        providers: 'codex:1',
        workdir,
        dryRun: false
      });

      expect(result.status).toBe('success');
      expect(result.parentTaskId).toBeDefined();
      expect(result.artifactDir).toContain('.rolemux');

      const output = await readFile(join(result.artifactDir ?? '', 'subtasks', 'one', 'output.md'), 'utf8');
      expect(output).toContain('MOCK_PROVIDER_OUTPUT');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('dispatch executes isolated subtasks in git worktrees and collects diff', async () => {
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgsPrefix = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/write-file-provider.mjs');

    const workdir = await mkdtemp(join(tmpdir(), 'rolemux dispatch isolated '));
    await initRepo(workdir);

    try {
      const manifestPath = join(workdir, 'rolemux-tasks.json');
      await writeFile(manifestPath, JSON.stringify({
        version: 1,
        parentTask: { title: 'Dispatch isolated work' },
        subtasks: [
          { id: 'write-code', title: 'Write code', task: 'Modify files.', writePolicy: 'isolated' }
        ]
      }), 'utf8');

      const result = await dispatchCommand({
        manifest: manifestPath,
        providers: 'codex:1',
        workdir,
        dryRun: false
      });

      expect(result.status).toBe('success');
      expect(result.artifactDir).toBeDefined();

      const subtaskDir = join(result.artifactDir ?? '', 'subtasks', 'write-code');
      const diff = await readFile(join(subtaskDir, 'diff.patch'), 'utf8');
      const worktreePath = await readFile(join(subtaskDir, 'worktree.txt'), 'utf8');
      const output = await readFile(join(subtaskDir, 'output.md'), 'utf8');

      expect(diff).toContain('worker-output.txt');
      expect(diff).toContain('created by isolated worker');
      expect(worktreePath).toContain(join('.rolemux', 'worktrees'));
      expect(output).toContain('WRITE_FILE_PROVIDER_OUTPUT');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgsPrefix);
    }
  });

  test('merge dry-run previews real patch artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge command '));
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    const result = await mergeCommand({
      parentTask: 'parent',
      workdir,
      dryRun: true,
      autoMerge: false
    });

    expect(result.status).toBe('dry-run');
    expect(result.patches).toHaveLength(1);
    expect(result.patches[0]?.files).toEqual(['feature.txt']);
    expect(result.requiresUserAction).toBe(true);
    expect(result.nextCommands[0]).toContain('--auto-merge');
  });

  test('merge auto-merge applies clean patch artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge auto '));
    await initRepo(workdir);
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    const result = await mergeCommand({
      parentTask: 'parent',
      workdir,
      dryRun: false,
      autoMerge: true
    });

    expect(result.status).toBe('success');
    expect(result.requiresUserAction).toBe(false);
    expect(await readFile(join(workdir, 'feature.txt'), 'utf8')).toContain('created by merge');
  });
});

function restoreEnv(name: string, oldValue: string | undefined): void {
  if (oldValue === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = oldValue;
}

async function initRepo(repo: string): Promise<void> {
  await runProcess({ executable: 'git', args: ['init'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.email', 'rolemux@example.invalid'], cwd: repo });
  await runProcess({ executable: 'git', args: ['config', 'user.name', 'RoleMux Test'], cwd: repo });
  await writeFile(join(repo, 'README.md'), 'baseline\n', 'utf8');
  await runProcess({ executable: 'git', args: ['add', 'README.md'], cwd: repo });
  await runProcess({ executable: 'git', args: ['commit', '-m', 'baseline'], cwd: repo });
}

async function writePatchArtifact(workdir: string, parentTaskId: string, subtaskId: string, patch: string): Promise<void> {
  const subtaskDir = join(workdir, '.rolemux', 'tasks', parentTaskId, 'subtasks', subtaskId);
  await mkdir(subtaskDir, { recursive: true });
  await writeFile(join(subtaskDir, 'diff.patch'), patch, 'utf8');
}

function featurePatch(): string {
  return [
    'diff --git a/feature.txt b/feature.txt',
    'new file mode 100644',
    'index 0000000..f0b582a',
    '--- /dev/null',
    '+++ b/feature.txt',
    '@@ -0,0 +1 @@',
    '+created by merge',
    ''
  ].join('\n');
}
