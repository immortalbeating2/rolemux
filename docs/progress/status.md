# RoleMux 当前状态

更新时间：2026-06-05
当前阶段：RoleMux MVP 已按 M0-M6 完成首轮实现；大任务分发 Phase 2 真实 readonly dispatch 执行层已实现

## 当前真实状态

- 已有产品开发文档：`spec/rolemux-development-spec.md`。
- 已有 UI 概念图：`spec/assets/rolemux-ui-concept.png`。
- 本次新增项目级代理约束：`AGENTS.md`。
- 本次初始化三类进度留痕文档：
  - `docs/progress/status.md`
  - `docs/progress/timeline.md`
  - `docs/progress/logs/2026-05-25.md`
- 本次初始化 git 仓库，默认分支为 `main`。
- 本次新增 `.gitattributes`，固定文本文件 LF 行尾并将常见图片格式作为二进制处理。
- 本次新增 `.gitignore`，排除依赖、构建产物、运行日志、环境变量和 `.rolemux/tasks/` 运行产物。
- 本次新增 `docs/dev/code-style.md`，约束 TypeScript、模块边界、命名、注释和提交前检查。
- 本次新增 `.codex/agents/`，保存 RoleMux 本地 subagent 角色设置和 prompt 片段。
- 本次新增 `spec/phases/`，将 M0-M6 拆分为阶段开发文档。
- 本次新增 `spec/implementation/`，将 M0-M6 拆分为阶段实施文档。
- 本次更新 `AGENTS.md`，把阶段开发文档、阶段实施文档和读取门禁吸收到项目级规则。
- 已新增 TypeScript CLI 工程：`package.json`、`tsconfig.json`、`src/`、`tests/`、`dist/` 构建输出。
- 已实现 CLI 命令：`install`、`doctor`、`run`、`status`、`clean`、`plan`、`review`、`discuss`。
- 已实现 core/provider/report 模块：provider adapter、process runner、task store、metadata、fallback、prompt builder、HTML report。
- 已新增 Codex/Claude Skill bundle、默认 roles、config/report 模板、examples 和 release checklist。
- 当前开发分支：`main`。
- 已推送远程仓库：`https://github.com/immortalbeating2/rolemux`。
- 已更新 `README.md`，补充项目定位、当前状态、GitHub 分支安装、常用命令、任务产物、Skill 用法、开发验证和安全默认值。
- 已在 `package.json` 增加 `prepare` 脚本，支持从 GitHub 安装时自动构建 `dist/`。
- 本轮新增 `rolemux uninstall`，支持 `--dry-run` 和 `--keep-config`，用于卸载 RoleMux 安装的 config、roles、Codex Skill 和 Claude Skill。
- 本轮新增 `npm run test:e2e` 与 `npm run verify:release`，覆盖 mock provider 非 dry-run 的 install -> run -> status -> clean -> uninstall 验收流。
- 本轮新增 Superpowers brainstorming 设计文档：`docs/superpowers/specs/2026-06-04-task-dispatch-design.md`，确定下一阶段采用 `split -> dispatch -> merge` 生命周期。
- 本轮新增实施计划：`docs/superpowers/plans/2026-06-04-task-dispatch-phase1.md`。
- 本轮已完成任务分发第一阶段实现：标准 subtask manifest schema、provider worker pool 解析、`manifest validate`、`split`、`dispatch --dry-run`、`merge --dry-run`。
- 本轮新增 Phase 2 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase2.md`。
- 本轮已完成任务分发 Phase 2：`dispatch` 可真实执行 `writePolicy=readonly` 子任务，复用 provider adapter/process runner，并写入父任务与嵌套子任务产物。
- 下一阶段设计结论：标准 subtask manifest 作为核心契约；provider worker pool 支持 `codex:2,claude:1,agy:1` 和 `--workers N` 快捷语义；写代码 worker 默认独立 git worktree；默认不自动合并，`merge --auto-merge` 显式 opt-in。

## 产品基线

RoleMux 是一个轻量多 CLI 工作流插件/工具包：

- 通过 npm/npx 安装。
- 通过 Codex Skill / Claude Skill 按需触发。
- 通过 runner 统一调用 `codex`、`claude`、`agy`。
- 通过 role prompt 赋予不同模型不同职责。
- 通过 `.rolemux/tasks/{task-id}/` 保存任务输入、运行日志、输出和审查结果。
- 默认不要求用户项目修改 `AGENTS.md`。

## 当前约束

- 任何后续开发必须先读取 `AGENTS.md` 和本状态文档。
- 三个留痕文档必须持续维护：`status.md`、`timeline.md`、`logs/YYYY-MM-DD.md`。
- 大功能开始前必须读取 `spec/rolemux-development-spec.md`。
- 阶段开发前必须读取 `spec/phases/README.md`、对应 `spec/phases/m*.md`、`spec/implementation/README.md` 和对应 `spec/implementation/*-plan.md`。
- 修改源码、测试、Skill 或 role prompt 前必须读取 `docs/dev/code-style.md`。
- 启用 subagent 前必须读取 `.codex/agents/` 中对应角色设置，并明确文件所有权。
- 未验证不得声称完成。
- 影响 CLI、provider、Skill、role、安装行为或 task artifact 的改动必须同步更新文档。

## 下一步建议

1. 提交并推送 E2E 验收脚本与 mock provider 测试。
2. 根据用户选择决定是否将 `feature/complete-rolemux-plugin` 合并或同步为远程默认分支。
3. npm 正式发布前补一次真实包安装验收。
4. 若继续推进大任务分发能力，下一步按设计文档实现 git worktree 隔离、patch 收集、`merge --auto-merge`、`dispatch --resume` 和插件调用规则。

## 本次验证记录

2026-05-25 已执行 M0-M6 MVP 实现验证：

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js install --dry-run
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
node .\dist\cli.js plan --providers codex,claude --task .\examples\basic-task.md --workdir . --dry-run
node .\dist\cli.js review --provider codex --task .\examples\basic-task.md --workdir . --dry-run
node .\dist\cli.js discuss --providers codex,claude,agy --task .\examples\basic-task.md --workdir . --mode parallel --dry-run
npm pack --dry-run
git diff --check
```

结果：typecheck 通过；测试通过，11 个 test files / 15 个 tests；build 通过并生成 `dist/cli.js` 与 `dist/cli.d.ts`；CLI dry-run 命令均 exit 0；`npm pack --dry-run` 包含 `dist`、`skills`、`roles`、`templates`、`examples`、`docs/release/checklist.md`、`README.md`、`LICENSE`；`git diff --check` 无 whitespace 问题。

最终审查反馈处理后补充验证：测试增加到 17 个；`review --role reviewer --dry-run` 可执行且 prompt 包含默认 reviewer role prompt；`doctor --providers codex` 在只检查 codex 时返回 `ok: true`；`discuss --mode nope --dry-run` 正确返回非零；`npm pack --dry-run` 会触发 `prepack` 自动 build。

已额外用临时 HOME 执行真实 install 验证，确认生成：

```text
.rolemux/config.toml
.rolemux/roles/builder.md
.codex/skills/rolemux-workflow/SKILL.md
.claude/skills/rolemux-workflow/SKILL.md
```

2026-05-25 已执行阶段文档与实施文档检查：

```powershell
(Get-ChildItem -LiteralPath 'spec\phases' -File | Measure-Object).Count
(Get-ChildItem -LiteralPath 'spec\implementation' -File | Measure-Object).Count
Select-String -LiteralPath 'AGENTS.md' -Pattern 'spec/phases/README.md','spec/implementation/README.md','m0-project-initialization-plan.md','阶段开发必须读取','Session 接续顺序','阶段推进、阶段退出标准'
$json = Get-Content -LiteralPath '.codex\agents\agents.json' -Raw | ConvertFrom-Json; $json.rootInstructions | Select-String -Pattern 'spec/phases','spec/implementation'; ($json.agents | Measure-Object).Count
rg -n "TBD|待验证|将在本轮最终检查后补充|当前尚未初始化 git" AGENTS.md spec docs .codex/agents --glob '!docs/progress/*'
```

结果：`spec/phases/` 包含 8 个文件，`spec/implementation/` 包含 8 个文件；`AGENTS.md` 已包含阶段/实施文档入口、M0 实施文档、阶段读取门禁和 Session 接续规则；`.codex/agents/agents.json` 可解析并包含阶段/实施文档读取指令；排除进度日志后的占位符扫描未发现残留声明。

2026-05-25 已执行 git、规范文档和 `.codex/agents/` 检查：

```powershell
git branch --show-current
Test-Path -LiteralPath '.git'
Test-Path -LiteralPath '.gitignore'
Test-Path -LiteralPath 'docs\dev\code-style.md'
Test-Path -LiteralPath '.codex\agents\agents.json'
Test-Path -LiteralPath '.codex\agents\rolemux-cli-builder.md'
Test-Path -LiteralPath '.codex\agents\rolemux-reviewer.md'
$json = Get-Content -LiteralPath '.codex\agents\agents.json' -Raw | ConvertFrom-Json; ($json.agents | Measure-Object).Count; ($json.agents.name -join ',')
Select-String -LiteralPath 'AGENTS.md' -Pattern 'docs/dev/code-style.md','.codex/agents/','导出的函数','provider 参数'
Select-String -LiteralPath 'docs\dev\code-style.md' -Pattern '必须写注释的场景','导出的函数','外部命令必须优先使用参数数组','TypeScript 默认启用'
```

结果：当前分支为 `main`；`.git`、`.gitignore`、`docs/dev/code-style.md`、`.codex/agents/agents.json`、关键角色文件均存在；`agents.json` 可解析且包含 6 个角色；`AGENTS.md` 已引用代码规范和 `.codex/agents/`；代码规范包含强制注释场景、导出 API 注释和参数数组约束。

2026-05-25 已执行文件存在性与关键内容检查：

```powershell
Test-Path -LiteralPath 'AGENTS.md'
Test-Path -LiteralPath 'docs\progress\status.md'
Test-Path -LiteralPath 'docs\progress\timeline.md'
Test-Path -LiteralPath 'docs\progress\logs\2026-05-25.md'
Select-String -LiteralPath 'AGENTS.md' -Pattern 'Subagent 设置','docs/progress/status.md','docs/progress/timeline.md','docs/progress/logs/YYYY-MM-DD.md','rolemux-cli-builder','rolemux-skill-builder','rolemux-reviewer'
Get-ChildItem -Recurse -File -LiteralPath 'docs\progress'
```

结果：四个目标文件均存在；`AGENTS.md` 包含 subagent 设置、三个留痕文档路径和关键 agent 角色。

## 已知风险

- 真实 `codex`、`claude`、`agy` CLI 参数可能随版本变化，后续必须用 `doctor` 和 adapter 层缓冲。
- Windows 路径与 shell quoting 是高风险点，后续必须以参数数组执行外部命令。
- Windows 下使用 `.cmd` 模拟 provider 时可能被真实全局 CLI 抢先解析；本轮没有执行真实 provider mock run，已通过 provider adapter 参数数组测试、process runner 测试和 CLI dry-run 降低风险。
