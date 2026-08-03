
# P5 — AI Agent Entry (READ THIS FIRST)

```yaml
doc_id: P5-AGENT-START
version: 2.9-ai-friendly
mandatory: true
current_task: null
current_epic: null
next_task: null
nano_total: 56
nano_done: 56
exit_core: P5-B-N-016
exit_full: P5-E-N-006
file_map: TEMP/p5/FILE-MAP.md
manifest: TEMP/p5/AGENT-MANIFEST.yaml
context: TEMP/p5/AGENT-CONTEXT.md
preservation: TEMP/p5/PRESERVATION-CHECKLIST.md
anti_drift: TEMP/p5/ANTI-DRIFT.md
doc_sync: TEMP/p5/DOC-SYNC-INDEX.md
status: complete
prerequisite: P4-complete
```

## ⛔ P5 closed — 56/56 complete

**Do not open new P5 nanos** unless Architect YES for regression fix.

| Check | Command / marker |
|-------|------------------|
| Gate | `pnpm run p5:gate` → `P5_ENTERPRISE_EVOLUTION_GATE_OK` |
| Exit full | `P5-E-N-006` · Path B complete |
| Assessment | `TEMP/wizard-denali-enterprise-assessment.md` · **9.5/10** |
| Next phase | P6 (`docs/phase-19/p6/AGENT-START.md`) — already COMPLETE |
| Uncommitted work | ~247 files in git working tree — **commit/PR**, not new P5 nanos |

Reopen rule: regression only → fix spec + `p5:gate`; no scope expansion without Architect.


## 17 rules

| # | Rule |
|---|------|
| R1 | **One nano only** — manifest `current_task` |
| R2 | Read: START → CONTEXT → PRESERVATION → covenant → epic nano |
| R3 | Touch **manifest files only** (+ docs listed in nano) |
| R4 | DOC or first IMPLEMENT in epic → `docs/phase-18/*.mdoc` **before** code |
| R5 | IMPLEMENT before TEST in same parent task |
| R6 | `pnpm run guard:p3-denali-covenant` — never `git diff --quiet denali` alone |
| R7 | ≥2 real asserts — **no** `assert.ok(true)` |
| R8 | No prod cutover without staging pilot (P5-A-N-007) |
| R9 | **Denali = offline_receipt only** — defer P5-C/D/E unless Architect enables |
| R10 | **Never delete** `denali/src/rules|field-registry|composites|ui` |
| R11 | Parity changes → run preservation specs PC-01..10 |
| R12 | Super Admin = control plane — **no** operator wizard |
| R13 | `metadataCutoverStage` = **computed** — no new DB column P5-A |
| R14 | Audit: reuse `TENANT_DEFINITION_ASSIGNED/CLEARED` — no invented action strings |
| R15 | No heavy gates without Architect YES |
| R16 | After nano: update START yaml + MANIFEST status + FILE-MAP ⬜→✅ |

## Exit paths

| Path | Stop at | When |
|------|---------|------|
| **P5-core** | P5-B-N-016 | Denali customer — default |
| **P5-full** | P5-E-N-006 | Second customer + gateway |

## EPIC map

| EPIC | Nano | Optional | Spec |
|------|------|----------|------|
| P5-A | 14 | no | p5-a-cutover-pilot.md |
| P5-B | 16 | no | p5-b-denali-operator-parity.md |
| P5-C | 10 | yes | p5-c-workspace-commerce-config.md |
| P5-D | 10 | yes | p5-d-integrations-plane.md |
| P5-E | 6 | yes | p5-e-registrations-finance.md |

## First nano — P5-A-N-001

Replace denali gate in `scripts/p4-club-product-gate.sh` + create `scripts/p5-enterprise-evolution-gate.sh` stub + update EX-01 in `platform-club-product-exit.spec.ts`.

**VERIFY:** GATE-01..03 in p5-a spec.

| R17 | Read `ANTI-DRIFT.md` AD-S0-* before Denali edits |
