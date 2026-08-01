# RoleMux 插件开发文档

版本：v0.1
日期：2026-05-24
项目目录：`C:\Users\peng8\Desktop\Project\Tool\RoleMux`

## 1. 背景与定位

RoleMux 是一个轻量多 CLI 工作流插件/工具包，用于让当前 AI CLI 按角色调用其他 AI CLI 协作完成分析、规划、实现、审查、验证等任务。

它参考 CCG 和 Claude-Code-Workflow 的工作流思想，但不复制重型 `AGENTS.md`、hooks、dashboard、强状态机治理。RoleMux 的目标是提供一个更轻、更易安装、更可控的多 CLI 协作层。

核心定位：

- 通过 npm/npx 安装，提供统一命令 `rolemux`。
- 通过通用 RoleMux Skill 在 Codex / Claude 等宿主中按需触发工作流。
- 通过 runner 统一调用 `codex`、`claude`、`agy`、`grok`、`opencode` 等 CLI。
- 通过 role prompt 临时赋予不同模型不同职责。
- 通过 `.rolemux/tasks/{task-id}/` 保存任务输入、运行日志、输出和审查结果。
- 默认不修改 `AGENTS.md`，只提供可选安装项。

建议命名：

| 项 | 建议 |
|---|---|
| 项目名 | RoleMux |
| npm 包 | `rolemux` |
| CLI 命令 | `rolemux` |
| Skill 名 | `rolemux-workflow` |
| 全局配置目录 | `~/.rolemux/` |
| 项目任务目录 | `.rolemux/tasks/` |

## 2. 目标与非目标

### 2.1 目标

- 让用户用一个入口调用多个 AI CLI。
- 支持按角色分配任务，例如 architect、builder、reviewer、frontend-reviewer。
- 支持一份通用 RoleMux Skill 作为 Codex/Claude 等宿主的工作流入口。
- 支持 npm/npx 一键安装、检查和卸载。
- 支持 Windows 优先，同时兼容 macOS/Linux。
- 保留清晰、可审计的任务产物。

### 2.2 非目标

- MVP 不做完整 CCG 式强制流程治理。
- MVP 不依赖 `AGENTS.md`。
- MVP 不实现复杂 Web dashboard。
- MVP 不强制 native subagent。
- MVP 不代替 Codex/Claude/Antigravity 本身，只负责调度和产物组织。

## 3. 用户角色

| 用户角色 | 诉求 |
|---|---|
| 个人开发者 | 希望一个 CLI 调用多个 AI CLI 协作 |
| AI 工作流研究者 | 希望复刻 CCG/CCW 的轻量版本 |
| 插件作者 | 希望把流程封装成可安装 npm 包和 Skill bundle |
| 代码项目维护者 | 希望把分析、实现、审查分给不同模型 |

## 4. 核心需求说明

RoleMux 应提供三层能力：

1. 安装层
   将 CLI、skills、roles、默认配置安装到本机指定位置。

2. 编排层
   根据用户任务、阶段、目标 provider、role prompt 生成执行请求。

3. 执行层
   调用真实 CLI，收集 stdout/stderr、退出码、耗时和输出产物。

推荐最小链路：

```text
用户任务
  -> 通用 RoleMux Skill 识别需要多 CLI 协作
  -> 调用 rolemux run/plan/review
  -> RoleMux 读取 config + role prompt
  -> provider adapter 调用 codex/claude/agy/grok/opencode
  -> 输出写入 .rolemux/tasks/{task-id}/
  -> 主控 AI 汇总结果给用户
```

## 5. 功能清单

### 5.1 MVP 功能

- `rolemux install`：默认安装 shared runtime；Codex/Claude 非插件 Skill 和 Codex App 插件刷新必须显式指定。
- `rolemux uninstall`：默认卸载 shared runtime 与 Codex/Claude 非插件 Skill；Codex App 插件移除必须显式指定。
- `rolemux doctor`：检查 `codex`、`claude`、`agy`、`grok`、`opencode` 是否可用。
- `rolemux run`：按 provider + role 执行一次任务。
- `rolemux plan`：让指定 provider 生成方案。
- `rolemux review`：让指定 provider 审查代码或计划。
- `rolemux status`：查看最近任务状态。
- `rolemux clean`：清理历史任务缓存。
- `rolemux manifest validate`：校验标准 subtask manifest。
- `rolemux split`：把目录或已有 manifest 规范化为标准 subtask manifest。
- `rolemux dispatch`：按 provider worker pool 执行 `readonly` 子任务；`codex:2,claude:1` 等 provider quota 会限制真实 provider 进程并发数；`isolated` 子任务在独立 git worktree 中执行并收集 `diff.patch`；也可用 `--dry-run` 预览分发结果，或用 `--resume` 从父任务产物恢复状态摘要。
- `rolemux dispatch --detach`：后台启动多 CLI agent dispatch，立即返回 parent task id、监控命令和取消命令。
- `rolemux agents`：查看当前项目的 agent dispatch；支持 `--parent-task`、`--json` 和 `--tui`。
- `rolemux cancel --parent-task <id>`：请求取消仍在运行的 dispatch，不删除任务产物。
- `rolemux merge --dry-run`：读取父任务 `diff.patch` 并预览涉及文件，不修改主工作区。
- `rolemux merge --auto-merge`：显式 opt-in，先用 `git apply --check` 检查所有 patch，再应用 clean patch。
- `rolemux worktree cleanup`：按父任务 `worktree.txt` 清理 RoleMux 管理的 isolated worktree，支持 dry-run。
- role 文件管理：内置 roles，可用户覆盖。
- provider 适配器：Codex、Claude、Antigravity/agy。
- 任务产物：保存 prompt、输出、日志、metadata。
- dry-run：只打印将要执行的命令，不真正调用。

### 5.2 增强功能

- 并行执行多个 provider。
- fallback chain，例如 `agy` 失败后改用 `codex`。
- 项目级配置 `.rolemux/config.toml` 覆盖全局配置。
- HTML run report。
- TUI dashboard。
- 可选 `--with-agents` 将简短规则写入 `AGENTS.md`。
- 可选 marketplace/plugin manifest，用于 Codex 插件分发。

## 6. CLI 命令设计

```powershell
# 临时安装
npx rolemux install

# 全局安装
npm install -g rolemux
rolemux install

# 卸载 RoleMux 安装内容
rolemux uninstall --dry-run
rolemux uninstall
rolemux uninstall --keep-config

# 显式安装或卸载非插件 Skill
rolemux install --codex
rolemux install --claude
rolemux uninstall --codex
rolemux uninstall --claude

# 显式刷新或卸载 Codex App 插件
rolemux install --codex-plugin
rolemux uninstall --codex-plugin

# 检查环境
rolemux doctor

# 指定 provider + role 执行任务
rolemux run --provider codex --role builder --task task.md --workdir .

# 结构化输出和整个 fallback 链预算
rolemux run --provider codex --fallback-providers 'grok,opencode' --role reviewer --task task.md --result-json --max-attempts 2 --timeout-ms 120000

# 生成方案
rolemux plan --providers 'claude,codex' --task task.md

# 审查当前改动
rolemux review --provider codex --role reviewer --workdir .

# 并行讨论
rolemux discuss --providers 'claude,codex,agy' --task task.md --mode parallel

# 固定能力路由与结构化证据工作流
rolemux route --task-kind failure-review --max-providers 2
rolemux discuss --task task.md --mode structured --task-kind failure-review --verification-manifest verification.json

# 规范化子任务 manifest
rolemux split --tasks-dir .\tasks --out .\rolemux-tasks.json --dry-run
rolemux manifest validate --manifest .\rolemux-tasks.json

# 预览 worker 分发
rolemux dispatch --manifest .\rolemux-tasks.json --providers 'codex:2,claude:1' --dry-run

# 执行 readonly/isolated 子任务并写入父/子任务产物
rolemux dispatch --manifest .\rolemux-tasks.json --providers 'codex:2,claude:1' --workdir .

# 后台执行并监控多 agent dispatch
rolemux dispatch --manifest .\rolemux-tasks.json --providers 'codex:2,claude:1' --workdir . --detach
rolemux agents
rolemux agents --parent-task <parent-task-id>
rolemux agents --parent-task <parent-task-id> --json
rolemux agents --parent-task <parent-task-id> --tui
rolemux cancel --parent-task <parent-task-id>

# 恢复并查看既有父任务的子任务状态
rolemux dispatch --resume <parent-task-id> --workdir .

# 预览合并入口
rolemux merge --parent-task <parent-task-id> --workdir . --dry-run
rolemux merge --parent-task <parent-task-id> --workdir . --subtasks 'one,two' --dry-run

# 显式应用 clean patch
rolemux merge --parent-task <parent-task-id> --workdir . --auto-merge
rolemux merge --parent-task <parent-task-id> --workdir . --subtasks 'one,two' --auto-merge

# 预览并清理 isolated worktree
rolemux worktree cleanup --parent-task <parent-task-id> --workdir . --dry-run
rolemux worktree cleanup --parent-task <parent-task-id> --workdir .

# 只查看将执行什么
rolemux run --provider claude --role architect --task task.md --dry-run
```

`writePolicy=isolated` 要求 `--workdir` 位于 git work tree 中。Windows PowerShell 中通过 `rolemux.ps1` shim 传入逗号列表时建议加引号，例如 `--providers 'codex:2,claude:1'` 和 `--subtasks 'one,two'`。`dispatch --detach` 会写入 `.rolemux/tasks/{parent-task-id}/monitor.json`、`events.jsonl`、`summary.md` 和 `control/`，然后用参数数组启动后台 runner；插件或上层智能体默认轮询 `agents --json` 生成对话内监控卡片，人类可另开终端用 `agents --tui` 查看全屏监控。`cancel` 只写入取消请求并终止仍在运行的 provider，不删除已完成 agent 产物。RoleMux 会为每个 isolated 子任务创建 `.rolemux/worktrees/{parent-task-id}/{subtask-id}`，provider 在该目录内执行，执行后将 `git diff --binary HEAD` 写入 `.rolemux/tasks/{parent-task-id}/subtasks/{subtask-id}/diff.patch`，并把 worktree 绝对路径写入 `worktree.txt`。`dispatch --resume` 会读取既有父任务 metadata、manifest 和子任务 metadata，输出每个子任务的状态、provider、role、产物路径、patch/worktree 是否存在和下一步命令建议；当前不会重新执行失败 provider。`merge --dry-run` 默认只读取并预览这些 patch；只有用户显式使用 `merge --auto-merge` 时，RoleMux 才会运行 `git apply --check` 并应用 clean patch。`--dry-run` 与 `--auto-merge` 互斥，同时传入会返回 `INVALID_ARGUMENT`。默认不传 `--subtasks` 时会处理父任务下所有 patch；传入 `--subtasks one,two` 时只预览或应用这些子任务的 patch，若指定子任务没有 `diff.patch` 会返回 `NOT_FOUND`；空、空白或全逗号的 `--subtasks` 会被拒绝，不会退化为全量 patch。`worktree cleanup` 只清理 `worktree.txt` 记录且位于 `.rolemux/worktrees/` 下的 worktree，不删除任务产物或 git branch。当前阶段不自动解决冲突、不自动清理 worktree。

## 7. 推荐目录结构

### 7.1 项目源码结构

```text
RoleMux/
  package.json
  tsconfig.json
  src/
    cli.ts
    commands/
      install.ts
      doctor.ts
      run.ts
      plan.ts
      review.ts
      status.ts
      clean.ts
    core/
      config.ts
      task-store.ts
      prompt-builder.ts
      process-runner.ts
      logger.ts
    providers/
      provider.ts
      codex.ts
      claude.ts
      agy.ts
    roles/
      index.ts
  skills/
    rolemux-workflow/
      SKILL.md
  roles/
    architect.md
    builder.md
    reviewer.md
    frontend-reviewer.md
    summarizer.md
  templates/
    config.toml
  spec/
    rolemux-development-spec.md
```

### 7.2 安装后结构

```text
~/.rolemux/
  config.toml
  roles/
  logs/

# 仅在显式 `rolemux install --codex` 时写入
~/.codex/skills/rolemux-workflow/
  SKILL.md

# 仅在显式 `rolemux install --claude` 时写入
~/.claude/skills/rolemux-workflow/
  SKILL.md

# 仅在显式 `rolemux install --codex-plugin` 时刷新
~/plugins/rolemux/
~/.codex/plugins/cache/personal/rolemux/0.1.0/

<project>/.rolemux/tasks/{task-id}/
  task.md
  prompt.md
  output.md
  metadata.json
  monitor.json
  events.jsonl
  summary.md
  control/cancel.json
  runs/
    codex-builder.json
    claude-reviewer.json
```

## 8. 流程图

### 8.1 安装流程

```mermaid
flowchart TD
  A["用户运行 npx rolemux install"] --> B["检测系统与 Node 版本"]
  B --> C["检测 codex / claude / agy / grok / opencode"]
  C --> D["创建 ~/.rolemux"]
  D --> E["复制默认 roles 与 config"]
  E --> F["可选 --codex 安装 Codex 非插件 Skill"]
  E --> G["可选 --claude 安装 Claude 非插件 Skill"]
  E --> P["可选 --codex-plugin 刷新 Codex App 插件"]
  F --> H["输出 doctor 结果"]
  G --> H
  P --> H
```

### 8.2 运行流程

```mermaid
flowchart TD
  U["用户任务"] --> S["RoleMux Skill"]
  S --> P["判断阶段: plan / run / review"]
  P --> R["选择 role prompt"]
  R --> C["读取 config 与 workdir"]
  C --> X["RoleMux Runner"]
  X --> CX["Codex Adapter"]
  X --> CL["Claude Adapter"]
  X --> AG["Agy Adapter"]
  CX --> O["任务产物目录"]
  CL --> O
  AG --> O
  O --> M["主控 AI 汇总"]
```

### 8.3 Provider 适配流程

```mermaid
sequenceDiagram
  participant Skill as RoleMux Skill
  participant CLI as rolemux CLI
  participant Adapter as Provider Adapter
  participant Tool as codex/claude/agy/grok/opencode
  participant Store as Task Store

  Skill->>CLI: rolemux run --provider codex --role builder
  CLI->>Store: create task run metadata
  CLI->>Adapter: build command
  Adapter->>Tool: spawn process
  Tool-->>Adapter: stream output
  Adapter-->>CLI: exit code + stdout + stderr
  CLI->>Store: write output and metadata
  CLI-->>Skill: summary path + status
```

## 9. UI 方案

MVP 不需要重 Web UI。建议做两个 UI 层级：

1. 命令行 UI
   用清晰的进度、provider 状态、产物路径和错误摘要即可。

2. HTML Run Report
   每次任务结束可生成 `report.html`，展示任务输入、provider 输出、耗时、状态和后续建议。

后续 TUI/Web UI 可以采用三栏布局：

- 左侧：任务列表、provider 状态、历史运行。
- 中间：当前 workflow timeline。
- 右侧：选中 run 的 prompt、输出、错误、产物路径。
- 顶部：全局命令栏，包含 Run、Plan、Review、Doctor。
- 底部：日志流和快捷命令。

UI 风格建议：开发者工具风格，密度较高，少装饰，突出任务状态和可审计产物。

![RoleMux UI 概念图](assets/rolemux-ui-concept.png)

## 10. 技术方案

### 10.1 推荐技术栈

| 类别 | 方案 |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| CLI 框架 | Commander 或 Clipanion |
| 进程调用 | `execa` |
| 配置校验 | `zod` |
| TOML 解析 | `smol-toml` 或 `@iarna/toml` |
| 日志 | `pino` |
| 测试 | Vitest |
| 打包 | tsup |
| 分发 | npm package |

### 10.2 核心模块

- `config.ts`：加载全局配置和项目配置。
- `prompt-builder.ts`：拼接 role prompt、任务内容、上下文和输出格式要求。
- `process-runner.ts`：统一 spawn、超时、流式输出、退出码处理。
- `task-store.ts`：创建任务目录、写入 metadata、保存产物。
- `providers/*.ts`：不同 CLI 的命令参数适配。
- `commands/*.ts`：用户命令入口。
- `skills/rolemux-workflow/SKILL.md`：通用 Skill 源，指导宿主智能体何时调用 RoleMux。
- 安装器会把通用 Skill 源复制到 Codex/Claude 等宿主目标目录；仓库不再维护宿主专属 Skill 副本。

### 10.3 Provider 适配建议

```text
claude:
  claude -p --output-format text "<prompt>"

codex:
  codex exec -C "<workdir>" "<prompt>"

agy:
  agy -p --add-dir "<workdir>" "<prompt>"
```

实际开发时需要用 `doctor` 检测本机 CLI 版本，并针对版本差异做降级提示。

### 10.4 安全策略

- 默认不使用危险权限参数。
- 默认不修改项目文件，除非用户明确使用 write/build role。
- 所有真实命令支持 `--dry-run`。
- role prompt 中明确写入边界：只能做分配的职责。
- 写操作必须传入 `--workdir`。
- 不读取或输出密钥类环境变量。
- 子进程输出要保存原文，同时给用户摘要。

## 11. Skill 设计

### 11.1 触发条件

通用 RoleMux Skill 在以下场景触发：

- 用户要求多 CLI 协作。
- 用户要求 Claude/Codex/Antigravity 互相调用。
- 用户要求按角色分配 AI 工具。
- 用户要求 plan/review/implement 分工。

### 11.2 Skill 行为

```text
1. 判断用户目标属于 plan / run / review / discuss。
2. 选择 provider 与 role。
3. 生成任务文件或读取用户指定 task。
4. 调用 rolemux CLI。
5. 读取输出产物。
6. 汇总为用户可读结果。
```

### 11.3 Skill 不应承担的职责

- 真实 CLI 参数细节。
- 大量硬编码 provider 规则。
- 大型状态机。
- 强制修改 `AGENTS.md`。

## 12. 数据结构

### 12.1 `metadata.json`

```json
{
  "schemaVersion": 1,
  "taskId": "2026-05-24-001",
  "command": "run",
  "provider": "codex",
  "role": "builder",
  "workdir": "C:/Users/peng8/Desktop/Project/Tool/RoleMux",
  "startedAt": "2026-05-24T10:00:00.000Z",
  "finishedAt": "2026-05-24T10:01:20.000Z",
  "durationMs": 80000,
  "exitCode": 0,
  "status": "success",
  "artifacts": {
    "prompt": "prompt.md",
    "output": "output.md",
    "stderr": "stderr.log",
    "result": "result.json"
  },
  "provenance": {
    "gitHead": "...",
    "promptSha256": "...",
    "executionConfigSha256": "...",
    "providerExecutable": "codex",
    "providerCliVersion": null,
    "model": { "requested": null, "resolved": null, "source": "not-reported" },
    "humanApproval": "not-recorded"
  },
  "budget": {
    "maxAttempts": 2,
    "timeoutMs": 120000,
    "attemptsUsed": 1,
    "deadlineReached": false
  }
}
```

旧 metadata 不要求这些新增字段，继续按向后兼容 schema 读取。`result.json` 仅在显式 `--result-json` 或 structured synthesis 时生成；其 `verification[]` 由 RoleMux 实际执行结果覆盖模型自报。

### 12.2 `result.json`

- 固定 `schemaVersion: 1`。
- 保存 `summary`、`findings[]`、`risks[]`、`recommendedActions[]`、`verification[]`。
- structured discussion 顺序固定为独立候选、匿名 counter-review、argv 验证、单一 synthesis。
- verification manifest 仅接受 `version: 1` 与 `name/executable/args[]`，禁止 shell command string。
- 能力路由只使用 adapter task kinds 和固定优先级；显式 providers 始终优先，不构成模型质量排名。

### 12.3 `config.toml`

```toml
default_provider = "codex"
default_workdir = "."
task_dir = ".rolemux/tasks"
timeout_seconds = 600

[providers.codex]
enabled = true
command = "codex"

[providers.claude]
enabled = true
command = "claude"

[providers.agy]
enabled = true
command = "agy"

[providers.grok]
enabled = true
command = "grok"

[providers.opencode]
enabled = true
command = "opencode"
```

## 13. 开发里程碑

| 里程碑 | 内容 |
|---|---|
| M0 | 项目初始化，完成 package、TypeScript、lint/test/build 基础设施 |
| M1 | CLI 骨架，完成 `install`、`doctor`、`run --dry-run` |
| M2 | Provider MVP，完成 Codex、Claude、Agy、Grok Build、OpenCode 五个 adapter 的真实调用 |
| M3 | 任务产物，完成 `.rolemux/tasks/{task-id}` 保存、metadata、日志、输出 |
| M4 | Skill Bundle，完成通用 Skill、默认 roles、按目标安装复制逻辑 |
| M5 | 工作流命令，完成 `plan`、`review`、`discuss`、并行执行、fallback |
| M6 | 报告与打包，完成 HTML report、npm publish 准备、README、示例 |

## 14. 验收标准

### 14.1 安装验收

- `npx rolemux install` 可执行。
- `~/.rolemux/config.toml` 被创建。
- 默认 roles 被安装。
- 默认 `rolemux install` 不写 `~/.codex/skills` 或 `~/.claude/skills`。
- `rolemux install --codex` 将 Codex 非插件 Skill 复制到正确目录。
- `rolemux install --claude` 将 Claude 非插件 Skill 复制到正确目录。
- `rolemux install --codex-plugin` 刷新 Codex App 插件源和缓存，不写 `~/.codex/skills`。
- 重复执行 install 不破坏用户已有配置。
- `rolemux uninstall --dry-run` 可列出将删除的 config、roles 和 Skill 目录，不产生删除副作用。
- `rolemux uninstall` 只删除 RoleMux 明确安装的路径，不删除用户项目文件和 `AGENTS.md`。
- `rolemux uninstall --keep-config` 保留 `~/.rolemux/config.toml`。
- `rolemux uninstall --codex-plugin` 只在显式请求时移除 Codex App 插件源和缓存。

### 14.2 环境验收

- `rolemux doctor` 能检测 `codex`、`claude`、`agy`、`grok`、`opencode`。
- 缺失 CLI 时给出明确安装或跳过提示。
- Windows PowerShell 下路径带空格也能正常处理。

### 14.3 执行验收

- `rolemux run --dry-run` 输出正确命令。
- `rolemux run --provider codex --role builder --task task.md` 可执行并保存输出。
- provider 失败时保存错误日志和退出码。
- 超时任务能被终止并标记 `timeout`。
- `--workdir` 生效，且不会误写到其他目录。

### 14.4 产物验收

- 每次 run 都有唯一 task id。
- `prompt.md`、`output.md`、`metadata.json` 均存在。
- metadata 中包含 provider、role、workdir、duration、exitCode。
- `status` 能读取最近任务。

### 14.5 Skill 验收

- Codex 中能识别 RoleMux 工作流触发场景。
- Skill 会调用 `rolemux`，而不是直接硬编码复杂 CLI。
- Skill 输出能引用任务产物并汇总结果。
- 不依赖 `AGENTS.md` 也能工作。

### 14.6 安全验收

- 默认不使用危险 bypass/sandbox 参数。
- dry-run 不产生任务执行副作用。
- 不打印密钥环境变量。
- 不在未经允许时修改 `AGENTS.md`。
- 写入范围限定在 `~/.rolemux` 和当前项目 `.rolemux`。

## 15. 测试清单

### 15.1 单元测试

- 配置加载：全局配置、项目配置、默认值、非法配置。
- prompt 拼接：role + task + context 顺序正确。
- provider adapter：命令参数生成正确。
- task store：目录创建、metadata 写入、重复 id 处理。
- process runner：成功、失败、超时、stderr 捕获。

### 15.2 集成测试

- mock `codex/claude/agy/grok/opencode` 可执行文件，验证 spawn 参数。
- `rolemux doctor` 在 CLI 存在/缺失时输出正确。
- `rolemux run --dry-run` 不创建真实运行输出。
- `rolemux run` 能完整生成任务产物。
- `npm run test:e2e` 使用 mock provider 完成 install -> run -> status -> clean -> uninstall 发布验收流。
- worker E2E 使用 mock provider 覆盖 manifest validate -> dispatch readonly/isolated -> dispatch resume -> `merge --subtasks` dry-run/auto-merge -> worktree cleanup dry-run。

### 15.3 端到端测试

- 在 Windows PowerShell 中执行 install/doctor/run。
- 在路径含空格的 workdir 中执行任务。
- Codex 宿主中的 RoleMux Skill 调用 `rolemux plan`。
- Claude 宿主中的 RoleMux Skill 调用 `rolemux review`。
- provider 失败后 fallback 可用。
- `run --max-attempts` 与总 `--timeout-ms` 不会启动超预算 fallback，Windows timeout/cancel 会终止完整 provider process tree。
- structured discussion 的候选隔离、counter 失败提前停止、argv 验证、最终 `result.json` 与路由结果均有 mock-process E2E。

### 15.4 发布测试

- `npm pack` 包含必要文件。
- 全局安装后 `rolemux` 命令可用。
- `rolemux uninstall --dry-run` 可用。
- `npm run verify:release` 可执行 typecheck、unit test、E2E、pack dry-run 和 whitespace check。
- `npx rolemux doctor` 可用。
- README 示例命令可复制执行。

### 15.5 实验性 Eval Pack

- `npm run eval:pack` 仅作为开发期实验入口，不增加公开 `rolemux eval` 命令。
- 使用版本化 26 案例事实包，对比单模型、相同提示多 CLI 和 RoleMux 角色分工；structured 模式含独立候选、匿名 counter-review 和最终 synthesis，共 10 次调用。
- 真实 provider 必须在临时 detached worktree 中只读运行，并保留逐调用状态与输出产物。
- 评分使用预先固定的事实词、证据路径和覆盖率，不使用 LLM judge；结果只适用于当前 pack。

## 16. 风险与约束

主要风险：

- 各 CLI 参数随版本变化，需要 `doctor` 与 adapter 分层缓冲。
- Windows shell quoting 容易出错，必须用 `execa` 参数数组，不拼接命令字符串。
- 模型输出不可控，需要 role prompt 和产物结构稳定约束。
- 并行写同一个项目可能冲突，MVP 应默认分析/审查并行，写操作串行。
- Skill 安装路径可能因用户环境不同而变化，需要可配置。

规避方案：

- 所有 provider 命令集中在 adapter。
- 默认 role 保守，写操作需要明确命令。
- 所有执行可 dry-run。
- 任务产物可审计。
- MVP 优先做稳定 CLI，不先做复杂平台化 UI。

## 17. MVP 完成定义

RoleMux MVP 完成时，应满足：

- 用户能用 `npx rolemux install` 安装。
- 用户能用 `rolemux doctor` 检查环境。
- 用户能用 `rolemux run` 调用 Codex/Claude/Agy/Grok Build/OpenCode 任一 CLI。
- 用户能给任务指定 role prompt。
- 每次执行都有可追踪产物。
- 通用 RoleMux Skill 能按需调用 RoleMux，并可安装到 Codex/Claude 等宿主路径。
- 不修改 `AGENTS.md` 也能完成核心流程。
