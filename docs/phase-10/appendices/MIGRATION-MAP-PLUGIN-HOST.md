# Migration map — Product-Aware Trunk → Plugin Host

> Phase 10 · پیوست RFC · هر ردیف = یک PR ترجیحاً

## Legend

| Shim | معنی |
| ---- | ---- |
| **none** | جایگزینی مستقیم |
| **re-export** | فایل قدیم فقط `export … from 'workspace-package'` |
| **delegate** | فایل قدیم یک خط به module جدید |
| **generated** | خروجی `generate:workspace-registry` |
| **keep** | عمداً در trunk می‌ماند (adapter/infra) |

---

## Phase 1 — Events

| فاز | فایل فعلی | فایل هدف | Shim | PR |
| --- | --------- | -------- | ---- | -- |
| 1-S2 | `outbox/outbox-relay.ts` L359–368 | `workspace/workspace-tour-created-dispatcher.ts` | delegate | P1-PR2 |
| 1-S2 | `denali-finance/process-denali-finance-outbox.ts` | همان (موقت) | keep | P1-PR2 |
| 1-S3 | `process-denali-finance-outbox.ts` | handler در `workspaces/denali/src/finance/` | delegate | P1-PR3 |
| 1-S3 | `outbox-relay.ts` imports | صفر import محصول | none | P1-PR3 |

**دست نزن در فاز ۱:** `platform-core/`, `workspace-plugins.ts`, `app.ts`

---

## Phase 2 — Manifest / registry

| فاز | فایل فعلی | فایل هدف | Shim | PR |
| --- | --------- | -------- | ---- | -- |
| 2-S1 | — | `workspaces/*/workspace.manifest.json` | none | P2-PR1 |
| 2-S2 | — | `scripts/generate-workspace-registry.mjs` | none | P2-PR2 |
| 2-S2 | — | `apps/api/.../workspace-plugin-registry.generated.ts` | generated | P2-PR2 **DONE** |
| 2-S3 | `workspace/workspace-plugins.ts` | delegate → generated | re-export سپس حذف imports | P2-PR3 |
| 2-S3 | `workspace-sdk/.../workspace-type-binding.ts` | `DEFAULT_*` از generated | re-export | P2-PR3 |
| 2-S3 | `apps/web/.../load-workspace-plugin.ts` | lookup generated | delegate | P2-PR3 |
| 2-S4 | `dependency-cruiser.config.js` | rule loader-only | none | P2-PR4 |

---

## Phase 3 — HTTP (urban pilot)

| فاز | فایل فعلی | فایل هدف | Shim | PR |
| --- | --------- | -------- | ---- | -- |
| 3-S2 | `app.ts` `/urban/*` blocks | `http/workspace-route-registrar.ts` | delegate | P3-PR2 |
| 3-S3 | `apps/api/src/urban/*.ts` (۱۷ فایل) | `workspaces/urban/src/http/` | re-export | P3-PR3a **DONE** |
| 3-S3 | ~~`apps/api/src/urban/*.ts`~~ shim | حذف | `http/configure-urban-http-host.ts` only | **DONE** (P3-T11) |
| 3-S3 | `openapi/dispatch-routes.ts` | از manifest | generated/validate | P3-PR4 |

---

## Phase 4 — Finance + web

| فاز | فایل فعلی | فایل هدف | Shim |
| --- | --------- | -------- | ---- |
| 4 | ~~`denali-finance/finance.routes.ts`~~ | `workspaces/denali/src/http/finance.routes.ts` | **removed** (P4-T11) — `http/configure-denali-finance-http-host.ts` + direct `@app-tour/workspace-denali/http` |
| 4 | ~~`lazy-denali-plugin.ts`, `lazy-urban-plugin.ts`~~ | `workspace-plugin-loaders.generated.ts` | **removed** (P4-T03) |
| 4 | `tours.routes.ts` urban gate | `@app-tour/workspace-urban/tours` + `workspace-tour-write-dispatch.ts` | **done** (P4-T05) |
| 4 | `canonical-tour.service` urban merge | `mergeUrbanCanonicalPatchData` | **done** (P4-T06) |

---

## فایل‌های هرگز منتقل نشوند (host infra)

| فایل | دلیل |
| ---- | ---- |
| `db/with-tenant-rls.ts` | RLS boundary |
| `tenant-kernel/*` | auth resolution |
| `outbox/outbox-relay.ts` (core loop) | transport |
| `denali-finance/prisma-*-outbox-*.ts` | Prisma adapter (تا DEC data) |
| `middleware/error-interceptor.ts` | cross-cutting (فقط mapping خطاها migrate) |

---

## `platform-core` — ممنوع

هیچ ردیف migration در `packages/platform-core/` وجود ندارد.
