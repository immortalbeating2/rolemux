import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { buildContextPack } from '../../src/core/context-pack.js';

describe('context pack', () => {
  test('reads only allowlisted safe files under the workdir', async () => {
    const workdir = await mkdtemp(join(tmpdir(), 'rolemux context pack '));
    await mkdir(join(workdir, 'src'), { recursive: true });
    await writeFile(join(workdir, 'src', 'target.ts'), 'export const expected = "CONTEXT_OK";\n', 'utf8');
    await writeFile(join(workdir, '.env'), 'SECRET_TOKEN=hidden\n', 'utf8');

    const pack = await buildContextPack({
      workdir,
      allowedPaths: ['src/target.ts', '.env', '../outside.txt']
    });

    expect(pack.includedPaths).toEqual(['src/target.ts']);
    expect(pack.skippedPaths).toEqual([
      { path: '.env', reason: 'sensitive-path' },
      { path: '../outside.txt', reason: 'outside-workdir' }
    ]);
    expect(pack.context.join('\n')).toContain('CONTEXT_OK');
    expect(pack.context.join('\n')).not.toContain('SECRET_TOKEN');
  });
});
