# RoleMux Eval Pack

Developer experiment for comparing one provider, unstructured multi-provider analysis, and structured RoleMux roles plus counter-review against the same 26 repository facts.

```powershell
npm run eval:pack
npm run eval:pack -- --providers codex,claude,grok
```

Raw runs are written under `validation/eval-pack/runs/` and ignored by Git. The latest compact report and summary are copied to `validation/eval-pack/` for review. Real providers run read-only in a temporary detached git worktree, which is removed after the run.

The scorer checks pre-recorded fact tokens, cited source paths, and case coverage. It does not use an LLM judge and does not claim a general model ranking.
