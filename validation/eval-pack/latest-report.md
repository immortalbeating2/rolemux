# RoleMux repository facts v1

> Historical v1 real-provider run. The current source pack is v2 with 26 cases and 10 calls; v2 has not been re-run, so these scores are not presented as current v2 results.

| mode | answered | facts | evidence | coverage | total |
|---|---:|---:|---:|---:|---:|
| single | 20/20 | 100.0% | 100.0% | 100.0% | 100.0% |
| unstructured | 20/20 | 98.4% | 100.0% | 100.0% | 98.9% |
| structured | 20/20 | 100.0% | 100.0% | 100.0% | 100.0% |

Scores are deterministic measurements for this pack only; they are not a general provider ranking.

- Git HEAD: `75c1afe80a9ecedd9042d36237622228bbbc740f`
- Providers: codex, claude, grok
- Temporary worktree changed: no
- Temporary worktree cleanup: success

| mode | final status | calls | cumulative provider duration | parse error |
|---|---|---:|---:|---|
| single | success | 1 | 206629 ms |  |
| unstructured | success | 4 | 521101 ms |  |
| structured | success | 4 | 629661 ms |  |

| mode | provider | role | status | duration |
|---|---|---|---|---:|
| single | codex | reviewer | success | 206629 ms |
| unstructured | codex | reviewer | success | 130334 ms |
| unstructured | claude | reviewer | failed | 6129 ms |
| unstructured | grok | reviewer | timeout | 301314 ms |
| unstructured | codex | summarizer | success | 83324 ms |
| structured | codex | architect | timeout | 337960 ms |
| structured | claude | reviewer | failed | 4958 ms |
| structured | grok | reviewer | success | 76699 ms |
| structured | codex | summarizer | success | 210044 ms |

The unstructured mode approximates ad-hoc multi-CLI use with identical prompts; it is not a recording of an interactive Codex conversation.
