# Tenant branding — production closure roadmap

```yaml
doc_id: TEMP-TENANT-BRANDING-CLOSURE
status: closed (phases 1-8)
scope: workspace logo + displayName (tenant Level 2)
canonical_doc: docs/workspaces/tenant-branding.md
review_date: 2026-06-10
product_bar: final / production — not MVP
```

## Executive summary

پیاده‌سازی فعلی **پایه معماری درست** دارد (SDK contract، API، MinIO، settings module، `TenantBrandMark`، login public branding). برای محصول نهایی، شکاف‌های **UX، RBAC در UI، هم‌خوانی با الگوی settings، پوشش تست API، و بستن edge-caseهای workspace** باید بسته شوند.

این سند نقایص شناسایی‌شده در بازبینی ۲۰۲۶-۰۶-۱۰ را فازبندی می‌کند. هر فاز **DoD (Definition of Done)** دارد؛ تا پایان فاز ۴، مسیرهای P0 بسته می‌شوند؛ **فازهای ۵–۷ برای محصول نهایی الزامی‌اند** (نه اختیاری MVP).

---

## Inventory — وضعیت فعلی vs هدف


| Area            | Current                                                       | Production target                               |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| Data model      | `tenants.theme.logo` + `displayName`                          | unchanged                                       |
| Upload security | Content-Type whitelist, 2 MiB, tenant-scoped key              | + magic-byte parity with tour photos (Phase 6)  |
| API authz       | Service: admin/owner mutate                                   | + workspace guard + module access parity        |
| Settings UI     | Full upload UI for all roles                                  | `canManage` gate like equipment/locations       |
| Chrome refresh  | Logo URL fetch on mount only                                  | Immediate reflect after upload/delete/save      |
| Login brand     | Denali fallback hardcoded                                     | Plugin-aware fallback cascade                   |
| Tests           | SDK + web contract                                            | + API integration + settings-modules assertion  |
| Docs registry   | `tenant-branding.md`                                          | + SETTINGS-MODULE-REGISTRY + phase-4 cross-link |
| CASL / ability  | `operator.settings.workspace_branding` (no `.read`/`.mutate`) | Align with CASL-OPERATOR-SPEC §9.6              |
| Performance     | N× signed-URL fetches per shell                               | Shared cache or single provider                 |


---

## Phase 1 — RBAC & settings UI parity (P0)

**هدف:** صفحه branding همان قرارداد سایر ماژول‌های settings را رعایت کند؛ member فقط مشاهده، admin/owner تغییر.

### Gaps


| ID    | Gap                                                                                  | Severity |
| ----- | ------------------------------------------------------------------------------------ | -------- |
| BR-01 | `branding-settings-client.tsx` فاقد `isAdminOrOwnerRole(session.role)` و `canManage` | P0       |
| BR-02 | دکمه‌های آپلود / حذف / ذخیره نام نمایشی برای member فعال است → 403 در API            | P0       |
| BR-03 | پیام read-only برای member (الگوی reconciliation-triage / equipment) وجود ندارد      | P1       |


### Files

```text
apps/web/app/(app)/settings/branding/branding-settings-client.tsx
apps/web/messages/en/settings.json
apps/web/messages/fa/settings.json
```

### Tasks

1. import `isAdminOrOwnerRole` از `@/features/bookings/bookings-command-center-types`
2. `const canManage = isAdminOrOwnerRole(session.role)`
3. disable: file input trigger، remove، save display name وقتی `!canManage`
4. نمایش banner یا helper text برای member
5. `data-can-manage` test id برای spec

### DoD

- [x] member: GET branding + preview OK؛ POST/PATCH/DELETE در UI غیرفعال
- [x] admin/owner: همه actions فعال
- [x] web spec: `settings-branding-rbac.spec.ts`

### Verification

```bash
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs \
  --test test/tenant-branding-contract.spec.ts test/settings-branding-rbac.spec.ts
```

---

## Phase 2 — Live chrome refresh & displayName propagation (P0)

**هدف:** پس از آپلود/حذف لوگو یا ذخیره نام نمایشی، **بدون reload دستی** سایدبار، ویزارد bridge و nav title هم‌خوان باشند.

### Gaps


| ID    | Gap                                                                                 | Severity |
| ----- | ----------------------------------------------------------------------------------- | -------- |
| BR-04 | `TenantBrandMark` فقط در mount یک بار `logo/url` می‌گیرد                            | P0       |
| BR-05 | پس از upload در settings، sidebar/wizard لوگوی قدیمی یا fallback نشان می‌دهد        | P0       |
| BR-06 | `displayName` در layout از SSR — بعد از PATCH نیاز به `router.refresh()` یا context | P0       |
| BR-07 | چند instance از `TenantBrandMark` = چند fetch موازی به `/logo/url`                  | P1       |


### Recommended approach

**Option A (minimal):** `router.refresh()` پس از mutate موفق در branding client.

**Option B (production-grade):** `TenantBrandingProvider` در `(app)/layout.tsx` — یک fetch per revision، `invalidateBranding()` پس از mutate.

### Files

```text
apps/web/src/admin/shell/tenant-brand-mark.tsx
apps/web/src/tenant/tenant-branding-context.tsx          # new (Option B)
apps/web/app/(app)/layout.tsx
apps/web/app/(app)/settings/branding/branding-settings-client.tsx
apps/web/src/shell/wizard-bridge-shell.tsx
apps/web/src/admin/shell/operator-brand.tsx
```

### DoD

- [x] upload logo → sidebar + wizard header لوگوی جدید بدون F5
- [x] remove logo → fallback plugin mark فوری
- [x] save displayName → عنوان brand در nav به‌روز
- [x] حداکثر ۱ درخواست `logo/url` per navigation (context یا SWR)

---

## Phase 3 — API hardening & workspace isolation (P0)

**هدف:** branding API فقط برای workspaceهایی که ماژول را expose می‌کنند؛ urban مسدود.

### Gaps


| ID    | Gap                                                                                                  | Severity |
| ----- | ---------------------------------------------------------------------------------------------------- | -------- |
| BR-08 | branding routes فاقد `settings-workspace-guard`                                                      | P0       |
| BR-09 | urban: settings hub فقط account — ولی `/settings/branding` API همچنان قابل فراخوانی                  | P0       |
| BR-10 | `requireSettingsModuleAccess` برای `workspace_branding` اعمال نشده                                   | P1       |
| BR-11 | `validateTenantTheme` شکل storageKey را چک می‌کند نه تطابق tenantId در ingress (upload path امن است) | info     |


### Files

```text
apps/api/src/tenant/tenant-branding.service.ts
apps/api/src/tenant/tenant-branding.routes.ts
apps/api/src/settings/settings-workspace-guard.ts
docs/workspaces/tenant-branding.md
```

### DoD

- [x] urban: GET/PATCH/POST/DELETE branding → 403/404 consistent
- [x] denali/starter: unchanged
- [x] `tenant-branding-urban-regression.spec.ts`

---

## Phase 4 — Test closure (P0)

**هدف:** پوشش تست هم‌تراز سایر ماژول‌های Phase 9.6.

### Gaps


| ID    | Gap                                                  | Severity |
| ----- | ---------------------------------------------------- | -------- |
| BR-12 | نبود `apps/api/test/tenant-branding.spec.ts`         | P0       |
| BR-13 | `settings-modules.spec.ts` فاقد `workspace_branding` | P1       |
| BR-14 | نبود تست upload با memory/minio mock                 | P1       |
| BR-15 | نبود تست public `/public/tenant-branding`            | P1       |


### API test matrix (minimum)


| Test ID   | Scenario                       | Expected                |
| --------- | ------------------------------ | ----------------------- |
| API-TB-01 | GET branding unauthenticated   | 401                     |
| API-TB-02 | GET branding member            | 200                     |
| API-TB-03 | POST logo member               | 403                     |
| API-TB-04 | POST logo invalid content-type | 400                     |
| API-TB-05 | POST logo admin valid PNG      | 201                     |
| API-TB-06 | GET logo/url when set          | 200                     |
| API-TB-07 | DELETE logo admin              | 200                     |
| API-TB-08 | GET public tenant-branding     | 200                     |
| API-TB-09 | PATCH displayName admin        | 200                     |
| API-TB-10 | urban tenant GET branding      | 403/404 (after Phase 3) |


### DoD

- [x] `test:changed` سبز
- [x] هیچ تست branding فقط grep-on-file بدون behavior

---

## Phase 5 — Login & plugin-aware fallback (P1 — الزامی برای محصول نهایی)

### Gaps


| ID    | Gap                                                | Severity |
| ----- | -------------------------------------------------- | -------- |
| BR-16 | `LoginTenantBrand` fallback همیشه `DenaliLogoMark` | P1       |
| BR-17 | starter workspace روی login initial mark ندارد     | P1       |
| BR-18 | منطق fallback با `TenantBrandMark` duplicate است   | P2       |


### Files

```text
apps/web/src/features/auth/login-tenant-brand.tsx
apps/web/src/admin/shell/tenant-brand-mark.tsx
```

### DoD

- [x] denali login: tenant logo یا Denali mark
- [x] starter login: tenant logo یا initial — نه Denali
- [x] `login-tenant-brand.spec.ts`

---

## Phase 6 — Client validation & upload UX (P1 — الزامی برای محصول نهایی)

### Gaps


| ID    | Gap                                      | Severity |
| ----- | ---------------------------------------- | -------- |
| BR-19 | بدون چک 2MB قبل از POST                  | P1       |
| BR-20 | بدون feedback نوع فایل نامعتبر در client | P1       |
| BR-21 | magic-byte sniff در API نیست             | P2       |


### Files

```text
apps/web/app/(app)/settings/branding/branding-settings-client.tsx
apps/web/src/i18n/resolve-tenant-brand-upload-error.ts
apps/api/src/tenant/tenant-branding-storage.ts
```

### DoD

- [x] فایل 3MB → پیام localized بدون round-trip
- [x] SVG → رد در client

---

## Phase 7 — CASL, registry docs & OpenAPI parity (P2)

### Gaps


| ID    | Gap                                              | Severity |
| ----- | ------------------------------------------------ | -------- |
| BR-22 | ability بدون `.read`/`.mutate`                   | P2       |
| BR-23 | `workspace_branding` در member-readable set نیست | P2       |
| BR-24 | SETTINGS-MODULE-REGISTRY فاقد ردیف               | P2       |
| BR-25 | phase-4.4-tenant-theme بدون cross-link           | P2       |
| BR-26 | OpenAPI dispatch parity برای branding            | P2       |


### DoD

- [x] SDK operator-ability tests برای workspace_branding
- [x] phase-9:guard بدون regression

---

## Phase 8 — Production gate & sign-off (P0)

### Merge order

```text
PR-1: Phase 1 + 2 (web UX)
PR-2: Phase 3 + 4 (API guard + tests)
PR-3: Phase 5 + 6 (login + client validation)
PR-4: Phase 7 + doc pack
```

### Manual QA

```text
1. denali admin → upload PNG → sidebar + wizard بدون F5
2. remove logo → Denali mark
3. displayName → nav title
4. member → read-only UI
5. logout → login tenant logo
6. urban → module hidden + API blocked
7. oversized / wrong type → localized errors
```

### Sign-off checklist

- [x] Phases 1–4 (P0)
- [x] Phases 5–6 (الزامی محصول نهایی)
- [x] Phase 7 (doc/CASL hygiene)
- [x] `docs/workspaces/tenant-branding.md` به‌روز
- [x] Architect YES

---

## Traceability — gap ID → phase


| Gap ID        | Phase |
| ------------- | ----- |
| BR-01 … BR-03 | 1     |
| BR-04 … BR-07 | 2     |
| BR-08 … BR-10 | 3     |
| BR-12 … BR-15 | 4     |
| BR-16 … BR-18 | 5     |
| BR-19 … BR-21 | 6     |
| BR-22 … BR-26 | 7     |
| Sign-off      | 8     |


---

## References


| Resource              | Path                                                              |
| --------------------- | ----------------------------------------------------------------- |
| Canonical feature doc | `docs/workspaces/tenant-branding.md`                              |
| SDK contract          | `packages/workspace-sdk/src/theme/tenant-brand-logo.ts`           |
| API                   | `apps/api/src/tenant/tenant-branding.{service,routes,storage}.ts` |
| Settings UI           | `apps/web/app/(app)/settings/branding/`                           |
| Brand component       | `apps/web/src/admin/shell/tenant-brand-mark.tsx`                  |
| CASL                  | `docs/phase-9/appendices/CASL-OPERATOR-SPEC.md`                   |
| Registry              | `docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md`             |


---

## Notes

- **Doc-first:** تغییر قرارداد در `apps/api` / `workspace-sdk` → ابتدا `docs/workspaces/tenant-branding.md`.
- **Not MVP:** فازهای ۵ و ۶ برای ادعای «محصول نهایی» اختیاری نیستند.
- **Verification:** fast-track تا درخواست صریح full gate.

