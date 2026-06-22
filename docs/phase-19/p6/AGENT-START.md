# P6 Agent — start here

```yaml
phase: P6
pack_version: "2.2"
status: COMPLETE
doc_pack: COMPLETE
code_integration: BEHAVIORAL_COMPLETE
current_task: null
nano_done_behavioral: 58
nano_total: 58
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
prerequisite: P5-B-N-016 complete
gate_static: pnpm run p6:gate
gate_e2e: pnpm run p6:e2e-gate
gate_live: node scripts/smoke-p6-host-bind.mjs
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/IMPLEMENTATION-TRUTH-P6.md
navigator: ../AGENT-NAVIGATOR.md
doc_sot: docs/phase-19/platform-denali-first-customer.mdoc
p7_blocked: false
```

## Status: P6 complete (2026-06-22)

Vertical slice **VS-01..08** behaviorally proven · `p6:gate` + `p6:e2e-gate` green.

**Next phase:** [P7 Agent START](../phase-20/p7/AGENT-START.md) — staging delivery on VPS.

```bash
pnpm run p6:gate                                    # daily regression (~8s)
pnpm run p6:e2e-gate                                # pre-staging browser (~80s)
TOUR_OPS_API_URL=http://127.0.0.1:3001 node scripts/smoke-p6-host-bind.mjs
```

Machine state → [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml) · truth → [IMPLEMENTATION-TRUTH-P6.md](appendices/IMPLEMENTATION-TRUTH-P6.md).

---

## What P6 delivered

**First Denali club customer** — three separate apps, full vertical slice.

| EPIC | Outcome |
| ---- | ------- |
| P6-0 | Canonical hosts + same `tenantId` across marketing · portal · admin |
| P6-1 | Guest browse → OTP register (`GUEST_SLICE_OK`) |
| P6-2 | Operator approve booking + receipt (VS-06 · VS-07) |
| P6-3 | Member `/me/registrations` + receipt upload (VS-04 · VS-05) |
| P6-4 | `p6:gate` · `p6:e2e-gate` · exit specs |

## Three apps + hosts

**Runbook:** [runbooks/host-subdomain-map.md](runbooks/host-subdomain-map.md)

| App | Role | Dev (canonical) | Legacy smoke |
| --- | ---- | --------------- | ------------ |
| `apps/marketing` | Public catalog | `operator.localhost:3002` | `shop.operator.localhost:3002` |
| `apps/portal` | User register + `/me` | `operator.portal.localhost:3003` | `operator.localhost:3003` |
| `apps/web` | Admin operator | `operator.admin.localhost:3000` | `operator.localhost:3000` |

**CTA bridge:** `buildDevPortalPublicBaseUrl` in `@app-tour/tenant-kernel` (not per-app duplicate).

## Read order (maintenance / regression)

1. [appendices/IMPLEMENTATION-TRUTH-P6.md](appendices/IMPLEMENTATION-TRUTH-P6.md) — repo truth
2. [platform-denali-vertical-slice.mdoc](../platform-denali-vertical-slice.mdoc) — VS-01..08 steps
3. [AGENT-STATE-MAP-P6.md](AGENT-STATE-MAP-P6.md) — triggers · guards · prove specs
4. [appendices/TRACEABILITY-MATRIX-P6.md](appendices/TRACEABILITY-MATRIX-P6.md) — nano → file → spec
5. [appendices/SMOKE-SCENARIO-MAP-P6.md](appendices/SMOKE-SCENARIO-MAP-P6.md) — SMK-P6 matrix
6. [runbooks/p6-e2e-smoke.md](runbooks/p6-e2e-smoke.md) — full browser gate
7. [p6-exit-checklist.md](p6-exit-checklist.md)

## Agent loop (regression only)

```text
pnpm run p6:gate fails
  → read failing spec name in gate script
  → read matching EPIC nano in p6-{0..4}-*.md
  → doc-first if core change
  → fix · re-run p6:gate
  → do NOT tick checklist backward
```

## EPIC specs (reference)

| EPIC | Doc |
| ---- | --- |
| P6-0 | [p6-0-host-subdomain.md](p6-0-host-subdomain.md) |
| P6-1 | [p6-1-guest-slice.md](p6-1-guest-slice.md) |
| P6-2 | [p6-2-operator-admin.md](p6-2-operator-admin.md) |
| P6-3 | [p6-3-member-portal.md](p6-3-member-portal.md) |
| P6-4 | [p6-4-exit-gate.md](p6-4-exit-gate.md) |
