# Migration — quick index

**نقشهٔ کل:** [`MIGRATION-MAP.md`](MIGRATION-MAP.md) — شامل §5 infra · §6 events · §7 tenant · §8 versioning · §10 observability

## سندهای فاز (اجرایی — جزئیات کامل)

| فاز | سند |
|-----|------|
| **0** Foundation & SDK | [`phase-0-foundation.md`](phase-0-foundation.md) ✅ · AI-exec: [`phase-0/`](phase-0/README.md) |
| **1** Platform core | [`phase-1-platform-core.md`](phase-1-platform-core.md) ✅ · AI-exec: [`phase-1/`](phase-1/README.md) |
| **2** Design system | [`phase-2-design-system.md`](phase-2-design-system.md) ✅ · AI-exec: [`phase-2/`](phase-2/README.md) |
| **3** Starter + apps | [`phase-3-design-system.md`](phase-3-design-system.md) ✅ · AI-exec: [`phase-3/`](phase-3/README.md) |
| **4** Tenant kernel | [`phase-4-tenant-kernel.md`](phase-4-tenant-kernel.md) — **active** · AI-exec: [`phase-4/`](phase-4/README.md) |

## North star

Platform logic = generic · Workspace logic = injectable · Tenant = security boundary

## فاز جاری

**Phase 4** — Tenant kernel (RLS, subdomain, Postgres SoT) — **active** · [`phase-4-tenant-kernel.md`](phase-4-tenant-kernel.md) · agents: [`phase-4/phase-4.ai-exec.index.md`](phase-4/phase-4.ai-exec.index.md)

**Prerequisite:** Phase 3 `phase-3:gate` + sub-phase **4.0** (R0–R3 red flags) per [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md)

```bash
pnpm run phase-3:gate   # frozen baseline before phase 4 work
pnpm run phase-4:gate   # when phase-4-guard ships
pnpm run phase-0:gate   # full phase 0 regression
pnpm build && pnpm test
```

## Legacy

[`legacy/`](../legacy/) — monorepo قبلی؛ مرجع port Denali (فاز ۶).
