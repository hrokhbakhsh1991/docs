# P7 — Wizard preservation gate (P7-1-N-002)

```yaml
runbook_id: P7-PRESERVATION-GATE
nano: P7-1-N-002
carryover: ../../phase-19/p6/p6-2-operator-admin.md P6-2-N-015
spec: apps/api/test/p6-preservation-gate.spec.ts
```

> Every P7 PR touching wizard/settings/Denali plugin must keep P6 preservation green.

---

## When required

| Touch | Run preservation band |
| ----- | ---------------------- |
| `apps/web/app/tours/new/**` | yes |
| `packages/workspaces/denali/src/rules/**` | yes + Architect review |
| `packages/workspaces/denali/**` composites | yes |
| P7-0 infra only | `p7:gate` sufficient |

---

## Commands

```bash
pnpm run p7:gate

pnpm --filter @apps/web exec node --import tsx --test test/denali-publish-readiness.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/denali-wizard-draft-contract.spec.ts

# Denali anti-delete / path preservation (P6 carryover)
pnpm --filter @apps/api exec node --import tsx --test test/p6-preservation-gate.spec.ts
```

---

## FORBIDDEN (Z1)

See [p6-denali-safety.md](../../phase-19/p6/p6-denali-safety.md):

- Delete/move `denaliRuleModel` paths
- Move wizard host into `(app)/`
- Refactor composites without P0 walkthrough proof

---

## References

- [p7-wizard-blocker-walkthrough.md](p7-wizard-blocker-walkthrough.md)
- [P7-EXECUTION-DISCIPLINE.md](../appendices/P7-EXECUTION-DISCIPLINE.md)
