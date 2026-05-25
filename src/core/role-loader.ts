import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Options used to resolve a role prompt by name. */
export interface LoadRolePromptOptions {
  readonly role: string;
  readonly workdir: string;
}

/** Loads a role prompt from project roles, package roles, or installed user roles. */
export async function loadRolePrompt(options: LoadRolePromptOptions): Promise<string | undefined> {
  const roleFileName = `${options.role}.md`;
  const candidates = [
    join(resolve(options.workdir), 'roles', roleFileName),
    join(process.cwd(), 'roles', roleFileName),
    join(findPackageRoot(), 'roles', roleFileName),
    join(process.env.HOME ?? process.env.USERPROFILE ?? '', '.rolemux', 'roles', roleFileName)
  ].filter(candidate => candidate.length > 0);

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // Missing role files are allowed; the prompt still includes the role name.
    }
  }

  return undefined;
}

function findPackageRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFile), '..', '..');
}
