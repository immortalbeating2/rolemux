import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { agentsCommand } from './commands/agents.js';
import { cancelCommand } from './commands/cancel.js';
import { runAgentsTuiSession } from './core/agents-tui.js';
import { cleanCommand } from './commands/clean.js';
import { discussCommand } from './commands/discuss.js';
import { dispatchCommand } from './commands/dispatch.js';
import { dispatchResumeCommand } from './commands/dispatch-resume.js';
import { doctorCommand } from './commands/doctor.js';
import { installCommand } from './commands/install.js';
import { manifestValidateCommand } from './commands/manifest.js';
import { mergeCommand } from './commands/merge.js';
import { planCommand } from './commands/plan.js';
import { reviewCommand } from './commands/review.js';
import { routeCommand } from './commands/route.js';
import { runCommand } from './commands/run.js';
import { splitCommand } from './commands/split.js';
import { statusCommand } from './commands/status.js';
import { uninstallCommand } from './commands/uninstall.js';
import { isProviderName, type ProviderName } from './providers/index.js';
import { worktreeCleanupCommand } from './commands/worktree.js';
import { CliError } from './core/cli-error.js';

/**
 * 创建 RoleMux Commander 实例，供 CLI 入口和测试复用。
 */
export function createCli(): Command {
  const cli = new Command();

  cli
    .name('rolemux')
    .description('Lightweight multi-CLI role workflow runner for Codex, Claude, Agy, Grok Build, and OpenCode.')
    .version('0.1.0');

  cli.command('install')
    .description('plan or install RoleMux runtime, optional non-plugin skills, or Codex App plugin refresh')
    .option('--dry-run', 'preview install targets without writing files')
    .option('--codex', 'also install the Codex non-plugin Skill bundle')
    .option('--claude', 'also install the Claude non-plugin Skill bundle')
    .option('--codex-plugin', 'refresh the Codex App plugin source and installed cache')
    .option('--with-agents', 'also plan AGENTS.md integration')
    .action(async options => {
      const result = await installCommand({
        homeDir: process.env.HOME ?? process.env.USERPROFILE ?? process.cwd(),
        projectDir: process.cwd(),
        dryRun: options.dryRun === true,
        withAgents: options.withAgents === true,
        codex: options.codex === true,
        claude: options.claude === true,
        codexPlugin: options.codexPlugin === true
      });
      printJson(result);
    });

  cli.command('uninstall')
    .description('remove RoleMux runtime, non-plugin skills, or explicitly selected Codex App plugin files')
    .option('--dry-run', 'preview uninstall targets without deleting files')
    .option('--keep-config', 'preserve ~/.rolemux/config.toml')
    .option('--codex', 'only remove the Codex non-plugin Skill bundle')
    .option('--claude', 'only remove the Claude non-plugin Skill bundle')
    .option('--codex-plugin', 'remove the Codex App plugin source and installed cache')
    .action(async options => {
      const result = await uninstallCommand({
        homeDir: process.env.HOME ?? process.env.USERPROFILE ?? process.cwd(),
        dryRun: options.dryRun === true,
        keepConfig: options.keepConfig === true,
        codex: options.codex === true,
        claude: options.claude === true,
        codexPlugin: options.codexPlugin === true
      });
      printJson(result);
    });

  cli.command('doctor')
    .description('check provider executables')
    .option('--providers <providers>', 'comma-separated provider list')
    .option('--probe', 'run a fixed read-only authentication/network/stdout probe')
    .option('--probe-timeout-ms <milliseconds>', 'timeout for each provider probe', parsePositiveInteger, 30000)
    .action(async options => {
      const providers = parseProviders(options.providers);
      const result = await doctorCommand({
        ...(providers === undefined ? {} : { providers }),
        probe: options.probe === true,
        probeTimeoutMs: options.probeTimeoutMs
      });
      printJson(result);
    });

  const manifest = cli.command('manifest')
    .description('work with RoleMux subtask manifests');

  manifest.command('validate')
    .description('validate a RoleMux subtask manifest')
    .requiredOption('--manifest <manifest>', 'manifest JSON path')
    .action(async options => {
      printJson(await manifestValidateCommand({ manifest: options.manifest }));
    });

  cli.command('split')
    .description('normalize task inputs into a RoleMux subtask manifest')
    .option('--manifest <manifest>', 'existing manifest JSON path')
    .option('--tasks-dir <tasksDir>', 'directory of markdown subtask files')
    .requiredOption('--out <out>', 'output manifest JSON path')
    .option('--dry-run', 'preview normalized manifest without writing files')
    .action(async options => {
      printJson(await splitCommand({
        manifest: options.manifest,
        tasksDir: options.tasksDir,
        out: options.out,
        dryRun: options.dryRun === true
      }));
    });

  cli.command('dispatch')
    .description('preview subtask dispatch assignments')
    .option('--manifest <manifest>', 'manifest JSON path')
    .option('--providers <providers>', 'provider quotas or provider list')
    .option('--resume <parentTask>', 'resume and summarize an existing parent dispatch task')
    .option('--workers <workers>', 'worker count for provider-list shortcut', parseInteger)
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview dispatch without executing providers')
    .option('--detach', 'start dispatch in the background and monitor it through agents')
    .option('--native-agents', 'allow verified provider-native subagents and show them in agents/TUI')
    .action(async options => {
      if (options.resume !== undefined) {
        printJson(await dispatchResumeCommand({
          parentTask: options.resume,
          workdir: options.workdir
        }));
        return;
      }
      if (options.manifest === undefined || options.providers === undefined) {
        throw new Error('dispatch requires --manifest and --providers unless --resume is used.');
      }
      printJson(await dispatchCommand({
        manifest: options.manifest,
        providers: options.providers,
        workers: options.workers,
        workdir: options.workdir,
        dryRun: options.dryRun === true,
        detach: options.detach === true,
        nativeAgents: options.nativeAgents === true
      }));
    });

  cli.command('_dispatch-runner', { hidden: true })
    .description('internal RoleMux detached dispatch runner')
    .requiredOption('--manifest <manifest>', 'manifest JSON path')
    .requiredOption('--providers <providers>', 'provider quotas or provider list')
    .requiredOption('--parent-task <parentTask>', 'preallocated parent task id')
    .option('--workers <workers>', 'worker count for provider-list shortcut', parseInteger)
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--native-agents', 'allow verified provider-native subagents and show them in agents/TUI')
    .action(async options => {
      printJson(await dispatchCommand({
        manifest: options.manifest,
        providers: options.providers,
        workers: options.workers,
        workdir: options.workdir,
        parentTaskId: options.parentTask,
        dryRun: false,
        detach: false,
        nativeAgents: options.nativeAgents === true
      }));
    });

  cli.command('agents')
    .description('inspect RoleMux multi-agent dispatch status')
    .option('--parent-task <parentTask>', 'parent task id')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--json', 'print machine-readable monitor snapshot')
    .option('--tui', 'print terminal monitor view')
    .action(async options => {
      if (options.tui === true && options.parentTask !== undefined && process.stdin.isTTY && process.stdout.isTTY) {
        await runAgentsTuiSession({
          parentTaskId: options.parentTask,
          workdir: options.workdir
        });
        return;
      }
      const result = await agentsCommand({
        parentTask: options.parentTask,
        workdir: options.workdir,
        json: options.json === true,
        tui: options.tui === true
      });
      if (options.json === true) {
        printJson(result.snapshot ?? result);
        return;
      }
      console.log(result.text);
    });

  cli.command('cancel')
    .description('request cancellation for a running RoleMux dispatch')
    .requiredOption('--parent-task <parentTask>', 'parent task id')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .action(async options => {
      printJson(await cancelCommand({
        parentTask: options.parentTask,
        workdir: options.workdir
      }));
    });

  cli.command('merge')
    .description('preview merge for a parent dispatch task')
    .requiredOption('--parent-task <parentTask>', 'parent task id')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--subtasks <subtasks>', 'comma-separated subtask ids to preview or apply')
    .option('--dry-run', 'preview merge without applying patches')
    .option('--auto-merge', 'apply clean patches automatically')
    .action(async options => {
      printJson(await mergeCommand({
        parentTask: options.parentTask,
        workdir: options.workdir,
        subtasks: parseMergeSubtasks(options.subtasks),
        dryRun: options.dryRun === true,
        autoMerge: options.autoMerge === true
      }));
    });

  const worktree = cli.command('worktree')
    .description('manage RoleMux dispatch worktrees');

  worktree.command('cleanup')
    .description('preview or remove managed dispatch worktrees')
    .requiredOption('--parent-task <parentTask>', 'parent task id')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview cleanup targets without removing worktrees')
    .action(async options => {
      printJson(await worktreeCleanupCommand({
        parentTask: options.parentTask,
        workdir: options.workdir,
        dryRun: options.dryRun === true
      }));
    });

  cli.command('run')
    .description('run a single provider task')
    .requiredOption('--provider <provider>', 'provider name')
    .requiredOption('--role <role>', 'role prompt name')
    .requiredOption('--task <task>', 'task file path')
    .option('--fallback-providers <providers>', 'comma-separated fallback provider list')
    .option('--result-json', 'require and persist the structured result.json contract')
    .option('--max-attempts <count>', 'maximum provider attempts including the primary', parsePositiveInteger)
    .option('--timeout-ms <milliseconds>', 'total provider deadline in milliseconds', parsePositiveInteger)
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview provider command without execution')
    .action(async options => {
      const result = await runCommand({
        provider: options.provider,
        role: options.role,
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true,
        fallbackProviders: parseCsv(options.fallbackProviders) ?? [],
        structuredResult: options.resultJson === true,
        maxAttempts: options.maxAttempts,
        timeoutMs: options.timeoutMs
      });
      printJson(result);
    });

  cli.command('route')
    .description('select providers by fixed task capabilities and availability')
    .requiredOption('--task-kind <kind>', 'architecture, research, implementation, ui-review, or failure-review')
    .option('--available <providers>', 'comma-separated available provider list; otherwise use doctor')
    .option('--exclude <providers>', 'comma-separated providers to exclude')
    .option('--max-providers <count>', 'maximum selected providers', parsePositiveInteger, 2)
    .action(async options => {
      printJson(await routeCommand({
        taskKind: parseTaskKind(options.taskKind),
        available: parseCsv(options.available),
        exclude: parseCsv(options.exclude),
        maxProviders: options.maxProviders
      }));
    });

  cli.command('status')
    .description('show recent RoleMux task summaries')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--limit <limit>', 'maximum number of tasks', parseInteger, 10)
    .action(async options => {
      printJson(await statusCommand({ workdir: options.workdir, limit: options.limit }));
    });

  cli.command('clean')
    .description('clean RoleMux task artifacts')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview clean targets without deleting files')
    .action(async options => {
      printJson(await cleanCommand({ workdir: options.workdir, dryRun: options.dryRun === true }));
    });

  cli.command('plan')
    .description('preview a planning workflow')
    .requiredOption('--providers <providers>', 'comma-separated provider list')
    .requiredOption('--task <task>', 'task file path')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--result-json', 'require and persist the structured result.json contract')
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      printJson(await planCommand({
        providers: parseRequiredCsv(options.providers),
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true,
        structuredResult: options.resultJson === true
      }));
    });

  cli.command('review')
    .description('preview a review workflow')
    .requiredOption('--provider <provider>', 'provider name')
    .option('--role <role>', 'role prompt name', 'reviewer')
    .requiredOption('--task <task>', 'task file path')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--result-json', 'require and persist the structured result.json contract')
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      printJson(await reviewCommand({
        provider: options.provider,
        role: options.role,
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true,
        structuredResult: options.resultJson === true
      }));
    });

  cli.command('discuss')
    .description('preview a multi-provider discussion workflow')
    .option('--providers <providers>', 'comma-separated provider list; overrides capability routing')
    .requiredOption('--task <task>', 'task file path')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--mode <mode>', 'parallel, serial, or structured', 'parallel')
    .option('--counter-reviewer <provider>', 'provider used for structured counter-review')
    .option('--summarizer <provider>', 'provider used for structured synthesis')
    .option('--verification-manifest <path>', 'version 1 executable-and-args verification manifest')
    .option('--task-kind <kind>', 'route kind when providers are omitted')
    .option('--available <providers>', 'comma-separated available providers for deterministic routing')
    .option('--exclude <providers>', 'comma-separated providers excluded from routing')
    .option('--max-providers <count>', 'maximum routed candidate providers', parsePositiveInteger, 2)
    .option('--max-attempts <count>', 'maximum fallback attempts per stage', parsePositiveInteger)
    .option('--timeout-ms <milliseconds>', 'timeout per structured stage or verification command', parsePositiveInteger)
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      const mode = parseDiscussMode(options.mode);
      printJson(await discussCommand({
        providers: parseCsv(options.providers),
        task: options.task,
        workdir: options.workdir,
        mode,
        dryRun: options.dryRun === true,
        counterReviewer: options.counterReviewer,
        summarizer: options.summarizer,
        verificationManifest: options.verificationManifest,
        taskKind: options.taskKind === undefined ? undefined : parseTaskKind(options.taskKind),
        availableProviders: parseCsv(options.available),
        excludeProviders: parseCsv(options.exclude),
        maxProviders: options.maxProviders,
        maxAttempts: options.maxAttempts,
        timeoutMs: options.timeoutMs
      }));
    });

  return cli;
}

/**
 * 执行 CLI 入口并将错误转换为非零退出码。
 */
export async function main(argv = process.argv): Promise<void> {
  try {
    await createCli().parseAsync(argv);
  } catch (error) {
    if (error instanceof CliError && error.details?.status === 'blocked') {
      console.error(JSON.stringify({
        status: 'blocked',
        code: error.code,
        message: error.message,
        ...error.details
      }, null, 2));
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}

function parseCsv(value: string | undefined): string[] | undefined {
  return value?.split(',').map(item => item.trim()).filter(Boolean);
}

function parseMergeSubtasks(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const subtasks = value.split(',').map(item => item.trim()).filter(Boolean);
  if (subtasks.length === 0) {
    throw new Error('Invalid --subtasks: provide at least one subtask id.');
  }
  return subtasks;
}

function parseRequiredCsv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function parseProviders(value: string | undefined): ProviderName[] | undefined {
  const providers = parseCsv(value);
  if (providers === undefined) {
    return undefined;
  }

  return providers.filter(isProviderName);
}

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received: ${value}`);
  }
  return parsed;
}

function parseDiscussMode(value: string): 'parallel' | 'serial' | 'structured' {
  if (value === 'parallel' || value === 'serial' || value === 'structured') {
    return value;
  }
  throw new Error(`Invalid discuss mode: ${value}`);
}

function parseTaskKind(value: string): 'architecture' | 'research' | 'implementation' | 'ui-review' | 'failure-review' {
  if (value === 'architecture' || value === 'research' || value === 'implementation'
    || value === 'ui-review' || value === 'failure-review') {
    return value;
  }
  throw new Error(`Invalid task kind: ${value}`);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function isDirectCliInvocation(): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedPath);
  } catch {
    return fileURLToPath(import.meta.url) === invokedPath;
  }
}

if (isDirectCliInvocation()) {
  void main();
}
