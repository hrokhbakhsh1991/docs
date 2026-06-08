# Phase 8 — WIP spec scaffolds (promote train SoT)

```yaml
manifest_version: "2026-06-08-v1"
authority: docs/phase-8/appendices/SPEC-REGISTRY-8.1.yaml
guard_blocker: p8_spec_path_registry
truth_ledger: docs/phase-8/audits/IMPLEMENTATION-TRUTH.md
navigator: docs/phase-8/AGENT-NAVIGATOR.md
```

> **Agents:** If `prove_with` path is **missing on trunk**, copy from here — do **not** invent specs. Promote via separate PR (`test(phase-8): promote T-8.1`). Doc-only Sprint A does **not** require promote.

---

## Promote train (normative order)

| Train     | Priority | Unblocks                                           | Architect YES for behavioral |
| --------- | -------- | -------------------------------------------------- | ---------------------------- |
| **T-8.1** | **P0**   | `p8_spec_path_registry` · `p8_hardening_artifacts` | yes                          |

**Rule:** One train per PR · run `pnpm run phase-8:guard` after promote · update IMPLEMENTATION-TRUTH § scaffold promote table.

**Warning:** WIP specs import `apps/api/src/urban/*` and `apps/web/src/urban/*` targets that are **ABSENT** until 8.1 implementation. Promote without stubs breaks `test:changed` — pair promote with minimal export stubs or implement 8.1 in same PR.

---

## T-8.1 — Single-Owner auth (P0)

| WIP source                                           | Trunk target                                              | Guard / subphase |
| ---------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| `workspace-sdk/urban-owner-ability.spec.ts`          | `packages/workspace-sdk/test/urban-owner-ability.spec.ts` | REQ-P8-010       |
| `urban-owner-ability.spec.ts`                        | `apps/api/test/urban-owner-ability.spec.ts`               | REQ-P8-012       |
| `urban-settings-patch.spec.ts`                       | `apps/api/test/urban-settings-patch.spec.ts`              | REQ-P8-012       |
| `urban-redis-fallback.spec.ts`                       | `apps/api/test/urban-redis-fallback.spec.ts`              | 8.1 bundle       |
| `urban-tours-bypass-gate.spec.ts`                    | `apps/api/test/urban-tours-bypass-gate.spec.ts`           | TPG-8.1          |
| `../phase9-wip-specs/web/urban-owner-access.spec.ts` | `apps/web/test/urban-owner-access.spec.ts`                | REQ-P8-011       |

```bash
cp TEMP/phase8-wip-specs/workspace-sdk/urban-owner-ability.spec.ts packages/workspace-sdk/test/
cp TEMP/phase8-wip-specs/urban-owner-ability.spec.ts apps/api/test/
cp TEMP/phase8-wip-specs/urban-settings-patch.spec.ts apps/api/test/
cp TEMP/phase8-wip-specs/urban-redis-fallback.spec.ts apps/api/test/
cp TEMP/phase8-wip-specs/urban-tours-bypass-gate.spec.ts apps/api/test/
cp TEMP/phase9-wip-specs/web/urban-owner-access.spec.ts apps/web/test/
pnpm run phase-8:guard
```

---

## After promote

1. Update `docs/phase-8/audits/IMPLEMENTATION-TRUTH.md` scaffold table → `ON_TRUNK`
2. Update `docs/phase-8/appendices/AGENT-CURRENT-PHASE.yaml` `next_prove_with` statuses
3. Run `pnpm run guard:p8-boundary-diff` on 8.1 PR diff
