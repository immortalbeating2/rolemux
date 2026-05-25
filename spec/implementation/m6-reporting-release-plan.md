# M6 Reporting And Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 HTML report、README、示例、npm 打包和发布前检查。

**Architecture:** 报告生成从 task metadata 和产物文件读取数据，输出静态 HTML；发布检查使用本地 pack 和临时安装验证，不依赖云端发布。

**Tech Stack:** TypeScript, static HTML template, npm pack, Vitest.

---

## Files

- Create: `src/report/html-report.ts`
- Create: `templates/report.html`
- Create: `tests/report/html-report.test.ts`
- Create: `examples/basic-task.md`
- Create: `examples/mock-provider/README.md`
- Create: `docs/release/checklist.md`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `docs/progress/*`

## Tasks

- [ ] 写 HTML report 测试，验证转义、状态、provider 输出和错误摘要。
- [ ] 实现 `html-report`，只读取 task store 中已知文件。
- [ ] 为 `run` 或 `status` 增加 report 生成入口。
- [ ] 完善 README，覆盖安装、doctor、run、Skill、限制和示例。
- [ ] 创建 examples，使用 mock provider 展示最小链路。
- [ ] 创建发布检查清单，列出 npm pack、全局安装、npx、敏感文件检查。
- [ ] 检查 package files，避免包含 `.rolemux/tasks/`、日志、私有配置。
- [ ] 更新三类留痕文档。
- [ ] 提交：`git commit -m "feat(M6): 增加报告和发布准备"`

## Validation

```powershell
npm run typecheck
npm test
npm run build
npm pack --dry-run
node .\dist\cli.js --help
node .\dist\cli.js doctor
node .\dist\cli.js run --provider codex --role builder --task .\examples\basic-task.md --workdir . --dry-run
git diff --check
```

Expected:

- report 测试覆盖 HTML 转义。
- `npm pack --dry-run` 不包含运行产物和本地敏感文件。
- README 示例与真实命令一致。

## Subagent Handoff

- `rolemux-docs-keeper` 主责 README、examples 和 release checklist。
- `rolemux-cli-builder` 主责 report 生成代码和测试。
- `rolemux-reviewer` 审查发布包文件清单和敏感信息风险。
