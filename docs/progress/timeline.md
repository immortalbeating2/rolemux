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

## 后续计划

- M0：已完成首轮实现；后续可补更严格 lint 配置。
- M1：已完成首轮实现；`install`、`uninstall`、`doctor`、`run --dry-run` 可运行。
- M2：已完成首轮实现；provider adapter 集中在 `src/providers/`，process runner 使用参数数组。
- M3：已完成首轮实现；task store 可写入 metadata、核心产物和 HTML report。
- M4：已完成首轮实现；Codex/Claude Skill bundle 与默认 role prompts 已存在。
- M5：已完成首轮实现；`plan`、`review`、`discuss` 支持 dry-run，fallback core 已实现。
- M6：已完成首轮实现；README、examples、release checklist、GitHub 安装说明、npm pack 文件清单已验证。
