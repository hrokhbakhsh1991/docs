# Platform continuity — Phases 0–5 (canonical)

```yaml
continuity_version: "2026-06-04-v1"
project: "Interoperable workspace SaaS — pool multi-tenant Postgres"
standard: "Same patterns as Phase 5 BOOT-MANIFEST + REPO-PROJECT-ALIGNMENT"
guard: scripts/guards/lib/phase-cross-continuity.mjs
```

> **Canonical cross-phase SoT** — phase folders extend this file; do not duplicate ownership tables.

## Phase ownership (must not bleed)

| Phase | Delivers to platform                                                                  | Must NOT own (defer)                            |
| ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **0** | `CanonicalDocument`, `workspace-sdk`, theme contracts                                 | Tenant RLS, Postgres tours, outbox              |
| **1** | `PlatformWizardEngine`, headless rules                                                | UI shell, DB persist, tenant routing            |
| **2** | Design tokens, `theme-react`, `--ws-*` ingress                                        | Tenant DB, canonical column                     |
| **3** | `WorkspacePlugin`, CASL, `apps/api` + `apps/web` scaffold, canonical write path       | RLS production, `canonical_data` rename, outbox |
| **4** | `tenant-kernel`, host→tenantId, RLS `tours`, in-process events, tenant theme          | `canonical_data` DDL, `outbox_events` table     |
| **5** | `canonical_data`, projections, outbox, `audit_events`, validate-before-persist at API | Denali port, MinIO, silo routing (6–7)          |

## Gate chain (repo — `package.json`)

```yaml
phase-0:gate: "foundation + integration"
phase-1:gate: "platform-core"
phase-2:gate: "design-system"
phase-3:gate: "starter apps + p3 guards"
phase-4:gate: "build + test + phase-3:gate + phase-4:guard"
phase-5:gate: "build + test + phase-4:gate + phase-5:guard"
```

**Rule:** Phase N gate **includes** Phase N-1 closure where nested — never skip `phase-4:gate` before Phase 5 work.

## Agent entrypoints per phase

| Phase | Sole execution entry               | Cross-phase read at boot                                |
| ----- | ---------------------------------- | ------------------------------------------------------- |
| 0     | `phase-0/phase-0.ai-exec.index.md` | this file (T1)                                          |
| 1     | `phase-1/phase-1-ai-exec.md`       | this file (T1)                                          |
| 2     | `phase-2/phase-2-ai-exec.md`       | this file (T1)                                          |
| 3     | `phase-3/phase-3.ai-exec.index.md` | this file (T1)                                          |
| 4     | `phase-4/phase-4-ai-exec.md`       | this file + `phase-4/appendices/phase-handoff-3-4-5.md` |
| 5     | `phase-5/phase-5-agent-router.md`  | this file + `phase-5/appendices/BOOT-MANIFEST.yaml`     |

## End-to-end request flow (0→5)

```text
[0] CanonicalDocument envelope
[1] PlatformWizardEngine.validateCanonical (rules)
[2] theme tokens / ingress (visual only)
[3] WorkspacePlugin + CASL + CanonicalTourService write path
[4] tenant-kernel → tenantId + RLS session on tours
[5] validateCanonical(plugin) → withCanonicalTransaction
      → tours.canonical_data + projections + outbox + audit
```

Detail: [`../phase-5/appendices/workspace-data-layer-model.md`](../phase-5/appendices/workspace-data-layer-model.md)

## SQL migration order

| Order | File                                  | Phase | FAIL if                     |
| ----- | ------------------------------------- | ----- | --------------------------- |
| 1     | `infra/sql/001_tenant_rls.sql`        | 4     | 5 DDL before 4 RLS base     |
| 2     | `infra/sql/002_phase5_data_layer.sql` | 5     | before `phase-4:gate` / 4.6 |

## Event mechanism evolution

| Phase        | Mechanism                               | Doc                   |
| ------------ | --------------------------------------- | --------------------- |
| 3–4 scaffold | In-process optional                     | Phase 4.5             |
| 5.0–5.3      | In-process still allowed                | `phase-4-bridge`      |
| 5.4+         | `outbox_events` same TX — FORBIDDEN-006 | `phase-5-enforcement` |

## Phase 4 → 5 entry contract

| Source                                                    | Target                                |
| --------------------------------------------------------- | ------------------------------------- |
| `phase-4-enforcement.md` `phase_5_entry_requires_modular` | `phase-5/subphases/5.0-entry-gate.md` |
| `phase-4:gate` exit 0                                     | `pnpm run phase-4:gate` at 5.0        |
| `reports/phase-5-entry-verified.yaml`                     | updated at 5.0 PASS                   |

Map: [`../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md`](../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md)

## Package boundaries (import law)

```yaml
allowed: apps/api → workspace-sdk, platform-core, tenant-kernel, workspace-starter, platform-events
forbidden: platform-core → tenant-kernel
  workspace-sdk → apps/*
  platform-core → workspaces/* (before starter green)
```

## Cross-links by phase folder

| Phase | Continuity appendix                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4     | [`phase-4/appendices/phase-handoff-3-4-5.md`](../phase-4/appendices/phase-handoff-3-4-5.md)                                                                                                                                                                                     |
| 5     | [`phase-5/appendices/platform-continuity-0-5.md`](../phase-5/appendices/platform-continuity-0-5.md) · [`phase-5/appendices/phase-4-bridge.md`](../phase-5/appendices/phase-4-bridge.md) · [`phase-5/appendices/phase-0-3-bridge.md`](../phase-5/appendices/phase-0-3-bridge.md) |
| MAP   | [`MIGRATION-MAP.md`](../MIGRATION-MAP.md) Phase 5 §11–12                                                                                                                                                                                                                        |
