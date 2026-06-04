import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { CliError } from './cli-error.js';
import type { ProviderName } from '../providers/index.js';

export type SubtaskWritePolicy = 'readonly' | 'isolated';

export interface SubtaskManifest {
  readonly version: 1;
  readonly parentTask: {
    readonly title: string;
    readonly source?: string | undefined;
  };
  readonly defaults?: {
    readonly role?: string | undefined;
    readonly writePolicy?: SubtaskWritePolicy | undefined;
  } | undefined;
  readonly subtasks: readonly SubtaskDefinition[];
}

export interface SubtaskDefinition {
  readonly id: string;
  readonly title: string;
  readonly role: string;
  readonly provider?: ProviderName | undefined;
  readonly task: string;
  readonly allowedPaths?: readonly string[] | undefined;
  readonly writePolicy: SubtaskWritePolicy;
}

export interface NormalizeTasksDirectoryInput {
  readonly tasksDir: string;
  readonly title?: string | undefined;
  readonly source?: string | undefined;
}

const providerNameSchema = z.enum(['codex', 'claude', 'agy']);
const writePolicySchema = z.enum(['readonly', 'isolated']);

const rawManifestSchema = z.object({
  version: z.literal(1),
  parentTask: z.object({
    title: z.string().min(1),
    source: z.string().min(1).optional()
  }),
  defaults: z.object({
    role: z.string().min(1).optional(),
    writePolicy: writePolicySchema.optional()
  }).optional(),
  subtasks: z.array(z.object({
    id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    role: z.string().min(1).optional(),
    provider: providerNameSchema.optional(),
    task: z.string().min(1),
    allowedPaths: z.array(z.string().min(1)).optional(),
    writePolicy: writePolicySchema.optional()
  })).min(1)
});

/** Parses and normalizes the stable RoleMux subtask manifest contract. */
export function parseSubtaskManifest(value: unknown): SubtaskManifest {
  const raw = rawManifestSchema.parse(value);
  const seen = new Set<string>();
  const defaultRole = raw.defaults?.role ?? 'builder';
  const defaultWritePolicy = raw.defaults?.writePolicy ?? 'readonly';

  const subtasks = raw.subtasks.map(subtask => {
    if (seen.has(subtask.id)) {
      throw new CliError(`Duplicate subtask id: ${subtask.id}`, {
        code: 'SUBTASK_ID_DUPLICATED',
        details: { id: subtask.id }
      });
    }
    seen.add(subtask.id);
    return {
      ...subtask,
      role: subtask.role ?? defaultRole,
      writePolicy: subtask.writePolicy ?? defaultWritePolicy
    };
  });

  return {
    version: raw.version,
    parentTask: raw.parentTask,
    ...(raw.defaults === undefined ? {} : { defaults: raw.defaults }),
    subtasks
  };
}

/** Reads a manifest JSON file and validates it. */
export async function readSubtaskManifest(path: string): Promise<SubtaskManifest> {
  const raw = await readFile(resolve(path), 'utf8');
  return parseSubtaskManifest(JSON.parse(raw));
}

/** Writes a normalized manifest JSON file. */
export async function writeSubtaskManifest(path: string, manifest: SubtaskManifest): Promise<void> {
  await writeFile(resolve(path), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/** Converts a directory of markdown task files into a manifest. */
export async function normalizeTasksDirectory(input: NormalizeTasksDirectoryInput): Promise<SubtaskManifest> {
  const tasksDir = resolve(input.tasksDir);
  const entries = await readdir(tasksDir, { withFileTypes: true });
  const markdownFiles = entries
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name)
    .sort();

  const subtasks = [];
  for (const fileName of markdownFiles) {
    const taskPath = join(tasksDir, fileName);
    const task = await readFile(taskPath, 'utf8');
    const id = toSubtaskId(fileName);
    subtasks.push({
      id,
      title: extractTitle(task) ?? id,
      task
    });
  }

  return parseSubtaskManifest({
    version: 1,
    parentTask: {
      title: input.title ?? basename(tasksDir),
      source: input.source ?? tasksDir
    },
    defaults: {
      role: 'builder',
      writePolicy: 'readonly'
    },
    subtasks
  });
}

function toSubtaskId(fileName: string): string {
  return basename(fileName, '.md')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'subtask';
}

function extractTitle(markdown: string): string | undefined {
  const firstHeading = markdown.split(/\r?\n/).find(line => line.startsWith('# '));
  return firstHeading?.replace(/^#\s+/, '').trim();
}
