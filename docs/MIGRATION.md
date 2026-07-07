# Migration — quick index

**نقشهٔ کل:** [`MIGRATION-MAP.md`](MIGRATION-MAP.md) — شامل §5 infra · §6 events · §7 tenant · §8 versioning · §10 observability

## سندهای فاز (اجرایی — جزئیات کامل)

| فاز                        | سند                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **0** Foundation & SDK     | [`phase-0-foundation.md`](phase-0-foundation.md) ✅ · AI-exec: [`phase-0/`](phase-0/README.md)                                  |
| **1** Platform core        | [`phase-1-platform-core.md`](phase-1-platform-core.md) ✅ · AI-exec: [`phase-1/`](phase-1/README.md)                            |
| **2** Design system        | [`phase-2-design-system.md`](phase-2-design-system.md) ✅ · AI-exec: [`phase-2/`](phase-2/README.md)                            |
| **3** Starter + apps       | [`phase-3-design-system.md`](phase-3-design-system.md) ✅ · AI-exec: [`phase-3/`](phase-3/README.md)                            |
| **4** Tenant kernel        | [`phase-4-tenant-kernel.md`](phase-4-tenant-kernel.md) ✅ · AI-exec: [`phase-4/`](phase-4/README.md)                            |
| **5** Canonical data layer | [`phase-5-canonical-schema.md`](phase-5-canonical-schema.md) · AI-exec: [`phase-5/`](phase-5/README.md)                         |
| **6** Denali workspace     | [`phase-6-denali-workspace.md`](phase-6-denali-workspace.md) · AI-exec: [`phase-6/`](phase-6/README.md)                         |
| **7** Urban platform       | [`phase-7/phase-7-charter.md`](phase-7/phase-7-charter.md) · [`phase-7/phase-7-agent-router.md`](phase-7/phase-7-agent-router.md) |
| **8** Urban Product Parity | [`phase-8/phase-8-charter.md`](phase-8/phase-8-charter.md) · [`phase-8/phase-8-agent-router.md`](phase-8/phase-8-agent-router.md) |
| **9** Operator Admin Panel | [`phase-9/phase-9-charter.md`](phase-9/phase-9-charter.md) · [`phase-9/phase-9-agent-router.md`](phase-9/phase-9-agent-router.md) |
| **10** Workspace Host | [`phase-10/phase-10-charter.md`](phase-10/phase-10-charter.md) · plugin-native host **DONE** (10.1–10.7) |
| **19** P6 Denali first customer | [`phase-19/README.md`](phase-19/README.md) · [`phase-19/p6/AGENT-START.md`](phase-19/p6/AGENT-START.md) · exit: `pnpm run p6:gate` |
| **20** P7 Denali customer live | [`phase-20/README.md`](phase-20/README.md) · [`p7/AGENT-START.md`](phase-20/p7/AGENT-START.md) · [`platform-denali-customer-delivery.mdoc`](phase-20/platform-denali-customer-delivery.mdoc) · [`p7/appendices/P7-DOC-ARCHITECTURE.md`](phase-20/p7/appendices/P7-DOC-ARCHITECTURE.md) |

**Cross-phase continuity:** [`appendices/PLATFORM-CONTINUITY-0-6.md`](appendices/PLATFORM-CONTINUITY-0-6.md)

## North star

Platform logic = generic · Workspace logic = injectable · Tenant = security boundary

## فاز جاری

**Phase 19 / P6** — Denali first customer — **COMPLETE** (`pnpm run p6:gate`)

**Phase 20 / P7** — Denali customer live — **IN_PROGRESS** (pack v1.4 · doc target 90 · `P7-0-N-002`)

```bash
pnpm run p6:gate                  # P6 regression (required on every P7 PR)
# P7 entry: docs/phase-20/p7/AGENT-START.md
```

**Phase 10** — Workspace Host (plugin-native) — **implementation DONE**

```bash
pnpm run phase-10:guard             # host invariants (fast)
pnpm run generate:workspace-registry
pnpm run workspace:create -- <id>   # new workspace scaffold
```

## Platform architecture (post-Phase 10)

| Topic | Doc |
| ----- | --- |
| Architecture v2 (Phases F–I) | [`architecture/platform-architecture-v2.md`](architecture/platform-architecture-v2.md) |
| Phase G — registry codegen modularization | [`dev/workspace-registry-codegen-modularization.mdoc`](dev/workspace-registry-codegen-modularization.mdoc) ✅ DEV |
| Phase H — production certification | [`dev/workspace-certification.mdoc`](dev/workspace-certification.mdoc) ✅ DEV |
| Phase I — scale hardening | [`dev/workspace-scale-hardening.mdoc`](dev/workspace-scale-hardening.mdoc) ✅ I0–I2 · GHA green on `DEV` |

```bash
pnpm run guard:workspace-certification   # Phase H fast gate
pnpm run guard:workspace-registry-fresh
pnpm run phase-g-h:fast-track            # G+H PR closure bundle
pnpm run phase-i:closure               # G+H + I1/I2 closure bundle
pnpm run phase-g-h:handoff             # merge PR checklist (no gh)
pnpm run phase-g-h:create-pr           # DEV→main PR (needs gh auth; runs closure first)
# Or: GitHub Actions → phase-g-h-create-pr on branch DEV (no local gh)
pnpm run guard:theme-import-budget       # I1 guard only
pnpm run guard:workspace-plugin-load-cache  # I2 guard only
```

## Legacy

[`legacy/`](../legacy/) — monorepo قبلی؛ مرجع port Denali (فاز ۶).
