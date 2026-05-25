# M4 Skill Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Codex/Claude Skill bundle、默认 roles 和安装复制逻辑。

**Architecture:** Skill 文件只描述触发条件和 RoleMux CLI 调用；role prompt 独立存放；install 命令负责复制模板并保护用户已有文件。

**Tech Stack:** Markdown Skills, TypeScript install command, Vitest temp HOME.

---

## Files

- Create: `skills/codex/rolemux-workflow/SKILL.md`
- Create: `skills/claude/rolemux-workflow/SKILL.md`
- Create: `roles/architect.md`
- Create: `roles/builder.md`
- Create: `roles/reviewer.md`
- Create: `roles/frontend-reviewer.md`
- Create: `roles/summarizer.md`
- Create: `templates/config.toml`
- Modify: `src/commands/install.ts`
- Create: `tests/commands/install.test.ts`
- Modify: `README.md`
- Modify: `docs/progress/*`

## Tasks

- [ ] 写 install 测试，使用临时 HOME 验证 dry-run、首次安装、重复安装。
- [ ] 编写 Codex Skill，包含触发条件、调用命令、产物读取和禁止事项。
- [ ] 编写 Claude Skill，保持与 Codex Skill 行为一致。
- [ ] 编写五个默认 role prompt，明确职责和输出格式。
- [ ] 创建默认 config 模板。
- [ ] 扩展 install 命令，复制 skills、roles、config。
- [ ] 实现 `--with-agents` 显式可选逻辑，默认不修改用户项目 `AGENTS.md`。
- [ ] 更新 README Skill 使用说明。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M4): 增加 Skill bundle 和默认 roles"`

## Validation

```powershell
npm run typecheck
npm test
npm run build
node .\dist\cli.js install --dry-run
git diff --check
```

Expected:

- install 测试不写真实用户 home。
- Skill 不硬编码复杂 provider 参数。
- 默认 install 不修改项目 `AGENTS.md`。

## Subagent Handoff

- `rolemux-skill-builder` 负责 Skill、roles、templates 和 install 行为。
- `rolemux-docs-keeper` 负责 README 与验收说明。
- `rolemux-reviewer` 审查安装覆盖风险和触发条件。
