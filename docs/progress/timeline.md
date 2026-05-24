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

## 后续计划

- M0：初始化 TypeScript CLI 工程。
- M1：实现 `install`、`doctor`、`run --dry-run`。
- M2：实现 Codex、Claude、Agy provider adapter。
- M3：实现 `.rolemux/tasks/{task-id}/` 任务产物。
- M4：实现 Codex/Claude Skill bundle 和默认 role prompts。
- M5：实现 `plan`、`review`、`discuss`、并行执行和 fallback。
- M6：完善 HTML report、README、npm 打包与发布准备。
