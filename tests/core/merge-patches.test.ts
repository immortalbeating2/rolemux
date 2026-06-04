import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { applyMergePatches, loadMergePreview } from '../../src/core/merge-patches.js';
import { runProcess } from '../../src/core/process-runner.js';

describe('merge patch artifacts', () => {
  test('loads patch previews from parent task artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge preview '));
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    const preview = await loadMergePreview({ workdir, parentTaskId: 'parent' });

    expect(preview.parentTaskId).toBe('parent');
    expect(preview.patches).toHaveLength(1);
    expect(preview.patches[0]?.subtaskId).toBe('one');
    expect(preview.patches[0]?.files).toEqual(['feature.txt']);
    expect(preview.patches[0]?.lineCount).toBeGreaterThan(0);
    expect(preview.warnings).toEqual([]);
  });

  test('loads only selected subtask patch previews', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge selected preview '));
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());
    await writePatchArtifact(workdir, 'parent', 'two', anotherPatch());

    const preview = await loadMergePreview({
      workdir,
      parentTaskId: 'parent',
      subtasks: ['two']
    });

    expect(preview.patches.map(patch => patch.subtaskId)).toEqual(['two']);
    expect(preview.patches[0]?.files).toEqual(['another.txt']);
  });

  test('rejects selected subtasks that do not have patch artifacts', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge missing selected preview '));
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    await expect(loadMergePreview({
      workdir,
      parentTaskId: 'parent',
      subtasks: ['missing']
    })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  test('applies clean patches to the target git workdir', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge apply '));
    await initRepo(workdir);
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    const result = await applyMergePatches({ workdir, parentTaskId: 'parent' });

    expect(result.status).toBe('success');
    expect(existsSync(join(workdir, 'feature.txt'))).toBe(true);
    const feature = await readFile(join(workdir, 'feature.txt'), 'utf8');
    expect(feature.replace(/\r\n/g, '\n')).toBe('created by merge\n');
  });

  test('rejects conflicting patches before applying them', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge conflict '));
    await initRepo(workdir);
    await writeFile(join(workdir, 'feature.txt'), 'already exists\n', 'utf8');
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());

    await expect(applyMergePatches({ workdir, parentTaskId: 'parent' })).rejects.toMatchObject({ code: 'MERGE_CONFLICT' });
  });

  test('checks all patches together before applying any patch', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux merge batch conflict '));
    await initRepo(workdir);
    await writePatchArtifact(workdir, 'parent', 'one', featurePatch());
    await writePatchArtifact(workdir, 'parent', 'two', featurePatch());

    await expect(applyMergePatches({ workdir, parentTaskId: 'parent' })).rejects.toMatchObject({ code: 'MERGE_CONFLICT' });
    expect(existsSync(join(workdir, 'feature.txt'))).toBe(false);
  });
});

async function initRepo(workdir: string): Promise<void> {
  await runProcess({ executable: 'git', args: ['init'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['config', 'user.email', 'rolemux@example.invalid'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['config', 'user.name', 'RoleMux Test'], cwd: workdir });
  await writeFile(join(workdir, 'README.md'), 'baseline\n', 'utf8');
  await runProcess({ executable: 'git', args: ['add', 'README.md'], cwd: workdir });
  await runProcess({ executable: 'git', args: ['commit', '-m', 'baseline'], cwd: workdir });
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

function anotherPatch(): string {
  return [
    'diff --git a/another.txt b/another.txt',
    'new file mode 100644',
    'index 0000000..f0b582a',
    '--- /dev/null',
    '+++ b/another.txt',
    '@@ -0,0 +1 @@',
    '+created by selected merge',
    ''
  ].join('\n');
}
