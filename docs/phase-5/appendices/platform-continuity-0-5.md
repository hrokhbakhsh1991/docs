# Platform continuity — Phase 5 extension

```yaml
agent_load_tier: T0_execution
canonical_sot: ../../appendices/PLATFORM-CONTINUITY-0-5.md
purpose: "Phase-5-local snapshot + repo truth — extends canonical cross-phase SoT"
project: "Interoperable workspace SaaS — pool multi-tenant Postgres"
```

**Canonical (all phases):** [`../../appendices/PLATFORM-CONTINUITY-0-5.md`](../../appendices/PLATFORM-CONTINUITY-0-5.md)  
**4→5 entry map:** [`CROSS-PHASE-ENTRY-MAP.md`](CROSS-PHASE-ENTRY-MAP.md) · **0–3 chain:** [`phase-0-3-bridge.md`](phase-0-3-bridge.md)  
**Guard:** `p5_cross_phase_continuity` in `phase-5:guard`

---

## Ownership matrix

| Phase | Title             | Owns                                                         | Must NOT own in this phase                 |
| ----- | ----------------- | ------------------------------------------------------------ | ------------------------------------------ |
| **0** | Foundation        | `workspace-sdk`, `CanonicalDocument`, theme contracts        | Tenant RLS, outbox                         |
| **1** | Platform core     | `PlatformWizardEngine`, rules headless                       | UI, Postgres tours SoT                     |
| **2** | Design system     | tokens, `theme-react`, ingress `--ws-*`                      | Tenant DB, canonical persist               |
| **3** | Starter workspace | `workspaces/starter`, CASL, `apps/*` scaffold                | Production outbox, `canonical_data` rename |
| **4** | Tenant kernel     | `tenant-kernel`, RLS on `tours`, in-process bus **scaffold** | Outbox table, plugin DDL                   |
| **5** | Data layer        | `canonical_data`, projections, outbox, `audit_events`        | Denali port, MinIO, silo routing           |

---

## Data & event flow (target after Phase 5)

```text
HTTP → tenant-kernel (host → tenantId)     [Phase 4]
     → CASL + CanonicalTourService          [Phase 3]
     → validateCanonical(plugin)            [Phase 1 + 3 plugin]
     → withCanonicalTransaction             [Phase 5]
           ├─ tours.canonical_data (JSONB)
           ├─ sync title / schema_version   [Phase 5.3]
           ├─ outbox_events row             [Phase 5.4]
           └─ audit_events row (optional)   [Phase 5.5]
     → relay worker SKIP LOCKED             [Phase 5.4]
```

---

## Gate chain (repo truth)

```yaml
phase-3:gate: "apps + starter + phase-2:gate"
phase-4:gate: "build + test + phase-3:gate + phase-4:guard"
phase-5:gate: "build + test + phase-4:gate + phase-5:guard"
binding: package.json scripts — REPO_SCRIPTS_OVER_STALE_MD
```

---

## Doc entry points per phase

| Phase | Agent SoT                                                     | Human T3 (optional)                                                                                      |
| ----- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0–3   | `phase-N/phase-N-ai-exec.md` or index                         | `phase-N-*.md`                                                                                           |
| 4     | [`phase-4/phase-4-ai-exec.md`](../phase-4/phase-4-ai-exec.md) | [`phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md)                                                |
| 5     | [`phase-5-agent-router.md`](../phase-5-agent-router.md)       | [`research/phase-5-data-architecture-research.md`](../../research/phase-5-data-architecture-research.md) |

**Phase 5 agents:** load continuity + industry alignment at T0 boot — see [`agent-load-tiers.md`](agent-load-tiers.md).

## Repo snapshot (enterprise tenant — 2026-06-04)

| Layer                   | Repo fact                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Tenant resolution       | `@app-tour/tenant-kernel` + `tenant-kernel/` in apps/api                                               |
| Storage                 | `createTourStorageRepository()` — production→Prisma, dev default memory unless `STORAGE_DRIVER=prisma` |
| SoT column              | `tours.canonical_data` JSONB; Prisma `Tour.canonical`                                                  |
| Validate-before-persist | `tours.service.ts` → `canonical-validation.ts` (5.2 VERIFIED)                                          |
| Events (pre-5.4)        | `publishTourCreatedEvent` in-process — replace at 5.4                                                  |

Detail: [`REPO-PROJECT-ALIGNMENT.md`](REPO-PROJECT-ALIGNMENT.md) · guard `p5_repo_alignment`.
