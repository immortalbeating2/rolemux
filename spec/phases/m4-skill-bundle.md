# M4 阶段开发文档：Skill Bundle 与默认 Roles

状态：待执行

## 目标

完成通用 RoleMux Skill、默认 role prompt 和按目标安装复制逻辑，让 RoleMux 能被 AI CLI 以工作流能力调用，而不是只作为人工 CLI 使用。

## 范围

本阶段包含：

- 编写通用 Skill `rolemux-workflow`。
- 安装器把通用 Skill 源复制到 Codex/Claude 等宿主目标目录。
- 编写默认 roles：architect、builder、reviewer、frontend-reviewer、summarizer。
- 实现安装器复制 skills、roles、config 模板。
- 支持 `install --dry-run` 和重复安装保护。
- 支持显式可选 `--with-agents`，默认不修改用户项目 `AGENTS.md`。

本阶段不包含：

- 插件市场发布。
- 自动识别所有 AI CLI 配置目录。
- 强制 hooks 或全局 workflow 接管。

## 主责角色

- 主责：`rolemux-skill-builder`
- 协作：`rolemux-cli-builder`
- 文档：`rolemux-docs-keeper`
- 审查：`rolemux-reviewer`

## 关键产物

- `skills/rolemux-workflow/SKILL.md`
- `roles/architect.md`
- `roles/builder.md`
- `roles/reviewer.md`
- `roles/frontend-reviewer.md`
- `roles/summarizer.md`
- `templates/config.toml`
- `src/commands/install.ts`
- `tests/commands/install.test.ts`

## 退出标准

- `install --dry-run` 展示将写入的所有路径。
- 真实 install 在临时 HOME 中能复制 config、roles 和 Skill 文件。
- 重复 install 不覆盖用户已修改文件，除非传入显式覆盖参数。
- Skill 文档只调用 `rolemux` 命令，不硬编码 provider 参数细节。
- 不传 `--with-agents` 时不修改用户项目 `AGENTS.md`。

## 风险

- Codex/Claude Skill 加载路径可能因版本和用户配置不同而变化，安装器需要允许显式目标路径；仓库只维护通用 Skill 源，避免宿主副本漂移。
- role prompt 过强会诱导写操作，默认 role 应保守并强调职责边界。
