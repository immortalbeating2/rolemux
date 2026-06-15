# RoleMux 时间线

## 2026-05-24

- 完成 RoleMux 开发文档初稿：`spec/rolemux-development-spec.md`。
- 形成当前产品方向：轻量多 CLI 工作流插件，采用 Skill + runner + role prompts + task artifacts。
- 明确 MVP 范围：安装器、doctor、run、provider adapter、任务产物、Codex/Claude Skill bundle。
- 生成 UI 概念图并保存到 `spec/assets/rolemux-ui-concept.png`。

## 2026-05-25

- 参考 Ubuntu2 中“多领域工程招投标情报分析平台”的项目级 `AGENTS.md` 结构。
- 为 RoleMux 吸收并裁剪项目级硬约束、规则优先级、Session 接续顺序、subagent 设置和留痕制度。
- 初始化 RoleMux 项目级 `AGENTS.md`。
- 初始化三个进度留痕文档：
  - `docs/progress/status.md`
  - `docs/progress/timeline.md`
  - `docs/progress/logs/2026-05-25.md`
- 初始化 git 仓库，默认分支为 `main`。
- 新增 `.gitattributes`，固定文本文件 LF 行尾并将常见图片格式作为二进制处理。
- 新增 `.gitignore`，排除依赖、构建产物、运行日志、环境变量和 `.rolemux/tasks/`。
- 新增 `docs/dev/code-style.md`，补充代码规范、命名约定、注释约定和提交前检查。
- 新增 `.codex/agents/`，将 researcher、architect、cli-builder、skill-builder、reviewer、docs-keeper 六类 subagent 角色落地为本地角色设置。
- 新增 `spec/phases/`，将 RoleMux 开发内容拆分为 M0-M6 阶段开发文档。
- 新增 `spec/implementation/`，将 M0-M6 拆分为阶段实施文档。
- 更新 `AGENTS.md`，将阶段开发文档、阶段实施文档、阶段读取顺序和退出门禁吸收到项目级规则。
- 创建开发分支 `feature/complete-rolemux-plugin`。
- 按 M0-M6 首轮实现 RoleMux MVP：TypeScript CLI 工程、CLI 命令、provider adapter、task artifact、Skill bundle、roles、HTML report、examples、release checklist。
- 使用 subagents 分担 core/provider/report、CLI commands、Skill/docs/release 和最终只读审查；因部分动态 subagent 工具受限，主会话完成整合与验证。
- 完成验证：typecheck、test、build、CLI dry-run、真实 install 到临时 HOME、npm pack dry-run、git diff whitespace check。
- 推送实现分支到 GitHub：`https://github.com/immortalbeating2/rolemux` 的 `feature/complete-rolemux-plugin`。
- 更新 `README.md` 为 GitHub 首页展示版本，补充中文项目说明、GitHub 安装试用、命令示例、任务产物、Skill 用法、安全默认值和已知限制。
- 将 `package.json` 的构建钩子调整为 `prepare`，使 GitHub 分支安装时可自动构建 `dist/`。

## 2026-05-26

- 使用 Superpowers 的 TDD 流程补充 `rolemux uninstall`。
- 新增 `src/commands/uninstall.ts`，支持 `--dry-run` 与 `--keep-config`。
- 更新 CLI 命令表、README、release checklist 和产品 spec，明确卸载边界：只删除 RoleMux 明确安装的 config、roles 与 Skill bundle，不删除用户项目文件或 `AGENTS.md`。
- 新增发布前 E2E 验收：`npm run test:e2e` 使用 `tests/fixtures/mock-provider.mjs` 覆盖 install、非 dry-run run、status、clean、uninstall。
- 新增 `npm run verify:release`，串联 typecheck、unit test、E2E、npm pack dry-run 和 whitespace check。

## 2026-06-04

- 使用 Superpowers brainstorming 流程收敛 RoleMux 大任务拆分与多 worker 分发方向。
- 确认新生命周期采用 `split -> dispatch -> merge`：先生成标准 subtask manifest，再按 provider worker pool 执行，最后独立审查和合并 patch。
- 确认写代码类并行任务默认使用独立 git worktree，默认不自动合并；`merge --auto-merge` 作为显式 opt-in。
- 确认 Herdr 可作为后续可选 backend，第一版仍以 Node process backend 为默认执行方式。
- 新增设计文档：`docs/superpowers/specs/2026-06-04-task-dispatch-design.md`。
- 新增实施计划：`docs/superpowers/plans/2026-06-04-task-dispatch-phase1.md`。
- 完成任务分发第一阶段实现：manifest schema、worker pool、`manifest validate`、`split`、`dispatch --dry-run`、`merge --dry-run`。

## 2026-06-05

- 修正当前状态文档中的开发分支记录，当前工作分支为 `main`。
- 新增 Phase 2 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase2.md`。
- 完成任务分发 Phase 2：`dispatch` 可真实执行 `writePolicy=readonly` 子任务，保存父任务 `manifest.json`、`summary.md`、`metadata.json` 和嵌套子任务产物。
- Phase 2 明确仍不执行 `writePolicy=isolated`；git worktree、patch 收集和 auto-merge 保留到下一阶段。
- 新增 Phase 3 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase3.md`。
- 完成任务分发 Phase 3：`dispatch` 可真实执行 `writePolicy=isolated` 子任务，按子任务创建 `.rolemux/worktrees/{parent-task-id}/{subtask-id}` git worktree，并收集 `diff.patch` 与 `worktree.txt`。
- 新增 Phase 4 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase4.md`。
- 完成任务分发 Phase 4：`merge --dry-run` 可读取真实 `diff.patch` 并预览涉及文件；`merge --auto-merge` 可显式应用 clean patch。
- 新增 Phase 5 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase5.md`。
- 完成任务分发 Phase 5：`worktree cleanup` 可按父任务 `worktree.txt` 预览并清理 `.rolemux/worktrees/` 下的 managed worktree。
- 新增 Phase 6 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase6.md`。
- 完成任务分发 Phase 6：`dispatch --resume <parent-task-id>` 可读取父任务与子任务 artifact，输出状态摘要、产物路径、diff/worktree 存在性、warning 和下一步命令建议。
- 新增 Phase 7 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase7.md`。
- 完成任务分发 Phase 7：`merge --subtasks one,two` 支持选择性预览和应用指定子任务 patch，未指定时保持全量 patch 行为。
- 新增 Phase 8 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase8.md`。
- 完成任务分发 Phase 8：真实 `dispatch` 执行按 provider quota 限制并发，`merge` 拒绝 `--dry-run --auto-merge` 和空 `--subtasks`，并新增完整 worker CLI E2E。
- 基于交接文档复核本地已安装 RoleMux Skill bundle 与全局 CLI：确认安装文件与仓库源文件 SHA256 一致，重复安装保护生效，Skill 示例 dry-run、worker dispatch dry-run、mock provider 真实 run、typecheck、unit test、E2E 和 whitespace 检查均通过。
- 修复 Codex 非交互执行 stdin 挂起：新增等待 stdin EOF 的 provider fixture 和 process runner 回归测试，在 `runProcess` 中显式关闭 child stdin，并用真实 `rolemux run --provider codex` 复测成功。

## 2026-06-06

- 使用 Superpowers 和已安装的 RoleMux workflow 创建三 CLI dispatch 插件验证方案：`docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.md`。
- 新增三 provider manifest：`docs/superpowers/plans/2026-06-06-three-cli-dispatch-plugin-validation.manifest.json`，将只读开发型审查任务固定分配给 `codex`、`claude`、`agy`。
- 通过 subagent-driven 流程派出只读子代理 Euclid 审查方案；根据反馈补充 provider availability、git status 前后对比、prompt artifact 检查和结构化 artifact 汇总。
- 执行真实 dispatch：parent task id `20260606T130912-8d79f3`，resume 显示 3 个子任务 metadata 均 success。
- Artifact 分析发现：Claude 输出有效；Codex 进程成功但嵌套工具调用受 Windows sandbox `CryptUnprotectData failed` 阻断；Agy exit 0 但 output/stderr 为空；dispatch metadata 记录的 duration 为 0，不反映真实 310 秒执行耗时。
- 修复三 CLI dispatch 暴露的 RoleMux 侧问题：provider exit 0 但 stdout 为空会被 `runWorkflow` 标记为 failed；Agy adapter 改为 `--print <prompt> --add-dir <workdir>`；dispatch parent/subtask metadata 使用真实 workflow timing。

## 2026-06-07

- 复测真实 Agy CLI：交互式 Agy 已登录；非交互 `agy --print` 日志显示 silent auth 成功并进入模型 stream，但 stdout/stderr 仍为空且 exit 0。
- 复测真实 Codex nested worker：简单读 `AGENTS.md` 可成功，但多文件审查会触发 Windows sandbox `CryptUnprotectData failed: 2148073483`，`--sandbox read-only` 不能解决。
- 修复 RoleMux 侧误判：Codex 输出/错误中出现 `CryptUnprotectData failed` 时标记 failed；Agy 空输出继续标记 failed。
- 新增显式 opt-in 配置：`ROLEMUX_CODEX_SANDBOX` 和 `ROLEMUX_AGY_PRINT_TIMEOUT`。
- 修复单任务 `run` metadata duration，使真实 provider 等待时间能写入 task artifact。
- 用户确认最新参考仓库为 `fengshao1227/ccg-workflow`；已核对远端 HEAD `1d0a08912fb7ab83b064038ee1539d6d5137da57`，其 Antigravity 后端使用 `--add-dir <workdir> -p <prompt>`，且注释要求 `-p` 紧贴 prompt。
- 根据真实诊断确认 Agy 1.0.6 能在 PTY/TUI 路径输出模型文本，但普通 stdout pipe 捕获不到；RoleMux 新增 `node-pty` PTY transport，并将 Agy adapter 调整为 `agy.exe` on Windows、`--add-dir <workdir> [--print-timeout X] -p <prompt>`。
- 修复 Windows ConPTY 清理：真实 Agy 已生成 success artifact 但 CLI 曾因 headless `conhost.exe` 未释放而不退出；现在正常退出后安静释放 PTY 句柄，不再输出 `AttachConsole failed`。
- 真实 Agy `rolemux run` 复测成功：task id `20260607T080154-484c6c`，`output.md` 为 `AGY_OK`，metadata status 为 `success`、exitCode 为 0、durationMs 为 13182。
- 使用 subagents 调研最新 `ccg-workflow` 与 RoleMux dispatch 链路，形成 Codex context-pack 修复方案：`docs/superpowers/plans/2026-06-07-codex-context-pack-dispatch.md`。
- 新增三 CLI 验证 manifest：`docs/superpowers/plans/2026-06-07-codex-context-pack-validation.manifest.json`，预设 Codex/Claude/Agy 三个 worker 的完成标记。
- 修复 Codex Windows nested worker 真实调用链：通过 `cmd.exe /d /s /c codex.cmd` 启动 npm shim；默认增加 `--skip-git-repo-check --disable plugins --ignore-rules`；Codex prompt 改走 stdin，避免 Windows `cmd.exe` 截断多行 argv。
- 新增 readonly Codex context-pack：dispatch 只读取 manifest `allowedPaths` 下的 allowlist 文件，跳过敏感/越界路径，把内容注入 prompt，并在系统临时空目录执行 nested Codex，避免仓库 `AGENTS.md` 和项目规则触发 Windows credential 解密失败。
- 真实三 CLI dispatch 复测成功：parent task `20260607T095530-69244a`，Codex、Claude、Agy 输出分别包含 `EXPECTED_CODEX_CONTEXT_PACK_OK`、`EXPECTED_CLAUDE_ARTIFACT_CHECK_OK`、`EXPECTED_AGY_SUMMARY_OK`。
- `npm run verify:release` 通过：unit test 25 个 files / 80 个 tests，E2E 3 个 files / 3 个 tests，`npm pack --dry-run` 与 `git diff --check` 通过。

## 2026-06-08

- 使用 `plugin-creator` 脚手架生成 RoleMux 个人插件源：`C:\Users\peng8\plugins\rolemux`。
- 新增个人 marketplace 条目：`C:\Users\peng8\.agents\plugins\marketplace.json`，插件名为 `rolemux@personal`。
- 将仓库 Codex Skill 复制到插件 `skills/rolemux-workflow/SKILL.md`，并补充 Windows Codex App 下的 `Get-Command rolemux` 前置检查。
- 更新插件 `.codex-plugin/plugin.json` 为 RoleMux 实际元数据、默认 prompt、能力标签和 GitHub 链接。
- 安装插件：`codex plugin add rolemux@personal`；缓存位置为 `C:\Users\peng8\.codex\plugins\cache\personal\rolemux\0.1.0`。
- 验证插件源和缓存副本均通过 `validate_plugin.py`；`codex plugin list` 显示 `rolemux@personal` 为 `installed, enabled`；全局 `rolemux --version` 返回 `0.1.0`。

## 2026-06-15

- 根据用户确认的 RoleMux Agents Monitor 计划，新增后台多 CLI agent dispatch 监控能力。
- `dispatch --detach` 现在预分配 parent task id，写入 `.rolemux/tasks/{parent-task-id}/monitor.json`、`events.jsonl`、`summary.md` 和 `control/`，并通过隐藏内部入口 `_dispatch-runner` 启动后台执行。
- 新增 `rolemux agents` 与 `rolemux cancel --parent-task <id>`：支持 active dispatch 列表、表格视图、稳定 JSON snapshot、终端 TUI 和幂等取消请求。
- 扩展 process/PTY runner、workflow runner 和 dispatch runner，支持 AbortSignal 取消；后台 runner 会检测 `control/cancel.json`，取消未完成 agent 并保留已完成产物。
- 新增 `src/core/agents-monitor.ts`、`src/core/agents-tui.ts`、`src/commands/agents.ts`、`src/commands/cancel.ts` 及对应测试。
- 更新 README、产品 spec、Codex/Claude Skill，明确默认用 `dispatch --detach + agents --json` 生成对话内监控卡片，人类按需另开终端运行 `agents --tui`。

## 后续计划

- M0：已完成首轮实现；后续可补更严格 lint 配置。
- M1：已完成首轮实现；`install`、`uninstall`、`doctor`、`run --dry-run` 可运行。
- M2：已完成首轮实现；provider adapter 集中在 `src/providers/`，process runner 使用参数数组。
- M3：已完成首轮实现；task store 可写入 metadata、核心产物和 HTML report。
- M4：已完成首轮实现；Codex/Claude Skill bundle 与默认 role prompts 已存在。
- M5：已完成首轮实现；`plan`、`review`、`discuss` 支持 dry-run，fallback core 已实现。
- M6：已完成首轮实现；README、examples、release checklist、GitHub 安装说明、npm pack 文件清单已验证。
- 下一阶段建议：继续关注 Agy 1.0.6 官方机器可读 stdout/JSON 输出方式；必要时在用户明确接受风险后用 `ROLEMUX_CODEX_SANDBOX=danger-full-access` 诊断 Codex Windows sandbox；继续实现失败子任务重新执行、插件调用规则和可选 worktree branch 清理。
