# P6 Agent — start here

```yaml
phase: P6
pack_version: "2.3-fast-close"
status: CLOSED_FAST
fast_close: p6-fast-close.yaml
doc_pack: COMPLETE
code_integration: DEV_SLICE_CLOSED
current_task: null
nano_done_behavioral: 37
nano_total: 58
exit_nano: P6-4-N-008
milestone_guest_slice: P6-1-N-014
prerequisite: P5-B-N-016 complete
gate_static: pnpm run p6:gate
gate_e2e: pnpm run p6:e2e-gate
gate_closure_fast: P6_FAST_CLOSE=1 pnpm run p6:closure
gate_live: node scripts/smoke-p6-host-bind.mjs
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/IMPLEMENTATION-TRUTH-P6.md
navigator: ../AGENT-NAVIGATOR.md
doc_sot: docs/phase-19/platform-denali-first-customer.mdoc
p7_blocked: false
long_commands: TEMP/FOR YOU.md
```

## Status: P6 fast-closed (2026-06-23)

Dev slice **VS-01..08** proven locally · VPS staging **infra + host-bind smoke** · full VPS gates → **P7**.

**Next phase:** [P7 Agent START](../phase-20/p7/AGENT-START.md)

```bash
pnpm run p6:gate                         # daily (~8s) — or see TEMP/FOR YOU.md
P6_FAST_CLOSE=1 pnpm run p6:closure      # skip slow staging-preflight
```

Long commands (install, build, VPS gates): **[TEMP/FOR YOU.md](../../../TEMP/FOR%20YOU.md)**

Machine state → [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml) · [p6-fast-close.yaml](p6-fast-close.yaml)

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
