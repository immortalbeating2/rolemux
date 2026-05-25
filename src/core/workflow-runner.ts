import { getProviderAdapter } from '../providers/index.js';
import { ProviderName, ProviderCommand } from '../providers/provider.js';
import { buildPrompt } from './prompt-builder.js';
import { runProcess } from './process-runner.js';
import { loadRolePrompt } from './role-loader.js';

/** Single workflow run request. */
export interface WorkflowRunInput {
  readonly provider: ProviderName;
  readonly role: string;
  readonly task: string;
  readonly workdir: string;
  readonly dryRun?: boolean;
  readonly timeoutMs?: number;
}

/** Workflow runner result used by command modules. */
export interface WorkflowRunResult {
  readonly status: 'dry-run' | 'success' | 'failed' | 'timeout';
  readonly provider: ProviderName;
  readonly role: string;
  readonly prompt: string;
  readonly command: ProviderCommand;
  readonly output: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

/** Runs one provider workflow or returns a dry-run preview. */
export async function runWorkflow(input: WorkflowRunInput): Promise<WorkflowRunResult> {
  const rolePrompt = await loadRolePrompt({ role: input.role, workdir: input.workdir });
  const prompt = buildPrompt({
    role: input.role,
    task: input.task,
    ...(rolePrompt === undefined ? {} : { rolePrompt })
  });
  const adapter = getProviderAdapter(input.provider);
  const command = adapter.buildCommand({ prompt, workdir: input.workdir, role: input.role });

  if (input.dryRun) {
    return {
      status: 'dry-run',
      provider: input.provider,
      role: input.role,
      prompt,
      command,
      output: '',
      stderr: '',
      exitCode: null
    };
  }

  const processInput = {
    executable: command.executable,
    args: command.args,
    ...(command.cwd !== undefined ? { cwd: command.cwd } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {})
  };
  const processResult = await runProcess(processInput);

  return {
    status: processResult.status,
    provider: input.provider,
    role: input.role,
    prompt,
    command,
    output: processResult.stdout,
    stderr: processResult.stderr,
    exitCode: processResult.exitCode
  };
}
