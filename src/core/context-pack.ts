import { readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

export interface ContextPackInput {
  readonly workdir: string;
  readonly allowedPaths: readonly string[];
  readonly maxBytesPerFile?: number | undefined;
}

export interface ContextPackSkippedPath {
  readonly path: string;
  readonly reason: 'outside-workdir' | 'sensitive-path' | 'not-file' | 'read-error';
}

export interface ContextPackResult {
  readonly context: readonly string[];
  readonly includedPaths: readonly string[];
  readonly skippedPaths: readonly ContextPackSkippedPath[];
}

const defaultMaxBytesPerFile = 16 * 1024;
const sensitiveBasenames = new Set(['.env', '.env.local', '.env.production', '.npmrc']);
const sensitivePattern = /(?:^|[/\\])(?:token|secret|cookie|credential|password)(?:[/\\.]|$)/i;

/** Builds a prompt context pack from explicit allowlisted project files. */
export async function buildContextPack(input: ContextPackInput): Promise<ContextPackResult> {
  const workdir = resolve(input.workdir);
  const maxBytes = input.maxBytesPerFile ?? defaultMaxBytesPerFile;
  const context: string[] = [];
  const includedPaths: string[] = [];
  const skippedPaths: ContextPackSkippedPath[] = [];

  for (const requestedPath of input.allowedPaths) {
    const normalizedPath = requestedPath.replace(/\\/g, '/');
    if (isSensitivePath(normalizedPath)) {
      skippedPaths.push({ path: requestedPath, reason: 'sensitive-path' });
      continue;
    }

    const absolutePath = resolve(workdir, requestedPath);
    const relativePath = relative(workdir, absolutePath);
    if (relativePath.startsWith('..') || relativePath === '' || relativePath.includes(`..${sep}`) || isDriveRelative(relativePath)) {
      skippedPaths.push({ path: requestedPath, reason: 'outside-workdir' });
      continue;
    }

    try {
      const info = await stat(absolutePath);
      if (!info.isFile()) {
        skippedPaths.push({ path: requestedPath, reason: 'not-file' });
        continue;
      }

      const data = await readFile(absolutePath);
      const sliced = data.subarray(0, maxBytes);
      const truncated = data.length > maxBytes;
      const text = sliced.toString('utf8');
      context.push(renderContextFile(relativePath.replace(/\\/g, '/'), text, truncated));
      includedPaths.push(relativePath.replace(/\\/g, '/'));
    } catch {
      skippedPaths.push({ path: requestedPath, reason: 'read-error' });
    }
  }

  if (context.length > 0) {
    context.unshift([
      'RoleMux context-pack: use only the file contents below for local file context.',
      'Do not call local file-reading tools unless the user explicitly asks for additional files.'
    ].join('\n'));
  }

  return { context, includedPaths, skippedPaths };
}

function renderContextFile(path: string, text: string, truncated: boolean): string {
  const suffix = truncated ? '\n[RoleMux context-pack: file truncated]' : '';
  return `--- ${path} ---\n${text.trimEnd()}${suffix}`;
}

function isSensitivePath(path: string): boolean {
  const basename = path.split('/').at(-1)?.toLowerCase() ?? '';
  return sensitiveBasenames.has(basename) || sensitivePattern.test(path);
}

function isDriveRelative(path: string): boolean {
  return /^[a-z]:/i.test(path);
}
