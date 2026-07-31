import { access } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { constants } from 'node:fs';

/** Result returned by executable lookup. */
export interface FindExecutableResult {
  readonly name: string;
  readonly available: boolean;
  readonly path?: string | undefined;
}

/** Options for PATH-based executable lookup. */
export interface FindExecutableOptions {
  readonly pathEnv?: string;
  readonly platform?: NodeJS.Platform;
}

/** Finds an executable in PATH without invoking a shell. */
export async function findExecutable(name: string, options: FindExecutableOptions = {}): Promise<FindExecutableResult> {
  const platform = options.platform ?? process.platform;
  const pathEnv = options.pathEnv ?? process.env.PATH ?? '';
  const pathParts = pathEnv.split(delimiter).filter(part => part.length > 0);
  const candidates = executableCandidates(name, platform);

  for (const directory of pathParts) {
    for (const candidate of candidates) {
      const fullPath = join(directory, candidate);
      if (await canExecute(fullPath)) {
        return { name, available: true, path: fullPath };
      }
    }
  }

  return { name, available: false };
}

function executableCandidates(name: string, platform: NodeJS.Platform): string[] {
  if (platform !== 'win32' || /\.[a-z0-9]+$/i.test(name)) {
    return [name];
  }

  const extensions = (process.env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM')
    .split(';')
    .filter(extension => extension.length > 0);
  // Windows CreateProcess only resolves executable extensions from PATHEXT;
  // npm's extensionless POSIX shim may coexist with the runnable .cmd file.
  return extensions.map(extension => `${name}${extension.toLowerCase()}`);
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
