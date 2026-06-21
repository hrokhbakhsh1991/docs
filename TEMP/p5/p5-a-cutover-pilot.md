
# P5-A — Metadata Cutover Pilot · Nano-Task Spec (AI v2)

```yaml
doc_id: P5-A-CUTOVER-PILOT
version: 2.0-ai-friendly
nano_tasks: 14
start: P5-A-N-001
stop: P5-A-N-014
epic: P5-A
optional: false
doc_first: docs/phase-18/platform-metadata-cutover-pilot.mdoc
quality_target: 9.5+/10
```


## Progress (synced with DOC-SYNC-INDEX)

| Nano | Status |
|------|--------|
| N-001 gate covenant | ✅ |
| N-002 phase-18 mdoc | ✅ |
| N-003 deriveMetadataCutoverStage | ✅ |
| N-004 Super Admin badge | ⬜ **current** |

> **Doc SoT target:** `docs/phase-18/platform-metadata-cutover-pilot.mdoc` (N-002 sync — mdoc pre-created 2026-06-21)

## §Facts frozen

| # | Fact | Evidence |
|---|------|----------|
| F1 | Loader facade exists | `load-workspace-plugin-for-tenant.ts` |
| F2 | Allowlist spec green | `workspace-metadata-cutover-allowlist.spec.ts` |
| F3 | Tenant binding columns exist | `schema.prisma` workspaceDefinitionId |
| F4 | Assign/clear audit exists | `TENANT_DEFINITION_ASSIGNED/CLEARED` |
| F5 | Scoped covenant guard exists | `guard-p3-denali-covenant.mjs` |

## Parent tasks

| Parent | Nano |
|--------|------|
| T-001 Gate hygiene | N-001 |
| T-002 Doc scaffold | N-002 N-005 N-010 N-011 |
| T-003 Cutover DTO | N-003 N-004 |
| T-004 Observability | N-006 |
| T-005 Pilot ops | N-007 N-008 N-009 |
| T-006 Phase gate | N-012 N-013 N-014 |

---

### P5-A-N-001 [IMPLEMENT] T-001 — gate hygiene

1. `scripts/p4-club-product-gate.sh` line 16 → `pnpm run guard:p3-denali-covenant`
2. Create `scripts/p5-enterprise-evolution-gate.sh` (stub: import-boundary + covenant + echo OK)
3. `platform-club-product-exit.spec.ts` EX-01: assert covenant not git diff
4. Update phase-17 mdoc verify blocks if they mention git diff

| ID | Assert |
|----|--------|
| GATE-01 | p4 gate script contains guard:p3-denali-covenant |
| GATE-02 | p5 gate script exists |
| GATE-03 | EX spec matches |

**NEXT:** N-002 · **Files:** manifest only above

---

### P5-A-N-002 [DOC] T-002 — phase-18 scaffold

1. Create `docs/phase-18/platform-metadata-cutover-pilot.mdoc` (Markdoc, ≥80 lines: goals, stage table, rollback, verify)
2. `TEMP/p5/doc-scaffold/phase-18-outline.md` cross-ref

| ID | Assert |
|----|--------|
| DOC-01 | mdoc exists + execution_spec points to this nano spec |
| DOC-02 | stage table matches AGENT-CONTEXT §4 |

**NEXT:** N-003

---

### P5-A-N-003 [IMPLEMENT] T-003 — derive cutover stage

1. Add `derive-metadata-cutover-stage.ts` (pure function)
2. Extend `PlatformTenantWorkspaceDefinitionDto` with `metadataCutoverStage`
3. Wire in `toPlatformTenantDetailDto`
4. Spec `platform-tenant-metadata-cutover.spec.ts`

| ID | Assert |
|----|--------|
| CO-01 | off when flag false |
| CO-02 | pilot when allowlist contains tenant |
| CO-03 | live when allowlist empty + binding |
| CO-04 | no Prisma migration in diff |

**NEXT:** N-004

---

### P5-A-N-004 [IMPLEMENT] T-003 — Super Admin badge

1. Club workspace tab shows stage + definition version (extend existing workspace tab)
2. `platform-club-workspace-cutover-tab.spec.ts`

| ID | Assert |
|----|--------|
| UI-01 | data-testid cutover badge renders |
| UI-02 | version matches DTO |

**NEXT:** N-005

---

### P5-A-N-005 [DOC] T-002 — staging env checklist

Add § Staging pilot env to phase-18 mdoc: `WORKSPACE_METADATA_ENABLED`, `WORKSPACE_METADATA_TENANT_ALLOWLIST`, binding steps.

**NEXT:** N-006

---

### P5-A-N-006 [IMPLEMENT] T-004 — metrics

1. Add counter `workspace_metadata_validation_errors_total{tenantId}` in metrics.ts
2. Increment from canonical validation when metadata path active
3. `workspace-metadata-cutover-metrics.spec.ts`

| ID | Assert |
|----|--------|
| MET-01 | counter registers |
| MET-02 | increment on metadata validation fail |

**NEXT:** N-007

---

### P5-A-N-007 [DOC] T-005 — smoke bind script

1. `apps/api/scripts/smoke-metadata-pilot-bind.mjs` documented in mdoc
2. Binds smoke tenant on staging only

**NEXT:** N-008

---

### P5-A-N-008 [TEST] T-005 — rollback drill

Extend allowlist spec: clear binding → package path < 60s (in-process, no sleep in prod)

| ID | Assert |
|----|--------|
| CO-05 | clear binding → package plugin id |

**NEXT:** N-009

---

### P5-A-N-009 [TEST] T-005 — audit reuse

Spec: assign/clear emits **existing** audit actions only

| ID | Assert |
|----|--------|
| AUD-01 | ASSIGNED on bind |
| AUD-02 | CLEARED on rollback |

**NEXT:** N-010

---

### P5-A-N-010 [DOC] T-002 — expand allowlist runbook

**NEXT:** N-011

---

### P5-A-N-011 [DOC] T-002 — G2 async note

Cross-ref phase-16 cutover mdoc § G2 ingress — no code unless doc mandates

**NEXT:** N-012

---

### P5-A-N-012 [DOC] — FILE-MAP sync all A rows ✅

**NEXT:** N-013

---

### P5-A-N-013 [IMPLEMENT] T-006 — p5:gate

1. Flesh `scripts/p5-enterprise-evolution-gate.sh`: boundary + covenant + cutover specs
2. `package.json` `"p5:gate": "bash scripts/p5-enterprise-evolution-gate.sh"`
3. `platform-enterprise-evolution-exit.spec.ts` EX-P5-01

| ID | Assert |
|----|--------|
| GATE-04 | package.json p5:gate |
| GATE-05 | script prints P5_ENTERPRISE_EVOLUTION_GATE_OK |

**NEXT:** N-014

---

### P5-A-N-014 [TEST] T-006 — EPIC exit

Update assessment + p5-exit partial for P5-A

| ID | Assert |
|----|--------|
| EX-A-01 | p5-exit lists P5-A items |
| EX-A-02 | assessment mentions pilot |
