# Phase 6 — Repo ↔ project alignment

```yaml
alignment_date: "2026-06-04"
decisions: IMPLEMENTATION-DECISIONS.md
```

| Concern          | Doc claim                            | Repo truth (2026-06-04)                   |
| ---------------- | ------------------------------------ | ----------------------------------------- |
| Denali workspace | `packages/workspaces/denali` product | **Probe only** — `DENALI_BREACH_PROBE`    |
| API plugin       | denali resolves                      | **NOT_BOUND** — throws                    |
| Web registry     | starter only                         | starter in `workspace-plugin-registry.ts` |
| platform-core    | unchanged                            | no Denali branches required               |
| legacy           | reference port                       | `legacy/packages/denali-domain/` exists   |

**Rule:** Update this table when 6.1+ lands code.
