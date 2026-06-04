# RoleMux Task Dispatch Design

日期：2026-06-04
状态：设计草案，待用户复核后进入实施计划

## 背景

RoleMux 当前已经支持 `run`、`plan`、`review`、`discuss` 和 fallback。现有 `discuss` 的语义是把同一个任务发送给多个 provider，各自输出观点；它还不是任务拆分和多 worker 分发系统。

本设计新增一个轻量任务分发层，让 RoleMux 可以把大任务拆成标准子任务清单，再按 worker 数量或 provider 配额分发给 `codex`、`claude`、`agy` 等 CLI。设计必须保持 RoleMux 的轻量定位：不做重型 workflow engine，不默认实时互聊，不默认并行修改同一工作区。

## 目标

- 支持把大任务拆成 N 个可审计子任务。
- 支持同 provider 多实例，例如 `codex:2`。
- 支持多 provider worker pool，例如 `codex:2,claude:1,agy:1`。
- 支持显式 worker 数量的快捷分配。
- 支持自动拆分能力，但通过标准 manifest 做边界隔离。
- 写代码类子任务默认使用独立 git worktree，降低并行冲突。
- 默认不自动合并 worker 改动；合并必须由 `merge` 阶段显式处理。
- 输出稳定 JSON 和任务产物，方便 Codex/Claude Skill 或插件调用。

## 非目标

- 不做复杂 DAG workflow engine。
- 不做长期后台 daemon。
- 不要求 tmux、Herdr 或其他终端复用器作为默认依赖。
- 不让多个 worker 默认在同一个工作区并行写代码。
- 不自动解决 merge conflict。
- 不把 provider 真实参数写入 Skill 或插件文档。
- 不把 MCP 作为第一版接口；第一版优先通过 Codex/Claude 插件或 Skill 调 shell 中的 `rolemux` CLI。

## 核心生命周期

```text
rolemux split
  -> 生成标准 subtask manifest

rolemux dispatch
  -> 按 provider 配额或 worker 数量执行 manifest
  -> 每个写任务 worker 使用独立 git worktree
  -> 保存 output、metadata、diff.patch

rolemux merge
  -> 默认预览 patch/diff 和冲突风险
  -> 只有 --auto-merge 才尝试无冲突自动合并
```

## 命令设计

### split

`split` 只负责生成或规范化 manifest，不执行 provider worker。

```powershell
rolemux split --task .\big-task.md --planner codex --out .\rolemux-tasks.json --dry-run
rolemux split --tasks-dir .\tasks --out .\rolemux-tasks.json
rolemux split --manifest .\draft-tasks.json --out .\rolemux-tasks.json
```

第一版建议优先支持：

- `--manifest`：校验并规范化用户或上游生成的 manifest。
- `--tasks-dir`：把目录中的多个 markdown 文件转换为 manifest。
- `--task --planner --out`：作为自动拆分入口，可先做 dry-run 或 schema 校验，再逐步实现真实 planner 调用。

### dispatch

`dispatch` 读取 manifest 并按 worker pool 执行。

```powershell
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1,agy:1 --workdir . --dry-run
```

主语义是 provider 配额：

```text
codex:2,claude:1,agy:1
```

快捷语义是总 worker 数：

```powershell
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex,claude --workers 4
```

当使用快捷语义时，RoleMux 按 provider 列表轮询分配 worker，生成等价的内部 worker pool。

### merge

`merge` 处理 worker 产生的 patch。

```powershell
rolemux merge --parent-task <parent-task-id> --dry-run
rolemux merge --parent-task <parent-task-id> --auto-merge
```

默认行为：

- 读取父任务目录下所有 subtask patch。
- 展示每个 patch 的状态、涉及文件和冲突风险。
- 不修改主工作区。

显式 `--auto-merge` 行为：

- 对无冲突 patch 尝试应用或合并。
- 发生冲突时停止，记录冲突文件和建议下一步。
- 不吞掉失败原因。

## 标准 Manifest

manifest 是 RoleMux 的核心协议。上游可以是大 task markdown、目录、planner provider 输出、用户手写 JSON，或未来插件传入内容；RoleMux 都先转换为标准 manifest。

```json
{
  "version": 1,
  "parentTask": {
    "title": "实现 worker dispatch",
    "source": "big-task.md"
  },
  "defaults": {
    "writePolicy": "isolated",
    "role": "builder"
  },
  "subtasks": [
    {
      "id": "manifest-schema",
      "title": "设计 subtask manifest schema",
      "role": "architect",
      "task": "定义 JSON schema、字段含义和验证规则。",
      "allowedPaths": ["src/core/**", "tests/core/**"],
      "writePolicy": "readonly"
    },
    {
      "id": "worker-pool",
      "title": "实现 worker pool dispatcher",
      "role": "builder",
      "task": "实现 provider 配额解析、队列分发和 dry-run 预览。",
      "allowedPaths": ["src/core/**", "src/commands/**", "tests/**"],
      "writePolicy": "isolated"
    }
  ]
}
```

字段约定：

- `version`：manifest schema 版本。
- `parentTask.title`：父任务标题。
- `parentTask.source`：上游来源，可为文件路径或说明。
- `defaults`：子任务默认值。
- `subtasks[].id`：稳定子任务 id，用于产物目录名。
- `subtasks[].title`：人类可读标题。
- `subtasks[].role`：RoleMux role prompt 名称。
- `subtasks[].provider`：可选固定 provider；未指定时由 dispatcher 分配。
- `subtasks[].task`：发送给 worker 的任务正文。
- `subtasks[].allowedPaths`：建议写入范围，用于提示、审查和合并报告；第一版不伪装成强沙箱。
- `subtasks[].writePolicy`：`readonly` 或 `isolated`。

## 并发与冲突规避

写代码类子任务默认使用独立 git worktree：

```text
主 workdir
  .rolemux/worktrees/{parent-task-id}/{subtask-id}/
```

执行规则：

- `writePolicy=readonly`：可在当前 workdir 并行执行，不收集 patch。
- `writePolicy=isolated`：必须创建独立 worktree。
- 如果当前目录不是 git repository，`isolated` 子任务默认失败并给出可修复错误。
- 每个 worker 只处理自己的 subtask 目录和 worktree。
- 所有 worker 结束后，RoleMux 从 worktree 收集 diff 并保存为 `diff.patch`。
- 合并由 `merge` 命令处理，默认只预览。

这套策略避免多个 CLI 在同一个工作区同时写文件。它不依赖实时通信，而是通过 manifest、metadata、output、diff.patch 和 status 做 artifact-based coordination。

## Backend 选择

第一版默认 `process` backend：

```powershell
rolemux dispatch --backend process
```

`process` backend 由 Node.js 直接 spawn provider CLI，继续复用现有 provider adapter 和 process runner。

未来可增加 `herdr` backend：

```powershell
rolemux dispatch --backend herdr
```

Herdr backend 可以用于创建 workspace/pane、观察 agent 状态、detach/reattach 和读取 pane output。但它不作为默认依赖，原因是 Windows 支持、许可证、安装复杂度和产品轻量边界都需要单独评估。

## 产物结构

新增父任务产物目录：

```text
.rolemux/tasks/{parent-task-id}/
  manifest.json
  summary.md
  metadata.json
  subtasks/
    manifest-schema/
      task.md
      prompt.md
      output.md
      stderr.log
      metadata.json
      diff.patch
      worktree.txt
```

父任务 `metadata.json` 记录：

- command：`split`、`dispatch` 或 `merge`。
- parentTaskId。
- manifest 路径。
- worker pool。
- subtask 状态统计。
- artifact 路径。
- nextCommands。
- warnings。
- requiresUserAction。

子任务 `metadata.json` 记录：

- subtask id/title。
- provider。
- role。
- worker id。
- writePolicy。
- worktree path。
- status。
- exitCode。
- startedAt/finishedAt/durationMs。
- artifacts。

## AI 使用层

为了方便 Codex/Claude 等 AI 模型可靠调用，新增命令应稳定输出 JSON：

```json
{
  "status": "success",
  "parentTaskId": "20260604T120000-abc123",
  "artifactDir": ".rolemux/tasks/20260604T120000-abc123",
  "nextCommands": [
    "rolemux merge --parent-task 20260604T120000-abc123 --dry-run"
  ],
  "warnings": [],
  "requiresUserAction": false
}
```

建议新增：

```powershell
rolemux manifest validate .\rolemux-tasks.json
rolemux dispatch --resume <parent-task-id>
rolemux status --parent-task <parent-task-id>
```

AI 使用规则：

- 默认先 `split --dry-run` 或 `manifest validate`。
- `dispatch --dry-run` 通过后再执行真实 dispatch。
- 默认禁止 `--auto-merge`，除非用户明确要求。
- 执行结束后读取 `nextCommands` 和 artifact，而不是猜测路径。

## 插件包装策略

RoleMux CLI 仍是唯一核心执行层。Codex 插件和 Claude Code 插件只是入口包装。

Codex 插件：

```text
rolemux/
  .codex-plugin/plugin.json
  skills/rolemux-workflow/SKILL.md
  scripts/
```

Claude Code 插件：

```text
claude marketplace
  plugins/rolemux/
    plugin.json
    skills/
    commands/
```

两者都应调用本机 `rolemux` 或 `npx rolemux`，不复制 provider adapter 逻辑。

## 错误码

新增错误应是机器可读的：

```json
{
  "code": "WORKTREE_NOT_AVAILABLE",
  "message": "Isolated write policy requires a git repository.",
  "suggestedFix": "Run inside a git repository or use writePolicy=readonly."
}
```

建议错误码：

- `MANIFEST_INVALID`
- `SUBTASK_ID_DUPLICATED`
- `WORKER_POOL_INVALID`
- `WORKTREE_NOT_AVAILABLE`
- `WORKTREE_CREATE_FAILED`
- `SUBTASK_FAILED`
- `PATCH_COLLECT_FAILED`
- `MERGE_CONFLICT`
- `AUTO_MERGE_NOT_ALLOWED`

## 实施范围建议

第一阶段：

- 定义 manifest 类型和 zod schema。
- 实现 `manifest validate` 或内部 validate API。
- 实现 `split --manifest` 和 `split --tasks-dir`。
- 实现 `dispatch --dry-run`，支持 provider 配额和 worker 快捷语义。
- 写 README/spec/progress 文档。

第二阶段：

- 实现真实 `dispatch`。
- 实现 worker pool。
- 复用 provider adapter/process runner。
- 支持 `readonly` 并行执行和 `isolated` worktree 执行。
- 保存父任务和子任务产物。

第三阶段：

- 实现 patch 收集。
- 实现 `merge --dry-run`。
- 实现 `merge --auto-merge`。
- 补充 status/resume。

第四阶段：

- 实现 planner 自动拆分。
- 加强 Codex/Claude plugin Skill 调用规则。
- 评估 Herdr backend。

## 验证计划

最小验证命令：

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js split --tasks-dir .\tests\fixtures\subtasks --out .\rolemux-tasks.json --dry-run
node .\dist\cli.js dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1 --dry-run
node .\dist\cli.js merge --parent-task <parent-task-id> --dry-run
git diff --check
```

测试重点：

- manifest schema 校验。
- 重复 subtask id 报错。
- provider 配额解析。
- `--workers` 快捷分配。
- dry-run 不创建 provider 进程。
- readonly 子任务并发输出互不覆盖。
- isolated 子任务需要 git repository。
- patch 收集路径不越界。
- `merge --dry-run` 不修改主工作区。
- `--auto-merge` 遇冲突停止并记录。

## 待确认事项

- planner 自动拆分是否第一阶段就真实调用 provider，还是先只定义 prompt 和 schema。
- `allowedPaths` 第一版是否只作为提示和审查字段，还是增加更严格的写入检测。
- worktree 根目录是否固定为 `.rolemux/worktrees/`，还是允许配置到系统临时目录。
- Claude Code plugin marketplace 包装是否与 Codex plugin 同阶段实现。
