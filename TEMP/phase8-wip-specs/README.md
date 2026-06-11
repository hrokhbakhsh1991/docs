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

**Status 2026-06-08:** T-8.1 **promoted ON_TRUNK**. WIP copies are **historical** — do not run import paths verbatim.

**Trunk mapping (Phase 10.3/10.5):** urban HTTP/auth → `packages/workspaces/urban/` · SDK owner spec → `packages/workspaces/urban/test/urban-owner-ability.spec.ts` · API host → `apps/api/src/http/configure-urban-http-host.ts`. Imports of `apps/api/src/urban/*` in this folder are **obsolete**.

---

## T-8.1 — Single-Owner auth (P0) — **COMPLETE**

WIP `.spec.ts` copies **removed** 2026-06-08. See [`DEPRECATED.md`](DEPRECATED.md) for canonical trunk paths.
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
