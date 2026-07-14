# Grok Build Full Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不触碰真实用户项目、不使用危险权限 bypass 的前提下，完成 Grok Build 的真实写任务、timeout、fallback、cancel 和实体终端 TUI 认证。

**Architecture:** 所有真实写入只发生在 `%TEMP%\rolemux-grok-cert-*` 下的新建 git fixture。优先复用现有 `runWorkflow(timeoutMs)`、dispatch isolated worktree、monitor、cancel 和 TUI；只修复已经确认的 fallback primary 重复执行问题，不新增通用 workflow engine 或额外依赖。

**Tech Stack:** TypeScript, Node.js 20+, Vitest, PowerShell, Git, official Grok Build CLI 0.2.99.

---

## 安全与停止条件

- 开始前记录 RoleMux 仓库 `git status --short`，结束后逐项比对，不把 fixture 或真实任务产物写入 RoleMux 仓库。
- 所有 fixture 使用随机 `%TEMP%\rolemux-grok-cert-*` 路径；删除前验证解析后的绝对路径仍位于 `%TEMP%`。
- 不使用 `--always-approve`、`bypassPermissions` 或危险 sandbox profile。
- 写任务只允许一次性 `--permission-mode acceptEdits`，且目标是临时 isolated worktree；如果仍出现权限询问或超时，立即停止，不自动升级权限。
- 真实 Grok 进程启动次数上限为 4：写任务、timeout、fallback、cancel/TUI 各一次。
- 任一进程修改临时 fixture 之外的路径、出现认证异常、无法终止或留下后台进程时，停止后续步骤并报告。

### Task 1: 修复 fallback primary 重复执行

**Files:**
- Create: `tests/fixtures/counting-provider.mjs`
- Create: `tests/commands/run-fallback.test.ts`
- Modify: `src/commands/run.ts`

- [x] **Step 1: 写计数 provider fixture**

```js
#!/usr/bin/env node

import { appendFileSync } from 'node:fs';

const [provider, status] = process.argv.slice(2);
const logPath = process.env.ROLEMUX_COUNTING_PROVIDER_LOG;
if (logPath === undefined || provider === undefined || status === undefined) {
  throw new Error('Counting provider configuration is incomplete.');
}

appendFileSync(logPath, `${provider}\n`, 'utf8');
if (status === 'failed') {
  console.error(`${provider} failed`);
  process.exit(1);
}
console.log(`${provider} succeeded`);
```

- [x] **Step 2: 写失败回归测试**

测试设置 Grok counting fixture 为 failed、Codex counting fixture 为 success，调用：

```ts
await runCommand({
  provider: 'grok',
  fallbackProviders: ['codex'],
  role: 'summarizer',
  task: taskPath,
  workdir
});
```

断言计数日志严格等于：

```ts
['grok', 'codex']
```

- [x] **Step 3: 运行 RED**

```powershell
npx vitest run tests/commands/run-fallback.test.ts
```

预期当前实现失败，实际日志为 `grok, grok, codex`。

- [x] **Step 4: 最小修复 `runCommand()`**

dry-run 单独构造一次 preview；非 dry-run 在无 fallback 时调用一次 `runWorkflow()`，有 fallback 时只调用一次 `runWithFallback()`：

```ts
if (options.dryRun === true) {
  const preview = await runWorkflow({ provider, role: options.role, task, workdir, dryRun: true });
  return { status: 'dry-run', command: preview.command, task, role: options.role };
}

const fallbackProviders = (options.fallbackProviders ?? []).map(parseProviderName);
const workflow = fallbackProviders.length === 0
  ? await runWorkflow({ provider, role: options.role, task, workdir, dryRun: false })
  : await runWithFallback([provider, ...fallbackProviders], fallbackProvider => runWorkflow({
      provider: fallbackProvider,
      role: options.role,
      task,
      workdir,
      dryRun: false
    }));
```

- [x] **Step 5: 验证 GREEN**

```powershell
npx vitest run tests/commands/run-fallback.test.ts tests/core/fallback.test.ts
npm run lint
```

预期：primary 只执行一次，fallback attempts 为 2。

### Task 2: 真实 isolated write 认证

**Files:**
- Temporary only: `%TEMP%\rolemux-grok-cert-write-*`

- [x] **Step 1: 创建零依赖 git fixture**

fixture 包含：

```js
// value.js
export const value = 1;
```

```js
// test.mjs
import { value } from './value.js';
if (value !== 2) throw new Error(`Expected 2, received ${value}`);
console.log('WRITE_TEST_OK');
```

初始化 git、提交 baseline，并记录原始 commit/hash。

- [x] **Step 2: 创建 isolated manifest**

唯一子任务固定 `provider=grok`、`role=builder`、`writePolicy=isolated`，任务要求只把 `value.js` 的 `1` 改为 `2`、运行 `node test.mjs`、输出 `GROK_WRITE_OK`。

- [x] **Step 3: 运行真实 Grok write**

仅本步骤设置：

```powershell
$env:ROLEMUX_PROVIDER_GROK_ARGS_PREFIX='--permission-mode;acceptEdits'
rolemux dispatch --manifest $manifest --providers 'grok:1' --workdir $tempRoot
```

- [x] **Step 4: 验证写入边界**

必须同时满足：

- parent/subtask metadata 为 success、provider 为 grok。
- isolated worktree 中 `node test.mjs` 输出 `WRITE_TEST_OK`。
- `diff.patch` 只包含 `value.js`。
- 原始临时主 worktree 的 `value.js` 仍为 `1`。
- RoleMux 仓库工作树没有新增变化。

### Task 3: 真实 timeout 认证

**Files:**
- Temporary only; no production change.

- [x] **Step 1: 复用现有 `runWorkflow(timeoutMs)`**

通过一次性 `npx tsx -e` harness 调用真实 Grok，任务要求生成长文本，传入 `timeoutMs: 200`。

- [x] **Step 2: 验证 timeout**

必须满足：

- 返回 `status=timeout`。
- duration 小于 5 秒。
- Grok 子进程退出，系统中没有匹配该临时 workdir 的 `grok.exe`。
- 临时目录没有额外文件。

说明：当前 CLI 没有公开 `--timeout-ms`，本步骤认证的是现有 workflow/process runner timeout 能力，不宣称用户 CLI 已暴露 timeout 参数。

### Task 4: 真实 fallback 到 Grok

**Files:**
- Temporary only; reuse `tests/fixtures/counting-provider.mjs`.

- [x] **Step 1: 将 primary Codex 配成可控失败 fixture**

只覆盖 Codex：

```powershell
$env:ROLEMUX_PROVIDER_CODEX_COMMAND=(Get-Command node).Source
$countingProvider=(Resolve-Path '.\tests\fixtures\counting-provider.mjs').Path
$env:ROLEMUX_PROVIDER_CODEX_ARGS_PREFIX="$countingProvider;codex;failed"
```

Grok 保持官方真实 executable，不设置 override。

- [x] **Step 2: 执行 fallback**

```powershell
rolemux run --provider codex --fallback-providers grok --role summarizer --task task.md --workdir $tempRoot
```

任务要求 Grok 只返回 `GROK_FALLBACK_REAL_OK`。

- [x] **Step 3: 验证 attempts**

必须满足：最终 `status=success`、`provider=grok`、输出包含唯一标记、metadata attempts 顺序严格为 `codex failed -> grok success`，且每个 provider 只执行一次。

### Task 5: 真实 cancel 与实体终端 TUI

**Files:**
- Temporary only: `%TEMP%\rolemux-grok-cert-cancel-*`

- [x] **Step 1: 启动可取消的真实 Grok 长输出任务**

使用 `dispatch --detach`，任务只要求生成足够长的纯文本，不调用工具、不写文件。轮询 monitor，直到 agent 为 running 且能观察到匹配临时 workdir 的 `grok.exe`。

- [x] **Step 2: 在实体 Windows Terminal 打开 TUI**

```powershell
rolemux agents --parent-task $parentTaskId --workdir $tempRoot --tui
```

人工确认：画面显示 `cli=grok`、running 状态；`?`、`i`、`o`、`r` 能更新界面；`q` 能正常退出且不取消任务。

- [x] **Step 3: 第二次进入 TUI 验证 cancel**

按 `c` 两次确认取消，随后用：

```powershell
rolemux agents --parent-task $parentTaskId --workdir $tempRoot --json
```

验证 monitor 最终为 canceled、`control/cancel.json` 存在、Grok 进程已退出、已生成的 artifacts 保留。

- [x] **Step 4: 判定 ConPTY 问题**

如果实体 Windows Terminal 正常，则把此前嵌套 node-pty `AttachConsole failed` 记录为测试 harness 限制；如果实体终端同样失败，再进入单独 bugfix，不在本认证步骤中猜测修复。

执行说明：可见 Windows Terminal 已启动，但当前会话的 GUI SendKeys 无法可靠注入；随后使用真实 Windows PTY 复现并修复 `?` 识别与 stdin 生命周期问题，完成 `? / i / o / r / c c / q` 的可重复交互认证。桌面视觉切换未作为通过证据。

### Task 6: 完整回归与留痕

**Files:**
- Modify: `docs/progress/status.md`
- Modify: `docs/progress/timeline.md`
- Modify: `docs/progress/logs/2026-07-14.md`

- [x] **Step 1: 完整验证**

```powershell
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm pack --dry-run
npm audit --omit=dev --audit-level=high
git diff --check
```

- [x] **Step 2: 清理临时状态**

确认所有 `%TEMP%\rolemux-grok-cert-*` 路径已安全删除，没有残留 Grok/Node/ConPTY 进程，RoleMux 仓库原有用户改动全部保留。

- [x] **Step 3: 更新证据**

按功能分别记录命令、task id、status、exit code、duration、artifact 路径、TUI 人工结论和未通过项；任何一项失败都按实际状态记录，不写“全部通过”。
