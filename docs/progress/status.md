# RoleMux 当前状态

更新时间：2026-08-09
当前阶段：RoleMux MVP 已按 M0-M6 完成；provider preflight、可选深度 probe、Claude/Agy 原生子代理监控与 Windows 非交互 provider 兼容已实现；Codex/Grok/OpenCode 的原生实时监控保持 capability blocked；未引入 DAG、数据库、Dashboard、ML router 或新依赖

## 当前真实状态

- 2026-08-04 所有真实 `run/plan/review/discuss/dispatch` 在启动任何 provider 前统一执行 executable preflight；缺失 provider 返回结构化 `blocked`，不会部分启动。`doctor --probe` 可分类 `auth/network/output/process/timeout`。
- `dispatch --native-agents` 作为显式 opt-in，把 Claude `task_started/task_notification` 与 Agy `subagent ACTIVE/DONE` 映射到现有 `monitor.json`、`events.jsonl` 和共享 TUI 的嵌套 `nativeAgents[]`；child 不改变顶层 worker 总数或写入边界。
- 顶层 fan-out monitor 已使用事务化 read-modify-write，避免并发 worker 状态互相覆盖；每个 provider 完成立即写 terminal 状态与真实计时，父产物完成后再写 `agent-artifact`；读取时动态刷新 running elapsed。
- detached monitor 在子任务产物写入前保持父状态为 `running`，避免调用方读到 provider success 但 `output.md` 尚未落盘的中间状态。
- Skill 默认只在至少两个独立且预计约 30 秒以上的子任务中选择 fan-out；普通执行只做 executable preflight，深度 probe 保留给首次/状态变化/失败或高成本不确定场景。
- Windows PowerShell wrapper 的代理环境不会自动传给子进程；Agy 非交互模式可用 `ROLEMUX_AGY_TRANSPORT=process` + `stream-json`，并支持 `ROLEMUX_AGY_PRINT_TIMEOUT`，不默认绕过 provider 权限。
- 真实认证矩阵：Claude、Agy 支持；Codex 本机两次 `collab spawn failed`；Grok 原生 spawn 调用失败且认证刷新有告警；OpenCode 只在完成后输出 child tool event。后三者不做文本启发式解析。
- 本轮 release gate：35 个 test files / 169 项 unit tests、3 项 CLI E2E、build、pack dry-run、CLI smoke、`git diff --check` 全部通过；插件源与 Codex cache Skill SHA-256 一致。

- 2026-08-01 新增 `run --result-json --max-attempts --timeout-ms`、`route`、`discuss --mode structured`；旧 CLI 默认路径、`output.md` 和旧 metadata 解析保持兼容。
- structured workflow 固定为独立候选并行 → 匿名 counter-review → `executable + args[]` 验证 → 单一 synthesis；counter 失败立即停止，真实 verification 覆盖模型自报并写入最终 `result.json`。
- 新运行 metadata 记录 Git HEAD、prompt/config SHA-256、provider executable/version、model 报告状态和显式预算消耗；dispatch 子任务也记录 provenance。
- provider adapter 声明五类 task kind capability；`route` 依据固定优先级、doctor/显式 availability、exclude 与 maxProviders 选择，显式 providers 始终覆盖路由。
- Eval Pack 已升级为 v2/26 案例/10 次调用，新增六项证据工作流事实；旧 v1 pack 仍可解析。
- 真实 smoke：Grok candidate timeout；OpenCode candidate success/counter timeout；Codex candidate success/counter timeout。未取得真实 provider 完整 synthesis success，已如实保存 `validation/evidence-workflows/real-smoke-summary.json`；现场推动修复 counter 失败后继续执行和 Windows shell 子进程树超时两个问题。
- 最终质量门：33 个 test files / 141 项 unit tests、3 项 CLI E2E、typecheck、build、pack dry-run、CLI smoke、`git diff --check` 全部通过；runtime `npm audit --omit=dev --audit-level=high` 为 0 vulnerabilities。
- 2026-08-01 Eval Pack 当前为 v2/26 案例：复用现有 adapter、role prompt、workflow runner 和临时 detached worktree，执行 1+4+5 共 10 次调用；原始 runs 默认忽略，v1 首次真实结果保存在 `validation/eval-pack/`，v2 尚未重跑完整 10-call provider 对比。
- 首次真实 Eval Pack 基于 HEAD `75c1afe`：单模型 `100%`、无结构多 CLI `98.85%`、结构化 RoleMux `100%`；三模式最终输出均成功，但 Claude 两次未登录失败、Grok 在无结构模式超时、Codex architect 在结构化模式超时。该结果表明本 pack 中结构化模式与单模型正确率打平，主要验证了失败可见性、审计产物和部分候选失败下的汇总韧性，而非普遍质量提升。

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
- 2026-07-13 新增官方 Grok Build provider：`grok` 使用单轮 plain 输出，默认禁用 Grok 内部 subagents 和跨 session memory，不启用危险权限 bypass；provider 名称改为共享 tuple，供 CLI、doctor、worker pool 和 manifest schema 复用。
- 2026-07-31 新增 OpenCode provider：`opencode` 使用 `run --pure` 非交互模式，Windows 直接启动官方 `opencode.exe`，不经过会重解释多行与 `%` 的 npm `.cmd` shim，默认不启用危险 `--auto`。
- OpenCode 1.18.10 已通过真实只读、isolated write、core timeout、真实 fallback、后台 cancel 与 Windows PTY agents TUI 认证；所有临时认证目录和进程已清理。
- Codex 插件、Claude junction 目标和 `.agents-skills` 保留副本已同步到当前通用 Skill，6 份 SHA-256 一致。
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
- 本轮新增 Phase 3 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase3.md`。
- 本轮已完成任务分发 Phase 3：`dispatch` 可真实执行 `writePolicy=isolated` 子任务，在 `.rolemux/worktrees/{parent-task-id}/{subtask-id}` 创建独立 git worktree，运行后收集 `diff.patch` 并记录 `worktree.txt`。
- 本轮新增 Phase 4 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase4.md`。
- 本轮已完成任务分发 Phase 4：`merge --dry-run` 可读取真实 `diff.patch` 并预览涉及文件；`merge --auto-merge` 作为显式 opt-in，会先 `git apply --check` 再应用 clean patch。
- 本轮新增 Phase 5 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase5.md`。
- 本轮已完成任务分发 Phase 5：`worktree cleanup` 可按父任务 `worktree.txt` 预览并清理 `.rolemux/worktrees/` 下的 managed worktree，不删除任务产物或 git branch。
- 本轮新增 Phase 6 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase6.md`。
- 本轮已完成任务分发 Phase 6：`dispatch --resume <parent-task-id>` 可从既有父任务产物恢复分发摘要，输出子任务状态、产物路径、diff/worktree 存在性和下一步命令建议；当前不会重新执行失败 provider。
- 本轮新增 Phase 7 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase7.md`。
- 本轮已完成任务分发 Phase 7：`merge --subtasks one,two` 可只预览或应用指定子任务的 `diff.patch`；未指定时保持处理全部 patch，指定子任务缺少 patch 时返回 `NOT_FOUND`。
- 本轮新增 Phase 8 实施计划：`docs/superpowers/plans/2026-06-05-task-dispatch-phase8.md`。
- 本轮已完成任务分发 Phase 8：真实 `dispatch` 执行会按 provider quota 限制并发；`merge --dry-run --auto-merge` 和空 `--subtasks` 会返回 `INVALID_ARGUMENT`；新增 worker CLI E2E 覆盖 manifest validate、dispatch、resume、选择性 merge 和 cleanup dry-run。
- 下一阶段设计结论：标准 subtask manifest 作为核心契约；provider worker pool 支持 `codex:2,claude:1,agy:1,grok:1,opencode:1` 和 `--workers N` 快捷语义；写代码 worker 默认独立 git worktree；默认只预览合并，`merge --auto-merge` 必须显式 opt-in，worktree 清理必须显式调用。
- 本轮基于交接文档完成本地已安装 RoleMux Skill bundle 与全局 `rolemux` CLI 复核验证：安装目标存在且与仓库源文件 SHA256 一致，CLI dry-run、worker dispatch dry-run、mock provider 真实 run、typecheck、unit test、E2E 和 whitespace 检查均已执行。
- 本轮新增 process runner stdin EOF 回归测试，并修复 `runProcess` 未关闭 child stdin 导致 Codex `exec` 等待额外 stdin 的问题；真实 `rolemux run --provider codex` 已复测成功。
- 本轮新增三 CLI dispatch 插件验证方案与 manifest，真实分发只读开发型任务给 `codex`、`claude`、`agy`；dispatch parent task id 为 `20260606T130912-8d79f3`，resume 显示 3 个子任务 metadata 均为 success，但 artifact 检查发现 Codex 嵌套 worker 无法读取文件、Agy exit 0 但无输出、dispatch duration metadata 为 0。
- 本轮修复三 CLI dispatch 验证发现的 RoleMux 侧问题：`runWorkflow` 会把 provider exit 0 但 stdout 为空的运行标记为 `failed`，Agy adapter 改为 `--print <prompt> --add-dir <workdir>`，dispatch 子任务与 parent metadata 会保存真实 workflow 时间。
- 本轮复测真实 Agy 与 Codex nested worker：Agy 交互式登录正常，非交互 `--print` 日志显示 silent auth 成功并进入模型 stream，但 stdout 仍为空；Codex 多文件审查会稳定触发 Windows sandbox `CryptUnprotectData failed`。RoleMux 侧已新增 Codex sandbox 失败检测、显式 `ROLEMUX_CODEX_SANDBOX` opt-in、显式 `ROLEMUX_AGY_PRINT_TIMEOUT` 诊断通道，并修复单任务 `run` metadata duration。
- 本轮参考最新 `fengshao1227/ccg-workflow`（HEAD `1d0a08912fb7ab83b064038ee1539d6d5137da57`）的 Antigravity 参数顺序，将 Agy adapter 调整为 `--add-dir <workdir> [--print-timeout X] -p <prompt>`；新增 PTY transport 与 `node-pty` 依赖，用于捕获 Agy 1.0.6 在 Windows 非交互管道中不会写入 stdout、但会在 TTY 路径输出模型文本的问题。
- 本轮修复 Windows PTY 生命周期问题：真实 Agy 已生成 success 任务产物但 RoleMux CLI 曾因 headless `conhost.exe` 未释放而不退出；`runPtyProcess` 现在在正常退出后安静释放 ConPTY 句柄，不触发 `node-pty` helper 的 `AttachConsole failed` stderr 污染。
- 本轮按 subagent-driven 流程创建 Codex context-pack 修复方案与三 CLI 验证 manifest：`docs/superpowers/plans/2026-06-07-codex-context-pack-dispatch.md`、`docs/superpowers/plans/2026-06-07-codex-context-pack-validation.manifest.json`。
- 本轮修复 Codex Windows nested worker 三类 RoleMux 侧问题：Windows npm `codex.cmd` 通过 `cmd.exe /d /s /c` 参数数组包装启动；嵌套 Codex 默认加 `--skip-git-repo-check --disable plugins --ignore-rules`，避免读取 Codex 插件和项目规则触发凭据解密；Codex prompt 改走 stdin，避免 `cmd.exe` 截断多行 argv。
- 本轮新增 `src/core/context-pack.ts`：dispatch 对 `provider=codex`、`writePolicy=readonly`、存在 `allowedPaths` 的子任务，会从原 workdir 读取 allowlist 文件并注入 prompt，同时在系统临时空目录执行 Codex，避免仓库 `AGENTS.md` 和项目上下文污染；metadata 记录 `contextPack.includedPaths`、`skippedPaths` 和 `runWorkdir`。
- 本轮新增/更新 process runner stdin 支持：可写入 provider stdin 并立即关闭 EOF，同时保留“无 stdin 时不会挂起”的回归测试；Codex adapter 不再把多行 prompt 放进 argv。
- 本轮真实三 CLI dispatch 复测成功：parent task id `20260607T095530-69244a`，Codex/Claude/Agy 三个子任务均为 success，输出分别包含 `EXPECTED_CODEX_CONTEXT_PACK_OK`、`EXPECTED_CLAUDE_ARTIFACT_CHECK_OK`、`EXPECTED_AGY_SUMMARY_OK`；Codex stderr 显示 `Reading prompt from stdin` 且 workdir 为 `C:\Users\peng8\AppData\Local\Temp\rolemux-codex-context-pack-nt2tB0`，未再出现运行时 Windows sandbox failure。
- 本轮使用 `plugin-creator` 将 RoleMux 生成为 Codex Windows App 可用个人插件：插件源位于 `C:\Users\peng8\plugins\rolemux`，个人 marketplace 位于 `C:\Users\peng8\.agents\plugins\marketplace.json`，安装缓存位于 `C:\Users\peng8\.codex\plugins\cache\personal\rolemux\0.1.0`。
- 本轮插件包含 `.codex-plugin/plugin.json`、`skills/rolemux-workflow/SKILL.md` 和 `README.md`；manifest 已改为 RoleMux 实际元数据，Skill 已补充 Windows Codex App 下的 `Get-Command rolemux` 前置检查。
- 本轮执行 `codex plugin add rolemux@personal` 成功，`codex plugin list` 显示 `rolemux@personal` 为 `installed, enabled`；插件源和缓存副本均通过 `validate_plugin.py` 校验。
- 本轮新增 RoleMux Agents Monitor：
  - `rolemux dispatch --detach` 会预分配 parent task、写入 monitor artifacts，并以隐藏内部入口 `_dispatch-runner` 启动后台执行。
  - `rolemux agents` 可列出 active dispatch；`rolemux agents --parent-task <id>` 输出表格；`--json` 输出稳定快照；`--tui` 在真实终端进入全屏监控。
  - `rolemux cancel --parent-task <id>` 幂等写入 `control/cancel.json`，runner 会取消未完成 agent，不删除已有产物。
  - `.rolemux/tasks/{parent-task-id}/` 新增 `monitor.json`、`events.jsonl`、运行中 `summary.md` 和 `control/`。
  - Codex/Claude Skill 已更新：真实多 agent dispatch 默认走 `--detach + agents --json`，对话内输出监控卡片；用户需要 TUI 时另开同项目终端运行 `agents --tui`。
- 本轮修正 install/uninstall 目标选择：
  - `rolemux install` 默认只写 `~/.rolemux/config.toml` 和 `~/.rolemux/roles`。
  - `rolemux install --codex` 与 `--claude` 才写非插件 Skill。
  - `rolemux install --codex-plugin` 只刷新 Codex App 插件源和缓存，不写 `~/.codex/skills`。
  - `rolemux uninstall` 默认清理 shared runtime 与 Codex/Claude 非插件 Skill；`--codex-plugin` 才处理 Codex App 插件。
  - `C:\Users\peng8\.agents-skills\self-create-skills` 属于用户个人临时 Skill 分发路径，不纳入 RoleMux 安装流程。
- 本轮追加通用 Skill 源：
  - 新增 `skills/rolemux-workflow/SKILL.md` 作为唯一通用内容源。
  - 已删除仓库内 `skills/codex/` 与 `skills/claude/` 宿主专属 Skill 源副本。
  - 安装器现在从通用源复制到 Codex/Claude 非插件目标和 Codex App 插件目标，避免宿主副本内容漂移。

## 产品基线

RoleMux 是一个轻量多 CLI 工作流插件/工具包：

- 通过 npm/npx 安装。
- 通过 Codex Skill / Claude Skill 按需触发。
- 通过 runner 统一调用 `codex`、`claude`、`agy`、`grok`、`opencode`。
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

1. 继续关注 Agy 1.0.6 是否提供官方机器可读 stdout/JSON 输出方式；当前 RoleMux 已用 PTY/ConPTY 作为 Windows 兼容捕获方案。
2. Codex readonly multifile dispatch 当前优先使用 context-pack；真正需要让 nested Codex 直接用本地文件工具的大范围写作任务，仍可能受 Codex CLI Windows sandbox 限制影响，默认不使用危险 bypass。
3. 后续可补强 `dispatch --resume` 的 warning 展示，把 empty output、stderr 错误模式、context-pack 跳过路径和 provider 环境异常汇总到 summary。
4. OpenCode 当前固定使用 `run --pure`；后续版本升级时复核官方 npm 包内 exe 路径、权限默认值和输出格式。
5. RoleMux Agents Monitor 后续可继续增强：更细的 provider activity 摘要、PTY provider 的更强取消确认、失败 agent 重跑和完成后 HTML report 汇总 monitor snapshot。
6. Grok Build 与 OpenCode 已完成当前 MVP 范围的真实认证；后续重点是把 core `timeoutMs` 暴露为明确 CLI 参数，以及在可用的桌面自动化通道中补录 Windows Terminal 视觉截图证据。

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

2026-06-05 已执行 Phase 8 worker 功能完整验证：

```powershell
npx vitest run tests/commands/task-dispatch.test.ts tests/core/merge-patches.test.ts
npm run typecheck
npm test
npm run test:e2e
npm run build
npm pack --dry-run
git diff --check
```

结果：目标测试通过，2 个 test files / 21 个 tests；typecheck 通过；unit test 通过，22 个 test files / 63 个 tests；E2E 通过，2 个 test files / 2 个 tests；build 通过；`npm pack --dry-run` 通过并触发 `prepare` build；`git diff --check` 通过。

2026-06-05 已基于交接文档复核本地已安装 Skill bundle 与全局 CLI：

```powershell
git status --short
Get-Command rolemux
rolemux --version
rolemux --help
Test-Path C:\Users\peng8\.rolemux\config.toml
Test-Path C:\Users\peng8\.codex\skills\rolemux-workflow\SKILL.md
Test-Path C:\Users\peng8\.claude\skills\rolemux-workflow\SKILL.md
Get-FileHash -Algorithm SHA256 <repo-skill/config/role-files>
Get-FileHash -Algorithm SHA256 <installed-skill/config/role-files>
npm run build
rolemux install --dry-run
rolemux install
rolemux doctor
rolemux run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
rolemux plan --providers 'codex,claude' --task .\examples\basic-task.md --workdir . --dry-run
rolemux review --provider codex --role reviewer --task .\examples\basic-task.md --workdir . --dry-run
rolemux discuss --providers 'claude,codex,agy' --task .\examples\basic-task.md --workdir . --mode parallel --dry-run
rolemux split --tasks-dir .\tests\fixtures\subtasks --out <temp-manifest>
rolemux manifest validate --manifest <temp-manifest>
rolemux dispatch --manifest <temp-manifest> --providers 'codex:2,claude:1' --dry-run
rolemux run --provider codex --role builder --task <temp-task> --workdir <temp-workdir>
npm run typecheck
npm test
npm run test:e2e
git diff --check
```

结果：工作树在验证前为 clean，当前分支 `main`，最新提交 `f55c155`；全局 `rolemux` 解析到 `C:\Users\peng8\AppData\Roaming\npm\rolemux.ps1`，版本 `0.1.0` 且 help 正常输出；安装目标 `config.toml`、Codex Skill、Claude Skill、5 个 role prompt 均存在；仓库源文件与已安装文件 SHA256 全部一致；重复 `rolemux install` 未覆盖已有文件，返回 8 个 skipped；`rolemux doctor` 返回 `ok: true`，检测到 `codex`、`claude`、`agy`；Skill 中的 `run`、`plan`、`review`、`discuss` dry-run 命令均返回结构化 preview；`split -> manifest validate -> dispatch --dry-run` 通过，生成 2 个子任务和 3 个 worker；mock provider 真实 `run` 在临时目录生成 `metadata.json`、`output.md`、`prompt.md`、`report.html`、`stderr.log`、`task.md`，metadata 状态为 `success`、provider 为 `codex`、role 为 `builder`；`npm run typecheck` 通过；`npm test` 通过，22 个 test files / 63 个 tests；`npm run test:e2e` 通过，3 个 test files / 3 个 tests；`git diff --check` 通过。

2026-06-05 已执行 Codex stdin 挂起回归修复验证：

```powershell
npx vitest run tests/core/process-runner.test.ts
npm run typecheck
npm test
npm run build
npm run test:e2e
rolemux run --provider codex --role summarizer --task <temp-task> --workdir .
git diff --check
```

结果：新增测试先在旧实现下失败，失败原因为 `result.status` 为 `timeout`；修复后目标测试通过，1 个 test file / 3 个 tests；typecheck 通过；unit test 通过，22 个 test files / 64 个 tests；build 通过；E2E 通过，3 个 test files / 3 个 tests；真实 Codex `rolemux run` 使用短任务返回 `status: success`，生成 task id `20260605T085016-4fd503`；`git diff --check` 通过。

已额外用临时 HOME 执行真实 install 验证，确认生成：

```text
.rolemux/config.toml
.rolemux/roles/builder.md
.codex/skills/rolemux-workflow/SKILL.md
.claude/skills/rolemux-workflow/SKILL.md
```

2026-06-06 已执行三 CLI dispatch 发现问题修复验证：

```powershell
npx vitest run tests/core/workflow-runner.test.ts tests/core/dispatch-artifacts.test.ts
npx vitest run tests/providers/provider-adapters.test.ts
npx vitest run tests/providers/provider-adapters.test.ts tests/core/workflow-runner.test.ts tests/core/dispatch-artifacts.test.ts
npm run typecheck
npm test
npm run build
npm run test:e2e
node .\dist\cli.js run --provider agy --role summarizer --task task.md --workdir <temp-workdir> # with ROLEMUX_PROVIDER_AGY_COMMAND=node and empty-output fixture
git diff --check
```

结果：新增回归测试先在旧实现下失败，分别复现 empty stdout 被误判 success、dispatch timing 使用 artifact 写入时间、Agy adapter prompt 位置不稳定；修复后目标测试通过，3 个 test files / 8 个 tests；typecheck 通过；unit test 通过，23 个 test files / 67 个 tests；build 通过；E2E 通过，3 个 test files / 3 个 tests；CLI mock 验证中 empty-output Agy provider 的 command status 和 metadata status 均为 `failed`，exitCode 保留为 0，stderr 写入诊断；`git diff --check` 通过。

2026-06-07 已执行真实 Agy PTY 修复验证：

```powershell
git ls-remote https://github.com/fengshao1227/ccg-workflow HEAD
npx vitest run tests\core\pty-runner.test.ts tests\providers\provider-adapters.test.ts tests\core\workflow-runner.test.ts
npm run typecheck
npm run build
node .\dist\cli.js run --provider agy --role raw --task task.md --workdir <temp-workdir> # with ROLEMUX_AGY_PRINT_TIMEOUT=30s
npm test
npm run test:e2e
git diff --check
```

结果：最新 `fengshao1227/ccg-workflow` 远端 HEAD 确认为 `1d0a08912fb7ab83b064038ee1539d6d5137da57`；参考其 Antigravity 参数顺序后，Agy adapter 输出 `--add-dir <workdir> --print-timeout 30s -p <prompt>`；聚焦测试通过，3 个 test files / 11 个 tests；typecheck 通过；build 通过；真实 Agy `rolemux run` 在临时目录生成 task id `20260607T080154-484c6c`，command status 为 `success`，`output.md` 为 `AGY_OK`，metadata `durationMs` 为 13182、`exitCode` 为 0；CLI 正常退出且没有 `AttachConsole failed` stderr 污染；unit test 通过，24 个 test files / 73 个 tests；E2E 通过，3 个 test files / 3 个 tests；`git diff --check` 通过。

2026-06-07 已执行 Codex context-pack、stdin prompt 与三 CLI worker dispatch 验证：

```powershell
npx vitest run tests\providers\provider-adapters.test.ts tests\core\process-runner.test.ts tests\commands\task-dispatch.test.ts tests\core\context-pack.test.ts tests\core\workflow-runner.test.ts
npm run typecheck
npm run build
node .\dist\cli.js manifest validate --manifest docs\superpowers\plans\2026-06-07-codex-context-pack-validation.manifest.json
node .\dist\cli.js dispatch --manifest docs\superpowers\plans\2026-06-07-codex-context-pack-validation.manifest.json --providers 'codex:1,claude:1,agy:1' --workdir . --dry-run
$env:ROLEMUX_AGY_PRINT_TIMEOUT='60s'; node .\dist\cli.js dispatch --manifest docs\superpowers\plans\2026-06-07-codex-context-pack-validation.manifest.json --providers 'codex:1,claude:1,agy:1' --workdir .
Select-String -Path .rolemux\tasks\20260607T095530-69244a\subtasks\codex-context-pack\output.md -Pattern 'EXPECTED_CODEX_CONTEXT_PACK_OK'
Select-String -Path .rolemux\tasks\20260607T095530-69244a\subtasks\claude-artifact-check\output.md -Pattern 'EXPECTED_CLAUDE_ARTIFACT_CHECK_OK'
Select-String -Path .rolemux\tasks\20260607T095530-69244a\subtasks\agy-context-summary\output.md -Pattern 'EXPECTED_AGY_SUMMARY_OK'
npm run verify:release
```

结果：新增回归测试先失败后通过，覆盖 Codex context-pack 不在仓库 workdir 执行、Codex prompt 走 stdin、process runner 写入并关闭 stdin、Windows `.cmd` shim 包装和同步 spawn error 捕获；聚焦测试通过，5 个 test files / 33 个 tests；manifest validate 成功；dry-run 预设 3 个 worker 分别固定到 Codex、Claude、Agy；真实 dispatch parent task `20260607T095530-69244a` 成功，3 个子任务 successCount 为 3，输出均包含预设完成标记；Codex subtask metadata 记录临时 `runWorkdir`；`npm run verify:release` 通过，unit test 25 个 files / 80 个 tests，E2E 3 个 files / 3 个 tests，`npm pack --dry-run` 与 `git diff --check` 均通过。

2026-06-15 已执行 RoleMux Agents Monitor 验证：

```powershell
npx vitest run tests\commands\task-dispatch.test.ts tests\core\agents-monitor.test.ts tests\commands\agents-monitor.test.ts
npx vitest run tests\core\agents-tui.test.ts tests\commands\agents-monitor.test.ts tests\commands\task-dispatch.test.ts tests\core\agents-monitor.test.ts
npm run typecheck
npm test
npm run test:e2e
npm run build
npm pack --dry-run
git diff --check
node .\dist\cli.js dispatch --manifest <temp-manifest> --providers 'codex:1' --workdir <temp-workdir> --detach
node .\dist\cli.js agents --parent-task <parent-task-id> --workdir <temp-workdir> --json
```

结果：聚焦 dispatch/agents/monitor 测试通过，3 个 test files / 23 个 tests；聚焦 TUI/monitor/dispatch 测试通过，4 个 test files / 25 个 tests；typecheck 通过；unit test 通过，28 个 test files / 89 个 tests；E2E 通过，3 个 test files / 3 个 tests；build 通过；`npm pack --dry-run` 通过；`git diff --check` 通过；构建后 CLI smoke 中 `dispatch --detach` 使用 mock provider 后台完成，`agents --json` 返回 `status=success`、`done=1/1`、agent `lastEvent=output.md written`。

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

## 2026-07-13 Grok Build provider 验证

```powershell
npm run lint
npm run typecheck
npm test
npm audit --omit=dev --audit-level=high
npm run build
npm run test:e2e
npm pack --dry-run
git diff --check
grok --version
node .\dist\cli.js doctor --providers grok
node .\dist\cli.js run --provider grok --role reviewer --task .\examples\basic-task.md --workdir . --dry-run
node .\dist\cli.js install --codex-plugin
```

结果：lint/typecheck 通过；unit test 29 个 files / 102 个 tests 通过；E2E 3 个 files / 3 个 tests 通过；build、pack dry-run、runtime audit 和 whitespace 检查通过；doctor 找到 Grok 0.2.99；Grok dry-run 参数正确；mock 非 dry-run 成功生成 `provider=grok` 的任务产物；`codex:1,grok:1` dispatch dry-run 成功分配 `grok-1`；Codex 插件源与 cache 已刷新且 Skill hash 与仓库一致；真实 isolated write、timeout、fallback、cancel 和 Windows PTY TUI 认证均通过。

## 已知风险

- 真实 `codex`、`claude`、`agy`、`grok`、`opencode` CLI 参数可能随版本变化，后续必须用 `doctor` 和 adapter 层缓冲。
- Windows 路径与 shell quoting 是高风险点，后续必须以参数数组执行外部命令。
- Windows 下使用 `.cmd` 模拟 provider 时可能被真实全局 CLI 抢先解析；当前 Grok mock 验证改用显式 Node executable override，已成功生成任务产物。
- 完整 dev dependency audit 仍报告 Vite 1 个 high 与 esbuild 1 个 low；runtime dependency audit 为 0，依赖升级不混入本次 provider 功能。
- 2026-07-14 已完成 Grok 真实只读、isolated write、core timeout、真实 fallback、运行中 cancel 和 Windows PTY TUI 认证；桌面 Windows Terminal 能启动真实 TUI，但当前 Codex 会话的 GUI SendKeys 无法可靠注入按键，因此没有把桌面视觉切换冒充为已验证。
