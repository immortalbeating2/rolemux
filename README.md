# RoleMux

RoleMux 是一个轻量级多 AI CLI 角色编排工具，用来在本地把 `codex`、`claude`、`agy` 等 CLI 按角色组织起来，完成规划、实现、审查、讨论和结果留痕。

它不是云端 agent 平台，也不是完整 workflow dashboard。RoleMux 的核心目标是保持轻量：一个 npm CLI、几个 provider adapter、一组 role prompts、Codex/Claude Skill bundle，以及可审计的任务产物目录。

## 当前状态

- 阶段：MVP 首轮实现完成。
- 当前可用分支：`main`。
- 当前安装方式：推荐从 GitHub 源码或当前分支安装试用。
- npm 状态：尚未正式发布到 npm；发布后才推荐直接使用 `npx rolemux install`。
- 默认安全边界：不会默认修改用户项目的 `AGENTS.md`，不会默认使用危险 bypass/sandbox 参数。

## 已实现功能

- `rolemux install`：安装默认配置、roles、Codex Skill、Claude Skill。
- `rolemux uninstall`：卸载 RoleMux 安装的配置、roles 和 Skill bundle，支持 dry-run。
- `rolemux doctor`：检查 `codex`、`claude`、`agy` 是否可用。
- `rolemux run`：按 provider + role 执行单个任务，支持 `--dry-run`。
- `rolemux plan`：让一个或多个 provider 生成计划。
- `rolemux review`：让指定 provider 以 reviewer 角色审查任务。
- `rolemux discuss`：生成多 provider 讨论工作流，支持 `parallel` / `serial` 模式。
- `rolemux status`：查看最近任务产物摘要。
- `rolemux clean`：清理任务产物，支持 dry-run。
- `.rolemux/tasks/{task-id}/`：保存任务输入、prompt、输出、stderr、metadata 和 HTML report。
- 默认 roles：`architect`、`builder`、`reviewer`、`frontend-reviewer`、`summarizer`。

## 工作原理

RoleMux 分为四层：

1. CLI command layer：解析命令参数并输出结果。
2. Core layer：处理 prompt 构建、role 加载、任务存储、fallback、进程执行。
3. Provider adapter layer：集中封装 `codex`、`claude`、`agy` 的真实命令和参数。
4. Skill/role layer：给 Codex 和 Claude 提供触发说明，并给不同任务注入角色提示词。

核心目录：

```text
src/commands/      CLI 命令实现
src/core/          prompt、task store、process runner、fallback 等核心逻辑
src/providers/     codex、claude、agy provider adapter
skills/            Codex / Claude Skill bundle
roles/             默认角色 prompt
templates/         默认配置和 report 模板
examples/          示例任务和 mock provider 说明
docs/release/      发布检查清单
```

## 环境要求

- Node.js 20 或更高版本。
- Windows PowerShell、macOS shell 或 Linux shell。
- 可选安装本地 provider CLI：`codex`、`claude`、`agy`。

没有安装 provider CLI 也可以先使用 `--dry-run` 验证命令、prompt 和安装目标。

## 从 GitHub 安装试用

当前仓库还没有发布 npm 包，推荐先从 GitHub 分支安装。

直接全局安装当前实现分支：

```powershell
npm install -g github:immortalbeating2/rolemux#main
rolemux --help
```

或者克隆源码后本地运行：

```powershell
git clone https://github.com/immortalbeating2/rolemux.git
cd rolemux
git checkout main
npm install
npm run build
node .\dist\cli.js --help
```

本地开发时也可以链接成全局命令：

```powershell
npm link
rolemux --help
```

## 初始化 RoleMux

预览将要安装的文件，不写入：

```powershell
rolemux install --dry-run
```

执行安装：

```powershell
rolemux install
```

默认会写入：

```text
~/.rolemux/config.toml
~/.rolemux/roles/
~/.codex/skills/rolemux-workflow/
~/.claude/skills/rolemux-workflow/
```

默认不会修改用户项目的 `AGENTS.md`。如后续启用 `--with-agents`，也应作为显式 opt-in 行为。

## 卸载 RoleMux

预览卸载目标，不删除文件：

```powershell
rolemux uninstall --dry-run
```

执行卸载：

```powershell
rolemux uninstall
```

保留全局配置，只卸载 roles 和 Skill bundle：

```powershell
rolemux uninstall --keep-config
```

默认卸载目标：

```text
~/.rolemux/config.toml
~/.rolemux/roles/
~/.codex/skills/rolemux-workflow/
~/.claude/skills/rolemux-workflow/
```

卸载命令不会删除用户项目文件，不会修改 `AGENTS.md`，也不会删除 `~/.rolemux` 下未列入目标的自定义文件。

## 常用命令

检查 provider：

```powershell
rolemux doctor
```

只检查 Codex：

```powershell
rolemux doctor --providers codex
```

预览单 provider 任务：

```powershell
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

让 Codex 和 Claude 生成计划：

```powershell
rolemux plan --providers codex,claude --task .\examples\basic-task.md --workdir . --dry-run
```

让 Codex 执行审查：

```powershell
rolemux review --provider codex --role reviewer --task .\examples\basic-task.md --workdir . --dry-run
```

预览多 provider 讨论：

```powershell
rolemux discuss --providers codex,claude,agy --task .\examples\basic-task.md --workdir . --mode parallel --dry-run
```

大任务拆分与分发：

```powershell
rolemux split --tasks-dir .\tasks --out .\rolemux-tasks.json --dry-run
rolemux manifest validate --manifest .\rolemux-tasks.json
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1 --dry-run
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex,claude --workers 4 --dry-run
rolemux dispatch --manifest .\rolemux-tasks.json --providers codex:2,claude:1 --workdir .
rolemux merge --parent-task <parent-task-id> --workdir . --dry-run
rolemux merge --parent-task <parent-task-id> --workdir . --auto-merge
```

当前任务分发阶段支持真实执行 `writePolicy=readonly` 和 `writePolicy=isolated` 的子任务。`isolated` 子任务会在 `.rolemux/worktrees/{parent-task-id}/{subtask-id}` 下创建独立 git worktree，provider 在该 worktree 内运行，执行后将 `git diff --binary HEAD` 保存为子任务产物 `diff.patch`，并把 worktree 绝对路径写入 `worktree.txt`。`merge --dry-run` 会读取真实 `diff.patch` 并预览涉及文件；`merge --auto-merge` 作为显式 opt-in，会先用 `git apply --check` 检查所有 patch，再应用 clean patch。冲突自动解决、按子任务选择性应用和 worktree 自动清理仍是后续能力。

查看任务产物：

```powershell
rolemux status --workdir .
```

清理任务产物预览：

```powershell
rolemux clean --workdir . --dry-run
```

## 任务产物

真实运行会写入：

```text
.rolemux/tasks/{task-id}/
```

任务分发运行会写入父任务目录：

```text
.rolemux/tasks/{parent-task-id}/
  manifest.json
  summary.md
  metadata.json
  subtasks/{subtask-id}/
    task.md
    prompt.md
    output.md
    stderr.log
    diff.patch       # 仅 isolated 子任务存在
    worktree.txt     # 仅 isolated 子任务存在
    metadata.json
```

主要文件：

- `task.md`：原始任务内容。
- `prompt.md`：最终发送给 provider 的 prompt。
- `output.md`：provider 输出。
- `stderr.log`：错误输出。
- `diff.patch`：isolated 子任务的 git patch，包含新增未跟踪文件。
- `worktree.txt`：isolated 子任务使用的 git worktree 绝对路径。
- `metadata.json`：provider、role、状态、退出码、时间和 fallback attempts。
- `report.html`：静态 HTML 报告。

## 配置

默认配置模板在 `templates/config.toml`。

示例：

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
```

## Skill 用法

RoleMux 包含两个 Skill bundle：

```text
skills/codex/rolemux-workflow/SKILL.md
skills/claude/rolemux-workflow/SKILL.md
```

这些 Skill 用于在 Codex 或 Claude 中触发 RoleMux，例如用户要求：

- 多 CLI 协作
- 用不同角色并行分析
- 让外部 provider 生成计划或审查
- 保存可审计任务产物
- 进行 Codex / Claude / Agy 多方讨论

Skill 只负责说明何时调用 `rolemux`，provider 的底层参数仍由 `src/providers/` adapter 层统一封装。

## 开发

安装依赖：

```powershell
npm install
```

运行检查：

```powershell
npm run typecheck
npm test
npm run test:e2e
npm run build
git diff --check
```

发布前检查：

```powershell
npm run verify:release
```

或者手动执行：

```powershell
npm pack --dry-run
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js install --dry-run
node .\dist\cli.js uninstall --dry-run
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
```

更多发布检查见 `docs/release/checklist.md`。

## 安全默认值

- 默认不读取、记录或输出 secrets、tokens、cookies、私有账号信息或凭据文件。
- 默认不修改用户项目 `AGENTS.md`。
- 默认不使用危险 sandbox bypass 参数。
- `uninstall` 只删除 RoleMux 明确安装的目标路径，保留未列入目标的用户自定义文件。
- 外部命令通过 provider adapter 和参数数组集中构造。
- 测试优先使用 dry-run、fixture、临时目录或 mock provider。
- `.rolemux/tasks/` 和 `.rolemux/worktrees/` 运行产物不应提交到仓库。

## 已知限制

- 当前是 MVP，本地 CLI 编排和静态产物优先。
- npm 包尚未正式发布，当前推荐从 GitHub 分支或源码安装。
- 真实 provider CLI 参数可能随版本变化，需要通过 adapter 层持续维护。
- isolated dispatch 目前可通过 `merge --auto-merge` 应用 clean patch，但尚不会自动解决冲突、按子任务选择性应用 patch 或清理 worktree。
- 完整 Web dashboard、云端 workflow 服务、插件市场和账号系统不在 MVP 范围内。
- Windows 路径、空格路径和 shell quoting 需要持续纳入发布验证。

## License

MIT
