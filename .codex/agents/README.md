# RoleMux Codex 角色设置

本目录保存 RoleMux 项目的本地 Codex/subagent 角色预设。用户上一条消息中的 `.codoex` 按 Codex 约定落地为 `.codex`。

这些文件用于后续手动或自动分派子任务时复制为 prompt 片段，不代表 RoleMux 产品安装后必须写入用户项目。主代理始终负责整合结果、读取 diff、运行验证并更新留痕文档。

## 文件说明

- `agents.json`：机器可读的角色索引、写入范围和验证要求。
- `rolemux-researcher.md`：只读调研角色。
- `rolemux-architect.md`：方案与接口设计角色。
- `rolemux-cli-builder.md`：CLI、core、provider adapter 实现角色。
- `rolemux-skill-builder.md`：Skill、roles、安装复制逻辑实现角色。
- `rolemux-reviewer.md`：只读审查角色。
- `rolemux-docs-keeper.md`：文档与留痕维护角色。

## 使用规则

- 分派前先明确文件所有权，不让多个角色同时修改同一文件。
- 每个角色都必须遵守项目根目录 `AGENTS.md`。
- 涉及代码实现的角色必须读取 `docs/dev/code-style.md`。
- reviewer 默认只读，除非用户明确允许其修复。
- 子代理返回的完成声明不能直接作为交付依据，主代理必须重新验证。
