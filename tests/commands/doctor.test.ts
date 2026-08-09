import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, test } from 'vitest';
import { doctorCommand } from '../../src/commands/doctor.js';

describe('doctor command', () => {
  test('reports provider executable status without failing on missing providers', async () => {
    const binDir = await mkdtemp(join(tmpdir(), 'rolemux doctor bin '));
    const executablePath = join(binDir, process.platform === 'win32' ? 'codex.cmd' : 'codex');
    await writeFile(executablePath, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    if (process.platform !== 'win32') {
      await chmod(executablePath, 0o755);
    }

    const result = await doctorCommand({
      pathEnv: binDir,
      providers: ['codex', 'claude']
    });

    expect(result.providers.codex.available).toBe(true);
    expect(result.providers.codex.nativeAgentEvents).toBe(false);
    expect(result.providers.claude.available).toBe(false);
    expect(result.providers.claude.nativeAgentEvents).toBe(true);
    expect(result.ok).toBe(false);
  });

  test('ok reflects only requested providers', async () => {
    const binDir = await mkdtemp(join(tmpdir(), 'rolemux doctor requested bin '));
    const executablePath = join(binDir, process.platform === 'win32' ? 'codex.cmd' : 'codex');
    await writeFile(executablePath, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    if (process.platform !== 'win32') {
      await chmod(executablePath, 0o755);
    }

    const result = await doctorCommand({
      pathEnv: binDir,
      providers: ['codex']
    });

    expect(result.ok).toBe(true);
    expect(result.providers.claude.available).toBe(false);
  });

  test('checks Grok Build when requested', async () => {
    const binDir = await mkdtemp(join(tmpdir(), 'rolemux doctor grok bin '));
    const executablePath = join(binDir, process.platform === 'win32' ? 'grok.exe' : 'grok');
    await writeFile(executablePath, process.platform === 'win32' ? '' : '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    if (process.platform !== 'win32') {
      await chmod(executablePath, 0o755);
    }

    const result = await doctorCommand({
      pathEnv: binDir,
      providers: ['grok']
    });

    expect(result.ok).toBe(true);
    expect(result.providers.grok.available).toBe(true);
  });

  test('checks OpenCode when requested', async () => {
    const binDir = await mkdtemp(join(tmpdir(), 'rolemux doctor opencode bin '));
    const executablePath = join(binDir, process.platform === 'win32' ? 'opencode.cmd' : 'opencode');
    await writeFile(executablePath, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    if (process.platform === 'win32') {
      await writeFile(join(binDir, 'opencode'), '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    }
    if (process.platform !== 'win32') {
      await chmod(executablePath, 0o755);
    }

    const result = await doctorCommand({
      pathEnv: binDir,
      providers: ['opencode']
    });

    expect(result.ok).toBe(true);
    expect(result.providers.opencode.available).toBe(true);
    expect(result.providers.opencode.executable).toBe(executablePath);
  });

  test.each([
    ['passed', 'passed', undefined],
    ['auth', 'failed', 'auth'],
    ['network', 'failed', 'network'],
    ['output', 'failed', 'output'],
    ['timeout', 'timeout', 'timeout']
  ] as const)('deep probe classifies %s results', async (mode, status, category) => {
    const binDir = await mkdtemp(join(tmpdir(), 'rolemux doctor probe bin '));
    const executablePath = join(binDir, process.platform === 'win32' ? 'codex.cmd' : 'codex');
    const oldCommand = process.env.ROLEMUX_PROVIDER_CODEX_COMMAND;
    const oldArgs = process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX;
    const oldMode = process.env.ROLEMUX_PROBE_FIXTURE_MODE;
    await writeFile(executablePath, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/usr/bin/env sh\nexit 0\n', 'utf8');
    if (process.platform !== 'win32') {
      await chmod(executablePath, 0o755);
    }
    process.env.ROLEMUX_PROVIDER_CODEX_COMMAND = process.execPath;
    process.env.ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX = resolve('tests/fixtures/provider-probe.mjs');
    process.env.ROLEMUX_PROBE_FIXTURE_MODE = mode;

    try {
      const result = await doctorCommand({
        pathEnv: binDir,
        providers: ['codex'],
        probe: true,
        probeTimeoutMs: mode === 'timeout' ? 100 : 1000
      });

      expect(result.providers.codex.probe).toMatchObject({
        status,
        ...(category === undefined ? {} : { category })
      });
      expect(result.ok).toBe(status === 'passed');
    } finally {
      restoreEnv('ROLEMUX_PROVIDER_CODEX_COMMAND', oldCommand);
      restoreEnv('ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX', oldArgs);
      restoreEnv('ROLEMUX_PROBE_FIXTURE_MODE', oldMode);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
