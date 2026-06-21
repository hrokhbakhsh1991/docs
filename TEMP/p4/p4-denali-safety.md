# P4 — Denali Safety Covenant

```yaml
extends: TEMP/p3/p3-denali-safety.md
agent_entry: TEMP/p4/AGENT-START.md
```

> P4 touches marketing/portal/api — **not** denali package field layout.

## Guards

```bash
git diff --quiet packages/workspaces/denali
pnpm run guard:import-boundary
pnpm run guard:public-catalog-m17
```

## Allowed

- apps/api/src/marketing/\*
- apps/api/src/canonical/\* (revalidate wire only)
- apps/marketing/\*
- apps/portal/\*
- apps/web/src/platform/club-detail/\* (surfaces tab)
