import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { cleanCommand } from './commands/clean.js';
import { discussCommand } from './commands/discuss.js';
import { doctorCommand, type ProviderName } from './commands/doctor.js';
import { installCommand } from './commands/install.js';
import { planCommand } from './commands/plan.js';
import { reviewCommand } from './commands/review.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { uninstallCommand } from './commands/uninstall.js';

/**
 * 创建 RoleMux Commander 实例，供 CLI 入口和测试复用。
 */
export function createCli(): Command {
  const cli = new Command();

  cli
    .name('rolemux')
    .description('Lightweight multi-CLI role workflow runner for Codex, Claude, and Agy.')
    .version('0.1.0');

  cli.command('install')
    .description('plan or install RoleMux skill bundles')
    .option('--dry-run', 'preview install targets without writing files')
    .option('--with-agents', 'also plan AGENTS.md integration')
    .action(async options => {
      const result = await installCommand({
        homeDir: process.env.HOME ?? process.env.USERPROFILE ?? process.cwd(),
        projectDir: process.cwd(),
        dryRun: options.dryRun === true,
        withAgents: options.withAgents === true
      });
      printJson(result);
    });

  cli.command('uninstall')
    .description('remove RoleMux config, roles, and skill bundles')
    .option('--dry-run', 'preview uninstall targets without deleting files')
    .option('--keep-config', 'preserve ~/.rolemux/config.toml')
    .action(async options => {
      const result = await uninstallCommand({
        homeDir: process.env.HOME ?? process.env.USERPROFILE ?? process.cwd(),
        dryRun: options.dryRun === true,
        keepConfig: options.keepConfig === true
      });
      printJson(result);
    });

  cli.command('doctor')
    .description('check provider executables')
    .option('--providers <providers>', 'comma-separated provider list')
    .action(async options => {
      const providers = parseProviders(options.providers);
      const result = await doctorCommand(providers === undefined ? {} : { providers });
      printJson(result);
    });

  cli.command('run')
    .description('run a single provider task')
    .requiredOption('--provider <provider>', 'provider name')
    .requiredOption('--role <role>', 'role prompt name')
    .requiredOption('--task <task>', 'task file path')
    .option('--fallback-providers <providers>', 'comma-separated fallback provider list')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview provider command without execution')
    .action(async options => {
      const result = await runCommand({
        provider: options.provider,
        role: options.role,
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true,
        fallbackProviders: parseCsv(options.fallbackProviders) ?? []
      });
      printJson(result);
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
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      printJson(await planCommand({
        providers: parseRequiredCsv(options.providers),
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true
      }));
    });

  cli.command('review')
    .description('preview a review workflow')
    .requiredOption('--provider <provider>', 'provider name')
    .option('--role <role>', 'role prompt name', 'reviewer')
    .requiredOption('--task <task>', 'task file path')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      printJson(await reviewCommand({
        provider: options.provider,
        role: options.role,
        task: options.task,
        workdir: options.workdir,
        dryRun: options.dryRun === true
      }));
    });

  cli.command('discuss')
    .description('preview a multi-provider discussion workflow')
    .requiredOption('--providers <providers>', 'comma-separated provider list')
    .requiredOption('--task <task>', 'task file path')
    .option('--workdir <workdir>', 'working directory', process.cwd())
    .option('--mode <mode>', 'parallel or serial', 'parallel')
    .option('--dry-run', 'preview workflow without execution')
    .action(async options => {
      const mode = parseDiscussMode(options.mode);
      printJson(await discussCommand({
        providers: parseRequiredCsv(options.providers),
        task: options.task,
        workdir: options.workdir,
        mode,
        dryRun: options.dryRun === true
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
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function parseCsv(value: string | undefined): string[] | undefined {
  return value?.split(',').map(item => item.trim()).filter(Boolean);
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

function isProviderName(value: string): value is ProviderName {
  return value === 'codex' || value === 'claude' || value === 'agy';
}

function parseInteger(value: string): number {
  return Number.parseInt(value, 10);
}

function parseDiscussMode(value: string): 'parallel' | 'serial' {
  if (value === 'parallel' || value === 'serial') {
    return value;
  }
  throw new Error(`Invalid discuss mode: ${value}`);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
