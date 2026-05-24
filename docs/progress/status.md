# RoleMux 当前状态

更新时间：2026-05-25
当前阶段：git 仓库、开发规范与本地 Codex/subagent 角色设置已初始化，尚未进入正式源码工程初始化

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
- 当前还没有 `package.json`、`src/`、`tests/`、`skills/`、`roles/` 等正式工程目录。

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
- 修改源码、测试、Skill 或 role prompt 前必须读取 `docs/dev/code-style.md`。
- 启用 subagent 前必须读取 `.codex/agents/` 中对应角色设置，并明确文件所有权。
- 未验证不得声称完成。
- 影响 CLI、provider、Skill、role、安装行为或 task artifact 的改动必须同步更新文档。

## 下一步建议

1. 初始化 Node.js + TypeScript 工程。
2. 创建 `package.json`、`tsconfig.json`、`src/cli.ts`、基础测试配置。
3. 实现 `rolemux --help` 和 `rolemux doctor` 的最小骨架。
4. 为 `doctor` 添加 mock CLI 检测测试。
5. 更新本状态文档和当日日志。

## 本次验证记录

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
- 当前尚未初始化 git 仓库，提交与分支流程暂不可用。
