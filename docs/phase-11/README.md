# Phase 11 — Wizard Platform (WEP)

> **وضعیت:** DONE — **11.0–11.18** (2026-06-11)  
> **هدف:** زیرساخت reusable (draft-engine، wizard-navigation) + binder نازک Denali — **بدون** تغییر semantics قوانین تأییدشده مشتری  
> **نقشه اجرا:** `TEMP/wizard-platform-implementation-roadmap.md` (historical local scratch `wizard-platform-implementation-roadmap.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)  
> **شکاف‌ها:** `TEMP/wizard-template-settings-gaps.md` (historical local scratch `wizard-template-settings-gaps.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)

## پیش‌نیاز

- Phase 10 workspace host contract green (`pnpm run phase-10:guard`)
- Phase 9 operator shell + settings modules (9.6+)

## سندهای این فاز

| سند | نقش |
| --- | --- |
| [`subphases/11.0-smoke-workspace-alignment.md`](subphases/11.0-smoke-workspace-alignment.md) | DEC-P11-001 — هم‌ترازی `workspaceType` API/web در operator smoke |
| [`subphases/11.1-draft-engine-package.md`](subphases/11.1-draft-engine-package.md) | DEC-P11-002 — `@app-tour/draft-engine` |
| [`workspace-draft-persistence.md`](workspace-draft-persistence.md) | DEC-P11-003 — `workspace_draft_snapshots` API |
| [`subphases/11.2-workspace-draft-persistence.md`](subphases/11.2-workspace-draft-persistence.md) | 11.2 acceptance |
| [`web-draft-host.md`](web-draft-host.md) | DEC-P11-004 — BFF + `useWorkspaceDraft` |
| [`subphases/11.3-web-draft-host.md`](subphases/11.3-web-draft-host.md) | 11.3 acceptance |
| [`wizard-navigation.md`](wizard-navigation.md) | DEC-P11-005 — focus + validation navigation |
| [`subphases/11.4-wizard-navigation.md`](subphases/11.4-wizard-navigation.md) | 11.4 acceptance |
| [`denali-wizard-draft-binding.md`](denali-wizard-draft-binding.md) | DEC-P11-006 — Denali draft binder |
| [`subphases/11.5-denali-wizard-draft-binding.md`](subphases/11.5-denali-wizard-draft-binding.md) | 11.5 acceptance |
| [`tour-clone-hydration.md`](tour-clone-hydration.md) | DEC-P11-007 — `?clone=tourId` hydrate |
| [`subphases/11.6-tour-clone-hydration.md`](subphases/11.6-tour-clone-hydration.md) | 11.6 acceptance |
| [`denali-review-step.md`](denali-review-step.md) | DEC-P11-008 — review + validation UX |
| [`subphases/11.7-denali-review-step.md`](subphases/11.7-denali-review-step.md) | 11.7 acceptance |
| [`denali-rules-parity.md`](denali-rules-parity.md) | DEC-P11-009 — dong, invariants, overlay |
| [`subphases/11.8-denali-rules-parity.md`](subphases/11.8-denali-rules-parity.md) | 11.8 acceptance |
| [`subphases/11.9-workspace-draft-list.md`](subphases/11.9-workspace-draft-list.md) | 11.9 draft list index |
| [`canonical-array-ingress.md`](canonical-array-ingress.md) | 11.10 — arrays in canonical submit |
| [`subphases/11.11-draft-audit-ui.md`](subphases/11.11-draft-audit-ui.md) | 11.11 draft events timeline |
| [`subphases/11.12-server-tour-clone.md`](subphases/11.12-server-tour-clone.md) | 11.12 `POST /tours/{id}/clone` |
| [`subphases/11.13-clone-photo-remint.md`](subphases/11.13-clone-photo-remint.md) | 11.13 photo remint on clone |
| [`subphases/11.14-web-bff-tour-clone.md`](subphases/11.14-web-bff-tour-clone.md) | 11.14 BFF `POST /api/tours/{id}/clone` |
| [`subphases/11.15-spots-remaining-catalog.md`](subphases/11.15-spots-remaining-catalog.md) | 11.15 marketing `spotsRemaining` |
| [`subphases/11.16-user-portal.md`](subphases/11.16-user-portal.md) | 11.16 `apps/portal` registration shell |
| [`subphases/11.17-closure-polish.md`](subphases/11.17-closure-polish.md) | 11.17 draft audit settings + `compatibleCategories` |
| [`subphases/11.18-portal-e2e-smoke.md`](subphases/11.18-portal-e2e-smoke.md) | 11.18 portal Playwright smoke + urban host alignment |
| [`appendices/IMPLEMENTATION-DECISIONS.md`](appendices/IMPLEMENTATION-DECISIONS.md) | DECهای فاز ۱۱ |

## قانون اجرا

1. **Doc-first** — هر تغییر در `apps/api` / `workspace-sdk` / `platform-core` با به‌روزرسانی `docs/phase-11/`  
2. **Denali rules frozen** — فقط wire/infrastructure؛ semantics در `packages/workspaces/denali/src/rules/` بدون تغییر مگر تأیید مشتری  
3. **Tiered verify** — `pnpm run pre-commit:fast` / `test:changed`؛ بدون full gate مگر Architect YES

## زیرفازها (خلاصه)

| فاز | موضوع |
| --- | ----- |
| 11.0 | smoke workspace alignment ✅ |
| 11.1 | `@app-tour/draft-engine` package ✅ |
| 11.2 | `workspace_draft_snapshots` API ✅ |
| 11.3 | Web `useWorkspaceDraft` + BFF ✅ |
| 11.4 | `wizard-navigation` platform ✅ |
| 11.5 | Denali wizard draft binder ✅ |
| 11.6 | tour clone hydration (`?clone=`) ✅ |
| 11.7 | review step + validation UX ✅ |
| 11.8 | rules parity hardening ✅ |
| 11.9 | draft list + events audit ✅ |
| 11.10 | canonical array ingress ✅ |
| 11.11 | draft audit timeline UI ✅ |
| 11.12 | server `POST /tours/{id}/clone` ✅ |
| 11.13 | clone photo remint (canonical + MinIO) ✅ |
| 11.14 | web BFF `POST /api/tours/{id}/clone` ✅ |
| 11.15 | marketing `spotsRemaining` ✅ |
| 11.16 | `apps/portal` guest registration ✅ |
| 11.17 | draft audit settings + `compatibleCategories` ✅ |
| 11.18 | portal E2E smoke (SMK-PTL-01) + urban `:3003` ✅ |

## گام بعدی

Phase 11 gate · Phase 9.8 hooks · SMK-P9-02 wizard create smoke
